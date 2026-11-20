import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fmt, fmtDateTime } from '../../utils/helpers'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [ledgerModal, setLedgerModal] = useState(null) // { customer, ledger }
  const [wasooliModal, setWasooliModal] = useState(null) // customer object

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/customers')
      setCustomers(data)
    } catch { toast.error('Failed to load customers') }
    finally { setLoading(false) }
  }

  const openLedger = async (cust) => {
    try {
      const { data } = await api.get(`/customers/${cust.id}/ledger`)
      setLedgerModal(data)
    } catch {
      toast.error('Failed to load customer ledger')
    }
  }

  const sendWhatsAppStatement = async (cust) => {
    try {
      const { data } = await api.get(`/customers/${cust.id}/whatsapp-statement`)
      if (!data.customer_phone) {
        toast.error('Customer has no phone number registered')
        return
      }
      window.open(data.whatsapp_url, '_blank')
      toast.success(`WhatsApp statement opened for ${cust.name}`)
    } catch {
      toast.error('Failed to generate WhatsApp statement')
    }
  }

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  )

  const totalOutstandingKhata = customers.reduce((sum, c) => sum + (c.balance || 0), 0)

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Customer Bahi-Khata &amp; Accounts</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0 0' }}>
            {customers.length} registered customers | Total Outstanding Udhaar (ادھار): 
            <strong style={{ color: 'var(--rose)', marginLeft: 6 }}>Rs. {fmt(totalOutstandingKhata)}</strong>
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn btn-primary">
          <i className="ti ti-user-plus" /> Add Customer
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{filtered.length} results</span>
      </div>

      <div style={styles.tableWrap}>
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Loyalty Pts</th>
              <th>Credit Limit</th>
              <th style={{ textAlign: 'right' }}>Current Debt (بقایا جات)</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)', fontWeight: 600, fontSize: 13 }}>
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.address}</div>}
                    </div>
                  </div>
                </td>
                <td><span className="mono text-sm">{c.phone || '—'}</span></td>
                <td><span className="badge badge-amber">{c.loyalty_pts} pts</span></td>
                <td><span className="mono text-sm">Rs. {fmt(c.credit_limit)}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <span className="mono text-sm" style={{
                    fontWeight: 700,
                    color: c.balance > 0 ? 'var(--rose)' : 'var(--emerald)'
                  }}>
                    Rs. {fmt(c.balance)}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button className="btn btn-secondary btn-xs" title="View Full Bahi-Khata Ledger" onClick={() => openLedger(c)}>
                      <i className="ti ti-book" /> Khata
                    </button>
                    <button className="btn btn-ghost btn-xs" style={{ color: 'var(--emerald)' }} title="Receive Cash Repayment (Wasooli)" onClick={() => setWasooliModal(c)}>
                      <i className="ti ti-cash" /> Wasooli
                    </button>
                    <button className="btn btn-ghost btn-xs" style={{ color: '#25D366' }} title="Send WhatsApp Statement" onClick={() => sendWhatsAppStatement(c)}>
                      <i className="ti ti-brand-whatsapp" /> WhatsApp
                    </button>
                    <button className="btn btn-ghost btn-xs btn-icon" title="Edit Customer" onClick={() => setModal(c)}>
                      <i className="ti ti-edit" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <CustomerModal customer={modal} onClose={() => setModal(null)} onSave={() => { setModal(null); loadData() }} />
      )}

      {ledgerModal && (
        <CustomerLedgerModal
          customer={ledgerModal.customer}
          ledger={ledgerModal.ledger}
          onClose={() => setLedgerModal(null)}
          onSendWhatsApp={() => sendWhatsAppStatement(ledgerModal.customer)}
        />
      )}

      {wasooliModal && (
        <WasooliModal
          customer={wasooliModal}
          onClose={() => setWasooliModal(null)}
          onSuccess={() => { setWasooliModal(null); loadData() }}
        />
      )}
    </div>
  )
}

