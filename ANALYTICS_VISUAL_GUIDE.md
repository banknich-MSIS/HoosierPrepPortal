# Analytics Extensions - Visual Guide

This document provides a visual overview of the three new analytics features and their placement in the UI.

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PERFORMANCE ANALYTICS                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🆕 RECENT PERFORMANCE MOMENTUM (Hero Card)           │  │
│  │                                                       │  │
│  │  Recent Performance (Last 7 Days vs Previous 7)      │  │
│  │                                                       │  │
│  │  Score: 78% → 84% (+6 pts)   Exams: 2 → 3           │  │
│  │                                        [📈 IMPROVING] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PERFORMANCE OVER TIME (Existing)                     │  │
│  │  [Line Chart: Score & Rolling Average]               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ QUESTION TYPE BREAKDOWN (Existing)                   │  │
│  │  [Donut Chart + Stats]                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🆕 WEAK AREAS DEEP DIVE                              │  │
│  │                                                       │  │
│  │  Top 3 weak areas: Hypothesis Testing, Regression... │  │
│  │                                                       │  │
│  │  [Horizontal Bar Chart - Worst 5 Concepts]           │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │ Concept          │ Accuracy │ Correct/Total   │  │  │
│  │  ├────────────────────────────────────────────────┤  │  │
│  │  │ Hypothesis Test  │   65.2%  │   15/23         │  │  │
│  │  │ Regression       │   72.1%  │   18/25         │  │  │
│  │  │ Confidence Int.  │   81.3%  │   22/27         │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🆕 TIME MANAGEMENT                                   │  │
│  │                                                       │  │
│  │  ┌──────────────────┐  ┌──────────────────────────┐ │  │
│  │  │ Avg Time/Q: 47s  │  │ Recommended: 35-40s      │ │  │
│  │  └──────────────────┘  └──────────────────────────┘ │  │
│  │                                                       │  │
│  │  Time per Question Over Time                         │  │
│  │  [Line Chart: Time trends]                           │  │
│  │                                                       │  │
│  │  Speed vs Accuracy                                   │  │
│  │  [Bar Chart: Time vs Score]                          │  │
│  │                                                       │  │
│  │  💡 Insight: You're accurate but slow. Practice      │  │
│  │     answering slightly faster to avoid running out   │  │
│  │     of time.                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Feature Details

### 1. Momentum Hero Card

**Visual Elements:**
- Large, prominent card at the top
- Score comparison with arrow (→) and delta in parentheses
- Exam count comparison
- Momentum chip with emoji and color coding:
  - 📈 Green background = Improving
  - 📉 Red background = Declining
  - ➡️ Gray background = Steady

**Color Scheme:**
- Background: Subtle theme color tint (crimson/amber based on mode)
- Text: Theme primary colors
- Chip: Semantic colors (green/red/gray)

### 2. Weak Areas Deep Dive

**Visual Elements:**
- Summary text box highlighting top 3 weak concepts
- Horizontal bar chart showing accuracy percentages
  - Y-axis: Concept names
  - X-axis: Accuracy percentage (0-100)
  - Bars: Theme crimson color
- Data table with alternating row colors
  - Accuracy column: Color-coded (red/orange/green)
  - Last seen: Formatted as "Jan 15"

**Empty State:**
```
┌────────────────────────────────────────────────┐
│ Not enough data yet to determine weak areas.  │
│ Answer more questions tagged with concepts.   │
└────────────────────────────────────────────────┘
```

### 3. Time Management Dashboard

**Visual Elements:**

**Summary Cards (Side by Side):**
```
┌─────────────────────┐  ┌─────────────────────┐
│ Average Time per Q  │  │ Recommended Range   │
│      47.3s          │  │      35-40s         │
└─────────────────────┘  └─────────────────────┘
```

**Time Trends Chart:**
- Line chart with time on Y-axis, attempts on X-axis
- Amber/yellow line color (theme color)
- Shows progression over time

**Speed vs Accuracy Chart:**
- Bar chart with time on X-axis, score on Y-axis
- Crimson bars (theme color)
- Each bar represents one attempt
- Tooltip shows date, time, and score

**Smart Insight Box:**
- Light background with theme tint
- 💡 emoji prefix
- Deterministic text based on recent performance:
  - Fast + low score → "Slow down"
  - Slow + high score → "Speed up"
  - Balanced → "Keep going"

**Empty State:**
```
┌────────────────────────────────────────────────┐
│ No timing data yet. Complete an exam with a   │
│ recorded duration to unlock time insights.    │
└────────────────────────────────────────────────┘
```

## Color Palette

### Dark Mode
- Primary: Mustard Yellow (#c29b4a)
- Text: White/Light gray
- Background: Dark with subtle transparency
- Charts: Mustard + grayscale palette

### Light Mode
- Primary: IU Crimson (#c41e3a)
- Text: Dark gray/Black
- Background: Light with subtle transparency
- Charts: Crimson + grayscale palette

### Semantic Colors (Both Modes)
- Success/Improving: Green (#10b981)
- Warning/Declining: Red (#ef4444)
- Neutral/Flat: Gray (#9ca3af)

## Responsive Behavior

All sections:
- Use responsive containers
- Charts scale with viewport width
- Tables scroll horizontally on small screens
- Cards stack vertically on mobile

## Data Flow

```
Backend (Python/Flask)
    ↓
GET /analytics/detailed
    ↓
JSON Response with new fields:
  - weak_areas[]
  - time_management{}
  - momentum{}
    ↓
Frontend (React/TypeScript)
    ↓
PerformanceAnalytics.tsx
    ↓
Renders three new sections
    ↓
Uses Recharts for visualization
```

## User Experience

### Progressive Enhancement
1. **No data:** Shows helpful messages
2. **Some data:** Shows partial insights
3. **Sufficient data:** Shows full analytics

### Loading States
- Existing loading spinner applies to all sections
- No additional loading states needed
- All sections render together

### Interactivity
- Chart tooltips show detailed information
- Table rows highlight on hover
- Momentum chip is static (no interaction)
- All charts use existing Recharts interactions

## Accessibility

- Semantic HTML structure
- Color is not the only indicator (text labels included)
- Charts include tooltips for screen readers
- Tables use proper thead/tbody structure
- Contrast ratios meet WCAG standards


