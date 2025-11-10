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
        "Hey! 👋 I'm here to help you create a practice exam.\n\nUpload your study materials (notes, PDFs, slides), and let me know:\n• How many questions? (1-100)\n• Difficulty level? (Easy/Medium/Hard)\n• Question types? (Multiple Choice, True/False, Short Answer, Fill-in-the-Blank)\n\nOr just upload your files and I'll guide you through it!",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File state
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);
  const [allUploadedFiles, setAllUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Configuration state
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
  const [examName, setExamName] = useState("");
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  // UI refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll chat container only when new messages are added (not on initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // Skip scroll on initial mount
    }
    // Scroll the messages container, not the whole page
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
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

    // Quick health check
    try {
      const healthCheck = await fetch("http://127.0.0.1:8000/api/health", {
        signal: AbortSignal.timeout(3000),
      });
      if (!healthCheck.ok) {
        setError("Backend server is not responding. Please ensure it's running.");
        return;
      }
    } catch {
      setError("Cannot connect to backend. Please ensure the server is running (run start.ps1).");
      return;
    }

    // Basic input validation for obviously off-topic queries
    const lowerMessage = inputMessage.toLowerCase();
    const offTopicKeywords = [
      "database", "sql", "code", "programming", "hack", "password",
      "server", "api", "inject", "script", "vulnerability"
    ];
    const hasOffTopicKeyword = offTopicKeywords.some(keyword => 
      lowerMessage.includes(keyword) && !lowerMessage.includes("study") && !lowerMessage.includes("exam")
    );
    
    if (hasOffTopicKeyword) {
      setError("Please keep conversations focused on creating practice exams and study materials.");
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
    setIsChatLoading(true);
    setError(null);

    try {
      // Send to chat API (no timeout - let Gemini take as long as needed)
      const filesToSend =
        attachedFiles.length > 0 ? attachedFiles.map((a) => a.file) : undefined;
      
      const response = await sendChatMessage({
        message: userMessage.content,
        conversationHistory: messages.filter((m) => m.role !== "system"),
        apiKey,
        files: filesToSend,
      });

      // Add assistant response
      const assistantMessage: ChatMessage & { timestamp: Date } = {
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Extract parameters from AI response
      extractParameters(response.response);
    } catch (e: any) {
      console.error("Chat error:", e);
      console.error("Error response:", e?.response);
      console.error("Error config:", e?.config);
      
      let errorMsg = "Failed to send message. Please try again.";
      
      if (e?.code === "ECONNABORTED" || e?.message?.includes("timeout")) {
        errorMsg = "Request timed out. File processing may take up to 2 minutes. Please try again.";
      } else if (e?.code === "ERR_NETWORK" || e?.message?.includes("Network Error")) {
        errorMsg = "Network Error. Please check that the backend server is running (start.ps1).";
      } else if (e?.response?.status === 413) {
        errorMsg = "File is too large. Please try a smaller file or fewer files.";
      } else if (e?.response?.status === 422) {
        errorMsg = "Invalid request format. Please try again.";
      } else if (e?.response?.data?.detail) {
        errorMsg = e.response.data.detail;
      } else if (e?.message) {
        errorMsg = e.message;
      }
      
      setError(errorMsg);
      
      // Add a retry-friendly error message to chat
      const errorMessage: ChatMessage & { timestamp: Date } = {
        role: "assistant",
        content: `⚠️ Error: ${errorMsg}\n\nYou can try sending your message again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles: FileAttachment[] = [];
      const invalidFiles: string[] = [];
      
      Array.from(e.target.files).forEach((file) => {
        if (file.size > MAX_FILE_SIZE) {
          invalidFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        } else {
          validFiles.push({
            file,
            id: `${file.name}-${Date.now()}-${Math.random()}`,
          });
        }
      });
      
      if (invalidFiles.length > 0) {
        setError(`Files too large (max 10MB): ${invalidFiles.join(", ")}`);
      }
      
      if (validFiles.length > 0) {
        setAttachedFiles([...attachedFiles, ...validFiles]);
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(attachedFiles.filter((a) => a.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles: FileAttachment[] = [];
      const invalidFiles: string[] = [];
      
      Array.from(e.dataTransfer.files).forEach((file) => {
        if (file.size > MAX_FILE_SIZE) {
          invalidFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        } else {
          validFiles.push({
            file,
            id: `${file.name}-${Date.now()}-${Math.random()}`,
          });
        }
      });
      
      if (invalidFiles.length > 0) {
        setError(`Files too large (max 10MB): ${invalidFiles.join(", ")}`);
      }
      
      if (validFiles.length > 0) {
        setAttachedFiles([...attachedFiles, ...validFiles]);
      }
    }
  };

  const toggleQuestionType = (type: string) => {
    if (questionTypes.includes(type)) {
      setQuestionTypes(questionTypes.filter((t) => t !== type));
    } else {
      setQuestionTypes([...questionTypes, type]);
    }
  };

  // Extract parameters from AI response text and auto-generate title
  const extractParameters = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Extract question count - match various patterns
    const countPatterns = [
      /(\d+)\s*questions?/i,           // "25 questions", "30 question"
      /(?:want|need|give me|make)\s+(\d+)/i,  // "I want 25", "give me 30"
      /(?:about|around|roughly)\s+(\d+)/i,    // "about 25", "around 30"
      /(\d+)(?:\s+would be|'s good)/i,        // "25 would be good", "30's good"
    ];
    
    for (const pattern of countPatterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1]);
        if (count >= 1 && count <= 100) {
          setQuestionCount(count);
          break;
        }
      }
    }
    
    // Extract difficulty
    if (lowerText.includes("easy")) {
      setDifficulty("easy");
    } else if (lowerText.includes("hard") || lowerText.includes("difficult")) {
      setDifficulty("hard");
    } else if (lowerText.includes("medium")) {
      setDifficulty("medium");
    }
    
    // Extract question types
    const types: string[] = [];
    if (lowerText.includes("multiple choice") || lowerText.includes("mcq")) {
      types.push("mcq");
    }
    if (lowerText.includes("short answer")) {
      types.push("short");
    }
    if (lowerText.includes("true/false") || lowerText.includes("true or false")) {
      types.push("truefalse");
    }
    if (lowerText.includes("fill in the blank") || lowerText.includes("fill-in") || lowerText.includes("cloze")) {
      types.push("cloze");
    }
    if (types.length > 0) {
      setQuestionTypes(types);
    }
    
    // Extract generation mode
    if (lowerText.includes("strict")) {
      setGenerationMode("strict");
    } else if (lowerText.includes("creative")) {
      setGenerationMode("creative");
    } else if (lowerText.includes("mixed")) {
      setGenerationMode("mixed");
    }
    
    // Auto-generate exam title based on subject/topic mentioned
    // Look for common patterns like "studying [subject]", "[subject] exam", etc.
    const subjectMatch = text.match(/(?:studying|study|exam for|test on|quiz on|practice)\s+(?:for\s+)?([A-Za-z0-9\s]{3,30})(?:\.|,|!|\?|$)/i);
    if (subjectMatch && subjectMatch[1] && !examName.trim()) {
      const subject = subjectMatch[1].trim();
      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setExamName(`${subject} - ${timestamp}`);
    }
  };

  const handleGenerate = async () => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      navigate("/settings");
      return;
    }

    if (questionTypes.length === 0) {
      setError("The AI needs to determine question types from your conversation. Please chat about what you want to study.");
      return;
    }
    
    // Auto-generate title if not set
    if (!examName.trim()) {
      const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setExamName(`AI Generated Exam - ${timestamp}`);
    }

    if (allUploadedFiles.length === 0) {
      setError("Please upload at least one file during the conversation");
      return;
    }

    // Ensure user has engaged with chat (more than just system message)
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) {
      setError(
        "Please chat with the AI assistant about your study goals before generating"
      );
      return;
    }

    setIsGenerating(true);
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
        focusConcepts: [], // AI Assistant determines focus through conversation
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
      setIsGenerating(false);
    }
  };

  const questionTypeOptions = [
    { value: "mcq", label: "Multiple Choice" },
    { value: "short", label: "Short Answer" },
    { value: "truefalse", label: "True/False" },
    { value: "cloze", label: "Fill in the Blank" },
  ];

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "0 16px" }}>
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
          AI Assistant
        </h1>
        <p
          style={{
            margin: "0 0 12px 0",
            color: theme.textSecondary,
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Talk to me about what kinds of content you want to study and upload any relevant documents. I'll help guide you toward a strong plan for your studying.
        </p>
        <p
          style={{
            margin: 0,
            color: theme.text,
            fontSize: 14,
            lineHeight: 1.5,
            padding: "12px 16px",
            background: darkMode
              ? "rgba(196, 30, 58, 0.08)"
              : "rgba(196, 30, 58, 0.05)",
            borderLeft: `3px solid ${theme.crimson}`,
            borderRadius: 4,
          }}
        >
          <strong>How it works:</strong> Upload documents, chat about your study goals, configure exam settings on the left, then generate. Your exam will appear in the Dashboard Library.
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

      {/* Chat Area - Full Width */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
            background: theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 12,
            border: isDragging
              ? `3px dashed ${theme.crimson}`
              : `1px solid ${theme.glassBorder}`,
            boxShadow: isDragging ? theme.glassShadowHover : theme.glassShadow,
            display: "flex",
            flexDirection: "column",
            height: "650px",
            position: "relative",
            transition: "all 0.2s ease",
          }}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: darkMode
                  ? "rgba(196, 30, 58, 0.1)"
                  : "rgba(196, 30, 58, 0.05)",
                backdropFilter: "blur(2px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                borderRadius: 12,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  padding: "24px 32px",
                  background: theme.crimson,
                  color: "white",
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(196, 30, 58, 0.4)",
                }}
              >
                Drop files here to attach
              </div>
            </div>
          )}
        
        {/* Messages */}
        <div
          ref={messagesContainerRef}
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
                        }}
                      >
                        {att.file.name}
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
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
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
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      animation: "bounce 1.4s ease-in-out infinite",
                    }}
                  >
                    .
                  </span>
                  <span
                    style={{
                      animation: "bounce 1.4s ease-in-out 0.2s infinite",
                    }}
                  >
                    .
                  </span>
                  <span
                    style={{
                      animation: "bounce 1.4s ease-in-out 0.4s infinite",
                    }}
                  >
                    .
                  </span>
                </div>
                {messages[messages.length - 1]?.attachments && (
                  <div
                    style={{
                      fontSize: 11,
                      fontStyle: "italic",
                      opacity: 0.8,
                    }}
                  >
                    Processing uploaded files... This may take up to 2 minutes.
                  </div>
                )}
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
                  <span style={{ color: theme.text }}>{att.file.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: theme.crimson,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 18,
                      fontWeight: "bold",
                      lineHeight: 1,
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
              disabled={!hasApiKey || isChatLoading}
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
                isChatLoading ||
                (!inputMessage.trim() && attachedFiles.length === 0)
              }
              style={{
                padding: "12px 24px",
                background:
                  hasApiKey &&
                  !isChatLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                    ? theme.crimson
                    : theme.border,
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor:
                  hasApiKey &&
                  !isChatLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                    ? "pointer"
                    : "not-allowed",
                fontSize: 14,
                fontWeight: 600,
                transition: "all 0.2s",
                boxShadow:
                  hasApiKey &&
                  !isChatLoading &&
                  (inputMessage.trim() || attachedFiles.length > 0)
                    ? "0 2px 8px rgba(196, 30, 58, 0.25)"
                    : "none",
              }}
              onMouseEnter={(e) => {
                if (
                  hasApiKey &&
                  !isChatLoading &&
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
                  !isChatLoading &&
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
            questionTypes.length === 0 ||
            allUploadedFiles.length === 0 ||
            messages.filter((m) => m.role === "user").length === 0 ||
            isGenerating
          }
          style={{
            padding: "12px 32px",
            background:
              hasApiKey &&
              questionTypes.length > 0 &&
              allUploadedFiles.length > 0 &&
              messages.filter((m) => m.role === "user").length > 0 &&
              !isGenerating
                ? theme.crimson
                : theme.border,
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor:
              hasApiKey &&
              questionTypes.length > 0 &&
              allUploadedFiles.length > 0 &&
              messages.filter((m) => m.role === "user").length > 0 &&
              !isGenerating
                ? "pointer"
                : "not-allowed",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.2px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow:
              hasApiKey &&
              questionTypes.length > 0 &&
              allUploadedFiles.length > 0 &&
              messages.filter((m) => m.role === "user").length > 0 &&
              !isGenerating
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
              questionTypes.length > 0 &&
              allUploadedFiles.length > 0 &&
              messages.filter((m) => m.role === "user").length > 0 &&
              !isGenerating
            ) {
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(196, 30, 58, 0.35)";
              e.currentTarget.style.filter = "brightness(1.1)";
            }
          }}
          onMouseLeave={(e) => {
            if (
              hasApiKey &&
              questionTypes.length > 0 &&
              allUploadedFiles.length > 0 &&
              messages.filter((m) => m.role === "user").length > 0 &&
              !isGenerating
            ) {
              e.currentTarget.style.boxShadow =
                "0 2px 8px rgba(196, 30, 58, 0.25)";
              e.currentTarget.style.filter = "brightness(1)";
            }
          }}
        >
          {isGenerating ? (
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
        <p
          style={{
            marginTop: 12,
            textAlign: "center",
            color: theme.textSecondary,
            fontSize: 13,
          }}
        >
          {allUploadedFiles.length > 0
            ? `${allUploadedFiles.length} file(s) uploaded`
            : "No files uploaded yet"}
          {" • "}
          {messages.filter((m) => m.role === "user").length > 0
            ? "Chat started"
            : "Start chatting"}
          {" • "}
          {questionTypes.length > 0 && allUploadedFiles.length > 0 && messages.filter((m) => m.role === "user").length > 0
            ? "Ready to generate"
            : "Chat with AI to configure"}
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-8px);
          }
        }
        
      `}</style>
    </div>
  );
}
