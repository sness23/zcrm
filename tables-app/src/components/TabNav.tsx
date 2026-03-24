import { useState, useRef, useEffect } from 'react';
import type { EntityType } from '../types';
import { ENTITY_CONFIGS } from '../types';

interface TabNavProps {
  activeTab: EntityType;
  onTabChange: (tab: EntityType) => void;
  visibleTabs: EntityType[];
}

export default function TabNav({ activeTab, onTabChange, visibleTabs }: TabNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter configs to only show tabs that are visible in the current app
  const visibleConfigs = ENTITY_CONFIGS.filter((config) =>
    visibleTabs.includes(config.type)
  );

  // Split tabs into first 4 and overflow
  const MAX_VISIBLE_TABS = 4;
  const directTabs = visibleConfigs.slice(0, MAX_VISIBLE_TABS);
  const overflowTabs = visibleConfigs.slice(MAX_VISIBLE_TABS);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="tab-nav">
      <div className="tab-container">
        {directTabs.map((config) => (
          <button
            key={config.type}
            className={`tab ${activeTab === config.type ? 'active' : ''}`}
            onClick={() => onTabChange(config.type)}
          >
            {config.labelPlural}
          </button>
        ))}

        {overflowTabs.length > 0 && (
          <div className="tab-dropdown-wrapper" ref={dropdownRef}>
            <button
              className={`tab tab-more ${overflowTabs.some(c => c.type === activeTab) ? 'active' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              More ▼
            </button>
            {dropdownOpen && (
              <div className="tab-dropdown">
                {overflowTabs.map((config) => (
                  <button
                    key={config.type}
                    className={`tab-dropdown-item ${activeTab === config.type ? 'active' : ''}`}
                    onClick={() => {
                      onTabChange(config.type);
                      setDropdownOpen(false);
                    }}
                  >
                    {config.labelPlural}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
