import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import "./FollowUps.css"; // reuses tokens + adds form styles at bottom
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import menuIcon from "../assets/menu-button.png";

// inline icons
const IconBack = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" {...p}><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
);

export default function FollowUpForm({ onClose, onSaved }) {
  // fields
  const [team, setTeam] = useState("");
  const [block, setBlock] = useState("");
  const [unit, setUnit] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [involvement, setInvolvement] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wasOfflineQueued, setWasOfflineQueued] = useState(false);

  // today’s date (display only)
  const today = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // offline draft autosave
  const draftKey = "fu_form_draft";
  const firstMount = useRef(true);
  const draft = { team, block, unit, name, age, followUp, involvement, notes };

  useEffect(() => {
    // load any existing draft
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        setTeam(d.team ?? "");
        setBlock(d.block ?? "");
        setUnit(d.unit ?? "");
        setName(d.name ?? "");
        setAge(d.age ?? "");
        setFollowUp(d.followUp ?? "");
        setInvolvement(d.involvement ?? "");
        setNotes(d.notes ?? "");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // throttle autosave (very light)
    if (firstMount.current) { firstMount.current = false; return; }
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [team, block, unit, name, age, followUp, involvement, notes]);

  const requiredOk = team && block && unit && name;

  async function handleSave(e) {
    e.preventDefault();
    if (!requiredOk || saving) return;

    const payload = {
      date: today,
      team, block, unit, name,
      age: age ? Number(age) : null,
      followUp, involvement, notes,
      lastActivity: new Date().toISOString(),
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid || null
    };

    try {
      setSaving(true);
      setError("");

      if (navigator.onLine) {
        await addDoc(collection(db, "followUps"), payload);
      } else {
        // queue locally to send when back online
        const key = "fu_outbox";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push(payload);
        localStorage.setItem(key, JSON.stringify(existing));
        setWasOfflineQueued(true);
      }

      // clear draft
      try { localStorage.removeItem(draftKey); } catch {}
      onSaved?.(payload);
      onClose?.();
    } catch (err) {
      setError("Could not save. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const navigate = useNavigate();
  const { role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // close menu on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleMenu(e) {
    e?.stopPropagation();
    setMenuOpen((s) => !s);
  }

  function handleMenuSelect(item) {
    setMenuOpen(false);
    onClose?.();
    if (item === "Users") navigate("/users");
    // other items intentionally non-functional for now
  }

  return (
    <div className="fu-form-overlay" role="dialog" aria-modal="true">
      {/* top bar */}
      <header className="fu-form-topbar">
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            type="button"
            onClick={toggleMenu}
          >
            <img src={menuIcon} alt="Menu" style={{ height: 18, display: "block" }} />
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu" aria-orientation="vertical">
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("New Visit")} role="menuitem">
                New Visit
              </button>
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("Families")} role="menuitem">
                Families
              </button>
              {role === "admin" && (
                <button type="button" className="menu-item" onClick={() => handleMenuSelect("Users")} role="menuitem">
                  Users
                </button>
              )}
            </div>
          )}
        </div>

        <div className="fu-form-titlewrap">
          <div className="fu-form-title">Form</div>
        </div>

        <button className="icon-btn" aria-label="back" type="button" onClick={onClose}>
          <IconBack className="fu-icon" style={{width: 18, height: 18, color: '#374151', display: 'block' }} />
        </button>
      </header>

      <main className="fu-form-main">
        <form className="fu-form-card" onSubmit={handleSave}>
          {/* date row */}
          <div className="fu-form-date">
            today’s date: <span className="fu-form-date__val">{today}</span>
          </div>

          {/* team select */}
          <label className="fu-field">
            <span className="fu-label">Team</span>
            <select className="fu-input fu-select" required value={team} onChange={(e)=>setTeam(e.target.value)}>
              <option value="" disabled>team name</option>
              <option>Route A</option>
              <option>Route B</option>
              <option>Route C</option>
            </select>
          </label>

          {/* block + unit row */}
          <div className="fu-row-2">
            <label className="fu-field">
              <span className="fu-label">Building / Block:</span>
              <input className="fu-input" placeholder="A" required value={block} onChange={(e)=>setBlock(e.target.value)} />
            </label>
            <label className="fu-field">
              <span className="fu-label">Apt # / House #:</span>
              <input className="fu-input" placeholder="2628" required value={unit} onChange={(e)=>setUnit(e.target.value)} />
            </label>
          </div>

          {/* name */}
          <label className="fu-field">
            <span className="fu-label">Name</span>
            <input className="fu-input" placeholder="Enter" required value={name} onChange={(e)=>setName(e.target.value)} />
          </label>

          {/* age */}
          <label className="fu-field">
            <span className="fu-label">Age</span>
            <input className="fu-input" placeholder="Enter" inputMode="numeric" value={age} onChange={(e)=>setAge(e.target.value.replace(/[^\d]/g,''))} />
          </label>

          {/* follow-up */}
          <label className="fu-field">
            <span className="fu-label">Follow-up</span>
            <input className="fu-input fu-input--muted" placeholder="Enter" value={followUp} onChange={(e)=>setFollowUp(e.target.value)} />
          </label>

          {/* involvement */}
          <label className="fu-field">
            <span className="fu-label">Current involvement</span>
            <input className="fu-input fu-input--muted" placeholder="Enter" value={involvement} onChange={(e)=>setInvolvement(e.target.value)} />
          </label>

          {/* notes */}
          <label className="fu-field">
            <span className="fu-label">Notes</span>
            <textarea className="fu-input fu-textarea fu-input--muted" placeholder="Enter" rows={5} value={notes} onChange={(e)=>setNotes(e.target.value)} />
          </label>

          {error && <div className="fu-error">{error}</div>}
          {!navigator.onLine && (
            <div className="fu-offline-tip">You’re offline. We’ll queue this to send when you’re back online.</div>
          )}
          {wasOfflineQueued && (
            <div className="fu-queued-tip">Saved to device. It’ll sync when online.</div>
          )}

          <button className="fu-save" type="submit" disabled={!requiredOk || saving}>
            {saving ? "Saving..." : "SAVE"}
          </button>
        </form>
      </main>
    </div>
  );
}
