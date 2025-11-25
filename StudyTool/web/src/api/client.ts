import axios from "axios";
import type {
  AttemptDetail,
  AttemptSummary,
  ExamOut,
  GradeReport,
  QuestionType,
  UploadResponse,
  UploadSummary,
  DetailedAnalytics,
} from "../types";

/**
 * Get the backend URL for the current environment
 */
function getBackendURL(): string {
  // Browser mode - use default port
  return "http://127.0.0.1:8000/api";
}

const api = axios.create({ baseURL: getBackendURL() });

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === "ECONNREFUSED" || error.message.includes("fetch")) {
      console.error("Backend unreachable:", error.message);
      console.error("Attempted URL:", error.config?.url);
    } else if (error.response?.status === 404) {
      console.error("Backend endpoint not found:", error.config?.url);
      console.error("Response:", error.response?.data);
    }
    return Promise.reject(error);
  }
);

export async function uploadCsv(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload/csv", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function uploadText(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<UploadResponse>("/upload/text", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchConcepts(uploadId: number) {
  const { data } = await api.get<{ id: number; name: string; score: number }[]>(
    `/concepts/${uploadId}`
  );
  return data;
}

export async function createExam(params: {
  uploadId: number;
  includeConceptIds: number[];
  questionTypes: QuestionType[];
  count: number;
}) {
  const { data } = await api.post<ExamOut>("/exams", params);
  return data;
}

export async function getExam(examId: number) {
  const { data } = await api.get<ExamOut>(`/exams/${examId}`);
  return data;
}

export async function gradeExam(
  examId: number,
  answers: { questionId: number; response: unknown }[],
  apiKey?: string,
  durationSeconds?: number,
  examType?: "exam" | "practice"
) {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-Gemini-API-Key"] = apiKey;
  }
  if (durationSeconds !== undefined) {
    headers["X-Exam-Duration"] = durationSeconds.toString();
  }
  if (examType) {
    headers["X-Exam-Type"] = examType;
  }

  const { data } = await api.post<GradeReport>(
    `/exams/${examId}/grade`,
    answers,
    { headers }
  );
  return data;
}

// Dashboard API methods
export async function fetchAllUploads(
  archived: boolean = false
): Promise<UploadSummary[]> {
  const { data } = await api.get<UploadSummary[]>("/uploads", {
    params: { archived },
  });
  return data;
}

export async function archiveUpload(uploadId: number): Promise<void> {
  await api.put(`/uploads/${uploadId}/archive`);
}

export async function unarchiveUpload(uploadId: number): Promise<void> {
  await api.put(`/uploads/${uploadId}/unarchive`);
}

export async function fetchRecentAttempts(
  limit: number = 10
): Promise<AttemptSummary[]> {
  const { data } = await api.get<AttemptSummary[]>(
    `/attempts/recent?limit=${limit}`
  );
  return data;
}

export async function fetchAllAttempts(): Promise<AttemptSummary[]> {
  const { data } = await api.get<AttemptSummary[]>("/attempts");
  return data;
}

export async function fetchInProgressAttempts(): Promise<AttemptSummary[]> {
  const { data } = await api.get<AttemptSummary[]>("/attempts/in-progress");
  return data;
}

export async function fetchAttemptDetail(
  attemptId: number
): Promise<AttemptDetail> {
  const { data } = await api.get<AttemptDetail>(`/attempts/${attemptId}`);
  return data;
}

export async function deleteUpload(uploadId: number): Promise<void> {
  try {
    await api.delete(`/uploads/${uploadId}`);
  } catch (e: any) {
    const status = e?.response?.status;
    // Treat missing upload as already deleted (idempotent behavior)
    if (status === 404) {
      return;
    }
    throw e;
  }
}

export async function downloadCSV(uploadId: number): Promise<Blob> {
  const { data } = await api.get(`/uploads/${uploadId}/download`, {
    responseType: "blob",
  });
  return data;
}

export async function deleteAttempt(attemptId: number): Promise<void> {
  await api.delete(`/attempts/delete/${attemptId}`);
}

export async function updateUploadName(
  uploadId: number,
  newName: string
): Promise<void> {
  await api.patch(`/uploads/${uploadId}`, null, {
    params: { new_name: newName },
  });
}

export async function fetchUpload(uploadId: number): Promise<UploadSummary> {
  const { data } = await api.get<UploadSummary>(`/uploads/${uploadId}`);
  return data;
}

