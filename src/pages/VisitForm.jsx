import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import menuIcon from '../assets/menu-button.png';
import Autocomplete from '../components/Autocomplete';
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
import './VisitForm.css';

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

  const menuRef = useRef(null);

  // Today's date
  const today = useMemo(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Load teams on mount
  useEffect(() => {
    async function loadTeams() {
      try {
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
      }
    }
    loadTeams();
  }, [role, userTeamId]);

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

  // Fetch the functions for Autocomplete
  async function fetchCommunities(searchTerm) {
    if (!teamId) return [];

    const communities = await getCommunitiesByTeam(teamId);

    if (!searchTerm) return communities;

    const lowerSearch = searchTerm.toLowerCase();
    return communities.filter((c) =>
      c.name.toLowerCase().includes(lowerSearch)
    );
  }

  async function fetchRoutes(searchTerm) {
    if (!selectedCommunity?.id) return [];

    const routes = await getRoutesByCommunity(selectedCommunity.id);

    if (!searchTerm) return routes;

    const lowerSearch = searchTerm.toLowerCase();
    return routes.filter((r) => r.name.toLowerCase().includes(lowerSearch));
  }

  async function fetchBuildings(searchTerm) {
    if (!selectedRoute?.id) return [];

    const buildings = await getBuildingsByRoute(selectedRoute.id);

    if (!searchTerm) return buildings;

    const lowerSearch = searchTerm.toLowerCase();
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(lowerSearch) ||
        b.address?.toLowerCase().includes(lowerSearch)
    );
  }

  // Create functions for Autocomplete
  async function createCommunityItem(name) {
    const newCommunity = await createCommunity(
      name.trim(),
      teamId,
      currentUser.uid
    );
    return newCommunity;
  }

  async function createRouteItem(name) {
    if (!selectedCommunity?.id) {
      throw new Error('Please select a community first');
    }
    const newRoute = await createRoute(
      name.trim(),
      selectedCommunity.id,
      teamId,
      currentUser.uid
    );
    return newRoute;
  }

  async function createBuildingItem(name) {
    if (!selectedRoute?.id) {
      throw new Error('Please select a route first');
    }

    const buildingData = {
      name: name.trim(),
      address: '',
      routeId: selectedRoute.id,
      communityId: selectedCommunity.id,
      teamId,
      units: [],
    };

    const newBuilding = await createBuilding(buildingData, currentUser.uid);
    return newBuilding;
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

  function handleRemovePerson(index) {
    if (people.length > 1) {
      setPeople(people.filter((_, i) => i !== index));
    }
  }

  function handlePersonChange(index, field, value) {
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

      // Ensure unit exists in building
      let buildingId = selectedBuilding.id;
      const currentBuilding = await getBuilding(buildingId);
      const currentUnits = currentBuilding.units || [];

      if (!currentUnits.includes(unitNumber.trim())) {
        const updatedUnits = [...currentUnits, unitNumber.trim()];
        await updateBuilding(buildingId, { units: updatedUnits });
      }

      // Filter out empty people
      const validPeople = people.filter((person) => person.name.trim() !== '');

      const visitData = {
        unitNumber: unitNumber.trim(),
        routeLeaderId: role === 'route_leader' ? currentUser.uid : null,
        people: validPeople,
        notes,
        photoUrls: [],
      };

      await createVisit(buildingId, visitData, currentUser.uid);

      // Success
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to save visit. Please try again.');
      console.error('Error saving visit:', err);
    } finally {
      setSaving(false);
    }
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
    if (item === 'Dashboard') navigate('/');
    if (item === 'Follow-ups') navigate('/visit-history');
  }

  // Field locking
  const isTeamLocked = role !== 'super_admin';
  const isRouteLocked = role === 'route_leader' || role === 'volunteer';

  return (
    <div className="visit-form-overlay" role="dialog" aria-modal="true">
      {/* Top bar */}
      <header className="visit-form-topbar">
        <div className="menu-container" ref={menuRef}>
          <button
            className="menu-button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            type="button"
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
                onClick={() => handleMenuSelect('Dashboard')}
                role="menuitem"
              >
                Dashboard
              </button>
              <button
                type="button"
                className="menu-item"
                onClick={() => handleMenuSelect('Follow-ups')}
                role="menuitem"
              >
                Follow-ups
              </button>
            </div>
          )}
        </div>

        <div className="visit-form-titlewrap">
          <div className="visit-form-title">New Visit</div>
        </div>

        <button
          className="icon-btn"
          aria-label="back"
          type="button"
          onClick={onClose}
        >
          <IconBack
            className="visit-icon"
            style={{
              width: 18,
              height: 18,
              color: '#374151',
              display: 'block',
            }}
          />
        </button>
      </header>

      <main className="visit-form-main">
        <form className="visit-form-card" onSubmit={handleSubmit}>
          {/* Warning banner for users without team assignment */}
          {role !== 'super_admin' && !userTeamId && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#991B1B'
            }}>
              <strong>⚠️ Team Assignment Required</strong>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                You haven't been assigned to a team yet. Please contact your administrator to assign you to a team before recording visits.
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
            <div className="visit-people-label">
              People (at least one required)
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
                  <input
                    className="visit-input visit-col-name"
                    placeholder="Name"
                    value={person.name}
                    onChange={(e) =>
                      handlePersonChange(index, 'name', e.target.value)
                    }
                  />
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
                  />
                  <input
                    className="visit-input visit-col-phone"
                    placeholder="Phone"
                    type="tel"
                    value={person.phone}
                    onChange={(e) =>
                      handlePersonChange(index, 'phone', e.target.value)
                    }
                  />
                  <input
                    className="visit-input visit-col-followup"
                    placeholder="Follow-up notes"
                    value={person.followUp}
                    onChange={(e) =>
                      handlePersonChange(index, 'followUp', e.target.value)
                    }
                  />
                  <input
                    className="visit-input visit-col-involvement"
                    placeholder="Involvement"
                    value={person.involvement}
                    onChange={(e) =>
                      handlePersonChange(index, 'involvement', e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="visit-delete-btn"
                    onClick={() => handleRemovePerson(index)}
                    disabled={people.length <= 1}
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
    </div>
  );
}
