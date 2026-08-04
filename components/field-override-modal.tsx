"use client";

import { useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";

interface FieldOverride {
  fieldName: string;
  currentValue: any;
  confidenceScore: number;
  onSave: (newValue: any) => Promise<void>;
  onCancel: () => void;
  fieldType?: "text" | "number" | "date" | "select";
  selectOptions?: { label: string; value: string }[];
}

export function FieldOverrideModal({
  fieldName,
  currentValue,
  confidenceScore,
  onSave,
  onCancel,
  fieldType = "text",
  selectOptions = [],
}: FieldOverride) {
  const [newValue, setNewValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const displayName = fieldName.replace(/_/g, " ").toLowerCase();
  const confidence = Math.round(confidenceScore * 100);
  const lowConfidence = confidence < 60;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold capitalize">{displayName}</h3>
            {lowConfidence && (
              <div className="flex items-center gap-2 mt-2 text-yellow-200 text-sm">
                <AlertCircle size={14} />
                Low confidence - verify this value
              </div>
            )}
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Confidence score */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Parser Confidence</span>
            <ConfidenceBadge confidence={confidenceScore} size="sm" showLabel />
          </div>
        </div>

        {/* Current value */}
        <div className="mb-4 pb-4 border-b border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Currently detected:</div>
          <div className="text-sm bg-gray-800 rounded p-2 text-gray-200 break-words">
            {currentValue || "(empty)"}
          </div>
        </div>

        {/* Input field */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">New value:</label>
          {fieldType === "text" && (
            <input
              type="text"
              value={newValue || ""}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={saving}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none transition-colors"
              placeholder={`Enter ${displayName}`}
            />
          )}
          {fieldType === "number" && (
            <input
              type="number"
              value={newValue || ""}
              onChange={(e) => setNewValue(e.target.value ? Number(e.target.value) : "")}
              disabled={saving}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none transition-colors"
              placeholder={`Enter ${displayName}`}
            />
          )}
          {fieldType === "date" && (
            <input
              type="date"
              value={newValue || ""}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={saving}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none transition-colors"
            />
          )}
          {fieldType === "select" && (
            <select
              value={newValue || ""}
              onChange={(e) => setNewValue(e.target.value)}
              disabled={saving}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none transition-colors"
            >
              <option value="">Select {displayName}</option>
              {selectOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
