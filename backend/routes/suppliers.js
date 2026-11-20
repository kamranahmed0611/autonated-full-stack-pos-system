const router = require('express').Router();
const crypto = require('crypto');
const db = require('../db/init');
const auth = require('../middleware/auth');

// GET all suppliers
router.get('/', auth(), (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM suppliers WHERE is_active = 1';
  const params = [];
  if (search) {
    q += ' AND (name LIKE ? OR company_name LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  q += ' ORDER BY name';
  res.json(db.prepare(q).all(...params));
});

// GET single supplier with recent ledger
router.get('/:id', auth(), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const ledger = db.prepare(`
    SELECT * FROM supplier_transactions 
    WHERE supplier_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.params.id);

  res.json({ ...supplier, ledger });
});

// CREATE supplier
router.post('/', auth(['admin', 'manager']), (req, res) => {
  const { name, company_name, phone, credit_limit = 0, payment_terms_days = 7, opening_balance = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Supplier name required' });

  const id = crypto.randomUUID();
  const balance = parseFloat(opening_balance) || 0;

  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO suppliers (id, name, company_name, phone, credit_limit, payment_terms_days, balance_type, current_balance, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 'PAYABLE', ?, 1)
    `).run(id, name, company_name || null, phone || null, credit_limit, payment_terms_days, balance);

    if (balance > 0) {
      db.prepare(`
        INSERT INTO supplier_transactions (id, supplier_id, invoice_no, type, debit_amount, credit_amount, notes)
        VALUES (?, ?, 'OPENING-BAL', 'PURCHASE_BILL', 0, ?, 'Opening balance payable')
      `).run(crypto.randomUUID(), id, balance);
    }
  });

  create();
  res.status(201).json({ id, message: 'Supplier created' });
});

// UPDATE supplier
router.put('/:id', auth(['admin', 'manager']), (req, res) => {
  const { name, company_name, phone, credit_limit, payment_terms_days, is_active } = req.body;
  db.prepare(`
    UPDATE suppliers SET
      name = COALESCE(?, name),
      company_name = COALESCE(?, company_name),
      phone = COALESCE(?, phone),
      credit_limit = COALESCE(?, credit_limit),
      payment_terms_days = COALESCE(?, payment_terms_days),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name, company_name, phone, credit_limit, payment_terms_days, is_active, req.params.id);

  res.json({ success: true });
});

// GET full supplier ledger
router.get('/:id/ledger', auth(), (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const transactions = db.prepare(`
    SELECT * FROM supplier_transactions 
    WHERE supplier_id = ? 
    ORDER BY created_at ASC
  `).all(req.params.id);

  // Compute running balance chronologically
  let running = 0;
  const enriched = transactions.map(t => {
    // Formula: previous + credit - debit - kasar
    running = running + (t.credit_amount || 0) - (t.debit_amount || 0) - (t.settlement_discount || 0);
    return { ...t, running_balance: running };
  });

  res.json({ supplier, transactions: enriched.reverse() });
});

// RECORD a procurement / payment transaction (with Kasar and Cash Till deduction support)
router.post('/:id/transactions', auth(['admin', 'manager']), (req, res) => {
  const {
    invoice_no,
    type, // 'PURCHASE_BILL' | 'PAYMENT' | 'PURCHASE_RETURN' | 'SETTLEMENT_DISCOUNT'
    debit_amount = 0,
    credit_amount = 0,
    settlement_discount = 0, // Kasar / کسر
    bill_type = 'VERIFIED_BILL', // 'KATCHI_PARCHI' vs 'VERIFIED_BILL'
    deduct_from_drawer = 0,
    items_json,
    notes
  } = req.body;

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

  const debit = parseFloat(debit_amount) || 0;
  const credit = parseFloat(credit_amount) || 0;
  const kasar = parseFloat(settlement_discount) || 0;
  const txnId = crypto.randomUUID();

  const recordTxn = db.transaction(() => {
    // 1. Insert transaction
    db.prepare(`
      INSERT INTO supplier_transactions (
        id, supplier_id, invoice_no, type, debit_amount, credit_amount, settlement_discount,
        bill_type, deduct_from_drawer, items_json, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txnId,
      req.params.id,
      invoice_no || null,
      type,
      debit,
      credit,
      kasar,
      bill_type,
      deduct_from_drawer ? 1 : 0,
      items_json ? JSON.stringify(items_json) : null,
      notes || null
    );

    // 2. Update supplier balance: new = old + credit - debit - kasar
    const delta = credit - debit - kasar;
    db.prepare('UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?')
      .run(delta, req.params.id);

    // 3. If paid from cash till drawer, deduct from active shift
    if (deduct_from_drawer && debit > 0) {
      const activeShift = db.prepare("SELECT id FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1").get();
      if (activeShift) {
        db.prepare(`
          UPDATE shifts 
          SET total_petty_expenses = total_petty_expenses + ?,
              variance_note = COALESCE(variance_note || '\n', '') || ?
          WHERE id = ?
        `).run(debit, `[Supplier Payout to ${supplier.name}]: Rs. ${debit} (Bill: ${invoice_no || 'N/A'})`, activeShift.id);
      }
    }
  });

  recordTxn();

  const updatedSupplier = db.prepare('SELECT current_balance FROM suppliers WHERE id = ?').get(req.params.id);
  res.status(201).json({
    id: txnId,
    message: 'Transaction recorded successfully',
    new_balance: updatedSupplier.current_balance
  });
});

module.exports = router;
