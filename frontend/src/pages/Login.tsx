// frontend/src/pages/Login.tsx
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";
import BackgroundEyes from "../components/BackgroundEyes";
import type { UserRole } from "../data/types";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [badgeId, setBadgeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!badgeId.trim() || !password.trim()) {
      setError("Enter your Badge ID and password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const role: UserRole = await login(badgeId.trim(), password);
      const fallback = role === "supervisor" ? "/supervisor" : "/";
      const redirectTo =
        (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
        fallback;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
        setError("Invalid credentials. Verify your Badge ID and password.");
      } else if (err instanceof ApiError) {
        setError(`Login failed (HTTP ${err.status}). Please try again.`);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        position: "relative",
      }}
    >
      <BackgroundEyes />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {/* Formal Header */}
        <div className="login-topline">
          <span className="tricolor-dot" aria-hidden="true" />
          Government of India &middot; Ministry of Home Affairs &middot; National Crime
          Records Bureau
        </div>
        <header className="login-brand">
          <img src="/netra-logo.svg" alt="NETRA" />
          <strong>NETRA</strong>
          <span>Network Intelligence &amp; Explainable Threat Relationship Analyzer</span>
        </header>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--surface)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-strong)",
              borderTop: "4px solid var(--navy-800)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-sunken)",
              }}
            >
              <h1
                style={{
                  fontSize: "var(--fs-lg)",
                  color: "var(--navy-900)",
                  textAlign: "center",
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                Authorized Personnel Only
              </h1>
            </div>

            <div style={{ padding: 32 }}>
              <form onSubmit={handleSubmit}>
                <div className="login-field" style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="badgeId"
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--navy-800)",
                    }}
                  >
                    Badge ID
                  </label>
                  <input
                    id="badgeId"
                    type="text"
                    placeholder="e.g. BADGE001"
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                    autoComplete="username"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 15,
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                </div>
                <div className="login-field" style={{ marginBottom: 24 }}>
                  <label
                    htmlFor="password"
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--navy-800)",
                    }}
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: 15,
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                </div>

                {error && (
                  <div
                    className="login-error"
                    style={{
                      marginBottom: 16,
                      color: "var(--risk-high)",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary login-submit"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: 15,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--navy-700)",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    opacity: submitting ? 0.6 : 1,
                    cursor: submitting ? "wait" : "pointer",
                  }}
                >
                  {submitting ? "Authenticating…" : "Secure Login"}
                </button>
              </form>
            </div>

            {/* Sarkari Warning Box */}
            <div
              style={{
                background: "#fff9e6",
                borderTop: "1px solid #ffd699",
                padding: "16px 24px",
                borderBottomLeftRadius: "var(--radius-sm)",
                borderBottomRightRadius: "var(--radius-sm)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#995c00",
                  lineHeight: 1.5,
                  textAlign: "justify",
                }}
              >
                <strong>WARNING:</strong> This is a restricted government system.
                Unauthorized access, modification, or sharing of data from this portal is
                an offense under Section 66 of the Information Technology Act, 2000, and
                the Official Secrets Act, 1923. All sessions and IP addresses are actively
                monitored and logged by the NCRB.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}