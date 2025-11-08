import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { seedAllData, firestoreDocumentExamples } from '../utils/seedData';
import './Login.css'; // Reuse login styles for consistent look

export default function SeedDataPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdIds, setCreatedIds] = useState(null);
  const { currentUser, role } = useAuth();
  const navigate = useNavigate();

  // Check if user is super_admin
  const isSuperAdmin = role === 'super_admin';

  async function handleSeedData() {
    if (!isSuperAdmin) {
      setError('Only super administrators can seed data');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setCreatedIds(null);

    try {
      const ids = await seedAllData(currentUser.uid);
      setCreatedIds(ids);
      setSuccess('✅ Database seeded successfully! See created IDs below.');
    } catch (err) {
      console.error('Seed error:', err);
      setError(`Failed to seed database: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '800px' }}>
        <h1>🌱 Seed Database</h1>
        <p className="subtitle">Populate Firestore with example data</p>

        {/* Permission warning */}
        {!isSuperAdmin && (
          <div className="offline-notice" style={{ backgroundColor: '#ff6b6b' }}>
            ⚠️ Access Denied: Only super administrators can seed the database.
          </div>
        )}

        {/* Info section */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          textAlign: 'left'
        }}>
          <h3 style={{ marginTop: 0 }}>What will be created:</h3>
          <ul style={{ marginBottom: 0 }}>
            <li><strong>3 Teams</strong>: Gwinnett Team, Atlanta Team, Nashville Team</li>
            <li><strong>4 Communities</strong>: Oak Ridge Apartments, Waterford Complex, etc.</li>
            <li><strong>4 Routes</strong>: Route A, Route B, North Route, South Route</li>
          </ul>
          <p style={{ marginTop: '15px', marginBottom: 0, fontSize: '14px', color: '#666' }}>
            <strong>Note:</strong> This will create new documents in your Firestore database.
            Make sure you're connected to the correct Firebase project.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="error-message" style={{ marginBottom: '15px' }}>
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div style={{
            backgroundColor: '#d4edda',
            color: '#155724',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #c3e6cb'
          }}>
            {success}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button
            onClick={handleSeedData}
            disabled={loading || !isSuperAdmin}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {loading ? '🌱 Seeding Database...' : '🌱 Seed Database'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{
              flex: 1,
              backgroundColor: '#6c757d',
              opacity: loading ? 0.5 : 1
            }}
            disabled={loading}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Created IDs display */}
        {createdIds && (
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            textAlign: 'left',
            marginTop: '20px'
          }}>
            <h3 style={{ marginTop: 0 }}>Created Document IDs:</h3>
            <pre style={{
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(createdIds, null, 2)}
            </pre>
          </div>
        )}

        {/* Example data structure */}
        <details style={{
          marginTop: '20px',
          textAlign: 'left',
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
            📖 View Example Document Structures
          </summary>
          <div style={{ marginTop: '15px' }}>
            <h4>Teams Collection:</h4>
            <pre style={{
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(firestoreDocumentExamples.team, null, 2)}
            </pre>

            <h4 style={{ marginTop: '15px' }}>Communities Collection:</h4>
            <pre style={{
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(firestoreDocumentExamples.community, null, 2)}
            </pre>

            <h4 style={{ marginTop: '15px' }}>Routes Collection:</h4>
            <pre style={{
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(firestoreDocumentExamples.route, null, 2)}
            </pre>

            <h4 style={{ marginTop: '15px' }}>Buildings Collection:</h4>
            <pre style={{
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(firestoreDocumentExamples.building, null, 2)}
            </pre>

            <h4 style={{ marginTop: '15px' }}>Users Collection:</h4>
            <pre style={{
              backgroundColor: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '11px',
              border: '1px solid #dee2e6'
            }}>
              {JSON.stringify(firestoreDocumentExamples.user, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}
