import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fmt } from '../../utils/helpers'

export default function EmergencyBillModal({ isOpen, onClose, onCheckoutSuccess }) {
  const [customDateTime, setCustomDateTime] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [inventoryDeducted, setInventoryDeducted] = useState(true)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')

  // Ad-hoc line items
  const [items, setItems] = useState([
    { name: 'Manual Paper Bill Item #1', price: '', qty: 1 }
  ])
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const addItemRow = () => {
    setItems([...items, { name: '', price: '', qty: 1 }])
  }

  const removeItemRow = (idx) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx, field, val) => {
    const copy = [...items]
    copy[idx][field] = val
    setItems(copy)
  }

  const billTotal = items.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0
    const q = parseFloat(item.qty) || 0
    return sum + (p * q)
  }, 0)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validItems = items.filter(i => (parseFloat(i.price) || 0) > 0)
    if (!validItems.length) {
      toast.error('Add at least one item with a valid price')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        items: validItems.map(i => ({
          product_id: 'ad-hoc-item',
          product_name: i.name || 'Ad-Hoc Manual Item',
          unit_price: parseFloat(i.price),
          qty: parseFloat(i.qty) || 1,
          unit_type: 'pcs'
        })),
        payment_method: paymentMode,
        is_retroactive: 1,
        inventory_deducted: inventoryDeducted ? 1 : 0,
        custom_created_at: new Date(customDateTime).toISOString(),
        notes: `Emergency Retroactive Entry | Customer: ${customerName || 'Walk-in'} ${customerPhone ? `(${customerPhone})` : ''} | Inv Deduct: ${inventoryDeducted ? 'YES' : 'NO (Manual)'}`
      }

      const { data } = await api.post('/transactions', payload)
      toast.success(`Emergency Invoice #${data.invoice_no} booked successfully!`)
      if (onCheckoutSuccess) onCheckoutSuccess(data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit emergency bill')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={{ ...modalStyles.card, width: 560 }} className="animate-fade">
        <div style={modalStyles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-bolt" style={{ fontSize: 24, color: 'var(--amber)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>Emergency Retroactive Billing</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Enter backdated paper receipts after load-shedding</p>
            </div>
          </div>
          <button onClick={onClose} style={modalStyles.closeBtn}><i className="ti ti-x" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 22px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Top Controls: Date and Inventory Deduction Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={modalStyles.fieldLabel}>Real Transaction Time (Backdated)</label>
              <input
                type="datetime-local"
                className="input input-sm"
                style={{ marginTop: 4 }}
                value={customDateTime}
                onChange={e => setCustomDateTime(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={modalStyles.fieldLabel}>Deduct Physical Stock?</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={inventoryDeducted}
                  onChange={e => setInventoryDeducted(e.target.checked)}
                />
                <span style={{ color: inventoryDeducted ? 'var(--emerald)' : 'var(--amber)', fontWeight: 500 }}>
                  {inventoryDeducted ? 'Yes, deduct SQLite stock' : 'No (Already logged on paper)'}
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={modalStyles.fieldLabel}>Customer Name (Optional)</label>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Dr. Tariq"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <label style={modalStyles.fieldLabel}>Customer Phone (Optional)</label>
              <input
                type="text"
                className="input input-sm"
                placeholder="0300-1234567"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          {/* Ad-Hoc Items List */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>MANUAL LINE ITEMS:</span>
              <button type="button" onClick={addItemRow} className="btn btn-secondary btn-xs">
                <i className="ti ti-plus" /> Add Item Line
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input input-sm"
                    style={{ flex: 2 }}
                    placeholder="Item description / name"
                    value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className="input input-sm"
                    style={{ width: 75, textAlign: 'center' }}
                    placeholder="Qty"
                    min="0.1"
                    step="any"
                    value={item.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className="input input-sm"
                    style={{ width: 100, textAlign: 'right' }}
                    placeholder="Price (Rs.)"
                    min="0"
                    value={item.price}
                    onChange={e => updateItem(idx, 'price', e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="btn btn-ghost btn-xs"
                    disabled={items.length <= 1}
                    style={{ color: 'var(--rose)' }}
                  >
                    <i className="ti ti-trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method & Total */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Payment Mode:</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {['cash', 'digital', 'khata'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMode(m)}
                    className={`btn btn-xs ${paymentMode === m ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>TOTAL PAYABLE:</span>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                Rs. {fmt(billTotal)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Booking…' : 'Record Emergency Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 16, width: 560, maxWidth: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid var(--border-md)'
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 18, padding: 4
  },
  fieldLabel: {
    fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em'
  }
}
