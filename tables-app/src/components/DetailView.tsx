import { useState, useEffect } from 'react';
import type { Entity, EntityConfig, EntityType } from '../types';
import DocsSection from './DocsSection';
import CommsSection from './CommsSection';
import PicklistField from './PicklistField';
import { usePicklists } from '../hooks/usePicklists';

interface DetailViewProps {
  config: EntityConfig;
  data: Entity;
  onClose: () => void;
  viewMode: 'normal' | 'edit';
  onToggleViewMode: () => void;
  onNavigate: (entityType: EntityType, entityId: string) => void;
}

// Map field key suffixes to entity types
const FOREIGN_KEY_MAP: Record<string, EntityType> = {
  'account_id': 'accounts',
  'contact_id': 'contacts',
  'opportunity_id': 'opportunities',
  'product_id': 'products',
  'party_id': 'parties',
  'individual_id': 'individuals',
  'organization_id': 'organizations',
};

// Extract account slug from wikilink format [[accounts/slug]]
function extractAccountIdFromWikilink(wikilink: string): string | null {
  const match = wikilink.match(/\[\[accounts\/([^\]]+)\]\]/);
  return match ? match[1] : null;
}

interface EditState {
  isEditing: boolean;
  field: string | null;
  value: any;
  originalValue: any;
  isSaving: boolean;
  error: string | null;
  success: boolean;
}

