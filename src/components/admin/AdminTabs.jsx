// src/components/admin/AdminTabs.jsx
import { useNavigate } from 'react-router-dom';
import './AdminTabs.css';

export default function AdminTabs({ tabs, currentTab, onTabChange, userRole }) {
  const navigate = useNavigate();

  // Only show tabs that this role can access
  const visibleTabs = tabs.filter((tab) =>
    tab.roles ? tab.roles.includes(userRole) : true
  );

  function handleTabClick(tabId) {
    onTabChange(tabId);
    // keep /admin#tab-id in the URL
    navigate(`/admin#${tabId}`, { replace: true });
  }

  return (
    <div className="admin-tabs">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => handleTabClick(tab.id)}
          className={`admin-tab ${
            tab.id === currentTab ? 'is-active' : ''
          }`}
        >
          {tab.icon && (
            <span className="admin-tab-icon" aria-hidden="true">
              {tab.icon}
            </span>
          )}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
