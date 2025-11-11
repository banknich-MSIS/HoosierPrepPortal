import { DetailedAnalytics } from "../types";
import { generatePerformanceInsights } from "../api/client";

export interface StoredInsight {
  insights: string;
  timestamp: number;
  examCount: number;
  dataHash: string; // Hash of exam data to detect changes
}

const STORAGE_KEY = "performance_insights";

/**
 * Generate a simple hash of exam data to detect meaningful changes
 */
function generateDataHash(analytics: DetailedAnalytics): string {
  const data = {
    examCount: analytics.timeline_data.length,
    avgScore: analytics.timeline_data.reduce((sum, t) => sum + t.score, 0) / (analytics.timeline_data.length || 1),
    questionTypes: Object.keys(analytics.question_type_stats).sort().join(","),
    sources: Object.keys(analytics.source_material_stats).sort().join(","),
  };
  return JSON.stringify(data);
}

/**
 * Check if insights need regeneration based on data changes
 */
export function shouldRegenerateInsights(
  analytics: DetailedAnalytics,
  storedInsight: StoredInsight | null
): boolean {
  if (!storedInsight) return true;
  
  const currentHash = generateDataHash(analytics);
  const examCountChanged = analytics.timeline_data.length !== storedInsight.examCount;
  const dataChanged = currentHash !== storedInsight.dataHash;
  
  return examCountChanged || dataChanged;
}

/**
 * Save insights to localStorage
 */
export function saveInsights(
  insights: string,
  analytics: DetailedAnalytics
): StoredInsight {
  const storedInsight: StoredInsight = {
    insights,
    timestamp: Date.now(),
    examCount: analytics.timeline_data.length,
    dataHash: generateDataHash(analytics),
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedInsight));
  } catch (error) {
    console.error("Failed to save insights:", error);
  }
  
  return storedInsight;
}

/**
 * Load insights from localStorage
 */
export function loadInsights(): StoredInsight | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load insights:", error);
    return null;
  }
}

/**
 * Clear stored insights
 */
export function clearInsights(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear insights:", error);
  }
}

/**
 * Generate and save new insights
 */
export async function generateAndSaveInsights(
  analytics: DetailedAnalytics,
  apiKey: string
): Promise<StoredInsight> {
  const result = await generatePerformanceInsights(analytics, apiKey);
  return saveInsights(result.insights, analytics);
}

/**
 * Format timestamp for display
 */
export function formatInsightTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

