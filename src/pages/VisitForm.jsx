import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  isOfflineModeActive,
  saveLastVisitFormData,
  getLastVisitFormData,
  cacheUserData,
  getCachedTeams,
  getCachedCommunities,
  getCachedRoutes,
  getCachedBuildings,
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
import { getRoutesByCommunity, createRoute } from '../services/routeService';
import { getBuildingsByRoute } from '../services/buildingService';
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

  // Route (not shown in screenshot, but needed for data hierarchy)
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeName, setRouteName] = useState('');

  // Building
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [buildingName, setBuildingName] = useState('');

  // Unit
  const [unitNumber, setUnitNumber] = useState('');

  const [routeLeader, setRouteLeader] = useState('');
  const [notes, setNotes] = useState('');

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
        // Try to load from Firebase (works offline due to Firebase cache)
        if (role === 'super_admin') {
          const allTeams = await getAllTeams();
          setTeams(allTeams);

          // Cache for offline mode (only if the user is assigned)
          if (isOnline && userTeamId) {
            cacheUserData({ userId: currentUser?.uid, teamId: userTeamId, teams: allTeams });
          }
        } else if (userTeamId) {
          const allTeams = await getAllTeams();
          const userTeam = allTeams.find((t) => t.id === userTeamId);
          if (userTeam) {
            setTeams([userTeam]);
            setTeamId(userTeamId);

            // Preload and cache ALL user data when online (for offline access)
            if (isOnline) {
              try {
                // Fetch all communities for this team
                const communities = await getCommunitiesByTeam(userTeamId);

                // Fetch all routes for these communities
                const routePromises = communities.map(c => getRoutesByCommunity(c.id));
                const routeArrays = await Promise.all(routePromises);
                const routes = routeArrays.flat();

                // Fetch all buildings for these routes
                const buildingPromises = routes.map(r => getBuildingsByRoute(r.id));
                const buildingArrays = await Promise.all(buildingPromises);
                const buildings = buildingArrays.flat();

                // Cache everything at once
                cacheUserData({
                  userId: currentUser?.uid,
                  teamId: userTeamId,
                  teams: [userTeam],
                  communities,
                  routes,
                  buildings,
                });

                console.log('📦 Preloaded all user data for offline access');
              } catch (preloadErr) {
                console.error('Error preloading user data:', preloadErr);
                // Still cache just the team if preload fails
                cacheUserData({ userId: currentUser?.uid, teamId: userTeamId, teams: [userTeam] });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading teams:', err);

        // If offline and Firebase cache fails, try LocalStorage cache
        if (!isOnline) {
          const cachedTeams = getCachedTeams();
          if (cachedTeams.length > 0) {
            setTeams(cachedTeams);
            if (userTeamId) {
              setTeamId(userTeamId);
            }
            console.log('📦 Loaded teams from offline cache');
          }
        }
      }
    }
    loadTeams();
  }, [role, userTeamId, isOnline, currentUser]);

  // Auto-fill the form with the last saved data (for the offline mode)
  useEffect(() => {
    const lastFormData = getLastVisitFormData();
    if (lastFormData) {
      // Only auto-fill if fields are empty
      if (!communityName && lastFormData.communityName) {
        setCommunityName(lastFormData.communityName);
        if (lastFormData.communityId) {
          setSelectedCommunity({
            id: lastFormData.communityId,
            name: lastFormData.communityName,
          });
        }
      }
      if (!routeName && lastFormData.routeName) {
        setRouteName(lastFormData.routeName);
        if (lastFormData.routeId) {
          setSelectedRoute({
            id: lastFormData.routeId,
            name: lastFormData.routeName,
          });
        }
      }
      if (!buildingName && lastFormData.buildingName) {
        setBuildingName(lastFormData.buildingName);
        if (lastFormData.buildingId) {
          setSelectedBuilding({
            id: lastFormData.buildingId,
            name: lastFormData.buildingName,
          });
        }
      }
      if (!unitNumber && lastFormData.unitNumber) {
        setUnitNumber(lastFormData.unitNumber);
      }
    }
  }, []); // Only run on mount

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

  // Auto-fill route leader
  useEffect(() => {
    if (role === 'route_leader' && currentUser) {
      setRouteLeader(
        currentUser.displayName || currentUser.email || 'Route Leader'
      );
    }
  }, [role, currentUser]);

  // Fetch functions for Autocomplete with caching
  async function fetchCommunities(searchTerm) {
    if (!teamId) return [];

    try {
      const communities = await getCommunitiesByTeam(teamId);

      // Cache communities when online and user is assigned
      if (isOnline && userTeamId) {
        cacheUserData({
          userId: currentUser?.uid,
          teamId: userTeamId,
          communities,
        });
      }

      if (!searchTerm) return communities;

      const lowerSearch = searchTerm.toLowerCase();
      return communities.filter((c) =>
        c.name.toLowerCase().includes(lowerSearch)
      );
    } catch (err) {
      console.error('Error fetching communities:', err);

      // If offline and Firebase fails, try cached data
      if (!isOnline) {
        const cachedCommunities = getCachedCommunities();
        if (cachedCommunities.length > 0) {
          console.log('Loaded communities from offline cache');
          return searchTerm
            ? cachedCommunities.filter((c) =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : cachedCommunities;
        }
      }
      return [];
    }
  }

  async function fetchRoutes(searchTerm) {
    if (!selectedCommunity?.id) return [];

    try {
      const routes = await getRoutesByCommunity(selectedCommunity.id);

      // Cache routes when online and the user is assigned
      if (isOnline && userTeamId) {
        cacheUserData({
          userId: currentUser?.uid,
          teamId: userTeamId,
          routes,
        });
      }

      if (!searchTerm) return routes;

      const lowerSearch = searchTerm.toLowerCase();
      return routes.filter((r) => r.name.toLowerCase().includes(lowerSearch));
    } catch (err) {
      console.error('Error fetching routes:', err);

      // If offline and Firebase fails, try cached data
      if (!isOnline) {
        const cachedRoutes = getCachedRoutes();
        // Filter by selected community
        const filteredRoutes = cachedRoutes.filter(
          (r) => r.communityId === selectedCommunity.id
        );

        if (filteredRoutes.length > 0) {
          console.log('Loaded routes from offline cache');
          return searchTerm
            ? filteredRoutes.filter((r) =>
                r.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : filteredRoutes;
        }
      }
      return [];
    }
  }

  async function fetchBuildings(searchTerm) {
    if (!selectedRoute?.id) {
      console.log('fetchBuildings: No route selected');
      return [];
    }

    try {
      console.log(
        'fetchBuildings: Fetching buildings for route',
        selectedRoute.id,
        selectedRoute.name
      );
      const buildings = await getBuildingsByRoute(selectedRoute.id);
      console.log(
        'fetchBuildings: Found',
        buildings.length,
        'buildings:',
        buildings
      );

      // Cache buildings when online and user is assigned
      if (isOnline && userTeamId) {
        cacheUserData({
          userId: currentUser?.uid,
          teamId: userTeamId,
          buildings,
        });
      }

      if (!searchTerm) return buildings;

      const lowerSearch = searchTerm.toLowerCase();
      const filtered = buildings.filter(
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
      console.error('Error fetching buildings:', err);

      // If offline and Firebase fails, try cached data
      if (!isOnline) {
        const cachedBuildings = getCachedBuildings();
        // Filter by selected route
        const filteredBuildings = cachedBuildings.filter(
          (b) => b.routeId === selectedRoute.id
        );

        if (filteredBuildings.length > 0) {
          console.log('📦 Loaded buildings from offline cache');
          return searchTerm
            ? filteredBuildings.filter(
                (b) =>
                  b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  b.address?.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : filteredBuildings;
        }
      }
      return [];
    }
  }

  // Create functions for autocomplete with validations
  async function createCommunityItem(name) {
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
      return newCommunity;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new Error(`Invalid community name: ${err.message}`);
      }
      throw err;
    }
  }

  async function createRouteItem(name) {
    if (!selectedCommunity?.id) {
      throw new Error('Please select a community first');
    }

    try {
      // Validate and sanitize the route name
      const sanitizedName = validateName(name, {
        required: true,
        minLength: 1,
        maxLength: 100,
        fieldName: 'Route name',
      });

      const newRoute = await createRoute(
        sanitizedName,
        selectedCommunity.id,
        teamId,
        currentUser.uid
      );
      return newRoute;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new Error(`Invalid route name: ${err.message}`);
      }
      throw err;
    }
  }

  async function createBuildingItem(name) {
    if (!selectedRoute?.id) {
      throw new Error('Please select a route first');
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
        routeId: selectedRoute.id,
        communityId: selectedCommunity.id,
        teamId,
        units: [],
      };

      const newBuilding = await createBuilding(buildingData, currentUser.uid);
      return newBuilding;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw new Error(`Invalid building name: ${err.message}`);
      }
      throw err;
    }
  }

  // Handle selections
  function handleCommunitySelect(community) {
    setSelectedCommunity(community);
    setCommunityName(community.name);
    // Reset downstream
    setSelectedRoute(null);
    setRouteName('');
    setSelectedBuilding(null);
    setBuildingName('');
    setUnitNumber('');
  }

  function handleRouteSelect(route) {
    setSelectedRoute(route);
    setRouteName(route.name);
    // Reset downstream
    setSelectedBuilding(null);
    setBuildingName('');
    setUnitNumber('');
  }

  function handleBuildingSelect(building) {
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

    if (!selectedRoute) {
      setError('Please select or create a route');
      return false;
    }

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
        routeLeaderId: role === 'route_leader' ? currentUser.uid : null,
        people: validPeople,
        notes: sanitizedNotes,
        photoUrls: [],
      };

      // Create visit - this works offline (Firebase queues the write)
      await createVisit(buildingId, visitData, currentUser.uid);

      // Save form data to LocalStorage for auto-fill on next visit
      saveLastVisitFormData({
        teamId,
        teamName: teams.find((t) => t.id === teamId)?.name || '',
        communityId: selectedCommunity.id,
        communityName: selectedCommunity.name,
        routeId: selectedRoute.id,
        routeName: selectedRoute.name,
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
    setSelectedRoute(null);
    setRouteName('');
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
            />
          </label>

          {/* Route field */}
          <label className="visit-field">
            <span className="visit-label">Route</span>
            <Autocomplete
              value={routeName}
              onChange={setRouteName}
              onSelect={handleRouteSelect}
              fetchOptions={fetchRoutes}
              onCreate={createRouteItem}
              placeholder="Search or create route..."
              disabled={!selectedCommunity}
            />
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
                disabled={!selectedRoute}
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

          {/* Route Leader */}
          {role === 'route_leader' && (
            <label className="visit-field">
              <span className="visit-label">Route Leader</span>
              <input
                className="visit-input visit-input--readonly"
                value={routeLeader}
                readOnly
                disabled
              />
            </label>
          )}

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
                  <input
                    className="visit-input visit-col-followup"
                    placeholder="Follow-up notes"
                    value={person.followUp}
                    onChange={(e) =>
                      handlePersonChange(index, 'followUp', e.target.value)
                    }
                    readOnly={!!person.locked}
                    disabled={!!person.locked}
                  />
                  <input
                    className="visit-input visit-col-involvement"
                    placeholder="Involvement"
                    value={person.involvement}
                    onChange={(e) =>
                      handlePersonChange(index, 'involvement', e.target.value)
                    }
                    readOnly={!!person.locked}
                    disabled={!!person.locked}
                  />

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
