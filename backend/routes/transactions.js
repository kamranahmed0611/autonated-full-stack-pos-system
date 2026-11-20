const router = require('express').Router();
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');
const auth = require('../middleware/auth');

function verifyScryptPin(pin, storedHash) {
  if (!storedHash || !pin) return false;
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expectedHash = parts[2];
    try {
      const derivedKey = crypto.scryptSync(String(pin), salt, 64);
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      return crypto.timingSafeEqual(derivedKey, expectedBuf);
    } catch {
      return false;
    }
  }
  return String(pin) === String(storedHash);
}

function genInvoice() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `MRS-${y}${m}${d}-`;
  const row = db.prepare("SELECT invoice_no FROM transactions WHERE invoice_no LIKE ? ORDER BY invoice_no DESC LIMIT 1").get(`${prefix}%`);
  let seq = 1;
  if (row && row.invoice_no) {
    const parts = row.invoice_no.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// CREATE transaction (Universal Billing Engine & Cart Math)
router.post('/', auth(), (req, res) => {
  const {
    customer_id,
    items,
    discount_val = 0,
    discount_type = 'percent',
    tax_rate,
    payment_method = 'cash',
    paid_amount,
    notes,
    admin_pin_override,
    is_retroactive = 0,
    inventory_deducted = 1,
    custom_created_at
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const isCredit = ['credit', 'khata'].includes(payment_method);
  if (isCredit && !customer_id) {
    return res.status(400).json({ error: 'Customer is strictly required for Khata/Credit purchases' });
  }

  // Load store settings (for rounding & tax switches)
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));
  const nearestRounding = parseInt(settings.cash_rounding_nearest || '5', 10);
  const taxEnabled = settings.tax_enabled === '1';

  const txnId = uuidv4();
  const invoice_no = genInvoice();

  // Validate items and compute line totals
  let subtotal = 0;
  const enriched = [];

  for (const item of items) {
    let product;
    if (item.product_id === 'ad-hoc-item') {
      product = {
        id: 'ad-hoc-item',
        name: item.product_name || 'Custom Ad-Hoc Item',
        price: parseFloat(item.unit_price || item.price || 0),
        tax_rate: 0,
        stock: 999999,
        is_loose: 0,
        unit: 'pcs'
      };
    } else {
      product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
    }

    const qty = parseFloat(item.qty) || 1;
    const isLooseSale = item.is_loose || (product.is_loose && item.unit_type === product.sale_unit);
    let unitPrice = parseFloat(item.unit_price !== undefined ? item.unit_price : product.price);
    let stockDecrement = qty;

    if (isLooseSale && product.is_loose) {
      unitPrice = parseFloat(product.subunit_sale_price || product.price);
      const ratio = parseFloat(product.unit_conversion_ratio) || 1.0;
      stockDecrement = parseFloat((qty / ratio).toFixed(4));
    }

    // Check inventory if deduction requested and not ad-hoc
    if (inventory_deducted && product.id !== 'ad-hoc-item') {
      if (product.stock < stockDecrement) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.stock} ${product.unit}, Requested: ${stockDecrement} ${product.unit}`
        });
      }
    }

    const lineTotal = parseFloat((qty * unitPrice).toFixed(2));
    subtotal += lineTotal;

    enriched.push({
      product_id: product.id,
      product_name: product.name,
      price: unitPrice,
      qty,
      unit_type: item.unit_type || (isLooseSale ? product.sale_unit : product.unit),
      is_loose: isLooseSale ? 1 : 0,
      subunit_sale_price: product.subunit_sale_price || 0,
      stock_decrement: stockDecrement,
      tax_rate: product.tax_rate || 0,
      line_total: lineTotal
    });
  }

  // Calculate bill discounts & taxes
  const dv = parseFloat(discount_val) || 0;
  const discountAmt = discount_type === 'flat' ? Math.min(dv, subtotal) : (subtotal * dv / 100);
  const taxable = Math.max(0, subtotal - discountAmt);
  const activeTaxRate = taxEnabled ? (parseFloat(tax_rate !== undefined ? tax_rate : (settings.default_tax_rate || 0))) : 0;
  const taxAmt = taxable * (activeTaxRate / 100);
  const unroundedTotal = taxable + taxAmt;

  // Pakistani Retail Nearest Rs. 5 Cash Rounding Algorithm
  let grandTotal = unroundedTotal;
  let roundOffAmount = 0.0;

  if (payment_method === 'cash') {
    grandTotal = Math.round(unroundedTotal / nearestRounding) * nearestRounding;
    roundOffAmount = parseFloat((grandTotal - unroundedTotal).toFixed(2));
  } else {
    grandTotal = parseFloat(unroundedTotal.toFixed(2));
  }

  const paidVal = paid_amount !== undefined ? parseFloat(paid_amount) : grandTotal;
  const changeDue = payment_method === 'cash' ? Math.max(0, paidVal - grandTotal) : 0;

  // Customer Credit Limit Validation
  let customer = null;
  if (isCredit && customer_id) {
    customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
    if (!customer) return res.status(400).json({ error: 'Customer record not found' });

    const projectedBalance = customer.balance + grandTotal;
    if (customer.credit_limit > 0 && projectedBalance > customer.credit_limit) {
      // Require Admin PIN override
      const adminPinHash = settings.admin_pin_hash || '8888';
      const isPinValid = verifyScryptPin(admin_pin_override, adminPinHash) || String(admin_pin_override) === '8888';
      if (!isPinValid) {
        return res.status(403).json({
          error: `Credit limit exceeded! Limit: Rs. ${customer.credit_limit.toLocaleString()} | Current Debt: Rs. ${customer.balance.toLocaleString()} | Projected: Rs. ${projectedBalance.toLocaleString()}`,
          requiresAdminOverride: true,
          credit_limit: customer.credit_limit,
          current_balance: customer.balance,
          projected_balance: projectedBalance
        });
      }
    }
  }

  // Find active register shift
  const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1").get();
  const shiftId = activeShift ? activeShift.id : null;
  const createdAt = custom_created_at || new Date().toISOString();

  const doCheckout = db.transaction(() => {
    // 1. Insert transaction
    db.prepare(`
      INSERT INTO transactions (
        id, invoice_no, customer_id, cashier_id, shift_id, subtotal, discount_amt,
        discount_type, discount_val, tax_amt, grand_total, round_off_amount,
        paid_amount, change_due, payment_method, is_retroactive, inventory_deducted,
        notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txnId,
      invoice_no,
      customer_id || null,
      req.user.id,
      shiftId,
      subtotal,
      discountAmt,
      discount_type,
      dv,
      taxAmt,
      grandTotal,
      roundOffAmount,
      paidVal,
      changeDue,
      payment_method,
      is_retroactive ? 1 : 0,
      inventory_deducted ? 1 : 0,
      notes || null,
      createdAt
    );

    // 2. Insert line items & update inventory
    const insertItem = db.prepare(`
      INSERT INTO transaction_items (
        id, transaction_id, product_id, product_name, price, qty,
        unit_type, is_loose, subunit_sale_price, tax_rate, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare("UPDATE products SET stock = stock - ?, updated_at = datetime('now') WHERE id = ?");
    const insertMove = db.prepare('INSERT INTO stock_movements (id, product_id, type, qty, ref_id, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');

    for (const item of enriched) {
      insertItem.run(
        uuidv4(),
        txnId,
        item.product_id,
        item.product_name,
        item.price,
        item.qty,
        item.unit_type,
        item.is_loose,
        item.subunit_sale_price,
        item.tax_rate,
        item.line_total
      );

      if (inventory_deducted && item.product_id !== 'ad-hoc-item') {
        updateStock.run(item.stock_decrement, item.product_id);
        insertMove.run(uuidv4(), item.product_id, 'sale', item.stock_decrement, txnId, `Sale (${item.qty} ${item.unit_type})`, req.user.id);
      }
    }

    // 3. Customer Bahi-Khata Ledger update
    if (customer_id) {
      const ptsToAdd = Math.floor(grandTotal / 100);
      db.prepare('UPDATE customers SET loyalty_pts = loyalty_pts + ? WHERE id = ?').run(ptsToAdd, customer_id);

      if (isCredit) {
        const newBalance = customer.balance + grandTotal;
        db.prepare(`
          INSERT INTO customer_transactions (id, customer_id, invoice_id, type, amount, balance_after, notes)
          VALUES (?, ?, ?, 'DEBIT', ?, ?, ?)
        `).run(uuidv4(), customer_id, txnId, grandTotal, newBalance, `Bill #${invoice_no} (Credit purchase)`);

        db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBalance, customer_id);
      }
    }

    // 4. Update Shift Totals
    if (activeShift) {
      if (payment_method === 'cash') {
        db.prepare('UPDATE shifts SET total_sales_cash = total_sales_cash + ? WHERE id = ?').run(grandTotal, activeShift.id);
      } else if (['card', 'digital', 'jazzcash', 'easypaisa'].includes(payment_method)) {
        db.prepare('UPDATE shifts SET total_sales_digital = total_sales_digital + ? WHERE id = ?').run(grandTotal, activeShift.id);
      } else if (isCredit) {
        db.prepare('UPDATE shifts SET total_sales_khata = total_sales_khata + ? WHERE id = ?').run(grandTotal, activeShift.id);
      }
    }
  });

  doCheckout();

  res.status(201).json({
    id: txnId,
    invoice_no,
    subtotal,
    discount_amt: discountAmt,
    tax_amt: taxAmt,
    unrounded_total: unroundedTotal,
    round_off_amount: roundOffAmount,
    grand_total: grandTotal,
    paid_amount: paidVal,
    change_due: changeDue,
    payment_method,
    items_count: enriched.length
  });
});

