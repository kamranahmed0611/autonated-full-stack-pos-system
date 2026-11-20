import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../../utils/api'
import { fmt, fmtShort, fmtDate, fmtDateTime, paymentLabel } from '../../utils/helpers'

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#14b8a6']

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rangeFrom, setRangeFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })
  const [rangeTo, setRangeTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [rangeData, setRangeData] = useState(null)

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const { data: d } = await api.get('/reports/dashboard')
      setData(d)
    } catch { } finally { setLoading(false) }
  }

  const loadRange = async () => {
    try {
      const { data: d } = await api.get(`/reports/range?from=${rangeFrom}&to=${rangeTo}`)
      setRangeData(d)
    } catch { }
  }

  useEffect(() => { loadRange() }, [rangeFrom, rangeTo])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <i className="ti ti-loader-2 spinner" style={{ fontSize: 32, color: 'var(--text-muted)' }} />
    </div>
  )

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, padding: '8px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ fontSize: 13, color: p.color || 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
            {p.name === 'revenue' ? fmt(p.value) : p.value}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Reports & Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Real-time business performance overview</p>
        </div>
        <button onClick={loadDashboard} className="btn btn-ghost">
          <i className="ti ti-refresh" /> Refresh
        </button>
      </div>

      {/* Today KPIs */}
      <div style={styles.kpiRow}>
        {[
          { label: "Today's Sales", value: fmt(data?.today?.revenue || 0), sub: `${data?.today?.count || 0} transactions`, icon: 'ti-coin', color: 'var(--amber)' },
          { label: 'This Week', value: fmtShort(data?.week?.revenue || 0), sub: `${data?.week?.count || 0} transactions`, icon: 'ti-calendar-week', color: 'var(--blue)' },
          { label: 'This Month', value: fmtShort(data?.month?.revenue || 0), sub: `${data?.month?.count || 0} transactions`, icon: 'ti-chart-line', color: 'var(--green)' },
          { label: 'Tax Collected', value: fmt(data?.today?.tax || 0), sub: 'Today GST', icon: 'ti-receipt-tax', color: 'var(--text-secondary)' },
          { label: 'Inventory Value', value: fmtShort(data?.inventory?.value || 0), sub: `${data?.inventory?.total} SKUs`, icon: 'ti-packages', color: 'var(--amber)' },
          { label: 'Stock Alerts', value: (data?.inventory?.out || 0) + (data?.inventory?.low || 0), sub: `${data?.inventory?.out} out · ${data?.inventory?.low} low`, icon: 'ti-alert-triangle', color: 'var(--red)' },
        ].map((k, i) => (
          <div key={i} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-label">{k.label}</div>
              <i className={`ti ${k.icon}`} style={{ color: k.color, fontSize: 16 }} />
            </div>
            <div className="stat-value" style={{ color: k.color, fontSize: 20, marginTop: 4 }}>{k.value}</div>
            <div className="stat-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={styles.chartsRow}>
        {/* Revenue Line Chart */}
        <div className="card" style={{ flex: 2 }}>
          <div style={styles.chartHeader}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Revenue — Last 30 Days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data?.dailyRevenue || []} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${Math.round(v/1000)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--amber)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Breakdown Pie */}
        <div className="card" style={{ flex: 1 }}>
          <div style={styles.chartHeader}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Today's Payment Mix</span>
          </div>
          {data?.paymentBreakdown?.length ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={data.paymentBreakdown} dataKey="total" nameKey="payment_method" cx="50%" cy="50%" outerRadius={55} innerRadius={28}>
                    {data.paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
                {data.paymentBreakdown.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{paymentLabel[p.payment_method] || p.payment_method}</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>No sales today yet</div>}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={styles.bottomRow}>
        {/* Top Products */}
        <div className="card" style={{ flex: 1 }}>
          <div style={styles.chartHeader}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Top Products Today</span>
          </div>
          {data?.topProducts?.length ? (
            <table className="table">
              <thead><tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={i}>
                    <td><span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>#{i+1}</span></td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="ti ti-package" style={{ color: 'var(--amber)', fontSize: 13 }} />
                        {p.name}
                      </span>
                    </td>
                    <td><span className="mono">{p.units}</span></td>
                    <td><span className="mono fw-500" style={{ color: 'var(--amber)' }}>{fmt(p.revenue)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>No sales today</div>}
        </div>

        {/* Recent Transactions */}
        <div className="card" style={{ flex: 2 }}>
          <div style={styles.chartHeader}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Recent Transactions</span>
          </div>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>
              {(data?.recentTxns || []).map(t => (
                <tr key={t.id}>
                  <td><span className="mono text-xs" style={{ color: 'var(--amber)' }}>{t.invoice_no}</span></td>
                  <td>{t.customer || 'Walk-in'}</td>
                  <td><span className="badge badge-blue" style={{ fontSize: 10 }}>{paymentLabel[t.payment_method]}</span></td>
                  <td><span className="mono fw-500">{fmt(t.grand_total)}</span></td>
                  <td>
                    <span className={`badge ${t.payment_status === 'void' ? 'badge-red' : 'badge-green'}`} style={{ fontSize: 10 }}>
                      {t.payment_status}
                    </span>
                  </td>
                  <td><span className="text-xs text-muted">{fmtDateTime(t.created_at)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Date Range Report */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Custom Date Range Report</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="date" className="input" style={{ width: 140 }} value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input type="date" className="input" style={{ width: 140 }} value={rangeTo} onChange={e => setRangeTo(e.target.value)} />
          </div>
        </div>
        {rangeData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              ['Transactions', rangeData.summary.txns, 'mono'],
              ['Revenue', fmt(rangeData.summary.revenue), 'amber'],
              ['Tax', fmt(rangeData.summary.tax), ''],
              ['Discount Given', fmt(rangeData.summary.discount), 'red'],
              ['Avg Bill', fmt(rangeData.summary.avg_bill), 'green'],
            ].map(([l, v, c], i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{l}</div>
                <div style={{ fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 600, color: c === 'amber' ? 'var(--amber)' : c === 'green' ? 'var(--green)' : c === 'red' ? 'var(--red)' : 'var(--text-primary)' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {rangeData?.byDay?.length > 0 && (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={rangeData.byDay} margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${Math.round(v/1000)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="var(--amber)" radius={[3,3,0,0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10 },
  chartsRow: { display: 'flex', gap: 12 },
  chartHeader: { marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bottomRow: { display: 'flex', gap: 12 },
}
