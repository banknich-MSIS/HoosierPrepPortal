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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;
      
      // Only show scrollbar if content actually overflows max height
      textarea.style.overflowY = textarea.scrollHeight > 120 ? "auto" : "hidden";
    }
  }, [input]);

  // Restore textarea height when popup reopens with existing content
  useEffect(() => {
    if (isOpen && textareaRef.current && input) {
      // Small delay to ensure textarea is fully rendered in DOM
      setTimeout(() => {
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          textarea.style.height = "auto";
          const newHeight = Math.min(textarea.scrollHeight, 120);
          textarea.style.height = `${newHeight}px`;
          
          // Only show scrollbar if content actually overflows max height
          textarea.style.overflowY = textarea.scrollHeight > 120 ? "auto" : "hidden";
        }
      }, 0);
    }
  }, [isOpen]);

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
    
    // Light-touch spam detection (for UX, not cost - users use their own tokens)
    const words = msg.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    
    if (words.length > 15 && uniqueWords.size === 1) {
      // User sent the same word 15+ times
      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg },
        { 
          role: "assistant", 
          content: "I noticed you sent the same word many times. Could you please ask a specific question about your studies?" 
        }
      ]);
      return;
    }
    
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
    // Only close panel - preserve conversation state
    setIsOpen(false);
    // Don't clear messages or context - user can reopen and continue
  };

  const handleReset = () => {
    // Clear all chat state for fresh start
    setMessages([
      {
        role: "assistant",
        content: "Hey, I'm here to help you study! What question do you have?",
      },
    ]);
    setLoading(false);
    if (onClearContext) {
      onClearContext();
    }
    // Keep panel open after reset
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
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: darkMode
              ? `linear-gradient(135deg, ${theme.amber} 0%, ${theme.amberDark} 100%)`
              : `linear-gradient(135deg, ${theme.crimson} 0%, ${theme.crimsonDark} 100%)`,
            border: `3px solid ${
              darkMode ? theme.amberLight : theme.crimsonLight
            }`,
            color: "#fff",
            cursor: "pointer",
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: darkMode
              ? "0 8px 24px rgba(194, 155, 74, 0.4)"
              : "0 8px 24px rgba(196, 30, 58, 0.4)",
            zIndex: 9999,
            transition: "all 0.3s ease",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1) rotate(15deg)";
            e.currentTarget.style.boxShadow = darkMode
              ? "0 12px 32px rgba(194, 155, 74, 0.6)"
              : "0 12px 32px rgba(196, 30, 58, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1) rotate(0deg)";
            e.currentTarget.style.boxShadow = darkMode
              ? "0 8px 24px rgba(194, 155, 74, 0.4)"
              : "0 8px 24px rgba(196, 30, 58, 0.4)";
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Reset Button */}
              <button
                onClick={handleReset}
                title="Clear conversation"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: theme.textSecondary,
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "opacity 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
              {/* Close Button */}
              <button
                onClick={handleClose}
                title="Close chat"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: theme.textSecondary,
                  lineHeight: 1,
                  transition: "opacity 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="chat-messages-container"
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
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask a question... (Shift+Enter for new line)"
                disabled={loading}
                rows={1}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  background: darkMode ? "rgba(255,255,255,0.05)" : "#fff",
                  color: theme.text,
                  fontSize: 14,
                  outline: "none",
                  resize: "none",
                  height: "auto",
                  minHeight: 40,
                  maxHeight: 120,
                  overflowY: "hidden", // Dynamically updated by useEffect
                  fontFamily: "inherit",
                  lineHeight: 1.5,
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
                  height: 40,
                  alignSelf: "flex-end",
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
        
        /* Custom scrollbar for chat messages - transparent track */
        /* MUST be more specific than global body.dark-mode ::-webkit-scrollbar-track */
        body.dark-mode .chat-messages-container::-webkit-scrollbar,
        body.light-mode .chat-messages-container::-webkit-scrollbar,
        body .chat-messages-container::-webkit-scrollbar {
          width: 8px;
          height: 0;
        }
        
        body.dark-mode .chat-messages-container::-webkit-scrollbar-track,
        body.light-mode .chat-messages-container::-webkit-scrollbar-track,
        body .chat-messages-container::-webkit-scrollbar-track {
          background: transparent !important;  /* Invisible track shows rounded container */
          border-radius: 0 !important;
        }
        
        body.dark-mode .chat-messages-container::-webkit-scrollbar-thumb,
        body.light-mode .chat-messages-container::-webkit-scrollbar-thumb,
        body .chat-messages-container::-webkit-scrollbar-thumb {
          background: rgba(194, 155, 74, 0.5) !important;
          border-radius: 4px !important;
        }
        
        body.dark-mode .chat-messages-container::-webkit-scrollbar-thumb:hover,
        body.light-mode .chat-messages-container::-webkit-scrollbar-thumb:hover,
        body .chat-messages-container::-webkit-scrollbar-thumb:hover {
          background: rgba(194, 155, 74, 0.8) !important;
        }
        
        /* Force remove arrow buttons at top and bottom */
        body.dark-mode .chat-messages-container::-webkit-scrollbar-button:single-button,
        body.light-mode .chat-messages-container::-webkit-scrollbar-button:single-button,
        body .chat-messages-container::-webkit-scrollbar-button:single-button {
          display: none !important;
          height: 0 !important;
          width: 0 !important;
        }
        
        body.dark-mode .chat-messages-container::-webkit-scrollbar-button:start:decrement,
        body.dark-mode .chat-messages-container::-webkit-scrollbar-button:end:increment,
        body.light-mode .chat-messages-container::-webkit-scrollbar-button:start:decrement,
        body.light-mode .chat-messages-container::-webkit-scrollbar-button:end:increment,
        body .chat-messages-container::-webkit-scrollbar-button:start:decrement,
        body .chat-messages-container::-webkit-scrollbar-button:end:increment {
          display: none !important;
          height: 0 !important;
        }
        
        /* Firefox scrollbar - transparent track */
        body.dark-mode .chat-messages-container,
        body.light-mode .chat-messages-container,
        body .chat-messages-container {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(194, 155, 74, 0.5) transparent !important;
        }
        
        /* Textarea scrollbar - transparent track to show rounded container */
        /* MUST be more specific than global body.dark-mode ::-webkit-scrollbar-track */
        body.dark-mode .chat-textarea::-webkit-scrollbar,
        body.light-mode .chat-textarea::-webkit-scrollbar,
        body .chat-textarea::-webkit-scrollbar {
          width: 6px !important;
          height: 0 !important;
        }
        
        body.dark-mode .chat-textarea::-webkit-scrollbar-track,
        body.light-mode .chat-textarea::-webkit-scrollbar-track,
        body .chat-textarea::-webkit-scrollbar-track {
          background: transparent !important;
          border-radius: 0 !important;
        }
        
        body.dark-mode .chat-textarea::-webkit-scrollbar-thumb,
        body.light-mode .chat-textarea::-webkit-scrollbar-thumb,
        body .chat-textarea::-webkit-scrollbar-thumb {
          background: rgba(194, 155, 74, 0.4) !important;
          border-radius: 3px !important;
        }
        
        body.dark-mode .chat-textarea::-webkit-scrollbar-thumb:hover,
        body.light-mode .chat-textarea::-webkit-scrollbar-thumb:hover,
        body .chat-textarea::-webkit-scrollbar-thumb:hover {
          background: rgba(194, 155, 74, 0.7) !important;
        }
        
        /* Force remove arrow buttons */
        body.dark-mode .chat-textarea::-webkit-scrollbar-button:single-button,
        body.light-mode .chat-textarea::-webkit-scrollbar-button:single-button,
        body .chat-textarea::-webkit-scrollbar-button:single-button {
          display: none !important;
          height: 0 !important;
          width: 0 !important;
        }
        
        body.dark-mode .chat-textarea::-webkit-scrollbar-button:start:decrement,
        body.dark-mode .chat-textarea::-webkit-scrollbar-button:end:increment,
        body.light-mode .chat-textarea::-webkit-scrollbar-button:start:decrement,
        body.light-mode .chat-textarea::-webkit-scrollbar-button:end:increment,
        body .chat-textarea::-webkit-scrollbar-button:start:decrement,
        body .chat-textarea::-webkit-scrollbar-button:end:increment {
          display: none !important;
          height: 0 !important;
        }
        
        /* Firefox scrollbar - transparent track */
        body.dark-mode .chat-textarea,
        body.light-mode .chat-textarea,
        body .chat-textarea {
          scrollbar-width: thin !important;
          scrollbar-color: rgba(194, 155, 74, 0.4) transparent !important;
        }
      `}</style>
    </>
  );
}

