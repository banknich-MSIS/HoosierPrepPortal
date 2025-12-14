# Analytics Extensions Implementation

This document describes the three new analytics features added to the HoosierPrepPortal study app.

## Overview

The analytics system has been extended with three new features while maintaining full backward compatibility with existing functionality:

1. **Weak Areas Deep Dive** - Concept-level performance tracking
2. **Time Management Dashboard** - Speed and efficiency analysis
3. **Recent Performance Momentum** - 7-day vs 7-day comparison

## Backend Changes

### File: `StudyTool/server/routes/analytics.py`

#### New Configuration Constants

```python
MIN_ATTEMPTS_FOR_CONCEPT = 5  # Minimum attempts before showing concept stats
RECOMMENDED_TIME_RANGE_SECONDS = [35.0, 40.0]  # Target time per question
RECENT_WINDOW_DAYS = 7  # Recent performance window
PREVIOUS_WINDOW_DAYS = 7  # Previous performance window
MOMENTUM_THRESHOLD_PCT_POINTS = 2.0  # Threshold for momentum classification
```

#### New Helper Functions

1. **`calculate_weak_areas(attempts, db)`**
   - Aggregates concept-level performance across all attempts
   - Tracks total attempts and correct attempts per concept
   - Filters out concepts with fewer than MIN_ATTEMPTS_FOR_CONCEPT
   - Returns concepts sorted by accuracy (worst first)
   - Includes last_seen_at timestamp for each concept

2. **`calculate_time_management(attempts, db)`**
   - Calculates average time per question for each attempt
   - Computes overall weighted average across all attempts
   - Returns detailed attempt-level timing data
   - Includes recommended time range for reference

3. **`calculate_momentum(attempts)`**
   - Partitions attempts into recent (last 7 days) and previous (7-14 days ago) windows
   - Calculates average scores for each window
   - Determines momentum classification: "improving", "declining", or "flat"
   - Uses configurable threshold (2 percentage points) for classification

#### Extended Response Schema

The `/analytics/detailed` endpoint now returns:

```json
{
  "timeline_data": [...],  // Existing
  "question_type_stats": {...},  // Existing
  "source_material_stats": {...},  // Existing
  "weak_areas": [  // NEW
    {
      "concept_id": 123,
      "concept_name": "Hypothesis Testing",
      "accuracy_pct": 65.2,
      "correct_attempts": 15,
      "total_attempts": 23,
      "last_seen_at": "2024-01-17T09:15:00Z"
    }
  ],
  "time_management": {  // NEW
    "summary": {
      "overall_avg_time_per_question_seconds": 47.3,
      "recommended_range_seconds": [35.0, 40.0]
    },
    "attempts": [
      {
        "attempt_id": 42,
        "finished_at": "2024-01-15T14:30:00Z",
        "score_pct": 85.5,
        "duration_seconds": 900,
        "question_count": 20,
        "avg_time_per_question_seconds": 45.0
      }
    ]
  },
  "momentum": {  // NEW
    "recent_window_days": 7,
    "previous_window_days": 7,
    "recent": {
      "exams_count": 3,
      "avg_score_pct": 84.0
    },
    "previous": {
      "exams_count": 2,
      "avg_score_pct": 78.8
    },
    "deltas": {
      "score_change_pct_points": 5.2,
      "exams_change": 1
    },
    "momentum": "improving"
  }
}
```

## Frontend Changes

### File: `StudyTool/web/src/types.ts`

Added new TypeScript interfaces:
- `WeakArea`
- `TimeManagementAttempt`
- `TimeManagement`
- `MomentumWindow`
- `Momentum`
- Extended `DetailedAnalytics` interface

### File: `StudyTool/web/src/components/PerformanceAnalytics.tsx`

#### 1. Recent Performance Momentum (Hero Card)

**Location:** Top of analytics page, before existing charts

**Features:**
- Displays score comparison: previous avg → recent avg (with delta)
- Shows exam count comparison
- Momentum chip with visual indicators:
  - 📈 Improving (green) - score increased by >2 percentage points
  - 📉 Declining (red) - score decreased by >2 percentage points
  - ➡️ Steady (gray) - change within ±2 percentage points
