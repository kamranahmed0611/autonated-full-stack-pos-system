const catRouter = require('express').Router();
const custRouter = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');
const auth = require('../middleware/auth');

// ── CATEGORIES ──
catRouter.get('/', auth(), (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

catRouter.post('/', auth(['admin','manager']), (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
  if (existing) return res.status(400).json({ error: 'Category name already exists' });

  const id = uuidv4();
  db.prepare('INSERT INTO categories (id,name,color,icon) VALUES (?,?,?,?)').run(id, name, color||'#185FA5', icon||'');
  res.status(201).json({ id });
});

catRouter.put('/:id', auth(['admin','manager']), (req, res) => {
  const { name, color, icon } = req.body;
  if (name) {
    const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(name, req.params.id);
    if (existing) return res.status(400).json({ error: 'Category name already exists' });
  }
  db.prepare('UPDATE categories SET name=?,color=?,icon=? WHERE id=?').run(name, color, icon, req.params.id);
  res.json({ success: true });
});

catRouter.delete('/:id', auth(['admin']), (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category_id=?').get(req.params.id).cnt;
  if (count > 0) return res.status(400).json({ error: 'Cannot delete category: it is assigned to existing products' });
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── CUSTOMERS ──
custRouter.get('/', auth(), (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM customers WHERE 1=1';
  const p = [];
  if (search) { q += ' AND (name LIKE ? OR phone LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  q += ' ORDER BY name';
  res.json(db.prepare(q).all(...p));
});

custRouter.get('/:id', auth(), (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const txns = db.prepare('SELECT id,invoice_no,grand_total,payment_method,created_at FROM transactions WHERE customer_id=? ORDER BY created_at DESC LIMIT 10').all(req.params.id);
  res.json({ ...c, transactions: txns });
});

custRouter.post('/', auth(), (req, res) => {
  const { name, phone, email, address, credit_limit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO customers (id,name,phone,email,address,credit_limit) VALUES (?,?,?,?,?,?)').run(id, name, phone||null, email||null, address||null, credit_limit||0);
  res.status(201).json({ id });
});

custRouter.put('/:id', auth(), (req, res) => {
  const { name, phone, email, address, credit_limit, is_active } = req.body;
  db.prepare('UPDATE customers SET name=?,phone=?,email=?,address=?,credit_limit=?,is_active=COALESCE(?,is_active) WHERE id=?')
    .run(name, phone, email, address, credit_limit, is_active, req.params.id);
  res.json({ success: true });
});

// GET customer full ledger with running balance
custRouter.get('/:id/ledger', auth(), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const txns = db.prepare(`
    SELECT * FROM customer_transactions 
    WHERE customer_id = ? 
    ORDER BY created_at ASC
  `).all(req.params.id);

  // Compute running balance chronologically
  let running = 0;
  const enriched = txns.map(t => {
    if (t.type === 'DEBIT') {
      running += t.amount;
    } else {
      running -= t.amount;
    }
    return { ...t, running_balance: running };
  });

  res.json({ customer, ledger: enriched.reverse() });
});

// RECORD cash repayment (Wasooli / وصولی)
custRouter.post('/:id/payment', auth(), (req, res) => {
  const { amount, notes, payment_mode = 'cash' } = req.body;
  const payAmt = parseFloat(amount);
  if (!payAmt || payAmt <= 0) return res.status(400).json({ error: 'Valid payment amount required' });

  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const newBalance = Math.max(0, customer.balance - payAmt);
  const txnId = uuidv4();

  const doRepayment = db.transaction(() => {
    // 1. Insert CREDIT entry
    db.prepare(`
      INSERT INTO customer_transactions (id, customer_id, type, amount, balance_after, notes)
      VALUES (?, ?, 'CREDIT', ?, ?, ?)
    `).run(txnId, req.params.id, payAmt, newBalance, notes || 'Cash Payment Received (Wasooli / وصولی)');

    // 2. Update customer balance
    db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBalance, req.params.id);

    // 3. If paid in cash, add to active shift cash sales/float
    if (payment_mode === 'cash') {
      const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1").get();
      if (activeShift) {
        db.prepare('UPDATE shifts SET total_sales_cash = total_sales_cash + ? WHERE id = ?')
          .run(payAmt, activeShift.id);
      }
    }
  });

  doRepayment();
  res.json({ success: true, new_balance: newBalance });
});

// GENERATE 1-Click WhatsApp Statement
custRouter.get('/:id/whatsapp-statement', auth(), (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const storeSettings = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map(s => [s.key, s.value])
  );

  const recentTxns = db.prepare(`
    SELECT * FROM customer_transactions 
    WHERE customer_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(req.params.id);

  const storeName = storeSettings.store_name || 'MR Super Store';
  const storeAddress = storeSettings.store_address || 'Allah Wali Market, Street 33, F-8/1, Islamabad';
  const storePhone = storeSettings.store_phone || '+92 306 5157506';

  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  let txList = '';
  if (recentTxns.length) {
    txList = recentTxns.map(t => {
      const dt = new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      const symbol = t.type === 'DEBIT' ? 'Debit:' : 'Credit (Wasooli):';
      return `• ${dt}: ${t.notes || t.type} --> ${symbol} *Rs. ${t.amount.toLocaleString()}*`;
    }).join('\n');
  } else {
    txList = '• No recent ledger movements';
  }

  const rawMessage = `*${storeName}*
${storeAddress}
Ph: ${storePhone}
----------------------------------------
*CUSTOMER ACCOUNT STATEMENT / کھاتہ سٹیٹمنٹ*
Customer: ${customer.name}
Phone: ${customer.phone || 'N/A'}
Date: ${dateStr}, ${timeStr}
----------------------------------------
*RECENT TRANSACTIONS:*
${txList}
----------------------------------------
*CURRENT NET PAYABLE (بقایا جات): Rs. ${customer.balance.toLocaleString()}*
----------------------------------------
*براہ کرم بقایا رقم کی جلد ادائیگی کو یقینی بنائیں۔ شکریہ!*`;

  // Format clean phone for WhatsApp international format
  let cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('03')) cleanPhone = '92' + cleanPhone.slice(1);

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rawMessage)}`;

  res.json({
    raw_message: rawMessage,
    whatsapp_url: whatsappUrl,
    customer_phone: customer.phone,
    current_balance: customer.balance
  });
});

// Users management
const userRouter = require('express').Router();
const bcrypt = require('bcryptjs');

userRouter.get('/', auth(['admin']), (req, res) => {
  res.json(db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY name').all());
});

userRouter.post('/', auth(['admin']), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'User email already registered' });

  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(id, name, email, hashed, role||'cashier');
  res.status(201).json({ id });
});

userRouter.put('/:id', auth(['admin']), (req, res) => {
  const { name, role, active } = req.body;
  db.prepare('UPDATE users SET name=?,role=?,active=? WHERE id=?').run(name, role, active??1, req.params.id);
  res.json({ success: true });
});

// Settings
const settingsRouter = require('express').Router();
settingsRouter.get('/', auth(), (req, res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});
settingsRouter.put('/', auth(['admin']), (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
  const update = db.transaction((data) => { Object.entries(data).forEach(([k,v]) => upsert.run(k, v)); });
  update(req.body);
  res.json({ success: true });
});

module.exports = { catRouter, custRouter, userRouter, settingsRouter };
