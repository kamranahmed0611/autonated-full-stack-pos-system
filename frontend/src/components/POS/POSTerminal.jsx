import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { useCartStore, useShiftStore } from '../../store'
import { fmt } from '../../utils/helpers'
import CartPanel from './CartPanel'
import Receipt from './Receipt'
import BlindShiftModal from '../Shifts/BlindShiftModal'
import EmergencyBillModal from '../Emergency/EmergencyBillModal'

export default function POSTerminal() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [receipt, setReceipt] = useState(null)

  // Shift & Emergency Modals
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [looseModalProduct, setLooseModalProduct] = useState(null) // Product for dual-unit selection
  const [scaleModalProduct, setScaleModalProduct] = useState(null) // Product for weighable produce

  const { activeShift, fetchCurrentShift } = useShiftStore()
  const addItem = useCartStore(s => s.addItem)
  const searchRef = useRef()

  useEffect(() => {
    loadData()
    fetchCurrentShift()
    searchRef.current?.focus()
  }, [])

  // High-Speed USB Barcode Scanner HID Wedge Listener (Document 07 Pattern)
  useEffect(() => {
    let barcodeBuffer = ''
    let lastKeyTime = Date.now()

    const handleKeyDown = (e) => {
      // Don't intercept if user is typing inside an active input field or modal
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime
      lastKeyTime = currentTime

      if (timeDiff > 100) {
        barcodeBuffer = '' // Reset buffer on pause
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.trim().length >= 3) {
          e.preventDefault()
          const scannedCode = barcodeBuffer.trim()
          barcodeBuffer = ''
          handleBarcodeScanned(scannedCode)
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [products])

  const loadData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
      ])
      setProducts(prodRes.data)
      setCategories([{ id: 'All', name: 'All' }, ...catRes.data])
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleBarcodeScanned = (code) => {
    const found = products.find(p => p.barcode === code || p.sku === code)
    if (found) {
      handleProductClicked(found)
      toast.success(`Scanned: ${found.name}`, { duration: 1500 })
    } else {
      toast.error(`Unrecognized Barcode: ${code}`)
    }
  }

  const handleProductClicked = (product) => {
    if (product.stock <= 0 && product.id !== 'ad-hoc-item') {
      toast.error('Product is out of stock')
      return
    }

    // 1. Loose Commodity: Prompt Dual-Unit Selection
    if (product.is_loose) {
      setLooseModalProduct(product)
      return
    }

    // 2. Weighable Scale Produce: Prompt Weight Input
    if (product.is_weighable) {
      setScaleModalProduct(product)
      return
    }

    // 3. Standard Packaged Good
    const ok = addItem(product)
    if (!ok) toast.error('Max stock reached')
  }

  const handleCheckout = (txn) => {
    setReceipt(txn)
    loadData()
    fetchCurrentShift()
  }

  const filtered = products.filter(p => {
    const matchCat = activeCategory === 'All' || p.category_id === activeCategory
    const q = search.toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.barcode && p.barcode.toLowerCase().includes(q))
    return matchCat && matchQ
  })

  return (
    <div style={styles.shell}>
      {/* LEFT: Product Browser & Counter Terminal */}
      <div style={styles.left}>
        {/* Top Shift Status & Quick Action Bar */}
        <div style={styles.topControlBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              borderRadius: 8, background: activeShift ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${activeShift ? 'var(--emerald)' : 'var(--rose)'}`, fontSize: 12
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: activeShift ? 'var(--emerald)' : 'var(--rose)'
              }} />
              <span style={{ fontWeight: 600, color: activeShift ? 'var(--emerald)' : 'var(--rose)' }}>
                {activeShift ? `Shift Active (${activeShift.cashier_name})` : 'No Active Shift Open'}
              </span>
            </div>

            <button
              onClick={() => setShowShiftModal(true)}
              className="btn btn-secondary btn-xs"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <i className={activeShift ? "ti ti-lock-check" : "ti ti-clock-play"} />
              {activeShift ? 'Blind Close Shift' : 'Open Shift Float'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowEmergencyModal(true)}
              className="btn btn-ghost btn-xs"
              style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <i className="ti ti-bolt" /> Emergency Retroactive Bill
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={styles.searchBar}>
          <div style={styles.searchWrap}>
            <i className="ti ti-barcode" style={styles.searchIcon} />
            <input
              ref={searchRef}
              className="input"
              style={{ paddingLeft: 36, background: 'var(--bg-elevated)', height: 38 }}
              placeholder="Search items or scan USB barcode…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={styles.clearBtn}>
                <i className="ti ti-x" />
              </button>
            )}
          </div>
          <div style={styles.productCount} className="text-muted text-sm mono">{filtered.length} items</div>
        </div>

        {/* Categories */}
        <div style={styles.catRow}>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              style={{
                ...styles.catPill,
                ...(activeCategory === c.id ? styles.catPillActive : {})
              }}
            >
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={styles.loadingState}>
            <i className="ti ti-loader-2 spinner" style={{ fontSize: 24, color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <div style={styles.grid} className="overflow-auto">
            {filtered.length === 0 ? (
              <div style={styles.emptyState}>
                <i className="ti ti-search" style={{ fontSize: 32, opacity: 0.3 }} />
                <span>No products found</span>
              </div>
            ) : filtered.map(p => (
              <ProductCard key={p.id} product={p} onAdd={handleProductClicked} />
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: Billing Cart Panel */}
      <CartPanel onCheckoutSuccess={handleCheckout} />

      {/* Receipt Modal */}
      {receipt && <Receipt txn={receipt} onClose={() => setReceipt(null)} />}

      {/* Blind Shift Modal */}
      <BlindShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onShiftClosed={() => {
          fetchCurrentShift()
          setShowShiftModal(false)
        }}
      />

      {/* Emergency Retroactive Billing Modal */}
      <EmergencyBillModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        onCheckoutSuccess={handleCheckout}
      />

      {/* Loose Commodity Dual-Unit Selector Modal */}
      {looseModalProduct && (
        <LooseCommodityModal
          product={looseModalProduct}
          onClose={() => setLooseModalProduct(null)}
          onConfirm={(unitType, qty) => {
            addItem(looseModalProduct, unitType, qty)
            setLooseModalProduct(null)
          }}
        />
      )}

      {/* Weighable Produce Scale Modal */}
      {scaleModalProduct && (
        <ScaleItemModal
          product={scaleModalProduct}
          onClose={() => setScaleModalProduct(null)}
          onConfirm={(weightKg) => {
            addItem(scaleModalProduct, 'kg', weightKg)
            setScaleModalProduct(null)
          }}
        />
      )}
    </div>
  )
}

function ProductCard({ product, onAdd }) {
  const oos = product.stock <= 0
  const low = product.stock > 0 && product.stock <= product.min_stock

  return (
    <div
      style={{ ...styles.prodCard, ...(oos ? styles.prodOOS : {}) }}
      onClick={() => onAdd(product)}
      className={oos ? '' : 'product-card-hover'}
    >
      <div style={styles.prodTop}>
        <div style={styles.prodIconWrap}>
          <i className={product.is_weighable ? "ti ti-scale" : product.is_loose ? "ti ti-grain" : "ti ti-package"} style={{ color: 'var(--amber)', fontSize: 16 }} />
        </div>
        {product.is_loose === 1 && (
          <span style={{ ...styles.badge, background: 'rgba(217, 119, 6, 0.12)', color: 'var(--amber)' }}>Loose</span>
        )}
        {product.is_weighable === 1 && (
          <span style={{ ...styles.badge, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)' }}>Scale</span>
        )}
        {low && !oos && <span className="badge badge-yellow" style={{ fontSize: 9, padding: '1px 5px' }}>Low</span>}
        {oos && <span className="badge badge-red" style={{ fontSize: 9, padding: '1px 5px' }}>OOS</span>}
      </div>
      <div style={styles.prodName}>{product.name}</div>
      <div style={styles.prodMeta}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{product.barcode}</span>
      </div>
      <div style={styles.prodBottom}>
        <span style={styles.prodPrice}>
          {product.is_loose
            ? `Rs. ${fmt(product.subunit_sale_price || product.price)}`
            : `Rs. ${fmt(product.price)}`
          }
        </span>
        <span style={{ fontSize: 10, color: oos ? 'var(--rose)' : low ? 'var(--yellow)' : 'var(--text-muted)' }}>
          {product.is_loose ? `${product.stock} ${product.base_unit || 'bags'}` : `${product.stock} ${product.unit}`}
        </span>
      </div>
    </div>
  )
}

// Loose Commodity Dual-Unit Selector
function LooseCommodityModal({ product, onClose, onConfirm }) {
  const [selectedUnit, setSelectedUnit] = useState(product.sale_unit || 'kg')
  const [qty, setQty] = useState(1)

  const isRetail = selectedUnit === product.sale_unit
  const price = isRetail ? (product.subunit_sale_price || product.price) : product.price

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard} className="animate-fade">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-grain" style={{ fontSize: 20, color: 'var(--amber)' }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 15 }}>{product.name}</h4>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loose Commodity Dual-Unit Selector</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setSelectedUnit(product.sale_unit || 'kg')}
            style={{
              padding: '10px 8px', borderRadius: 8, border: `1px solid ${isRetail ? 'var(--amber)' : 'var(--border)'}`,
              background: isRetail ? 'var(--amber-dim)' : 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>RETAIL UNIT</div>
            <div style={{ fontWeight: 700, color: isRetail ? 'var(--amber)' : 'inherit', marginTop: 2 }}>{product.sale_unit || 'kg / کلو'}</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 4 }}>Rs. {fmt(product.subunit_sale_price || 0)}</div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedUnit(product.base_unit || 'bag')}
            style={{
              padding: '10px 8px', borderRadius: 8, border: `1px solid ${!isRetail ? 'var(--amber)' : 'var(--border)'}`,
              background: !isRetail ? 'var(--amber-dim)' : 'var(--bg-elevated)', cursor: 'pointer', textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>WHOLESALE BASE UNIT</div>
            <div style={{ fontWeight: 700, color: !isRetail ? 'var(--amber)' : 'inherit', marginTop: 2 }}>{product.base_unit || 'Bag / بوری'}</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 4 }}>Rs. {fmt(product.price)}</div>
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Quantity ({selectedUnit}):
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              className="input"
              style={{ fontSize: 16, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
              value={qty}
              min="0.1"
              step="any"
              onChange={e => setQty(parseFloat(e.target.value) || 0)}
              autoFocus
            />
          </div>
          {isRetail && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {[0.5, 1, 2, 2.5, 5].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQty(q)}
                  className="btn btn-ghost btn-xs"
                  style={{ flex: 1, fontSize: 10 }}
                >
                  {q} kg
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Line Total:</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
            Rs. {fmt(price * qty)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={() => onConfirm(selectedUnit, qty)} className="btn btn-primary btn-sm">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}

// Weighable Produce Scale Dialog
function ScaleItemModal({ product, onClose, onConfirm }) {
  const [weight, setWeight] = useState(1.000)

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalCard} className="animate-fade">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-scale" style={{ fontSize: 20, color: 'var(--emerald)' }} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 15 }}>{product.name}</h4>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weighable Produce (Scale 3-Decimal Precision)</span>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Net Weight (kg):
          </label>
          <input
            type="number"
            className="input"
            style={{ fontSize: 22, fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--emerald)' }}
            value={weight}
            step="0.001"
            min="0.001"
            onChange={e => setWeight(parseFloat(e.target.value) || 0)}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {[0.250, 0.500, 0.750, 1.000, 1.500, 2.000].map(w => (
              <button
                key={w}
                type="button"
                onClick={() => setWeight(w)}
                className="btn btn-ghost btn-xs"
                style={{ flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)' }}
              >
                {w.toFixed(3)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Computed Price (Rs. {fmt(product.price)} / kg):</span>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
            Rs. {fmt(product.price * weight)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button onClick={() => onConfirm(weight)} className="btn btn-primary btn-sm">
            Add Weighted Item
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', height: '100%', overflow: 'hidden' },
  left: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 0 10px 12px' },
  topControlBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8, paddingRight: 12
  },
  searchBar: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingRight: 12 },
  searchWrap: { flex: 1, position: 'relative' },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16, pointerEvents: 'none' },
  clearBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 },
  productCount: { whiteSpace: 'nowrap' },
  catRow: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, paddingRight: 12, flexShrink: 0 },
  catPill: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99,
    border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', transition: 'all 0.15s',
  },
  catPillActive: { background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', fontWeight: 600 },
  grid: {
    flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 8, paddingRight: 12, alignContent: 'start',
  },
  loadingState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyState: { gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', padding: 40 },
  prodCard: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: 10, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 4,
  },
  prodOOS: { opacity: 0.45, cursor: 'not-allowed' },
  prodTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  prodIconWrap: {
    width: 26, height: 26, borderRadius: 6, background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  prodName: { fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 },
  prodMeta: {},
  prodBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 },
  prodPrice: { fontSize: 13, fontWeight: 600, color: 'var(--amber)', fontFamily: 'var(--font-display)' },
  badge: {
    fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 600
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  },
  modalCard: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 14, width: 380, maxWidth: '100%', padding: 20,
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
  }
}
