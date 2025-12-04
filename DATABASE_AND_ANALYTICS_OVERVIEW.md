# Database Schema and Performance Analytics Overview

## Database Schema (SQLAlchemy ORM)

### Core Tables and Relationships

#### 1. **Upload Table** (`uploads`)
The central entity representing study materials (CSV files or AI-generated content).

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `filename` (String 512): Name of the upload/study set
- `file_type` (String 16): Type - either "csv" (manual upload) or "ai_generated"
- `csv_file_path` (String 1024, Optional): File path for CSV uploads
- `is_archived` (Boolean): Archive status (default: False)
- `created_at` (DateTime): Timestamp of creation (UTC)

**Relationships:**
- One-to-Many: → `Concept` (concepts associated with this upload)
- One-to-Many: → `Question` (questions in this study set)
- One-to-Many: → `Exam` (exams created from this upload)
- Many-to-Many: ↔ `Class` (via `upload_classes` association table)

**Cascade Behavior:** All related concepts, questions, and exams are deleted when upload is deleted.

---

#### 2. **Question Table** (`questions`)
Individual questions within a study set.

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `upload_id` (Foreign Key → `uploads.id`, Indexed): Parent upload
- `stem` (Text): Question text/prompt
- `qtype` (String 16): Question type - "mcq", "multi", "short", "truefalse", or "cloze"
- `options` (JSON, Optional): Array of answer options (for MCQ/multi)
- `answer` (JSON, Optional): Correct answer(s) - format varies by qtype
- `concept_ids` (JSON Array, Optional): List of concept IDs this question tests
- `is_active` (Boolean): Whether question is active (default: True)
- `explanation` (Text, Optional): Answer explanation (AI-generated or manual)

**Question Type Details:**
- **mcq**: Single correct answer from 4 options
- **multi**: Multiple correct answers from 4+ options
- **short**: Free-text short answer (word or phrase)
- **truefalse**: True or False statement
- **cloze**: Fill-in-the-blank with one or more blanks

**Relationships:**
- Many-to-One: → `Upload`

---

#### 3. **Concept Table** (`concepts`)
Topics/themes extracted from study materials.

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `upload_id` (Foreign Key → `uploads.id`, Indexed): Parent upload
- `name` (String 256, Indexed): Concept name/theme
- `score` (Float): Performance score for this concept (default: 0.0)

**Relationships:**
- Many-to-One: → `Upload`

**Usage:** Used for filtering questions by topic and tracking concept-level performance.

---

#### 4. **Exam Table** (`exams`)
Configured exam instances created from uploads.

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `upload_id` (Foreign Key → `uploads.id`, Indexed): Source upload
- `settings` (JSON, Optional): Exam configuration object containing:
  - `difficulty`: "Easy" | "Medium" | "Hard"
  - `questionSourcing`: "Strict" | "Mixed" | "Creative"
  - `timeLimit`: Optional time limit in minutes
  - `examMode`: "exam" | "practice"
  - Other metadata fields
- `question_ids` (JSON Array): Ordered list of question IDs for this exam

**Relationships:**
- Many-to-One: → `Upload`
- One-to-Many: → `Attempt` (student attempts of this exam)

**Cascade Behavior:** All attempts are deleted when exam is deleted.

---

#### 5. **Attempt Table** (`attempts`)
Individual student attempts/sessions of exams.

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `exam_id` (Foreign Key → `exams.id`, Indexed): Parent exam
- `started_at` (DateTime): When attempt began (UTC)
- `finished_at` (DateTime, Optional): When attempt was completed (NULL = in progress)
- `score_pct` (Float, Optional): Final score as percentage (0-100)
- `exam_type` (String 16, Optional): "exam" or "practice" (default: "exam")
- `duration_seconds` (Integer, Optional): Total time taken in seconds
- `status` (String 16, Optional): "in_progress" or "completed" (default: "completed")
- `progress_state` (JSON, Optional): Saves partial progress for resumption:
  - Current question index
  - Answered question IDs
  - Timestamps
  - Other state data

**Relationships:**
- Many-to-One: → `Exam`
- One-to-Many: → `AttemptAnswer` (individual question answers)

**Cascade Behavior:** All attempt answers are deleted when attempt is deleted.

---

