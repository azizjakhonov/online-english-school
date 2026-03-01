import { Outlet } from 'react-router-dom'
import AnnouncementBar from '../components/marketing/AnnouncementBar'

/**
 * AppLayout — top-level wrapper for all authenticated app pages.
 * Renders the marketing AnnouncementBar above the page content.
 * Admin and Marketing sections use their own layouts (AdminLayout, MarketingLayout).
 */
export default function AppLayout() {
  return (
    <>
      <AnnouncementBar />
      <Outlet />
    </>
  )
}