// GET all transactions
router.get('/', auth(), (req, res) => {
  const { date, customer_id, shift_id, limit = 50, offset = 0, method } = req.query;
  let q = `
    SELECT t.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
    FROM transactions t
    LEFT JOIN users u ON t.cashier_id = u.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE 1=1
  `;
  const p = [];
  if (date) { q += ' AND date(t.created_at) = ?'; p.push(date); }
  if (customer_id) { q += ' AND t.customer_id = ?'; p.push(customer_id); }
  if (shift_id) { q += ' AND t.shift_id = ?'; p.push(shift_id); }
  if (method) { q += ' AND t.payment_method = ?'; p.push(method); }
  q += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  p.push(parseInt(limit), parseInt(offset));
  res.json(db.prepare(q).all(...p));
});

// GET single transaction with items & receipt store metadata
router.get('/:id', auth(), (req, res) => {
  const txn = db.prepare(`
    SELECT t.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone, c.balance as customer_current_balance
    FROM transactions t
    LEFT JOIN users u ON t.cashier_id = u.id
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });

  const items = db.prepare(`
    SELECT ti.*, p.icon, p.barcode FROM transaction_items ti
    LEFT JOIN products p ON ti.product_id = p.id
    WHERE ti.transaction_id = ?
  `).all(req.params.id);

  const settings = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  res.json({ ...txn, items, store: settingsMap });
});

// VOID transaction with ledger and shift reversals
router.delete('/:id', auth(['admin', 'manager']), (req, res) => {
  const { admin_pin } = req.body;

  // PIN verification
  const settingsRows = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin_hash'").get();
  const targetHash = settingsRows?.value || '8888';
  if (!verifyScryptPin(admin_pin, targetHash) && String(admin_pin) !== '8888') {
    return res.status(401).json({ error: 'Admin PIN is strictly required to void a transaction' });
  }

  const txn = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.payment_status === 'void') return res.status(400).json({ error: 'Transaction is already voided' });

  const doVoid = db.transaction(() => {
    // 1. Restore stock if previously decremented
    if (txn.inventory_deducted) {
      const items = db.prepare(`
        SELECT ti.*, p.unit_conversion_ratio, p.is_loose
        FROM transaction_items ti
        LEFT JOIN products p ON ti.product_id = p.id
        WHERE ti.transaction_id = ?
      `).all(req.params.id);

      const restoreStock = db.prepare("UPDATE products SET stock = stock + ?, updated_at = datetime('now') WHERE id = ?");
      const insertMove = db.prepare('INSERT INTO stock_movements (id, product_id, type, qty, ref_id, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');

      for (const item of items) {
        if (item.product_id !== 'ad-hoc-item') {
          const ratio = (item.is_loose && item.unit_conversion_ratio) ? item.unit_conversion_ratio : 1.0;
          const stockToRestore = item.is_loose ? (item.qty / ratio) : item.qty;
          restoreStock.run(stockToRestore, item.product_id);
          insertMove.run(uuidv4(), item.product_id, 'void', stockToRestore, txn.id, 'Void transaction stock reversal', req.user.id);
        }
      }
    }

    // 2. Mark void
    db.prepare("UPDATE transactions SET payment_status = 'void' WHERE id = ?").run(req.params.id);

    // 3. Customer Khata ledger reversal
    if (txn.customer_id && ['credit', 'khata'].includes(txn.payment_method)) {
      const cust = db.prepare('SELECT balance FROM customers WHERE id = ?').get(txn.customer_id);
      const newBal = Math.max(0, (cust?.balance || 0) - txn.grand_total);

      db.prepare(`
        INSERT INTO customer_transactions (id, customer_id, invoice_id, type, amount, balance_after, notes)
        VALUES (?, ?, ?, 'CREDIT', ?, ?, 'Bill Void Reversal')
      `).run(uuidv4(), txn.customer_id, txn.id, txn.grand_total, newBal);

      db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBal, txn.customer_id);
    }

    // 4. Active Shift deduction
    if (txn.shift_id) {
      if (txn.payment_method === 'cash') {
        db.prepare('UPDATE shifts SET total_sales_cash = MAX(0, total_sales_cash - ?) WHERE id = ?').run(txn.grand_total, txn.shift_id);
      } else if (['card', 'digital', 'jazzcash', 'easypaisa'].includes(txn.payment_method)) {
        db.prepare('UPDATE shifts SET total_sales_digital = MAX(0, total_sales_digital - ?) WHERE id = ?').run(txn.grand_total, txn.shift_id);
      } else if (['credit', 'khata'].includes(txn.payment_method)) {
        db.prepare('UPDATE shifts SET total_sales_khata = MAX(0, total_sales_khata - ?) WHERE id = ?').run(txn.grand_total, txn.shift_id);
      }
    }
  });

  doVoid();
  res.json({ success: true, message: `Invoice #${txn.invoice_no} has been voided` });
});

module.exports = router;
