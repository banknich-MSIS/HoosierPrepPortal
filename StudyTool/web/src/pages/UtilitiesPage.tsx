import { useNavigate, useOutletContext } from "react-router-dom";

export default function UtilitiesPage() {
  const navigate = useNavigate();
  const { darkMode, theme } = useOutletContext<{
    darkMode: boolean;
    theme: any;
  }>();

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
          Utilities
        </h2>
        <button
          onClick={() => navigate("/")}
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
          Back to Dashboard
        </button>
      </div>

      {/* Utilities Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {/* Backup & Restore */}
        <div
          style={{
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: theme.text }}>
            Backup & Restore
          </h3>
          <p
            style={{
              margin: "0 0 16px 0",
              color: theme.textSecondary,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Backup your database and restore from previous backups.
          </p>
          <button
            onClick={() => navigate("/backup-restore")}
            style={{
              padding: "8px 16px",
              backgroundColor: theme.crimson,
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
              width: "100%",
              fontWeight: 600,
              transition: "0.2s",
              boxShadow: "0 2px 8px rgba(196, 30, 58, 0.25)",
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
            Manage Backups
          </button>
        </div>

        {/* API Key Management */}
        <div
          style={{
            backgroundColor: theme.cardBg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: 18, color: theme.text }}>
            API Key Management
          </h3>
          <p
            style={{
              margin: "0 0 16px 0",
              color: theme.textSecondary,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            Manage your Gemini API key for AI-powered exam generation features.
          </p>
          <button
            onClick={() => navigate("/api-keys")}
            style={{
              padding: "8px 16px",
              backgroundColor: theme.crimson,
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
              width: "100%",
              fontWeight: 600,
              transition: "0.2s",
              boxShadow: "0 2px 8px rgba(196, 30, 58, 0.25)",
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
            Manage API Keys
          </button>
        </div>
      </div>
    </div>
  );
}