export default function DetailView({ config, data, onClose, viewMode, onToggleViewMode, onNavigate }: DetailViewProps) {
  const [localData, setLocalData] = useState(data);
  const { picklists } = usePicklists();
  const [editState, setEditState] = useState<EditState>({
    isEditing: false,
    field: null,
    value: null,
    originalValue: null,
    isSaving: false,
    error: null,
    success: false
  });

  // Cache for related entity names (e.g., account_id -> account name)
  const [relatedNames, setRelatedNames] = useState<Record<string, string>>({});

  // Fetch related entity names for foreign key fields
  useEffect(() => {
    const fetchRelatedNames = async () => {
      const namesMap: Record<string, string> = {};

      for (const field of config.fields) {
        const entityType = FOREIGN_KEY_MAP[field.key];
        if (entityType) {
          const entityId = (localData as any)[field.key];
          if (entityId) {
            try {
              const response = await fetch(`http://localhost:9600/api/entities/${entityType}/${entityId}`);
              if (response.ok) {
                const entity = await response.json();
                namesMap[field.key] = entity.name || entityId;
              }
            } catch (err) {
              console.error(`Error fetching ${entityType} ${entityId}:`, err);
            }
          }
        }
      }

      setRelatedNames(namesMap);
    };

    fetchRelatedNames();
  }, [config.fields, localData]);

  // Check if a field is a foreign key
  const isForeignKeyField = (fieldKey: string): boolean => {
    return fieldKey in FOREIGN_KEY_MAP;
  };

  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      case 'percent':
        return `${Math.round(value * 100)}%`;
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return value.toString();
      default:
        return value.toString();
    }
  };

  const startEdit = (fieldKey: string, currentValue: any) => {
    setEditState({
      isEditing: true,
      field: fieldKey,
      value: currentValue || '',
      originalValue: currentValue,
      isSaving: false,
      error: null,
      success: false
    });
  };

  const cancelEdit = () => {
    setEditState({
      isEditing: false,
      field: null,
      value: null,
      originalValue: null,
      isSaving: false,
      error: null,
      success: false
    });
  };

  const saveFieldUpdate = async () => {
    if (!editState.field) return;

    setEditState(prev => ({ ...prev, isSaving: true, error: null }));

    try {
      // Optimistic update
      setLocalData({
        ...localData,
        [editState.field]: editState.value
      });

      // API call
      const response = await fetch(
        `http://localhost:9600/api/entities/${config.type}/${(localData as any).id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field: editState.field,
            value: editState.value,
            author: 'user@example.com'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save');
      }

      const result = await response.json();

      // Update with server response
      setLocalData({
        ...localData,
        ...result.record
      });

      // Show success
      setEditState({
        isEditing: false,
        field: null,
        value: null,
        originalValue: null,
        isSaving: false,
        error: null,
        success: true
      });

      // Hide success message after 2 seconds
      setTimeout(() => {
        setEditState(prev => ({ ...prev, success: false }));
      }, 2000);

    } catch (error: any) {
      // Rollback optimistic update
      setLocalData({
        ...localData,
        [editState.field]: editState.originalValue
      });

      // Show error
      setEditState(prev => ({
        ...prev,
        isSaving: false,
        error: error.message
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveFieldUpdate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  // Check if a field is a picklist
  const getFieldPicklist = (fieldKey: string) => {
    if (!picklists) return null;

    // Get entity type from config (e.g., 'accounts' -> 'Account')
    const entityTypeName = config.label.replace(/s$/, ''); // Remove trailing 's'
    return picklists[entityTypeName]?.[fieldKey] || null;
  };

  // Save handler for picklist fields
  const handlePicklistSave = async (fieldKey: string, value: string) => {
    try {
      // Optimistic update
      setLocalData({
        ...localData,
        [fieldKey]: value
      });

      // API call
      const response = await fetch(
        `http://localhost:9600/api/entities/${config.type}/${(localData as any).id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field: fieldKey,
            value: value,
            author: 'user@example.com'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save');
      }

      const result = await response.json();

      // Update with server response
      setLocalData({
        ...localData,
        ...result.record
      });

      // Show success
      setEditState(prev => ({
        ...prev,
        success: true
      }));

      // Hide success message after 2 seconds
      setTimeout(() => {
        setEditState(prev => ({ ...prev, success: false }));
      }, 2000);

    } catch (error: any) {
      // Rollback optimistic update
      setLocalData({
        ...localData,
        [fieldKey]: (data as any)[fieldKey]
      });

      // Show error
      setEditState(prev => ({
        ...prev,
        error: error.message
      }));

      // Clear error after 3 seconds
      setTimeout(() => {
        setEditState(prev => ({ ...prev, error: null }));
      }, 3000);

      throw error;
    }
  };

  return (
    <div className="detail-view">
      <div className="detail-header">
        <div className="detail-title">
          <h2>{config.label} Detail</h2>
          <div className="header-actions">
            <button
              className={`mode-toggle ${viewMode}`}
              onClick={onToggleViewMode}
              title={viewMode === 'normal' ? 'Switch to Edit Mode' : 'Switch to View Mode'}
            >
              {viewMode === 'normal' ? '✏️ Edit' : '👁️ View'}
            </button>
            <button className="close-button" onClick={onClose}>
              ← Back to List
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content">
        {editState.success && (
          <div className="success-indicator">
            ✓ Saved successfully!
          </div>
        )}
        {editState.error && (
          <div className="error-indicator">
            ✗ Error: {editState.error}
          </div>
        )}

        <div className="detail-section">
          <h3>Information</h3>
          <table className="detail-table">
            <tbody>
              {config.fields.map((field) => {
                const fieldPicklist = getFieldPicklist(field.key);
                const isPicklist = fieldPicklist !== null;
                const isForeignKey = isForeignKeyField(field.key);
                const fieldValue = (localData as any)[field.key];

                // Special case: make 'company' field clickable if there's an account link
                // Check for both account_id and account (wikilink format [[accounts/slug]])
                const accountWikilink = (localData as any).account;
                const accountIdFromLink = accountWikilink ? extractAccountIdFromWikilink(accountWikilink) : null;
                const accountId = (localData as any).account_id || accountIdFromLink;
                const isCompanyWithAccount = field.key === 'company' && accountId;

                return (
                  <tr key={field.key}>
                    <td className="field-label">{field.label}</td>
                    <td className="field-value">
                      {/* Normal view mode */}
                      {viewMode === 'normal' ? (
                        // Make company field clickable when there's an account_id
                        isCompanyWithAccount ? (
                          <span
                            className="link-value"
                            onClick={() => onNavigate('accounts', accountId)}
                            title={`Go to ${fieldValue} account`}
                          >
                            {fieldValue}
                          </span>
                        ) : isForeignKey && fieldValue ? (
                          <span
                            className="link-value"
                            onClick={() => onNavigate(FOREIGN_KEY_MAP[field.key], fieldValue)}
                            title={`Go to ${relatedNames[field.key] || fieldValue}`}
                          >
                            {relatedNames[field.key] || fieldValue}
                          </span>
                        ) : (
                          <span className="static-value">
                            {formatValue(fieldValue, field.type)}
                          </span>
                        )
                      ) : (
                        /* Edit mode */
                        isPicklist ? (
                          <PicklistField
                            value={fieldValue || ''}
                            values={fieldPicklist.values}
                            restricted={fieldPicklist.restricted}
                            onSave={(value) => handlePicklistSave(field.key, value)}
                          />
                        ) : editState.isEditing && editState.field === field.key ? (
                          <div className="edit-mode">
                            <input
                              type="text"
                              value={editState.value}
                              onChange={(e) => setEditState(prev => ({ ...prev, value: e.target.value }))}
                              onKeyDown={handleKeyDown}
                              onBlur={cancelEdit}
                              autoFocus
                              disabled={editState.isSaving}
                            />
                            <div className="edit-hints">
                              <span>✓ Enter to save</span>
                              <span>⨯ Esc to cancel</span>
                            </div>
                            {editState.isSaving && (
                              <div className="saving-indicator">Saving...</div>
                            )}
                          </div>
                        ) : (
                          <span
                            className="editable-value"
                            onClick={() => startEdit(field.key, fieldValue)}
                            title="Click to edit"
                          >
                            {formatValue(fieldValue, field.type)}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="field-label">Record ID</td>
                <td className="field-value">{(localData as any).id}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {(data as any).created_at && (
          <div className="detail-section">
            <h3>System Information</h3>
            <table className="detail-table">
              <tbody>
                <tr>
                  <td className="field-label">Created</td>
                  <td className="field-value">
                    {new Date((data as any).created_at).toLocaleString()}
                  </td>
                </tr>
                {(data as any).updated_at && (
                  <tr>
                    <td className="field-label">Last Modified</td>
                    <td className="field-value">
                      {new Date((data as any).updated_at).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <DocsSection
          entityType={config.type}
          entityId={(data as any).id}
        />

        <CommsSection
          entityId={(data as any).id}
          entityType={config.type}
        />
      </div>
    </div>
  );
}
