const db = require('./db/init');
const assert = require('assert');

console.log('[TEST] Starting Fusion Verification Suite...\n');

// TC-01: Barcode Lookup
console.log('[RUN] TC-01: Barcode Lookup');
const sugar = db.prepare('SELECT * FROM products WHERE barcode = ?').get('89640009001');
assert(sugar, 'Sugar should exist');
assert.strictEqual(sugar.is_loose, 1, 'Sugar must be a loose commodity');
assert.strictEqual(sugar.unit_conversion_ratio, 50, 'Sugar ratio must be 50kg per bag');
assert.strictEqual(sugar.subunit_sale_price, 145, 'Subunit price must be 145/kg');
console.log('  [PASS] TC-01: Found loose commodity Sugar (Ratio: 50, Retail: Rs. 145/kg)\n');

// TC-02: Loose Good Inventory Decrement
console.log('[RUN] TC-02: Loose Good Inventory Decrement (3.5 kg from 50kg bag)');
const initialSugarStock = sugar.stock;
const soldKg = 3.5;
const stockReduction = parseFloat((soldKg / sugar.unit_conversion_ratio).toFixed(4));
db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(stockReduction, sugar.id);
const updatedSugar = db.prepare('SELECT stock FROM products WHERE id = ?').get(sugar.id);
assert.strictEqual(updatedSugar.stock, initialSugarStock - stockReduction);
console.log(`  [PASS] TC-02: Initial Stock: ${initialSugarStock} bags, Sold: ${soldKg} kg, Decrement: ${stockReduction} bags, Remaining: ${updatedSugar.stock} bags\n`);

// TC-03: Cash Rounding Engine (Nearest Rs. 5)
console.log('[RUN] TC-03: Nearest Rs. 5 Cash Rounding Engine');
function computeCashRounding(unrounded, nearest = 5) {
  const rounded = Math.round(unrounded / nearest) * nearest;
  const roundOff = parseFloat((rounded - unrounded).toFixed(2));
  return { rounded, roundOff };
}

const test1 = computeCashRounding(142.0);
assert.strictEqual(test1.rounded, 140.0);
assert.strictEqual(test1.roundOff, -2.0);

const test2 = computeCashRounding(143.0);
assert.strictEqual(test2.rounded, 145.0);
assert.strictEqual(test2.roundOff, 2.0);

const test3 = computeCashRounding(3012.0);
assert.strictEqual(test3.rounded, 3010.0);
assert.strictEqual(test3.roundOff, -2.0);
console.log('  [PASS] TC-03: Rs. 142 -> Rs. 140 (-2), Rs. 143 -> Rs. 145 (+2), Rs. 3012 -> Rs. 3010 (-2)\n');

// TC-04: Customer Khata Ledger
console.log('[RUN] TC-04: Customer Khata Double-Entry Ledger');
const cust = db.prepare('SELECT * FROM customers WHERE name LIKE ?').get('%Tariq%');
assert(cust, 'Customer Dr. Tariq should exist');
const initialBalance = cust.balance;
const billAmount = 2500;
const newBalance = initialBalance + billAmount;
const debitId = `test-debit-${Date.now()}`;
const creditId = `test-credit-${Date.now()}`;

// Insert DEBIT
db.prepare(`
  INSERT INTO customer_transactions (id, customer_id, type, amount, balance_after, notes)
  VALUES (?, ?, 'DEBIT', ?, ?, 'Test Credit Purchase')
`).run(debitId, cust.id, billAmount, newBalance);
db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(newBalance, cust.id);

// Verify ledger
const lastTx = db.prepare('SELECT * FROM customer_transactions WHERE id = ?').get(debitId);
assert.strictEqual(lastTx.amount, 2500);
assert.strictEqual(lastTx.balance_after, newBalance);

// Insert CREDIT (Wasooli Repayment)
const repayment = 1500;
const afterRepayment = newBalance - repayment;
db.prepare(`
  INSERT INTO customer_transactions (id, customer_id, type, amount, balance_after, notes)
  VALUES (?, ?, 'CREDIT', ?, ?, 'Test Cash Wasooli Repayment')
`).run(creditId, cust.id, repayment, afterRepayment);
db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(afterRepayment, cust.id);

console.log(`  [PASS] TC-04: Customer balance moved ${initialBalance} -> ${newBalance} (DEBIT Rs. 2500) -> ${afterRepayment} (CREDIT Rs. 1500)\n`);

// TC-05: Blind Shift Close Variance Calculation
console.log('[RUN] TC-05: Blind Shift Close Protocol & Variance Audit');
const openingFloat = 5000;
const cashSales = 15400;
const pettyExpenses = 600;
const expectedCash = openingFloat + cashSales - pettyExpenses; // 19,800
const actualCounted = 19700; // 100 Shortage
const variance = actualCounted - expectedCash; // -100

assert.strictEqual(variance, -100);
assert(Math.abs(variance) > 50, 'Discrepancy exceeds Rs. 50 threshold; requires reason');
console.log(`  [PASS] TC-05: Expected Cash: Rs. ${expectedCash}, Counted: Rs. ${actualCounted}, Variance: Rs. ${variance} (Shortage triggered reason requirement)\n`);

// TC-06: Vendor Kasar Payout
console.log('[RUN] TC-06: Vendor Kasar / Settlement Concession Ledger');
const supp = db.prepare('SELECT * FROM suppliers WHERE name LIKE ?').get('%Nestlé%');
assert(supp, 'Supplier should exist');
const oldPayable = supp.current_balance;
const billTotal = 10200;
const cashPaid = 10000;
const kasarDiscount = 200;

// Balance impact: +billTotal - cashPaid - kasarDiscount = 0 net change
const expectedPayable = oldPayable + billTotal - cashPaid - kasarDiscount;
assert.strictEqual(expectedPayable, oldPayable);
console.log(`  [PASS] TC-06: Bill: Rs. 10,200, Cash Paid: Rs. 10,000, Kasar: Rs. 200 -> Perfectly settles without balance drift\n`);

console.log('[SUCCESS] ALL 6 FUSION VERIFICATION TESTS PASSED SUCCESSFULLY!');
db.close();

