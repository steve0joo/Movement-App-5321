import { useNavigate, useLocation } from 'react-router-dom';
import './AdminTabs.css';

export default function AdminTabs({ tabs, currentTab, onTabChange, userRole }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Filter tabs based on user role
  const visibleTabs = tabs.filter(tab => tab.roles.includes(userRole));

  function handleTabClick(tabId) {
    onTabChange(tabId);
    // Update URL hash
    navigate(`/admin#${tabId}`, { replace: true });
  }

  return (
    <div className="admin-tabs">
      <div className="admin-tabs-container">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="admin-tab-icon">{tab.icon}</span>
            <span className="admin-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
