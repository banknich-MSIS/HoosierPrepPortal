import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { fetchQuestionsForEditor, updateQuestion, deleteQuestion, fetchUpload, updateUploadName } from "../api/client";
import { useToast } from "../contexts/ToastContext";
import { formatClozeForEditing, parseClozeFromEditing, CLOZE_REGEX } from "../utils/cloze";
import { parseSimpleMarkdown } from "../utils/markdown";

interface EditorQuestion {
  id: number;
  stem: string;
  type: string;
  options: any;
  correct_answer: any;
  explanation: string | null;
  concepts: number[];
}

export default function QuestionBaseEditorPage() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const { showToast } = useToast();

  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Edit Upload Name state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");

  // Edit state form fields
  const [editStem, setEditStem] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState<any>(null);
  const [clozeSegments, setClozeSegments] = useState<{type: 'text'|'blank', value: string}[]>([]);

  useEffect(() => {
    if (uploadId) {
      loadData(parseInt(uploadId));
    }
  }, [uploadId]);

  const loadData = async (id: number) => {
    try {
      setLoading(true);
      const [questionsData, uploadData] = await Promise.all([
        fetchQuestionsForEditor(id),
        fetchUpload(id)
      ]);
      setQuestions(questionsData);
      setUploadTitle(uploadData.filename);
      setEditedTitle(uploadData.filename);
    } catch (e: any) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!uploadId || !editedTitle.trim()) return;
    try {
      await updateUploadName(parseInt(uploadId), editedTitle.trim());
      setUploadTitle(editedTitle.trim());
      setIsEditingTitle(false);
      showToast("Test name updated", "success");
    } catch (e: any) {
      showToast("Failed to update test name", "error");
    }
  };

  const startEditing = (q: EditorQuestion) => {
    setEditingId(q.id);
    setEditExplanation(q.explanation || "");
    setEditOptions(Array.isArray(q.options) ? [...q.options] : []);
    setEditCorrectAnswer(q.correct_answer);

    if (q.type === "cloze") {
      // Format cloze for editing: insert answers into blanks
      const fullText = formatClozeForEditing(q.stem, q.correct_answer);
      setEditStem(fullText);
      
      // Parse into segments for visual editor
      // Split by [answer] blocks
      // Regex matches [anything]
      const parts = fullText.split(/(\[[^\]]*\])/g);
      const segments = parts.map(part => {
        if (part.startsWith('[') && part.endsWith(']')) {
          return { type: 'blank' as const, value: part.slice(1, -1) };
        }
        return { type: 'text' as const, value: part };
      }).filter(p => p.value !== ""); // Keep it cleaner
      setClozeSegments(segments);
    } else {
      setEditStem(q.stem);
    }
  };

  const updateClozeSegment = (index: number, newValue: string) => {
    const newSegments = [...clozeSegments];
    newSegments[index].value = newValue;
    setClozeSegments(newSegments);
    
    // Reconstruct editStem
    const newStem = newSegments.map(s => s.type === 'blank' ? `[${s.value}]` : s.value).join("");
    setEditStem(newStem);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditStem("");
    setEditExplanation("");
    setEditOptions([]);
    setEditCorrectAnswer(null);
  };

  const saveQuestion = async () => {
    if (editingId === null) return;

    try {
      // Construct options object (assuming standard "list" format for now)
      const optionsPayload = editOptions.length > 0 ? { list: editOptions } : null;
      
      let finalStem = editStem;
      let finalCorrectAnswer = editCorrectAnswer;

      // Handle cloze parsing
      const currentQ = questions.find(q => q.id === editingId);
      if (currentQ?.type === "cloze") {
        const parsed = parseClozeFromEditing(editStem);
        finalStem = parsed.stem;
        finalCorrectAnswer = parsed.answers;
      }

      await updateQuestion(editingId, {
        stem: finalStem,
        options: optionsPayload,
        correct_answer: finalCorrectAnswer,
        explanation: editExplanation
      });

      showToast("Question updated successfully", "success");
      
      // Update local state
      setQuestions(prev => prev.map(q => {
        if (q.id === editingId) {
          return {
            ...q,
            stem: finalStem,
            options: editOptions,
            correct_answer: finalCorrectAnswer,
            explanation: editExplanation
          };
        }
        return q;
      }));
      
      cancelEditing();
    } catch (e: any) {
      showToast("Failed to update question", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this question from the set? This is a permanent decision and it will no longer appear in future exams.")) {
      return;
    }

    try {
      await deleteQuestion(id);
      showToast("Question deleted", "success");
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch (e: any) {
      showToast("Failed to delete question", "error");
    }
  };

  const updateOptionText = (index: number, value: string) => {
    const newOptions = [...editOptions];
    newOptions[index] = value;
    setEditOptions(newOptions);
  };

  if (loading) {
    return <div style={{ padding: 24, color: theme.text }}>Loading questions...</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        marginBottom: 24 
      }}>
        <button 
          onClick={() => navigate("/")}
          style={{
            background: "transparent",
            border: `1px solid ${theme.glassBorder}`,
            color: theme.text,
            padding: "8px 16px",
            borderRadius: 6,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Library
        </button>
        
        {/* Editable Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isEditingTitle ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                style={{
                  fontSize: 24,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: `1px solid ${theme.border}`,
                  background: theme.cardBgSolid,
                  color: theme.text,
                  fontWeight: "bold"
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setIsEditingTitle(false);
                    setEditedTitle(uploadTitle);
                  }
                }}
              />
              <button
                onClick={handleSaveTitle}
                style={{
                  background: theme.crimson,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingTitle(false);
                  setEditedTitle(uploadTitle);
                }}
                style={{
                  background: "transparent",
                  color: theme.textSecondary,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  padding: "6px 12px",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, color: theme.text, fontSize: 24 }}>{uploadTitle || "Question Base Editor"}</h2>
              <button
                onClick={() => setIsEditingTitle(true)}
                title="Edit Name"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: theme.textSecondary,
                  padding: 4,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {questions.map((q, index) => (
          <div 
            key={q.id}
            style={{
              background: theme.cardBg,
              borderRadius: 12,
              border: `1px solid ${theme.glassBorder}`,
              padding: 20,
              position: "relative"
            }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              marginBottom: 12,
              borderBottom: `1px solid ${theme.border}`,
              paddingBottom: 12
            }}>
              <span style={{ fontWeight: "bold", color: theme.textSecondary }}>Question {index + 1} ({q.type})</span>
              <div style={{ display: "flex", gap: 8 }}>
                {editingId !== q.id && (
                  <>
                    <button
                      onClick={() => startEditing(q)}
                      title="Edit"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: theme.text,
                        padding: 4
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      title="Delete"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: theme.btnDanger,
                        padding: 4
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === q.id ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ display: "block", color: theme.text, marginBottom: 4, fontSize: 12 }}>Stem</label>
                  {q.type === "cloze" ? (
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 6 }}>
                            Edit text and answers below. Answers are in the input boxes.
                        </div>
                        
                        {/* Visual Editor Container */}
                        <div 
                          style={{ 
                            display: "flex", 
                            flexWrap: "wrap", 
                            alignItems: "baseline",
                            gap: 4,
                            padding: 12,
                            border: `1px solid ${theme.border}`,
                            borderRadius: 6,
                            background: theme.cardBgSolid,
                            minHeight: 80
                          }}
                        >
                          {clozeSegments.map((segment, idx) => (
                            <React.Fragment key={idx}>
                              {segment.type === 'text' ? (
                                <span
                                  contentEditable
                                  suppressContentEditableWarning
                                  onBlur={(e) => updateClozeSegment(idx, e.currentTarget.textContent || "")}
                                  style={{ 
                                    color: theme.text, 
                                    minWidth: 10, 
                                    display: "inline-block",
                                    whiteSpace: "pre-wrap",
                                    outline: "none",
                                    borderBottom: "1px dashed transparent",
                                  }}
                                  onFocus={(e) => e.currentTarget.style.borderBottom = `1px dashed ${theme.border}`}
                                  // onBlur style reset handled by CSS or implicit
                                >
                                  {segment.value}
                                </span>
                              ) : (
                                <input
                                  type="text"
                                  value={segment.value}
                                  onChange={(e) => updateClozeSegment(idx, e.target.value)}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: `1px solid ${theme.crimson}`,
                                    background: darkMode ? "rgba(196, 30, 58, 0.1)" : "#fff5f5",
                                    color: theme.text,
                                    width: Math.max(60, segment.value.length * 8 + 20) + "px",
                                    textAlign: "center",
                                    fontWeight: "bold"
                                  }}
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
                          * Tip: You can edit the surrounding text by clicking on it.
                        </div>
                    </div>
                  ) : (
                    <textarea
                        value={editStem}
                        onChange={(e) => setEditStem(e.target.value)}
                        style={{
                        width: "100%",
                        minHeight: 80,
                        padding: 8,
                        borderRadius: 6,
                        border: `1px solid ${theme.border}`,
                        background: theme.cardBgSolid,
                        color: theme.text,
                        fontFamily: "inherit"
                        }}
                    />
                  )}
                </div>

                {(q.type === "mcq" || q.type === "multi") && (
                  <div>
                    <label style={{ display: "block", color: theme.text, marginBottom: 4, fontSize: 12 }}>Options</label>
                    <div style={{ display: "grid", gap: 8 }}>
                      {editOptions.map((opt, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type={q.type === "mcq" ? "radio" : "checkbox"}
                            name={`correct-${q.id}`}
                            checked={q.type === "mcq" ? editCorrectAnswer === opt : (Array.isArray(editCorrectAnswer) && editCorrectAnswer.includes(opt))}
                            onChange={() => {
                              if (q.type === "mcq") {
                                setEditCorrectAnswer(opt);
                              } else {
                                // Multi logic simplified for now - usually just toggle
                                const current = Array.isArray(editCorrectAnswer) ? editCorrectAnswer : [];
                                if (current.includes(opt)) {
                                  setEditCorrectAnswer(current.filter((x: any) => x !== opt));
                                } else {
                                  setEditCorrectAnswer([...current, opt]);
                                }
                              }
                            }}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOptionText(i, e.target.value)}
                            style={{
                              flex: 1,
                              padding: 8,
                              borderRadius: 6,
                              border: `1px solid ${theme.border}`,
                              background: theme.cardBgSolid,
                              color: theme.text
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {q.type === "truefalse" && (
                  <div>
                    <label style={{ display: "block", color: theme.text, marginBottom: 4, fontSize: 12 }}>Correct Answer</label>
                    <div style={{ display: "flex", gap: 16 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: theme.text }}>
                        <input
                          type="radio"
                          name={`tf-${q.id}`}
                          checked={String(editCorrectAnswer).toLowerCase() === "true"}
                          onChange={() => setEditCorrectAnswer("True")}
                        />
                        True
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: theme.text }}>
                        <input
                          type="radio"
                          name={`tf-${q.id}`}
                          checked={String(editCorrectAnswer).toLowerCase() === "false"}
                          onChange={() => setEditCorrectAnswer("False")}
                        />
                        False
                      </label>
                    </div>
                  </div>
                )}

                {(q.type === "short") && (
                  <div>
                    <label style={{ display: "block", color: theme.text, marginBottom: 4, fontSize: 12 }}>Correct Answer (Exact Match)</label>
                    <input
                      type="text"
                      value={editCorrectAnswer || ""}
                      onChange={(e) => setEditCorrectAnswer(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 6,
                        border: `1px solid ${theme.border}`,
                        background: theme.cardBgSolid,
                        color: theme.text
                      }}
                      placeholder="Enter the correct answer text..."
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: "block", color: theme.text, marginBottom: 4, fontSize: 12 }}>Explanation</label>
                  <textarea
                    value={editExplanation}
                    onChange={(e) => setEditExplanation(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: 60,
                      padding: 8,
                      borderRadius: 6,
                      border: `1px solid ${theme.border}`,
                      background: theme.cardBgSolid,
                      color: theme.text,
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={cancelEditing}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: `1px solid ${theme.border}`,
                      background: "transparent",
                      color: theme.text,
                      cursor: "pointer"
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveQuestion}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: theme.crimson,
                      color: "white",
                      cursor: "pointer"
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: theme.text, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                  {q.type === "cloze" ? (
                    // Render cloze preview with inputs
                    (() => {
                      const parts = q.stem.split(CLOZE_REGEX);
                      const answers = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
                      return (
                        <div style={{ lineHeight: "2.5" }}>
                          {parts.map((part, i) => (
                            <React.Fragment key={i}>
                              <span dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(part) }} />
                              {i < parts.length - 1 && (
                                <input
                                  readOnly
                                  value={answers[i] || ""}
                                  style={{
                                    margin: "0 8px",
                                    padding: "4px 8px",
                                    border: `1px solid ${theme.border}`,
                                    borderRadius: "4px",
                                    background: theme.bg,
                                    color: theme.text,
                                    maxWidth: "150px"
                                  }}
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    q.stem
                  )}
                </div>
                
                {(q.type === "mcq" || q.type === "multi") && q.options && Array.isArray(q.options) && (
                  <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
                    {q.options.map((opt: string, i: number) => {
                      const isCorrect = q.type === "mcq" ? q.correct_answer === opt : (Array.isArray(q.correct_answer) && q.correct_answer.includes(opt));
                      return (
                        <div 
                          key={i}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: `1px solid ${isCorrect ? "#28a745" : theme.border}`,
                            background: isCorrect ? (darkMode ? "rgba(40, 167, 69, 0.2)" : "rgba(40, 167, 69, 0.1)") : "transparent",
                            color: theme.text,
                            fontSize: 14
                          }}
                        >
                          {opt} {isCorrect && "✓"}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === "truefalse" && (
                   <div style={{ marginBottom: 12, color: theme.text, fontWeight: "bold" }}>
                      Correct Answer: {String(q.correct_answer)}
                   </div>
                )}

                {q.type === "short" && (
                   <div style={{ marginBottom: 12, color: theme.text, fontWeight: "bold" }}>
                      Correct Answer: {String(q.correct_answer)}
                   </div>
                )}

                {q.explanation && (
                  <div style={{ 
                    fontSize: 13, 
                    color: theme.textSecondary,
                    padding: 8,
                    background: darkMode ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
                    borderRadius: 6
                  }}>
                    <strong>Explanation:</strong> {q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {questions.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: theme.textSecondary, padding: 40 }}>
            No questions found in this set.
          </div>
        )}
      </div>
    </div>
  );
}
