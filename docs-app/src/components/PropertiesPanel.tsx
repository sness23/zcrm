import { useState } from 'react';
import './PropertiesPanel.css';
import PicklistField from './PicklistField';
import { usePicklists } from '../hooks/usePicklists';

interface PropertiesPanelProps {
  frontmatter: Record<string, any>;
  onUpdate: (frontmatter: Record<string, any>) => void;
  isCollapsed: boolean;
}

export default function PropertiesPanel({ frontmatter, onUpdate, isCollapsed }: PropertiesPanelProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const { picklists } = usePicklists();

  // Check if a field is a picklist
  const getFieldPicklist = (fieldKey: string) => {
    if (!picklists || !frontmatter.type) return null;

    // Get entity type from frontmatter (e.g., 'Account', 'Contact')
    const entityType = frontmatter.type;
    return picklists[entityType]?.[fieldKey] || null;
  };

  // Filter out internal fields that shouldn't be edited
  const editableFields = Object.entries(frontmatter).filter(([key]) => {
    // Hide these system fields from the properties panel
    const systemFields = ['created_at', 'updated_at', 'sf_synced_at'];
    return !systemFields.includes(key);
  });

  const handleEdit = (key: string, value: any) => {
    setEditingKey(key);
    setEditingValue(String(value ?? ''));
  };

  const handleSave = (key: string) => {
    if (editingKey !== key) return;

    let parsedValue: any = editingValue;

    // Try to parse the value intelligently
    if (editingValue === '') {
      parsedValue = null;
    } else if (editingValue === 'true') {
      parsedValue = true;
    } else if (editingValue === 'false') {
      parsedValue = false;
    } else if (!isNaN(Number(editingValue)) && editingValue.trim() !== '') {
      parsedValue = Number(editingValue);
    } else if (editingValue.startsWith('[') || editingValue.startsWith('{')) {
      try {
        parsedValue = JSON.parse(editingValue);
      } catch {
        // Keep as string if parsing fails
      }
    }

    const updated = { ...frontmatter, [key]: parsedValue };
    onUpdate(updated);
    setEditingKey(null);
    setEditingValue('');
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditingValue('');
  };

  const handlePicklistSave = (key: string, value: string) => {
    const updated = { ...frontmatter, [key]: value };
    onUpdate(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave(key);
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const renderValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getValueType = (value: any): string => {
    if (value === null || value === undefined) return 'empty';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string' && value.startsWith('[[') && value.endsWith(']]')) {
      return 'link';
    }
    return 'string';
  };

  if (editableFields.length === 0 || isCollapsed) {
    return null;
  }

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <span className="properties-toggle">▼</span>
        <span className="properties-title">Properties</span>
        <span className="properties-count">{editableFields.length}</span>
      </div>

      <div className="properties-content">
        {editableFields.map(([key, value]) => {
            const valueType = getValueType(value);
            const isEditing = editingKey === key;
            const fieldPicklist = getFieldPicklist(key);
            const isPicklist = fieldPicklist !== null;

            return (
              <div key={key} className={`property-row ${valueType}`}>
                <div className="property-key">{key}</div>
                <div className="property-value">
                  {isPicklist ? (
                    <PicklistField
                      value={String(value || '')}
                      values={fieldPicklist.values}
                      restricted={fieldPicklist.restricted}
                      onSave={(newValue) => handlePicklistSave(key, newValue)}
                    />
                  ) : isEditing ? (
                    <div className="property-edit">
                      <input
                        type="text"
                        className="property-input"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        onBlur={() => handleSave(key)}
                        autoFocus
                      />
                      <div className="property-edit-hint">
                        Press Enter to save, Esc to cancel
                      </div>
                    </div>
                  ) : (
                    <div
                      className="property-display"
                      onClick={() => handleEdit(key, value)}
                      title="Click to edit"
                    >
                      {valueType === 'link' ? (
                        <span className="property-link">{renderValue(value)}</span>
                      ) : valueType === 'boolean' ? (
                        <span className="property-boolean">
                          {value ? '✓ true' : '✗ false'}
                        </span>
                      ) : valueType === 'empty' ? (
                        <span className="property-empty">empty</span>
                      ) : (
                        <span>{renderValue(value)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
