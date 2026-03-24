import { useAuth } from '../contexts/LocalAuthContext';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const handleSignOut = () => {
    logout();
    onClose();
  };

  const getUserInitials = () => {
    if (!user) return '?';
    const name = user.name || user.email;
    if (!name) return '?';
    if (name.includes('@')) {
      return name.charAt(0).toUpperCase();
    }
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose}>
          ✕
        </button>

        <div className="settings-sidebar">
          <div className="settings-nav">
            <div className="settings-nav-section">
              <div className="settings-nav-label">User Settings</div>
              <div className="settings-nav-item active">My Account</div>
              <div className="settings-nav-item">Privacy & Safety</div>
              <div className="settings-nav-item">Notifications</div>
            </div>
            <div className="settings-nav-section">
              <div className="settings-nav-label">App Settings</div>
              <div className="settings-nav-item">Appearance</div>
              <div className="settings-nav-item">Language</div>
            </div>
          </div>

          <div className="settings-user-card">
            <div className="settings-user-avatar">
              {getUserInitials()}
            </div>
            <div className="settings-user-info">
              <div className="settings-user-name">
                {user?.name || 'User'}
              </div>
              <div className="settings-user-email">{user?.email}</div>
            </div>
          </div>
        </div>

        <div className="settings-content">
          <div className="settings-header">
            <h1>My Account</h1>
          </div>

          <div className="settings-body">
            <section className="settings-section">
              <div className="settings-profile-banner">
                <div className="settings-profile-avatar-large">
                  {getUserInitials()}
                </div>
              </div>

              <div className="settings-info-card">
                <div className="settings-info-row">
                  <div className="settings-info-label">Name</div>
                  <div className="settings-info-value">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </div>
                </div>

                <div className="settings-info-divider" />

                <div className="settings-info-row">
                  <div className="settings-info-label">Email</div>
                  <div className="settings-info-value">{user?.email}</div>
                </div>

                <div className="settings-info-divider" />

                <div className="settings-info-row">
                  <div className="settings-info-label">User ID</div>
                  <div className="settings-info-value settings-info-mono">
                    {user?.id}
                  </div>
                </div>

                <div className="settings-info-divider" />

                <div className="settings-info-row">
                  <div className="settings-info-label">Role</div>
                  <div className="settings-info-value">
                    {user?.role || 'user'}
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <button className="settings-logout-button" onClick={handleSignOut}>
                Log Out
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
