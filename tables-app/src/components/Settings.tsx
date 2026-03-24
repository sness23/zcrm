import { useAuth } from '../contexts/LocalAuthContext';
import './Settings.css';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { user } = useAuth();

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h2>Account Information</h2>
          <div className="settings-table">
            <table>
              <tbody>
                <tr>
                  <td className="settings-label">Email</td>
                  <td className="settings-value">{user?.email}</td>
                </tr>
                <tr>
                  <td className="settings-label">Name</td>
                  <td className="settings-value">
                    {user?.name || 'Not set'}
                  </td>
                </tr>
                <tr>
                  <td className="settings-label">User ID</td>
                  <td className="settings-value settings-value-mono">{user?.id}</td>
                </tr>
                <tr>
                  <td className="settings-label">Account Created</td>
                  <td className="settings-value">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Unknown'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section">
          <h2>Preferences</h2>
          <div className="settings-table">
            <table>
              <tbody>
                <tr>
                  <td className="settings-label">Theme</td>
                  <td className="settings-value">
                    <select className="settings-select" defaultValue="dark">
                      <option value="dark">Dark (Current)</option>
                      <option value="light" disabled>
                        Light (Coming Soon)
                      </option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className="settings-label">Default App</td>
                  <td className="settings-value">
                    <select
                      className="settings-select"
                      defaultValue={localStorage.getItem('tables-app-selected-app') || 'sales'}
                      onChange={(e) => localStorage.setItem('tables-app-selected-app', e.target.value)}
                    >
                      <option value="sales">Sales Cloud</option>
                      <option value="service">Service Cloud</option>
                      <option value="marketing">Marketing Cloud</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="settings-section">
          <h2>About</h2>
          <div className="settings-table">
            <table>
              <tbody>
                <tr>
                  <td className="settings-label">Version</td>
                  <td className="settings-value">1.0.0</td>
                </tr>
                <tr>
                  <td className="settings-label">Environment</td>
                  <td className="settings-value">Development</td>
                </tr>
                <tr>
                  <td className="settings-label">API Endpoint</td>
                  <td className="settings-value settings-value-mono">
                    http://localhost:9600
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
