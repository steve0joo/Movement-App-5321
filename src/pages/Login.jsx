import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { enableOfflineMode, setOfflineUser } from "../utils/offlineStorage";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import "./Login.css";

export default function Login() {
  // views: "welcome" | "login" | "signup" | "code"
  const [view, setView] = useState("welcome");

  // email auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [role, setRole] = useState("volunteer");

  const { login, signup, signInWithGoogle } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // status
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 6-box access code UI (we’ll join to a string before auth)
  const [code, setCode] = useState(Array(6).fill(""));
  const codeRefs = useRef([...Array(6)].map(() => ({ current: null })));

  const offlineMode = !isOnline;
  useEffect(() => setError(""), [view]);

  /* ---------------- Email login ---------------- */
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

  /* ---------------- Email signup (volunteer) ---------------- */
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (offlineMode) return setError("You must be online to create an account");

    try {
      setLoading(true);
      await signup(email, password, role, displayName);
      navigate("/");
    } catch (err) {
      console.error("Signup error:", err);
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Access code logic ---------------- */
  // We trigger this from your “code” view by joining the 6 inputs.
  const handleAccessCodeLogin = async (joinedCode) => {
    const accessCode = (joinedCode || "").trim();
    if (!accessCode) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1) Validate access code document (users/{accessCode})
      const accessCodeRef = doc(db, "users", accessCode);
      let snap;
      try {
        snap = await getDoc(accessCodeRef);
      } catch {
        throw new Error("Access code does not exist. Please check your code and try again.");
      }
      if (!snap.exists()) {
        throw new Error("Access code does not exist. Please check your code and try again.");
      }

      const userData = snap.data();
      if (!userData.isAccessCodeUser || !userData.isActive || userData.role !== "volunteer") {
        throw new Error("Invalid or inactive access code. Please contact your administrator.");
      }

      // 2) Create or sign into a temp Firebase Auth account for this volunteer
      const tempEmail = `volunteer_${accessCode}@temp.movement.app`;
      const tempPassword = `volunteer${accessCode}123`;
      let firebaseUser;

      try {
        const cred = await signInWithEmailAndPassword(auth, tempEmail, tempPassword);
        firebaseUser = cred.user;
      } catch (signInErr) {
        if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
          const cred = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
          firebaseUser = cred.user;
        } else {
          throw new Error("Wrong access code. Please check your code and try again.");
        }
      }

      // 3) Ensure app profile exists (so the rest of the app recognizes the user)
      const profile = {
        email: tempEmail,
        role: "volunteer",
        displayName: `Volunteer ${accessCode}`,
        isActive: true,
        accessCode,
        isAccessCodeUser: true,
        teamId: userData.teamId || "",
        createdAt: userData.createdAt || new Date(),
        updatedAt: new Date(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), profile);
      navigate("/");
    } catch (err) {
      console.error("Access code login error:", err);
      if (String(err?.message).includes("Missing or insufficient permissions")) {
        setError("Access code does not exist. Please check your code and try again.");
      } else {
        setError(err?.message || "Access code login failed. Please try again.");
      }
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
    if (e.key === "Backspace" && !code[idx] && idx > 0) codeRefs.current[idx - 1].focus();
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
    return handleAccessCodeLogin(joined);
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
            <img src="/images/image-2.png" alt="Movement logo" className="logo-img" />
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

            <button type="submit" className="btn-pill btn-primary-mint" disabled={loading}>
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
                <button type="button" className="btn-offline" onClick={handleContinueOffline}>
                  📱 Continue Offline
                </button>
                <p className="offline-hint">Record data locally. Sync to database when you're back online.</p>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ---------------- SIGNUP ---------------- */}
      {view === "signup" && (
        <div className="auth-card form-card">
          <div className="form-header">
            <img src="/images/image-2.png" alt="Movement logo" className="logo-img-sm" />
            <div className="app-name-sm">THE MOVEMENT APP</div>
          </div>

          {offlineMode && (
            <div className="offline-notice">❌ You are offline. Sign up requires internet connection.</div>
          )}

          <form onSubmit={handleSignup} className="form">
            <h2 className="sr-only">Create account</h2>

          {/* Display Name (signup only) */}
            <div className="form-group">
              <label htmlFor="displayName">Full Name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>

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
            {/* Role Selection (signup only) */}
            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="role-select input"
              >
                {/* IMPORTANT: use values that match your Firestore rules */}
                <option value="volunteer">Volunteer</option>
                <option value="route_leader">Route Leader</option>
                <option value="team_admin">Administrator</option>
                {/* If you want a super user later: <option value="super_admin">Super Admin</option> */}
              </select>
              <small className="form-hint">
                {role === "volunteer" && "Basic access to record and view data in the team"}
                {role === "route_leader" && "Manage a route and its volunteers"}
                {role === "team_admin" && "Full administrative access"}
              </small>
            </div>

            <button type="submit" className="btn-pill btn-primary-mint" disabled={loading || offlineMode}>
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

            <button className="btn-pill btn-primary-mint big" disabled={loading}>
              {loading ? "Verifying..." : "enter"}
            </button>
            {error && <div className="error mt">{error}</div>}
          </form>
        </div>
      )}
    </div>
  );
}
