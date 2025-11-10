import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { UploadSummary, ClassSummary, QuestionType } from "../types";
import ClassTagSelector from "./ClassTagSelector";
import {
  fetchClasses,
  updateUploadName,
  createExam,
  createClass,
  updateClass,
  deleteClass,
} from "../api/client";

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  multi: "Multiple Select",
  short: "Short Answer",
  truefalse: "True/False",
  cloze: "Fill in the Blank",
};

// Available color options for classes
const CLASS_COLORS: { name: string; value: string }[] = [
  { name: "Blue", value: "#007bff" },
  { name: "Crimson", value: "#c41e3a" },
  { name: "Amber", value: "#d4a650" },
  { name: "Green", value: "#28a745" },
  { name: "Teal", value: "#20c997" },
  { name: "Purple", value: "#6f42c1" },
  { name: "Indigo", value: "#6610f2" },
  { name: "Orange", value: "#fd7e14" },
  { name: "Pink", value: "#e83e8c" },
  { name: "Slate", value: "#6c757d" },
  { name: "Cyan", value: "#17a2b8" },
  { name: "Brown", value: "#795548" },
];

interface CSVLibraryProps {
  uploads: UploadSummary[];
  onCreateExam: (uploadIds: number[], uploadData?: UploadSummary) => void;
  onDelete: (uploadId: number) => void;
  onDownload: (uploadId: number) => void;
  onUpdate: () => void;
  darkMode: boolean;
  theme: any;
}

