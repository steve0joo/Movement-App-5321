// src/pages/ResetPassword.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import "./Login.css";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!isOnline) {
      setError("You need an internet connection to reset your password.");
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email.trim());
      setSent(true);
      console.log("Password reset email sent to:", email.trim());
      setCooldown(30); // prevent rapid re-sends
    } catch (err) {
      console.error("reset error:", err);
      // friendly messages
      const msg =
        err?.code === "auth/user-not-found"
          ? "No account found with that email."
          : "Could not send reset email. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    await handleSubmit(new Event("submit"));
  }

  return (
    <div className="auth-screen">
      <button
        className="back-link-fixed"
        type="button"
        aria-label="Back"
        onClick={() => navigate(-1)}
      >
        ←
      </button>

      <div className="auth-card form-card" style={{ maxWidth: 420 }}>
        {/* Header with small logo to match your login/signup */}
        <div className="form-header">
          <img src="/images/image-2.png" alt="Movement logo" className="logo-img-sm" />
          <div className="app-name-sm">THE MOVEMENT APP</div>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <h2 className="sr-only">Reset Password</h2>

          {!sent ? (
            <>
              <div style={{ textAlign: "left", padding: "0 8px 6px", color: "#415453" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Forgot Password?</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  Enter your email and we’ll send a reset link.
                </div>
              </div>

              <input
                className="input"
                type="email"
                placeholder="enter email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <button
                className="btn-pill btn-primary-mint"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: "left", padding: "0 8px 6px", color: "#415453" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Forgot Password?</div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>
                  Check your inbox for the email and follow the instructions in the link.
                </div>
              </div>

              <input
                className="input"
                type="email"
                value={email}
                readOnly
                style={{ opacity: 0.9 }}
              />

              <button
                className="btn-pill btn-primary-mint"
                type="button"
                onClick={() => navigate("/login")}
              >
                Back to log in
              </button>
            </>
          )}

          {error && <div className="error mt">{error}</div>}

          <div className="footer-inline">
            Didn’t receive an email?{" "}
            <button
              type="button"
              className="link"
              disabled={!sent || cooldown > 0 || loading}
              onClick={handleResend}
              title={!sent ? "Send a reset email first" : ""}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email."}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
