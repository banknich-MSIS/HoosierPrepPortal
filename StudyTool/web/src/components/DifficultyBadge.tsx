import React from "react";
import { getDifficultyInfo, getDifficultyColor } from "../utils/difficulty";

interface DifficultyBadgeProps {
  difficulty?: string;
  darkMode?: boolean;
  theme?: any;
  showTooltip?: boolean;
  showTime?: boolean;
  size?: "small" | "medium" | "large";
}

export default function DifficultyBadge({
  difficulty,
  darkMode = false,
  theme,
  showTooltip = true,
  showTime = false,
  size = "medium",
}: DifficultyBadgeProps) {
  const info = getDifficultyInfo(difficulty);
  const color = getDifficultyColor(difficulty, darkMode);

  const sizeStyles = {
    small: {
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 4,
    },
    medium: {
      fontSize: 12,
      padding: "4px 10px",
      borderRadius: 5,
    },
    large: {
      fontSize: 14,
      padding: "6px 14px",
      borderRadius: 6,
    },
  };

  const style = sizeStyles[size];

  const tooltip = showTooltip
    ? `${info.description}\n~${Math.round(info.timePerQuestion * 60)}s per question\n\nCharacteristics:\n${info.characteristics.map(c => `• ${c}`).join('\n')}`
    : undefined;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: style.fontSize,
        padding: style.padding,
        borderRadius: style.borderRadius,
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}40`,
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: showTooltip ? "help" : "default",
      }}
      title={tooltip}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      {info.label}
      {showTime && (
        <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 2 }}>
          ({Math.round(info.timePerQuestion * 60)}s)
        </span>
      )}
    </span>
  );
}


