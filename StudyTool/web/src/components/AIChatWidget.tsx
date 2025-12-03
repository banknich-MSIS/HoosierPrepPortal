import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

interface QuestionContext {
  questionId: number;
  stem: string;
  correctAnswer: any;
  userAnswer: any;
  explanation?: string;
}

interface AIChatWidgetProps {
  darkMode: boolean;
  theme: any;
  questionContext?: QuestionContext | null;
  onClearContext?: () => void;
}

export default function AIChatWidget({
  darkMode,
  theme,
  questionContext,
  onClearContext,
}: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-open and populate when question context is provided
  useEffect(() => {
    if (questionContext) {
      setIsOpen(true);
      // Format context as user message (bold labels, newlines)
      const userContextMsg = `I'm reviewing this question and need clarification:

**Question:** ${questionContext.stem}

**Correct Answer:** ${questionContext.correctAnswer}

**My Answer:** ${questionContext.userAnswer}${
        questionContext.explanation
          ? `

**Explanation:** ${questionContext.explanation}`
          : ""
      }`;

      const aiResponse =
        "What further questions do you have about this?";

      setMessages([
        { role: "user", content: userContextMsg },
        { role: "assistant", content: aiResponse },
      ]);
    }
  }, [questionContext]);

  // Reset messages when opening without context
  useEffect(() => {
    if (isOpen && !questionContext && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hey, I'm here to help you study! What question do you have?",
        },
      ]);
    }
  }, [isOpen, questionContext]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) {
      alert("Please add your Gemini API key in Settings");
      return;
    }

    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      // Add system context for general chat (not question-specific)
      let messageToSend = msg;
      if (!questionContext) {
        const systemContext = `You are the AI Study Assistant for Hoosier Prep Portal, a study tool application.

YOUR ROLE:
- Answer questions about study material and concepts
- Explain how to use tool features and navigate the application
- Help students understand difficult topics

IMPORTANT RULES:
- Do NOT offer to generate exams or upload files in this chat
- If asked about creating exams, say: "To generate exams, navigate to the 'Exam Generator' page in the top menu, upload your study materials, and configure your preferences there."
- If asked about uploading files, direct them to the Exam Generator page
- Focus on educational explanations and tool navigation help
- Keep responses concise and helpful (2-4 sentences maximum)

AVAILABLE TOOL FEATURES:
- Exam Generator: Upload documents and AI generates custom exams
- Dashboard: View exam history and performance analytics  
- Practice Mode: Take exams with immediate feedback after each question
- Archive: Manage and organize saved exams and materials

Student Question: ${msg}`;
        messageToSend = systemContext;
      }

      const res = await axios.post(
        "http://localhost:8000/api/ai/chat",
        {
          message: messageToSend,
          conversation_history: questionContext ? messages : [],
        },
        {
          headers: {
            "X-Gemini-API-Key": atob(apiKey),
          },
        }
      );

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.data.response },
      ]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setMessages([]);
    if (onClearContext) {
      onClearContext();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: theme.crimson,
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            zIndex: 1000,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: 24,
            width: 400,
            height: 500,
            background: theme.cardBgSolid,
            border: `1px solid ${theme.glassBorder}`,
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            animation: "slideIn 0.3s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 16,
              borderBottom: `1px solid ${theme.glassBorder}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: darkMode
                ? "rgba(212, 166, 80, 0.1)"
                : "rgba(196, 30, 58, 0.05)",
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: theme.text }}>
              AI Study Assistant
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
                color: theme.textSecondary,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((msg, idx) => {
              // Parse markdown-style bold (**text**)
              const renderContent = (text: string) => {
                const parts = text.split(/(\*\*.*?\*\*)/g);
                return parts.map((part, i) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={i}>
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return part;
                });
              };

              return (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background:
                      msg.role === "user"
                        ? darkMode
                          ? "rgba(212, 166, 80, 0.15)"
                          : "rgba(196, 30, 58, 0.08)"
                        : darkMode
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.03)",
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: theme.text,
                    whiteSpace: "pre-line",
                  }}
                >
                  {renderContent(msg.content)}
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 12,
                  alignSelf: "flex-start",
                }}
              >
                <div className="typing-dot" style={{ animationDelay: "0s" }} />
                <div className="typing-dot" style={{ animationDelay: "0.2s" }} />
                <div className="typing-dot" style={{ animationDelay: "0.4s" }} />
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: 16,
              borderTop: `1px solid ${theme.glassBorder}`,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask a question..."
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  background: darkMode ? "rgba(255,255,255,0.05)" : "#fff",
                  color: theme.text,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  padding: "10px 16px",
                  background:
                    input.trim() && !loading ? theme.crimson : theme.textSecondary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  opacity: input.trim() && !loading ? 1 : 0.5,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes typingDot {
          0%, 60%, 100% { 
            opacity: 0.3; 
            transform: translateY(0); 
          }
          30% { 
            opacity: 1; 
            transform: translateY(-6px); 
          }
        }
        
        .typing-dot {
          width: 8px;
          height: 8px;
          background: ${theme.textSecondary};
          border-radius: 50%;
          animation: typingDot 1.4s infinite;
        }
      `}</style>
    </>
  );
}

