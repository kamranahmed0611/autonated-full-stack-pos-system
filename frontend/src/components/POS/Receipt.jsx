import { fmt, fmtDateTime, paymentLabel } from '../../utils/helpers'

export default function Receipt({ txn, onClose }) {
  const handlePrint = () => window.print()

  const isCash = txn.payment_method === 'cash'
  const isKhata = ['credit', 'khata'].includes(txn.payment_method)

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal} className="animate-fade">
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-receipt" style={{ color: 'var(--amber)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Sales Slip (80mm)</span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon">
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Receipt Paper */}
        <div style={styles.paper} id="receipt-print">
          <div style={styles.storeName}>{txn.store?.store_name || 'MR Super Store'}</div>
          <div style={styles.storeSub}>{txn.store?.store_address || 'Allah Wali Market, Street 33, F-8/1, Islamabad'}</div>
          <div style={styles.storeSub}>Ph: {txn.store?.store_phone || '+92 306 5157506'}</div>
          <div style={styles.divider} />
          <div style={styles.metaRow}><span>Invoice:</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>#{txn.invoice_no}</span></div>
          <div style={styles.metaRow}><span>Date:</span><span>{fmtDateTime(txn.created_at)}</span></div>
          <div style={styles.metaRow}><span>Cashier:</span><span>{txn.cashier_name || 'Cashier #01'}</span></div>
          {txn.customer_name && (
            <div style={styles.metaRow}>
              <span>Customer:</span>
              <span style={{ fontWeight: 600 }}>{txn.customer_name}</span>
            </div>
          )}
          <div style={styles.divider} />

          {/* Items */}
          <div style={styles.itemsHeader}>
            <span style={{ flex: 1 }}>ITEM</span>
            <span style={{ width: 44, textAlign: 'center' }}>QTY</span>
            <span style={{ width: 65, textAlign: 'right' }}>PRICE</span>
            <span style={{ width: 75, textAlign: 'right' }}>TOTAL</span>
          </div>
          {txn.items?.map((item, i) => (
            <div key={i} style={styles.itemRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.product_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Unit: {item.unit_type || 'pcs'} {item.is_loose ? '(Loose Commodity)' : ''}
                </div>
              </div>
              <div style={{ width: 44, textAlign: 'center', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{item.qty}</div>
              <div style={{ width: 65, textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{fmt(item.price)}</div>
              <div style={{ width: 75, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt(item.line_total)}</div>
            </div>
          ))}

          <div style={styles.divider} />
          <TotLine label="SUBTOTAL" value={`Rs. ${fmt(txn.subtotal)}`} />
          {txn.discount_amt > 0 && <TotLine label="DISCOUNT" value={`- Rs. ${fmt(txn.discount_amt)}`} green />}
          {txn.tax_amt > 0 && <TotLine label="TAX (GST)" value={`+ Rs. ${fmt(txn.tax_amt)}`} />}

          {txn.round_off_amount !== 0 && (
            <TotLine
              label="ROUND OFF (NEAREST 5)"
              value={`${txn.round_off_amount > 0 ? '+' : ''} Rs. ${txn.round_off_amount}`}
              highlight
            />
          )}

          <div style={styles.grandLine}>
            <span>NET PAYABLE</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18 }}>Rs. {fmt(txn.grand_total)}</span>
          </div>
          <div style={styles.divider} />

          <TotLine label="Payment Method" value={(paymentLabel[txn.payment_method] || txn.payment_method).toUpperCase()} />

          {isCash && txn.paid_amount > 0 && (
            <>
              <TotLine label="Cash Tendered" value={`Rs. ${fmt(txn.paid_amount)}`} />
              <TotLine label="Change Returned" value={`Rs. ${fmt(txn.change_due || 0)}`} green />
            </>
          )}

          {isKhata && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '6px 8px', margin: '4px 0' }}>
              <TotLine label="Account Ledger" value="Bahi-Khata (Udhaar)" />
              {txn.customer_current_balance !== undefined && (
                <TotLine label="Net Account Balance" value={`Rs. ${fmt(txn.customer_current_balance)}`} highlight />
              )}
            </div>
          )}

          <div style={styles.divider} />
          <div style={{ ...styles.footer, whiteSpace: 'pre-line' }}>
            {txn.store?.receipt_footer || 'Thank you for shopping!\nتبدیلی کے لیے بل ساتھ لانا لازمی ہے۔'}
          </div>
          <div style={{ ...styles.footer, marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            *** #{txn.invoice_no} ***
          </div>
        </div>

        <div style={styles.actions}>
          <button onClick={handlePrint} className="btn btn-secondary" style={{ flex: 1 }}>
            <i className="ti ti-printer" /> Print (80mm)
          </button>
          <button onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>
            <i className="ti ti-plus" /> New Sale
          </button>
        </div>
      </div>
    </div>
  )
}

function TotLine({ label, value, green, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: highlight ? 'var(--amber)' : 'var(--text-muted)' }}>{label}</span>
      <span style={{
        fontSize: 12,
        color: green ? 'var(--emerald)' : highlight ? 'var(--amber)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontWeight: highlight ? 700 : 400
      }}>
        {value}
      </span>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 16, width: 360, maxHeight: '90vh', display: 'flex',
    flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden',
  },
  header: {
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  paper: {
    flex: 1, overflowY: 'auto', padding: '16px 20px',
    background: 'var(--bg-surface)', color: 'var(--text-primary)',
  },
  storeName: { fontSize: 16, fontWeight: 800, textAlign: 'center', fontFamily: 'var(--font-display)', letterSpacing: '0.04em' },
  storeSub: { fontSize: 11, textAlign: 'center', color: 'var(--text-muted)', marginTop: 1 },
  divider: { height: 1, borderTop: '1px dashed var(--border-md)', margin: '10px 0' },
  metaRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3, color: 'var(--text-secondary)' },
  itemsHeader: { display: 'flex', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' },
  itemRow: { display: 'flex', alignItems: 'flex-start', marginBottom: 8 },
  grandLine: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', fontWeight: 800, fontSize: 14, color: 'var(--amber)'
  },
  footer: { textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 },
  actions: { padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }
}
