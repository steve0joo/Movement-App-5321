import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../services/firebase";
import FollowUpForm from "./FollowUpForm";
import "./FollowUps.css";

/* Inline icons (immune to external icon libs) */
const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);
const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);
const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M21 21l-4.3-4.3M4 10.5a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);
const IconFilter = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 6h18M6 12h12M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);
const IconTrash = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>
);
const IconEdit = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
  </svg>
);

/* UI fallback so the page renders even if Firestore is empty */
const FALLBACK = [
  { id: "1", name: "Maria Lopez", lastActivity: "2025-10-12T21:41:00Z", urgency: 3, team: "Route A", block:"A", unit:"2628", age:43, followUp:"N/A", involvement:"N/A", notes:"—" },
  { id: "2", name: "James Park", lastActivity: "2025-10-11T16:10:00Z", urgency: 2, team: "Route B", block:"3", unit:"18B", age:35, followUp:"Call next week", involvement:"Occasional", notes:"—" },
  { id: "3", name: "Amina Yusuf", lastActivity: "2025-10-01T12:00:00Z", urgency: 1, team: "Route C", block:"12", unit:"7C", age:29, followUp:"N/A", involvement:"N/A", notes:"—" },
  { id: "4", name: "Samir Khan", lastActivity: "2025-09-30T08:45:00Z", urgency: 2 },
  { id: "5", name: "Grace Kim", lastActivity: "2025-09-22T14:20:00Z", urgency: 1 },
];

