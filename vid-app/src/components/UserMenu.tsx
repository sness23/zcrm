import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/LocalAuthContext';

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
    <div className="relative flex-shrink-0" ref={menuRef}>
      <button
        className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-violet-600 border-2 border-violet-600/30 text-white text-xs font-semibold flex items-center justify-center shadow-lg hover:from-purple-700 hover:to-violet-700 hover:border-violet-700/50 hover:shadow-xl hover:-translate-y-0.5 transition-all"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        {getUserInitials()}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 min-w-60 bg-[#0a0050] border border-[#2a0070] rounded-lg shadow-2xl z-50 overflow-hidden animate-fadeIn">
          <div className="p-4 bg-gradient-to-b from-[#1a0060] to-[#0a0040] border-b border-[#2a0070]">
            <div className="text-sm font-semibold text-gray-200 mb-1 truncate">
              {user?.name || user?.email}
            </div>
            <div className="text-xs text-gray-400 truncate">{user?.email}</div>
          </div>

          <div className="h-px bg-[#2a0070]" />

          <button
            className="w-full flex items-center gap-3 p-3 text-gray-300 text-sm hover:bg-[#1a0060] hover:text-white transition-colors text-left"
            onClick={handleSettings}
          >
            <span className="text-base w-5 flex items-center justify-center">⚙️</span>
            Settings
          </button>

          <div className="h-px bg-[#2a0070]" />

          <button
            className="w-full flex items-center gap-3 p-3 text-gray-300 text-sm hover:bg-[#1a0060] hover:text-white transition-colors text-left"
            onClick={handleSignOut}
          >
            <span className="text-base w-5 flex items-center justify-center">🚪</span>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
