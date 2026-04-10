import { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, User } from 'lucide-react';
import api from '../lib/api';

interface ImpersonatedUser {
    id: number;
    name: string;
    phone: string;
    role: string;
}

/**
 * Global impersonation banner.
 *
 * Shown whenever localStorage contains 'impersonation_active'.
 * The admin flow (triggered from Django admin) does:
 *   1. Calls POST /api/admin/impersonate/<user_id>/
 *   2. Saves current access token → localStorage.admin_original_token
 *   3. Saves impersonated user info → localStorage.impersonated_user (JSON)
 *   4. Replaces stored access token with the returned one
 *   5. Sets localStorage.impersonation_active = '1'
 *   6. Redirects to /dashboard
 */
export default function ImpersonationBanner() {
    const [impersonated, setImpersonated] = useState<ImpersonatedUser | null>(null);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const check = () => {
            const active = localStorage.getItem('impersonation_active');
            const raw = localStorage.getItem('impersonated_user');
            if (active && raw) {
                try { setImpersonated(JSON.parse(raw)); } catch { setImpersonated(null); }
            } else {
                setImpersonated(null);
            }
        };

        // Check on mount and when storage changes (handles cross-tab)
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, []);

    const handleExit = async () => {
        setExiting(true);
        try {
            // Notify backend (best-effort — audit log)
            await api.post('/api/admin/impersonate/exit/').catch(() => { });

            // Restore original admin token
            const originalToken = localStorage.getItem('admin_original_token');
            const originalRefresh = localStorage.getItem('admin_original_refresh');

            if (originalToken) {
                localStorage.setItem('access_token', originalToken);
            }
            if (originalRefresh) {
                localStorage.setItem('refresh_token', originalRefresh);
            }

            // Clear impersonation state
            localStorage.removeItem('impersonation_active');
            localStorage.removeItem('impersonated_user');
            localStorage.removeItem('admin_original_token');
            localStorage.removeItem('admin_original_refresh');

            // Redirect to admin panel
            window.location.href = '/admin/';
        } catch {
            setExiting(false);
        }
    };

    if (!impersonated) return null;

    const roleLabel = impersonated.role === 'STUDENT' ? 'Student' : impersonated.role === 'TEACHER' ? 'Teacher' : impersonated.role;

    return (
        <div
            style={{ zIndex: 99999 }}
            className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg"
        >
            {/* Left: Info */}
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg shrink-0">
                    <ShieldAlert size={16} />
                </div>
                <div className="leading-tight">
                    <span className="font-black text-sm">Admin Impersonation Active</span>
                    <span className="ml-2 text-sm text-white/80">
                        Viewing as{' '}
                        <span className="font-bold text-white">
                            {impersonated.name}
                        </span>{' '}
                        <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded font-semibold">
                            {roleLabel}
                        </span>
                    </span>
                </div>
            </div>

            {/* Center: phone */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/70 font-mono">
                <User size={12} />
                {impersonated.phone}
            </div>

            {/* Right: Exit */}
            <button
                onClick={handleExit}
                disabled={exiting}
                className="flex items-center gap-2 px-3 py-1.5 bg-white text-rose-600 font-black text-xs rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50 shrink-0"
            >
                <LogOut size={13} />
                {exiting ? 'Exiting…' : 'Exit Impersonation'}
            </button>
        </div>
    );
}
