import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import axios from "axios";

export default function BackupRestorePage() {
  const navigate = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setMessage(null);

    try {
      const response = await axios.get("http://127.0.0.1:8000/api/backup/create");
      const data = response.data;

      // Create downloadable file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().split("T")[0];
      link.download = `hoosier_prep_backup_${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save backup timestamp to localStorage
      localStorage.setItem("last_backup_date", new Date().toISOString());

      setMessage(
        `✅ Backup created! (${data.metadata.total_uploads} uploads, ${data.metadata.total_attempts} attempts)`
      );
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message || "Failed to create backup"}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setMessage("❌ Please select a valid JSON backup file");
      return;
    }

    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      setMessage("❌ File too large (max 50MB)");
      return;
    }

    setSelectedFile(file);
    setMessage(null);

    // Preview backup contents
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.version !== "1.0" || data.app_name !== "Hoosier Prep Portal") {
        setMessage("❌ Invalid backup file format");
        setSelectedFile(null);
        return;
      }

      setBackupPreview(data);
    } catch (error) {
      setMessage("❌ Could not read backup file. File may be corrupted.");
      setSelectedFile(null);
    }
  };

  const handleRestore = async () => {
    if (!selectedFile) return;

    setRestoreLoading(true);
    setShowConfirm(false);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await axios.post(
        "http://127.0.0.1:8000/api/backup/restore",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60000, // 1 minute timeout
        }
      );

      setMessage(
        `✅ Restore complete! Restored ${response.data.restored.uploads} uploads, ${response.data.restored.attempts} attempts`
      );
      setSelectedFile(null);
      setBackupPreview(null);

      // Refresh page after 2 seconds
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error: any) {
      setMessage(
        `❌ Restore failed: ${
          error.response?.data?.detail || error.message || "Unknown error"
        }`
      );
    } finally {
      setRestoreLoading(false);
    }
  };

  const lastBackupDate = localStorage.getItem("last_backup_date");

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 32,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: theme.crimson,
            letterSpacing: "-0.5px",
          }}
        >
          Backup & Restore
        </h2>
        <button
          onClick={() => navigate("/utilities")}
          style={{
            padding: "8px 14px",
            background: "rgba(196, 30, 58, 0.08)",
            color: theme.crimson,
            border: `1px solid ${theme.glassBorder}`,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
            transition: "0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(196, 30, 58, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(196, 30, 58, 0.08)";
          }}
        >
          Back to Utilities
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div
          style={{
            padding: 16,
            marginBottom: 24,
            borderRadius: 8,
            background: message.includes("❌")
              ? darkMode
                ? "#3d1a1a"
                : "#f8d7da"
              : darkMode
              ? "#1a3d1a"
              : "#d4edda",
            color: message.includes("❌")
              ? darkMode
                ? "#ef5350"
                : "#721c24"
              : darkMode
              ? "#66bb6a"
              : "#155724",
            border: `1px solid ${
              message.includes("❌")
                ? darkMode
                  ? "#4d2a2a"
                  : "#f5c6cb"
                : darkMode
                ? "#2a4d2a"
                : "#c3e6cb"
            }`,
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Backup Card */}
        <div
          style={{
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: 22,
              color: theme.text,
              fontWeight: 600,
            }}
          >
            Create Backup
          </h3>
          <p
            style={{
              margin: "0 0 20px 0",
              color: theme.textSecondary,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Download a complete backup of your study materials, exams, and
            performance history. Use this to transfer your data to another
            computer or keep a safety copy.
          </p>

          {lastBackupDate && (
            <div
              style={{
                padding: 12,
                marginBottom: 16,
                borderRadius: 6,
                background: darkMode ? "rgba(194, 155, 74, 0.1)" : "rgba(194, 155, 74, 0.05)",
                border: `1px solid ${theme.glassBorder}`,
                fontSize: 13,
                color: theme.textSecondary,
              }}
            >
              Last backup:{" "}
              {new Date(lastBackupDate).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}

          <button
            onClick={handleCreateBackup}
            disabled={backupLoading}
            style={{
              width: "100%",
              padding: "12px 20px",
              background: backupLoading ? theme.border : theme.crimson,
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: backupLoading ? "not-allowed" : "pointer",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.2px",
              transition: "0.2s",
              boxShadow: backupLoading
                ? "none"
                : "0 2px 8px rgba(196, 30, 58, 0.25)",
            }}
            onMouseEnter={(e) => {
              if (!backupLoading) {
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(196, 30, 58, 0.35)";
              }
            }}
            onMouseLeave={(e) => {
              if (!backupLoading) {
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(196, 30, 58, 0.25)";
              }
            }}
          >
            {backupLoading ? "Creating Backup..." : "Download Backup"}
          </button>
        </div>

        {/* Restore Card */}
        <div
          style={{
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              fontSize: 22,
              color: theme.text,
              fontWeight: 600,
            }}
          >
            Restore Backup
          </h3>
          <p
            style={{
              margin: "0 0 20px 0",
              color: theme.textSecondary,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Upload a backup file to restore your data. 
          </p>

          {/* Warning */}
          <div
            style={{
              padding: 12,
              marginBottom: 20,
              borderRadius: 6,
              background: darkMode ? "#3d1a1a" : "#fff3cd",
              border: `1px solid ${darkMode ? "#4d2a2a" : "#ffc107"}`,
              fontSize: 13,
              color: darkMode ? "#ef5350" : "#856404",
              lineHeight: 1.5,
            }}
          >
            <strong>⚠️ Warning:</strong> This will replace ALL your current data
            (uploads, exams, attempts, classes). This cannot be undone!
          </div>

          {/* Drag and drop area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
              }
            }}
            style={{
              border: `2px dashed ${
                isDragging ? theme.crimson : theme.glassBorder
              }`,
              borderRadius: 8,
              padding: 32,
              textAlign: "center",
              marginBottom: 16,
              background: isDragging
                ? darkMode
                  ? "rgba(196, 30, 58, 0.1)"
                  : "rgba(196, 30, 58, 0.05)"
                : theme.cardBg,
              cursor: "pointer",
              transition: "0.2s",
            }}
            onClick={() => document.getElementById("backup-file-input")?.click()}
          >
            <input
              id="backup-file-input"
              type="file"
              accept=".json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              style={{ display: "none" }}
            />
            {selectedFile ? (
              <div>
                <div style={{ fontSize: 16, color: theme.text, marginBottom: 8 }}>
                  📄 {selectedFile.name}
                </div>
                <div style={{ fontSize: 13, color: theme.textSecondary }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
                {backupPreview && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      background: darkMode ? "rgba(194, 155, 74, 0.1)" : "rgba(194, 155, 74, 0.05)",
                      borderRadius: 6,
                      fontSize: 13,
                      color: theme.text,
                    }}
                  >
                    <div>
                      <strong>Preview:</strong>
                    </div>
                    <div>
                      {backupPreview.metadata.total_uploads} uploads
                    </div>
                    <div>
                      {backupPreview.metadata.total_questions} questions
                    </div>
                    <div>
                      {backupPreview.metadata.total_attempts} attempts
                    </div>
                    <div>
                      Created: {new Date(backupPreview.created_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 16, color: theme.text, marginBottom: 8 }}>
                  Drop backup file here or click to browse
                </div>
                <div style={{ fontSize: 13, color: theme.textSecondary }}>
                  Only .json backup files are supported (max 50MB)
                </div>
              </div>
            )}
          </div>

          {/* Restore Button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!selectedFile || restoreLoading}
            style={{
              width: "100%",
              padding: "12px 20px",
              background:
                !selectedFile || restoreLoading ? theme.border : "#dc3545",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: !selectedFile || restoreLoading ? "not-allowed" : "pointer",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "-0.2px",
              transition: "0.2s",
              boxShadow:
                !selectedFile || restoreLoading
                  ? "none"
                  : "0 2px 8px rgba(220, 53, 69, 0.25)",
            }}
            onMouseEnter={(e) => {
              if (selectedFile && !restoreLoading) {
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(220, 53, 69, 0.35)";
              }
            }}
            onMouseLeave={(e) => {
              if (selectedFile && !restoreLoading) {
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(220, 53, 69, 0.25)";
              }
            }}
          >
            {restoreLoading ? "Restoring..." : "Restore from Backup"}
          </button>

          {selectedFile && (
            <button
              onClick={() => {
                setSelectedFile(null);
                setBackupPreview(null);
              }}
              style={{
                width: "100%",
                padding: "8px 16px",
                marginTop: 8,
                background: "transparent",
                color: theme.textSecondary,
                border: `1px solid ${theme.glassBorder}`,
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                transition: "0.2s",
              }}
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            style={{
              background: theme.modalBg,
              backdropFilter: theme.glassBlur,
              WebkitBackdropFilter: theme.glassBlur,
              padding: 24,
              borderRadius: 12,
              maxWidth: 400,
              width: "90%",
              border: `1px solid ${theme.glassBorder}`,
              boxShadow: theme.glassShadowHover,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: "0 0 16px 0",
                color: "#dc3545",
                fontWeight: 700,
              }}
            >
              ⚠️ Confirm Restore
            </h3>
            <p
              style={{
                margin: "0 0 24px 0",
                lineHeight: 1.5,
                color: theme.text,
              }}
            >
              This will <strong>DELETE ALL</strong> your current data and replace
              it with the backup. Are you absolutely sure?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  color: theme.text,
                  border: `1px solid ${theme.glassBorder}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "0.2s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                style={{
                  padding: "8px 20px",
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "0.2s",
                  boxShadow: "0 2px 8px rgba(220, 53, 69, 0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(220, 53, 69, 0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    "0 2px 8px rgba(220, 53, 69, 0.25)";
                }}
              >
                Yes, Restore Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

