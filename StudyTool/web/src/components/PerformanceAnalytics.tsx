import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fetchDetailedAnalytics } from "../api/client";
import type { DetailedAnalytics, TimelineDataPoint } from "../types";
import {
  loadInsights,
  clearInsights,
  generateAndSaveInsights,
  shouldRegenerateInsights,
  formatInsightTimestamp,
  type StoredInsight,
} from "../utils/insightsManager";

interface PerformanceAnalyticsProps {
  attempts: any[];
  darkMode: boolean;
  theme: any;
}

const PerformanceAnalytics = React.memo(({
  attempts,
  darkMode,
  theme,
}: PerformanceAnalyticsProps) => {
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>("all");
  const [storedInsight, setStoredInsight] = useState<StoredInsight | null>(
    null
  );
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [showStaleDataNotice, setShowStaleDataNotice] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [weakAreasExpanded, setWeakAreasExpanded] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [accuracyFilter, setAccuracyFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  useEffect(() => {
    loadAnalytics();
  }, []);

  // Load stored insights on mount
  useEffect(() => {
    const stored = loadInsights();
    if (stored) {
      setStoredInsight(stored);
    }
  }, []);

  // Listen for exam data changes
  useEffect(() => {
    const handleExamChange = () => {
      // Reload analytics and regenerate insights
      loadAnalytics();
    };

    window.addEventListener("exam-completed", handleExamChange);
    window.addEventListener("exam-deleted", handleExamChange);
    window.addEventListener("insights-refresh-requested", handleExamChange);

    return () => {
      window.removeEventListener("exam-completed", handleExamChange);
      window.removeEventListener("exam-deleted", handleExamChange);
      window.removeEventListener(
        "insights-refresh-requested",
        handleExamChange
      );
    };
  }, []);

  // Auto-generate insights when analytics data loads or changes
  useEffect(() => {
    if (analytics && analytics.timeline_data.length > 0) {
      // Check if we need to regenerate
      if (shouldRegenerateInsights(analytics, storedInsight)) {
        handleGenerateInsights();
      } else if (
        storedInsight &&
        storedInsight.examCount === 0 &&
        analytics.timeline_data.length > 0
      ) {
        // Edge case: stored insight was for no exams, but now we have exams
        handleGenerateInsights();
      }
    } else if (
      storedInsight &&
      storedInsight.examCount > 0 &&
      (!analytics || analytics.timeline_data.length === 0)
    ) {
      // Show stale data notice if all exams were deleted
      setShowStaleDataNotice(true);
    } else {
      setShowStaleDataNotice(false);
    }
  }, [analytics, storedInsight]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await fetchDetailedAnalytics();
      setAnalytics(data);

      // Extract unique classes from attempts
      const classes = new Set<string>();
      attempts.forEach((attempt) => {
        if (attempt.class_tags) {
          attempt.class_tags.forEach((tag) => classes.add(tag));
        }
      });
      setAvailableClasses(Array.from(classes).sort());
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInsights = useCallback(async () => {
    if (!analytics) return;

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      setInsightsError(
        "Please add your Gemini API key in Settings to generate insights."
      );
      return;
    }

    try {
      setGeneratingInsights(true);
      setInsightsError(null);
      setShowStaleDataNotice(false);

      const stored = await generateAndSaveInsights(analytics, apiKey);
      setStoredInsight(stored);
    } catch (error: any) {
      setInsightsError(
        error?.response?.data?.detail || "Failed to generate insights"
      );
    } finally {
      setGeneratingInsights(false);
    }
  }, [analytics]);

  const handleClearInsights = () => {
    clearInsights();
    setStoredInsight(null);
    setInsightsError(null);
    setShowStaleDataNotice(false);
  };

  const handleRefreshInsights = () => {
    if (analytics && analytics.timeline_data.length > 0) {
      handleGenerateInsights();
    }
  };

  if (loading || !analytics || attempts.length === 0) {
    return null;
  }

  // Filter timeline data based on selected class
  const filterTimelineData = (data: TimelineDataPoint[]) => {
    if (classFilter === "all") return data;

    // Filter attempts by class tag
    const filteredAttemptIds = new Set(
      attempts
        .filter((attempt) => attempt.class_tags?.includes(classFilter))
        .map((attempt) => attempt.id)
    );

    return data.filter((point) => filteredAttemptIds.has(point.attempt_id));
  };

  const filteredTimeline = filterTimelineData(analytics.timeline_data);

  // Calculate cumulative average
  const calculateCumulativeAverage = (
    data: TimelineDataPoint[]
  ) => {
    let runningSum = 0;
    return data.map((point, idx) => {
      runningSum += point.score;
      const avg = runningSum / (idx + 1);
      return {
        index: idx, // Add unique index for X-axis to prevent merging same-day points
        date: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        fullDate: point.date,
        score: point.score,
        rollingAvg: Math.round(avg * 10) / 10,
        difficulty: point.difficulty || "M",
        sourceType: point.source_type || "Mixed",
      };
    });
  };

  const timelineChartData = calculateCumulativeAverage(filteredTimeline);

  // Helper function to format question type names
  const formatQuestionType = (type: string): string => {
    const typeMap: Record<string, string> = {
      mcq: "Multiple Choice",
      multi: "Multiple Select",
      short: "Short Answer",
      truefalse: "True/False",
      cloze: "Fill in the Blank",
    };
    return typeMap[type.toLowerCase()] || type.toUpperCase();
  };

  // Color palette for question types - theme color + grayscale
  const QUESTION_TYPE_COLORS = darkMode
    ? [
        // Dark mode: Mustard yellow + light grays
        "#c29b4a", // Mustard yellow (theme color)
        "#9ca3af", // Gray-400
        "#6b7280", // Gray-500
        "#d1d5db", // Gray-300
        "#4b5563", // Gray-600
      ]
    : [
        // Light mode: Crimson + dark grays
        "#c41e3a", // IU Crimson (theme color)
        "#4b5563", // Gray-600
        "#6b7280", // Gray-500
        "#374151", // Gray-700
        "#9ca3af", // Gray-400
      ];

  // Calculate total questions across all types
  const totalQuestions = Object.values(analytics.question_type_stats).reduce(
    (sum, stats) => sum + stats.total,
    0
  );

  // Prepare question type data for donut chart
  const questionTypeData = Object.entries(analytics.question_type_stats).map(
    ([type, stats], index) => {
      const distribution =
        totalQuestions > 0
          ? Math.round((stats.total / totalQuestions) * 100 * 10) / 10
          : 0;
      return {
        name: formatQuestionType(type),
        accuracy: stats.accuracy,
        total: stats.total,
        correct: stats.correct,
        distribution: distribution, // Percentage of total questions
        fill: QUESTION_TYPE_COLORS[index % QUESTION_TYPE_COLORS.length],
      };
    }
  );

  // Find strongest and weakest types
  const sortedTypes = [...questionTypeData].sort(
    (a, b) => b.accuracy - a.accuracy
  );
  const strongestType = sortedTypes[0];
  const weakestType = sortedTypes[sortedTypes.length - 1];

  // Color palette for source materials - theme color + grayscale
  const SOURCE_COLORS = darkMode
    ? [
        // Dark mode: Mustard yellow + light grays
        "#c29b4a", // Mustard yellow (theme color)
        "#9ca3af", // Gray-400
        "#6b7280", // Gray-500
        "#d1d5db", // Gray-300
        "#4b5563", // Gray-600
        "#8b92a0", // Gray-450 (custom mid-tone)
      ]
    : [
        // Light mode: Crimson + dark grays
        "#c41e3a", // IU Crimson (theme color)
        "#4b5563", // Gray-600
        "#6b7280", // Gray-500
        "#374151", // Gray-700
        "#9ca3af", // Gray-400
        "#525b6b", // Gray-650 (custom mid-tone)
      ];

  // Prepare source material data
  const sourceData = Object.entries(analytics.source_material_stats)
    .map(([source, stats], index) => ({
      name: source.length > 25 ? source.substring(0, 22) + "..." : source,
      fullName: source,
      accuracy: stats.accuracy,
      questionCount: stats.question_count,
      appearances: stats.appearances,
      fill: SOURCE_COLORS[index % SOURCE_COLORS.length],
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return (
    <div
      style={{
        padding: 24,
        background: theme.cardBg,
        backdropFilter: theme.glassBlur,
        WebkitBackdropFilter: theme.glassBlur,
        borderRadius: 12,
        border: `1px solid ${theme.glassBorder}`,
        boxShadow: theme.glassShadow,
      }}
    >
      {/* Heading removed per request */}

      {/* AI Insights Card - Temporarily Hidden */}
      {false && (
        <div
          style={{
            marginBottom: 24,
            padding: 18,
            background: darkMode
              ? "rgba(212, 166, 80, 0.08)"
              : "rgba(196, 30, 58, 0.05)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 10,
            border: `1px solid ${theme.glassBorder}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.crimson,
                }}
              >
                AI Performance Insights
              </div>
              {storedInsight && storedInsight.timestamp && (
                <div
                  style={{
                    fontSize: 11,
                    color: theme.textSecondary,
                    marginTop: 4,
                  }}
                >
                  Last updated {formatInsightTimestamp(storedInsight.timestamp)}
                </div>
              )}
            </div>

            {/* Clear/Refresh Buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              {storedInsight && (
                <button
                  onClick={handleRefreshInsights}
                  onMouseEnter={() => setHoveredButton("refresh")}
                  onMouseLeave={() => setHoveredButton(null)}
                  disabled={generatingInsights}
                  style={{
                    padding: "6px 8px",
                    background: "transparent",
                    color: theme.crimson,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: generatingInsights ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: generatingInsights
                      ? 0.5
                      : hoveredButton === "refresh"
                      ? 0.8
                      : 1,
                    transition: "all 0.2s ease",
                  }}
                  title="Refresh insights"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
              )}
              {storedInsight && (
                <button
                  onClick={handleClearInsights}
                  onMouseEnter={() => setHoveredButton("clear")}
                  onMouseLeave={() => setHoveredButton(null)}
                  disabled={generatingInsights}
                  style={{
                    padding: "6px 8px",
                    background: "transparent",
                    color: theme.textSecondary,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: generatingInsights ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: generatingInsights
                      ? 0.5
                      : hoveredButton === "clear"
                      ? 0.8
                      : 1,
                    transition: "all 0.2s ease",
                  }}
                  title="Clear insights"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          {generatingInsights ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 0",
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: `2px solid ${theme.glassBorder}`,
                  borderTop: `2px solid ${theme.crimson}`,
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
              <div
                style={{
                  fontSize: 14,
                  color: theme.textSecondary,
                  fontStyle: "italic",
                }}
              >
                Updating insights from your latest performance data...
              </div>
            </div>
          ) : storedInsight && storedInsight.insights ? (
            <div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: theme.text,
                  whiteSpace: "pre-line",
                }}
              >
                {storedInsight.insights}
              </div>
              {showStaleDataNotice && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    background: darkMode
                      ? "rgba(255, 193, 7, 0.08)"
                      : "rgba(255, 193, 7, 0.12)",
                    border: "1px solid rgba(255, 193, 7, 0.3)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: theme.text,
                  }}
                >
                  <strong>Note:</strong> All exam data has been cleared. These
                  insights are from your previous exams. Clear or wait until you
                  complete new exams to generate fresh insights.
                </div>
              )}
            </div>
          ) : insightsError ? (
            <div
              style={{
                fontSize: 13,
                color: theme.crimson,
                padding: "8px 0",
              }}
            >
              {insightsError}
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                padding: "8px 0",
              }}
            >
              Start completing exams to unlock your personalized AI insights.
              Your first insight will generate automatically!
            </div>
          )}
        </div>
      )}

      {/* Timeline Chart */}
      <div
        style={{
          marginBottom: 24,
          padding: 18,
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 10,
          border: `1px solid ${theme.glassBorder}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            Performance Over Time
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                fontSize: 13,
                color: theme.textSecondary,
                fontWeight: 500,
              }}
            >
              Filter by Class:
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{
                padding: "6px 12px",
                background: darkMode
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(0, 0, 0, 0.05)",
                color: theme.text,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="all">All Classes</option>
              {availableClasses.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={timelineChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.glassBorder} />
            <XAxis
              dataKey="index"
              stroke={theme.textSecondary}
              style={{ fontSize: 11 }}
              tickFormatter={(val) => {
                // Use the index to look up the formatted date
                const item = timelineChartData[val];
                return item ? item.date : "";
              }}
              type="number"
              domain={['dataMin', 'dataMax']}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              stroke={theme.textSecondary}
              style={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: darkMode ? "#2d1819" : "#fff",
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                fontSize: 12,
                color: darkMode ? "#fff" : "#000",
              }}
              labelFormatter={(value) => {
                const item = timelineChartData[value];
                return item ? item.date : "";
              }}
              formatter={(value: any, name: string) => {
                if (name === "score") return [`${value}%`, "Score"];
                if (name === "rollingAvg") return [`${value}%`, "Avg"];
                return [value, name];
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke={theme.crimson}
              strokeWidth={2}
              dot={{ fill: theme.crimson, r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="rollingAvg"
              stroke={theme.amber}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: theme.textSecondary,
            textAlign: "center",
          }}
        >
          Solid line: actual scores | Dashed line: cumulative average
        </div>
      </div>

      {/* Question Type Breakdown */}
      {questionTypeData.length > 0 && (
        <div
          style={{
            marginBottom: 24,
            padding: 18,
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 10,
            border: `1px solid ${theme.glassBorder}`,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
              color: theme.text,
            }}
          >
            Question Type Breakdown
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <ResponsiveContainer width="40%" height={180}>
              <PieChart>
                <Pie
                  data={questionTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="total"
                >
                  {questionTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? "#2d1819" : "#fff",
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    fontSize: 12,
                    color: darkMode ? "#fff" : "#000",
                  }}
                  formatter={(value: any, name: string, props: any) => [
                    `${value}% (${props.payload.correct}/${props.payload.total})`,
                    props.payload.name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              <div style={{ display: "grid", gap: 8 }}>
                {questionTypeData.map((type) => (
                  <div
                    key={type.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      background: darkMode
                        ? "rgba(255, 255, 255, 0.02)"
                        : "rgba(0, 0, 0, 0.02)",
                      borderRadius: 4,
                      border: `1px solid ${theme.glassBorder}`,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          backgroundColor: type.fill,
                        }}
                      />
                      <span style={{ fontSize: 13, color: theme.text }}>
                        {type.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: type.fill,
                      }}
                    >
                      {type.distribution}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {strongestType && weakestType && (
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: 10,
                  background: darkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.03)",
                  borderRadius: 6,
                  border: `1px solid ${theme.glassBorder}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: theme.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Strongest Format
                </div>
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: theme.text }}
                >
                  {strongestType.name} - {strongestType.accuracy}%
                </div>
              </div>
              <div
                style={{
                  padding: 10,
                  background: darkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.03)",
                  borderRadius: 6,
                  border: `1px solid ${theme.glassBorder}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: theme.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Needs Practice
                </div>
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: theme.text }}
                >
                  {weakestType.name} - {weakestType.accuracy}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weak Areas Deep Dive Section */}
      {analytics.weak_areas && (
        <div
          style={{
            marginBottom: 24,
            padding: 18,
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 10,
            border: `1px solid ${theme.glassBorder}`,
          }}
        >
          {/* Collapsible Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              cursor: "pointer",
            }}
            onClick={() => setWeakAreasExpanded(!weakAreasExpanded)}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: theme.text,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: weakAreasExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.3s ease-in-out",
                }}
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              Weak Areas Deep Dive
            </div>
          </div>

          {analytics.weak_areas.length === 0 ? (
            <div
              style={{
                fontSize: 14,
                color: theme.textSecondary,
                fontStyle: "italic",
                padding: "12px 0",
              }}
            >
              Not enough data yet to determine weak areas. Answer more questions
              tagged with concepts.
            </div>
          ) : (
            <div
              style={{
                maxHeight: weakAreasExpanded ? "3000px" : "0",
                overflow: "hidden",
                transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out",
                opacity: weakAreasExpanded ? 1 : 0,
              }}
            >
              {weakAreasExpanded && (
                <>
                  {/* Filter Controls */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                {/* Date Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      fontWeight: 500,
                    }}
                  >
                    Date Filter:
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: "6px 12px",
                      background: darkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)",
                      color: theme.text,
                      border: `1px solid ${theme.glassBorder}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      outline: "none",
                    }}
                  >
                    <option value="all">All Time</option>
                    <option value="60">Last 60 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="7">Last 7 Days</option>
                    <option value="1">Last Day</option>
                  </select>
                </div>

                {/* Accuracy Filter */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      fontWeight: 500,
                    }}
                  >
                    Accuracy:
                  </label>
                  <select
                    value={accuracyFilter}
                    onChange={(e) => setAccuracyFilter(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: "6px 12px",
                      background: darkMode
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)",
                      color: theme.text,
                      border: `1px solid ${theme.glassBorder}`,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      outline: "none",
                    }}
                  >
                    <option value="all">All</option>
                    <option value="60">Under 60%</option>
                    <option value="75">Under 75%</option>
                    <option value="90">Under 90%</option>
                  </select>
                </div>

                {/* Tag Filter */}
                {(() => {
                  // Extract unique tags from all weak areas
                  const allTags = new Set<string>();
                  analytics.weak_areas.forEach((area) => {
                    if (area.tags && area.tags.length > 0) {
                      area.tags.forEach((tag) => allTags.add(tag));
                    }
                  });
                  const uniqueTags = Array.from(allTags).sort();

                  return uniqueTags.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label
                        style={{
                          fontSize: 13,
                          color: theme.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        Tag:
                      </label>
                      <select
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: "6px 12px",
                          background: darkMode
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.05)",
                          color: theme.text,
                          border: `1px solid ${theme.glassBorder}`,
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                          outline: "none",
                        }}
                      >
                        <option value="all">All Tags</option>
                        {uniqueTags.map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Filter Logic */}
              {(() => {
                const filterByDate = (concept: typeof analytics.weak_areas[0]) => {
                  if (dateFilter === "all") return true;
                  if (!concept.last_seen_at) return false;
                  
                  const lastSeen = new Date(concept.last_seen_at);
                  const now = new Date();
                  const daysAgo = {
                    "1": 1,
                    "7": 7,
                    "14": 14,
                    "30": 30,
                    "60": 60
                  }[dateFilter] || 0;
                  
                  return (now.getTime() - lastSeen.getTime()) <= (daysAgo * 24 * 60 * 60 * 1000);
                };

                const filterByAccuracy = (concept: typeof analytics.weak_areas[0]) => {
                  if (accuracyFilter === "all") return true;
                  const threshold = {
                    "60": 60,
                    "75": 75,
                    "90": 90
                  }[accuracyFilter] || 100;
                  return concept.accuracy_pct < threshold;
                };

                const filterByTag = (concept: typeof analytics.weak_areas[0]) => {
                  if (tagFilter === "all") return true;
                  if (!concept.tags || concept.tags.length === 0) return false;
                  return concept.tags.includes(tagFilter);
                };

                const filteredAreas = analytics.weak_areas.filter(
                  (area) => filterByDate(area) && filterByAccuracy(area) && filterByTag(area)
                );

                return (
                  <>
                    {/* Top Items to Review */}
                    {filteredAreas.length > 0 && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background: darkMode
                            ? "rgba(212, 166, 80, 0.15)"
                            : "rgba(196, 30, 58, 0.12)",
                          borderRadius: 6,
                          border: `1px solid ${theme.glassBorder}`,
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            color: darkMode ? theme.amber : theme.crimson,
                            flexShrink: 0,
                          }}
                        >
                          <path
                            d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: theme.text,
                          }}
                        >
                          Top items to review
                        </span>
                      </div>
                    )}

                    {/* Detailed Table */}
                    <div
                      className="weak-areas-table-scroll"
                      style={{
                        overflowX: "auto",
                        overflowY: "auto",
                        maxHeight: "500px",
                        position: "relative",
                      }}
                    >
                      <style>{`
                        /* Custom scrollbar styling */
                        .weak-areas-table-scroll::-webkit-scrollbar {
                          width: 8px;
                          height: 8px;
                        }
                        .weak-areas-table-scroll::-webkit-scrollbar-track {
                          background: ${darkMode ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"};
                          border-radius: 4px;
                        }
                        .weak-areas-table-scroll::-webkit-scrollbar-thumb {
                          background: ${theme.glassBorder};
                          border-radius: 4px;
                        }
                        .weak-areas-table-scroll::-webkit-scrollbar-thumb:hover {
                          background: ${theme.crimson};
                        }
                      `}</style>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 13,
                        }}
                      >
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            background: darkMode
                              ? "rgba(45, 24, 25, 1)"
                              : "rgba(255, 255, 255, 1)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            zIndex: 10,
                          }}
                        >
                          <tr
                            style={{
                              borderBottom: `1px solid ${theme.glassBorder}`,
                            }}
                          >
                            <th
                              style={{
                                textAlign: "left",
                                padding: "8px 12px",
                                color: theme.crimson,
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              Concept
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                padding: "8px 12px",
                                color: theme.crimson,
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              Accuracy
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                padding: "8px 12px",
                                color: theme.crimson,
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              Correct/Total
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                padding: "8px 12px",
                                color: theme.crimson,
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              Last Seen
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAreas.map((area, idx) => (
                            <tr
                              key={area.concept_id}
                              style={{
                                borderBottom: `1px solid ${theme.glassBorder}`,
                                background:
                                  idx % 2 === 0
                                    ? darkMode
                                      ? "rgba(255, 255, 255, 0.02)"
                                      : "rgba(0, 0, 0, 0.02)"
                                    : "transparent",
                              }}
                            >
                              <td
                                style={{
                                  padding: "10px 12px",
                                  color: theme.text,
                                  fontWeight: idx < 5 ? 700 : 400,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                  }}
                                >
                                  <span>{area.concept_name}</span>
                                  {idx < 5 && (
                                    <svg
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      style={{
                                        color: darkMode ? theme.amber : theme.crimson,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <path
                                        d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                              </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "right",
                                    fontWeight: 600,
                                    color:
                                      area.accuracy_pct < 60
                                        ? "#ef4444"
                                        : area.accuracy_pct < 75
                                        ? "#f59e0b"
                                        : "#10b981",
                                  }}
                                >
                                  {area.accuracy_pct}%
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "right",
                                    color: theme.textSecondary,
                                  }}
                                >
                                  {area.correct_attempts}/{area.total_attempts}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "right",
                                    color: theme.textSecondary,
                                    fontSize: 12,
                                  }}
                                >
                                  {area.last_seen_at
                                    ? new Date(area.last_seen_at).toLocaleDateString(
                                        "en-US",
                                        { month: "short", day: "numeric" }
                                      )
                                    : "N/A"}
                                </td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredAreas.length === 0 && (
                        <div
                          style={{
                            padding: "20px 0",
                            textAlign: "center",
                            fontSize: 14,
                            color: theme.textSecondary,
                            fontStyle: "italic",
                          }}
                        >
                          No concepts match the selected filters.
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
                </>
              )}
            </div>
          )}
        </div>
      )}


      {/* Source Material Insights Removed per request */}
      
      {/* CSS Animation for Spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

export default PerformanceAnalytics;