#### 6. **AttemptAnswer Table** (`attempt_answers`)
Individual question responses within an attempt.

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `attempt_id` (Foreign Key → `attempts.id`, Indexed): Parent attempt
- `question_id` (Foreign Key → `questions.id`, Indexed): Question being answered
- `response` (JSON, Optional): Student's answer - format varies by question type
- `correct` (Boolean, Optional): Whether answer was correct (NULL = pending AI validation)
- `ai_explanation` (Text, Optional): AI-generated explanation for incorrect answers

**Relationships:**
- Many-to-One: → `Attempt`
- Many-to-One: → `Question` (indirectly via question_id)

**Usage:** Stores granular answer data for grading, review, and analytics.

---

#### 7. **Class Table** (`classes`)
Organizational categories for grouping study materials.

**Fields:**
- `id` (Integer, Primary Key): Unique identifier
- `name` (String 256): Class name (e.g., "ITS", "CPA", "Biology 101")
- `description` (Text, Optional): Optional description
- `color` (String 16, Optional): Hex color code for UI (default: "#007bff")
- `created_at` (DateTime): Timestamp of creation (UTC)

**Relationships:**
- Many-to-Many: ↔ `Upload` (via `upload_classes` association table)

**Usage:** Organize uploads by course/topic; filter exams and analytics by class.

---

#### 8. **Association Table: upload_classes**
Many-to-many relationship between uploads and classes.

**Fields:**
- `upload_id` (Foreign Key → `uploads.id`, Primary Key)
- `class_id` (Foreign Key → `classes.id`, Primary Key)

---

### Key Indexes
- `concepts.upload_id`: Fast lookup of concepts by upload
- `concepts.name`: Search concepts by name
- `questions.upload_id`: Fast question retrieval by upload
- `exams.upload_id`: Fast exam lookup by upload
- `attempts.exam_id`: Fast attempt retrieval by exam
- `attempt_answers.attempt_id`: Fast answer lookup by attempt
- `attempt_answers.question_id`: Fast answer lookup by question

---

## Performance Analytics System

### Backend Analytics Endpoint

**Route:** `GET /analytics/detailed`

**Purpose:** Aggregates and computes comprehensive performance metrics across all completed exam attempts.

#### Data Collection Process

1. **Query all completed attempts** (where `finished_at IS NOT NULL`)
2. **For each attempt:**
   - Retrieve associated exam and upload
   - Extract exam settings (difficulty, source type)
   - Fetch all attempt answers
   - Join with question data to get question types
   
3. **Aggregate three categories of statistics:**

---

### Analytics Data Structure

#### 1. **Timeline Data** (`timeline_data`)
Chronological performance history.

**Structure:**
```python
{
  "attempt_id": int,
  "date": str (ISO datetime),
  "score": float (0-100, rounded to 2 decimals),
  "difficulty": str ("Easy" | "Medium" | "Hard"),
  "source_type": str ("Strict" | "Mixed" | "Creative"),
  "upload_names": List[str]  # Source material names
}
```

**Sorted by:** `finished_at` ascending (oldest to newest)

**Used for:**
- Line chart showing score progression over time
- Calculating cumulative average performance
- Tracking difficulty trends
- Filtering by exam parameters

---

#### 2. **Question Type Statistics** (`question_type_stats`)
Performance breakdown by question format.

**Calculation:**
- Track correct/total for each question type across ALL attempts
- Each question answered increments type-specific counters
- Calculate accuracy percentage per type

**Structure:**
```python
{
  "mcq": {
    "total": int,      # Total MCQ questions answered
    "correct": int,    # Correct MCQ answers
    "accuracy": float  # Rounded to 1 decimal (e.g., 78.5)
  },
  "short": { ... },
  "truefalse": { ... },
  "cloze": { ... },
  "multi": { ... }
}
```

**Used for:**
- Donut chart showing question type distribution
- Bar chart comparing accuracy by type
- Identifying strongest/weakest question formats
- Targeted practice recommendations

---

#### 3. **Source Material Statistics** (`source_material_stats`)
Performance by study material/upload.

**Calculation:**
- Group questions by source upload (filename)
- Track unique questions per source (deduplicated by question_id)
- Count "appearances" (how many exams included this source)
- Calculate accuracy per source

**Structure:**
```python
{
  "filename1.csv": {
    "accuracy": float,       # Rounded to 1 decimal
    "question_count": int,   # Unique questions answered from this source
    "appearances": int       # Number of exams that included this source
  },
  "AI Generated Quiz 3": { ... }
}
```

