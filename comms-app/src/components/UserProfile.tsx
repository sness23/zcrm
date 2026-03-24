import { useAuth } from '../contexts/LocalAuthContext';
import './UserProfile.css';

interface UserProfileProps {
  onSettingsClick: () => void;
}

export default function UserProfile({ onSettingsClick }: UserProfileProps) {
  const { user, logout } = useAuth();

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

  const getUserDisplayName = () => {
    return user?.name || user?.email?.split('@')[0] || 'User';
  };

  const getUserStatus = () => {
    return 'Online';
  };

  return (
    <div className="user-profile">
      <div className="user-profile-content">
        <div className="user-profile-avatar">
          {getUserInitials()}
        </div>
        <div className="user-profile-info">
          <div className="user-profile-name">{getUserDisplayName()}</div>
          <div className="user-profile-status">
            <span className="status-indicator"></span>
            {getUserStatus()}
          </div>
        </div>
        <button
          className="user-profile-logout"
          onClick={logout}
          title="Sign Out"
        >
          🚪
        </button>
        <button
          className="user-profile-settings"
          onClick={onSettingsClick}
          title="User Settings"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
