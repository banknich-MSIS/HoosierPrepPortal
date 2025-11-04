# UI Improvements - Sticky Nav, Layout Fixes, and Feature Enhancements

## Overview

Fix critical layout issues with page height and scrolling, make navbar sticky, improve dark mode consistency, add class color customization, and create a footer with utility links.

## 1. Fix Page Height & Layout Issues (CRITICAL)

**Problem:**

- ExamPage and ReviewPage use `height: "100vh"` which causes issues
- Submit button hidden below the fold
- Need to scroll to see submit button
- Navbar gets hidden when scrolling
- Layout doesn't adapt to screen size

**Solution:**

- Remove `height: "100vh"` from main containers
- Use flexbox with proper constraints
- Account for sticky navbar height
- Make submit button always accessible

**Files to modify:**

- `web/src/pages/ExamPage.tsx` - Change grid height to `min-height: calc(100vh - 60px)`
- `web/src/pages/ReviewPage.tsx` - Same height fix

**Implementation:**

```typescript
// BEFORE:
<div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, height: "100vh" }}>

// AFTER:
<div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, minHeight: "calc(100vh - 80px)" }}>
```

## 2. Make Navbar Sticky

**Implementation:**
Add to nav element in `web/src/App.tsx`:

```typescript
position: "sticky",
top: 0,
zIndex: 1000,
```

## 3. Fix Selected Option Colors for Dark Mode

**Problem:** Bright blue (#e3f2fd) doesn't work in dark mode

**Solution:** Use themed selection color

**Files to modify:**

- `web/src/components/QuestionCard.tsx`
- `web/src/pages/ExamPage.tsx` (summary modal)
- `web/src/pages/ReviewPage.tsx`

**Color scheme:**

```typescript
// Selected option background:
const selectedBg = darkMode ? "#2a4a62" : "#e3f2fd";
const selectedText = darkMode ? "#90caf9" : "#1976d2";
```

## 4. Change "Exam Summary" to "Exam Answers"

**Files to modify:**

- `web/src/pages/ExamPage.tsx`

**Changes:**

- Button text: "Exam Summary" → "Exam Answers"
- Modal title: "Exam Summary (Preview Only)" → "Exam Answers (Preview Only)"

## 5. Fix Exam Answers Modal Dark Mode

**Current issues:**

- Warning banner (#fff3cd) too bright
- Question cards inside modal are white
- Options not themed

**Solution:**

- Theme warning banner
- Theme all question cards
- Theme options display

## 6. Classes Page Dark Mode Improvements

**Files to modify:**

- `web/src/pages/ClassesPage.tsx`

**Changes:**

- Card backgrounds: Use `theme.cardBg`
- Modal backgrounds: Use `theme.modalBg`
- Input fields: Theme with proper contrast
- Borders: Use `theme.border`
- Text: Use `theme.text`

## 7. Add Color Picker for Classes (12 Colors)

**Implementation:**
Add `color` field to Class model and allow users to pick from 12 preset colors

**Backend changes:**

- `server/models.py` - Add `color: Mapped[Optional[str]]` to Class model
- `server/schemas.py` - Add `color: Optional[str]` to ClassCreate, ClassOut, ClassSummary

**Frontend changes:**

- `web/src/pages/ClassesPage.tsx` - Add color picker UI in create/edit modals
- `web/src/components/ClassTagSelector.tsx` - Use class color for tags
- `web/src/components/CSVLibrary.tsx` - Use actual class color instead of hash

**12 Color Palette:**

```typescript
const CLASS_COLORS = [
  { name: "Red", value: "#dc3545", bg: "#3d1a1a", text: "#ef5350" },
  { name: "Blue", value: "#007bff", bg: "#1a3a52", text: "#64b5f6" },
  { name: "Green", value: "#28a745", bg: "#1a3d1a", text: "#66bb6a" },
  { name: "Yellow", value: "#ffc107", bg: "#4d4520", text: "#ffb74d" },
  { name: "Purple", value: "#6f42c1", bg: "#2a1a3d", text: "#ba68c8" },
  { name: "Orange", value: "#fd7e14", bg: "#3d2a1a", text: "#ff9800" },
  { name: "Teal", value: "#20c997", bg: "#1a3d35", text: "#4db6ac" },
  { name: "Pink", value: "#e83e8c", bg: "#3d1a30", text: "#ec407a" },
  { name: "Indigo", value: "#6610f2", bg: "#2a1a3d", text: "#7c4dff" },
  { name: "Cyan", value: "#17a2b8", bg: "#1a353d", text: "#4fc3f7" },
  { name: "Brown", value: "#795548", bg: "#2a2220", text: "#a1887f" },
  { name: "Gray", value: "#6c757d", bg: "#2d2d2d", text: "#b0bec5" },
];
```

## 8. Fix Class Assignment Popup Dark Mode

**File:** `web/src/components/ClassTagSelector.tsx`

**Changes:**

- Dropdown background: `theme.modalBg`
- Item backgrounds: `theme.cardBg`
- Hover state: `theme.navHover`
- Selected state: Use class color
- Border: `theme.border`
- Text: `theme.text`

## 9. Add Footer Section

**File:** `web/src/App.tsx`

**Implementation:**
Add footer after `<Outlet />` with links to:

- **Utilities** - `/utilities` (tools page)
- **Support/Contact** - `/support` (contact info)
- **Instructions** - Opens tutorial modal
- **GitHub** - External link to repo

**Styling:**

- Fixed to bottom or part of scroll
- Themed for dark mode
- Subtle, non-intrusive
- Links in a row with separators

**Example:**

```typescript
<footer
  style={{
    marginTop: "auto",
    padding: "16px",
    borderTop: `1px solid ${theme.border}`,
    backgroundColor: theme.navBg,
    textAlign: "center",
  }}
>
  <div
    style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 14 }}
  >
    <a onClick={() => nav("/utilities")}>Utilities</a>
    <span>|</span>
    <a onClick={() => nav("/support")}>Support</a>
    <span>|</span>
    <a onClick={() => setShowTutorial(true)}>Instructions</a>
    <span>|</span>
    <a href="https://github.com/banknich-MSIS/StudyTool" target="_blank">
      GitHub
    </a>
  </div>
</footer>
```

## 10. Create Support and Utilities Pages

**New files:**

- `web/src/pages/SupportPage.tsx` - Contact information
- `web/src/pages/UtilitiesPage.tsx` - Utility tools (placeholder for now)

**Routes to add in** `web/src/main.tsx`:

- `/support` → SupportPage
- `/utilities` → UtilitiesPage

## Implementation Order

1. Fix page height issues (CRITICAL - makes UI usable)
2. Make navbar sticky
3. Fix selected option colors
4. Change "Summary" to "Answers"
5. Fix Exam Answers modal dark mode
6. Add color field to Class model/schema
7. Add color picker to Classes page
8. Fix class assignment popup
9. Add footer
10. Create support and utilities pages

## Expected Results

After implementation:

- ✅ Navbar stays visible while scrolling
- ✅ Submit button always accessible without scrolling
- ✅ Page height adapts to any screen size
- ✅ Selected options have appropriate dark mode colors
- ✅ "Exam Answers" instead of "Exam Summary"
- ✅ All modals properly themed
- ✅ Classes have custom colors
- ✅ Footer provides quick access to resources