export default function FollowUps() {
  const [showForm, setShowForm] = useState(false);
    // try to upload any offline-saved forms when back online
    useEffect(() => {
      function tryFlush() {
        if (!navigator.onLine) return;
        try {
          const key = "fu_outbox";
          const rows = JSON.parse(localStorage.getItem(key) || "[]");
          if (!rows.length) return;
          Promise.all(rows.map(r => addDoc(collection(db, "followups"), r)))
            .then(() => localStorage.removeItem(key))
            .catch(() => {});
        } catch {}
      }
      tryFlush();
      window.addEventListener("online", tryFlush);
      return () => window.removeEventListener("online", tryFlush);
    }, []);
  
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [qText, setQText] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [sortMode, setSortMode] = useState("urgent"); // "urgent" | "recent"
  const [expandedId, setExpandedId] = useState(null);

  // delete + undo state
  const [undoData, setUndoData] = useState(null); // { item, index, timer }
  const undoTimerRef = useRef(null);

  useEffect(() => {
    const qRef = query(
      collection(db, "followups"),
      orderBy("lastActivity", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        if (snap.empty) {
          setPeople(FALLBACK);
        } else {
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            // ensure urgency exists (0 = least urgent)
            urgency: typeof d.data().urgency === "number" ? d.data().urgency : 0,
            __fromFirestore: true,
          }));
          setPeople(rows);
        }
        setLoading(false);
      },
      () => {
        setPeople(FALLBACK);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    const base = people.filter((p) => {
      const matchesText =
        !t ||
        (p.name && String(p.name).toLowerCase().includes(t)) ||
        (p.block && String(p.block).toLowerCase().includes(t)) ||
        (p.unit && String(p.unit).toLowerCase().includes(t));
      const matchesTeam = !teamFilter || p.team === teamFilter;
      const matchesRoute = !routeFilter || p.route === routeFilter || p.team === routeFilter;
      return matchesText && matchesTeam && matchesRoute;
    });

    // Client ask: most urgent → least urgent (default)
    if (sortMode === "urgent") {
      return [...base].sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0));
    }
    // recent → older
    return [...base].sort(
      (a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)
    );
  }, [people, qText, teamFilter, routeFilter, sortMode]);

  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));

  // Delete with 5s undo; Firestore delete occurs after the window unless undone
  const handleDelete = async (item, index) => {
    // remove from UI immediately
    setPeople((prev) => prev.filter((p) => p.id !== item.id));

    // show undo
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const timer = setTimeout(async () => {
      try {
        if (item.__fromFirestore) {
          await deleteDoc(doc(db, "followups", item.id));
        }
      } catch (e) {
        console.error("Delete failed", e);
      } finally {
        setUndoData(null);
        undoTimerRef.current = null;
      }
    }, 5000);

    undoTimerRef.current = timer;
    setUndoData({ item, index, timer });
  };

  const handleUndo = async () => {
    if (!undoData) return;
    clearTimeout(undoData.timer);
    undoTimerRef.current = null;

    // restore in UI
    setPeople((prev) => {
      const cp = [...prev];
      cp.splice(undoData.index, 0, undoData.item);
      return cp;
    });

    // restore in Firestore if it existed there
    try {
      if (undoData.item.__fromFirestore) {
        await setDoc(doc(db, "followups", undoData.item.id), undoData.item);
      }
    } catch (e) {
      console.error("Undo restore failed", e);
    } finally {
      setUndoData(null);
    }
  };

  return (
    <div className="dash-shell">
      {/* Small spacer to mimic status bar if needed */}
      <div className="status-spacer" />

      {/* Top bar: left menu, center brand, right + */}
      <header className="topbar">
        <button className="icon-btn" aria-label="menu">
          <IconMenu className="fu-icon" />
        </button>

        <div className="brand-chip" aria-label="Movement">
          <span>M</span>
        </div>

        <button
          className="icon-btn add-btn"
          aria-label="add follow-up"
          onClick={() => setShowForm(true)}
        >
          <IconPlus className="fu-icon" />
        </button>
      </header>

      {showForm && (
        <FollowUpForm
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      <main className="content">
        <h1 className="fu-title">Follow-up</h1>

        {/* Search */}
        <div className="search-wrap">
          <IconSearch className="fu-icon fu-muted" />
          <input
            className="search-input"
            placeholder="Search"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
        </div>

        {/* Filters */}
        <button className="filter-btn" onClick={() => setFiltersOpen((s) => !s)}>
          <IconFilter className="fu-icon fu-muted" />
          <span>Edit filters</span>
        </button>

        {filtersOpen && (
          <div className="filters-panel">
            <div className="filter-row">
              <label>Team</label>
              <input
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                placeholder="e.g., Route A"
              />
            </div>
            <div className="filter-row">
              <label>Route</label>
              <input
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                placeholder="e.g., Route B"
              />
            </div>
            <div className="filter-row">
              <label>Sort</label>
              <select
                className="sort-select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
              >
                <option value="urgent">Most urgent first</option>
                <option value="recent">Most recent first</option>
              </select>
            </div>
          </div>
        )}

        {/* List */}
        <section className="cards">
          {loading && <div className="loading">Loading…</div>}
          {!loading && filtered.length === 0 && <div className="empty">No results</div>}

          {filtered.map((p, idxInFiltered) => {
            const open = expandedId === p.id;
            // original index in people (for precise undo insert position)
            const originalIndex = people.findIndex((x) => x.id === p.id);

            return (
              <article key={p.id} className={`fu-card ${open ? "open" : ""}`}>
                {/* Header — click to toggle */}
                <header
                  className="fu-card-head"
                  onClick={() => toggle(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault(); toggle(p.id);
                    }
                  }}
                  aria-expanded={open}
                >
                  <div className="fu-name">
                    {p.name ?? "name"}
                  </div>

                  <button
                    className="fu-more-btn"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(p.id); }}
                    aria-label={open ? "Show less" : "Show more"}
                  >
                    <span>{open ? "less" : "…more"}</span>
                    <svg className={`fu-chev ${open ? "rot" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </button>
                </header>

                {open ? (
                  <div className="fu-card-body" onClick={(e)=>e.stopPropagation()}>
                    <div className="fu-meta">
                      {p.date && <div><span className="label">Date:</span> {p.date}</div>}
                      {p.team && <div><span className="label">Team name:</span> {p.team}</div>}
                      {p.block && <div><span className="label">Building/Block:</span> {p.block}</div>}
                      {p.unit && <div><span className="label">Apt # / House #:</span> {p.unit}</div>}
                      {p.age && <div><span className="label">Age:</span> {p.age}</div>}
                      {(p.followUp ?? "") !== "" && <div><span className="label">Follow-up:</span> {p.followUp}</div>}
                      {(p.involvement ?? "") !== "" && <div><span className="label">Current involvement:</span> {p.involvement}</div>}
                      <div><span className="label">Notes:</span></div>
                      <p className="fu-notes">{p.notes ?? "—"}</p>
                    </div>

                    <div className="row-actions">
                      <button className="edit-btn" title="Edit">
                        <IconEdit className="fu-icon" />
                      </button>
                      <button
                        className="del-btn"
                        title="Delete"
                        onClick={() => handleDelete(p, originalIndex >= 0 ? originalIndex : idxInFiltered)}
                      >
                        <IconTrash className="fu-icon" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="fu-footer">
                    {p.lastActivity ?? "—"}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>

      {/* Undo toast */}
      {undoData && (
        <div className="undo-toast" role="status" aria-live="polite">
          Follow-up deleted.
          <button className="undo-btn" onClick={handleUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
