/**
 * Difficulty level utilities and constants.
 * Provides consistent difficulty information across the application.
 */

export interface DifficultyInfo {
  label: string;
  description: string;
  color: string;
  colorDark: string;
  characteristics: string[];
}

export const DIFFICULTY_LEVELS: Record<string, DifficultyInfo> = {
  easy: {
    label: "Easy",
    description: "Basic Recall & Recognition",
    color: "#28a745",
    colorDark: "#2ea44f",
    characteristics: [
      "Simple recall and definitions",
      "Straightforward distractors",
      "Single concept focus",
      "Direct question formats"
    ],
  },
  medium: {
    label: "Medium",
    description: "Application & Analysis",
    color: "#fd7e14",
    colorDark: "#ff8c1f",
    characteristics: [
      "Concept application",
      "Plausible distractors",
      "Scenario-based questions",
      "Cause-effect relationships"
    ],
  },
  hard: {
    label: "Hard",
    description: "Advanced Synthesis & Evaluation",
    color: "#dc3545",
    colorDark: "#e74c3c",
    characteristics: [
      "Multi-step reasoning",
      "Subtle distractors",
      "Complex scenarios",
      "Multiple concept synthesis"
    ],
  },
};

export function getDifficultyInfo(difficulty?: string): DifficultyInfo {
  const key = (difficulty || "medium").toLowerCase();
  return DIFFICULTY_LEVELS[key] || DIFFICULTY_LEVELS.medium;
}

export function getDifficultyColor(difficulty?: string, darkMode?: boolean): string {
  const info = getDifficultyInfo(difficulty);
  return darkMode ? info.colorDark : info.color;
}


