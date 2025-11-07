import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { enableOfflineMode, setOfflineUser } from "../utils/offlineStorage";
import "./Login.css";


export default function Login() {
  // views: "welcome" | "login" | "signup" | "code"
  const [view, setView] = useState("welcome");

  // email auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName] = useState("");

  const { login, signup, signInWithGoogle } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // status
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // access code (6 boxes)
  const [code, setCode] = useState(Array(6).fill(""));
  const codeRefs = useRef([...Array(6)].map(() => ({ current: null })));

  const offlineMode = !isOnline;

  useEffect(() => setError(""), [view]);

  /* ---------------- Email login / signup ---------------- */
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error("Auth error:", err);
      if (offlineMode) {
        setError(
          "Offline login failed. Please connect to the internet or ensure you have logged in before while online."
        );
      } else {
        setError("Failed to log in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (offlineMode) return setError("You must be online to create an account");

    try {
      setLoading(true);
      await signup(email, password, "volunteer", null);
      navigate("/");
    } catch (err) {
      console.error("Signup error:", err);
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Access code inputs ---------------- */
  const handleCodeChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...code];
    next[idx] = val;
    setCode(next);
    if (val && idx < 5) codeRefs.current[idx + 1].focus();
  };

  const handleCodeKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1].focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) codeRefs.current[idx - 1].focus();
    if (e.key === "ArrowRight" && idx < 5) codeRefs.current[idx + 1].focus();
  };

  const handleCodePaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = Array(6).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setCode(next);
    codeRefs.current[Math.min(text.length, 5)].focus();
  };

  const submitAccessCode = (e) => {
    e.preventDefault();
    const joined = code.join("");
    if (joined.length !== 6) return setError("Enter the 6-digit code.");
    // TODO: verify access code with backend
    navigate("/");
  };

  /* ---------------- Offline flow ---------------- */
  function handleContinueOffline() {
    const offlineUser = {
      displayName: displayName || "Offline User",
      email: email || null,
      role: "volunteer",
    };
    setOfflineUser(offlineUser);
    enableOfflineMode();
    navigate("/");
  }

  /* ---------------- Back button (fixed top-left) ---------------- */
  const BackButton = () =>
    view !== "welcome" ? (
      <button
        className="back-link-fixed"
        type="button"
        aria-label="Back"
        onClick={() => setView("welcome")}
      >
        ←
      </button>
    ) : null;

  return (
    <div className="auth-screen">
      <BackButton />

      {/* ---------------- WELCOME ---------------- */}
      {view === "welcome" && (
        <div className="auth-card welcome-card">
          <div className="logo-stack">
            {/* Uses public/images/image-2.png */}
            <img
              src="/images/image-2.png"
              alt="Movement logo"
              className="logo-img"
            />
            <div className="app-name">THE MOVEMENT APP</div>
          </div>

          <div className="cta-stack">
            <button className="btn-pill btn-primary-mint" onClick={() => setView("login")}>
              Log in
            </button>
            <button className="btn-pill btn-secondary-mint" onClick={() => setView("code")}>
              Access Code
            </button>
          </div>
        </div>
      )}

      {/* ---------------- LOGIN ---------------- */}
      {view === "login" && (
        <div className="auth-card form-card">
          {/* Small header with logo */}
          <div className="form-header">
            <img src="/images/image-2.png" alt="Movement logo" className="logo-img-sm" />
            <div className="app-name-sm">THE MOVEMENT APP</div>
          </div>

          {/* Offline indicator */}
          {offlineMode && (
            <div className="offline-notice">
              ❌ You are offline. Login may work if you have logged in before, or you can continue in offline mode to record data locally.
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="form">
            <h2 className="sr-only">Log in</h2>

            <input
              className="input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              className="btn-pill btn-primary-mint"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>

            <button
              type="button"
              className="link subtle"
              onClick={() => alert("Forgot password flow coming soon")}
            >
              Forgot Password?
            </button>

            {error && <div className="error">{error}</div>}

            <div className="divider-row">
              <span>New?&nbsp;</span>
              <button type="button" className="link" onClick={() => setView("signup")}>
                Create an account
              </button>
            </div>

            <div className="divider"><span>or</span></div>

            <button
              type="button"
              className="btn-pill btn-outline vendor"
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch (e) {
                  if (e?.code === "auth/popup-closed-by-user") return;
                  alert(e.message || "Google sign-in failed");
                }
              }}
            >
              <img
                src="/images/google-logo.png"
                alt="Google logo"
                className="vendor-icon"
                style={{ width: "18px", height: "18px" }}
              />
              &nbsp; Continue with Google

            </button>

            {offlineMode && (
              <div className="offline-mode-section">
                <div className="divider"><span>OR</span></div>
                <button
                  type="button"
                  className="btn-offline"
                  onClick={handleContinueOffline}
                >
                  📱 Continue Offline
                </button>
                <p className="offline-hint">
                  Record data locally. Sync to database when you're back online.
                </p>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ---------------- SIGNUP ---------------- */}
      {view === "signup" && (
        <div className="auth-card form-card">
          {/* Small header with logo */}
          <div className="form-header">
            <img src="/images/image-2.png" alt="Movement logo" className="logo-img-sm" />
            <div className="app-name-sm">THE MOVEMENT APP</div>
          </div>

          {offlineMode && (
            <div className="offline-notice">
              ❌ You are offline. Sign up requires internet connection.
            </div>
          )}

          <form onSubmit={handleSignup} className="form">
            <h2 className="sr-only">Create account</h2>

            <input
              className="input"
              type="email"
              placeholder="Email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <input
              className="input"
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <button
              type="submit"
              className="btn-pill btn-primary-mint"
              disabled={loading || offlineMode}
            >
              {loading ? "Signing up..." : "Sign Up!"}
            </button>

            {error && <div className="error">{error}</div>}

            <div className="footer-inline">
              <span>Already have an account? </span>
              <button type="button" className="link" onClick={() => setView("login")}>
                Log In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- ACCESS CODE ---------------- */}
      {view === "code" && (
        <div className="auth-card code-card">
          <form onSubmit={submitAccessCode} onPaste={handleCodePaste}>
            <label className="code-label">Insert access code</label>

            <div className="code-boxes">
              {code.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  className="code-input"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={v}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                />
              ))}
            </div>

            <button className="btn-pill btn-primary-mint big">enter</button>
            {error && <div className="error mt">{error}</div>}
          </form>
        </div>
      )}
    </div>
  );
}

