"use client";

import { Edit2 } from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";

interface EditableFieldProps {
  label: string;
  value: any;
  confidence?: number;
  onEdit?: () => void;
  showEditButton?: boolean;
  formatValue?: (value: any) => string;
  className?: string;
}

export function EditableField({
  label,
  value,
  confidence = 0.8,
  onEdit,
  showEditButton = true,
  formatValue = (v) => v || "—",
  className = "",
}: EditableFieldProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {confidence !== undefined && (
          <ConfidenceBadge confidence={confidence} size="sm" />
        )}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{formatValue(value)}</div>
        {showEditButton && onEdit && (
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-colors"
            title="Edit field"
          >
            <Edit2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
