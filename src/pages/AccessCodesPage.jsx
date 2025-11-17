import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import "./AccessCodesPage.css";
import menuIcon from "../assets/menu-button.png";
import logoHome from "../assets/logo-home-button.png";
import trashIcon from "../assets/trash-button.png";

const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>
);
const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/><circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
);
const IconCopy = (p) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}><rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/><rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none"/></svg>
);

export default function AccessCodesPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
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
    if (item === "Dashboard") navigate("/");
    // keep other items as placeholders
  }

  // TODO: Load access codes from Firestore instead of hardcoded data
  // For now, initialize with empty array until backend integration is complete
  const [codes, setCodes] = useState([]);
  const [q, setQ] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    // ensure the page is at the top when this view mounts
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  // filtering removed — always show full codes list

  const handleCopy = async (c) => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      setTimeout(() => { if (mounted.current) setCopiedId(null); }, 1400);
    } catch (e) { /* ignore */ }
  };

  const confirmDelete = (c) => setDeleteConfirm(c);
  const cancelDelete = () => setDeleteConfirm(null);
  const doDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      // Delete user from Firebase Auth and Firestore
      if (deleteConfirm.firebaseUid) {
        await deleteDoc(doc(db, "users", deleteConfirm.firebaseUid));
        // For now, just delete from Firestore and mark as inactive
      }
      
      // Remove from local state
      setCodes(s => s.filter(x => x.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      
    } catch (error) {
      console.error("Error deleting access code:", error);
      alert("Failed to delete access code. Please try again.");
    }
  };

  // This function creates a random 5-digit number should not already exist
  // We only check against codes currently loaded in the page to keep it simple
  const generateUniqueCode = async () => {
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      // Make a random number between 10000 and 99999. Will always be 5 digits or so
      code = Math.floor(10000 + Math.random() * 90000).toString();
      
      // Check if we already have this code in our current list
      const existsInState = codes.some(c => c.code === code);
      
      isUnique = !existsInState;
      
    }
    
    return code;
  };

  // The main function that creates a new access code for volunteers
  const createCode = async () => {
    // Don't let people spam the create button
    if (isCreating) return;
    
    setIsCreating(true);
    
    try {
      // First, generate a unique 5-digit code
      const accessCode = await generateUniqueCode();
      
      // Create a document in Firestore that represents this access code
      // This contains all the info needed for someone to log in with this code
      const accessCodeData = {
        code: accessCode,
        role: "volunteer", // All codes are for volunteers to use only
        isActive: true, // This code can be used
        isUsed: false, // Nobody has logged in with it yet
        isAccessCodeUser: true, // This marks it as an access code user 
        createdAt: new Date(),
        createdBy: auth.currentUser?.uid, // Remember who created this code
        createdByRole: role, // Remember what role they had when they created it
        teamId: "", // Can be assigned to a team later
        usedBy: null, // Will be filled in when someone uses the code
        usedAt: null,
        email: `volunteer_${accessCode}@temp.movement.app` // Temporary email for Firebase Auth
      };
      
      // Save this to the database using the access code as the document ID
      // should make it easier to look up later when someone tries to log in
      await setDoc(doc(db, "users", accessCode), accessCodeData);
      
      // Add the new code to our local list so it shows up on the page immediately
      const newCodeEntry = {
        id: accessCode,
        code: accessCode,
        team: "Unassigned", // Will show "Unassigned" until assigned to a team
        firebaseUid: null // Will be filled in when someone first uses the code
      };
      
      // Add to the top of the list so it's easy to see the newest codes
      setCodes(s => [newCodeEntry, ...s]);
      
    } catch (error) {
      console.error("Error creating access code:", error);
      alert(`Failed to create access code: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // This function runs when the page first loads to get all existing access codes from our database
  useEffect(() => {
    const loadAccessCodes = async () => {
      try {
        console.log("Loading existing access codes...");
        
        // Look for all documents in the users collection that are marked as access codes and 
        // are still considered active
        const q = query(
          collection(db, "users"), 
          where("isAccessCodeUser", "==", true),
          where("isActive", "==", true)
        );
        const snapshot = await getDocs(q);
        
        // Convert the documents into a viable format for the page
        const loadedCodes = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedCodes.push({
            id: doc.id, // Access code (aka document ID)
            code: data.code, // The actual 5-digit code to display
            team: data.teamId || "Unassigned", // Show team name or "Unassigned"
            firebaseUid: doc.id, // Keep track of the database ID
            isUsed: data.isUsed || false, // see if someone has used this code yet
            createdAt: data.createdAt
          });
        });
        
        // Replace the dummy data with real data from the database
        setCodes(loadedCodes);
        console.log(`Loaded ${loadedCodes.length} access codes`);
        
      } catch (error) {
        console.error("Error loading access codes:", error);
        // Keeps the dummy data if loading has failed 
      }
    };
    
    loadAccessCodes();
  }, []);

  // enable search by Team Name (case-insensitive)
  const filteredCodes = q.trim()
    ? codes.filter((c) => c.team.toLowerCase().includes(q.trim().toLowerCase()))
    : codes;

  return (
    <div className="access-shell">
      <header className="access-header">
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            onClick={toggleMenu}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            type="button"
          >
            <img src={menuIcon} alt="Menu" />
          </button>

          {menuOpen && (
            <div className="menu-dropdown" role="menu" aria-orientation="vertical">
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("New Visit")} role="menuitem">
                New Visit
              </button>
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("Families")} role="menuitem">
                Families
              </button>
              <button type="button" className="menu-item" onClick={() => handleMenuSelect("Dashboard")} role="menuitem">
                Dashboard
              </button>
            </div>
          )}
        </div>

        <button
          className="logo-home"
          onClick={() => navigate("/")}
          title="Home"
          aria-label="Go to dashboard"
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <img src={logoHome} alt="Home" style={{ height: 36, display: "block" }} />
        </button>

        <div className="admin-info">
          <span className="admin-badge">Admin</span>
        </div>
      </header>

      <div>
        <div className="access-info">
          <h2 className="access-title">Access Codes</h2>

          <button 
            className="btn-primary" 
            onClick={createCode} 
            disabled={isCreating}
            aria-label="Create Code" 
            title="Create Code"
          >
            <IconPlus width={16} height={16} />
            {isCreating && <span style={{ marginLeft: '5px' }}>Creating...</span>}
          </button>
        </div>

        <form className="search-row" onSubmit={(e)=>e.preventDefault()}>
          <IconSearch className="fu-icon" />
          <input
            className="search-input"
            placeholder="Search team"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            aria-label="Search access codes"
          />
        </form>

        <div className="codes-table">
          <div className="codes-row table-head">
            <div className="cell cell-check"><input type="checkbox" disabled /></div>
            <div className="cell cell-code">Access Code</div>
            <div className="cell cell-team">Team Name</div>
            <div className="cell cell-actions" />
          </div>

          {filteredCodes.map((c) => (
             <div key={c.id} className="codes-row">
               <div className="cell cell-check"><input type="checkbox" aria-label={`Select ${c.code}`} /></div>
               <div className="cell cell-code">
                 <span className="code-value">{c.code}</span>
                 <button className="copy-btn" onClick={() => handleCopy(c)} title="Copy code" aria-label={`Copy ${c.code}`}>
                   <IconCopy width={16} height={16} />
                 </button>
                 {copiedId === c.id && <span className="copied-bubble">Copied</span>}
               </div>
               <div className="cell cell-team">{c.team}</div>
               <div className="cell cell-actions">
                 <button className="btn-delete" onClick={() => confirmDelete(c)} title="Delete">
                  <img src={trashIcon} alt="Delete" style={{ width: 16, height: 16, display: 'block' }} />
                 </button>
               </div>
             </div>
          ))}
        </div>

        {deleteConfirm && (
          <div className="modal-overlay" onClick={cancelDelete}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm Deletion</h3>
              <p>Delete access code <strong>{deleteConfirm.code}</strong> for <strong>{deleteConfirm.team}</strong>?</p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={cancelDelete}>Cancel</button>
                <button className="btn-delete" onClick={doDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}