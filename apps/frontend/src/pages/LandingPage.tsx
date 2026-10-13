import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, ArrowRight, Key, EyeOff, FileText,
  UserCheck, GitBranch, Activity, Terminal, Cpu, Server,
  Lock, CheckCircle, FileCheck, Bot, Database, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/* ─── Design tokens ─────────────────────────────────────── */
const G = '#00FF87';       // brand green
const G2 = '#00e478';      // slightly dimmer green
const GLOW = 'rgba(0,255,135,0.18)';

/* ─── Shared style blocks ───────────────────────────────── */
const container: React.CSSProperties = {
  width: '100%', maxWidth: 1280, margin: '0 auto', padding: '0 2rem',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.875rem 2rem', borderRadius: '0.625rem',
  background: G2, color: '#000', fontWeight: 700, fontSize: '0.9rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  textDecoration: 'none', border: 'none', cursor: 'pointer',
  boxShadow: `0 0 24px ${GLOW}`, transition: 'all 0.25s ease',
  whiteSpace: 'nowrap',
};

const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
  padding: '0.875rem 2rem', borderRadius: '0.625rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff', fontWeight: 700, fontSize: '0.9rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  textDecoration: 'none', cursor: 'pointer',
  transition: 'all 0.25s ease', whiteSpace: 'nowrap',
};

/* ─── Data ──────────────────────────────────────────────── */
const capabilityCards = [
  { icon: Key,       title: 'Authentication & RBAC',      desc: 'Enforce mTLS, token claims validation, and granular role-based access control across all APIs.' },
  { icon: EyeOff,    title: 'Privacy & PII Protection',   desc: 'Real-time zero-leak redaction across PII patterns, enterprise secrets, and sensitive data.' },
  { icon: FileText,  title: 'Policy Enforcement',          desc: 'Declarative guardrails with deterministic ALLOW, BLOCK, or MASK rules evaluated instantly.' },
  { icon: UserCheck, title: 'Human Approval',              desc: 'Automated dual-custody approval workflows and asynchronous interrupt gates for high-risk actions.' },
  { icon: GitBranch, title: 'Model & Provider Routing',   desc: 'Dynamic failover, semantic cost optimization, fallback cascades, and sovereign routing.' },
  { icon: Activity,  title: 'Audit & Observability',      desc: 'Cryptographically anchored immutable audit trail for continuous compliance and monitoring.' },
];

const pipelineSteps = [
  { n: '01', t: 'Request',    desc: 'Client payload ingress from enterprise systems.', subLeft: 'App / Agent', subRight: 'INGRESS', icon: Shield, topRight: '<0.1ms' },
  { n: '02', t: 'Auth',       desc: 'Mutual TLS handshake and token claim validation.', subLeft: 'mTLS & RBAC', subRight: 'SPIFFE', icon: Lock, topRight: 'Zero-Bypass' },
  { n: '03', t: 'Validation', desc: 'Prompt syntax, schema bounds, and injection guards.', subLeft: 'Schema Check', subRight: 'AST-VALID', icon: CheckCircle, topRight: 'Strict Spec' },
  { n: '04', t: 'Privacy',    desc: 'Deterministic zero-leak token replacement & masking.', subLeft: 'PII Redaction', subRight: 'SANITIZED', icon: EyeOff, topRight: '70+ Presidio' },
  { n: '05', t: 'Policy',     desc: 'Enterprise security rules, bans, and risk scoring.', subLeft: 'Guardrails', subRight: 'RULE-PASS', icon: FileText, topRight: 'OPA / Rego' },
  { n: '06', t: 'Routing',    desc: 'Dynamic multi-model failover & region optimization.', subLeft: 'Failover', subRight: 'SMART-PROXY', icon: GitBranch, topRight: '<0.2ms' },
  { n: '07', t: 'Provider',   desc: 'Redacted prompt serialized to target frontier LLM.', subLeft: 'LLM Exec', subRight: 'STREAMING', icon: Server, topRight: 'mTLS Handshake' },
  { n: '08', t: 'Audit',      desc: 'Immutable ledger record with zero payload retention.', subLeft: 'Merkle Seal', subRight: 'ROOT_ATTESTED', icon: FileCheck, topRight: 'SEALED' },
];

