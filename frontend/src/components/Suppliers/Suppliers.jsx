import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { fmt } from '../../utils/helpers'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(null) // supplier object
  const [showPayModal, setShowPayModal] = useState(null)   // supplier object
  const [activeLedger, setActiveLedger] = useState(null)   // { supplier, transactions }

  // Forms
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    company_name: '',
    phone: '',
    credit_limit: 50000,
    payment_terms_days: 7,
    opening_balance: 0
  })

  const [billForm, setBillForm] = useState({
    invoice_no: '',
    credit_amount: '',
    bill_type: 'VERIFIED_BILL',
    notes: ''
  })

  const [payForm, setPayForm] = useState({
    invoice_no: '',
    debit_amount: '',
    settlement_discount: '', // Kasar / کسر
    deduct_from_drawer: true,
    notes: ''
  })

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const { data } = await api.get('/suppliers')
      setSuppliers(data)
    } catch {
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSupplier = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/suppliers', newSupplier)
      toast.success('Supplier created successfully')
      setShowAddModal(false)
      setNewSupplier({ name: '', company_name: '', phone: '', credit_limit: 50000, payment_terms_days: 7, opening_balance: 0 })
      loadSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create supplier')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordBill = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post(`/suppliers/${showBillModal.id}/transactions`, {
        type: 'PURCHASE_BILL',
        invoice_no: billForm.invoice_no,
        credit_amount: parseFloat(billForm.credit_amount) || 0,
        bill_type: billForm.bill_type,
        notes: billForm.notes
      })
      toast.success('Procurement bill recorded')
      setShowBillModal(null)
      setBillForm({ invoice_no: '', credit_amount: '', bill_type: 'VERIFIED_BILL', notes: '' })
      loadSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record bill')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordPayment = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post(`/suppliers/${showPayModal.id}/transactions`, {
        type: 'PAYMENT',
        invoice_no: payForm.invoice_no,
        debit_amount: parseFloat(payForm.debit_amount) || 0,
        settlement_discount: parseFloat(payForm.settlement_discount) || 0,
        deduct_from_drawer: payForm.deduct_from_drawer ? 1 : 0,
        notes: payForm.notes
      })
      toast.success('Payment & settlement recorded')
      setShowPayModal(null)
      setPayForm({ invoice_no: '', debit_amount: '', settlement_discount: '', deduct_from_drawer: true, notes: '' })
      loadSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  const openLedger = async (supp) => {
    try {
      const { data } = await api.get(`/suppliers/${supp.id}/ledger`)
      setActiveLedger(data)
    } catch {
      toast.error('Failed to load ledger')
    }
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.company_name && s.company_name.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone && s.phone.includes(search))
  )

  const totalPayable = suppliers.reduce((sum, s) => sum + s.current_balance, 0)

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Wholesale Suppliers &amp; Procurement</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0 0' }}>
            Manage distributor accounts, Katchi Parchi slips, and Kasar (کسر) settlements
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={styles.statPill}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Store Payables:</span>
            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--rose)' }}>
              Rs. {fmt(totalPayable)}
            </span>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <i className="ti ti-plus" /> New Supplier
          </button>
        </div>
      </div>

      <div style={{ padding: '0 24px 20px 24px' }}>
        <div style={{ marginBottom: 14, maxWidth: 360 }}>
          <div style={{ position: 'relative' }}>
            <i className="ti ti-search" style={styles.searchIcon} />
            <input
              type="text"
              className="input input-sm"
              placeholder="Search distributor name, company, phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
          </div>
        </div>

        {/* Suppliers Table */}
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Distributor / Supplier</th>
                <th style={styles.th}>Company</th>
                <th style={styles.th}>Contact Phone</th>
                <th style={styles.th}>Payment Terms</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Current Payable (بقایا)</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Limit: Rs. {fmt(s.credit_limit)}</div>
                  </td>
                  <td style={styles.td}>{s.company_name || '—'}</td>
                  <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{s.phone || '—'}</td>
                  <td style={styles.td}>
                    <span style={styles.badge}>{s.payment_terms_days} Days</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
                      color: s.current_balance > 0 ? 'var(--rose)' : 'var(--emerald)'
                    }}>
                      Rs. {fmt(s.current_balance)}
                    </div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={() => openLedger(s)} className="btn btn-secondary btn-xs" title="View Full Bahi-Khata">
                        <i className="ti ti-book" /> Ledger
                      </button>
                      <button onClick={() => setShowBillModal(s)} className="btn btn-ghost btn-xs" title="Record Delivery Bill">
                        <i className="ti ti-receipt" /> Bill
                      </button>
                      <button onClick={() => setShowPayModal(s)} className="btn btn-primary btn-xs" title="Make Payment / Kasar">
                        <i className="ti ti-cash" /> Pay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                    No suppliers found. Click &quot;New Supplier&quot; to add a distributor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW SUPPLIER MODAL */}
      {showAddModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade">
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Register New Supplier</h3>
              <button onClick={() => setShowAddModal(false)} style={styles.closeBtn}><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleAddSupplier} style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={styles.label}>Supplier / Distributor Name *</label>
                <input
                  type="text" className="input" placeholder="e.g. Unilever Islamabad Agency"
                  value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  required autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={styles.label}>Parent Company</label>
                  <input
                    type="text" className="input" placeholder="e.g. Unilever Pakistan"
                    value={newSupplier.company_name} onChange={e => setNewSupplier({ ...newSupplier, company_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="text" className="input" placeholder="0300-1234567"
                    value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={styles.label}>Payment Terms (Days)</label>
                  <input
                    type="number" className="input" value={newSupplier.payment_terms_days}
                    onChange={e => setNewSupplier({ ...newSupplier, payment_terms_days: e.target.value })}
                  />
                </div>
                <div>
                  <label style={styles.label}>Opening Balance Payable</label>
                  <input
                    type="number" className="input" placeholder="0"
                    value={newSupplier.opening_balance} onChange={e => setNewSupplier({ ...newSupplier, opening_balance: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PROCUREMENT BILL MODAL */}
      {showBillModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade">
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Record Delivery Bill / Stock In</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supplier: {showBillModal.name}</span>
              </div>
              <button onClick={() => setShowBillModal(null)} style={styles.closeBtn}><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleRecordBill} style={{ padding: 20 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={styles.label}>Bill Type / ڈاکومنٹ کی قسم</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio" name="bill_type" value="VERIFIED_BILL"
                      checked={billForm.bill_type === 'VERIFIED_BILL'}
                      onChange={() => setBillForm({ ...billForm, bill_type: 'VERIFIED_BILL' })}
                    />
                    <span>Verified Bill / پکا بل (Tax Invoice)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="radio" name="bill_type" value="KATCHI_PARCHI"
                      checked={billForm.bill_type === 'KATCHI_PARCHI'}
                      onChange={() => setBillForm({ ...billForm, bill_type: 'KATCHI_PARCHI' })}
                    />
                    <span style={{ color: 'var(--amber)' }}>Katchi Parchi / کچی پرچی</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={styles.label}>Invoice / Slip # *</label>
                  <input
                    type="text" className="input" placeholder="e.g. DEL-8812"
                    value={billForm.invoice_no} onChange={e => setBillForm({ ...billForm, invoice_no: e.target.value })}
                    required autoFocus
                  />
                </div>
                <div>
                  <label style={styles.label}>Bill Amount (Rs.) *</label>
                  <input
                    type="number" className="input" placeholder="0" min="1"
                    value={billForm.credit_amount} onChange={e => setBillForm({ ...billForm, credit_amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Items / Notes</label>
                <textarea
                  className="input" rows={2} placeholder="Description of delivered goods..."
                  value={billForm.notes} onChange={e => setBillForm({ ...billForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowBillModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording…' : 'Add to Supplier Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT & KASAR MODAL */}
      {showPayModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="animate-fade">
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Make Supplier Payment &amp; Kasar</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supplier: {showPayModal.name} | Balance: Rs. {fmt(showPayModal.current_balance)}</span>
              </div>
              <button onClick={() => setShowPayModal(null)} style={styles.closeBtn}><i className="ti ti-x" /></button>
            </div>
            <form onSubmit={handleRecordPayment} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={styles.label}>Payment Amount Paid (Rs.) *</label>
                  <input
                    type="number" className="input" placeholder="e.g. 20000" min="1"
                    value={payForm.debit_amount} onChange={e => setPayForm({ ...payForm, debit_amount: e.target.value })}
                    required autoFocus
                  />
                </div>
                <div>
                  <label style={styles.label}>Kasar Discount (کسر / Write-off)</label>
                  <input
                    type="number" className="input" placeholder="e.g. 150" min="0"
                    value={payForm.settlement_discount} onChange={e => setPayForm({ ...payForm, settlement_discount: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={styles.label}>Reference / Cheque #</label>
                <input
                  type="text" className="input" placeholder="e.g. Cash or Cheque #49102"
                  value={payForm.invoice_no} onChange={e => setPayForm({ ...payForm, invoice_no: e.target.value })}
                />
              </div>

              <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={payForm.deduct_from_drawer}
                    onChange={e => setPayForm({ ...payForm, deduct_from_drawer: e.target.checked })}
                  />
                  <span style={{ color: payForm.deduct_from_drawer ? 'var(--amber)' : 'var(--text-secondary)' }}>
                    <strong>Deduct from Active Cash Drawer Till</strong> (Books petty payout against shift float)
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowPayModal(null)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Processing…' : 'Record Payment & Kasar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL SUPPLIER LEDGER MODAL */}
      {activeLedger && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, width: 720 }} className="animate-fade">
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Supplier Bahi-Khata Ledger / کھاتہ</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {activeLedger.supplier.name} | Current Payable: <strong>Rs. {fmt(activeLedger.supplier.current_balance)}</strong>
                </span>
              </div>
              <button onClick={() => setActiveLedger(null)} style={styles.closeBtn}><i className="ti ti-x" /></button>
            </div>

            <div style={{ padding: '16px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <table style={{ ...styles.table, fontSize: 12 }}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Type / Slip #</th>
                    <th style={styles.th}>Notes</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Debit (Paid)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Credit (Bill)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Kasar (کسر)</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLedger.transactions.map(t => (
                    <tr key={t.id} style={styles.tr}>
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)' }}>
                        {new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 600 }}>{t.type}</span>
                        {t.invoice_no && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{t.invoice_no}</div>}
                        {t.bill_type === 'KATCHI_PARCHI' && (
                          <span style={{ ...styles.badge, background: 'rgba(245, 158, 11, 0.15)', color: 'var(--amber)' }}>کچی پرچی</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>{t.notes || '—'}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'var(--font-mono)', color: t.debit_amount > 0 ? 'var(--emerald)' : 'inherit' }}>
                        {t.debit_amount > 0 ? `Rs. ${fmt(t.debit_amount)}` : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'var(--font-mono)', color: t.credit_amount > 0 ? 'var(--rose)' : 'inherit' }}>
                        {t.credit_amount > 0 ? `Rs. ${fmt(t.credit_amount)}` : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'var(--font-mono)', color: t.settlement_discount > 0 ? 'var(--amber)' : 'inherit' }}>
                        {t.settlement_discount > 0 ? `Rs. ${fmt(t.settlement_discount)}` : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        Rs. {fmt(t.running_balance)}
                      </td>
                    </tr>
                  ))}
                  {!activeLedger.transactions.length && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                        No transactions found in this supplier ledger.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-md)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setActiveLedger(null)} className="btn btn-secondary btn-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '0', height: '100%', overflowY: 'auto' },
  topBar: {
    padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  statPill: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-md)',
    borderRadius: 8, padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)', fontSize: 14, pointerEvents: 'none'
  },
  tableCard: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 12, overflow: 'hidden'
  },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  thRow: { background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-md)' },
  th: { padding: '12px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' },
  td: { padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' },
  badge: {
    padding: '2px 8px', borderRadius: 4, background: 'var(--bg-hover)',
    fontSize: 11, color: 'var(--text-secondary)'
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  },
  modalCard: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 14, width: 480, maxWidth: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: '1px solid var(--border-md)'
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 18, padding: 4
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
    marginBottom: 4, textTransform: 'uppercase'
  }
}
