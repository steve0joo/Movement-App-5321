import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSync } from "../context/SyncContext";
import { enableOfflineMode, setOfflineUser } from "../utils/offlineStorage";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { createUserProfile, getUserProfile } from "../services/userService";
import { getAllTeams } from "../services/teamService";
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
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teams, setTeams] = useState([]);

  const { login, signup, signInWithGoogleReturningNew } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // status
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // access code UI
  const [code, setCode] = useState(Array(5).fill(""));
  const codeRefs = useRef([]);

  // Google new-user role flow
  const [googleRole, setGoogleRole] = useState("volunteer");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newGoogleUser, setNewGoogleUser] = useState(null);
  const [googleSaveBusy, setGoogleSaveBusy] = useState(false);

  const offlineMode = !isOnline;
  useEffect(() => setError(""), [view]);

  // Load teams when signup view is shown
  useEffect(() => {
    async function loadTeams() {
      if (view === "signup" && isOnline) {
        try {
          const allTeams = await getAllTeams();
          setTeams(allTeams);
        } catch (err) {
          console.error("Error loading teams:", err);
        }
      }
    }
    loadTeams();
  }, [view, isOnline]);

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

  /* ---------------- Email signup ---------------- */
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (offlineMode) return setError("You must be online to create an account");

    try {
      setLoading(true);
      // Pass teamId to signup (can be empty string for "Unassigned")
      await signup(email, password, role, displayName, selectedTeamId || null);
      navigate("/");
    } catch (err) {
      console.error("Signup error:", err);
      setError("Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Access code logic ---------------- */
  const handleAccessCodeLogin = async (joinedCode) => {
    const accessCode = (joinedCode || "").trim();
    if (!accessCode) {
      setError("Enter the 5-digit code.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const accessCodeRef = doc(db, "users", accessCode);
      let snap;
      try {
        snap = await getDoc(accessCodeRef);
      } catch {
        throw new Error("Access code does not exist. Please check your code and try again.");
      }
      if (!snap.exists()) throw new Error("Access code does not exist. Please check your code and try again.");

      const userData = snap.data();
      if (!userData.isAccessCodeUser || !userData.isActive || userData.role !== "volunteer") {
        throw new Error("Invalid or inactive access code. Please contact your administrator.");
      }

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
  const handleCodeChange = (idx, e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 1);
    if (val === "" && code[idx] === "") return;
    const next = [...code];
    next[idx] = val;
    setCode(next);
    if (val && idx < 4) codeRefs.current[idx + 1]?.focus();
  };
  const handleCodeKeyDown = (idx, e) => {
    if (e.key === "Backspace") {
      if (code[idx]) {
        const next = [...code];
        next[idx] = "";
        setCode(next);
        return;
      }
      if (idx > 0) codeRefs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) codeRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 4) codeRefs.current[idx + 1]?.focus();
  };
  const handleCodePaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    if (!text) return;
    const next = Array(5).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setCode(next);
    codeRefs.current[Math.min(text.length, 4)]?.focus();
  };
  const submitAccessCode = (e) => {
    e.preventDefault();
    const joined = code.join("");
    if (joined.length !== 5) return setError("Enter the 5-digit code.");
    return handleAccessCodeLogin(joined);
  };

  /* ---------------- Google sign-in ---------------- */
  async function handleGoogle() {
    if (googleBusy) return;
    setError("");
    setGoogleBusy(true);
    try {
      const { user, isNew, viaRedirect } = await signInWithGoogleReturningNew();
      if (viaRedirect) return; // iOS Safari redirect; handled by listener below
      if (!user) return;

      if (isNew) {
        setNewGoogleUser(user);
        setShowRoleModal(true);
      } else {
        const profile = await getUserProfile(user.uid);
        if (!profile) {
          await createUserProfile(user.uid, { role: "volunteer" });
        }
        navigate("/");
      }
    } catch (e) {
      const ignorable = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);
      if (!ignorable.has(e?.code)) {
        console.error("Google sign-in error:", e);
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleBusy(false);
    }
  }

  // Finish redirect flow (iOS Safari, etc.)
  useEffect(() => {
    function onRedirect(e) {
      const { user, isNew } = e.detail || {};
      if (user && isNew) {
        setNewGoogleUser(user);
        setShowRoleModal(true);
      } else if (user) {
        navigate("/");
      }
    }
    window.addEventListener("oauth-redirect-finished", onRedirect);
    return () => window.removeEventListener("oauth-redirect-finished", onRedirect);
  }, [navigate]);

  // Save role for a brand-new Google user
  async function confirmGoogleRole() {
    if (!newGoogleUser || googleSaveBusy) return;
    setGoogleSaveBusy(true);
    setError("");
    try {
      await createUserProfile(newGoogleUser.uid, {
        role: googleRole,
        displayName: newGoogleUser.displayName || null,
      });
      setShowRoleModal(false);
      setNewGoogleUser(null);
      navigate("/");
    } catch (e) {
      const msg =
        e?.code === "permission-denied" || /insufficient permissions/i.test(String(e?.message))
          ? "Could not save your role due to security rules. Try again, or contact an admin."
          : e?.message || "Could not save role. Please try again.";
      setError(msg);
      console.error("confirmGoogleRole error:", e);
    } finally {
      setGoogleSaveBusy(false);
    }
  }

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

  /* ---------------- Back button ---------------- */
  const BackButton = () =>
    view !== "welcome" ? (
      <button className="back-link-fixed" type="button" aria-label="Back" onClick={() => setView("welcome")}>
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
            <button className="btn-pill btn-primary-mint" onClick={() => setView("code")}>
              Access Code
            </button>
          </div>
        </div>
      )}

      {/* ---------------- LOGIN ---------------- */}
      {view === "login" && (
        <div className="auth-card form-card">
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

            <button type="button" className="link subtle" onClick={() => navigate("/reset-password")}>
              Forgot Password?
            </button>

            {error && <div className="error">{error}</div>}

            <div className="divider-row">
              <span>New?&nbsp;</span>
              <button type="button" className="link" onClick={() => setView("signup")}>
                Create an account
              </button>
            </div>

            <div className="divider">
              <span>or</span>
            </div>

            <button type="button" className="btn-pill btn-outline vendor" disabled={googleBusy} onClick={handleGoogle}>
              <img src="/images/google-logo.png" alt="Google logo" className="vendor-icon" style={{ width: "18px", height: "18px" }} />
              &nbsp; {googleBusy ? "Connecting…" : "Continue with Google"}
            </button>

            {offlineMode && (
              <div className="offline-mode-section">
                <div className="divider">
                  <span>OR</span>
                </div>
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

          {offlineMode && <div className="offline-notice">❌ You are offline. Sign up requires internet connection.</div>}

          <form onSubmit={handleSignup} className="form">
            <h2 className="sr-only">Create account</h2>

            <input className="input" type="text" placeholder="Full name" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />

            <input className="input" type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <input className="input" type="password" placeholder="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

            <input className="input" type="password" placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />

            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className="role-select input">
                <option value="volunteer">Volunteer</option>
                <option value="route_leader">Route Leader</option>
                <option value="team_admin">Administrator</option>
              </select>
              <small className="form-hint">
                {role === "volunteer" && "Basic access to record and view data in the team"}
                {role === "route_leader" && "Manage a route and its volunteers"}
                {role === "team_admin" && "Full administrative access"}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="team">Team (Optional)</label>
              <select id="team" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="role-select input">
                <option value="">Unassigned - Admin will assign later</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <small className="form-hint">
                Choose your team now, or an administrator can assign you later.
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
          <div className="code-header">
            <label className="code-label">Insert access code</label>
          </div>

          <form onSubmit={submitAccessCode} onPaste={handleCodePaste}>
            <div className="code-boxes">
              {code.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  className="code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={v}
                  onChange={(e) => handleCodeChange(i, e)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                />
              ))}
            </div>

            <div className="code-actions">
              <button className="btn-pill btn-primary-mint code-submit" disabled={loading}>
                {loading ? "Verifying..." : "Enter"}
              </button>
            </div>

            {error && <div className="error mt">{error}</div>}
          </form>
        </div>
      )}

      {/* Role modal for brand-new Google users */}
      {showRoleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.25)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "92%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 16,
              padding: "18px 16px",
              boxShadow: "0 14px 36px rgba(0,0,0,.18)",
            }}
          >
            <div className="sheet-title" style={{ marginBottom: 8 }}>
              Choose your role
            </div>
            <div className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
              This is only asked the first time for Google accounts.
            </div>
            <select className="input" value={googleRole} onChange={(e) => setGoogleRole(e.target.value)}>
              <option value="volunteer">Volunteer</option>
              <option value="route_leader">Route Leader</option>
              <option value="team_admin">Administrator</option>
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="btn-pill btn-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  if (googleSaveBusy) return;
                  setShowRoleModal(false);
                  setNewGoogleUser(null);
                }}
                disabled={googleSaveBusy}
              >
                Cancel
              </button>
              <button
                className="btn-pill btn-primary-mint"
                style={{ flex: 1 }}
                onClick={confirmGoogleRole}
                disabled={googleSaveBusy}
              >
                {googleSaveBusy ? "Saving…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
