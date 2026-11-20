const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db/init');
const auth = require('../middleware/auth');

// GET all products
router.get('/', auth(), (req, res) => {
  const { category, search, low_stock } = req.query;
  let query = `
    SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
  `;
  const params = [];
  if (category) { query += ' AND p.category_id = ?'; params.push(category); }
  if (search) { query += ' AND (p.name LIKE ? OR p.barcode LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (low_stock === '1') { query += ' AND p.stock <= p.min_stock'; }
  query += ' ORDER BY p.name';
  res.json(db.prepare(query).all(...params));
});

// GET single product
router.get('/:id', auth(), (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// GET by barcode
router.get('/barcode/:barcode', auth(), (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.barcode = ? AND p.active = 1
  `).get(req.params.barcode);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});

// CREATE product
router.post('/', auth(['admin', 'manager']), (req, res) => {
  const {
    barcode, name, category_id, price, cost, tax_rate, stock, min_stock, unit, icon,
    sku, is_weighable = 0, is_loose = 0, base_unit = '', sale_unit = '', unit_conversion_ratio = 1.0, subunit_sale_price = 0
  } = req.body;
  if (!barcode || !name || !category_id || price === undefined) {
    return res.status(400).json({ error: 'barcode, name, category_id, price are required' });
  }

  const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
  if (existing) {
    return res.status(400).json({ error: 'Barcode already exists' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO products (
      id, sku, barcode, name, category_id, price, cost, tax_rate, stock, min_stock, unit, icon,
      is_weighable, is_loose, base_unit, sale_unit, unit_conversion_ratio, subunit_sale_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, sku || null, barcode, name, category_id, price, cost ?? 0, tax_rate ?? 0, stock ?? 0, min_stock ?? 5, unit || 'pcs', icon || '',
    is_weighable ? 1 : 0, is_loose ? 1 : 0, base_unit || '', sale_unit || '', unit_conversion_ratio || 1.0, subunit_sale_price || 0
  );

  if ((stock || 0) > 0) {
    db.prepare('INSERT INTO stock_movements (id,product_id,type,qty,note,created_by) VALUES (?,?,?,?,?,?)')
      .run(uuidv4(), id, 'opening', stock || 0, 'Opening stock', req.user.id);
  }
  res.status(201).json({ id, message: 'Product created' });
});

// UPDATE product
router.put('/:id', auth(['admin', 'manager']), (req, res) => {
  const {
    barcode, name, category_id, price, cost, tax_rate, min_stock, unit, icon, active,
    sku, is_weighable, is_loose, base_unit, sale_unit, unit_conversion_ratio, subunit_sale_price
  } = req.body;
  
  if (barcode) {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode, req.params.id);
    if (existing) {
      return res.status(400).json({ error: 'Barcode already exists on another product' });
    }
  }

  db.prepare(`
    UPDATE products SET
      barcode = COALESCE(?, barcode),
      name = ?,
      category_id = ?,
      price = ?,
      cost = ?,
      tax_rate = ?,
      min_stock = ?,
      unit = ?,
      icon = ?,
      active = ?,
      sku = COALESCE(?, sku),
      is_weighable = COALESCE(?, is_weighable),
      is_loose = COALESCE(?, is_loose),
      base_unit = COALESCE(?, base_unit),
      sale_unit = COALESCE(?, sale_unit),
      unit_conversion_ratio = COALESCE(?, unit_conversion_ratio),
      subunit_sale_price = COALESCE(?, subunit_sale_price),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    barcode, name, category_id, price, cost ?? 0, tax_rate ?? 0, min_stock ?? 5, unit || 'pcs', icon || '', active ?? 1,
    sku, is_weighable, is_loose, base_unit, sale_unit, unit_conversion_ratio, subunit_sale_price, req.params.id
  );
  res.json({ success: true });
});

// ADJUST stock
router.post('/:id/stock', auth(['admin', 'manager']), (req, res) => {
  const { qty, type, note } = req.body;
  if (qty === undefined || !type) return res.status(400).json({ error: 'qty and type required' });

  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  let newStock = product.stock;
  if (type === 'remove') {
    newStock = product.stock - qty;
  } else if (type === 'set') {
    newStock = qty;
  } else {
    newStock = product.stock + qty;
  }

  if (newStock < 0) return res.status(400).json({ error: 'Insufficient stock' });

  db.prepare("UPDATE products SET stock=?,updated_at=datetime('now') WHERE id=?").run(newStock, req.params.id);
  db.prepare('INSERT INTO stock_movements (id,product_id,type,qty,note,created_by) VALUES (?,?,?,?,?,?)')
    .run(uuidv4(), req.params.id, type, qty, note||'', req.user.id);
  res.json({ success: true, new_stock: newStock });
});

// DELETE (soft)
router.delete('/:id', auth(['admin']), (req, res) => {
  db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