/* ─── Custom Cursor ─────────────────────────────────────── */
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return; // disable on touch

    const dot = dotRef.current;
    const halo = haloRef.current;
    if (!dot || !halo) return;

    let mx = 0, my = 0, hx = 0, hy = 0;
    let rafId: number;

    const move = (e: MouseEvent) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx - 4}px, ${my - 4}px)`;
    };

    const animate = () => {
      hx += (mx - hx) * 0.12;
      hy += (my - hy) * 0.12;
      halo.style.transform = `translate(${hx - 20}px, ${hy - 20}px)`;
      rafId = requestAnimationFrame(animate);
    };

    const onEnterInteractive = () => {
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.boxShadow = `0 0 16px 4px ${G}`;
      halo.style.width = '52px';
      halo.style.height = '52px';
      halo.style.borderColor = G;
      halo.style.opacity = '0.6';
    };

    const onLeaveInteractive = () => {
      dot.style.width = '8px';
      dot.style.height = '8px';
      dot.style.boxShadow = `0 0 10px 2px ${GLOW}`;
      halo.style.width = '40px';
      halo.style.height = '40px';
      halo.style.borderColor = 'rgba(0,255,135,0.4)';
      halo.style.opacity = '0.35';
    };

    const attachHover = () => {
      document.querySelectorAll('a, button, [data-interactive]').forEach(el => {
        el.addEventListener('mouseenter', onEnterInteractive);
        el.addEventListener('mouseleave', onLeaveInteractive);
      });
    };

    document.addEventListener('mousemove', move);
    rafId = requestAnimationFrame(animate);
    attachHover();
    const obs = new MutationObserver(attachHover);
    obs.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener('mousemove', move);
      cancelAnimationFrame(rafId);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      {/* dot */}
      <div ref={dotRef} style={{
        position: 'fixed', top: 0, left: 0, zIndex: 9999, pointerEvents: 'none',
        width: 8, height: 8, borderRadius: '50%',
        background: G, boxShadow: `0 0 10px 2px ${GLOW}`,
        transition: 'width 0.15s, height 0.15s, box-shadow 0.15s',
        willChange: 'transform',
      }} />
      {/* halo */}
      <div ref={haloRef} style={{
        position: 'fixed', top: 0, left: 0, zIndex: 9998, pointerEvents: 'none',
        width: 40, height: 40, borderRadius: '50%',
        border: '1px solid rgba(0,255,135,0.4)', opacity: 0.35,
        transition: 'width 0.2s, height 0.2s, border-color 0.2s, opacity 0.2s',
        willChange: 'transform',
      }} />
    </>
  );
}

/* ─── Nav Link ──────────────────────────────────────────── */
function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <a
      href={href}
      style={{ color: active ? G : '#94a3b8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, transition: 'color 0.2s', position: 'relative' }}
      onMouseEnter={e => (e.currentTarget.style.color = G)}
      onMouseLeave={e => (e.currentTarget.style.color = active ? G : '#94a3b8')}
    >
      {children}
    </a>
  );
}



/* ─── Pipeline Card ─────────────────────────────────────── */
function PipelineNode({ step, index }: { step: typeof pipelineSteps[0], index: number }) {
  const Icon = step.icon;

  return (
    <article className={`workflow-node workflow-node-${index + 1}`} data-interactive>
      <span className="workflow-node-number">{step.n}</span>
      <span className="workflow-node-icon"><Icon size={23} strokeWidth={1.8} /></span>
      <h3>{step.t}</h3>
    </article>
  );
}

/* ─── Capability Card ───────────────────────────────────── */
function CapabilityCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const enter = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'translateY(-5px)';
    el.style.borderColor = 'rgba(0,255,135,0.35)';
    el.style.boxShadow = `0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,135,0.15), inset 0 1px 0 rgba(0,255,135,0.08)`;
    el.style.background = 'rgba(14,18,24,0.9)';
  };

  const leave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'translateY(0)';
    el.style.borderColor = 'rgba(255,255,255,0.08)';
    el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)';
    el.style.background = 'rgba(14,18,24,0.7)';
  };

  return (
    <div
      ref={ref}
      data-interactive
      onMouseEnter={enter}
      onMouseLeave={leave}
      style={{
        padding: '2rem', borderRadius: '1rem',
        background: 'rgba(14,18,24,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column',
        transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease',
        position: 'relative', overflow: 'hidden', cursor: 'default',
      }}
    >
      {/* inner top highlight */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)' }} />
      {/* icon box */}
      <div style={{
        width: 52, height: 52, borderRadius: '0.75rem',
        background: 'rgba(0,255,135,0.06)',
        border: '1px solid rgba(0,255,135,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '1.25rem', flexShrink: 0,
        boxShadow: `0 0 16px rgba(0,255,135,0.08)`,
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}>
        <Icon size={24} color={G} />
      </div>
      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.625rem' }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.75, flex: 1 }}>{desc}</p>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */
export function LandingPage() {
  const { user, isAuthenticated, loading } = useAuth();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#080a0d',
      color: '#f1f5f9',
      fontFamily: "'Geist', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
      overflowX: 'hidden', width: '100%',
      cursor: 'none',  /* hide default cursor for custom one */
    }}>

      <CustomCursor />

      {/* ── Global injected styles ────────────────────────────── */}
      <style>{`
        * { box-sizing: border-box; }

        /* restore default cursor inside inputs/selects */
        input, textarea, select, [contenteditable] { cursor: text !important; }

        @media (pointer: coarse) {
          [data-cursor] { display: none !important; }
          body { cursor: auto !important; }
          * { cursor: auto !important; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }

        @keyframes statusPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${G}; }
          50%       { opacity: 0.5; box-shadow: 0 0 3px ${G}; }
        }

        @keyframes flowArrow {
          0%   { left: -4px; opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { left: calc(100% + 4px); opacity: 0; }
        }

        @keyframes gridMove {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }

        @keyframes borderGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,135,0); }
          50%       { box-shadow: 0 0 0 3px rgba(0,255,135,0.15); }
        }

        @keyframes floatUp {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }

        /* Arrow flow dot */
        .arrow-flow-dot {
          position: absolute;
          top: -3px; left: -4px;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: ${G};
          box-shadow: 0 0 8px ${G};
          animation: flowArrow 2.2s ease-in-out infinite;
          opacity: 0;
        }

        /* Serpentine workflow roadmap */
        .workflow-map {
          height: 680px;
          position: relative;
          isolation: isolate;
        }
        .workflow-path {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          pointer-events: none;
          z-index: 0;
        }
        .workflow-node {
          --node-size: 124px;
          position: absolute;
          width: var(--node-size);
          height: var(--node-size);
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 1px solid rgba(0,255,135,0.38);
          background: radial-gradient(circle at 35% 28%, rgba(26,45,40,0.72), rgba(9,13,15,0.88) 64%);
          backdrop-filter: blur(14px);
          box-shadow: 0 0 0 6px rgba(0,255,135,0.025), 0 10px 30px rgba(0,0,0,0.45), 0 0 22px rgba(0,255,135,0.11);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.32rem;
          color: #f1f5f9;
          text-align: center;
          z-index: 1;
          transition: transform 260ms ease, border-color 260ms ease, box-shadow 260ms ease, background 260ms ease;
        }
        .workflow-node::after {
          content: '';
          position: absolute;
          inset: 10px;
          border: 1px solid rgba(255,255,255,0.045);
          border-radius: inherit;
          pointer-events: none;
        }
        .workflow-node:hover {
          transform: translate(-50%, calc(-50% - 7px)) scale(1.06);
          border-color: ${G};
          background: radial-gradient(circle at 35% 28%, rgba(27,74,55,0.72), rgba(8,20,15,0.92) 64%);
          box-shadow: 0 0 0 7px rgba(0,255,135,0.06), 0 18px 40px rgba(0,0,0,0.55), 0 0 38px rgba(0,255,135,0.32);
        }
        .workflow-node-number {
          color: ${G};
          font: 700 0.72rem 'JetBrains Mono', monospace;
          letter-spacing: 0.08em;
        }
        .workflow-node-icon {
          color: ${G};
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(0,255,135,0.07);
          border: 1px solid rgba(0,255,135,0.20);
          box-shadow: inset 0 0 12px rgba(0,255,135,0.07);
        }
        .workflow-node h3 {
          margin: 0;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .workflow-node-1 { top: 16%; left: 14%; }
        .workflow-node-2 { top: 16%; left: 50%; }
        .workflow-node-3 { top: 16%; left: 86%; }
        .workflow-node-4 { top: 50%; left: 86%; }
        .workflow-node-5 { top: 50%; left: 50%; }
        .workflow-node-6 { top: 50%; left: 14%; }
        .workflow-node-7 { top: 84%; left: 14%; }
        .workflow-node-8 { top: 84%; left: 50%; }

        @media (max-width: 800px) {
          .workflow-map { height: 610px; }
          .workflow-node { --node-size: 102px; }
        }
        @media (max-width: 520px) {
          .workflow-map { height: 530px; }
          .workflow-node { --node-size: 78px; }
          .workflow-node-number { font-size: 0.61rem; }
          .workflow-node-icon { width: 28px; height: 28px; }
          .workflow-node-icon svg { width: 17px; height: 17px; }
          .workflow-node h3 { font-size: 0.69rem; }
        }

        @media (max-width: 640px) {
          .landing-nav-links { display: none !important; }
          .landing-login-link { display: none !important; }
        }

        /* Capability grid */
        .capability-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }
        @media (max-width: 1024px) {
          .capability-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .capability-grid { grid-template-columns: 1fr !important; }
        }

        /* Gateway row responsive */
        .gateway-row {
          display: grid;
          grid-template-columns: 1fr auto 1.35fr auto 1fr;
          align-items: stretch;
          gap: 0;
        }
        @media (max-width: 900px) {
          .gateway-row {
            grid-template-columns: 1fr !important;
            gap: 0.75rem !important;
          }
          .gateway-arrow { display: none !important; }
        }

        /* Button hover */
        .btn-hero-primary:hover {
          background: ${G} !important;
          box-shadow: 0 0 32px rgba(0,255,135,0.45) !important;
          transform: translateY(-1px);
        }
        .btn-hero-ghost:hover {
          background: rgba(255,255,255,0.09) !important;
          border-color: rgba(0,255,135,0.3) !important;
          transform: translateY(-1px);
        }

        /* Prefers reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Architecture Section */
        .architecture-grid {
          display: grid;
          grid-template-columns: 1fr 1.6fr 1fr;
          gap: 4rem;
          align-items: center;
          position: relative;
          z-index: 1;
        }

        .arch-card {
          padding: 1.25rem 1.5rem;
          border-radius: 0.75rem;
          background: rgba(14,18,24,0.6);
          border: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }
        .arch-card:hover {
          background: rgba(14,18,24,0.9);
          border-color: rgba(0,255,135,0.3);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,135,0.1);
        }

        .arch-gateway-card {
          padding: 2rem;
          border-radius: 1rem;
          background: rgba(0,255,135,0.03);
          border: 1px solid rgba(0,255,135,0.25);
          backdrop-filter: blur(24px);
          box-shadow: 0 0 40px rgba(0,255,135,0.08), inset 0 0 20px rgba(0,255,135,0.02);
          transition: all 0.3s ease;
        }
        .arch-gateway-card:hover {
          border-color: rgba(0,255,135,0.4);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 60px rgba(0,255,135,0.12);
          transform: translateY(-4px);
        }

        .arch-gateway-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.6rem 1rem;
          border-radius: 0.375rem;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.05);
          font-size: 0.8125rem;
          color: #e2e8f0;
        }
        .arch-gateway-row .val {
          color: ${G};
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 0.75rem;
        }

        .arch-connections-svg {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none;
          z-index: 0;
        }

        @media (max-width: 1024px) {
          .architecture-grid { gap: 2rem; }
        }

        @media (max-width: 768px) {
          .architecture-grid {
            grid-template-columns: 1fr;
            gap: 3rem;
          }
          .arch-connections-svg { display: none; }
        }
      `}</style>

      {/* ── NAVBAR ───────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: 'rgba(8,10,13,0.88)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ ...container, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '0.625rem',
              background: 'rgba(0,255,135,0.08)', border: `1px solid rgba(0,255,135,0.28)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(0,255,135,0.12)',
            }}>
              <Shield size={20} color={G} />
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
              Aegis<span style={{ color: G }}>AI</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '2.25rem', flexGrow: 1, justifyContent: 'center' }}>
            <NavLink href="#home" active>Home</NavLink>
            <NavLink href="#architecture">Architecture</NavLink>
            <NavLink href="#features">Features</NavLink>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
            {!loading && (isAuthenticated ? (
              <>
                <span className="landing-login-link" style={{ color: G, fontSize: '0.78rem', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                  LOGGED IN{user?.email ? ` · ${user.email}` : ''}
                </span>
                <Link to="/dashboard" className="btn-hero-primary" style={{ ...btnPrimary, padding: '0.5rem 1.125rem', fontSize: '0.8125rem' }}>
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="landing-login-link" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                >
                  Login
                </Link>
                <Link to="/login" className="btn-hero-primary" style={{ ...btnPrimary, padding: '0.5rem 1.125rem', fontSize: '0.8125rem' }}>
                  Get Started <ArrowRight size={15} />
                </Link>
              </>
            ))}
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, paddingTop: 64, width: '100%' }}>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section id="home" style={{ position: 'relative', padding: '6.5rem 0 4.5rem', textAlign: 'center', overflow: 'hidden' }}>

          {/* Background: subtle grid */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(rgba(0,255,135,0.065) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,255,135,0.065) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
          }} />

          {/* Ambient glow */}
          <div style={{
            position: 'absolute', top: '30%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 900, height: 600, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse, rgba(0,255,135,0.09) 0%, transparent 65%)',
          }} />

          <div style={{ ...container, position: 'relative', zIndex: 1 }}>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 1rem', borderRadius: 9999, marginBottom: '2rem',
              background: 'rgba(0,255,135,0.06)', border: '1px solid rgba(0,255,135,0.2)',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: G, display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', color: G, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 600 }}>
                Enterprise AI Gateway
              </span>
            </div>

            {/* Heading */}
            <h1 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 'clamp(2.65rem, 6vw, 4.8rem)',
              fontWeight: 400, color: '#f4fff7',
              lineHeight: 1.05, letterSpacing: '-0.045em',
              maxWidth: 820, margin: '0 auto 1.5rem',
            }}>
              <span style={{ position: 'relative', display: 'inline-block', paddingRight: '0.16em' }}>
                Secure
                <span aria-hidden="true" style={{ position: 'absolute', right: '-0.04em', top: '0.88em', display: 'flex', flexDirection: 'column', alignItems: 'center', color: G }}>
                  <span style={{ width: 1, height: 11, background: 'rgba(0,255,135,0.7)' }} />
                  <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(0,255,135,0.12)', border: '1px solid rgba(0,255,135,0.55)', boxShadow: '0 0 14px rgba(0,255,135,0.28)' }}>
                    <Shield size={13} strokeWidth={2.2} />
                  </span>
                </span>
              </span>{' '}Every AI Request<span style={{ color: G }}>.</span>
            </h1>

            {/* Description */}
            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              color: '#7c8fa6', maxWidth: 580,
              margin: '0 auto 2.5rem', lineHeight: 1.75,
            }}>
              AegisAI is an enterprise AI security and governance gateway that controls AI requests before they reach model providers.
            </p>

            {/* Feature pill */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem 0.875rem',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem',
              background: 'rgba(12,14,18,0.85)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 9999, padding: '0.625rem 1.75rem',
              maxWidth: 620, margin: '0 auto 3rem', backdropFilter: 'blur(12px)',
            }}>
              {['Authentication', 'Privacy', 'Policy', 'Approval', 'Routing', 'Audit'].map((f, i, arr) => (
                <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <span style={{ color: '#cbd5e1' }}>{f}</span>
                  {i < arr.length - 1 && <span style={{ color: 'rgba(0,255,135,0.35)' }}>•</span>}
                </span>
              ))}
            </div>

            {/* CTA buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <Link to={isAuthenticated ? '/dashboard' : '/login'} className="btn-hero-primary" style={btnPrimary}>
                {isAuthenticated ? 'Open Dashboard' : 'Get Started'} <ArrowRight size={18} />
              </Link>
              <a href="#architecture" className="btn-hero-ghost" style={btnGhost}>
                <Terminal size={18} color={G} /> Explore Platform
              </a>
            </div>

          </div>
        </section>

        {/* ── ARCHITECTURE SECTION ─────────────────────────────── */}
        <section id="architecture" style={{ padding: '4rem 0', scrollMarginTop: '64px', position: 'relative' }}>
          <div style={container}>
            {/* Subdued Status Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <span style={{width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)'}}/>
                <span style={{width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)'}}/>
                <span style={{width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)'}}/>
              </div>
              <span>RUNTIME-GATEWAY-INSPECT // CLUSTER-01</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.25rem', color: G }}>&lt;1.2ms LATENCY</span>
                <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.25rem' }}>mTLS 1.3 VERIFIED</span>
                <span style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.25rem', color: G }}>DETERMINISTIC</span>
              </div>
            </div>

            <div className="architecture-grid">
              {/* LEFT: INGRESS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>INGRESS SOURCES</span>
                
                <div className="arch-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>Enterprise Apps</span>
                    <Terminal size={16} color="#64748b" />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>Internal SaaS, Microservices</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: G, fontWeight: 700 }}>
                    <span>Token: JWT v4</span>
                    <span style={{ color: '#cbd5e1' }}>REST/gRPC</span>
                  </div>
                </div>

                <div className="arch-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>Autonomous Agents</span>
                    <Bot size={16} color={G} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>CrewAI, LangChain, Autogen</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: G, fontWeight: 700 }}>
                    <span>Identity: SPIFFE</span>
                    <span style={{ color: '#cbd5e1' }}>Tool calls</span>
                  </div>
                </div>
              </div>

              {/* CENTER: GATEWAY */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center' }}>
                <div className="arch-gateway-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <Shield size={24} color={G} />
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.25rem' }}>AegisAI Gateway</span>
                    <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', background: 'rgba(0,255,135,0.1)', color: G, border: `1px solid rgba(0,255,135,0.3)`, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                      INLINE RUNTIME
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                    Deterministic zero-bypass perimeter. Enforces security policies before token serialization.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="arch-gateway-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><EyeOff size={14} color={G} /> <span>PII Redaction</span></div>
                      <span className="val">REDACTED (0.3ms)</span>
                    </div>
                    <div className="arch-gateway-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={14} color={G} /> <span>Guardrail Engine</span></div>
                      <span className="val">RULE PASS: SEC-04</span>
                    </div>
                    <div className="arch-gateway-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserCheck size={14} color={G} /> <span>Dual-Custody Approval</span></div>
                      <span className="val">AUTOMATED_ALLOW</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: DOWNSTREAM */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>DOWNSTREAM LLMS</span>
                
                <div className="arch-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Cpu size={20} color="#cbd5e1" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>OpenAI</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>GPT-4o / o1 Enterprise</div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: G, fontWeight: 700 }}>Proxy-OK</span>
                  </div>
                </div>

                <div className="arch-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Server size={20} color="#cbd5e1" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>Anthropic & Gemini</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Claude 3.5 Sonnet / 1.5 Pro</div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: G, fontWeight: 700 }}>Proxy-OK</span>
                  </div>
                </div>

                <div className="arch-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Database size={20} color="#cbd5e1" />
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>Self-Hosted vLLM</div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>VPC Isolated Llama 3.3</div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: G, fontWeight: 700 }}>Sovereign</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Animated Connections (Desktop Only) */}
            <svg
              className="arch-connections-svg"
              viewBox="0 0 1000 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="archFlow" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                  <stop offset="0%" stopColor="rgba(0,255,135,0)" />
                  <stop offset="50%" stopColor="rgba(0,255,135,0.8)" />
                  <stop offset="100%" stopColor="rgba(0,255,135,0)" />
                </linearGradient>
                <marker id="archArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
                  <path d="M 0 1 L 9 5 L 0 9 L 2 5 z" fill="rgba(0,255,135,0.8)" />
                </marker>
              </defs>

              {/* Left connector: ingress → gateway */}
              <line x1="280" y1="50" x2="370" y2="50" stroke="url(#archFlow)" strokeWidth="2.5" markerEnd="url(#archArrow)" />
              {/* Right connector: gateway → LLMs */}

              {/* Invisible paths for particle travel */}
              <path id="archPath1" d="M 280 50 L 380 50" fill="none" stroke="none" />
              <path id="archPath2" d="M 620 50 L 720 50" fill="none" stroke="none" />

              {/* Arrow filter */}
              <defs>
                <filter id="archArrowGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Moving → arrow on left connector (small) */}
              <g filter="url(#archArrowGlow)">
                <path d="M -8 0 L 3 0 M 0 -3 L 6 0 L 0 3" stroke={G} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <animateMotion dur="2s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#archPath1" />
                  </animateMotion>
                </path>
              </g>

              {/* Animated flow indicator to downstream LLMs (without a static connector). */}
              <g filter="url(#archArrowGlow)">
                <path d="M -8 0 L 3 0 M 0 -3 L 6 0 L 0 3" stroke={G} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <animateMotion dur="2s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#archPath2" />
                  </animateMotion>
                </path>
              </g>

            </svg>
          </div>
        </section>

        {/* ── CORE CAPABILITIES ────────────────────────────────── */}
        <section id="features" style={{ padding: '6rem 0', position: 'relative' }}>
          {/* section glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(0,255,135,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
          <div style={{ ...container, position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, color: '#fff', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                Core Capabilities
              </h2>
              <p style={{ fontSize: '1.05rem', color: '#64748b', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
                Deterministic protection engineered directly into your inference path with sub-millisecond execution.
              </p>
            </div>

            <div className="capability-grid">
              {capabilityCards.map(c => <CapabilityCard key={c.title} {...c} />)}
            </div>
          </div>
        </section>

        {/* ── HOW AEGISAI WORKS ────────────────────────────────── */}
        <section id="architecture-pipeline" style={{ padding: '6rem 0', position: 'relative', overflow: 'hidden' }}>
          {/* background accent line */}
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(to right, transparent, rgba(0,255,135,0.15), transparent)`, pointerEvents: 'none' }} />

          <div style={{ ...container, position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, color: '#fff', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                How AegisAI Works
              </h2>
              <p style={{ fontSize: '1.05rem', color: '#64748b', maxWidth: '560px', margin: '0 auto', lineHeight: 1.7 }}>
                A transparent, sub-millisecond governance pipeline executing inline before model provider handoff.
              </p>
            </div>

            {/* One continuous serpentine route, shared by all eight workflow nodes. */}
            <div className="workflow-map">
              <svg className="workflow-path" viewBox="0 0 1000 680" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="workflowFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,255,135,0.10)" />
                    <stop offset="45%" stopColor="rgba(0,255,135,0.58)" />
                    <stop offset="100%" stopColor="rgba(0,255,135,0.14)" />
                  </linearGradient>
                  <filter id="workflowGlow" x="-30%" y="-20%" width="160%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <marker id="workflowArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                    <path d="M 1 1 L 9 5 L 1 9 L 3 5 z" fill={G} />
                  </marker>
                </defs>
                <path
                  id="workflowRoute"
                  d="M 140 109 C 260 109 380 109 500 109 S 740 109 860 109 C 935 109 935 340 860 340 C 740 340 620 340 500 340 S 260 340 140 340 C 65 340 65 571 140 571 C 260 571 380 571 500 571"
                  fill="none"
                  stroke="url(#workflowFlow)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  markerEnd="url(#workflowArrow)"
                />
                <path
                  d="M 140 109 C 260 109 380 109 500 109 S 740 109 860 109 C 935 109 935 340 860 340 C 740 340 620 340 500 340 S 260 340 140 340 C 65 340 65 571 140 571 C 260 571 380 571 500 571"
                  fill="none"
                  stroke="rgba(0,255,135,0.08)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  filter="url(#workflowGlow)"
                />
                {[0, -2.7, -5.4].map((begin) => (
                  <circle key={begin} r="5" fill={G} filter="url(#workflowGlow)">
                    <animateMotion dur="8.1s" begin={`${begin}s`} repeatCount="indefinite">
                      <mpath href="#workflowRoute" />
                    </animateMotion>
                  </circle>
                ))}
                <path d="M -10 0 L 8 0 M 2 -5 L 10 0 L 2 5" stroke={G} strokeWidth="2" fill="none" filter="url(#workflowGlow)">
                  <animateMotion dur="8.1s" begin="-1.35s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#workflowRoute" />
                  </animateMotion>
                </path>
              </svg>
              {pipelineSteps.map((step, i) => <PipelineNode key={step.n} step={step} index={i} />)}
            </div>

          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────── */}
        <section style={{ padding: '5rem 0 7rem' }}>
          <div style={container}>
            <div style={{
              padding: 'clamp(3rem, 5vw, 5rem) clamp(2rem, 5vw, 5rem)',
              borderRadius: '2rem',
              background: 'linear-gradient(160deg, rgba(12,16,20,0.95) 0%, rgba(18,22,28,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,135,0.04)',
              position: 'relative', overflow: 'hidden', textAlign: 'center',
            }}>
              {/* decorative glows */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '65%', height: '65%', background: 'radial-gradient(ellipse, rgba(0,255,135,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, left: '25%', right: '25%', height: 1, background: `linear-gradient(to right, transparent, rgba(0,255,135,0.28), transparent)` }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '1rem',
                  background: 'rgba(0,255,135,0.07)', border: `1px solid rgba(0,255,135,0.2)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '2rem', boxShadow: `0 0 28px rgba(0,255,135,0.12)`,
                  animation: 'floatUp 4s ease-in-out infinite',
                }}>
                  <Server size={30} color={G} />
                </div>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, color: '#fff', maxWidth: 700, marginBottom: '1.25rem', lineHeight: 1.2, letterSpacing: '-0.03em' }}>
                  Bring Security and Governance to Every AI Request.
                </h2>
                <p style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: '#64748b', maxWidth: 520, marginBottom: '2.5rem', lineHeight: 1.75 }}>
                  Control, protect and observe your enterprise AI infrastructure with AegisAI.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                  <Link to="/login" className="btn-hero-primary" style={{ ...btnPrimary, padding: '0.9375rem 2.25rem', fontSize: '0.9375rem' }}>
                    Get Started <ArrowRight size={18} />
                  </Link>
                  <Link to="/login" className="btn-hero-ghost" style={{ ...btnGhost, padding: '0.9375rem 2.25rem', fontSize: '0.9375rem' }}>
                    Login to Console
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{
        width: '100%',
        background: 'rgba(5,7,10,0.97)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '2.25rem 0',
      }}>
        <div style={{ ...container, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <Shield size={17} color={G2} />
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
              Aegis<span style={{ color: G }}>AI</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
            <span style={{ fontSize: '0.8125rem', color: '#334155' }}>Enterprise AI Security &amp; Governance Gateway</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#2d3748', fontWeight: 500 }}>
            © 2026 AegisAI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
