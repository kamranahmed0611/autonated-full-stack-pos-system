import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { useCartStore } from '../../store'
import { fmt } from '../../utils/helpers'

const PAY_METHODS = [
  { id: 'cash',      icon: 'ti-cash',                label: 'Cash' },
  { id: 'card',      icon: 'ti-credit-card',         label: 'Card' },
  { id: 'digital',   icon: 'ti-device-mobile',       label: 'Digital' },
  { id: 'credit',    icon: 'ti-book',                label: 'Khata (Udhaar)' },
]

export default function CartPanel({ onCheckoutSuccess }) {
  const {
    items, customer, discountVal, discountType, taxRate, paymentMethod, paidAmount, notes,
    setQty, removeItem, clearCart, setCustomer, setDiscount, setTaxRate, setPaymentMethod,
    setPaidAmount, setNotes, totals,
  } = useCartStore()

  const [loading, setLoading] = useState(false)
  const [custSearch, setCustSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [showCustDrop, setShowCustDrop] = useState(false)
  const [adminPinOverride, setAdminPinOverride] = useState('')
  const [showOverrideModal, setShowOverrideModal] = useState(false)

  const searchCustomers = async (q) => {
    setCustSearch(q)
    if (q.length < 2) { setCustomers([]); setShowCustDrop(false); return }
    try {
      const { data } = await api.get(`/customers?search=${q}`)
      setCustomers(data)
      setShowCustDrop(true)
    } catch {
      // ignore
    }
  }

  const handleCheckout = async () => {
    if (!items.length) return

    const isCredit = ['credit', 'khata'].includes(paymentMethod)
    if (isCredit && !customer) {
      toast.error('Please select a customer for Khata (Credit) sales')
      return
    }

    // Check credit limit
    if (isCredit && customer) {
      const projected = (customer.balance || 0) + totals.grand
      if (customer.credit_limit > 0 && projected > customer.credit_limit && !adminPinOverride) {
        setShowOverrideModal(true)
        return
      }
    }

    setLoading(true)
    try {
      const payload = {
        customer_id: customer?.id || null,
        items: items.map(i => ({
          product_id: i.product_id,
          product_name: i.name,
          qty: i.qty,
          unit_price: i.price,
          unit_type: i.unit_type,
          is_loose: i.is_loose ? 1 : 0,
          discount_amount: i.discount_amount || 0
        })),
        discount_val: discountVal,
        discount_type: discountType,
        tax_rate: taxRate,
        payment_method: paymentMethod,
        paid_amount: paidAmount ? parseFloat(paidAmount) : totals.grand,
        admin_pin_override: adminPinOverride || undefined,
        notes,
      }

      const { data } = await api.post('/transactions', payload)
      const fullTxn = await api.get(`/transactions/${data.id}`)
      clearCart()
      setCustSearch('')
      setAdminPinOverride('')
      setShowOverrideModal(false)
      onCheckoutSuccess(fullTxn.data)
      toast.success(`Invoice ${data.invoice_no} booked successfully!`)
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Checkout failed'
      if (err.response?.data?.requiresAdminOverride) {
        setShowOverrideModal(true)
      }
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, discAmt, taxAmt, rawGrand, grand, roundOffAmount, itemCount, changeDue } = totals

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-shopping-cart" style={{ color: 'var(--amber)', fontSize: 18 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Billing Cart</span>
          {itemCount > 0 && (
            <span style={styles.badge}>{items.length} lines ({itemCount})</span>
          )}
        </div>
        {items.length > 0 && (
          <button onClick={clearCart} className="btn btn-ghost btn-xs" style={{ color: 'var(--rose)' }}>
            <i className="ti ti-trash" /> Clear
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div style={styles.items}>
        {items.length === 0 ? (
          <div style={styles.empty}>
            <i className="ti ti-shopping-cart-off" style={{ fontSize: 36, opacity: 0.2 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Cart is empty</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Scan barcodes or click items</span>
          </div>
        ) : items.map(item => (
          <div key={item.lineId} style={styles.item}>
            <div style={styles.itemLeft}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <i
                  className={item.is_weighable ? "ti ti-scale" : item.is_loose ? "ti ti-grain" : "ti ti-package"}
                  style={{ fontSize: 13, color: 'var(--amber)' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={styles.itemName}>{item.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span>Rs. {fmt(item.price)} / {item.unit_type}</span>
                  {item.is_loose && (
                    <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber)', fontSize: 9, padding: '1px 4px', borderRadius: 3 }}>
                      Loose
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={styles.itemRight}>
              <div style={styles.qtyRow}>
                <button
                  style={styles.qtyBtn}
                  onClick={() => setQty(item.lineId, item.is_weighable ? Math.max(0, item.qty - 0.25) : item.qty - 1)}
                >
                  <i className="ti ti-minus" style={{ fontSize: 10 }} />
                </button>
                <input
                  type="number"
                  style={styles.qtyInput}
                  value={item.qty}
                  step={item.is_weighable ? "0.001" : "1"}
                  min="0"
                  onChange={e => setQty(item.lineId, e.target.value)}
                />
                <button
                  style={styles.qtyBtn}
                  onClick={() => setQty(item.lineId, item.is_weighable ? item.qty + 0.25 : item.qty + 1)}
                >
                  <i className="ti ti-plus" style={{ fontSize: 10 }} />
                </button>
              </div>
              <div style={styles.lineTotal}>Rs. {fmt(item.price * item.qty)}</div>
              <button style={styles.removeBtn} onClick={() => removeItem(item.lineId)}>
                <i className="ti ti-x" style={{ fontSize: 12 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Customer Bahi-Khata Selector */}
      <div style={styles.section}>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-user" style={styles.secIcon} />
          <input
            className="input input-sm"
            style={{ paddingLeft: 30, fontSize: 12 }}
            placeholder="Select customer for Khata / Points…"
            value={customer ? `${customer.name} (Debt: Rs. ${fmt(customer.balance || 0)})` : custSearch}
            onChange={e => { setCustomer(null); searchCustomers(e.target.value) }}
          />
          {customer && (
            <button style={styles.clearCustBtn} onClick={() => { setCustomer(null); setCustSearch('') }}>
              <i className="ti ti-x" />
            </button>
          )}
          {showCustDrop && customers.length > 0 && (
            <div style={styles.dropdown}>
              {customers.map(c => (
                <div key={c.id} style={styles.dropItem} onClick={() => { setCustomer(c); setCustSearch(''); setShowCustDrop(false) }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>{c.phone}</span>
                  </div>
                  <div style={{ fontSize: 11, color: c.balance > 0 ? 'var(--rose)' : 'var(--emerald)' }}>
                    Debt: Rs. {fmt(c.balance)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Discount & Tax */}
      <div style={{ ...styles.section, display: 'flex', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          <input
            className="input input-sm"
            type="number"
            style={{ width: 65, textAlign: 'right', paddingLeft: 6, paddingRight: 4 }}
            placeholder="Disc"
            value={discountVal || ''}
            onChange={e => setDiscount(parseFloat(e.target.value) || 0, discountType)}
            min="0"
          />
          <select
            className="input input-sm"
            style={{ padding: '4px 6px' }}
            value={discountType}
            onChange={e => setDiscount(discountVal, e.target.value)}
          >
            <option value="percent">% Disc</option>
            <option value="flat">Rs. Disc</option>
          </select>
        </div>
        <select
          className="input input-sm"
          style={{ width: 95 }}
          value={taxRate}
          onChange={e => setTaxRate(parseFloat(e.target.value))}
        >
          <option value={0}>No Tax</option>
          <option value={5}>GST 5%</option>
          <option value={18}>GST 18%</option>
        </select>
      </div>

      {/* Totals with Pakistani Retail Nearest Rs. 5 Rounding */}
      <div style={styles.totals}>
        <TotRow label="Subtotal" value={`Rs. ${fmt(subtotal)}`} />
        {discAmt > 0 && <TotRow label={`Discount`} value={`- Rs. ${fmt(discAmt)}`} green />}
        {taxAmt > 0 && <TotRow label={`Tax (${taxRate}%)`} value={`+ Rs. ${fmt(taxAmt)}`} />}

        {/* Nearest Rs. 5 Rounding Differential */}
        {paymentMethod === 'cash' && roundOffAmount !== 0 && (
          <TotRow
            label="Nearest 5 Round Off (روپے)"
            value={`${roundOffAmount > 0 ? '+' : ''} Rs. ${roundOffAmount}`}
            highlight
          />
        )}

        <div style={styles.grandRow}>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>Net Payable</span>
            {paymentMethod === 'cash' && roundOffAmount !== 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>Raw: Rs. {fmt(rawGrand)}</span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color: 'var(--amber)' }}>
            Rs. {fmt(grand)}
          </span>
        </div>
      </div>

      {/* Payment Tender Modes */}
      <div style={styles.section}>
        <div style={styles.payRow}>
          {PAY_METHODS.map(m => (
            <button
              key={m.id}
              onClick={() => setPaymentMethod(m.id)}
              style={{ ...styles.payBtn, ...(paymentMethod === m.id ? styles.payBtnActive : {}) }}
            >
              <i className={`ti ${m.icon}`} style={{ fontSize: 14 }} />
              <span style={{ fontSize: 10 }}>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Cash Tender & Change Due Quick Input */}
        {paymentMethod === 'cash' && (
          <div style={{ marginTop: 8, background: 'var(--bg-elevated)', borderRadius: 8, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tendered Cash:</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPaidAmount(amt)}
                    style={styles.quickAmtBtn}
                  >
                    +{amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPaidAmount(grand)}
                  style={styles.quickAmtBtn}
                >
                  Exact
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <input
                type="number"
                className="input input-sm"
                placeholder={`e.g. ${grand}`}
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}
              />
              <div style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Change Due: </span>
                <strong style={{ color: changeDue > 0 ? 'var(--emerald)' : 'inherit', fontFamily: 'var(--font-mono)' }}>
                  Rs. {fmt(changeDue)}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Checkout Button */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          className="btn btn-primary btn-lg w-full"
          disabled={items.length === 0 || loading}
          onClick={handleCheckout}
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em', fontSize: 14 }}
        >
          {loading
            ? <><i className="ti ti-loader-2 spinner" /> Processing Checkout…</>
            : <><i className="ti ti-check" /> Charge Rs. {fmt(grand)}</>
          }
        </button>
      </div>

      {/* ADMIN PIN OVERRIDE MODAL (For Credit Limit Breaches) */}
      {showOverrideModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className="ti ti-shield-alert" style={{ fontSize: 24, color: 'var(--rose)' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: 15 }}>Customer Credit Limit Breached</h4>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                  Limit: Rs. {fmt(customer?.credit_limit || 0)} | Projected: Rs. {fmt((customer?.balance || 0) + grand)}
                </p>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              This purchase exceeds the customer&apos;s permitted Bahi-Khata credit ceiling. Enter the Admin Master PIN (Default: 8888) to override and authorize this charge.
            </p>

            <div style={{ marginBottom: 16 }}>
              <input
                type="password"
                className="input"
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 20 }}
                placeholder="Admin PIN"
                maxLength="6"
                value={adminPinOverride}
                onChange={e => setAdminPinOverride(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowOverrideModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
              <button onClick={handleCheckout} className="btn btn-primary btn-sm">
                Authorize &amp; Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TotRow({ label, value, green, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: highlight ? 'var(--amber)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
        color: green ? 'var(--emerald)' : highlight ? 'var(--amber)' : 'var(--text-secondary)',
        fontWeight: highlight ? 600 : 400
      }}>
        {value}
      </span>
    </div>
  )
}

const styles = {
  panel: {
    width: 340, flexShrink: 0, background: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', height: '100%'
  },
  header: {
    padding: '10px 14px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  badge: {
    background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: 99,
    fontSize: 10, fontWeight: 700, padding: '1px 6px', fontFamily: 'var(--font-mono)',
  },
  items: { flex: 1, overflowY: 'auto', padding: '6px 8px' },
  empty: {
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 4, padding: 20
  },
  item: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 6px', borderBottom: '1px solid var(--border-subtle)', gap: 8
  },
  itemLeft: { display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 0 },
  itemName: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemRight: { display: 'flex', gap: 8, alignItems: 'center' },
  qtyRow: { display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' },
  qtyBtn: { background: 'none', border: 'none', padding: '3px 6px', cursor: 'pointer', color: 'var(--text-secondary)' },
  qtyInput: { width: 44, border: 'none', background: 'transparent', textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', padding: 0 },
  lineTotal: { fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: 60, textAlign: 'right' },
  removeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 },
  section: { padding: '8px 12px', borderTop: '1px solid var(--border)' },
  secIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none' },
  clearCustBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
  dropdown: {
    position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--bg-surface)',
    border: '1px solid var(--border-md)', borderRadius: 8, maxHeight: 180, overflowY: 'auto',
    zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginBottom: 4
  },
  dropItem: {
    padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12
  },
  totals: { padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' },
  grandRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-md)' },
  payRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 },
  payBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 2px',
    borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  payBtnActive: { background: 'var(--amber-dim)', border: '1px solid var(--amber)', color: 'var(--amber)', fontWeight: 600 },
  quickAmtBtn: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4,
    fontSize: 9, padding: '1px 5px', color: 'var(--text-secondary)', cursor: 'pointer'
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
