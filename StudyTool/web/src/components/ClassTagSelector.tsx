import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchClasses,
  assignUploadToClass,
  removeUploadFromClass,
  createClass,
} from "../api/client";
import type { ClassSummary } from "../types";

interface ClassTagSelectorProps {
  uploadId: number;
  currentTags: string[];
  onUpdate: () => void;
  darkMode: boolean;
  theme: any;
}

export default function ClassTagSelector({
  uploadId,
  currentTags,
  onUpdate,
  darkMode,
  theme,
}: ClassTagSelectorProps) {
  const navigate = useNavigate();
  const [allClasses, setAllClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#007bff");

  const CLASS_COLORS = [
    { name: "Blue", value: "#007bff", darkBg: "#1a3a52", darkText: "#64b5f6" },
    { name: "Green", value: "#28a745", darkBg: "#1a3d1a", darkText: "#66bb6a" },
    { name: "Red", value: "#dc3545", darkBg: "#3d1a1a", darkText: "#ef5350" },
    {
      name: "Yellow",
      value: "#ffc107",
      darkBg: "#4d4520",
      darkText: "#ffb74d",
    },
    {
      name: "Purple",
      value: "#6f42c1",
      darkBg: "#2a1a3d",
      darkText: "#ba68c8",
    },
    {
      name: "Orange",
      value: "#fd7e14",
      darkBg: "#3d2a1a",
      darkText: "#ff9800",
    },
    { name: "Teal", value: "#20c997", darkBg: "#1a3d35", darkText: "#4db6ac" },
    { name: "Pink", value: "#e83e8c", darkBg: "#3d1a30", darkText: "#ec407a" },
    {
      name: "Indigo",
      value: "#6610f2",
      darkBg: "#2a1a3d",
      darkText: "#7c4dff",
    },
    { name: "Cyan", value: "#17a2b8", darkBg: "#1a353d", darkText: "#4fc3f7" },
    { name: "Brown", value: "#795548", darkBg: "#2a2220", darkText: "#a1887f" },
    { name: "Gray", value: "#6c757d", darkBg: "#2d2d2d", darkText: "#b0bec5" },
  ];

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await fetchClasses();
      setAllClasses(data);
    } catch (e) {
      console.error("Failed to load classes:", e);
    }
  };

  const handleToggleClass = async (classId: number, className: string) => {
    setLoading(true);
    try {
      if (currentTags.includes(className)) {
        // Remove
        await removeUploadFromClass(uploadId, classId);
      } else {
        // Add
        await assignUploadToClass(uploadId, classId);
      }
      onUpdate();
    } catch (e: any) {
      alert(`Failed to update class: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const newCls = await createClass(
        newName.trim(),
        newDesc || undefined,
        newColor
      );
      // Assign the current upload to the new class
      await assignUploadToClass(uploadId, newCls.id);
      await loadClasses();
      setShowCreateModal(false);
      setNewName("");
      setNewDesc("");
      setNewColor("#007bff");
      onUpdate();
    } catch (e: any) {
      alert(`Failed to create class: ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minWidth: 220 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: theme.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Classes
        </span>
        <button
          onClick={() => setShowCreateModal(true)}
          title="Create new class"
          disabled={loading}
          onMouseEnter={() => !loading && setHoveredButton("createClass")}
          onMouseLeave={() => setHoveredButton(null)}
          style={{
            padding: "6px 10px",
            minWidth: 32,
            height: 32,
            borderRadius: 6,
            border: `1px solid ${theme.glassBorder}`,
            background:
              hoveredButton === "createClass" ? theme.navHover : "transparent",
            cursor: loading ? "not-allowed" : "pointer",
            color: theme.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      </div>

      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {allClasses.length === 0 ? (
          <div
            style={{
              padding: 12,
              color: theme.textSecondary,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            No classes available.
          </div>
        ) : (
          allClasses.map((cls) => {
            const isSelected = currentTags.includes(cls.name);
            return (
              <div
                key={cls.id}
                onClick={() => handleToggleClass(cls.id, cls.name)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${theme.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: isSelected
                    ? darkMode
                      ? "#2a4a62"
                      : "#e3f2fd"
                    : theme.cardBg,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      theme.navHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      theme.cardBg;
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  style={{ cursor: "pointer" }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: cls.color || "#007bff",
                    marginRight: 4,
                  }}
                />
                <span style={{ fontSize: 14, color: theme.text }}>
                  {cls.name}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: darkMode ? "#2d1819" : "#ffffff",
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
              Create New Class
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
                Class Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Finance 101"
                disabled={loading}
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>

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
                Description (Optional)
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description of this class..."
                disabled={loading}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 14,
                  background: darkMode ? "#1a1a1a" : "#fff",
                  color: theme.text,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
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
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 8,
                }}
              >
                {CLASS_COLORS.map((colorOption) => (
                  <button
                    key={colorOption.value}
                    onClick={() => setNewColor(colorOption.value)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      height: 36,
                      borderRadius: 6,
                      border:
                        newColor === colorOption.value
                          ? `3px solid ${theme.crimson}`
                          : `1px solid ${theme.glassBorder}`,
                      backgroundColor: darkMode
                        ? colorOption.darkBg
                        : colorOption.value,
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                      transform:
                        newColor === colorOption.value ? "scale(1.1)" : "scale(1)",
                    }}
                    title={colorOption.name}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewName("");
                  setNewDesc("");
                  setNewColor("#007bff");
                }}
                disabled={loading}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  color: theme.textSecondary,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !newName.trim()}
                style={{
                  padding: "10px 20px",
                  background:
                    loading || !newName.trim() ? theme.textSecondary : theme.crimson,
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor:
                    loading || !newName.trim() ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "all 0.2s ease",
                }}
              >
                {loading ? "Creating..." : "Create Class"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
