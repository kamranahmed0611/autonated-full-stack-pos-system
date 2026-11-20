import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useShiftStore, useAuthStore } from '../../store'
import { fmt } from '../../utils/helpers'

const DENOMINATIONS = [
  { value: 5000, label: 'Rs. 5,000 Notes', color: '#1E3A8A' },
  { value: 1000, label: 'Rs. 1,000 Notes', color: '#047857' },
  { value: 500,  label: 'Rs. 500 Notes',   color: '#B45309' },
  { value: 100,  label: 'Rs. 100 Notes',   color: '#DC2626' },
  { value: 50,   label: 'Rs. 50 Notes',    color: '#7C3AED' },
  { value: 20,   label: 'Rs. 20 Notes',    color: '#C2410C' },
  { value: 10,   label: 'Rs. 10 Notes',    color: '#475569' },
]

const VARIANCE_REASONS = [
  { id: 'UNRECORDED_EXPENSE', label: 'Unrecorded Expense (Shop tea/milk/ice payout)' },
  { id: 'CUSTOMER_SHORT_CHANGE', label: 'Customer Short Change / Overpayment during rush' },
  { id: 'WRONG_DENOMINATION_COUNT', label: 'Wrong denomination / physical count error' },
  { id: 'SYSTEM_CALCULATION_DISCREPANCY', label: 'System calculation discrepancy / Audit requested' }
]

