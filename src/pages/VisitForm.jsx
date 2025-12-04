import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  isOfflineModeActive,
  saveLastVisitFormData,
} from '../utils/offlineStorage';
import {
  validateName,
  validateAge,
  validatePhone,
  validateText,
  sanitizeString,
  ValidationError,
} from '../utils/validation';
import menuIcon from '../assets/menu-button.png';
import Autocomplete from '../components/Autocomplete';
import MemberRecord from './MemberRecord';
import MemberRecordsList from './MemberRecordsList';
import {
  createVisit,
  getPastPeopleAtUnit,
  createBuilding,
  updateBuilding,
  getBuilding,
} from '../services/buildingService';
import { getAllTeams } from '../services/teamService';
import {
  getCommunitiesByTeam,
  createCommunity,
} from '../services/communityService';
import { getBuildingsByCommunity } from '../services/buildingService';
import {
  getFollowUpsByTeam,
  getInvolvementsByTeam,
} from '../services/communityInvolvementService';
import { getAllRouteLeaders } from '../services/userService';
import './header.css';
import './VisitForm.css';
import logoHome from '../assets/logo-home-button.png';

// Inline icons
const IconBack = (p) => (
  <svg viewBox="0 0 24 24" {...p}>
    <path
      d="M15 18l-6-6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" {...p}>
    <path
      d="M12 5v14M5 12h14"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const IconTrash = (p) => (
  <svg viewBox="0 0 24 24" {...p}>
    <path
      d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function VisitForm({ onClose, onSaved }) {
  const {
    currentUser,
    role,
    teamId: userTeamId,
    routeId: userRouteId,
  } = useAuth();
  const { isOnline } = useSync();
  const navigate = useNavigate();

  // Form state
  const [teamId, setTeamId] = useState(userTeamId || '');
  const [teams, setTeams] = useState([]);

  // Community
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [communityName, setCommunityName] = useState('');

  // Route Leader (replaces Route)
  const [routeLeaders, setRouteLeaders] = useState([]);
  const [selectedRouteLeader, setSelectedRouteLeader] = useState(null);

  // Building
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [buildingName, setBuildingName] = useState('');

  // Unit
  const [unitNumber, setUnitNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Follow-up and involvement options
  const [followUpOptions, setFollowUpOptions] = useState([]);
  const [involvementOptions, setInvolvementOptions] = useState([]);

  // People table state
  const [people, setPeople] = useState([
    { name: '', age: '', phone: '', followUp: '', involvement: '' },
    { name: '', age: '', phone: '', followUp: '', involvement: '' },
    { name: '', age: '', phone: '', followUp: '', involvement: '' },
  ]);
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingPastPeople, setLoadingPastPeople] = useState(false);
  const [selectedPersonForRecord, setSelectedPersonForRecord] = useState(null);
  const [showRecordsList, setShowRecordsList] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null
  const [submitMessage, setSubmitMessage] = useState('');

  const menuRef = useRef(null);

  // Today's date
  const today = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Load teams on mount and cache all user data for offline use
  useEffect(() => {
    async function loadTeams() {
      try {
        // Load from Firebase (works offline automatically via Firebase persistence)
        if (role === 'super_admin') {
          const allTeams = await getAllTeams();
          setTeams(allTeams);
        } else if (userTeamId) {
          const allTeams = await getAllTeams();
          const userTeam = allTeams.find((t) => t.id === userTeamId);
          if (userTeam) {
            setTeams([userTeam]);
            setTeamId(userTeamId);
          }
        }
      } catch (err) {
        console.error('Error loading teams:', err);
        // Firebase offline persistence will retry when back online
      }
    }
    loadTeams();
  }, [role, userTeamId, isOnline, currentUser]);

  // Load follow-up and involvement options when team changes
  useEffect(() => {
    async function loadOptions() {
      if (!teamId) {
        setFollowUpOptions([]);
        setInvolvementOptions([]);
        return;
      }

      try {
        const [followUps, involvements] = await Promise.all([
          getFollowUpsByTeam(teamId),
          getInvolvementsByTeam(teamId),
        ]);
        setFollowUpOptions(followUps);
        setInvolvementOptions(involvements);
      } catch (err) {
        console.error('Error loading follow-up/involvement options:', err);
      }
    }
    loadOptions();
  }, [teamId]);

  // Load route leaders when team changes
  useEffect(() => {
    async function loadRouteLeaders() {
      if (!teamId) {
        setRouteLeaders([]);
        setSelectedRouteLeader(null);
        return;
      }

      try {
        const allLeaders = await getAllRouteLeaders();
        // Filter to only route leaders in the selected team
        const teamLeaders = allLeaders.filter(leader => leader.teamId === teamId);
        setRouteLeaders(teamLeaders);
      } catch (err) {
        console.error('Error loading route leaders:', err);
      }
    }
    loadRouteLeaders();
  }, [teamId]);

  // Note: Form is always empty on load (both online and offline)
  // Cached data is only used to speed up the autocomplete suggestions when offline
  // Users must manually type to search and select from suggestions

  // Load past people when building + unit selected
  useEffect(() => {
    async function loadPastPeople() {
      if (!selectedBuilding?.id || !unitNumber) return;

      try {
        setLoadingPastPeople(true);
        const pastPeople = await getPastPeopleAtUnit(
          selectedBuilding.id,
          unitNumber
        );

        if (pastPeople.length > 0) {
          const newPeople = pastPeople.map((person) => ({
            name: person.name,
            age: person.age || '',
            phone: person.phone || '',
            followUp: person.followUp || '',
            involvement: person.involvement || '',
          }));

          while (newPeople.length < 3) {
            newPeople.push({
              name: '',
              age: '',
              phone: '',
              followUp: '',
              involvement: '',
            });
          }

          setPeople(newPeople);
        }
      } catch (err) {
        console.error('Error loading past people:', err);
      } finally {
        setLoadingPastPeople(false);
      }
    }

    loadPastPeople();
  }, [selectedBuilding, unitNumber]);

  // Fetch functions for Autocomplete with cache-first optimization
  // Use preferCache when offline for instant response
  const fetchCommunities = useCallback(async (searchTerm) => {
    if (!teamId) return [];

    try {
      const communities = await getCommunitiesByTeam(teamId, !isOnline);

      // Filter out any invalid entries (null, undefined, false, etc.)
      const validCommunities = (communities || []).filter(c => c && c.id && c.name);

      console.log('📦 Fetched communities:', {
        count: validCommunities.length,
        offline: !isOnline,
        teamId,
        sample: validCommunities[0]
      });

      if (!searchTerm) return validCommunities;

      const lowerSearch = searchTerm.toLowerCase();
      return validCommunities.filter((c) =>
        c.name.toLowerCase().includes(lowerSearch)
      );
    } catch (err) {
      console.error('❌ Error fetching communities:', err);
      return [];
    }
  }, [teamId, isOnline]);

  const fetchBuildings = useCallback(async (searchTerm) => {
    if (!selectedCommunity?.id) {
      console.log('fetchBuildings: No community selected');
      return [];
    }

    try {
      console.log(
        'fetchBuildings: Fetching buildings for community',
        selectedCommunity.id
      );

      // Fetch all buildings in the community
      const buildings = await getBuildingsByCommunity(selectedCommunity.id);

      // Filter out any invalid entries
      const validBuildings = (buildings || []).filter(b => b && b.id && b.name);

      console.log('📦 Fetched buildings:', {
        count: validBuildings.length,
        offline: !isOnline,
        communityId: selectedCommunity.id,
        sample: validBuildings[0]
      });

      if (!searchTerm) return validBuildings;

      const lowerSearch = searchTerm.toLowerCase();
      const filtered = validBuildings.filter(
        (b) =>
          b.name.toLowerCase().includes(lowerSearch) ||
          b.address?.toLowerCase().includes(lowerSearch)
      );
      console.log(
        'fetchBuildings: Filtered to',
        filtered.length,
        'buildings matching',
        searchTerm
      );
      return filtered;
    } catch (err) {
      console.error('❌ Error fetching buildings:', err);
      return [];
    }
  }, [selectedCommunity?.id, isOnline]);

  // Create functions for autocomplete with validations
  const createCommunityItem = useCallback(async (name) => {
    // Type check the name parameter first
    console.log('🔍 createCommunityItem called with:', { name, type: typeof name });

    if (!name || typeof name !== 'string') {
      console.error('❌ Invalid name parameter type:', { name, type: typeof name });
      throw new Error(`Invalid input: Expected string, got ${typeof name}`);
    }

    // Validate ALL parameters before creating (especially important offline!)
    if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
      throw new Error('Team ID is required to create a community');
    }
    if (!currentUser?.uid || typeof currentUser.uid !== 'string' || currentUser.uid.trim() === '') {
      throw new Error('User authentication is required to create a community');
    }

    try {
      // Validate and sanitize community name
      const sanitizedName = validateName(name, {
        required: true,
        minLength: 1,
        maxLength: 100,
        fieldName: 'Community name',
      });

      const newCommunity = await createCommunity(
        sanitizedName,
        teamId,
        currentUser.uid
      );

      // Validate returned object to catch any corruption
      if (!newCommunity || typeof newCommunity !== 'object' ||
          !newCommunity.id || typeof newCommunity.id !== 'string' ||
          !newCommunity.name || typeof newCommunity.name !== 'string') {
        console.error('❌ Invalid community created:', newCommunity);
        throw new Error('Failed to create community: server returned invalid data');
      }

      return newCommunity;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new Error(`Invalid community name: ${err.message}`);
      }
      throw err;
    }
  }, [teamId, currentUser?.uid]);

  const createBuildingItem = useCallback(async (name) => {
    // Type check the name parameter first
    console.log('🔍 createBuildingItem called with:', { name, type: typeof name });

    if (!name || typeof name !== 'string') {
      console.error('❌ Invalid name parameter type:', { name, type: typeof name });
      throw new Error(`Invalid input: Expected string, got ${typeof name}`);
    }

    // Validate ALL parameters before creating (especially important offline!)
    // Route is now optional - removed route validation
    if (!selectedCommunity?.id || typeof selectedCommunity.id !== 'string' || selectedCommunity.id.trim() === '') {
      throw new Error('Please select a valid community first');
    }
    if (!teamId || typeof teamId !== 'string' || teamId.trim() === '') {
      throw new Error('Team ID is required to create a building');
    }
    if (!currentUser?.uid || typeof currentUser.uid !== 'string' || currentUser.uid.trim() === '') {
      throw new Error('User authentication is required to create a building');
    }

    try {
      // Validate and sanitize the building name
      const sanitizedName = validateName(name, {
        required: true,
        minLength: 1,
        maxLength: 100,
        fieldName: 'Building name',
      });

      const buildingData = {
        name: sanitizedName,
        address: '',
        routeId: null, // No longer using routes - buildings are community-based
        communityId: selectedCommunity.id,
        teamId,
        units: [],
      };

      const newBuilding = await createBuilding(buildingData, currentUser.uid);

      // Validate returned object to catch any corruption
      if (!newBuilding || typeof newBuilding !== 'object' ||
          !newBuilding.id || typeof newBuilding.id !== 'string' ||
          !newBuilding.name || typeof newBuilding.name !== 'string') {
        console.error('❌ Invalid building created:', newBuilding);
        throw new Error('Failed to create building: server returned invalid data');
      }

      return newBuilding;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new Error(`Invalid building name: ${err.message}`);
      }
      throw err;
    }
  }, [selectedCommunity?.id, teamId, currentUser?.uid]);

  // Handle selections
  function handleCommunitySelect(community) {
    // Validate the community object before setting it
    if (!community || typeof community !== 'object' ||
        !community.id || typeof community.id !== 'string' ||
        !community.name || typeof community.name !== 'string') {
      console.error('❌ Invalid community object received:', community);
      setError('Invalid community selected. Please try again.');
      return;
    }

    setSelectedCommunity(community);
    setCommunityName(community.name);
    // Reset downstream
    setSelectedRouteLeader(null);
    setSelectedBuilding(null);
    setBuildingName('');
    setUnitNumber('');
  }

  function handleBuildingSelect(building) {
    // Validate the building object before setting it
    if (!building || typeof building !== 'object' ||
        !building.id || typeof building.id !== 'string' ||
        !building.name || typeof building.name !== 'string') {
      console.error('❌ Invalid building object received:', building);
      setError('Invalid building selected. Please try again.');
      return;
    }

    setSelectedBuilding(building);
    setBuildingName(building.name);
    setUnitNumber('');
  }

  // People table functions
  function handleAddPerson() {
    setPeople([
      ...people,
      { name: '', age: '', phone: '', followUp: '', involvement: '' },
    ]);
  }

  // Lock/unlock a person row for editing
  function togglePersonEdit(index) {
    setPeople((prev) =>
      prev.map((p, i) => (i === index ? { ...p, locked: !p.locked } : p))
    );
  }

  function handleRemovePerson(index) {
    // Don't allow removing a row that has been saved/locked
    if (people[index]?.locked) return;
    if (people.length > 1) {
      setPeople(people.filter((_, i) => i !== index));
    }
  }

  function handlePersonChange(index, field, value) {
    // Prevent editing locked (saved) rows
    if (people[index]?.locked) return;
    const newPeople = [...people];
    newPeople[index] = { ...newPeople[index], [field]: value };
    setPeople(newPeople);
  }

  // Validate and submit
  function validateForm() {
    if (!selectedCommunity) {
      setError('Please select or create a community');
      return false;
    }

    // Route is now optional - removed validation

    if (!selectedBuilding) {
      setError('Please select or create a building');
      return false;
    }

    if (!unitNumber.trim()) {
      setError('Please enter a unit number');
      return false;
    }

    const hasValidPerson = people.some((person) => person.name.trim() !== '');
    if (!hasValidPerson) {
      setError('Please enter at least one person with a name');
      return false;
    }

    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm() || saving) return;

    try {
      setSaving(true);
      setError('');

      // If offline, show immediate feedback after brief delay
      if (!isOnline) {
        setTimeout(() => {
          setSubmitStatus('success');
          setSubmitMessage(
            "Offline Mode: Visit saved locally! It will sync to the server when you're back online."
          );
          setSaving(false);
        }, 100);
      }

      let buildingId = selectedBuilding.id;

      // When offline, skip reading building data (Firebase will queue all writes)
      // When online, it will ensure the unit exists in building's units array
      if (isOnline) {
        try {
          const currentBuilding = await getBuilding(buildingId);
          const currentUnits = currentBuilding?.units || [];

          if (!currentUnits.includes(unitNumber.trim())) {
            const updatedUnits = [...currentUnits, unitNumber.trim()];
            await updateBuilding(buildingId, { units: updatedUnits });
          }
        } catch (err) {
          console.warn('Could not update building units (offline?):', err);
          // Continue anyway (Firebase will handle offline writing)
        }
      }

      // Filter out empty people and validate/sanitize each person's data
      const validPeople = people
        .filter((person) => person.name.trim() !== '')
        .map((person) => {
          try {
            return {
              name: validateName(person.name, {
                required: true,
                maxLength: 100,
                fieldName: 'Person name',
              }),
              age: validateAge(person.age, { required: false }),
              phone: validatePhone(person.phone, { required: false }),
              followUp:
                validateText(person.followUp, {
                  required: false,
                  maxLength: 500,
                  fieldName: 'Follow-up notes',
                }) || '',
              involvement:
                validateText(person.involvement, {
                  required: false,
                  maxLength: 500,
                  fieldName: 'Involvement',
                }) || '',
            };
          } catch (err) {
            if (err instanceof ValidationError) {
              throw new Error(
                `Invalid data for ${person.name}: ${err.message}`
              );
            }
            throw err;
          }
        });

      // Sanitize and validate the unit number and notes
      const sanitizedUnitNumber = sanitizeString(unitNumber, {
        maxLength: 20,
        allowEmpty: false,
      });
      const sanitizedNotes =
        validateText(notes, {
          required: false,
          maxLength: 2000,
          fieldName: 'Notes',
        }) || '';

      const visitData = {
        unitNumber: sanitizedUnitNumber,
        routeLeaderId: selectedRouteLeader?.id || null,
        people: validPeople,
        notes: sanitizedNotes,
        photoUrls: [],
      };

      // Create visit - this works offline (Firebase queues the write)
      // Pass routeId from selected route leader (if they have one assigned)
      await createVisit(buildingId, visitData, currentUser.uid, selectedRouteLeader?.routeId || null);

      // Save form data to LocalStorage for auto-fill on next visit
      saveLastVisitFormData({
        teamId,
        teamName: teams.find((t) => t.id === teamId)?.name || '',
        communityId: selectedCommunity.id,
        communityName: selectedCommunity.name,
        routeLeaderId: selectedRouteLeader?.id || null,
        buildingId: selectedBuilding.id,
        buildingName: selectedBuilding.name,
        unitNumber: sanitizedUnitNumber,
      });

      // Lock rows that were filled so they become uneditable after save
      setPeople((prev) =>
        prev.map((p) =>
          p.name && p.name.trim() !== '' ? { ...p, locked: true } : p
        )
      );

      // Success - show the appropriate message based on connection status
      // Only show success message for online saves (offline already shown above)
      if (isOnline) {
        setSubmitStatus('success');
        setSubmitMessage('Visit recorded successfully!');
      }
      onSaved?.();
    } catch (err) {
      // Error - show the error modal
      setSubmitStatus('error');
      setSubmitMessage(
        err.message || 'Failed to save visit. Please try again.'
      );
      console.error('Error saving visit:', err);
    } finally {
      // Only set saving to false for online saves (offline already handled)
      if (isOnline) {
        setSaving(false);
      }
    }
  }

  // Handle modal actions
  function handleStayOnPage() {
    setSubmitStatus(null);
    setSubmitMessage('');
    // Reset form for new visit
    setSelectedCommunity(null);
    setCommunityName('');
    setSelectedRouteLeader(null);
    setSelectedBuilding(null);
    setBuildingName('');
    setUnitNumber('');
    setNotes('');
    setPeople([
      { name: '', age: '', phone: '', followUp: '', involvement: '' },
      { name: '', age: '', phone: '', followUp: '', involvement: '' },
      { name: '', age: '', phone: '', followUp: '', involvement: '' },
    ]);
    setError('');
  }

  function handleGoToDashboard() {
    setSubmitStatus(null);
    setSubmitMessage('');
    navigate('/');
  }

  // Menu functions
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
    if (item === 'Home') navigate('/');
    if (item === 'Visit History') navigate('/visit-history');
    if (item === 'Admin Page') navigate('/admin');
  }

  // Field locking
  const isTeamLocked = role !== 'super_admin';
  const isRouteLocked = role === 'route_leader' || role === 'volunteer';

  // Adaptive debounce: faster when offline (cache is instant)
  const debounceDelay = isOnline ? 100 : 50;

  return (
    <div className="visit-form-overlay" role="dialog" aria-modal="true">
      {/* Top bar */}
      <header className="all-header">
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
            <div
              className="menu-dropdown"
              role="menu"
              aria-orientation="vertical"
            >
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('Home')}
                role="menuitem"
              >
                Home
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('Visit History')}
                role="menuitem"
              >
                Visit History
              </button>
              {(role === 'super_admin' ||
                role === 'team_admin' ||
                role === 'route_leader') && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => handleMenuSelect('Admin Page')}
                  role="menuitem"
                >
                  Admin Page
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
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <img
            src={logoHome}
            alt="Home"
            style={{ height: 36, display: 'block' }}
          />
        </button>
      </header>

      <main className="visit-form-main">
        <form className="visit-form-card" onSubmit={handleSubmit}>
          {/* Warning banner for users without team assignment (but skip for offline mode) */}
          {role !== 'super_admin' && !userTeamId && !isOfflineModeActive() && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                color: '#991B1B',
              }}
            >
              <strong>⚠️ Team Assignment Required</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                You haven't been assigned to a team yet. Please contact your
                administrator to assign you to a team before recording visits.
              </p>
            </div>
          )}

          {/* Date */}
          <div className="visit-form-date">
            Date: <span className="visit-form-date__val">{today}</span>
          </div>

          {/* Team dropdown */}
          <label className="visit-field">
            <span className="visit-label">Team</span>
            <select
              className="visit-input visit-select"
              required
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                // Reset all downstream
                setSelectedCommunity(null);
                setCommunityName('');
                setSelectedRoute(null);
                setRouteName('');
                setSelectedBuilding(null);
                setBuildingName('');
                setUnitNumber('');
              }}
              disabled={isTeamLocked}
            >
              <option value="" disabled>
                Select team
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          {/* Community field */}
          <label className="visit-field">
            <span className="visit-label">Community</span>
            <Autocomplete
              value={communityName}
              onChange={setCommunityName}
              onSelect={handleCommunitySelect}
              fetchOptions={fetchCommunities}
              onCreate={createCommunityItem}
              placeholder="Search or create community..."
              disabled={!teamId}
              minCreateLength={3}
              debounceDelay={debounceDelay}
            />
          </label>

          {/* Route Leader field */}
          <label className="visit-field">
            <span className="visit-label">
              Route Leader <span style={{ fontWeight: 'normal', color: '#666' }}>(Optional)</span>
            </span>
            <select
              className="visit-input"
              value={selectedRouteLeader?.id || ''}
              onChange={(e) => {
                const leader = routeLeaders.find(l => l.id === e.target.value);
                setSelectedRouteLeader(leader || null);
              }}
              disabled={!teamId || routeLeaders.length === 0}
            >
              <option value="">No route leader</option>
              {routeLeaders.map((leader) => (
                <option key={leader.id} value={leader.id}>
                  {leader.displayName || leader.email || 'Unknown'}
                </option>
              ))}
            </select>
          </label>

          {/* Building/Block and Apt#/House# on same line */}
          <div className="visit-field-row">
            <label className="visit-field visit-field-building">
              <span className="visit-label">Building/Block</span>
              <Autocomplete
                value={buildingName}
                onChange={setBuildingName}
                onSelect={handleBuildingSelect}
                fetchOptions={fetchBuildings}
                onCreate={createBuildingItem}
                placeholder="Search or create building..."
                disabled={!selectedCommunity}
                minCreateLength={1}
                debounceDelay={debounceDelay}
                renderOption={(building) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{building.name}</div>
                  </div>
                )}
              />
            </label>

            <label className="visit-field visit-field-unit">
              <span className="visit-label">Apt #/House #</span>
              <input
                className="visit-input"
                list="unit-options"
                placeholder="Enter unit..."
                required
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                disabled={!selectedBuilding}
              />
              {selectedBuilding?.units && selectedBuilding.units.length > 0 && (
                <datalist id="unit-options">
                  {selectedBuilding.units.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              )}
            </label>
          </div>

          {/* Loading past people */}
          {loadingPastPeople && (
            <div className="visit-loading-people">Loading past visitors...</div>
          )}

          {/* People table */}
          <div className="visit-people-section">
            <div className="visit-people-header-row">
              <div className="visit-people-label">
                People (at least one required)
              </div>
              {selectedBuilding && unitNumber && (
                <button
                  type="button"
                  className="visit-view-past-records-btn"
                  onClick={() => setShowRecordsList(true)}
                  title="View past member records for this unit"
                >
                  📋 View Past Records
                </button>
              )}
            </div>

            <div className="visit-people-table">
              <div className="visit-people-header">
                <div className="visit-col-name">Name</div>
                <div className="visit-col-age">Age</div>
                <div className="visit-col-phone">Phone</div>
                <div className="visit-col-followup">Follow-up</div>
                <div className="visit-col-involvement">Current Involvement</div>
                <div className="visit-col-actions"></div>
              </div>

              {people.map((person, index) => (
                <div key={index} className="visit-people-row">
                  <div className="visit-col-name visit-name-wrapper">
                    <input
                      className="visit-input"
                      placeholder="Name"
                      value={person.name}
                      onChange={(e) =>
                        handlePersonChange(index, 'name', e.target.value)
                      }
                      readOnly={!!person.locked}
                      disabled={!!person.locked}
                    />
                    {person.name && selectedBuilding && unitNumber && (
                      <button
                        type="button"
                        className="visit-view-record-btn"
                        onClick={() => setSelectedPersonForRecord(person)}
                        title="View member record"
                      >
                        📋
                      </button>
                    )}
                  </div>
                  <input
                    className="visit-input visit-col-age"
                    placeholder="Age"
                    type="number"
                    min="0"
                    max="150"
                    value={person.age}
                    onChange={(e) =>
                      handlePersonChange(index, 'age', e.target.value)
                    }
                    readOnly={!!person.locked}
                    disabled={!!person.locked}
                  />
                  <input
                    className="visit-input visit-col-phone"
                    placeholder="Phone"
                    type="tel"
                    value={person.phone}
                    onChange={(e) =>
                      handlePersonChange(index, 'phone', e.target.value)
                    }
                    readOnly={!!person.locked}
                    disabled={!!person.locked}
                  />
                  <select
                    className="visit-input visit-col-followup"
                    value={person.followUp}
                    onChange={(e) =>
                      handlePersonChange(index, 'followUp', e.target.value)
                    }
                    disabled={!!person.locked}
                  >
                    <option value="">Select follow-up...</option>
                    {followUpOptions.map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="visit-input visit-col-involvement"
                    value={person.involvement}
                    onChange={(e) =>
                      handlePersonChange(index, 'involvement', e.target.value)
                    }
                    disabled={!!person.locked}
                  >
                    <option value="">Select involvement...</option>
                    {involvementOptions.map((option) => (
                      <option key={option.id} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>

                  {/* Edit button: shown when the row is locked so user can unlock for editing */}
                  {person.locked && (
                    <button
                      type="button"
                      className="visit-delete-btn"
                      onClick={() => togglePersonEdit(index)}
                      aria-label="Edit person"
                      title="Edit"
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    className="visit-delete-btn"
                    onClick={() => handleRemovePerson(index)}
                    disabled={people.length <= 1 || !!person.locked}
                    aria-label="Delete person"
                  >
                    <IconTrash style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="visit-add-person-btn"
                onClick={handleAddPerson}
              >
                <IconPlus style={{ width: 16, height: 16, marginRight: 4 }} />
                Add Person
              </button>
            </div>
          </div>

          {/* Notes */}
          <label className="visit-field">
            <span className="visit-label">Notes</span>
            <textarea
              className="visit-input visit-textarea"
              placeholder="General visit notes..."
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {/* Error */}
          {error && <div className="visit-error">{error}</div>}

          {/* Submit */}
          <button className="visit-save" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'SAVE'}
          </button>
        </form>
      </main>

      {/* Member Record Modal */}
      {selectedPersonForRecord && selectedBuilding && unitNumber && (
        <MemberRecord
          person={selectedPersonForRecord}
          buildingId={selectedBuilding.id}
          unitNumber={unitNumber}
          onClose={() => setSelectedPersonForRecord(null)}
        />
      )}

      {/* Member Records List Modal */}
      {showRecordsList && selectedBuilding && unitNumber && (
        <MemberRecordsList
          buildingId={selectedBuilding.id}
          unitNumber={unitNumber}
          onClose={() => setShowRecordsList(false)}
        />
      )}

      {/* Success/Error Modal */}
      {submitStatus && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{submitStatus === 'success' ? '✅ Success' : '❌ Error'}</h3>
            </div>
            <div className="modal-body">
              <p>{submitMessage}</p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={handleStayOnPage}
              >
                Record Another Visit
              </button>
              <button
                type="button"
                className="btn-confirm"
                onClick={handleGoToDashboard}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
