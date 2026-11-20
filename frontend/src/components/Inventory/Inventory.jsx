import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fmt, fmtDateTime, stockStatus } from '../../utils/helpers'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [modalProduct, setModalProduct] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [stockModal, setStockModal] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([api.get('/products'), api.get('/categories')])
      setProducts(p.data)
      setCategories(c.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q)
    const matchCat = !filterCat || p.category_id === filterCat
    const matchStock = !filterStock
      || (filterStock === 'low' && p.stock > 0 && p.stock <= p.min_stock)
      || (filterStock === 'out' && p.stock === 0)
      || (filterStock === 'ok' && p.stock > p.min_stock)
    return matchQ && matchCat && matchStock
  })

  const stats = {
    total: products.length,
    low: products.filter(p => p.stock > 0 && p.stock <= p.min_stock).length,
    out: products.filter(p => p.stock === 0).length,
    value: products.reduce((s, p) => s + p.price * p.stock, 0),
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.topBar}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Inventory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{products.length} products across {categories.length} categories</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn btn-primary">
          <i className="ti ti-plus" /> Add Product
        </button>
      </div>

      {/* Stats Row */}
      <div style={styles.statsRow}>
        {[
          { label: 'Total SKUs', value: stats.total, icon: 'ti-packages', color: 'var(--blue)' },
          { label: 'Low Stock', value: stats.low, icon: 'ti-alert-triangle', color: 'var(--yellow)', filter: 'low' },
          { label: 'Out of Stock', value: stats.out, icon: 'ti-circle-x', color: 'var(--red)', filter: 'out' },
          { label: 'Inventory Value', value: fmt(stats.value), icon: 'ti-coin', color: 'var(--amber)' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ cursor: s.filter ? 'pointer' : 'default' }}
            onClick={() => s.filter && setFilterStock(filterStock === s.filter ? '' : s.filter)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
              </div>
              <div style={{ background: `${s.color}18`, padding: 8, borderRadius: 10 }}>
                <i className={`ti ${s.icon}`} style={{ fontSize: 20, color: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 15 }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search products…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" style={{ width: 140 }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
          <option value="">All Stock</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{filtered.length} results</span>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <i className="ti ti-loader-2 spinner" style={{ fontSize: 28, color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Min</th>
                <th>Status</th>
                <th>Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const { label, cls } = stockStatus(p.stock, p.min_stock)
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <i className={p.is_weighable ? "ti ti-scale" : p.is_loose ? "ti ti-grain" : "ti ti-package"} style={{ color: 'var(--amber)', fontSize: 14 }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{p.barcode}</span></td>
                    <td>
                      <span style={{ fontSize: 12 }}>
                        {p.category_name}
                      </span>
                    </td>
                    <td><span className="mono" style={{ fontSize: 13 }}>{fmt(p.price)}</span></td>
                    <td><span className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{fmt(p.cost)}</span></td>
                    <td>
                      <span className="mono fw-500" style={{
                        color: p.stock === 0 ? 'var(--red)' : p.stock <= p.min_stock ? 'var(--yellow)' : 'var(--text-primary)'
                      }}>{p.stock}</span>
                    </td>
                    <td><span className="mono text-sm text-muted">{p.min_stock}</span></td>
                    <td><span className={`badge ${cls}`}>{label}</span></td>
                    <td><span className="mono text-sm">{fmt(p.price * p.stock)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Adjust Stock"
                          onClick={() => setStockModal(p)}>
                          <i className="ti ti-arrows-up-down" />
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Edit"
                          onClick={() => setModalProduct(p)}>
                          <i className="ti ti-edit" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {addModal && <ProductModal categories={categories} onClose={() => setAddModal(false)} onSave={() => { setAddModal(false); loadData(); }} />}
      {modalProduct && <ProductModal product={modalProduct} categories={categories} onClose={() => setModalProduct(null)} onSave={() => { setModalProduct(null); loadData(); }} />}
      {stockModal && <StockAdjustModal product={stockModal} onClose={() => setStockModal(null)} onSave={() => { setStockModal(null); loadData(); }} />}
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSave }) {
  const isEdit = !!product
  const [form, setForm] = useState({
    barcode: product?.barcode || '',
    sku: product?.sku || '',
    name: product?.name || '',
    category_id: product?.category_id || categories[0]?.id || '',
    price: product?.price || '',
    cost: product?.cost || '',
    tax_rate: product?.tax_rate ?? 0,
    stock: product?.stock || 0,
    min_stock: product?.min_stock || 5,
    unit: product?.unit || 'pcs',
    icon: product?.icon || '',
    active: product?.active ?? 1,

    // Fusion: Loose Commodity & Scale Attributes
    is_weighable: product?.is_weighable ?? 0,
    is_loose: product?.is_loose ?? 0,
    base_unit: product?.base_unit || '',
    sale_unit: product?.sale_unit || '',
    unit_conversion_ratio: product?.unit_conversion_ratio || 1.0,
    subunit_sale_price: product?.subunit_sale_price || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit) await api.put(`/products/${product.id}`, form)
      else await api.post('/products', form)
      toast.success(isEdit ? 'Product updated!' : 'Product added!')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyle, width: 500, maxHeight: '90vh' }} className="animate-fade">
        <div style={modalHeader}>
          <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{isEdit ? 'Edit Product' : 'Add Product'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '70vh' }}>
          <Row label="Product Name">
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Super Kernel Basmati Rice 5kg" required />
          </Row>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Row label="Barcode"><input className="input mono" value={form.barcode} onChange={e => f('barcode', e.target.value)} placeholder="89640001001" required /></Row>
            <Row label="SKU / Item Code"><input className="input mono" value={form.sku} onChange={e => f('sku', e.target.value)} placeholder="SKU-1001" /></Row>
          </div>
          <Row label="Category">
            <select className="input" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Row>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Row label="Selling Price (Rs.)"><input className="input" type="number" value={form.price} onChange={e => f('price', parseFloat(e.target.value))} required /></Row>
            <Row label="Cost Price (Rs.)"><input className="input" type="number" value={form.cost} onChange={e => f('cost', parseFloat(e.target.value))} /></Row>
            <Row label="Tax Rate %"><input className="input" type="number" value={form.tax_rate} onChange={e => f('tax_rate', parseFloat(e.target.value))} /></Row>
            <Row label="Unit"><input className="input" value={form.unit} onChange={e => f('unit', e.target.value)} placeholder="pcs" /></Row>
            {!isEdit && <Row label="Opening Stock"><input className="input" type="number" value={form.stock} onChange={e => f('stock', parseFloat(e.target.value))} /></Row>}
            <Row label="Min Stock Alert"><input className="input" type="number" value={form.min_stock} onChange={e => f('min_stock', parseFloat(e.target.value))} /></Row>
          </div>

          {/* Fusion Extensions: Loose Commodity & Scale Produce */}
          <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-md)', marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.is_loose)}
                  onChange={e => f('is_loose', e.target.checked ? 1 : 0)}
                />
                <span style={{ fontWeight: 600, color: 'var(--amber)' }}>Loose Bulk Commodity (Dual-Unit)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(form.is_weighable)}
                  onChange={e => f('is_weighable', e.target.checked ? 1 : 0)}
                />
                <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>Weighable Produce (Scale)</span>
              </label>
            </div>

            {Boolean(form.is_loose) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-md)' }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wholesale Base Unit</label>
                  <input className="input input-sm" placeholder="e.g. Bag / بوری" value={form.base_unit} onChange={e => f('base_unit', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retail Sub-Unit</label>
                  <input className="input input-sm" placeholder="e.g. kg / کلو" value={form.sale_unit} onChange={e => f('sale_unit', e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Units per Base Unit (Ratio)</label>
                  <input className="input input-sm" type="number" placeholder="50.0" value={form.unit_conversion_ratio} onChange={e => f('unit_conversion_ratio', parseFloat(e.target.value) || 1)} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retail Sub-Unit Price (Rs.)</label>
                  <input className="input input-sm" type="number" placeholder="145.0" value={form.subunit_sale_price} onChange={e => f('subunit_sale_price', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
            {saving ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-check" />}
            {isEdit ? 'Update' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StockAdjustModal({ product, onClose, onSave }) {
  const [qty, setQty] = useState(1)
  const [type, setType] = useState('add')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post(`/products/${product.id}/stock`, { qty, type, note })
      toast.success('Stock updated!')
      onSave()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyle, maxWidth: 360 }} className="animate-fade">
        <div style={modalHeader}>
          <h3 style={{ fontFamily: 'var(--font-display)' }}>Adjust Stock</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-package" style={{ color: 'var(--amber)' }} />
              {product.name}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Current Stock: <strong style={{ color: 'var(--text-primary)' }}>{product.stock} {product.unit}</strong></div>
          </div>
          <Row label="Adjustment Type">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['add','Add Stock','ti-plus'],['remove','Remove','ti-minus'],['set','Set Exact','ti-equal']].map(([v,l,ic]) => (
                <button key={v} onClick={() => setType(v)} className={type === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ flex: 1 }}>
                  <i className={`ti ${ic}`} />{l}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Quantity"><input className="input" type="number" min="0" value={qty} onChange={e => setQty(parseInt(e.target.value)||0)} /></Row>
          <Row label="Note (optional)"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for adjustment…" /></Row>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            New stock will be: <strong style={{ color: type === 'add' ? 'var(--green)' : type === 'remove' ? 'var(--red)' : 'var(--amber)' }}>
              {type === 'add' ? product.stock + qty : type === 'remove' ? Math.max(0, product.stock - qty) : qty}
            </strong> {product.unit}
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
            {saving ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-check" />} Save
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const modalStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-md)', borderRadius: 16, width: '90%', maxWidth: 540, boxShadow: 'var(--shadow-lg)' }
const modalHeader = { padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

const styles = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20, gap: 16 },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  filters: { display: 'flex', gap: 10, alignItems: 'center' },
  tableWrap: { flex: 1, overflow: 'auto', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' },
}
