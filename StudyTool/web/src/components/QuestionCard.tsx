import React, { useMemo } from "react";
import type { QuestionDTO, QuestionType } from "../types";
import { useExamStore } from "../store/examStore";
import { parseSimpleMarkdown } from "../utils/markdown";
import { CLOZE_REGEX } from "../utils/cloze";
import { shuffleWithSeed } from "../utils/shuffle";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  multi: "Multiple Select",
  short: "Short Answer",
  truefalse: "True/False",
  cloze: "Fill in the Blank",
};

interface Props {
  question: QuestionDTO;
  darkMode: boolean;
  theme: any;
  disabled?: boolean;
  attemptId?: number | null;
}

export default function QuestionCard({
  question,
  darkMode,
  theme,
  disabled = false,
  attemptId,
}: Props) {
  const setAnswer = useExamStore((s) => s.setAnswer);
  const answers = useExamStore((s) => s.answers);
  const value = answers[question.id];

  // Handle both 'type' and 'qtype' fields from backend
  const questionType = question.type || (question as any).qtype || "unknown";

  const options = useMemo(() => {
    const raw = question.options ?? [];
    // Only shuffle MCQ/Multi if attemptId is present
    if (attemptId && (questionType === "mcq" || questionType === "multi")) {
      // Use a combined seed of attemptId + question.id to be unique per question but stable per attempt
      return shuffleWithSeed(raw, attemptId + question.id * 17);
    }
    return raw;
  }, [question.options, attemptId, questionType, question.id]);

  if (questionType === "cloze") {
    const parts = question.stem.split(CLOZE_REGEX);
    const userAnswers = Array.isArray(value)
      ? value
      : typeof value === "object" && value !== null
      ? Object.values(value) // fallback for legacy dict
      : value
      ? [value]
      : []; // fallback for legacy single string

    // Check if there are any blanks (parts length > 1 usually means at least one blank)
    const hasBlanks = parts.length > 1;

    return (
      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 16,
          backgroundColor: theme.cardBg,
        }}
      >
        <div
          style={{
            fontSize: "12px",
            color: theme.textSecondary,
            marginBottom: "8px",
            fontStyle: "italic",
          }}
        >
          Type: Fill in the Blank
        </div>
        <div
          style={{
            marginBottom: 12,
            fontSize: "16px",
            lineHeight: "2.5",
            color: theme.text,
          }}
        >
          {hasBlanks ? (
            parts.map((part, i) => (
              <React.Fragment key={i}>
                <span
                  dangerouslySetInnerHTML={{
                    __html: parseSimpleMarkdown(part),
                  }}
                />
                {i < parts.length - 1 && (
                  <input
                    style={{
                      minWidth: "120px",
                      maxWidth: "200px",
                      margin: "0 8px",
                      padding: "8px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: "4px",
                      fontSize: "15px",
                      backgroundColor: theme.cardBg,
                      color: theme.text,
                      opacity: disabled ? 0.6 : 1,
                      cursor: disabled ? "not-allowed" : "text",
                      borderBottom: `2px solid ${theme.crimson || "#c41e3a"}`,
                    }}
                    value={userAnswers[i] || ""}
                    onChange={(e) => {
                      const newAnswers = [...userAnswers];
                      newAnswers[i] = e.target.value;
                      setAnswer(question.id, newAnswers);
                    }}
                    disabled={disabled}
                    placeholder="Answer..."
                  />
                )}
              </React.Fragment>
            ))
          ) : (
            // Fallback for legacy/malformed cloze without tokens
            <>
              <div
                dangerouslySetInnerHTML={{
                  __html: parseSimpleMarkdown(question.stem),
                }}
              />
              <input
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "12px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "4px",
                  fontSize: "15px",
                  backgroundColor: theme.cardBg,
                  color: theme.text,
                  opacity: disabled ? 0.6 : 1,
                  cursor: disabled ? "not-allowed" : "text",
                }}
                placeholder="Type your answer"
                value={userAnswers[0] || ""}
                onChange={(e) => setAnswer(question.id, [e.target.value])}
                disabled={disabled}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: 16,
        backgroundColor: theme.cardBg,
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: theme.textSecondary,
          marginBottom: "8px",
          fontStyle: "italic",
        }}
      >
        Type:{" "}
        {QUESTION_TYPE_LABELS[questionType as QuestionType] || questionType} |
        Options: {options.length}
      </div>
      <div
        style={{
          marginBottom: 12,
          whiteSpace: "pre-wrap",
          fontSize: "16px",
          lineHeight: "1.5",
          color: theme.text,
        }}
        dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(question.stem) }}
      />
      {questionType === "mcq" && (
        <div style={{ display: "grid", gap: 8 }}>
          {options.length === 0 ? (
            <div
              style={{
                color: "#dc3545",
                fontSize: "14px",
                fontStyle: "italic",
              }}
            >
              No options available for this question
            </div>
          ) : (
            options.map((opt, idx) => (
              <label
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "4px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.6 : 1,
                  backgroundColor:
                    value === opt
                      ? darkMode
                        ? "#2a4a62"
                        : "#e3f2fd"
                      : theme.cardBg,
                }}
              >
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={value === opt}
                  onChange={() => setAnswer(question.id, opt)}
                  disabled={disabled}
                  style={{
                    transform: "scale(1.2)",
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                />
                <span
                  style={{
                    fontSize: "15px",
                    color: value === opt && darkMode ? "#90caf9" : theme.text,
                  }}
                >
                  {opt}
                </span>
              </label>
            ))
          )}
        </div>
      )}
      {questionType === "multi" && (
        <div style={{ display: "grid", gap: 8 }}>
          {options.length === 0 ? (
            <div
              style={{
                color: "#dc3545",
                fontSize: "14px",
                fontStyle: "italic",
              }}
            >
              No options available for this question
            </div>
          ) : (
            options.map((opt, idx) => {
              const selected: string[] = Array.isArray(value) ? value : [];
              const checked = selected.includes(opt);
              return (
                <label
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px",
                    border: `1px solid ${theme.border}`,
                    borderRadius: "4px",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                    backgroundColor: checked
                      ? darkMode
                        ? "#2a4a62"
                        : "#e3f2fd"
                      : theme.cardBg,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(opt);
                      else next.delete(opt);
                      setAnswer(question.id, Array.from(next));
                    }}
                    disabled={disabled}
                    style={{
                      transform: "scale(1.2)",
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "15px",
                      color: checked && darkMode ? "#90caf9" : theme.text,
                    }}
                  >
                    {opt}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
      {questionType === "short" && (
        <div>
          <input
            style={{
              width: "100%",
              padding: "12px",
              border: `1px solid ${theme.border}`,
              borderRadius: "4px",
              fontSize: "15px",
              boxSizing: "border-box",
              backgroundColor: theme.cardBg,
              color: theme.text,
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? "not-allowed" : "text",
            }}
            placeholder="Type your answer"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => setAnswer(question.id, e.target.value)}
            disabled={disabled}
          />
        </div>
      )}
      {questionType === "truefalse" && (
        <div style={{ display: "flex", gap: 12 }}>
          {["true", "false"].map((opt) => (
            <label
              key={opt}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                border: `1px solid ${theme.border}`,
                borderRadius: "4px",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                backgroundColor:
                  String(value).toLowerCase() === opt
                    ? darkMode
                      ? "#2a4a62"
                      : "#e3f2fd"
                    : theme.cardBg,
              }}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={String(value).toLowerCase() === opt}
                onChange={() => setAnswer(question.id, opt)}
                disabled={disabled}
                style={{
                  transform: "scale(1.2)",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              />
              <span
                style={{
                  textTransform: "capitalize",
                  fontSize: "15px",
                  color:
                    String(value).toLowerCase() === opt && darkMode
                      ? "#90caf9"
                      : theme.text,
                }}
              >
                {opt}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
