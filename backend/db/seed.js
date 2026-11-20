const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./init');

function hashPinWithScrypt(pin, customSalt) {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pin, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

console.log('[SEED] Seeding database with MR Super Store Fusion data...');

db.transaction(() => {
  // Clear tables for fresh seed
  db.prepare('DELETE FROM transaction_items').run();
  db.prepare('DELETE FROM transactions').run();
  db.prepare('DELETE FROM stock_movements').run();
  db.prepare('DELETE FROM products WHERE id != ?').run('ad-hoc-item');
  db.prepare('DELETE FROM categories').run();
  db.prepare('DELETE FROM customer_transactions').run();
  db.prepare('DELETE FROM customers').run();
  db.prepare('DELETE FROM supplier_transactions').run();
  db.prepare('DELETE FROM suppliers').run();
  db.prepare('DELETE FROM shifts').run();
  db.prepare('DELETE FROM users').run();
  db.prepare('DELETE FROM settings').run();
  db.prepare('DELETE FROM security_lockout').run();

  // 1. Settings
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const defaultSettings = [
    ['store_name', 'MR Super Store'],
    ['store_address', 'Allah Wali Market, Street 33, F-8/1, Islamabad'],
    ['store_phone', '+92 306 5157506'],
    ['store_email', 'info@mrsuperstore.pk'],
    ['whatsapp_number', '+92 306 5157506'],
    ['currency', 'Rs.'],
    ['tax_label', 'GST (18%)'],
    ['default_tax_rate', '18.0'],
    ['tax_enabled', '0'],
    ['cash_rounding_nearest', '5'],
    ['admin_pin_hash', hashPinWithScrypt('8888')],
    ['cashier_pin_hash', hashPinWithScrypt('1234')],
    ['receipt_header', 'MR SUPER STORE - F-8/1, ISLAMABAD'],
    ['receipt_footer', 'Thank you for visiting MR Super Store!\nتبدیلی کے لیے بل ساتھ لانا لازمی ہے۔'],
    ['low_stock_threshold', '5'],
  ];
  for (const [key, val] of defaultSettings) {
    insertSetting.run(key, val);
  }

  // 2. Users
  const insertUser = db.prepare('INSERT INTO users (id, name, email, password, role, active) VALUES (?, ?, ?, ?, ?, ?)');
  const adminId = uuidv4();
  const managerId = uuidv4();
  const cashierId = uuidv4();

  insertUser.run(adminId, 'Super Admin', 'admin@supermart.pk', bcrypt.hashSync('admin123', 10), 'admin', 1);
  insertUser.run(managerId, 'Inventory Manager', 'inv@supermart.pk', bcrypt.hashSync('inv123', 10), 'manager', 1);
  insertUser.run(cashierId, 'Ali Cashier', 'ali@supermart.pk', bcrypt.hashSync('cashier123', 10), 'cashier', 1);

  // 3. Categories
  const insertCategory = db.prepare('INSERT INTO categories (id, name, color, icon, is_taxable, tax_rate_percent) VALUES (?, ?, ?, ?, ?, ?)');
  const catGroceries = uuidv4();
  const catBeverages = uuidv4();
  const catSnacks = uuidv4();
  const catDairy = uuidv4();
  const catPersonal = uuidv4();
  const catHousehold = uuidv4();
  const catProduce = uuidv4();

  insertCategory.run(catGroceries, 'Groceries & Staples', '#185FA5', '', 0, 0);
  insertCategory.run(catBeverages, 'Beverages & Drinks', '#0F766E', '', 1, 18);
  insertCategory.run(catSnacks, 'Snacks & Sweets', '#B45309', '', 1, 18);
  insertCategory.run(catDairy, 'Dairy & Bakery', '#7C3AED', '', 0, 0);
  insertCategory.run(catPersonal, 'Personal Care', '#BE185D', '', 1, 18);
  insertCategory.run(catHousehold, 'Household & Cleaning', '#4338CA', '', 1, 18);
  insertCategory.run(catProduce, 'Fresh Produce & Fruits', '#15803D', '', 0, 0);

  // 4. Products (including Loose Commodities and Weighable items)
  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, sku, barcode, name, category_id, price, cost, tax_rate, stock, min_stock,
      unit, icon, is_weighable, is_loose, base_unit, sale_unit, unit_conversion_ratio, subunit_sale_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (id, product_id, type, qty, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sampleProducts = [
    // Standard Packaged Goods
    { sku: 'RICE-5KG', barcode: '89640001001', name: 'Super Kernel Basmati Rice 5kg', category_id: catGroceries, price: 1850, cost: 1550, tax_rate: 0, stock: 45, min_stock: 10, unit: 'bag', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'OIL-1L', barcode: '89640001002', name: 'Premium Cooking Oil 1L Pouch', category_id: catGroceries, price: 520, cost: 460, tax_rate: 0, stock: 80, min_stock: 15, unit: 'pouch', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'TEA-400G', barcode: '89640001003', name: 'Danedar Black Tea 400g Box', category_id: catGroceries, price: 790, cost: 680, tax_rate: 0, stock: 35, min_stock: 8, unit: 'box', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'ATTA-10KG', barcode: '89640001004', name: 'Chakki Atta Flour 10kg Bag', category_id: catGroceries, price: 1350, cost: 1200, tax_rate: 0, stock: 20, min_stock: 5, unit: 'bag', icon: '', is_weighable: 0, is_loose: 0 },

    // Loose Commodity Dual-Unit Products (Wholesale Bag vs Retail Kg)
    {
      sku: 'LOOSE-SUGAR-50KG',
      barcode: '89640009001',
      name: 'Refined White Sugar (Cheeni / چینی)',
      category_id: catGroceries,
      price: 7000, // Wholesale 50kg bag price
      cost: 6500,
      tax_rate: 0,
      stock: 25, // 25 bags in warehouse
      min_stock: 5,
      unit: 'Bag / بوری',
      icon: '',
      is_weighable: 0,
      is_loose: 1,
      base_unit: 'Bag / بوری',
      sale_unit: 'kg / کلو',
      unit_conversion_ratio: 50.0,
      subunit_sale_price: 145.0 // Retail Rs. 145 per kg
    },
    {
      sku: 'LOOSE-RICE-25KG',
      barcode: '89640009002',
      name: 'Saila Basmati Rice Loose (سیلا چاول)',
      category_id: catGroceries,
      price: 6500, // Wholesale 25kg bag price
      cost: 5800,
      tax_rate: 0,
      stock: 15, // 15 bags
      min_stock: 3,
      unit: 'Bag / بوری',
      icon: '',
      is_weighable: 0,
      is_loose: 1,
      base_unit: 'Bag / بوری',
      sale_unit: 'kg / کلو',
      unit_conversion_ratio: 25.0,
      subunit_sale_price: 270.0 // Retail Rs. 270 per kg
    },
    {
      sku: 'LOOSE-DAAL-CHANA',
      barcode: '89640009003',
      name: 'Daal Chana Special (دال چنا)',
      category_id: catGroceries,
      price: 8500, // Wholesale 40kg sack
      cost: 7600,
      tax_rate: 0,
      stock: 12,
      min_stock: 2,
      unit: 'Sack / بوری',
      icon: '',
      is_weighable: 0,
      is_loose: 1,
      base_unit: 'Sack / بوری',
      sale_unit: 'kg / کلو',
      unit_conversion_ratio: 40.0,
      subunit_sale_price: 225.0 // Retail Rs. 225 per kg
    },

    // Weighable Scale Produce (precision to 3 decimal places)
    {
      sku: 'SCALE-TOMATO',
      barcode: '200000100000',
      name: 'Fresh Farm Tomatoes (ٹماٹر)',
      category_id: catProduce,
      price: 120, // Rs. 120 / kg
      cost: 85,
      tax_rate: 0,
      stock: 85.5,
      min_stock: 15,
      unit: 'kg',
      icon: '',
      is_weighable: 1,
      is_loose: 0
    },
    {
      sku: 'SCALE-ONION',
      barcode: '200000200000',
      name: 'Red Onions (پیاز)',
      category_id: catProduce,
      price: 90, // Rs. 90 / kg
      cost: 65,
      tax_rate: 0,
      stock: 120.0,
      min_stock: 20,
      unit: 'kg',
      icon: '',
      is_weighable: 1,
      is_loose: 0
    },
    {
      sku: 'SCALE-POTATO',
      barcode: '200000300000',
      name: 'Fresh Potatoes (آلو)',
      category_id: catProduce,
      price: 75, // Rs. 75 / kg
      cost: 50,
      tax_rate: 0,
      stock: 150.0,
      min_stock: 25,
      unit: 'kg',
      icon: '',
      is_weighable: 1,
      is_loose: 0
    },

    // Beverages & Snacks
    { sku: 'WATER-1.5L', barcode: '89640002001', name: 'Mineral Water Bottle 1.5L', category_id: catBeverages, price: 110, cost: 75, tax_rate: 18, stock: 150, min_stock: 25, unit: 'bottle', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'COLA-CAN', barcode: '89640002002', name: 'Cola Soft Drink Can 250ml', category_id: catBeverages, price: 90, cost: 68, tax_rate: 18, stock: 95, min_stock: 20, unit: 'can', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'CHIPS-50G', barcode: '89640003001', name: 'Crispy Potato Chips Masala 50g', category_id: catSnacks, price: 100, cost: 75, tax_rate: 18, stock: 110, min_stock: 20, unit: 'pack', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'MILK-1L', barcode: '89640004001', name: 'Pasteurized Full Cream Milk 1L', category_id: catDairy, price: 270, cost: 235, tax_rate: 0, stock: 40, min_stock: 15, unit: 'pack', icon: '', is_weighable: 0, is_loose: 0 },
    { sku: 'SHAMPOO-375ML', barcode: '89640005003', name: 'Anti-Dandruff Shampoo 375ml', category_id: catPersonal, price: 580, cost: 460, tax_rate: 18, stock: 4, min_stock: 10, unit: 'bottle', icon: '', is_weighable: 0, is_loose: 0 },
  ];

  for (const prod of sampleProducts) {
    const id = uuidv4();
    insertProduct.run(
      id,
      prod.sku,
      prod.barcode,
      prod.name,
      prod.category_id,
      prod.price,
      prod.cost,
      prod.tax_rate,
      prod.stock,
      prod.min_stock,
      prod.unit,
      prod.icon,
      prod.is_weighable || 0,
      prod.is_loose || 0,
      prod.base_unit || '',
      prod.sale_unit || '',
      prod.unit_conversion_ratio || 1.0,
      prod.subunit_sale_price || 0.0
    );
    insertMovement.run(uuidv4(), id, 'opening', prod.stock, 'Initial inventory setup', adminId);
  }

  // 5. Customers & Khata Ledger
  const insertCustomer = db.prepare(`
    INSERT INTO customers (id, name, phone, email, address, credit_limit, balance, loyalty_pts, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertCustTxn = db.prepare(`
    INSERT INTO customer_transactions (id, customer_id, invoice_id, type, amount, balance_after, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const cust1 = uuidv4();
  const cust2 = uuidv4();
  const cust3 = uuidv4();

  insertCustomer.run(cust1, 'Dr. Tariq Mahmood', '+92 333 5224466', 'tariq.doc@gmail.com', 'House 14, Street 25, F-8/1, Islamabad', 25000, 4270, 320);
  insertCustomer.run(cust2, 'Haji Abdul Rehman', '+92 300 9876543', 'rehman@gmail.com', 'Sector G-9/2, Islamabad', 15000, 8500, 450);
  insertCustomer.run(cust3, 'Fatima Zahra', '+92 321 4455667', 'fatima.z@yahoo.com', 'Askari 11, Rawalpindi', 10000, 0, 110);

  // Seed Khata history for Dr. Tariq Mahmood (matching Doc 04 sample statement)
  insertCustTxn.run(uuidv4(), cust1, null, 'DEBIT', 3450, 3450, 'Bill #MRS-1014-002 (Monthly groceries on account)');
  insertCustTxn.run(uuidv4(), cust1, null, 'DEBIT', 1820, 5270, 'Bill #MRS-1014-004 (Oil & dairy items)');
  insertCustTxn.run(uuidv4(), cust1, null, 'CREDIT', 1000, 4270, 'Cash Payment (Wasooli / وصولی)');

  // 6. Suppliers & Wholesale Procurement Ledger
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, name, company_name, phone, credit_limit, payment_terms_days, balance_type, current_balance, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 'PAYABLE', ?, 1)
  `);
  const insertSuppTxn = db.prepare(`
    INSERT INTO supplier_transactions (
      id, supplier_id, invoice_no, type, debit_amount, credit_amount, settlement_discount, bill_type, deduct_from_drawer, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const suppUnilever = uuidv4();
  const suppNestle = uuidv4();
  const suppDalda = uuidv4();

  insertSupplier.run(suppUnilever, 'Unilever Distributors (Islamabad)', 'Unilever Pakistan', '+92 51 2288991', 100000, 14, 45000);
  insertSupplier.run(suppNestle, 'Nestlé Retail Distribution', 'Nestlé Pakistan', '+92 51 4433221', 75000, 7, 28500);
  insertSupplier.run(suppDalda, 'Dalda Foods Ghee & Oil Agency', 'Dalda Foods Ltd', '+92 51 5566778', 150000, 10, 62000);

  // Seed sample supplier ledger transactions (including Kasar and Drawer deduction)
  insertSuppTxn.run(uuidv4(), suppUnilever, 'UNI-8841', 'PURCHASE_BILL', 0, 65000, 0, 'VERIFIED_BILL', 0, 'Tea, Shampoos & Soap restock delivery');
  insertSuppTxn.run(uuidv4(), suppUnilever, 'PAY-401', 'PAYMENT', 20000, 0, 0, 'VERIFIED_BILL', 0, 'Cross-cheque #44901 Bank Alfalah');
  
  // Kasar discount example:
  insertSuppTxn.run(uuidv4(), suppNestle, 'NES-902', 'PURCHASE_BILL', 0, 38650, 0, 'KATCHI_PARCHI', 0, 'Milk & Juices informal delivery slip');
  insertSuppTxn.run(uuidv4(), suppNestle, 'PAY-402', 'PAYMENT', 10000, 0, 150, 'VERIFIED_BILL', 1, 'Cash paid to delivery driver directly from till float + Rs. 150 Kasar write-off');

  // 7. Initial Active Shift
  const shiftId = uuidv4();
  db.prepare(`
    INSERT INTO shifts (
      id, cashier_id, cashier_name, opened_at, opening_float, total_sales_cash, total_sales_digital,
      total_sales_khata, total_petty_expenses, expected_cash, status
    ) VALUES (?, ?, ?, datetime('now', '-4 hours'), 5000, 14500, 4200, 3450, 1000, 18500, 'OPEN')
  `).run(shiftId, cashierId, 'Ali Cashier');
})();

db.close();

console.log('[SUCCESS] Fusion database seeded successfully!');
console.log('   Users:');
console.log('     Admin:   admin@supermart.pk / admin123  (Master PIN: 8888)');
console.log('     Manager: inv@supermart.pk / inv123');
console.log('     Cashier: ali@supermart.pk / cashier123  (Staff PIN: 1234)');