export default function BlindShiftModal({ isOpen, onClose, onShiftClosed }) {
  const { activeShift, openShift, closeShiftBlind } = useShiftStore()
  const { user } = useAuthStore()

  // Open Shift Form State
  const [openingFloat, setOpeningFloat] = useState(5000)

  // Blind Close Note Counter State
  const [counts, setCounts] = useState({
    5000: '',
    1000: '',
    500: '',
    100: '',
    50: '',
    20: '',
    10: '',
    coins: ''
  })

  // Verification & Audit State
  const [stage, setStage] = useState('count') // 'count' | 'admin_pin' | 'audit_result'
  const [adminPin, setAdminPin] = useState('')
  const [varianceReason, setVarianceReason] = useState('')
  const [varianceNote, setVarianceNote] = useState('')
  const [auditResult, setAuditResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Compute live physical total
  const countedTotal = useMemo(() => {
    let total = 0
    DENOMINATIONS.forEach(d => {
      const c = parseInt(counts[d.value], 10) || 0
      total += c * d.value
    })
    total += parseFloat(counts.coins) || 0
    return total
  }, [counts])

  if (!isOpen) return null

  // 1. OPEN SHIFT SCREEN
  if (!activeShift) {
    const handleOpenShift = async (e) => {
      e.preventDefault()
      try {
        setSubmitting(true)
        await openShift(openingFloat)
        toast.success(`Shift opened with Rs. ${fmt(openingFloat)} opening float!`)
        onClose()
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to open shift')
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div style={modalStyles.overlay}>
        <div style={modalStyles.card} className="animate-fade">
          <div style={modalStyles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="ti ti-clock-play" style={{ fontSize: 24, color: 'var(--amber)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>Open Cashier Shift</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Start trading session for {user?.name}</p>
              </div>
            </div>
            <button onClick={onClose} style={modalStyles.closeBtn}><i className="ti ti-x" /></button>
          </div>

          <form onSubmit={handleOpenShift} style={{ padding: '20px 24px' }}>
            <div style={{ marginBottom: 20 }}>
              <label style={modalStyles.fieldLabel}>Opening Cash Float in Drawer (روپے / Float)</label>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--amber)', fontWeight: 'bold' }}>Rs.</span>
                <input
                  type="number"
                  className="input"
                  style={{ paddingLeft: 44, fontSize: 18, fontFamily: 'var(--font-mono)' }}
                  value={openingFloat}
                  onChange={e => setOpeningFloat(e.target.value)}
                  min="0"
                  step="50"
                  required
                  autoFocus
                />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Count initial notes in till (standard starting drawer float is Rs. 5,000).
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Opening…' : 'Open Shift & Start Billing'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // 2. BLIND SHIFT CLOSE: STAGE 1 (NOTE DENOMINATION COUNT)
  if (stage === 'count') {
    const handleCountSubmit = (e) => {
      e.preventDefault()
      if (countedTotal <= 0) {
        toast.error('Counted physical cash cannot be zero')
        return
      }
      // Transition to Admin Authorization Gate
      setStage('admin_pin')
    }

    return (
      <div style={modalStyles.overlay}>
        <div style={{ ...modalStyles.card, width: 560 }} className="animate-fade">
          <div style={modalStyles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="ti ti-lock-check" style={{ fontSize: 24, color: 'var(--amber)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>Blind Shift Close Protocol</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Cashier: {activeShift.cashier_name} | Opened: {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={modalStyles.closeBtn}><i className="ti ti-x" /></button>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 16px', borderBottom: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-shield-alert" style={{ color: 'var(--amber)', fontSize: 18 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>Blind Protocol Active:</strong> System expected cash is hidden. Enter physical counts of currency notes currently inside the till.
            </span>
          </div>

          <form onSubmit={handleCountSubmit} style={{ padding: '16px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {DENOMINATIONS.map(d => {
                const countVal = counts[d.value]
                const lineTotal = (parseInt(countVal, 10) || 0) * d.value
                return (
                  <div key={d.value} style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: d.color }}>{d.label}</span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>= Rs. {fmt(lineTotal)}</span>
                    </div>
                    <input
                      type="number"
                      className="input input-sm"
                      style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                      placeholder="Count"
                      min="0"
                      value={counts[d.value]}
                      onChange={e => setCounts({ ...counts, [d.value]: e.target.value })}
                    />
                  </div>
                )
              })}

              <div style={{ background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Loose Coins (سکے)</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Rupees</span>
                </div>
                <input
                  type="number"
                  className="input input-sm"
                  style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                  placeholder="Rs. Amount"
                  min="0"
                  value={counts.coins}
                  onChange={e => setCounts({ ...counts, coins: e.target.value })}
                />
              </div>
            </div>

            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>GRAND PHYSICAL COUNT:</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>
                Rs. {fmt(countedTotal)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary">
                Proceed to Admin Verification <i className="ti ti-arrow-right" />
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // 3. BLIND SHIFT CLOSE: STAGE 2 (ADMIN PIN GATE & VARIANCE CHECK)
  if (stage === 'admin_pin') {
    const handleAdminSubmit = async (e) => {
      e.preventDefault()
      if (!adminPin) {
        toast.error('Admin PIN is required')
        return
      }

      setSubmitting(true)
      try {
        const payload = {
          shift_id: activeShift.id,
          closing_denominations: counts,
          counted_cash: countedTotal,
          variance_reason: varianceReason,
          variance_note: varianceNote,
          admin_pin: adminPin
        }
        const res = await closeShiftBlind(payload)
        setAuditResult(res)
        setStage('audit_result')
        toast.success('Shift closed and reconciled!')
        if (onShiftClosed) onShiftClosed(res)
      } catch (err) {
        const errorData = err.response?.data
        if (errorData?.requiresReason) {
          toast.error(errorData.error)
        } else {
          toast.error(errorData?.error || 'Verification failed')
        }
      } finally {
        setSubmitting(false)
      }
    }

    return (
      <div style={modalStyles.overlay}>
        <div style={{ ...modalStyles.card, width: 440 }} className="animate-fade">
          <div style={modalStyles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="ti ti-shield-lock" style={{ fontSize: 24, color: 'var(--amber)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>Admin Authorization Gate</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Enter Master Admin PIN to finalize shift</p>
              </div>
            </div>
            <button onClick={() => setStage('count')} style={modalStyles.closeBtn}><i className="ti ti-arrow-left" /></button>
          </div>

          <form onSubmit={handleAdminSubmit} style={{ padding: '20px 24px' }}>
            <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cashier Counted Total:</span>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>
                Rs. {fmt(countedTotal)}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={modalStyles.fieldLabel}>Admin Master PIN (Default: 8888)</label>
              <input
                type="password"
                className="input"
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: 22, marginTop: 6 }}
                placeholder="••••"
                maxLength="6"
                value={adminPin}
                onChange={e => setAdminPin(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={modalStyles.fieldLabel}>Variance Justification Tag (Mandatory if &gt; Rs. 50 discrepancy)</label>
              <select
                className="input input-sm"
                style={{ marginTop: 6 }}
                value={varianceReason}
                onChange={e => setVarianceReason(e.target.value)}
              >
                <option value="">-- Select Reason if Short/Over --</option>
                {VARIANCE_REASONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={modalStyles.fieldLabel}>Forensic Auditor Note</label>
              <textarea
                className="input input-sm"
                rows={2}
                placeholder="Optional notes or explanations..."
                value={varianceNote}
                onChange={e => setVarianceNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setStage('count')} className="btn btn-ghost">Back to Count</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Authorize & Reveal Audit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // 4. BLIND SHIFT CLOSE: STAGE 3 (REVEAL AUDIT & Z-REPORT)
  if (stage === 'audit_result' && auditResult) {
    const rec = auditResult.reconciliation
    const isBalanced = rec.variance === 0
    const isSurplus = rec.variance > 0
    const isShortage = rec.variance < 0

    return (
      <div style={modalStyles.overlay}>
        <div style={{ ...modalStyles.card, width: 500 }} className="animate-fade">
          <div style={modalStyles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="ti ti-receipt-tax" style={{ fontSize: 24, color: 'var(--amber)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)' }}>Shift Z-Report & Audit Summary</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Status: Shift Finalized &amp; Closed</p>
              </div>
            </div>
            <button onClick={onClose} style={modalStyles.closeBtn}><i className="ti ti-x" /></button>
          </div>

          <div style={{ padding: '20px 24px' }}>
            <div style={{
              background: isBalanced ? 'rgba(16, 185, 129, 0.1)' : isSurplus ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${isBalanced ? 'var(--emerald)' : isSurplus ? '#3B82F6' : 'var(--rose)'}`,
              borderRadius: 12, padding: '14px 18px', marginBottom: 16, textAlign: 'center'
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>AUDIT VARIANCE RESULT</div>
              <div style={{
                fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color: isBalanced ? 'var(--emerald)' : isSurplus ? '#3B82F6' : 'var(--rose)',
                marginTop: 4
              }}>
                {isBalanced ? 'PERFECTLY BALANCED (Rs. 0)' : `${isSurplus ? 'SURPLUS' : 'SHORTAGE'}: Rs. ${fmt(rec.variance)}`}
              </div>
              <p style={{ fontSize: 12, margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                {isBalanced ? 'Physical cash matches expected register drawer balance.' : isSurplus ? 'Drawer contains surplus unrecorded cash.' : 'Cashier drawer is short physical cash.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
              <div style={modalStyles.reportRow}>
                <span style={{ color: 'var(--text-muted)' }}>Opening Till Float:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {fmt(rec.opening_float)}</span>
              </div>
              <div style={modalStyles.reportRow}>
                <span style={{ color: 'var(--text-muted)' }}>Total Cash Sales:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--emerald)' }}>+Rs. {fmt(rec.cash_sales)}</span>
              </div>
              <div style={modalStyles.reportRow}>
                <span style={{ color: 'var(--text-muted)' }}>Petty Expenses / Drawer Payouts:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--rose)' }}>-Rs. {fmt(rec.petty_expenses)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border-md)', margin: '4px 0' }} />
              <div style={modalStyles.reportRow}>
                <span style={{ fontWeight: 600 }}>System Expected Cash:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--amber)' }}>Rs. {fmt(rec.expected_cash)}</span>
              </div>
              <div style={modalStyles.reportRow}>
                <span style={{ fontWeight: 600 }}>Cashier Physical Count:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Rs. {fmt(rec.actual_counted)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border-md)', margin: '4px 0' }} />
              <div style={modalStyles.reportRow}>
                <span style={{ color: 'var(--text-muted)' }}>Digital / Card / QR Sales:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {fmt(rec.digital_sales)}</span>
              </div>
              <div style={modalStyles.reportRow}>
                <span style={{ color: 'var(--text-muted)' }}>Customer Khata (Credit) Sales:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {fmt(rec.khata_sales)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => window.print()} className="btn btn-secondary">
                <i className="ti ti-printer" /> Print Z-Report
              </button>
              <button onClick={onClose} className="btn btn-primary">
                Done &amp; Close Modal
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16
  },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 16, width: 480, maxWidth: '100%',
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
  },
  reportRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  }
}
