import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'

const NAV = [
  { label: 'Overview',      path: '/marketing',               icon: '📊' },
  { label: 'Banners',       path: '/marketing/banners',       icon: '🖼️' },
  { label: 'Announcements', path: '/marketing/announcements', icon: '📢' },
  { label: 'Email',         path: '/marketing/email',         icon: '✉️' },
  { label: 'SMS',           path: '/marketing/sms',           icon: '💬' },
  { label: 'Push',          path: '/marketing/push',          icon: '🔔' },
  { label: 'Discounts',     path: '/marketing/discounts',     icon: '🏷️' },
  { label: 'Revenue',       path: '/marketing/revenue',       icon: '💰' },
  { label: 'Funnel',        path: '/marketing/funnel',        icon: '🔽' },
  { label: 'Retention',     path: '/marketing/retention',     icon: '🔄' },
]

export default function MarketingLayout() {
  const { user } = useAuth()

  if (!user?.is_superuser && user?.role !== 'marketing') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex h-screen bg-stone-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col py-6 px-3 gap-1 shrink-0">
        <div className="px-3 mb-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Marketing</p>
        </div>
        {NAV.map(({ label, path, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/marketing'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors
               ${isActive
                 ? 'bg-amber-50 text-amber-800 font-medium'
                 : 'text-stone-600 hover:bg-stone-100'}`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
