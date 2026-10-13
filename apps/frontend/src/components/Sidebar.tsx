import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Shield,
  FileText,
  CheckSquare,
  Cpu,
  Server,
  Users,
  KeyRound,
  BookOpen,
  GitBranch,
  Plug,
  Settings,
  ShieldAlert,
} from 'lucide-react';

interface NavItemDef {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface SectionDef {
  section?: string;
  items: NavItemDef[];
}

const NAV_SECTIONS: SectionDef[] = [
  {
    items: [
      { label: 'Overview', to: '/dashboard', icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    section: 'Gateway',
    items: [
      { label: 'AI Requests', to: '/ai-requests', icon: <Zap size={16} /> },
      { label: 'Privacy Scanner', to: '/privacy', icon: <Shield size={16} /> },
    ],
  },
  {
    section: 'Governance',
    items: [
      { label: 'Policies', to: '/policies', icon: <FileText size={16} /> },
      { label: 'Approvals', to: '/approvals', icon: <CheckSquare size={16} /> },
    ],
  },
  {
    section: 'Infrastructure',
    items: [
      { label: 'Models', to: '/models', icon: <Cpu size={16} /> },
      { label: 'Providers', to: '/providers', icon: <Server size={16} /> },
    ],
  },
  {
    section: 'Identity',
    items: [
      { label: 'Users', to: '/users', icon: <Users size={16} /> },
      { label: 'Service Accounts', to: '/service-accounts', icon: <KeyRound size={16} /> },
    ],
  },
  {
    section: 'Security & Audit',
    items: [
      { label: 'Security Events', to: '/security-events', icon: <ShieldAlert size={16} /> },
      { label: 'Audit Log', to: '/audit-log', icon: <BookOpen size={16} /> },
      { label: 'Request Traces', to: '/traces', icon: <GitBranch size={16} /> },
    ],
  },
  {
    section: 'Integrations',
    items: [
      { label: 'Legacy Integration', to: '/legacy', icon: <Plug size={16} /> },
    ],
  },
  {
    section: 'Admin',
    items: [
      { label: 'Settings', to: '/settings', icon: <Settings size={16} /> },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Shield size={18} color="white" />
        </div>
        <span className="sidebar-brand-name">
          Aegis<span>AI</span>
        </span>
      </NavLink>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.section && (
              <div className="sidebar-section-label">{section.section}</div>
            )}
            {section.items.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
