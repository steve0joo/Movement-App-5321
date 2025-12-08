// src/pages/PendingAssignment.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SyncIndicator from '../components/SyncIndicator';
import './Dashboard.css';

export default function PendingAssignment() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>The Movement App</h1>
        <div className="user-info">
          <SyncIndicator />
          <span>{currentUser?.email}</span>
          <button onClick={handleLogout} className="btn-logout">
            Log Out
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '32px',
          backgroundColor: '#fef2f2',
          borderRadius: '12px',
          border: '2px solid #F28668'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <span style={{ fontSize: '48px' }}>⏳</span>
          </div>

          <h2 style={{
            textAlign: 'center',
            color: '#92400E',
            marginBottom: '16px',
            fontSize: '24px'
          }}>
            Account Pending Team Assignment
          </h2>

          <p style={{
            color: '#92400E',
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '16px'
          }}>
            Thank you for creating your account! Your administrator needs to assign you to a team before you can access the application.
          </p>

          <p style={{
            color: '#92400E',
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '24px'
          }}>
            An administrator will review your account and assign you to the appropriate team. You will be able to access all features once your team assignment is complete.
          </p>

          <div style={{
            padding: '16px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#4A8F8C' }}>
              <strong>Account Details:</strong>
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#4A8F8C' }}>
              Email: {currentUser?.email || 'Not available'}
            </p>
          </div>

          <p style={{
            color: '#4E4E57',
            fontSize: '14px',
            textAlign: 'center',
            marginTop: '24px'
          }}>
            If you have questions, please contact your organization administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