**Deduplication Logic:**
- Uses a set of `question_ids` per source
- Only counts each unique question once per source
- Prevents inflating stats when same questions appear in multiple exams

**Used for:**
- Bar chart showing accuracy by study material
- Identifying which materials need review
- Tracking most/least mastered content
- Source-specific study recommendations

---

### Frontend Analytics Component

**Component:** `PerformanceAnalytics.tsx`

**Key Features:**

#### 1. **Performance Over Time Chart** (Line Chart)
- **X-axis:** Attempt index with date labels (e.g., "Jan 15")
- **Y-axis:** Score percentage (0-100)
- **Lines:**
  - Solid line (Crimson): Actual exam scores
  - Dashed line (Amber): Cumulative rolling average
- **Interactivity:**
  - Hover tooltips show exact score, date, difficulty
  - Click data points for drill-down (future feature)
- **Class Filter:** Dropdown to filter by class tags
- **Data Processing:**
  - Calculates running average: `sum(scores) / attempt_count`
  - Prevents date collision by using index-based X-axis

**Chart Data Format:**
```typescript
{
  index: number,           // Unique X-axis value
  date: string,           // "Jan 15" format for display
  fullDate: string,       // ISO datetime
  score: number,          // 0-100
  rollingAvg: number,     // Running average
  difficulty: string,     // "E", "M", "H" (abbreviated)
  sourceType: string      // "Strict" | "Mixed" | "Creative"
}
```

---

#### 2. **Question Type Breakdown** (Donut Chart + List)
- **Donut Chart:** Shows distribution of questions by type
  - Inner radius: 50px, Outer radius: 70px
  - Color scheme: Theme color (Crimson/Amber) + grayscale palette
  - Hover shows accuracy percentage and correct/total ratio
  
- **Legend List:** Right side shows each type with:
  - Color indicator square
  - Type name (formatted: "Multiple Choice", not "mcq")
  - Distribution percentage (of total questions)
  
- **Summary Cards:**
  - **Strongest Format:** Type with highest accuracy
  - **Needs Practice:** Type with lowest accuracy
  
