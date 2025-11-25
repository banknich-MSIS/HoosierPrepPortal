import React, { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import CSVLibrary from "../components/CSVLibrary";
import {
  fetchAllUploads,
  deleteUpload,
  downloadCSV,
  unarchiveUpload,
} from "../api/client";
import type { UploadSummary } from "../types";

export default function ArchivePage() {
  const navigate = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchivedUploads();
  }, []);

  const loadArchivedUploads = async () => {
    try {
      setLoading(true);
      const data = await fetchAllUploads(true); // Fetch archived only
      setUploads(data);
    } catch (e) {
      console.error("Failed to load archived uploads", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExam = (
    uploadIds: number[],
    uploadData?: UploadSummary
  ) => {
    navigate("/settings", { state: { uploadIds, uploadData } });
  };

  const handleDeleteUpload = async (uploadId: number) => {
    try {
      await deleteUpload(uploadId);
      setUploads(uploads.filter((u) => u.id !== uploadId));
    } catch (e: any) {
      console.error(e?.message || "Failed to delete CSV");
    }
  };

  const handleDownloadCSV = async (uploadId: number) => {
    try {
      const blob = await downloadCSV(uploadId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        uploads.find((u) => u.id === uploadId)?.filename || "download.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e?.message || "Failed to download CSV");
    }
  };

  const handleUnarchive = async (uploadId: number) => {
    try {
      await unarchiveUpload(uploadId);
      setUploads(uploads.filter((u) => u.id !== uploadId));
    } catch (e: any) {
      console.error(e?.message || "Failed to unarchive");
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <h1
        style={{
          margin: "0 0 24px 0",
          fontSize: 32,
          fontWeight: 700,
          color: theme.crimson,
          letterSpacing: "-0.5px",
        }}
      >
        Archived Exams
      </h1>

      {loading ? (
        <div
          style={{
            padding: 48,
            background: theme.cardBg,
            borderRadius: 12,
            border: "1px solid " + theme.glassBorder,
            boxShadow: theme.glassShadow,
            color: theme.textSecondary,
            textAlign: "center",
          }}
        >
          Loading archive...
        </div>
      ) : uploads.length > 0 ? (
        <CSVLibrary
          uploads={uploads}
          onCreateExam={handleCreateExam}
          onDelete={handleDeleteUpload}
          onDownload={handleDownloadCSV}
          onUpdate={loadArchivedUploads}
          darkMode={darkMode}
          theme={theme}
          isArchiveView={true}
          onUnarchive={handleUnarchive}
        />
      ) : (
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
          <h3
            style={{
              margin: "0 0 8px 0",
              color: theme.textSecondary,
              fontSize: 18,
            }}
          >
            Archive is empty
          </h3>
          <p
            style={{
              margin: "0",
              color: theme.textSecondary,
              fontSize: 14,
            }}
          >
            Archived exams will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