- Graceful handling of insufficient data

**Styling:**
- Consistent with existing theme colors (crimson/amber)
- Glass morphism design matching other cards
- Responsive layout

#### 2. Weak Areas Deep Dive Section

**Location:** After Question Type Breakdown section

**Features:**
- Summary text showing top 3 weak concepts
- Horizontal bar chart of worst 5 concepts (using Recharts BarChart)
- Detailed table with columns:
  - Concept name
  - Accuracy percentage (color-coded: red <60%, orange 60-75%, green ≥75%)
  - Correct/Total attempts
  - Last seen date
- Empty state message when insufficient data

**Data Visualization:**
- Bar chart uses existing theme colors
- Table rows alternate background colors for readability
- Sorted by accuracy (worst first)

#### 3. Time Management Dashboard Section

**Location:** After Weak Areas section

**Features:**
- Summary cards showing:
  - Overall average time per question
  - Recommended time range (35-40 seconds)
- Line chart: Time per question over time
- Bar chart: Speed vs Accuracy (time on X-axis, score on Y-axis)
- Smart interpretation text based on recent 5 attempts:
  - Fast + low accuracy → "Slow down slightly"
  - Slow + high accuracy → "Practice answering faster"
  - Balanced → "Keep practicing at this pace"
- Empty state message when no timing data

**Chart Details:**
- Uses existing Recharts library (LineChart, BarChart)
- Consistent styling with existing charts
- Tooltips show detailed information
- Axes properly labeled with units

## Testing

### File: `StudyTool/server/tests/test_analytics_extended.py`

Comprehensive test suite covering:

**Weak Areas Tests:**
- No attempts scenario
- Insufficient data (below minimum threshold)
- Sufficient data with varying accuracy levels
- Correct sorting by accuracy

**Time Management Tests:**
- No attempts scenario
- Multiple attempts with different durations
- Correct average calculation
- Question count handling

**Momentum Tests:**
- No attempts scenario
- Improving performance (score increase >2 pts)
- Declining performance (score decrease >2 pts)
- Flat performance (change within threshold)

## Edge Cases Handled

### Backend
1. **No data scenarios:** Returns empty arrays/null values instead of crashing
2. **Division by zero:** Guards in time calculations
3. **Missing concept names:** Falls back to "Concept #<id>"
4. **Null timestamps:** Handles missing finished_at dates
5. **Zero duration:** Skips attempts with invalid duration data

### Frontend
1. **Empty data arrays:** Shows descriptive messages
2. **Null values:** Displays "N/A" or appropriate fallback
3. **Missing momentum data:** Shows "Keep taking exams..." message
4. **No timing data:** Shows "Complete an exam..." message
5. **Chart rendering:** Handles empty datasets gracefully

## Backward Compatibility

✅ **Fully backward compatible:**
- Existing API response fields unchanged
- New fields added as additional top-level keys
- Frontend components that don't use new features continue to work
- No breaking changes to existing analytics functionality

## Configuration

All thresholds and parameters are configurable via constants at the top of `analytics.py`:
- `MIN_ATTEMPTS_FOR_CONCEPT`: Minimum attempts before showing concept (default: 5)
- `RECOMMENDED_TIME_RANGE_SECONDS`: Target time range (default: [35, 40])
- `RECENT_WINDOW_DAYS`: Recent performance window (default: 7)
- `PREVIOUS_WINDOW_DAYS`: Previous performance window (default: 7)
- `MOMENTUM_THRESHOLD_PCT_POINTS`: Momentum classification threshold (default: 2.0)

## Usage

No additional setup required. The features activate automatically when:
1. Backend server is running
2. User navigates to the Dashboard/Analytics page
3. Sufficient exam data exists in the database

The analytics endpoint continues to work with zero data, returning appropriate empty structures.

## Future Enhancements

Potential improvements (not implemented):
1. Configurable time windows for momentum (e.g., 14-day comparison)
2. Concept-level recommendations powered by AI
3. Export analytics data to CSV/PDF
4. Historical momentum trends (beyond 2 windows)
5. Customizable time per question recommendations based on exam type


