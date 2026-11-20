const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'supermart.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema definitions
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'cashier',
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#185FA5',
    icon TEXT DEFAULT '',
    is_taxable INTEGER NOT NULL DEFAULT 0,
    tax_rate_percent REAL NOT NULL DEFAULT 17.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT,
    barcode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    price REAL NOT NULL DEFAULT 0,
    cost REAL DEFAULT 0,
    tax_rate REAL DEFAULT 17,
    stock REAL DEFAULT 0,
    min_stock REAL DEFAULT 5,
    unit TEXT DEFAULT 'pcs',
    icon TEXT DEFAULT '',
    
    -- Fusion: Loose Commodity & Scale Support
    is_weighable INTEGER NOT NULL DEFAULT 0,
    is_loose INTEGER NOT NULL DEFAULT 0,
    base_unit TEXT NOT NULL DEFAULT '',
    sale_unit TEXT NOT NULL DEFAULT '',
    unit_conversion_ratio REAL NOT NULL DEFAULT 1.0,
    subunit_sale_price REAL NOT NULL DEFAULT 0.0,
    
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    credit_limit REAL DEFAULT 10000.0,
    balance REAL DEFAULT 0,
    loyalty_pts INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Fusion: Customer Bahi-Khata Double-Entry Ledger
  CREATE TABLE IF NOT EXISTS customer_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id TEXT,
    type TEXT NOT NULL, -- 'DEBIT' (Bill Credit) | 'CREDIT' (Cash Repayment / Wasooli)
    amount REAL NOT NULL,
    balance_after REAL NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Fusion: Suppliers & Wholesale Procurement Ledger
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    credit_limit REAL DEFAULT 0.0,
    payment_terms_days INTEGER DEFAULT 7,
    balance_type TEXT DEFAULT 'PAYABLE',
    current_balance REAL NOT NULL DEFAULT 0.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS supplier_transactions (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    invoice_no TEXT,
    type TEXT NOT NULL, -- 'PURCHASE_BILL' | 'PAYMENT' | 'PURCHASE_RETURN' | 'SETTLEMENT_DISCOUNT'
    debit_amount REAL NOT NULL DEFAULT 0.0,
    credit_amount REAL NOT NULL DEFAULT 0.0,
    settlement_discount REAL DEFAULT 0.0, -- Kasar / کسر
    bill_type TEXT DEFAULT 'VERIFIED_BILL', -- 'KATCHI_PARCHI' vs 'VERIFIED_BILL'
    deduct_from_drawer INTEGER DEFAULT 0,
    items_json TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Fusion: Cashier Register Shifts & Blind Reconciliation
  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    cashier_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    cashier_name TEXT NOT NULL DEFAULT 'Cashier #01',
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    opening_float REAL NOT NULL DEFAULT 0.0,
    total_sales_cash REAL NOT NULL DEFAULT 0.0,
    total_sales_digital REAL NOT NULL DEFAULT 0.0,
    total_sales_khata REAL NOT NULL DEFAULT 0.0,
    total_petty_expenses REAL NOT NULL DEFAULT 0.0,
    expected_cash REAL NOT NULL DEFAULT 0.0,
    closing_cash_actual REAL,
    closing_denominations TEXT, -- JSON string of note counts
    variance REAL DEFAULT 0.0,
    variance_reason TEXT,
    variance_note TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN' -- 'OPEN' | 'CLOSED'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    invoice_no TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    cashier_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    shift_id TEXT REFERENCES shifts(id) ON DELETE SET NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount_amt REAL DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    discount_val REAL DEFAULT 0,
    tax_amt REAL DEFAULT 0,
    grand_total REAL NOT NULL DEFAULT 0,
    round_off_amount REAL NOT NULL DEFAULT 0.0, -- Nearest Rs. 5 Rounding
    paid_amount REAL NOT NULL DEFAULT 0.0,
    change_due REAL NOT NULL DEFAULT 0.0,
    payment_method TEXT DEFAULT 'cash',
    payment_status TEXT DEFAULT 'completed',
    is_retroactive INTEGER NOT NULL DEFAULT 0,
    inventory_deducted INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    qty REAL NOT NULL,
    unit_type TEXT DEFAULT 'pcs',
    is_loose INTEGER DEFAULT 0,
    subunit_sale_price REAL DEFAULT 0.0,
    tax_rate REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0.0,
    line_total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    qty REAL NOT NULL,
    ref_id TEXT,
    note TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Fusion: Security Lockout Table
  CREATE TABLE IF NOT EXISTS security_lockout (
    id TEXT PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,
    last_attempt_at DATETIME
  );
`);

// Idempotent column migrations for existing databases
function ensureColumn(table, column, definition) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = info.some(col => col.name.toLowerCase() === column.toLowerCase());
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

// Ensure columns on categories
ensureColumn('categories', 'is_taxable', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('categories', 'tax_rate_percent', 'REAL NOT NULL DEFAULT 17.0');

// Ensure columns on customers
ensureColumn('customers', 'is_active', 'INTEGER NOT NULL DEFAULT 1');

// Ensure columns on products
ensureColumn('products', 'sku', 'TEXT');
ensureColumn('products', 'is_weighable', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('products', 'is_loose', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('products', 'base_unit', "TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'sale_unit', "TEXT NOT NULL DEFAULT ''");
ensureColumn('products', 'unit_conversion_ratio', 'REAL NOT NULL DEFAULT 1.0');
ensureColumn('products', 'subunit_sale_price', 'REAL NOT NULL DEFAULT 0.0');

// Ensure columns on transactions
ensureColumn('transactions', 'shift_id', 'TEXT REFERENCES shifts(id) ON DELETE SET NULL');
ensureColumn('transactions', 'round_off_amount', 'REAL NOT NULL DEFAULT 0.0');
ensureColumn('transactions', 'paid_amount', 'REAL NOT NULL DEFAULT 0.0');
ensureColumn('transactions', 'change_due', 'REAL NOT NULL DEFAULT 0.0');
ensureColumn('transactions', 'is_retroactive', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('transactions', 'inventory_deducted', 'INTEGER NOT NULL DEFAULT 1');

// Ensure columns on transaction_items
ensureColumn('transaction_items', 'unit_type', "TEXT DEFAULT 'pcs'");
ensureColumn('transaction_items', 'is_loose', 'INTEGER DEFAULT 0');
ensureColumn('transaction_items', 'subunit_sale_price', 'REAL DEFAULT 0.0');
ensureColumn('transaction_items', 'discount_amount', 'REAL DEFAULT 0.0');

// Ensure columns on shifts
ensureColumn('shifts', 'cashier_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
ensureColumn('shifts', 'total_sales_khata', 'REAL NOT NULL DEFAULT 0.0');
ensureColumn('shifts', 'closing_denominations', 'TEXT');
ensureColumn('shifts', 'variance', 'REAL DEFAULT 0.0');
ensureColumn('shifts', 'variance_reason', 'TEXT');
ensureColumn('shifts', 'variance_note', 'TEXT');

// Ensure columns on suppliers
ensureColumn('supplier_transactions', 'settlement_discount', 'REAL DEFAULT 0.0');
ensureColumn('supplier_transactions', 'bill_type', "TEXT DEFAULT 'VERIFIED_BILL'");
ensureColumn('supplier_transactions', 'deduct_from_drawer', 'INTEGER DEFAULT 0');

// Insert fallback ad-hoc product entity to support emergency retroactive billing
db.prepare(`
  INSERT OR IGNORE INTO products (
    id, sku, barcode, name, price, cost, tax_rate, stock, min_stock, unit, icon, active
  ) VALUES (
    'ad-hoc-item', 'AD-HOC', '000000000000', 'Custom Ad-Hoc Item', 0, 0, 0, 999999, 0, 'pcs', '', 1
  )
`).run();

// Indices for performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
  CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id);
  CREATE INDEX IF NOT EXISTS idx_cust_trans_customer ON customer_transactions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_supp_trans_supplier ON supplier_transactions(supplier_id);
`);

module.exports = db;