function CustomerModal({ customer, onClose, onSave }) {
  const isEdit = !!customer?.id
  const [form, setForm] = useState({
    name: customer?.name || '', phone: customer?.phone || '',
    email: customer?.email || '', address: customer?.address || '',
    credit_limit: customer?.credit_limit || 10000,
  })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit) await api.put(`/customers/${customer.id}`, form)
      else await api.post('/customers', form)
      toast.success(isEdit ? 'Customer updated!' : 'Customer added!')
      onSave()
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle} className="animate-fade">
        <div style={modalHeader}>
          <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{isEdit ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Full Name *', 'name', 'text', 'e.g. Dr. Tariq Mahmood'],
            ['Phone Number', 'phone', 'tel', '03xx-xxxxxxx'],
            ['Email', 'email', 'email', 'email@example.com'],
            ['Address', 'address', 'text', 'House #, Street, Sector'],
          ].map(([label, key, type, placeholder]) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{label}</label>
              <input className="input" type={type} placeholder={placeholder} value={form[key]} onChange={e => f(key, e.target.value)} required={key === 'name'} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Allowed Credit Limit (Rs)</label>
            <input className="input" type="number" value={form.credit_limit} onChange={e => f('credit_limit', parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
            {saving ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-check" />}
            {isEdit ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomerLedgerModal({ customer, ledger, onClose, onSendWhatsApp }) {
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyle, width: 680, maxWidth: '95%' }} className="animate-fade">
        <div style={modalHeader}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Customer Bahi-Khata Ledger / کھاتہ</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {customer.name} | Outstanding Net Payable: <strong style={{ color: 'var(--rose)' }}>Rs. {fmt(customer.balance)}</strong>
            </span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>

        <div style={{ padding: '16px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description / Notes</th>
                <th style={{ textAlign: 'right' }}>Debit (+)</th>
                <th style={{ textAlign: 'right' }}>Credit / Wasooli (-)</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(t => (
                <tr key={t.id}>
                  <td className="mono text-xs">{fmtDateTime(t.created_at)}</td>
                  <td>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: t.type === 'DEBIT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: t.type === 'DEBIT' ? 'var(--rose)' : 'var(--emerald)'
                    }}>
                      {t.type === 'DEBIT' ? 'DEBIT (ادھار)' : 'CREDIT (وصولی)'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.notes || '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: t.type === 'DEBIT' ? 'var(--rose)' : 'inherit' }}>
                    {t.type === 'DEBIT' ? `Rs. ${fmt(t.amount)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: t.type === 'CREDIT' ? 'var(--emerald)' : 'inherit' }}>
                    {t.type === 'CREDIT' ? `Rs. ${fmt(t.amount)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    Rs. {fmt(t.running_balance)}
                  </td>
                </tr>
              ))}
              {!ledger.length && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                    No ledger entries found for this customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onSendWhatsApp} className="btn btn-secondary btn-sm" style={{ color: '#25D366' }}>
            <i className="ti ti-brand-whatsapp" /> Send WhatsApp Statement
          </button>
          <button onClick={onClose} className="btn btn-primary btn-sm">Close</button>
        </div>
      </div>
    </div>
  )
}

function WasooliModal({ customer, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('Cash Payment Received (Wasooli / وصولی)')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    setSubmitting(true)
    try {
      await api.post(`/customers/${customer.id}/payment`, {
        amount: amt,
        notes,
        payment_mode: 'cash'
      })
      toast.success(`Received Rs. ${fmt(amt)} wasooli from ${customer.name}`)
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record repayment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle} className="animate-fade">
        <div style={modalHeader}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Receive Customer Payment (وصولی)</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {customer.name} | Current Debt: <strong style={{ color: 'var(--rose)' }}>Rs. {fmt(customer.balance)}</strong>
            </span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Cash Received Amount (Rs.) *</label>
            <input
              type="number"
              className="input"
              style={{ marginTop: 4, fontSize: 18, fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}
              placeholder="e.g. 5000"
              min="1"
              max={customer.balance > 0 ? customer.balance * 2 : 1000000}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Receipt Note / Description</label>
            <input
              type="text"
              className="input input-sm"
              style={{ marginTop: 4 }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Recording…' : 'Confirm Cash Wasooli'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modalStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-md)', borderRadius: 16, width: 440, maxWidth: '100%', boxShadow: 'var(--shadow-lg)' }
const modalHeader = { padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

const styles = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20, gap: 16 },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  tableWrap: { flex: 1, overflow: 'auto', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' },
}