export async function previewExamAnswers(
  examId: number
): Promise<{ answers: Array<{ questionId: number; correctAnswer: any }> }> {
  const { data } = await api.get(`/exams/${examId}/preview`);
  return data;
}

// Progress saving API methods
export async function startAttempt(examId: number): Promise<{
  attempt_id: number;
  status: string;
  started_at: string;
  progress_state: any;
}> {
  const { data } = await api.post(`/exams/${examId}/start-attempt`);
  return data;
}

export async function getInProgressAttempt(examId: number): Promise<{
  exists: boolean;
  attempt_id?: number;
  status?: string;
  started_at?: string;
  progress_state?: any;
  saved_answers?: Record<number, any>;
}> {
  const { data } = await api.get(`/exams/${examId}/in-progress-attempt`);
  return data;
}

export async function saveProgress(
  attemptId: number,
  progressData: {
    answers: Record<number, any>;
    bookmarks: number[];
    current_question_index: number;
    timer_state?: { remaining_seconds: number } | null;
    exam_type: "exam" | "practice";
    completed_questions?: number[];
  }
): Promise<{
  success: boolean;
  attempt_id: number;
  status: string;
  last_saved_at?: string;
}> {
  const { data } = await api.post(
    `/attempts/${attemptId}/save-progress`,
    progressData
  );
  return data;
}

export async function getProgress(attemptId: number): Promise<{
  attempt_id: number;
  status: string;
  started_at: string;
  progress_state: any;
  saved_answers: Record<number, any>;
}> {
  const { data } = await api.get(`/attempts/${attemptId}/progress`);
  return data;
}

// Class management API methods
export async function createClass(
  name: string,
  description?: string,
  color?: string
): Promise<import("../types").Class> {
  const { data } = await api.post("/classes", { name, description, color });
  return data;
}

export async function fetchClasses(): Promise<
  import("../types").ClassSummary[]
> {
  const { data } = await api.get("/classes");
  return data;
}

export async function updateClass(
  id: number,
  name?: string,
  description?: string,
  color?: string
): Promise<import("../types").Class> {
  const { data } = await api.put(`/classes/${id}`, {
    name,
    description,
    color,
  });
  return data;
}

export async function deleteClass(id: number): Promise<void> {
  await api.delete(`/classes/${id}`);
}

export async function assignUploadToClass(
  uploadId: number,
  classId: number
): Promise<void> {
  await api.post(`/uploads/${uploadId}/classes/${classId}`);
}

export async function removeUploadFromClass(
  uploadId: number,
  classId: number
): Promise<void> {
  await api.delete(`/uploads/${uploadId}/classes/${classId}`);
}

// AI Generation API methods
export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  try {
    const { data } = await api.post("/ai/validate-key", {
      api_key: apiKey.trim(),
    });
    return data.valid;
  } catch {
    return false;
  }
}

export async function validateGeminiKeyDetailed(
  apiKey: string
): Promise<{ valid: boolean; message: string }> {
  try {
    const { data } = await api.post("/ai/validate-key", {
      api_key: apiKey.trim(),
    });
    return { valid: !!data.valid, message: data.message };
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || "Unknown error";
    return { valid: false, message: msg };
  }
}

