import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'

const NAV = [
  { to: '/',           icon: 'ti-cash-register', label: 'POS Terminal',  roles: ['admin','cashier','manager'] },
  { to: '/inventory',  icon: 'ti-packages',       label: 'Inventory',     roles: ['admin','manager'] },
  { to: '/customers',  icon: 'ti-users',          label: 'Customers',     roles: ['admin','cashier','manager'] },
  { to: '/suppliers',  icon: 'ti-truck-delivery', label: 'Suppliers',     roles: ['admin','manager'] },
  { to: '/reports',    icon: 'ti-chart-bar',      label: 'Reports',       roles: ['admin','manager'] },
  { to: '/settings',   icon: 'ti-settings',       label: 'Settings',      roles: ['admin'] },
]

export default function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Signed out')
    navigate('/login')
  }

  const navItems = NAV.filter(n => n.roles.includes(user?.role))

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <i className="ti ti-building-store" style={{ fontSize: 18, color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={styles.brandName}>SuperMart</div>
            <div style={styles.brandSub}>POS v1.0</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navActive : {}) })}
            >
              {({ isActive }) => <>
                <i className={`ti ${item.icon}`} style={{ fontSize: 18, color: isActive ? 'var(--amber)' : 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? 500 : 400 }}>
                  {item.label}
                </span>
                {isActive && <div style={styles.activeDot} />}
              </>}
            </NavLink>
          ))}
        </nav>

        <div style={styles.userSection}>
          <div style={styles.userCard}>
            <div style={styles.avatar}>{user?.name?.charAt(0)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.userName}>{user?.name}</div>
              <div style={styles.userRole}>{user?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }}>
            <i className="ti ti-logout" />
            Sign out
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        {children}
      </main>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' },
  sidebar: {
    width: 220, flexShrink: 0, background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    padding: '16px 12px',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10, background: 'var(--amber-dim)',
    border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' },
  brandSub: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
    borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s', position: 'relative',
    fontSize: 13,
  },
  navActive: { background: 'var(--bg-hover)' },
  activeDot: {
    position: 'absolute', right: 10, width: 6, height: 6, borderRadius: '50%',
    background: 'var(--amber)',
  },
  userSection: { borderTop: '1px solid var(--border)', paddingTop: 12 },
  userCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 4px 8px' },
  avatar: {
    width: 32, height: 32, borderRadius: 8, background: 'var(--amber-dim)',
    border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--amber)', fontWeight: 600, fontSize: 13, flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', fontFamily: 'var(--font-mono)' },
  main: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
}