export default function CSVLibrary({
  uploads,
  onCreateExam,
  onDelete,
  onDownload,
  onUpdate,
  darkMode,
  theme,
}: CSVLibraryProps) {
  const navigate = useNavigate();
  const [selectedUploads, setSelectedUploads] = useState<Set<number>>(
    new Set()
  );
  const [allClasses, setAllClasses] = useState<ClassSummary[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(
    null
  );
  const [openClassDropdown, setOpenClassDropdown] = useState<number | null>(
    null
  );
  const [editingUploadId, setEditingUploadId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassDescription, setNewClassDescription] = useState("");
  const [newClassColor, setNewClassColor] = useState("#007bff");
  const [showManageClasses, setShowManageClasses] = useState(false);
  const [manageView, setManageView] = useState<"list" | "create" | "edit">(
    "list"
  );
  const [manageEditing, setManageEditing] = useState<null | number>(null);
  const [manageName, setManageName] = useState("");
  const [manageDescription, setManageDescription] = useState("");
  const [manageColor, setManageColor] = useState("#007bff");
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalUploadIds, setModalUploadIds] = useState<number[]>([]);
  const [selectedMode, setSelectedMode] = useState<"exam" | "practice">("exam");

  // Load classes to get actual colors
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const data = await fetchClasses();
        setAllClasses(data);
      } catch (e) {
        console.error("Failed to load classes:", e);
      }
    };
    loadClasses();
  }, []);

  // Close class dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the dropdown
      if (
        openClassDropdown !== null &&
        !target.closest(`[data-dropdown="${openClassDropdown}"]`)
      ) {
        setOpenClassDropdown(null);
      }
    };

    if (openClassDropdown !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openClassDropdown]);

  // Helper function to calculate contrast text color
  const getContrastTextColor = (hexColor: string): string => {
    // Remove # if present
    const hex = hexColor.replace("#", "");

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black or white based on luminance
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
  };

  // Get class color by name
  const getClassColor = (className: string) => {
    const classData = allClasses.find((cls) => cls.name === className);
    return classData?.color || "#007bff";
  };

  const toggleSelection = (uploadId: number) => {
    const newSelection = new Set(selectedUploads);
    if (newSelection.has(uploadId)) {
      newSelection.delete(uploadId);
    } else {
      newSelection.add(uploadId);
    }
    setSelectedUploads(newSelection);
  };

  const openStartModal = (ids: number[]) => {
    setModalUploadIds(ids);
    setSelectedMode("exam");
    setShowStartModal(true);
  };

  const handleStartFromSelected = () => {
    if (selectedUploads.size > 0) {
      const uploadIds = Array.from(selectedUploads);
      openStartModal(uploadIds);
    }
  };

  const getTotalQuestionsForIds = (ids: number[]) => {
    return ids
      .map((id) => uploads.find((u) => u.id === id)?.question_count || 0)
      .reduce((a, b) => a + b, 0);
  };

  const startExam = async () => {
    if (modalUploadIds.length === 0) return;
    try {
      const totalQuestions = getTotalQuestionsForIds(modalUploadIds);
      if (totalQuestions <= 0) {
        alert("No questions available in the selected uploads.");
        return;
      }
      const params: any = {
        includeConceptIds: [],
        questionTypes: [],
        count: totalQuestions,
      };
      if (modalUploadIds.length === 1) {
        params.uploadId = modalUploadIds[0];
      } else {
        params.uploadIds = modalUploadIds;
      }
      const exam = await createExam(params);
      setShowStartModal(false);
      setSelectedUploads(new Set());
      // Navigate directly
      if (selectedMode === "practice") {
        navigate(`/practice/${exam.examId}`);
      } else {
        navigate(`/exam/${exam.examId}`);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || e?.message || "Failed to start exam.");
    }
  };

  const handleStartRename = (uploadId: number) => {
    const upload = uploads.find((u) => u.id === uploadId);
    if (upload) {
      setEditingUploadId(uploadId);
      setEditName(upload.filename);
    }
  };

  const handleSaveRename = async (uploadId: number) => {
    try {
      await updateUploadName(uploadId, editName);
      setEditingUploadId(null);
      setEditName("");
      onUpdate();
    } catch (error) {
      console.error("Failed to rename upload:", error);
      alert("Failed to rename upload");
    }
  };

  const handleCancelRename = () => {
    setEditingUploadId(null);
    setEditName("");
  };

  const formatDate = (date: string) => {
    // Normalize to local time; if timestamp lacks timezone, assume UTC
    const hasTZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date);
    const d = new Date(hasTZ ? date : `${date}Z`);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get unique class tags from all uploads
  const allClassTags = Array.from(
    new Set(uploads.flatMap((u) => u.class_tags || []))
  ).sort();

  // Filter uploads based on selected class
  const filteredUploads = selectedClassFilter
    ? uploads.filter((u) => u.class_tags?.includes(selectedClassFilter))
    : uploads;

  // Debug logging
  useEffect(() => {
    console.log("=== CSV LIBRARY ===");
    console.log("All uploads:", uploads);
    if (uploads.length > 0) {
      console.log(
        "First upload question_type_counts:",
        uploads[0]?.question_type_counts
      );
    }
  }, [uploads]);

  if (uploads.length === 0) {
    return (
      <div
        style={{
          padding: 48,
          textAlign: "center",
          background: theme.cardBg,
          backdropFilter: theme.glassBlur,
          WebkitBackdropFilter: theme.glassBlur,
          borderRadius: 12,
          border: `2px dashed ${theme.glassBorder}`,
          boxShadow: theme.glassShadow,
        }}
      >
        <h3 style={{ margin: "0 0 8px 0", color: theme.textSecondary }}>
          No CSVs uploaded yet
        </h3>
        <p style={{ margin: "0 0 16px 0", color: theme.textSecondary }}>
          Upload your first CSV file to start creating practice exams.
        </p>
        <button
          onClick={() => navigate("/upload")}
          style={{
            padding: "12px 32px",
            background: theme.crimson,
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.2px",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: "0 2px 8px rgba(196, 30, 58, 0.25)",
            transform:
              hoveredButton === "uploadFirst" ? "translateY(-1px)" : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(196, 30, 58, 0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 2px 8px rgba(196, 30, 58, 0.25)";
          }}
        >
          Upload Your First CSV
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Class Filter */}
      {allClassTags.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              flex: 1,
            }}
          >
            <span style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>
              Filter by class:
            </span>
            <button
              onClick={() => setSelectedClassFilter(null)}
              onMouseEnter={() => setHoveredButton("filterAll")}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                padding: "8px 16px",
                background: !selectedClassFilter ? theme.crimson : theme.cardBg,
                backdropFilter: !selectedClassFilter ? "none" : theme.glassBlur,
                WebkitBackdropFilter: !selectedClassFilter
                  ? "none"
                  : theme.glassBlur,
                color: !selectedClassFilter ? "white" : theme.text,
                border: `1px solid ${
                  !selectedClassFilter ? theme.crimson : theme.glassBorder
                }`,
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: !selectedClassFilter ? 600 : 500,
                transition: "all 0.2s ease",
                boxShadow: !selectedClassFilter
                  ? "0 2px 8px rgba(196, 30, 58, 0.3)"
                  : "none",
              }}
            >
              All
            </button>
            {allClassTags.map((tag) => {
              const classColor = getClassColor(tag);
              const isSelected = selectedClassFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedClassFilter(tag)}
                  onMouseEnter={() => setHoveredButton(`filter-${tag}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  style={{
                    padding: "8px 16px",
                    background: isSelected ? classColor : theme.cardBg,
                    backdropFilter: isSelected ? "none" : theme.glassBlur,
                    WebkitBackdropFilter: isSelected ? "none" : theme.glassBlur,
                    color: isSelected
                      ? getContrastTextColor(classColor)
                      : theme.text,
                    border: `1px solid ${
                      isSelected ? classColor : theme.glassBorder
                    }`,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                    transition: "all 0.2s ease",
                    boxShadow: isSelected
                      ? `0 2px 8px ${classColor}40`
                      : "none",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setShowCreateClass(true)}
              title="Create Class"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${theme.glassBorder}`,
                background: theme.cardBg,
                color: theme.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.text}
                strokeWidth="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              onClick={() => setShowManageClasses(true)}
              title="Manage Classes"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${theme.glassBorder}`,
                background: theme.cardBg,
                color: theme.text,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={theme.text}
                stroke="none"
              >
                <circle cx="6" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="18" cy="12" r="1.6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Multi-select Actions - Glassmorphism */}
      {uploads.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            padding: 16,
            background:
              selectedUploads.size > 0
                ? darkMode
                  ? "rgba(196, 30, 58, 0.15)"
                  : "rgba(196, 30, 58, 0.1)"
                : theme.cardBg,
            backdropFilter: theme.glassBlur,
            WebkitBackdropFilter: theme.glassBlur,
            borderRadius: 12,
            border: `1px solid ${
              selectedUploads.size > 0 ? theme.crimson : theme.glassBorder
            }`,
            boxShadow:
              selectedUploads.size > 0
                ? theme.glassShadowHover
                : theme.glassShadow,
            transition: "all 0.3s ease",
          }}
        >
          <div>
            {selectedUploads.size > 0 ? (
              <span
                style={{
                  color: theme.crimson,
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {selectedUploads.size} CSV{selectedUploads.size > 1 ? "s" : ""}{" "}
                selected
              </span>
            ) : (
              <span style={{ color: theme.textSecondary, fontSize: 14 }}>
                Click CSVs to create a combined exam
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedUploads.size > 0 && (
              <button
                onClick={handleStartFromSelected}
                style={{
                  padding: "10px 24px",
                  background: theme.crimson,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "-0.2px",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 2px 8px rgba(196, 30, 58, 0.25)",
                  transform:
                    hoveredButton === "createFromSelected"
                      ? "translateY(-1px)"
                      : "none",
                }}
                onMouseEnter={(e) => {
                  setHoveredButton("createFromSelected");
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(196, 30, 58, 0.35)";
                }}
                onMouseLeave={(e) => {
                  setHoveredButton(null);
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(196, 30, 58, 0.25)";
                }}
              >
                Start Exam
              </button>
            )}
          </div>
        </div>
      )}

      {/* CSV Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {filteredUploads.map((upload) => (
          <div
            key={upload.id}
            style={{
              border: selectedUploads.has(upload.id)
                ? `2px solid ${theme.crimson}`
                : `1px solid ${theme.glassBorder}`,
              borderRadius: 12,
              padding: 18,
              background: selectedUploads.has(upload.id)
                ? darkMode
                  ? "rgba(196, 30, 58, 0.12)"
                  : "rgba(196, 30, 58, 0.08)"
                : theme.cardBg,
              backdropFilter: theme.glassBlur,
              WebkitBackdropFilter: theme.glassBlur,
              cursor: "pointer",
              transition: "all 0.3s ease",
              position: "relative",
              boxShadow: selectedUploads.has(upload.id)
                ? theme.glassShadowHover
                : theme.glassShadow,
            }}
            onClick={() => toggleSelection(upload.id)}
            onMouseEnter={(e) => {
              if (!selectedUploads.has(upload.id)) {
                e.currentTarget.style.boxShadow = theme.glassShadowHover;
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUploads.has(upload.id)) {
                e.currentTarget.style.boxShadow = theme.glassShadow;
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
          >
            {/* Action buttons (Assign to class & Rename) in Top Right */}
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                display: "flex",
                gap: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Rename button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(upload.id);
                }}
                title="Rename"
                style={{
                  padding: "6px",
                  background: "rgba(196, 30, 58, 0.08)",
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(196, 30, 58, 0.08)";
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={theme.crimson}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>

              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenClassDropdown(
                      openClassDropdown === upload.id ? null : upload.id
                    );
                  }}
                  title="Assign to class"
                  style={{
                    padding: "6px",
                    background:
                      openClassDropdown === upload.id
                        ? "rgba(196, 30, 58, 0.15)"
                        : "rgba(196, 30, 58, 0.08)",
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (openClassDropdown !== upload.id) {
                      e.currentTarget.style.background =
                        "rgba(196, 30, 58, 0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (openClassDropdown !== upload.id) {
                      e.currentTarget.style.background =
                        "rgba(196, 30, 58, 0.08)";
                    }
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={theme.crimson}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </button>

                {/* Dropdown for class assignment */}
                {openClassDropdown === upload.id && (
                  <div
                    data-dropdown={upload.id}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      minWidth: 200,
                      background: theme.cardBgSolid,
                      border: `1px solid ${theme.glassBorder}`,
                      borderRadius: 8,
                      boxShadow: theme.glassShadowHover,
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    <ClassTagSelector
                      uploadId={upload.id}
                      currentTags={upload.class_tags || []}
                      onUpdate={() => {
                        onUpdate();
                        setOpenClassDropdown(null);
                      }}
                      darkMode={darkMode}
                      theme={theme}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Filename */}
            <div style={{ marginBottom: 12 }}>
              {editingUploadId === upload.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRename(upload.id);
                    if (e.key === "Escape") handleCancelRename();
                  }}
                  onBlur={() => handleSaveRename(upload.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "calc(100% - 80px)",
                    padding: "4px 8px",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 4,
                    backgroundColor: theme.cardBgSolid,
                    color: theme.text,
                    fontSize: 16,
                    fontWeight: "bold",
                  }}
                  autoFocus
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    title={upload.filename}
                    style={{
                      fontWeight: "bold",
                      fontSize: 16,
                      color: theme.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                      flex: 1,
                    }}
                  >
                    {upload.filename}
                  </span>
                </div>
              )}
            </div>
            {/* Class Tags relocated under top-right action buttons */}
            {upload.class_tags && upload.class_tags.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 44,
                  right: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  justifyContent: "flex-end",
                }}
              >
                {upload.class_tags.map((tag, index) => {
                  const classColor = getClassColor(tag);
                  const textColor = getContrastTextColor(classColor);
                  return (
                    <span
                      key={index}
                      style={{
                        padding: "3px 8px",
                        backgroundColor: classColor,
                        color: textColor,
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: "bold",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tag.length > 12 ? `${tag.slice(0, 12)}…` : tag}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Upload Info */}
            <div
              style={{
                marginBottom: 12,
                fontSize: 14,
                color: theme.textSecondary,
              }}
            >
              <div>Uploaded: {formatDate(upload.created_at)}</div>
              <div>Questions: {upload.question_count}</div>
              <div>Exams Taken: {upload.exam_count}</div>
            </div>

            {/* Themes */}
            {upload.themes && upload.themes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: theme.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  Themes:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {upload.themes.slice(0, 5).map((themeItem, index) => (
                    <span
                      key={index}
                      style={{
                        padding: "2px 6px",
                        backgroundColor: darkMode ? "#3d3d3d" : "#e9ecef",
                        borderRadius: 4,
                        fontSize: 11,
                        color: darkMode ? "#a0a0a0" : "#495057",
                      }}
                    >
                      {themeItem}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Question Types */}
            {upload.question_type_counts &&
              Object.keys(upload.question_type_counts).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: theme.textSecondary,
                      marginBottom: 4,
                    }}
                  >
                    Question Types:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(upload.question_type_counts).map(
                      ([type, count]) => (
                        <span
                          key={type}
                          style={{
                            padding: "2px 6px",
                            backgroundColor: darkMode ? "#2a4a62" : "#e3f2fd",
                            borderRadius: 4,
                            fontSize: 11,
                            color: darkMode ? "#90caf9" : "#1976d2",
                          }}
                        >
                          {QUESTION_TYPE_LABELS[type as QuestionType]} ({count})
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

            {/* Actions */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 12,
                paddingTop: 12,
                borderTop: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Create Exam - with + icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openStartModal([upload.id]);
                  }}
                  onMouseEnter={() => setHoveredButton(`create-${upload.id}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  style={{
                    padding: "8px 14px",
                    background:
                      hoveredButton === `create-${upload.id}`
                        ? "rgba(196, 30, 58, 0.15)"
                        : "rgba(196, 30, 58, 0.08)",
                    color: theme.crimson,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Start Exam
                </button>

                {/* Download - icon only */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(upload.id);
                  }}
                  onMouseEnter={() => setHoveredButton(`download-${upload.id}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  title="Download CSV"
                  style={{
                    padding: "8px",
                    background: "transparent",
                    color: theme.textSecondary,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    opacity:
                      hoveredButton === `download-${upload.id}` ? 1 : 0.7,
                  }}
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>

                {/* Delete - icon only */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Are you sure you want to delete "${upload.filename}"? This will also delete all associated exams and attempts.`
                      )
                    ) {
                      onDelete(upload.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredButton(`delete-${upload.id}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  title="Delete CSV"
                  style={{
                    padding: "8px",
                    background: "transparent",
                    color: theme.textSecondary,
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    opacity: hoveredButton === `delete-${upload.id}` ? 1 : 0.7,
                  }}
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
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Start Exam Modal */}
      {showStartModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setShowStartModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowStartModal(false);
          }}
        >
          <div
            style={{
              background: theme.modalBg,
              borderRadius: 12,
              padding: 24,
              width: "90%",
              maxWidth: 420,
              border: `1px solid ${theme.glassBorder}`,
              boxShadow: theme.glassShadowHover,
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: 20,
                fontWeight: 700,
                color: theme.text,
              }}
            >
              Start Exam
            </h3>
            <p style={{ margin: "0 0 16px 0", color: theme.textSecondary }}>
              This will use all questions from the selected upload
              {modalUploadIds.length > 1 ? "s" : ""}. You can choose the mode
              below.
            </p>
            <div style={{ marginBottom: 16, color: theme.text }}>
              Total questions:{" "}
              <strong>{getTotalQuestionsForIds(modalUploadIds)}</strong>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setSelectedMode("exam")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `2px solid ${
                    selectedMode === "exam" ? theme.crimson : theme.glassBorder
                  }`,
                  background:
                    selectedMode === "exam"
                      ? darkMode
                        ? "rgba(196, 30, 58, 0.15)"
                        : "rgba(196, 30, 58, 0.08)"
                      : "transparent",
                  color: theme.text,
                  cursor: "pointer",
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Exam Mode
              </button>
              <button
                onClick={() => setSelectedMode("practice")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `2px solid ${
                    selectedMode === "practice"
                      ? theme.amber
                      : theme.glassBorder
                  }`,
                  background:
                    selectedMode === "practice"
                      ? darkMode
                        ? "rgba(212, 166, 80, 0.15)"
                        : "rgba(212, 166, 80, 0.1)"
                      : "transparent",
                  color: theme.text,
                  cursor: "pointer",
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="6"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                </svg>
                Practice Mode
              </button>
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                onClick={() => setShowStartModal(false)}
                style={{
                  padding: "10px 16px",
                  background: "transparent",
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 8,
                  color: theme.text,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={startExam}
                style={{
                  padding: "10px 16px",
                  background: theme.crimson,
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateClass && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
          }}
          onClick={() => setShowCreateClass(false)}
        >
          <div
            style={{
              background: theme.modalBg,
              borderRadius: 12,
              padding: 24,
              width: "90%",
              maxWidth: 480,
              border: `1px solid ${theme.glassBorder}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", color: theme.text }}>
              Create Class
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{ display: "block", marginBottom: 6, color: theme.text }}
              >
                Name *
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  background: theme.cardBg,
                  color: theme.text,
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{ display: "block", marginBottom: 6, color: theme.text }}
              >
                Description
              </label>
              <textarea
                value={newClassDescription}
                onChange={(e) => setNewClassDescription(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 6,
                  background: theme.cardBg,
                  color: theme.text,
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{ display: "block", marginBottom: 6, color: theme.text }}
              >
                Color
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 8,
                }}
              >
                {CLASS_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setNewClassColor(c.value)}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: 8,
                      backgroundColor: c.value,
                      border:
                        newClassColor === c.value
                          ? "3px solid white"
                          : "1px solid #ccc",
                      cursor: "pointer",
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setShowCreateClass(false)}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${theme.glassBorder}`,
                  background: "transparent",
                  borderRadius: 6,
                  color: theme.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newClassName.trim()) {
                    alert("Please enter a class name");
                    return;
                  }
                  try {
                    await createClass(
                      newClassName,
                      newClassDescription || undefined,
                      newClassColor
                    );
                    setShowCreateClass(false);
                    setNewClassName("");
                    setNewClassDescription("");
                    setNewClassColor("#007bff");
                    const updated = await fetchClasses();
                    setAllClasses(updated);
                  } catch (e: any) {
                    alert(e?.message || "Failed to create class");
                  }
                }}
                style={{
                  padding: "8px 12px",
                  background: theme.crimson,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Classes Modal */}
      {showManageClasses && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2100,
          }}
          onClick={() => {
            setManageView("list");
            setShowManageClasses(false);
          }}
        >
          <div
            style={{
              background: theme.modalBg,
              borderRadius: 12,
              padding: 24,
              width: "90vw",
              maxWidth: 800,
              aspectRatio: "1",
              border: `1px solid ${theme.glassBorder}`,
              maxHeight: "90vh",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0, color: theme.text }}>Manage Classes</h3>
              {manageView === "list" ? (
                <button
                  onClick={() => setManageView("create")}
                  title="Create Class"
                  style={{
                    padding: "8px 12px",
                    background: theme.crimson,
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  + New Class
                </button>
              ) : (
                <button
                  onClick={() => setManageView("list")}
                  title="Back"
                  style={{
                    padding: "8px 12px",
                    background: "transparent",
                    border: `1px solid ${theme.glassBorder}`,
                    borderRadius: 6,
                    color: theme.text,
                    cursor: "pointer",
                  }}
                >
                  Back
                </button>
              )}
            </div>
            {manageView === "create" ? (
              <div
                style={{
                  background: theme.modalBg,
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                <h3 style={{ margin: "0 0 12px 0", color: theme.text }}>
                  Create Class
                </h3>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      color: theme.text,
                    }}
                  >
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      background: theme.cardBg,
                      color: theme.text,
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      color: theme.text,
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={newClassDescription}
                    onChange={(e) => setNewClassDescription(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 6,
                      background: theme.cardBg,
                      color: theme.text,
                    }}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      color: theme.text,
                    }}
                  >
                    Color
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: 8,
                    }}
                  >
                    {CLASS_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setNewClassColor(c.value)}
                        style={{
                          width: "100%",
                          aspectRatio: "1",
                          borderRadius: 8,
                          backgroundColor: c.value,
                          border:
                            newClassColor === c.value
                              ? "3px solid white"
                              : "1px solid #ccc",
                          cursor: "pointer",
                        }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => {
                      setManageView("list");
                    }}
                    style={{
                      padding: "8px 12px",
                      border: `1px solid ${theme.glassBorder}`,
                      background: "transparent",
                      borderRadius: 6,
                      color: theme.text,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!newClassName.trim()) {
                        alert("Please enter a class name");
                        return;
                      }
                      try {
                        await createClass(
                          newClassName,
                          newClassDescription || undefined,
                          newClassColor
                        );
                        setNewClassName("");
                        setNewClassDescription("");
                        setNewClassColor("#007bff");
                        const updated = await fetchClasses();
                        setAllClasses(updated);
                        setManageView("list");
                      } catch (e: any) {
                        alert(e?.message || "Failed to create class");
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      background: theme.crimson,
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : allClasses.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 48,
                  color: theme.textSecondary,
                }}
              >
                No classes created. Create one
                <button
                  onClick={() => setManageView("create")}
                  style={{
                    marginLeft: 6,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${theme.glassBorder}`,
                    background: "transparent",
                    color: theme.text,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 12,
                }}
              >
                {allClasses.map((cls) => (
                  <div
                    key={cls.id}
                    style={{
                      border: `1px solid ${theme.border}`,
                      borderRadius: 8,
                      padding: 12,
                      background: theme.cardBg,
                    }}
                  >
                    {manageEditing === cls.id ? (
                      <>
                        <input
                          type="text"
                          value={manageName}
                          onChange={(e) => setManageName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            border: `1px solid ${theme.border}`,
                            borderRadius: 6,
                            marginBottom: 8,
                            background: theme.cardBg,
                            color: theme.text,
                          }}
                        />
                        <textarea
                          value={manageDescription}
                          onChange={(e) => setManageDescription(e.target.value)}
                          rows={3}
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            border: `1px solid ${theme.border}`,
                            borderRadius: 6,
                            marginBottom: 8,
                            background: theme.cardBg,
                            color: theme.text,
                          }}
                        />
                        <div
                          style={{ display: "flex", gap: 6, marginBottom: 8 }}
                        >
                          {CLASS_COLORS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() => setManageColor(c.value)}
                              title={c.name}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                background: c.value,
                                border:
                                  manageColor === c.value
                                    ? "2px solid white"
                                    : "1px solid #ccc",
                                cursor: "pointer",
                              }}
                            />
                          ))}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={() => setManageEditing(null)}
                            style={{
                              padding: "6px 10px",
                              border: `1px solid ${theme.glassBorder}`,
                              background: "transparent",
                              borderRadius: 6,
                              color: theme.text,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await updateClass(
                                  cls.id,
                                  manageName || undefined,
                                  manageDescription || undefined,
                                  manageColor || undefined
                                );
                                setManageEditing(null);
                                const updated = await fetchClasses();
                                setAllClasses(updated);
                              } catch (e: any) {
                                alert(e?.message || "Failed to update class");
                              }
                            }}
                            style={{
                              padding: "6px 10px",
                              background: theme.crimson,
                              color: "white",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 8,
                          }}
                        >
                          <h4 style={{ margin: 0, color: theme.text }}>
                            {cls.name}
                          </h4>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              title="Edit"
                              onClick={() => {
                                setManageEditing(cls.id);
                                setManageName(cls.name);
                                setManageDescription(cls.description || "");
                                setManageColor(cls.color || "#007bff");
                              }}
                              onMouseEnter={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.opacity = "1";
                              }}
                              onMouseLeave={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.opacity = "0.7";
                              }}
                              style={{
                                padding: 8,
                                background: "transparent",
                                color: theme.textSecondary,
                                border: `1px solid ${theme.glassBorder}`,
                                borderRadius: 6,
                                cursor: "pointer",
                                transition: "0.2s",
                                display: "flex",
                                alignItems: "center",
                                opacity: 0.7,
                              }}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button
                              title="Delete"
                              onClick={async () => {
                                if (!confirm(`Delete class "${cls.name}"?`))
                                  return;
                                try {
                                  await deleteClass(cls.id);
                                  const updated = await fetchClasses();
                                  setAllClasses(updated);
                                } catch (e: any) {
                                  alert(e?.message || "Failed to delete class");
                                }
                              }}
                              onMouseEnter={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.opacity = "1";
                              }}
                              onMouseLeave={(e) => {
                                (
                                  e.currentTarget as HTMLButtonElement
                                ).style.opacity = "0.7";
                              }}
                              style={{
                                padding: 8,
                                background: "transparent",
                                color: theme.textSecondary,
                                border: `1px solid ${theme.glassBorder}`,
                                borderRadius: 6,
                                cursor: "pointer",
                                transition: "0.2s",
                                display: "flex",
                                alignItems: "center",
                                opacity: 0.7,
                              }}
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
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                        {cls.description && (
                          <div
                            style={{ color: theme.textSecondary, fontSize: 13 }}
                          >
                            {cls.description}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <button
                onClick={() => {
                  setManageView("list");
                  setShowManageClasses(false);
                }}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${theme.glassBorder}`,
                  background: "transparent",
                  color: theme.text,
                  borderRadius: 6,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
