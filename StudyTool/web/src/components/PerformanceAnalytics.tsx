import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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

  // Momentum data
  const momentum = analytics.momentum;
  const hasMomentumData = momentum && (momentum.recent.exams_count > 0 || momentum.previous.exams_count > 0);
  
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

      {/* Recent Performance Momentum Hero Card */}
      {momentum && (
        <div
          style={{
            marginBottom: 24,
            padding: 20,
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
              fontSize: 16,
              fontWeight: 700,
              color: theme.crimson,
              marginBottom: 12,
            }}
          >
            Recent Performance (Last {momentum.recent_window_days} Days vs Previous {momentum.previous_window_days})
          </div>
          
          {!hasMomentumData ? (
            <div
              style={{
                fontSize: 14,
                color: theme.textSecondary,
                fontStyle: "italic",
              }}
            >
              Keep taking exams to unlock momentum insights.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {/* Score Comparison */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  Score
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 20,
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  {momentum.previous.avg_score_pct !== null ? (
                    <>
                      <span>{momentum.previous.avg_score_pct}%</span>
                      <span style={{ fontSize: 16, color: theme.textSecondary }}>→</span>
                      <span>{momentum.recent.avg_score_pct}%</span>
                      {momentum.deltas.score_change_pct_points !== null && (
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color:
                              momentum.deltas.score_change_pct_points > 0
                                ? "#10b981"
                                : momentum.deltas.score_change_pct_points < 0
                                ? "#ef4444"
                                : theme.textSecondary,
                          }}
                        >
                          ({momentum.deltas.score_change_pct_points > 0 ? "+" : ""}
                          {momentum.deltas.score_change_pct_points} pts)
                        </span>
                      )}
                    </>
                  ) : momentum.recent.avg_score_pct !== null ? (
                    <span>{momentum.recent.avg_score_pct}%</span>
                  ) : (
                    <span style={{ fontSize: 14, color: theme.textSecondary }}>
                      No data
                    </span>
                  )}
                </div>
              </div>

              {/* Exams Count */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  Exams
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: theme.text,
                  }}
                >
                  {momentum.previous.exams_count} → {momentum.recent.exams_count}
                </div>
              </div>

              {/* Momentum Chip */}
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  background:
                    momentum.momentum === "improving"
                      ? "rgba(16, 185, 129, 0.15)"
                      : momentum.momentum === "declining"
                      ? "rgba(239, 68, 68, 0.15)"
                      : "rgba(156, 163, 175, 0.15)",
                  color:
                    momentum.momentum === "improving"
                      ? "#10b981"
                      : momentum.momentum === "declining"
                      ? "#ef4444"
                      : theme.textSecondary,
                  border: `1px solid ${
                    momentum.momentum === "improving"
                      ? "rgba(16, 185, 129, 0.3)"
                      : momentum.momentum === "declining"
                      ? "rgba(239, 68, 68, 0.3)"
                      : theme.glassBorder
                  }`,
                }}
              >
                {momentum.momentum === "improving" && "📈 Improving"}
                {momentum.momentum === "declining" && "📉 Declining"}
                {momentum.momentum === "flat" && "➡️ Steady"}
              </div>
            </div>
          )}
        </div>
      )}

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
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
              color: theme.text,
            }}
          >
            Weak Areas Deep Dive
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
            <>
              {/* Summary */}
              <div
                style={{
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 16,
                  padding: 10,
                  background: darkMode
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.03)",
                  borderRadius: 6,
                  border: `1px solid ${theme.glassBorder}`,
                }}
              >
                <strong>Top 3 weak areas:</strong>{" "}
                {analytics.weak_areas
                  .slice(0, 3)
                  .map((area) => area.concept_name)
                  .join(", ")}
              </div>

              {/* Bar Chart for Worst 5 Concepts */}
              {analytics.weak_areas.length > 0 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={analytics.weak_areas.slice(0, 5)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme.glassBorder}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      stroke={theme.textSecondary}
                      style={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="concept_name"
                      stroke={theme.textSecondary}
                      style={{ fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? "#2d1819" : "#fff",
                        border: `1px solid ${theme.glassBorder}`,
                        borderRadius: 6,
                        fontSize: 12,
                        color: darkMode ? "#fff" : "#000",
                      }}
                      formatter={(value: any, name: string, props: any) => [
                        `${value}% (${props.payload.correct_attempts}/${props.payload.total_attempts})`,
                        "Accuracy",
                      ]}
                    />
                    <Bar dataKey="accuracy_pct" fill={theme.crimson} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* Detailed Table */}
              <div style={{ marginTop: 16, overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: `1px solid ${theme.glassBorder}`,
                      }}
                    >
                      <th
                        style={{
                          textAlign: "left",
                          padding: "8px 12px",
                          color: theme.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        Concept
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          color: theme.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        Accuracy
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          color: theme.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        Correct/Total
                      </th>
                      <th
                        style={{
                          textAlign: "right",
                          padding: "8px 12px",
                          color: theme.textSecondary,
                          fontWeight: 600,
                        }}
                      >
                        Last Seen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.weak_areas.map((area, idx) => (
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
                          }}
                        >
                          {area.concept_name}
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
              </div>
            </>
          )}
        </div>
      )}

      {/* Time Management Dashboard Section */}
      {analytics.time_management && (
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
            Time Management
          </div>

          {analytics.time_management.attempts.length === 0 ? (
            <div
              style={{
                fontSize: 14,
                color: theme.textSecondary,
                fontStyle: "italic",
                padding: "12px 0",
              }}
            >
              No timing data yet. Complete an exam with a recorded duration to
              unlock time insights.
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    padding: 12,
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
                    Average Time per Question
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: theme.text,
                    }}
                  >
                    {analytics.time_management.summary
                      .overall_avg_time_per_question_seconds !== null
                      ? `${analytics.time_management.summary.overall_avg_time_per_question_seconds}s`
                      : "N/A"}
                  </div>
                </div>
                <div
                  style={{
                    padding: 12,
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
                    Recommended Range
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: theme.text,
                    }}
                  >
                    {analytics.time_management.summary.recommended_range_seconds[0]}
                    –
                    {analytics.time_management.summary.recommended_range_seconds[1]}
                    s
                  </div>
                </div>
              </div>

              {/* Time per Question Over Time Chart */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.text,
                    marginBottom: 8,
                  }}
                >
                  Time per Question Over Time
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={analytics.time_management.attempts.map((att, idx) => ({
                      index: idx,
                      date: new Date(att.finished_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      ),
                      avg_time: att.avg_time_per_question_seconds,
                    }))}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme.glassBorder}
                    />
                    <XAxis
                      dataKey="index"
                      stroke={theme.textSecondary}
                      style={{ fontSize: 11 }}
                      tickFormatter={(val) => {
                        const item = analytics.time_management.attempts[val];
                        return item
                          ? new Date(item.finished_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )
                          : "";
                      }}
                      type="number"
                      domain={["dataMin", "dataMax"]}
                    />
                    <YAxis
                      stroke={theme.textSecondary}
                      style={{ fontSize: 11 }}
                      label={{
                        value: "Seconds",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11, fill: theme.textSecondary },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? "#2d1819" : "#fff",
                        border: `1px solid ${theme.glassBorder}`,
                        borderRadius: 6,
                        fontSize: 12,
                        color: darkMode ? "#fff" : "#000",
                      }}
                      formatter={(value: any) => [`${value}s`, "Avg Time"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_time"
                      stroke={theme.amber}
                      strokeWidth={2}
                      dot={{ fill: theme.amber, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Speed vs Accuracy Scatter Plot */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.text,
                    marginBottom: 8,
                  }}
                >
                  Speed vs Accuracy
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={analytics.time_management.attempts.map((att) => ({
                      time: att.avg_time_per_question_seconds,
                      score: att.score_pct,
                      date: new Date(att.finished_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      ),
                    }))}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={theme.glassBorder}
                    />
                    <XAxis
                      dataKey="time"
                      stroke={theme.textSecondary}
                      style={{ fontSize: 11 }}
                      label={{
                        value: "Avg Time per Question (s)",
                        position: "insideBottom",
                        offset: -5,
                        style: { fontSize: 11, fill: theme.textSecondary },
                      }}
                    />
                    <YAxis
                      dataKey="score"
                      stroke={theme.textSecondary}
                      style={{ fontSize: 11 }}
                      domain={[0, 100]}
                      label={{
                        value: "Score %",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 11, fill: theme.textSecondary },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? "#2d1819" : "#fff",
                        border: `1px solid ${theme.glassBorder}`,
                        borderRadius: 6,
                        fontSize: 12,
                        color: darkMode ? "#fff" : "#000",
                      }}
                      formatter={(value: any, name: string, props: any) => {
                        if (name === "score") return [`${value}%`, "Score"];
                        if (name === "time") return [`${value}s`, "Avg Time"];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.date;
                        }
                        return label;
                      }}
                    />
                    <Bar dataKey="score" fill={theme.crimson} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Text Interpretation */}
              {(() => {
                const recentAttempts = analytics.time_management.attempts.slice(-5);
                if (recentAttempts.length === 0) return null;

                const avgTime =
                  recentAttempts.reduce(
                    (sum, att) => sum + att.avg_time_per_question_seconds,
                    0
                  ) / recentAttempts.length;
                const avgScore =
                  recentAttempts.reduce((sum, att) => sum + att.score_pct, 0) /
                  recentAttempts.length;

                const [lowerBound, upperBound] =
                  analytics.time_management.summary.recommended_range_seconds;

                let interpretation = "";
                if (avgTime < lowerBound && avgScore < 75) {
                  interpretation =
                    "You're working very fast and missing more than you should. Try slowing down slightly on each question.";
                } else if (avgTime > upperBound && avgScore >= 80) {
                  interpretation =
                    "You're accurate but slow. Practice answering slightly faster to avoid running out of time.";
                } else {
                  interpretation =
                    "Your speed and accuracy are reasonably balanced. Keep practicing at this pace.";
                }

                return (
                  <div
                    style={{
                      padding: 12,
                      background: darkMode
                        ? "rgba(212, 166, 80, 0.08)"
                        : "rgba(196, 30, 58, 0.05)",
                      borderRadius: 6,
                      border: `1px solid ${theme.glassBorder}`,
                      fontSize: 13,
                      color: theme.text,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>💡 Insight:</strong> {interpretation}
                  </div>
                );
              })()}
            </>
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
