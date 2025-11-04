# Troubleshoot Network Error and Theme Undefined Error

## Issue 1: Network Error Despite Servers Running

**Symptoms:**

- start.ps1 says backend and frontend are online
- Getting network errors in the application
- Backend may have started but crashed immediately after

**Diagnostic Steps:**

### A. Check Backend Job Output

```powershell
Receive-Job -Name backend
```

This will show any error messages from the backend

### B. Manually Test Backend

```powershell
# Test if backend is actually responding
Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -UseBasicParsing
```

### C. Check for Import Errors

The models.py change added Column import - verify it's correct

### D. Check Database Migration

The color field was added - database may need recreation

```powershell
# Delete old database and let it recreate
Remove-Item "X:\StudyTool Local App Project\StudyTool\Study Website\exam.db"
```

**Most Likely Cause:**
Backend starts but crashes due to:

1. Import error in models.py
2. Database schema mismatch (new color field)
3. Missing dependency

**Fix:**

1. Read backend job output for actual error
2. Delete exam.db to force fresh schema creation
3. Restart servers

---

## Issue 2: TypeError - Cannot Read 'border' Property

**Error Location:**

```
ExamHistory.tsx:353:38
Cannot read properties of undefined (reading 'border')
```

**Root Cause:**
HistoryPage is not passing `darkMode` and `theme` props to ExamHistory component, but ExamHistory expects them.

**Files Involved:**

- `web/src/pages/HistoryPage.tsx` - Not passing theme props
- `web/src/components/ExamHistory.tsx` - Expects theme props (line 353)

**Fix Required:**

### Step 1: Update HistoryPage.tsx

Add outlet context and pass props:

```typescript
import { useOutletContext } from "react-router-dom";

export default function HistoryPage() {
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();

  // ... existing code ...

  <ExamHistory
    attempts={attempts}
    onReviewAttempt={handleReviewAttempt}
    onDeleteAttempt={handleDeleteAttempt}
    darkMode={darkMode}
    theme={theme}
  />;
}
```

### Step 2: Verify ExamHistory Props

ExamHistory already expects these props (we added them earlier), so just need to pass them from HistoryPage.

---

## Implementation Plan

### Part 1: Fix Theme Error (Quick)

1. Update HistoryPage.tsx to get theme from outlet context
2. Pass darkMode and theme to ExamHistory component

### Part 2: Diagnose Network Error

1. Check backend job output: `Receive-Job -Name backend`
2. Look for Python errors or import failures
3. Check if database needs recreation

### Part 3: Fix Backend Startup

Based on backend output, likely fixes:

- Delete exam.db and restart (if schema mismatch)
- Fix any import errors in models.py
- Verify all dependencies installed

---

## Quick Fix Commands

### See Backend Errors:

```powershell
Receive-Job -Name backend
```

### Force Fresh Start:

```powershell
# Stop everything
Get-Job | Stop-Job; Get-Job | Remove-Job

# Delete old database
Remove-Item "X:\StudyTool Local App Project\StudyTool\Study Website\exam.db" -Force

# Start fresh
.\start.ps1
```

---

## Expected Root Causes

**Network Error:**

- Backend crashed after initial startup due to database schema mismatch
- The new `color` field in Class model requires database recreation
- Backend job shows errors if you run `Receive-Job -Name backend`

**Theme Error:**

- HistoryPage not updated when we added theme support to other pages
- Simple fix: Add outlet context and pass props
