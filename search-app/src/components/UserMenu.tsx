import { useState, useRef, useEffect } from 'react';
import './UserMenu.css';

interface UserMenuProps {
  onSettingsClick?: () => void;
}

export default function UserMenu({ onSettingsClick }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSettingsClick = () => {
    setIsOpen(false);
    onSettingsClick?.();
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-avatar"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        <span className="avatar-text">U</span>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-info">
              <div className="user-name">User</div>
              <div className="user-email">user@doi.bio</div>
            </div>
          </div>

          <div className="user-menu-divider"></div>

          {onSettingsClick && (
            <button className="user-menu-item" onClick={handleSettingsClick}>
              <span className="menu-icon">⚙️</span>
              Settings
            </button>
          )}

          <button className="user-menu-item" onClick={() => setIsOpen(false)}>
            <span className="menu-icon">🏠</span>
            Home
          </button>

          <div className="user-menu-divider"></div>

          <button className="user-menu-item" onClick={() => setIsOpen(false)}>
            <span className="menu-icon">🚪</span>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
