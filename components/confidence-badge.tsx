"use client";

import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface ConfidenceBadgeProps {
  confidence: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  tooltip?: string;
}

export function ConfidenceBadge({
  confidence,
  size = "md",
  showLabel = true,
  tooltip,
}: ConfidenceBadgeProps) {
  const percentage = Math.round(confidence * 100);
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  let bgColor = "bg-red-900/30 border-red-700 text-red-200";
  let icon = <AlertCircle size={16} />;

  if (percentage >= 80) {
    bgColor = "bg-green-900/30 border-green-700 text-green-200";
    icon = <CheckCircle size={16} />;
  } else if (percentage >= 60) {
    bgColor = "bg-yellow-900/30 border-yellow-700 text-yellow-200";
    icon = <Info size={16} />;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 border rounded ${sizeClasses[size]} ${bgColor}`}
      title={tooltip}
    >
      {icon}
      {showLabel && <span>{percentage}%</span>}
    </div>
  );
}
