import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import BackgroundEyes from "../components/BackgroundEyes";
import type { UserRole } from "../data/types";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [officerId, setOfficerId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("investigator");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!officerId.trim() || !password.trim()) {
      setError("Enter your Officer ID and password to continue.");
      return;
    }
    setError("");
    login(officerId.trim(), role);
    const fallback = role === "supervisor" ? "/supervisor" : "/";
    const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? fallback;
    navigate(redirectTo, { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      <BackgroundEyes />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>

      {/* Formal Header */}
      <div className="sarkari-top-strip">
        <div className="tricolor" />
        <div>Government of India | Ministry of Home Affairs</div>
        <div style={{ display: "flex", gap: 16 }}>
          <span>A- A A+</span>
          <span>English</span>
        </div>
      </div>
      <header className="top-navbar" style={{ justifyContent: 'center', height: 80 }}>
        <div className="top-navbar-brand" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <img src="/favicon.svg" alt="NETRA Logo" style={{ margin: '0 auto' }} />
          <div className="top-navbar-brand-text" style={{ alignItems: 'center' }}>
            <strong style={{ fontSize: 18 }}>NETRA</strong>
            <span>Network Intelligence &amp; Explainable Threat Relationship Analyzer</span>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', borderTop: '4px solid var(--navy-800)', boxShadow: 'var(--shadow-lg)' }}>
          
          <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
            <h1 style={{ fontSize: 'var(--fs-lg)', color: 'var(--navy-900)', textAlign: 'center', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Authorized Personnel Only</h1>
          </div>

          <div style={{ padding: 32 }}>
            <form onSubmit={handleSubmit}>
              <div className="login-field" style={{ marginBottom: 20 }}>
                <label htmlFor="officerId" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--navy-800)' }}>Officer ID / Username</label>
                <input
                  id="officerId"
                  type="text"
                  placeholder="e.g. INS-4471"
                  value={officerId}
                  onChange={(e) => setOfficerId(e.target.value)}
                  autoComplete="username"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div className="login-field" style={{ marginBottom: 24 }}>
                <label htmlFor="password" style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--navy-800)' }}>Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <div className="login-field" style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--navy-800)' }}>Sign in as</label>
                <div className="role-picker">
                  <button
                    type="button"
                    className={`role-picker-option ${role === "investigator" ? "active" : ""}`}
                    onClick={() => setRole("investigator")}
                  >
                    <span className="role-picker-title">Investigator</span>
                    <span className="role-picker-sub">Work assigned cases</span>
                  </button>
                  <button
                    type="button"
                    className={`role-picker-option ${role === "supervisor" ? "active" : ""}`}
                    onClick={() => setRole("supervisor")}
                  >
                    <span className="role-picker-title">Supervisor</span>
                    <span className="role-picker-sub">Assign and oversee</span>
                  </button>
                </div>
              </div>
              {error && <div className="login-error" style={{ marginBottom: 16, color: 'var(--risk-high)', fontSize: 13, fontWeight: 500 }}>{error}</div>}
              
              <button type="submit" className="btn btn-primary login-submit" style={{ width: '100%', padding: '12px', fontSize: 15, borderRadius: 'var(--radius-sm)', background: 'var(--navy-700)', color: 'white', border: 'none', fontWeight: 600, textTransform: 'uppercase' }}>
                Secure Login
              </button>
            </form>
          </div>

          {/* Sarkari Warning Box */}
          <div style={{ background: '#fff9e6', borderTop: '1px solid #ffd699', padding: '16px 24px', borderBottomLeftRadius: 'var(--radius-sm)', borderBottomRightRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 11, color: '#995c00', lineHeight: 1.5, textAlign: 'justify' }}>
              <strong>WARNING:</strong> This is a restricted government system. Unauthorized access, modification, or sharing of data from this portal is an offense under Section 66 of the Information Technology Act, 2000, and the Official Secrets Act, 1923. All sessions and IP addresses are actively monitored and logged by the NCRB.
            </div>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
