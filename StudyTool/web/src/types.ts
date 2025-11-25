export type QuestionType = "mcq" | "multi" | "short" | "truefalse" | "cloze";

export interface QuestionDTO {
  id: number;
  stem: string;
  type: QuestionType;
  options?: string[] | null;
  concepts: number[];
}

export interface ExamOut {
  examId: number;
  questions: QuestionDTO[];
}

export interface UploadMetadata {
  themes?: string[];
  suggested_types?: string[];
  difficulty?: string;
  recommended_count?: number;
}

export interface UploadResponse {
  uploadId: number;
  stats: Record<string, unknown> & {
    metadata?: UploadMetadata;
  };
}

export interface UploadSummary {
  id: number;
  filename: string;
  created_at: string;
  question_count: number;
  themes: string[];
  exam_count: number;
  file_type: string;
  class_tags?: string[];
  question_type_counts?: Record<string, number> | null;
  is_archived: boolean;
}

export interface AttemptSummary {
  id: number;
  exam_id: number;
  upload_filename: string;
  score_pct: number;
  finished_at: string;
  question_count: number;
  correct_count: number;
  duration_seconds?: number | null;
  difficulty?: string | null;
  class_tags?: string[];
  exam_type?: string;
  average_time_per_question?: number | null;
}

export interface QuestionReview {
  question: QuestionDTO;
  user_answer: unknown;
  correct_answer: unknown;
  is_correct: boolean;
  ai_explanation?: string | null;
}

export interface AttemptDetail {
  id: number;
  exam_id: number;
  score_pct: number;
  finished_at: string;
  questions: QuestionReview[];
}

export interface GradeItem {
  questionId: number;
  correct: boolean;
  correctAnswer?: unknown;
  userAnswer?: unknown;
}

export interface GradeReport {
  scorePct: number;
  perQuestion: GradeItem[];
  attemptId?: number;
}

export interface Class {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
}

export interface ClassSummary extends Class {
  upload_count: number;
}

// Analytics types
export interface TimelineDataPoint {
  attempt_id: number;
  date: string;
  score: number;
  difficulty?: string;
  source_type?: string;
  upload_names: string[];
}

export interface QuestionTypeStats {
  [type: string]: {
    total: number;
    correct: number;
    accuracy: number;
  };
}

export interface SourceMaterialStats {
  [sourceName: string]: {
    accuracy: number;
    question_count: number;
    appearances: number;
  };
}

export interface DetailedAnalytics {
  timeline_data: TimelineDataPoint[];
  question_type_stats: QuestionTypeStats;
  source_material_stats: SourceMaterialStats;
}
