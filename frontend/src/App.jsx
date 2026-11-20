import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/Layout/Sidebar'
import Login from './pages/Login'
import POSTerminal from './components/POS/POSTerminal'
import Inventory from './components/Inventory/Inventory'
import Customers from './components/Customers/Customers'
import Suppliers from './components/Suppliers/Suppliers'
import Reports from './components/Reports/Reports'
import Settings from './components/Settings/Settings'

function ProtectedRoute({ children, roles }) {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/" element={
        <ProtectedRoute roles={['admin','cashier','manager']}>
          <POSTerminal />
        </ProtectedRoute>
      } />

      <Route path="/inventory" element={
        <ProtectedRoute roles={['admin','manager']}>
          <Inventory />
        </ProtectedRoute>
      } />

      <Route path="/customers" element={
        <ProtectedRoute roles={['admin','cashier','manager']}>
          <Customers />
        </ProtectedRoute>
      } />

      <Route path="/suppliers" element={
        <ProtectedRoute roles={['admin','manager']}>
          <Suppliers />
        </ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute roles={['admin','manager']}>
          <Reports />
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute roles={['admin']}>
          <Settings />
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
