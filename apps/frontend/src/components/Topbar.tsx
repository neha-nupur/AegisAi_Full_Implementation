import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Building2, LogOut, ChevronDown, House, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Overview',
  '/ai-requests': 'AI Requests',
  '/privacy': 'Privacy Scanner',
  '/policies': 'Policies',
  '/approvals': 'Approvals',
  '/models': 'Models',
  '/providers': 'Providers',
  '/users': 'Users',
  '/service-accounts': 'Service Accounts',
  '/security-events': 'Security Events',
  '/audit-log': 'Audit Log',
  '/traces': 'Request Traces',
  '/legacy': 'Legacy Integration',
  '/settings': 'Settings',
};

function getTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Prefix match
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key + '/')) return title;
  }
  return 'AegisAI';
}

function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'ORGANIZATION_ADMIN': return 'badge badge-blue';
    case 'SECURITY_AUDITOR': return 'badge badge-purple';
    case 'DEVELOPER': return 'badge badge-success';
    default: return 'badge badge-neutral';
  }
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getInitials(email?: string, role?: string): string {
  if (email) {
    const parts = email.split('@')[0].split(/[._-]/);
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || email[0].toUpperCase();
  }
  if (role) return role[0].toUpperCase();
  return 'U';
}

export function Topbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const title = getTitle(location.pathname);

  const handleLogout = () => {
    navigate('/');
    logout();
  };

  return (
    <header className="topbar" role="banner">
      <div className="topbar-left">
        <h1 className="page-title">{title}</h1>
      </div>

      <div className="topbar-right">
        <Link to="/" className="btn btn-secondary btn-sm" title="Visit AegisAI landing page">
          <House size={14} />
          Visit Home
        </Link>

        {user && (
          <div className="topbar-org" title={`Organization: ${user.organizationId}`}>
            <Building2 size={13} />
            <span style={{ fontSize: '0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.organizationId.slice(0, 8)}…
            </span>
          </div>
        )}

        <button className="btn-icon" aria-label="Notifications">
          <Bell size={16} />
        </button>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="topbar-user" title={user.email}>
              <div className="avatar" aria-hidden="true">
                {getInitials(user.email, user.role)}
              </div>
              <div className="user-info">
                <span className="user-name">{user.email ?? user.userId.slice(0, 8)}</span>
                <span className={getRoleBadgeClass(user.role)}>{formatRole(user.role)}</span>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            </div>

            <button
              className="btn-icon"
              onClick={async () => {
                const newPassword = prompt("Enter new password:");
                if (newPassword) {
                  try {
                    await api.patch('/users/me/password', { password: newPassword });
                    alert("Password successfully updated.");
                  } catch (err) {
                    alert("Failed to update password.");
                  }
                }
              }}
              aria-label="Change Password"
              title="Change Password"
            >
              <Key size={16} />
            </button>
            <button
              className="btn-icon"
              onClick={handleLogout}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
