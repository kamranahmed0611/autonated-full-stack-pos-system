import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../../utils/api'

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [tab, setTab] = useState('store')
  const [saving, setSaving] = useState(false)
  const [userModal, setUserModal] = useState(null)
  const [catModal, setCatModal] = useState(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [s, u, c] = await Promise.all([
        api.get('/settings'), api.get('/users'), api.get('/categories')
      ])
      setSettings(s.data)
      setUsers(u.data)
      setCategories(c.data)
    } catch { toast.error('Failed to load settings') }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.put('/settings', settings)
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const TABS = [
    { id: 'store', label: 'Store Info', icon: 'ti-building-store' },
    { id: 'users', label: 'Users', icon: 'ti-users' },
    { id: 'categories', label: 'Categories', icon: 'ti-tags' },
  ]

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)' }}>Settings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Manage your store configuration</p>
        </div>
      </div>

      <div style={styles.shell}>
        <div style={styles.tabNav}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}>
              <i className={`ti ${t.icon}`} style={{ fontSize: 16 }} />
              {t.label}
            </button>
          ))}
        </div>

        <div style={styles.content}>
          {tab === 'store' && (
            <div style={styles.form}>
              <h3 style={styles.sectionTitle}>Store Information</h3>
              {[
                ['store_name', 'Store Name', 'text'],
                ['store_address', 'Address', 'text'],
                ['store_phone', 'Phone Number', 'tel'],
                ['whatsapp_number', 'WhatsApp Notification Number', 'tel'],
                ['store_email', 'Email', 'email'],
                ['currency', 'Currency Symbol', 'text'],
                ['tax_label', 'Tax Label (e.g. GST)', 'text'],
                ['default_tax_rate', 'Default Tax Rate %', 'number'],
                ['cash_rounding_nearest', 'Cash Rounding Nearest (e.g. 5 for PKR)', 'number'],
              ].map(([key, label, type]) => (
                <div key={key} style={styles.field}>
                  <label style={styles.fieldLabel}>{label}</label>
                  <input className="input" type={type}
                    value={settings[key] || ''}
                    onChange={e => setSettings(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Master Tax Switch</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                  <input
                    type="checkbox"
                    checked={settings.tax_enabled === '1' || settings.tax_enabled === 1}
                    onChange={e => setSettings(p => ({ ...p, tax_enabled: e.target.checked ? '1' : '0' }))}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {settings.tax_enabled === '1' || settings.tax_enabled === 1 ? 'Tax Enabled on Checkout' : 'Tax Disabled (0% applied)'}
                  </span>
                </label>
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Receipt Footer Message</label>
                <textarea className="input" rows={3}
                  value={settings.receipt_footer || ''}
                  onChange={e => setSettings(p => ({ ...p, receipt_footer: e.target.value }))}
                  style={{ resize: 'none' }} />
              </div>
              <div style={styles.field}>
                <label style={styles.fieldLabel}>Low Stock Alert Threshold</label>
                <input className="input" type="number" style={{ maxWidth: 120 }}
                  value={settings.low_stock_threshold || 5}
                  onChange={e => setSettings(p => ({ ...p, low_stock_threshold: e.target.value }))} />
              </div>
              <button onClick={saveSettings} className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                {saving ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-device-floppy" />}
                Save Settings
              </button>
            </div>
          )}

          {tab === 'users' && (
            <div style={styles.form}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={styles.sectionTitle}>Users & Access</h3>
                <button onClick={() => setUserModal({})} className="btn btn-primary btn-sm">
                  <i className="ti ti-plus" /> Add User
                </button>
              </div>
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)', fontWeight: 600, fontSize: 12 }}>
                            {u.name.charAt(0)}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td><span className="text-sm text-muted">{u.email}</span></td>
                      <td><span className="badge badge-blue" style={{ textTransform: 'capitalize', fontSize: 10 }}>{u.role}</span></td>
                      <td><span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>{u.active ? 'Active' : 'Disabled'}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setUserModal(u)}>
                          <i className="ti ti-edit" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'categories' && (
            <div style={styles.form}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={styles.sectionTitle}>Product Categories</h3>
                <button onClick={() => setCatModal({})} className="btn btn-primary btn-sm">
                  <i className="ti ti-plus" /> Add Category
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {categories.map(c => (
                  <div key={c.id} style={{ ...styles.catCard, borderColor: c.color + '40' }}
                    onClick={() => setCatModal(c)}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: (c.color || '#f59e0b') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="ti ti-tag" style={{ color: c.color || '#f59e0b', fontSize: 14 }} />
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                    <span className="badge" style={{ background: c.color + '20', color: c.color, fontSize: 10 }}>Edit</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {userModal !== null && <UserModal user={userModal} onClose={() => setUserModal(null)} onSave={() => { setUserModal(null); loadAll() }} />}
      {catModal !== null && <CatModal cat={catModal} onClose={() => setCatModal(null)} onSave={() => { setCatModal(null); loadAll() }} />}
    </div>
  )
}

function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user?.id
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', password: '', role: user?.role || 'cashier', active: user?.active ?? 1 })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit) await api.put(`/users/${user.id}`, { name: form.name, role: form.role, active: form.active })
      else await api.post('/users', form)
      toast.success(isEdit ? 'User updated!' : 'User added!')
      onSave()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle} className="animate-fade">
        <div style={modalHeader}>
          <h3 style={{ fontFamily: 'var(--font-display)' }}>{isEdit ? 'Edit User' : 'Add User'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['Name', 'name','text'],['Email','email','email'],...(!isEdit?[['Password','password','password']]:[])]
            .map(([l,k,t]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{l}</label>
                <input className="input" type={t} value={form[k]} onChange={e => f(k, e.target.value)} disabled={isEdit && k === 'email'} />
              </div>
            ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Role</label>
            <select className="input" value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {isEdit && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active === 1} onChange={e => f('active', e.target.checked ? 1 : 0)} />
              <span style={{ fontSize: 13 }}>Account Active</span>
            </label>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
            {saving ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-check" />}Save
          </button>
        </div>
      </div>
    </div>
  )
}

function CatModal({ cat, onClose, onSave }) {
  const isEdit = !!cat?.id
  const [form, setForm] = useState({ name: cat?.name || '', icon: cat?.icon || '', color: cat?.color || '#f59e0b' })
  const [saving, setSaving] = useState(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit) await api.put(`/categories/${cat.id}`, form)
      else await api.post('/categories', form)
      toast.success('Saved!')
      onSave()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalStyle, maxWidth: 340 }} className="animate-fade">
        <div style={modalHeader}>
          <h3 style={{ fontFamily: 'var(--font-display)' }}>{isEdit ? 'Edit Category' : 'Add Category'}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon"><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Category Name</label>
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Beverages" required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.color} onChange={e => f('color', e.target.value)} style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }} />
              <input className="input mono" value={form.color} onChange={e => f('color', e.target.value)} style={{ maxWidth: 110 }} />
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
            {saving ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-check" />}Save
          </button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const modalStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-md)', borderRadius: 16, width: '90%', maxWidth: 420, boxShadow: 'var(--shadow-lg)' }
const modalHeader = { padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

const styles = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 20, gap: 16 },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  shell: { flex: 1, display: 'flex', gap: 16, overflow: 'hidden' },
  tabNav: { width: 180, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13, textAlign: 'left' },
  tabBtnActive: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontWeight: 500 },
  content: { flex: 1, overflow: 'auto', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)' },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' },
  catCard: { padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'background 0.15s' },
}