export async function generateExamFromFiles(params: {
  files: FormData;
  questionCount: number;
  difficulty: string;
  questionTypes: string[];
  focusConcepts: string[];
  examName?: string;
  examMode?: string;
  generationMode?: "strict" | "mixed" | "creative";
  selectedClassId?: number;
  apiKey: string;
}): Promise<{ exam_id: number; upload_id: number; stats: any }> {
  const formData = params.files;
  formData.append("question_count", params.questionCount.toString());
  formData.append("difficulty", params.difficulty);
  formData.append("question_types", params.questionTypes.join(","));
  if (params.focusConcepts.length > 0) {
    formData.append("focus_concepts", params.focusConcepts.join(","));
  }
  if (params.examName) {
    formData.append("exam_name", params.examName);
  }
  if (params.examMode) {
    formData.append("exam_mode", params.examMode);
  }
  if (params.generationMode) {
    formData.append("generation_mode", params.generationMode);
  }
  if (params.selectedClassId) {
    formData.append("class_id", params.selectedClassId.toString());
  }

  const { data } = await api.post("/ai/generate-exam", formData, {
    headers: {
      "X-Gemini-API-Key": params.apiKey,
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

export async function getSupportedFormats(): Promise<{ formats: string[] }> {
  const { data } = await api.get("/ai/supported-formats");
  return data;
}

// Async job-based generation
export async function startExamGenerationJob(params: {
  files: FormData;
  questionCount: number;
  difficulty: string;
  questionTypes: string[];
  focusConcepts: string[];
  examName: string;
  examMode?: string;
  generationMode?: "strict" | "mixed" | "creative";
  selectedClassId?: number;
  apiKey: string;
}): Promise<{ jobId: string }> {
  const formData = params.files;
  formData.append("question_count", params.questionCount.toString());
  formData.append("difficulty", params.difficulty);
  formData.append("question_types", params.questionTypes.join(","));
  if (params.focusConcepts.length > 0) {
    formData.append("focus_concepts", params.focusConcepts.join(","));
  }
  formData.append("exam_name", params.examName);
  if (params.examMode) {
    formData.append("exam_mode", params.examMode);
  }
  if (params.generationMode) {
    formData.append("generation_mode", params.generationMode);
  }
  if (params.selectedClassId) {
    formData.append("class_id", params.selectedClassId.toString());
  }

  const { data } = await api.post("/exams/generate", formData, {
    headers: {
      "X-Gemini-API-Key": params.apiKey,
      "Content-Type": "multipart/form-data",
    },
    validateStatus: (status) => status === 202 || status === 200,
  });
  return data;
}

export async function getJobStatus(jobId: string): Promise<{
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  resultId?: number;
  error?: string;
  requestedCount?: number;
  generatedCount?: number;
  shortfall?: boolean;
  shortfallReason?: string;
}> {
  const { data } = await api.get(`/jobs/${jobId}`);
  return data;
}

// Chat API methods
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function sendChatMessage(params: {
  message: string;
  conversationHistory: ChatMessage[];
  apiKey: string;
  files?: File[];
}): Promise<{ response: string }> {
  // If files are attached, use the file-aware endpoint
  if (params.files && params.files.length > 0) {
    const formData = new FormData();
    formData.append("message", params.message);
    formData.append(
      "conversation_history",
      JSON.stringify(
        params.conversationHistory.filter((m) => m.role !== "system")
      )
    );
    params.files.forEach((file) => formData.append("files", file));

    const { data } = await api.post("/ai/chat-with-files", formData, {
      headers: {
        "X-Gemini-API-Key": params.apiKey,
        // Don't set Content-Type - let axios set it with boundary
      },
      timeout: 120000, // 2 minute timeout for file processing + AI response
    });
    return data;
  }

  // Otherwise use regular chat endpoint
  const { data } = await api.post(
    "/ai/chat",
    {
      message: params.message,
      conversation_history: params.conversationHistory.filter(
        (m) => m.role !== "system"
      ), // Filter out system messages, send only user/assistant
    },
    {
      headers: {
        "X-Gemini-API-Key": params.apiKey,
      },
    }
  );
  return data;
}

// Analytics endpoints
export async function fetchDetailedAnalytics(): Promise<DetailedAnalytics> {
  const { data } = await api.get<DetailedAnalytics>("/analytics/detailed");
  return data;
}

export async function generatePerformanceInsights(
  analyticsData: DetailedAnalytics,
  apiKey: string
): Promise<{ insights: string }> {
  const { data } = await api.post<{ insights: string }>(
    "/analytics/generate-insights",
    analyticsData,
    {
      headers: {
        "X-Gemini-API-Key": apiKey,
      },
    }
  );
  return data;
}

// Question Management Endpoints
export async function fetchUploadQuestions(
  uploadId: number
): Promise<import("../types").QuestionDTO[]> {
  const { data } = await api.get(`/uploads/${uploadId}/questions`);
  return data;
}

export async function fetchQuestionsForEditor(
  uploadId: number
): Promise<any[]> {
  const { data } = await api.get(`/questions-sets/${uploadId}/editor-data`);
  return data;
}

export async function updateQuestion(
  questionId: number,
  updates: {
    stem?: string;
    options?: any;
    correct_answer?: any;
    explanation?: string;
  }
): Promise<{ id: number; success: boolean }> {
  const { data } = await api.put(`/questions/${questionId}`, updates);
  return data;
}

export async function deleteQuestion(
  questionId: number
): Promise<{ success: boolean; id: number }> {
  const { data } = await api.delete(`/questions/${questionId}`);
  return data;
}
