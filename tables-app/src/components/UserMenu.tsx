import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/LocalAuthContext';
import './UserMenu.css';

interface UserMenuProps {
  onSettingsClick: () => void;
}

export default function UserMenu({ onSettingsClick }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '?';

    // Try to get name from user metadata
    const name = user?.name || user.email;

    if (!name) return '?';

    // If it's an email, use first letter
    if (name.includes('@')) {
      return name.charAt(0).toUpperCase();
    }

    // If it's a name, get initials
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    return name.charAt(0).toUpperCase();
  };

  const handleSignOut = async () => {
    logout();
    setIsOpen(false);
  };

  const handleSettings = () => {
    onSettingsClick();
    setIsOpen(false);
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-avatar"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        {getUserInitials()}
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <div className="user-dropdown-name">
              {user?.name || user?.email}
            </div>
            <div className="user-dropdown-email">{user?.email}</div>
          </div>

          <div className="user-dropdown-divider" />

          <button className="user-dropdown-item" onClick={handleSettings}>
            <span className="user-dropdown-icon">⚙️</span>
            Settings
          </button>

          <div className="user-dropdown-divider" />

          <button className="user-dropdown-item" onClick={handleSignOut}>
            <span className="user-dropdown-icon">🚪</span>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
