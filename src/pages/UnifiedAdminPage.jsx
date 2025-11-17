import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminTabs from '../components/admin/AdminTabs';
import UserManagementTab from '../components/admin/UserManagementTab';
import TeamManagementTab from '../components/admin/TeamManagementTab';
import CommunityManagementTab from '../components/admin/CommunityManagementTab';
import RouteManagementTab from '../components/admin/RouteManagementTab';
import BuildingManagementTab from '../components/admin/BuildingManagementTab';
import './AdminStyles.css'; // Shared admin styles
import menuIcon from "../assets/menu-button.png";
import logoHome from "../assets/logo-home-button.png";

export default function UnifiedAdminPage() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ensure view is scrolled to top whenever the admin page mounts or the route within admin changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

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

  // Define available tabs with role-based access
  const tabs = [
    {
      id: 'users',
      label: 'Users',
      icon: '👤',
      roles: ['super_admin', 'team_admin'],
      component: UserManagementTab
    },
    {
      id: 'teams',
      label: 'Teams',
      icon: '🏢',
      roles: ['super_admin'],
      component: TeamManagementTab
    },
    {
      id: 'communities',
      label: 'Communities',
      icon: '🏘️',
      roles: ['super_admin', 'team_admin'],
      component: CommunityManagementTab
    },
    {
      id: 'routes',
      label: 'Routes',
      icon: '🛣️',
      roles: ['super_admin', 'team_admin'],
      component: RouteManagementTab
    },
    {
      id: 'buildings',
      label: 'Buildings',
      icon: '🏠',
      roles: ['super_admin', 'team_admin', 'route_leader'],
      component: BuildingManagementTab
    }
  ];

  // Get initial tab from URL hash or determine default based on role
  function getInitialTab() {
    const hash = location.hash.replace('#', '');
    if (hash && tabs.some(tab => tab.id === hash)) {
      return hash;
    }

    // Default tab based on role
    if (role === 'route_leader') return 'buildings';
    if (role === 'team_admin') return 'users';
    if (role === 'super_admin') return 'users';
    return 'users';
  }

  const [currentTab, setCurrentTab] = useState(getInitialTab());

  // Update current tab when hash changes
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && tabs.some(tab => tab.id === hash)) {
      setCurrentTab(hash);
    }
  }, [location.hash]);

  // Update current tab based on role when role loads
  useEffect(() => {
    if (!authLoading && role) {
      const initialTab = getInitialTab();
      const tabAccessible = tabs.find(tab => tab.id === initialTab)?.roles.includes(role);
      if (!tabAccessible) {
        // Find first accessible tab for this role
        const firstAccessibleTab = tabs.find(tab => tab.roles.includes(role));
        if (firstAccessibleTab) {
          setCurrentTab(firstAccessibleTab.id);
          navigate(`/admin#${firstAccessibleTab.id}`, { replace: true });
        } else {
          // No accessible tabs - redirect to dashboard
          navigate('/');
        }
      }
    }
  }, [role, authLoading]);

  // Check if user has permission to access admin panel
  const canAccessAdmin = role === 'super_admin' || role === 'team_admin' || role === 'route_leader';

  // Redirect if not authorized
  useEffect(() => {
    if (!authLoading && !canAccessAdmin) {
      navigate('/');
    }
  }, [authLoading, canAccessAdmin, navigate]);

  // Get the current tab component
  const CurrentTabComponent = tabs.find(tab => tab.id === currentTab)?.component;

  if (authLoading) {
    return (
      <div className="admin-container">
        <div className="admin-card">
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
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
      <div className="admin-content">
        <div
          className="admin-actions"
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <div>
            <h2 style={{ margin: 0}}>
              Admin Panel
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#6b7280' }}>
              Manage users, teams, and buildings
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <AdminTabs
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        userRole={role}
      />

      {/* Tab Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 2rem 2rem 2rem'
      }}>
        {CurrentTabComponent ? <CurrentTabComponent /> : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            Tab not found
          </div>
        )}
      </div>
    </div>
  );
}