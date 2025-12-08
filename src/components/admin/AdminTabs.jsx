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
      {tabs
        .filter(tab => tab.roles.includes(userRole))
        .map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={tab.id === currentTab ? 'tab-button active' : 'tab-button'}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
    </div>
  );
}
