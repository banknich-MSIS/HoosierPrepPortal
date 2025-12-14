/**
 * Difficulty level utilities and constants.
 * Provides consistent difficulty information across the application.
 */

export interface DifficultyInfo {
  label: string;
  description: string;
  color: string;
  colorDark: string;
  timePerQuestion: number; // in minutes
  characteristics: string[];
}

export const DIFFICULTY_LEVELS: Record<string, DifficultyInfo> = {
  easy: {
    label: "Easy",
    description: "Basic Recall & Recognition",
    color: "#28a745",
    colorDark: "#2ea44f",
    timePerQuestion: 0.75, // 45 seconds
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
    timePerQuestion: 1.25, // 75 seconds
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
    timePerQuestion: 2.0, // 120 seconds
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

export function estimateExamTime(questionCount: number, difficulty?: string): number {
  const info = getDifficultyInfo(difficulty);
  return Math.round(questionCount * info.timePerQuestion);
}

export function formatExamTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function getDifficultyColor(difficulty?: string, darkMode?: boolean): string {
  const info = getDifficultyInfo(difficulty);
  return darkMode ? info.colorDark : info.color;
}


