import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  collection,
  collectionGroup,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { getBuilding } from '../services/buildingService';
import { isOfflineModeActive, getOfflineVisits, deleteOfflineItem } from '../utils/offlineStorage';
import './FollowUps.css';
import menuIcon from '../assets/menu-button.png';
import logoHome from '../assets/logo-home-button.png';
import editIcon from '../assets/edit-button.png';
import trashIcon from '../assets/trash-button.png';

/* Inline icons (immune to external icon libs) */
const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M3 6h18M3 12h18M3 18h18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M21 21l-4.3-4.3M4 10.5a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
const IconFilter = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M3 6h18M6 12h12M10 18h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
const IconTrash = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
const IconEdit = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
      fill="currentColor"
    />
  </svg>
);

/* UI fallback so the page renders even if Firestore is empty */
const FALLBACK = [];

export default function FollowUps() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // close menu on outside click / Esc
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function toggleMenu(e) {
    e?.stopPropagation();
    setMenuOpen((s) => !s);
  }

  function handleMenuSelect(item) {
    setMenuOpen(false);
    if (item === 'Users') navigate('/admin/users');
    // other items intentionally non-functional for now
  }

  // Note: Offline sync is now handled by syncService.js

  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [buildingNames, setBuildingNames] = useState({});
  const [qText, setQText] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [teamFilter, setTeamFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // delete + undo state
  const [undoData, setUndoData] = useState(null); // { item, index, timer }
  const undoTimerRef = useRef(null);

  useEffect(() => {
    const offlineMode = isOfflineModeActive();

    if (offlineMode) {
      // Load offline visits
      const offlineData = getOfflineVisits();
      setPeople(offlineData.map((item) => ({
        ...item,
        buildingName: item.buildingName || 'Unknown',
        lastActivity: item.visitDate || item.createdAt,
      })));
      setLoading(false);
      return;
    }

    // Online mode - query all visits from building subcollections using collectionGroup
    const qRef = query(
      collectionGroup(db, 'visits'),
      orderBy('visitDate', 'desc')
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        if (snap.empty) {
          setPeople(FALLBACK);
        } else {
          const rows = snap.docs.map((d) => {
            const data = d.data();
            // Extract building ID from the document reference path
            // Path format: buildings/{buildingId}/visits/{visitId}
            const buildingId = d.ref.parent.parent?.id;

            return {
              id: d.id,
              buildingId,
              ...data,
              lastActivity: data.visitDate?.toDate?.() || data.createdAt?.toDate?.() || new Date(),
              __fromFirestore: true,
            };
          });
          setPeople(rows);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error loading visits:', error);
        setPeople(FALLBACK);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Fetch building names for all unique buildingIds in people
  useEffect(() => {
    const fetchBuildingNames = async () => {
      const uniqueBuildingIds = [...new Set(people.map(p => p.buildingId).filter(Boolean))];

      if (uniqueBuildingIds.length === 0) return;

      const nameMap = {};
      await Promise.all(
        uniqueBuildingIds.map(async (buildingId) => {
          try {
            const building = await getBuilding(buildingId);
            nameMap[buildingId] = building?.name || `Building ${buildingId.substring(0, 8)}...`;
          } catch (error) {
            console.error(`Error fetching building ${buildingId}:`, error);
            nameMap[buildingId] = `Building ${buildingId.substring(0, 8)}...`;
          }
        })
      );

      setBuildingNames(prev => ({ ...prev, ...nameMap }));
    };

    fetchBuildingNames();
  }, [people]);

  const filtered = useMemo(() => {
    const t = qText.trim().toLowerCase();
    const base = people.filter((p) => {
      const matchesText =
        !t ||
        (p.unitNumber && String(p.unitNumber).toLowerCase().includes(t)) ||
        (p.notes && String(p.notes).toLowerCase().includes(t)) ||
        (p.buildingId && String(p.buildingId).toLowerCase().includes(t));
      const matchesTeam = !teamFilter || p.teamId === teamFilter || p.team === teamFilter;
      const matchesRoute = !routeFilter || p.routeId === routeFilter || p.route === routeFilter;
      return matchesText && matchesTeam && matchesRoute;
    });

    // Most recent → older (default sort by visit date)
    return [...base].sort(
      (a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)
    );
  }, [people, qText, teamFilter, routeFilter]);

  const toggle = (id) => setExpandedId((cur) => (cur === id ? null : id));

  // Delete with 5s undo; Firestore delete occurs after the window unless undone
  const handleDelete = async (item, index) => {
    // remove from UI immediately
    setPeople((prev) => prev.filter((p) => p.id !== item.id));

    // show undo
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const timer = setTimeout(async () => {
      try {
        if (item.__fromFirestore && item.buildingId) {
          // Delete from Firestore visits subcollection
          await deleteDoc(doc(db, 'buildings', item.buildingId, 'visits', item.id));
        } else if (item.isOffline) {
          // Delete from offline storage
          deleteOfflineItem(item.id, 'visit');
        }
      } catch (e) {
        console.error('Delete failed', e);
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

    setUndoData(null);
    // Note: Undo restore to Firestore is not implemented for visits
    // Visits would need to be re-created which is complex
  };

  return (
    <div className="dash-shell">
      {/* Small spacer to mimic status bar if needed */}
      {/* <div className="status-spacer" /> */}

      {/* Top bar: left menu, center brand*/}
      <header className="topbar">
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            onClick={toggleMenu}
          >
            <img
              src={menuIcon}
              alt="Menu"
              style={{ height: 18, display: 'block' }}
            />
          </button>

          {menuOpen && (
            <div
              className="menu-dropdown"
              role="menu"
              aria-orientation="vertical"
            >
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('New Visit')}
                role="menuitem"
              >
                New Visit
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('Families')}
                role="menuitem"
              >
                Families
              </button>

              {(role === 'super_admin' || role === 'team_admin') && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuSelect('Users')}
                  role="menuitem"
                >
                  Users
                </button>
              )}
            </div>
          )}
        </div>

        <button
          className="logo-home"
          onClick={() => navigate('/')}
          title="Home"
          aria-label="Go to dashboard"
        >
          <img
            src={logoHome}
            alt="Home"
            style={{ height: 36, display: 'block' }}
          />
        </button>
      </header>

      <main className="content">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            margin: '0px 0 20px',
          }}
        >
          <h2 style={{ margin: 0 }}>Visit History</h2>
          <button
            className="add-btn"
            aria-label="Record new visit"
            onClick={() => navigate('/visits/new')}
            title="Record new visit"
            style={{ marginLeft: 12 }}
          >
            <IconPlus className="fu-icon" />
          </button>
        </div>

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
        <button
          className="filter-btn"
          onClick={() => setFiltersOpen((s) => !s)}
        >
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
                placeholder="Filter by team ID"
              />
            </div>
            <div className="filter-row">
              <label>Route</label>
              <input
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                placeholder="Filter by route ID"
              />
            </div>
          </div>
        )}

        {/* List */}
        <section className="cards">
          {loading && <div className="loading">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="empty">No results</div>
          )}

          {filtered.map((p, idxInFiltered) => {
            const open = expandedId === p.id;
            // original index in people (for precise undo insert position)
            const originalIndex = people.findIndex((x) => x.id === p.id);

            return (
              <article key={p.id} className={`fu-card ${open ? 'open' : ''}`}>
                {/* Header — click to toggle */}
                <header
                  className="fu-card-head"
                  onClick={() => toggle(p.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(p.id);
                    }
                  }}
                  aria-expanded={open}
                >
                  <div className="fu-name">Unit {p.unitNumber ?? 'Unknown'}</div>

                  <button
                    className="fu-more-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(p.id);
                    }}
                    aria-label={open ? 'Show less' : 'Show more'}
                  >
                    <span>{open ? 'less' : '…more'}</span>
                    <svg
                      className={`fu-chev ${open ? 'rot' : ''}`}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 10l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </button>
                </header>

                {open ? (
                  <div
                    className="fu-card-body"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="fu-meta">
                      {p.visitDate && (
                        <div>
                          <span className="label">Visit Date:</span>{' '}
                          {p.visitDate?.toDate ? p.visitDate.toDate().toLocaleDateString() : new Date(p.visitDate).toLocaleDateString()}
                        </div>
                      )}
                      {p.buildingId && (
                        <div>
                          <span className="label">Building:</span> {buildingNames[p.buildingId] || p.buildingId}
                        </div>
                      )}
                      {p.unitNumber && (
                        <div>
                          <span className="label">Unit Number:</span> {p.unitNumber}
                        </div>
                      )}
                      <div>
                        <span className="label">Notes:</span>
                      </div>
                      <p className="fu-notes">{p.notes ?? '—'}</p>
                      {p.photoUrls && p.photoUrls.length > 0 && (
                        <div>
                          <span className="label">Photos:</span> {p.photoUrls.length} photo(s)
                        </div>
                      )}
                    </div>

                    <div className="row-actions">
                      <button
                        className="del-btn"
                        title="Delete"
                        aria-label={`Delete visit for unit ${p.unitNumber || ''}`}
                        onClick={() =>
                          handleDelete(
                            p,
                            originalIndex >= 0 ? originalIndex : idxInFiltered
                          )
                        }
                      >
                        <img
                          src={trashIcon}
                          alt="Delete"
                          style={{ width: 18, height: 18, display: 'block' }}
                        />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="fu-footer">
                    {p.lastActivity ?
                      (p.lastActivity instanceof Date ?
                        p.lastActivity.toLocaleDateString() :
                        new Date(p.lastActivity).toLocaleDateString()
                      ) : '—'
                    }
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
          Visit deleted.
          <button className="undo-btn" onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