**Color Palettes:**
- Light mode: Crimson (#c41e3a) + gray scale
- Dark mode: Amber (#c29b4a) + light gray scale

---

#### 3. **AI Performance Insights** (Currently Hidden)
Auto-generates personalized insights using Gemini API.

**Insight Generation Triggers:**
- First exam completion
- Every 5th new exam
- Manual refresh button
- Data changes (exam deleted, new attempt)

**Insight Structure:**
```typescript
{
  insights: string,        // 2-3 sentences of actionable advice
  timestamp: number,       // Unix timestamp
  examCount: number,       // Number of exams at generation time
  avgScore: number        // Average score at generation time
}
```

**Stored in:** `localStorage` under `performance_insights`

**Insight Content Includes:**
- Overall trend (improving, stable, declining)
- Strongest question type performance
- Weakest areas needing focus
- Specific source materials to review
- Actionable next step recommendation

**Example Insight:**
> "You're showing strong improvement with a 12% increase over your last 5 exams! Multiple Choice questions remain your strength at 87%, but True/False accuracy (62%) suggests you're rushing through statements. Focus on carefully reading qualifier words like 'always' and 'never' in your next practice session."

---

### Analytics Data Flow

```
[Student completes exam]
     ↓
[Attempt record saved with finished_at timestamp]
     ↓
[Dashboard requests: GET /analytics/detailed]
     ↓
[Backend aggregates:]
  - Timeline data from attempts
  - Question type stats from attempt_answers + questions
  - Source material stats from uploads + attempt_answers
     ↓
[Frontend receives analytics object]
     ↓
[PerformanceAnalytics component:]
  - Renders line chart (timeline)
  - Renders donut chart (question types)
  - Optionally: generates AI insights
     ↓
[User views performance dashboard]
     ↓
[Optionally: Filters by class tag]
     ↓
[Charts update with filtered data]
```

---

### Key Algorithms

#### Cumulative Average Calculation
```python
running_sum = 0
for index, score in enumerate(scores):
    running_sum += score
    avg = running_sum / (index + 1)
    cumulative_averages.append(avg)
```

#### Question Type Accuracy
```python
for attempt in attempts:
    for answer in attempt.answers:
        question = get_question(answer.question_id)
        type_stats[question.qtype]["total"] += 1
        if answer.correct:
            type_stats[question.qtype]["correct"] += 1

# Calculate percentages
for qtype in type_stats:
    accuracy = (correct / total) * 100 if total > 0 else 0
    type_stats[qtype]["accuracy"] = round(accuracy, 1)
```

#### Source Material Deduplication
```python
source_stats = {}
for attempt in attempts:
    source_name = attempt.exam.upload.filename
    
    if source_name not in source_stats:
        source_stats[source_name] = {
            "total": 0,
            "correct": 0,
            "appearances": 0,
            "question_ids": set()
        }
    
    source_stats[source_name]["appearances"] += 1
    
    for answer in attempt.answers:
        qid = answer.question_id
        # Only count each unique question once
        if qid not in source_stats[source_name]["question_ids"]:
            source_stats[source_name]["question_ids"].add(qid)
            source_stats[source_name]["total"] += 1
            if answer.correct:
                source_stats[source_name]["correct"] += 1
```

---

### Current Limitations and Considerations

1. **No Historical Snapshots:** Analytics recalculated on every request; no historical aggregation tables
2. **Single User Assumption:** No multi-user isolation (designed for individual student use)
3. **Memory Overhead:** All attempts loaded into memory for aggregation (may scale poorly with thousands of attempts)
4. **No Time-Range Filtering:** Shows all-time data; no date range selector
5. **Concept Performance:** Concept scores tracked in table but not yet used in analytics UI
6. **Source Material Removed:** Previously had source material bar chart; currently hidden in UI
7. **Class Filtering:** Only filters timeline chart; doesn't filter question type or source stats
8. **AI Insights:** Feature exists but currently hidden/disabled in UI

---

### Analytics Response Example

```json
{
  "timeline_data": [
    {
      "attempt_id": 42,
      "date": "2024-01-15T14:30:00",
      "score": 85.5,
      "difficulty": "Medium",
      "source_type": "Mixed",
      "upload_names": ["Biology Chapter 3"]
    },
    {
      "attempt_id": 43,
      "date": "2024-01-17T09:15:00",
      "score": 92.0,
      "difficulty": "Hard",
      "source_type": "Strict",
      "upload_names": ["Advanced Biology"]
    }
  ],
  "question_type_stats": {
    "mcq": {
      "total": 45,
      "correct": 38,
      "accuracy": 84.4
    },
    "short": {
      "total": 22,
      "correct": 18,
      "accuracy": 81.8
    },
    "truefalse": {
      "total": 15,
      "correct": 12,
      "accuracy": 80.0
    }
  },
  "source_material_stats": {
    "Biology Chapter 3": {
      "accuracy": 85.0,
      "question_count": 30,
      "appearances": 3
    },
    "Advanced Biology": {
      "accuracy": 78.5,
      "question_count": 25,
      "appearances": 2
    }
  }
}
```

---

### Related Database Queries

**Most Common Query Patterns:**

1. **Get all attempts for a user:**
   ```sql
   SELECT * FROM attempts 
   WHERE finished_at IS NOT NULL 
   ORDER BY finished_at ASC
   ```

2. **Get question type breakdown for an attempt:**
   ```sql
   SELECT q.qtype, COUNT(*) as total, SUM(CASE WHEN aa.correct THEN 1 ELSE 0 END) as correct
   FROM attempt_answers aa
   JOIN questions q ON aa.question_id = q.id
   WHERE aa.attempt_id = ?
   GROUP BY q.qtype
   ```

3. **Get source material accuracy:**
   ```sql
   SELECT u.filename, 
          COUNT(DISTINCT q.id) as question_count,
          SUM(CASE WHEN aa.correct THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as accuracy
   FROM attempt_answers aa
   JOIN questions q ON aa.question_id = q.id
   JOIN uploads u ON q.upload_id = u.id
   GROUP BY u.filename
   ```

---

## Summary

- **8 core tables** with clear relationships and cascade behaviors
- **3 main analytics metrics**: timeline, question types, source materials
- **Real-time aggregation** from attempt data (no pre-computed analytics tables)
- **Flexible filtering** by class tags
- **AI-powered insights** for personalized recommendations (feature currently hidden)
- **Comprehensive performance tracking** across multiple dimensions: time, format, source, difficulty

The system is designed for single-user student use cases with emphasis on visual performance tracking and identifying areas for improvement.

