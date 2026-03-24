import { useState } from 'react';
import './PicklistField.css';

interface PicklistValue {
  value: string;
  label: string;
  default?: boolean;
}

interface PicklistFieldProps {
  value: string;
  values: PicklistValue[];
  restricted: boolean;
  onSave: (value: string) => void;
  editable?: boolean;
}

export default function PicklistField({
  value,
  values,
  restricted,
  onSave,
  editable = true
}: PicklistFieldProps) {
  const [editing, setEditing] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || '');
  const [customValue, setCustomValue] = useState('');

  const handleSave = () => {
    const finalValue = selectedValue === '__custom__' ? customValue : selectedValue;
    onSave(finalValue);
    setEditing(false);
    setCustomValue('');
  };

  const handleCancel = () => {
    setSelectedValue(value || '');
    setCustomValue('');
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  // Find the label for the current value
  const displayLabel = values.find(v => v.value === value)?.label || value;

  if (!editing) {
    return (
      <div
        className={`picklist-value ${editable ? 'editable' : ''}`}
        onClick={() => editable && setEditing(true)}
        title="Click to edit"
      >
        {displayLabel || <span className="empty-value">empty</span>}
      </div>
    );
  }

  return (
    <div className="picklist-field-edit">
      <select
        value={selectedValue}
        onChange={(e) => setSelectedValue(e.target.value)}
        className="picklist-select"
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        autoFocus
      >
        <option value="">-- None --</option>
        {values.map(v => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
        {!restricted && (
          <option value="__custom__">-- Custom Value --</option>
        )}
      </select>

      {!restricted && selectedValue === '__custom__' && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          placeholder="Enter custom value..."
          className="picklist-custom-input"
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}
