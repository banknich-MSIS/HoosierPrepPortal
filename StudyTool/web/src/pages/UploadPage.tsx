import { useState, useEffect, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  sendChatMessage,
  ChatMessage,
  startExamGenerationJob,
  fetchClasses,
} from "../api/client";
import type { ClassSummary } from "../types";

interface FileAttachment {
  file: File;
  id: string;
}

export default function UploadPage() {
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages] = useState<
    (ChatMessage & { timestamp: Date; attachments?: FileAttachment[] })[]
  >([
    {
      role: "system",
      content:
        "Talk to me about what kinds of content you want to study and upload any relevant documents. I'll help guide you toward a strong plan for your studying.",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File state
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [allUploadedFiles, setAllUploadedFiles] = useState<File[]>([]);

  // Configuration state
  const [showConfig, setShowConfig] = useState(false);
  const [questionCount, setQuestionCount] = useState(15);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium"
  );
  const [questionTypes, setQuestionTypes] = useState<string[]>([
    "mcq",
    "short",
  ]);
  const [generationMode, setGenerationMode] = useState<
    "strict" | "mixed" | "creative"
  >("strict");
  const [focusConcepts, setFocusConcepts] = useState("");
  const [examName, setExamName] = useState("");
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  // UI refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get stored API key
  const getStoredApiKey = () => {
    const encrypted = localStorage.getItem("gemini_api_key");
    return encrypted ? atob(encrypted) : null;
  };

  const hasApiKey = !!getStoredApiKey();

  // Load classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const data = await fetchClasses();
        setClasses(data);
      } catch (e) {
        console.error("Failed to load classes:", e);
      }
    };
    loadClasses();
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (
    e?: React.MouseEvent | React.KeyboardEvent
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!inputMessage.trim() && attachedFiles.length === 0) return;

    const apiKey = getStoredApiKey();
    if (!apiKey) {
      navigate("/settings");
      return;
    }

    const userMessage: ChatMessage & {
      timestamp: Date;
      attachments?: FileAttachment[];
    } = {
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    // Add files to accumulated list
    if (attachedFiles.length > 0) {
      setAllUploadedFiles([
        ...allUploadedFiles,
        ...attachedFiles.map((a) => a.file),
      ]);
    }

    // Add user message to chat
    setMessages([...messages, userMessage]);
    setInputMessage("");
    setAttachedFiles([]);
    setIsLoading(true);
    setError(null);

    try {
      // Send to chat API
      const response = await sendChatMessage({
        message: userMessage.content,
        conversationHistory: messages.filter((m) => m.role !== "system"),
        apiKey,
      });

      // Add assistant response
      const assistantMessage: ChatMessage & { timestamp: Date } = {
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Auto-expand config panel after first exchange
      if (messages.length <= 1) {
        setShowConfig(true);
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to send message. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      }));
      setAttachedFiles([...attachedFiles, ...newFiles]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(attachedFiles.filter((a) => a.id !== id));
  };

  const toggleQuestionType = (type: string) => {
    if (questionTypes.includes(type)) {
      setQuestionTypes(questionTypes.filter((t) => t !== type));
    } else {
      setQuestionTypes([...questionTypes, type]);
    }
  };

  const handleGenerate = async () => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      navigate("/settings");
      return;
    }

    if (!examName.trim()) {
      setError("Please enter an exam title");
      return;
    }

    if (allUploadedFiles.length === 0) {
      setError("Please upload at least one file during the conversation");
      return;
    }

    if (questionTypes.length === 0) {
      setError("Please select at least one question type");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      allUploadedFiles.forEach((file) => formData.append("files", file));

      // Start async background job for generation
      const job = await startExamGenerationJob({
        files: formData,
        questionCount,
        difficulty,
        questionTypes,
        focusConcepts: focusConcepts
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c.length > 0),
        examName: examName,
        examMode: "exam",
        generationMode,
        selectedClassId: selectedClassId || undefined,
        apiKey,
      });

      // Store job id so global toaster can pick it up
      localStorage.setItem("active_exam_job", job.jobId);
      window.dispatchEvent(
        new CustomEvent("exam-job-started", { detail: { jobId: job.jobId } })
      );

      // Redirect to dashboard while generation proceeds in background
      navigate("/");
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          "Failed to generate exam. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const questionTypeOptions = [
    { value: "mcq", label: "Multiple Choice" },
    { value: "short", label: "Short Answer" },
    { value: "truefalse", label: "True/False" },
    { value: "cloze", label: "Fill in the Blank" },
  ];

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div>
        <h1
          style={{
            margin: "0 0 8px 0",
            fontSize: 32,
            fontWeight: 700,
            color: theme.crimson,
            letterSpacing: "-0.8px",
          }}
        >
          Manual Creator
        </h1>
        <p
          style={{
            margin: 0,
            color: theme.text,
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          You can upload documents, paste in CSVs, or add notes here to help
          generate new items for your study library.
        </p>
      </div>

      {/* API Key Warning */}
      {!hasApiKey && (
        <div
          style={{
            padding: 20,
            background: darkMode
              ? "rgba(212, 166, 80, 0.1)"
              : "rgba(212, 166, 80, 0.15)",
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            border: `2px solid ${theme.amber}`,
            borderRadius: 12,
            boxShadow: theme.glassShadow,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: theme.amber,
              marginBottom: 8,
            }}
          >
            API Key Required
          </div>
          <p style={{ margin: "0 0 12px 0", color: theme.text }}>
            You need to set up your free Gemini API key before using the chat
            assistant.
          </p>
          <button
            onClick={() => navigate("/settings")}
            style={{
              padding: "10px 20px",
              background: theme.amber,
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(212, 166, 80, 0.3)",
            }}
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Chat Area */}
      <div
        style={{
          background: theme.cardBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          borderRadius: 12,
          border: `1px solid ${theme.glassBorder}`,
          boxShadow: theme.glassShadow,
          display: "flex",
          flexDirection: "column",
          height: "500px",
        }}
      >
        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background:
                    msg.role === "user"
                      ? theme.crimson
                      : msg.role === "assistant"
                      ? theme.cardBgSolid
                      : "rgba(212, 166, 80, 0.1)",
                  color:
                    msg.role === "user"
                      ? "white"
                      : msg.role === "system"
                      ? theme.amber
                      : theme.textSecondary,
                  border:
                    msg.role === "system"
                      ? `1px solid ${theme.amber}`
                      : msg.role === "assistant"
                      ? `1px solid ${theme.glassBorder}`
                      : "none",
                  boxShadow:
                    msg.role === "user"
                      ? "0 2px 8px rgba(196, 30, 58, 0.3)"
                      : "0 2px 8px rgba(0, 0, 0, 0.05)",
                }}
              >
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {msg.content}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        style={{
                          padding: "4px 8px",
                          background: "rgba(255, 255, 255, 0.2)",
                          borderRadius: 6,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        📎 {att.file.name}
                      </div>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    opacity: 0.7,
                  }}
                >
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: theme.cardBgSolid,
                  border: `1px solid ${theme.glassBorder}`,
                  color: theme.textSecondary,
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
                  strokeWidth="2.5"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <circle cx="12" cy="12" r="10" opacity="0.25" />
                  <path d="M12 2 A10 10 0 0 1 22 12" />
                </svg>
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          style={{
            borderTop: `1px solid ${theme.glassBorder}`,
            padding: 16,
          }}
        >
          {/* File Attachments Preview */}
          {attachedFiles.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {attachedFiles.map((att) => (
                <div
                  key={att.id}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(196, 30, 58, 0.1)",
                    border: `1px solid ${theme.crimson}`,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                  }}
                >
                  <span>📎 {att.file.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: theme.crimson,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 16,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Row */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.txt,.md,.mp4,.mov,.avi,.xlsx,.xls,.csv"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasApiKey}
              style={{
                padding: 12,
                background: theme.cardBgSolid,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 8,
                cursor: hasApiKey ? "pointer" : "not-allowed",
                color: theme.text,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                if (hasApiKey) {
                  e.currentTarget.style.background = theme.navHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.cardBgSolid;
              }}
              title="Attach files"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleSendMessage(e);
                }
              }}
              placeholder={
                hasApiKey
                  ? "Type your message... (Shift+Enter for new line)"
                  : "API key required to chat"
              }
              disabled={!hasApiKey || isLoading}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 8,
                border: `1px solid ${theme.border}`,
                background: theme.cardBgSolid,
                color: theme.text,
                fontSize: 14,
                resize: "none",
                minHeight: 48,
                maxHeight: 120,
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={(e) => handleSendMessage(e)}
              disabled={
                !hasApiKey ||
                isLoading ||
                (!inputMessage.trim() && attachedFiles.length === 0)
              }
              style={{
                padding: "12px 24px",
                background:
                  hasApiKey &&
                  !isLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                    ? theme.crimson
                    : theme.border,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor:
                  hasApiKey &&
                  !isLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                    ? "pointer"
                    : "not-allowed",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s",
                boxShadow:
                  hasApiKey &&
                  !isLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                    ? "0 2px 8px rgba(196, 30, 58, 0.25)"
                    : "none",
              }}
              onMouseEnter={(e) => {
                if (
                  hasApiKey &&
                  !isLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                ) {
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(196, 30, 58, 0.35)";
                  e.currentTarget.style.filter = "brightness(1.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (
                  hasApiKey &&
                  !isLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                ) {
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(196, 30, 58, 0.25)";
                  e.currentTarget.style.filter = "brightness(1)";
                }
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: 16,
            background: darkMode
              ? "rgba(220, 53, 69, 0.1)"
              : "rgba(220, 53, 69, 0.08)",
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 10,
            border: `1px solid ${theme.btnDanger}`,
            color: theme.btnDanger,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Configuration Panel */}
      <div
        style={{
          background: theme.cardBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          borderRadius: 12,
          border: `1px solid ${theme.glassBorder}`,
          boxShadow: theme.glassShadow,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setShowConfig(!showConfig)}
          style={{
            width: "100%",
            padding: 20,
            background: "transparent",
            border: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            color: theme.text,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: theme.crimson,
              letterSpacing: "-0.3px",
            }}
          >
            Exam Configuration
          </h2>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.crimson}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showConfig ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.3s ease",
            }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {showConfig && (
          <div
            style={{ padding: "0 20px 20px 20px", display: "grid", gap: 20 }}
          >
            {/* Question Count + Difficulty */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    color: theme.text,
                    fontWeight: 500,
                  }}
                >
                  Number of Questions
                </label>
                <input
                  type="number"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  min={5}
                  max={100}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.cardBgSolid,
                    color: theme.text,
                    fontSize: 16,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    color: theme.text,
                    fontWeight: 500,
                  }}
                >
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as "easy" | "medium" | "hard")
                  }
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.cardBgSolid,
                    color: theme.text,
                    fontSize: 16,
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            {/* Question Types */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: theme.text,
                  fontWeight: 500,
                }}
              >
                Question Types (select at least one)
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {questionTypeOptions.map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: 12,
                      background: questionTypes.includes(option.value)
                        ? "rgba(196, 30, 58, 0.1)"
                        : "transparent",
                      border: `1px solid ${theme.glassBorder}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={questionTypes.includes(option.value)}
                      onChange={() => toggleQuestionType(option.value)}
                      style={{ marginRight: 12, cursor: "pointer" }}
                    />
                    <span style={{ color: theme.text }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Generation Mode */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: theme.text,
                  fontWeight: 500,
                }}
              >
                Question Source Strategy
              </label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 8,
                    background:
                      generationMode === "strict"
                        ? "rgba(196, 30, 58, 0.06)"
                        : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="generation-mode"
                    checked={generationMode === "strict"}
                    onChange={() => setGenerationMode("strict")}
                  />
                  <span style={{ color: theme.text }}>
                    Strict (from provided content only)
                  </span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 8,
                    background:
                      generationMode === "mixed"
                        ? "rgba(196, 30, 58, 0.06)"
                        : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="generation-mode"
                    checked={generationMode === "mixed"}
                    onChange={() => setGenerationMode("mixed")}
                  />
                  <span style={{ color: theme.text }}>
                    Mixed (approx. 50/50 blend)
                  </span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 8,
                    background:
                      generationMode === "creative"
                        ? "rgba(196, 30, 58, 0.06)"
                        : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="generation-mode"
                    checked={generationMode === "creative"}
                    onChange={() => setGenerationMode("creative")}
                  />
                  <span style={{ color: theme.text }}>
                    Creative (concept-adjacent improvisation)
                  </span>
                </label>
              </div>
            </div>

            {/* Focus Concepts */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: theme.text,
                  fontWeight: 500,
                }}
              >
                Focus Concepts (optional)
              </label>
              <input
                type="text"
                value={focusConcepts}
                onChange={(e) => setFocusConcepts(e.target.value)}
                placeholder="e.g., enterprise architecture, statistics"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardBgSolid,
                  color: theme.text,
                  fontSize: 14,
                }}
              />
            </div>

            {/* Exam Title */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: theme.text,
                  fontWeight: 500,
                }}
              >
                Exam Title (required)
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g., ITS Final Study Set"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardBgSolid,
                  color: theme.text,
                  fontSize: 14,
                }}
              />
            </div>

            {/* Class Assignment */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  color: theme.text,
                  fontWeight: 500,
                }}
              >
                Assign to Class (optional)
              </label>
              <select
                value={selectedClassId || ""}
                onChange={(e) =>
                  setSelectedClassId(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardBgSolid,
                  color: theme.text,
                  fontSize: 14,
                }}
              >
                <option value="">None</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
          disabled={
            !hasApiKey ||
            !examName.trim() ||
            allUploadedFiles.length === 0 ||
            isLoading
          }
          style={{
            padding: "12px 32px",
            background:
              hasApiKey &&
              examName.trim() &&
              allUploadedFiles.length > 0 &&
              !isLoading
                ? theme.crimson
                : theme.border,
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor:
              hasApiKey &&
              examName.trim() &&
              allUploadedFiles.length > 0 &&
              !isLoading
                ? "pointer"
                : "not-allowed",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.2px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow:
              hasApiKey &&
              examName.trim() &&
              allUploadedFiles.length > 0 &&
              !isLoading
                ? "0 2px 8px rgba(196, 30, 58, 0.25)"
                : "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "0 auto",
          }}
          onMouseEnter={(e) => {
            if (
              hasApiKey &&
              examName.trim() &&
              allUploadedFiles.length > 0 &&
              !isLoading
            ) {
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(196, 30, 58, 0.35)";
              e.currentTarget.style.filter = "brightness(1.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (
              hasApiKey &&
              examName.trim() &&
              allUploadedFiles.length > 0 &&
              !isLoading
            ) {
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(196, 30, 58, 0.25)";
              e.currentTarget.style.filter = "brightness(1)";
            }
          }}
        >
          {isLoading ? (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2 A10 10 0 0 1 22 12" />
              </svg>
              Generating...
            </>
          ) : (
            "Generate Exam with AI"
          )}
        </button>
        {allUploadedFiles.length > 0 && (
          <p
            style={{
              marginTop: 12,
              color: theme.textSecondary,
              fontSize: 13,
            }}
          >
            {allUploadedFiles.length} file(s) uploaded •{" "}
            {examName.trim()
              ? "Ready to generate"
              : "Enter exam title to continue"}
          </p>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
