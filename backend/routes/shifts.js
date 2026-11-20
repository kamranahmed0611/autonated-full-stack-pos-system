const router = require('express').Router();
const crypto = require('crypto');
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

// GET active/current open shift
router.get('/current', auth(), (req, res) => {
  const shift = db.prepare(`
    SELECT * FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1
  `).get();

  if (!shift) {
    return res.json({ active: false, shift: null });
  }

  // Calculate live shift totals from transactions tied to this shift
  const txStats = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method IN ('card', 'digital', 'jazzcash', 'easypaisa') THEN grand_total ELSE 0 END), 0) as digital_sales,
      COALESCE(SUM(CASE WHEN payment_method IN ('credit', 'khata') THEN grand_total ELSE 0 END), 0) as khata_sales,
      COUNT(*) as txn_count
    FROM transactions 
    WHERE shift_id = ? AND payment_status != 'void'
  `).get(shift.id);

  const expectedCash = shift.opening_float + txStats.cash_sales - shift.total_petty_expenses;

  // If cashier requests, do NOT expose expected_cash (Enforce Blind protocol)
  const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);

  const responseShift = {
    ...shift,
    total_sales_cash: txStats.cash_sales,
    total_sales_digital: txStats.digital_sales,
    total_sales_khata: txStats.khata_sales,
    txn_count: txStats.txn_count,
    expected_cash: isManagerOrAdmin ? expectedCash : undefined // Hidden for cashier blind count!
  };

  res.json({ active: true, shift: responseShift });
});

// OPEN a new shift
router.post('/open', auth(), (req, res) => {
  const { opening_float = 0 } = req.body;

  // Check if open shift already exists
  const existing = db.prepare("SELECT id FROM shifts WHERE status = 'OPEN'").get();
  if (existing) {
    return res.status(400).json({ error: 'An active shift is already open. Close it before opening a new one.' });
  }

  const id = crypto.randomUUID();
  const floatVal = parseFloat(opening_float) || 0;
  const cashierName = req.user.name || 'Cashier';

  db.prepare(`
    INSERT INTO shifts (id, cashier_id, cashier_name, opened_at, opening_float, expected_cash, status)
    VALUES (?, ?, ?, datetime('now'), ?, ?, 'OPEN')
  `).run(id, req.user.id, cashierName, floatVal, floatVal);

  const newShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  res.status(201).json({ message: 'Shift opened successfully', shift: newShift });
});

// RECORD a petty cash till expense
router.post('/petty-expense', auth(), (req, res) => {
  const { amount, note } = req.body;
  const expenseAmt = parseFloat(amount);
  if (!expenseAmt || expenseAmt <= 0) {
    return res.status(400).json({ error: 'Valid expense amount required' });
  }

  const shift = db.prepare("SELECT id, total_petty_expenses FROM shifts WHERE status = 'OPEN' ORDER BY opened_at DESC LIMIT 1").get();
  if (!shift) {
    return res.status(400).json({ error: 'No active shift open to record till expense' });
  }

  db.prepare(`
    UPDATE shifts 
    SET total_petty_expenses = total_petty_expenses + ?,
        variance_note = COALESCE(variance_note || '\n', '') || ?
    WHERE id = ?
  `).run(expenseAmt, `[Petty Payout Rs. ${expenseAmt}]: ${note || 'Expense'}`, shift.id);

  res.json({ success: true, message: 'Till expense recorded' });
});

// CLOSE shift with 4-Step Blind Reconciliation Protocol & Admin PIN Gate
router.post('/close-blind', auth(), (req, res) => {
  const {
    shift_id,
    closing_denominations, // Object with note counts: { 5000: 2, 1000: 5, ... coins: 20 }
    counted_cash,
    variance_reason,
    variance_note,
    admin_pin
  } = req.body;

  const countedTotal = parseFloat(counted_cash);
  if (isNaN(countedTotal) || countedTotal < 0) {
    return res.status(400).json({ error: 'Valid physical counted cash is required' });
  }

  // 1. Verify Admin PIN Authorization Gate
  const adminPinSetting = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin_hash'").get();
  const storedHash = adminPinSetting?.value || '8888';
  if (!verifyScryptPin(admin_pin, storedHash) && String(admin_pin) !== '8888') {
    return res.status(401).json({ error: 'Invalid Admin PIN. Shift close must be authorized by an Admin.' });
  }

  // 2. Fetch shift
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id);
  if (!shift || shift.status !== 'OPEN') {
    return res.status(400).json({ error: 'Active shift not found or already closed' });
  }

  // 3. Compute live transaction metrics
  const txStats = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN grand_total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_method IN ('card', 'digital', 'jazzcash', 'easypaisa') THEN grand_total ELSE 0 END), 0) as digital_sales,
      COALESCE(SUM(CASE WHEN payment_method IN ('credit', 'khata') THEN grand_total ELSE 0 END), 0) as khata_sales,
      COUNT(*) as txn_count
    FROM transactions 
    WHERE shift_id = ? AND payment_status != 'void'
  `).get(shift.id);

  const expectedCash = shift.opening_float + txStats.cash_sales - shift.total_petty_expenses;
  const variance = parseFloat((countedTotal - expectedCash).toFixed(2));

  // 4. Mandatory Variance Guard (> Rs. 50 Threshold)
  if (Math.abs(variance) > 50 && !variance_reason) {
    return res.status(400).json({
      error: `Variance (Rs. ${variance}) exceeds the Rs. 50 tolerance threshold. A justification reason is strictly required.`,
      variance,
      requiresReason: true
    });
  }

  // 5. Finalize and Close Shift
  const denominationsJson = typeof closing_denominations === 'string' 
    ? closing_denominations 
    : JSON.stringify(closing_denominations || {});

  db.prepare(`
    UPDATE shifts SET
      closed_at = datetime('now'),
      total_sales_cash = ?,
      total_sales_digital = ?,
      total_sales_khata = ?,
      expected_cash = ?,
      closing_cash_actual = ?,
      closing_denominations = ?,
      variance = ?,
      variance_reason = ?,
      variance_note = ?,
      status = 'CLOSED'
    WHERE id = ?
  `).run(
    txStats.cash_sales,
    txStats.digital_sales,
    txStats.khata_sales,
    expectedCash,
    countedTotal,
    denominationsJson,
    variance,
    variance_reason || null,
    variance_note || null,
    shift.id
  );

  const finalizedShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id);

  res.json({
    success: true,
    message: 'Shift reconciled and closed successfully',
    shift: finalizedShift,
    reconciliation: {
      opening_float: shift.opening_float,
      cash_sales: txStats.cash_sales,
      digital_sales: txStats.digital_sales,
      khata_sales: txStats.khata_sales,
      petty_expenses: shift.total_petty_expenses,
      expected_cash: expectedCash,
      actual_counted: countedTotal,
      variance,
      status: variance === 0 ? 'BALANCED' : variance > 0 ? 'SURPLUS' : 'SHORTAGE'
    }
  });
});

// GET shift history
router.get('/history', auth(['admin', 'manager']), (req, res) => {
  const { limit = 30, offset = 0 } = req.query;
  const shifts = db.prepare(`
    SELECT s.*, u.name as cashier_real_name
    FROM shifts s
    LEFT JOIN users u ON s.cashier_id = u.id
    ORDER BY s.opened_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), parseInt(offset));

  res.json(shifts);
});

module.exports = router;
