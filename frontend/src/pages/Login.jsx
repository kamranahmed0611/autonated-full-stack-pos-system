import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { useAuthStore } from '../store'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      login(data.user, data.token)
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.glow} />
      <div style={styles.card} className="animate-fade">
        <div style={styles.logo}>
          <i className="ti ti-building-store" style={{ fontSize: 32, color: 'var(--amber)' }} />
        </div>
        <h1 style={styles.title}>SuperMart POS</h1>
        <p style={styles.sub}>Sign in to your terminal</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <div style={styles.inputWrap}>
              <i className="ti ti-mail" style={styles.icon} />
              <input
                className="input"
                style={{ paddingLeft: 36 }}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@supermart.pk"
                required
                autoFocus
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <i className="ti ti-lock" style={styles.icon} />
              <input
                className="input"
                style={{ paddingLeft: 36, paddingRight: 36 }}
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button type="button" style={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                <i className={`ti ti-eye${showPass ? '-off' : ''}`} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            style={{ marginTop: 8, fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}
          >
            {loading ? <i className="ti ti-loader-2 spinner" /> : <i className="ti ti-login" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={styles.hints}>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>Demo credentials</p>
          {[
            ['admin@supermart.pk', 'admin123', 'Admin'],
            ['ali@supermart.pk', 'cashier123', 'Cashier'],
          ].map(([e, p, role]) => (
            <div key={e} style={styles.hintRow} onClick={() => { setEmail(e); setPassword(p) }}>
              <span style={{ color: 'var(--amber)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>{role}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{e}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
  },
  glow: {
    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
    top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none',
  },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border-md)',
    borderRadius: 16, padding: '36px 32px', width: 380, position: 'relative',
    boxShadow: 'var(--shadow-lg)',
  },
  logo: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  title: { textAlign: 'center', fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: 4 },
  sub: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' },
  inputWrap: { position: 'relative' },
  icon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16, pointerEvents: 'none' },
  eyeBtn: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 2 },
  hints: { marginTop: 28, padding: '16px', background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6 },
  hintRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: 'var(--bg-hover)', transition: 'background 0.1s' },
}
