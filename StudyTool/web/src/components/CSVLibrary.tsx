import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import type { UploadSummary, ClassSummary, QuestionType } from "../types";
import ClassTagSelector from "./ClassTagSelector";
import ColorPicker from "./ColorPicker";
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
  isArchiveView?: boolean;
  onArchive?: (uploadId: number) => void;
  onUnarchive?: (uploadId: number) => void;
}

export default function CSVLibrary({
  uploads,
  onCreateExam,
  onDelete,
  onDownload,
  onUpdate,
  darkMode,
  theme,
  isArchiveView = false,
  onArchive,
  onUnarchive,
}: CSVLibraryProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedUploads, setSelectedUploads] = useState<Set<number>>(
    new Set()
  );
  const [allClasses, setAllClasses] = useState<ClassSummary[]>([]);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [selectedClassFilters, setSelectedClassFilters] = useState<string[]>([]);
  const [openClassDropdown, setOpenClassDropdown] = useState<number | null>(
    null
  );
  const [editingUploadId, setEditingUploadId] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassColor, setNewClassColor] = useState("#007bff");
  const [showStartModal, setShowStartModal] = useState(false);
  const [modalUploadIds, setModalUploadIds] = useState<number[]>([]);
  const [selectedMode, setSelectedMode] = useState<"exam" | "practice">("exam");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("csvLibraryViewMode") as "grid" | "list") || "grid";
  });

  const toggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("csvLibraryViewMode", mode);
  };

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
        showToast("No questions available in the selected uploads.", "warning");
        return;
      }
      const params: any = {
        uploadId: modalUploadIds[0], // Always required by backend
        includeConceptIds: [],
        questionTypes: [],
        count: totalQuestions,
      };
      if (modalUploadIds.length > 1) {
        params.uploadIds = modalUploadIds; // Additional field for multiple uploads
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
      showToast(
        e?.response?.data?.detail || e?.message || "Failed to start exam.",
        "error"
      );
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
      showToast("Failed to rename upload", "error");
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

  // Get unique class tags from all uploads + all available classes
  // This ensures even unused tags appear in the filter list
  const allClassTags = Array.from(
    new Set([
      ...uploads.flatMap((u) => u.class_tags || []),
      ...allClasses.map((c) => c.name)
    ])
  ).sort();

  // Filter uploads based on selected class (AND logic)
  const filteredUploads = selectedClassFilters.length > 0
    ? uploads.filter((u) => {
        const uploadTags = u.class_tags || [];
        return selectedClassFilters.every(tag => uploadTags.includes(tag));
      })
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
          No CSVs in library
        </h3>
        <p style={{ margin: "0 0 16px 0", color: theme.textSecondary }}>
          Generate your first exam to get started.
        </p>
        <button
          onClick={() => navigate("/ai-exam-creator")}
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
          Generate Your First Exam
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Class Filter */}
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
          {allClassTags.length > 0 ? (
            <>
              <span style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>
                Filter by tag:
              </span>
              <button
                onClick={() => setSelectedClassFilters([])}
                onMouseEnter={() => setHoveredButton("filterAll")}
                onMouseLeave={() => setHoveredButton(null)}
                style={{
                  padding: "8px 16px",
                  background: selectedClassFilters.length === 0 ? theme.crimson : theme.cardBg,
                  backdropFilter: selectedClassFilters.length === 0 ? "none" : theme.glassBlur,
                  WebkitBackdropFilter: selectedClassFilters.length === 0
                    ? "none"
                    : theme.glassBlur,
                  color: selectedClassFilters.length === 0 ? "white" : theme.text,
                  border: `1px solid ${
                    selectedClassFilters.length === 0 ? theme.crimson : theme.glassBorder
                  }`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: selectedClassFilters.length === 0 ? 600 : 500,
                  transition: "all 0.2s ease",
                  boxShadow: selectedClassFilters.length === 0
                    ? "0 2px 8px rgba(196, 30, 58, 0.3)"
                    : "none",
                }}
              >
                All
              </button>
              {allClassTags.map((tag) => {
                const classColor = getClassColor(tag);
                const isSelected = selectedClassFilters.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedClassFilters(prev => prev.filter(t => t !== tag));
                      } else {
                        setSelectedClassFilters(prev => [...prev, tag]);
                      }
                    }}
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
            </>
          ) : (
            <span
              style={{
                fontSize: 14,
                color: theme.textSecondary,
                fontStyle: "italic",
              }}
            >
              No tags yet
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* View Toggle */}
          <div style={{ 
            display: "flex", 
            background: theme.cardBg, 
            border: `1px solid ${theme.glassBorder}`, 
            borderRadius: 8, 
            padding: 2 
          }}>
            <button
              onClick={() => toggleViewMode("grid")}
              title="Grid View"
              style={{
                padding: "6px",
                background: viewMode === "grid" ? (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                color: viewMode === "grid" ? theme.crimson : theme.textSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick={() => toggleViewMode("list")}
              title="List View"
              style={{
                padding: "6px",
                background: viewMode === "list" ? (darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                color: viewMode === "list" ? theme.crimson : theme.textSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>

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
        </div>
      </div>

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

      {/* CSV List/Grid */}
      <div
        style={
          viewMode === "grid"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }
            : {
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }
        }
      >
        {filteredUploads.map((upload) => (
          <div
            key={upload.id}
            style={
              viewMode === "grid"
                ? {
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
                    zIndex: openClassDropdown === upload.id ? 10 : 1,
                  }
                : {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    border: selectedUploads.has(upload.id)
                      ? `2px solid ${theme.crimson}`
                      : `1px solid ${theme.glassBorder}`,
                    borderRadius: 8,
                    background: selectedUploads.has(upload.id)
                      ? darkMode
                        ? "rgba(196, 30, 58, 0.12)"
                        : "rgba(196, 30, 58, 0.08)"
                      : theme.cardBg,
                    backdropFilter: theme.glassBlur,
                    WebkitBackdropFilter: theme.glassBlur,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative",
                    zIndex: openClassDropdown === upload.id ? 10 : 1,
                  }
            }
            onClick={() => toggleSelection(upload.id)}
            onMouseEnter={(e) => {
              if (!selectedUploads.has(upload.id)) {
                e.currentTarget.style.boxShadow = theme.glassShadowHover;
                e.currentTarget.style.transform = viewMode === "grid" ? "translateY(-2px)" : "none";
                if (viewMode === "list") e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)";
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedUploads.has(upload.id)) {
                e.currentTarget.style.boxShadow = theme.glassShadow;
                e.currentTarget.style.transform = "translateY(0)";
                if (viewMode === "list") e.currentTarget.style.background = theme.cardBg;
              }
            }}
          >
          {viewMode === "grid" ? (
            <>
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
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
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

                {/* Download - icon only (only for CSV uploads) */}
                {upload.file_type === "csv" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(upload.id);
                    }}
                    onMouseEnter={() =>
                      setHoveredButton(`download-${upload.id}`)
                    }
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
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/question-base/${upload.id}`);
                  }}
                  onMouseEnter={() => setHoveredButton(`edit-base-${upload.id}`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  title="Edit"
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
                    opacity: hoveredButton === `edit-base-${upload.id}` ? 1 : 0.7,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>

                {/* Archive / Unarchive */}
                {isArchiveView ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onUnarchive) onUnarchive(upload.id);
                    }}
                    onMouseEnter={() => setHoveredButton(`unarchive-${upload.id}`)}
                    onMouseLeave={() => setHoveredButton(null)}
                    title="Unarchive"
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
                      opacity: hoveredButton === `unarchive-${upload.id}` ? 1 : 0.7,
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
                      <polyline points="9 14 15 14"></polyline>
                      <polyline points="4 20 4 14 20 14 20 20"></polyline>
                      <polyline points="4 20 20 20"></polyline>
                      <polyline points="12 4 12 14"></polyline>
                      <polyline points="9 7 12 4 15 7"></polyline>
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        onArchive &&
                        confirm(
                          `Archive "${upload.filename}"? It will be moved to the Archive page.`
                        )
                      ) {
                        onArchive(upload.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredButton(`archive-${upload.id}`)}
                    onMouseLeave={() => setHoveredButton(null)}
                    title="Archive"
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
                      opacity: hoveredButton === `archive-${upload.id}` ? 1 : 0.7,
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
                      <polyline points="21 8 21 21 3 21 3 8"></polyline>
                      <rect x="1" y="3" width="22" height="5"></rect>
                      <line x1="10" y1="12" x2="14" y2="12"></line>
                    </svg>
                  </button>
                )}

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
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            </div>
            </>
          ) : (
            /* List View Content */
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  {/* Name */}
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
                        minWidth: 200,
                        padding: "4px 8px",
                        border: `1px solid ${theme.border}`,
                        borderRadius: 4,
                        backgroundColor: theme.cardBgSolid,
                        color: theme.text,
                        fontSize: 14,
                        fontWeight: "bold",
                      }}
                      autoFocus
                    />
                  ) : (
                    <span
                      title={upload.filename}
                      style={{
                        fontWeight: "bold",
                        fontSize: 14,
                        color: theme.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {upload.filename}
                    </span>
                  )}

                  {/* Metadata: Questions, Themes, Types */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "0 12px" }}>
                    {/* Question Count */}
                    <span style={{ fontSize: 12, color: theme.textSecondary, whiteSpace: "nowrap", fontWeight: 500 }}>
                      {upload.question_count} Qs
                    </span>

                    {/* Themes (limit 2) */}
                    {upload.themes && upload.themes.length > 0 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {upload.themes.slice(0, 2).map((t, i) => (
                          <span key={i} style={{ 
                            fontSize: 10, 
                            padding: "2px 6px", 
                            borderRadius: 4, 
                            background: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                            color: theme.textSecondary,
                            whiteSpace: "nowrap"
                          }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Question Types */}
                    {upload.question_type_counts && (
                      <div style={{ display: "flex", gap: 6, fontSize: 11, color: theme.textSecondary }}>
                        {Object.entries(upload.question_type_counts).map(([type, count]) => {
                           const label = {
                             mcq: "MC",
                             multi: "MS",
                             truefalse: "TF",
                             short: "SA",
                             cloze: "FB"
                           }[type] || type.substring(0,2).toUpperCase();
                           return (
                             <span key={type} title={QUESTION_TYPE_LABELS[type]} style={{ whiteSpace: "nowrap" }}>
                               {count} {label}
                             </span>
                           );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: "auto" }}>
                    {upload.class_tags && upload.class_tags.map((tag, index) => {
                      const classColor = getClassColor(tag);
                      const textColor = getContrastTextColor(classColor);
                      return (
                        <div
                          key={index}
                          style={{
                            padding: "2px 6px",
                            backgroundColor: classColor,
                            color: textColor,
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          {tag}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions Row */}
                <div style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 12 }} onClick={(e) => e.stopPropagation()}>
                  {/* Start Exam */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openStartModal([upload.id]);
                    }}
                    title="Start Exam"
                    style={{
                      padding: "6px",
                      background: "transparent",
                      color: theme.crimson,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>

                  {/* Assign Tag */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenClassDropdown(
                          openClassDropdown === upload.id ? null : upload.id
                        );
                      }}
                      title="Assign tag"
                      style={{
                        padding: "6px",
                        background: openClassDropdown === upload.id ? "rgba(196, 30, 58, 0.15)" : "transparent",
                        color: theme.textSecondary,
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                      </svg>
                    </button>
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

                  {/* Edit Question Base (also allows renaming) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/question-base/${upload.id}`);
                    }}
                    title="Edit"
                    style={{
                      padding: "6px",
                      background: "transparent",
                      color: theme.textSecondary,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>

                  {/* Archive / Unarchive */}
                  {isArchiveView ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUnarchive) onUnarchive(upload.id);
                      }}
                      title="Unarchive"
                      style={{
                        padding: "6px",
                        background: "transparent",
                        color: theme.textSecondary,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
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
                        <polyline points="9 14 15 14"></polyline>
                        <polyline points="4 20 4 14 20 14 20 20"></polyline>
                        <polyline points="4 20 20 20"></polyline>
                        <polyline points="12 4 12 14"></polyline>
                        <polyline points="9 7 12 4 15 7"></polyline>
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          onArchive &&
                          confirm(
                            `Archive "${upload.filename}"? It will be moved to the Archive page.`
                          )
                        ) {
                          onArchive(upload.id);
                        }
                      }}
                      title="Archive"
                      style={{
                        padding: "6px",
                        background: "transparent",
                        color: theme.textSecondary,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
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
                        <polyline points="21 8 21 21 3 21 3 8"></polyline>
                        <rect x="1" y="3" width="22" height="5"></rect>
                        <line x1="10" y1="12" x2="14" y2="12"></line>
                      </svg>
                    </button>
                  )}

                  {/* Delete */}
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
                    title="Delete CSV"
                    style={{
                      padding: "6px",
                      background: "transparent",
                      color: theme.textSecondary,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
            </>
          )}
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
              background: theme.cardBgSolid,
              borderRadius: 12,
              border: `1px solid ${theme.glassBorder}`,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
              padding: 24,
              width: "90%",
              maxWidth: 450,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: 20,
                fontWeight: 700,
                color: theme.crimson,
              }}
            >
              Create New Tag
            </h3>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Tag Name *
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g., Finance"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  background: darkMode ? "#1a1a1a" : "#fff",
                  color: theme.text,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  outline: "none",
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newClassName.trim()) {
                    try {
                      await createClass(newClassName, undefined, newClassColor);
                      setShowCreateClass(false);
                      setNewClassName("");
                      setNewClassColor("#007bff");
                      const updated = await fetchClasses();
                      setAllClasses(updated);
                    } catch (e: any) {
                      showToast(
                        `Failed to create class: ${
                          e?.response?.data?.detail || e?.message || "Unknown error"
                        }`,
                        "error"
                      );
                    }
                  }
                }}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.text,
                  marginBottom: 8,
                }}
              >
                Color
              </label>
              <ColorPicker
                color={newClassColor}
                onChange={setNewClassColor}
                initialColor={"#007bff"}
                // presets={CLASS_COLORS}
                darkMode={darkMode}
              />
            </div>
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setShowCreateClass(false)}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  color: theme.textSecondary,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newClassName.trim()) {
                    showToast("Please enter a class name", "warning");
                    return;
                  }
                  try {
                    await createClass(newClassName, undefined, newClassColor);
                    setShowCreateClass(false);
                    setNewClassName("");
                    setNewClassColor("#007bff");
                    const updated = await fetchClasses();
                    setAllClasses(updated);
                  } catch (e: any) {
                    showToast(
                      `Failed to create class: ${
                        e?.response?.data?.detail || e?.message || "Unknown error"
                      }`,
                      "error"
                    );
                  }
                }}
                style={{
                  padding: "10px 20px",
                  background: theme.crimson,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
