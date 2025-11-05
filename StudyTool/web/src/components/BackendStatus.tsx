import { useState, useEffect } from "react";
import axios from "axios";

interface BackendStatusProps {
  theme: any;
  darkMode: boolean;
}

export default function BackendStatus({ theme, darkMode }: BackendStatusProps) {
  const [status, setStatus] = useState<"checking" | "online" | "offline">(
    "checking"
  );
  const [lastCheck, setLastCheck] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        // Try to get the backend URL
        const backendUrl = getBackendUrl();
        const response = await axios.get(`${backendUrl}/health`, {
          timeout: 3000,
        });

        if (response.data && response.data.status === "ok") {
          setStatus("online");
          setError("");
        } else {
          setStatus("offline");
          setError("Backend returned unexpected response");
        }
      } catch (err: any) {
        setStatus("offline");
        if (err.code === "ECONNREFUSED") {
          setError("Backend server is not running");
        } else if (err.code === "ECONNABORTED") {
          setError("Backend request timed out");
        } else {
          setError(err.message || "Unknown error");
        }
      }

      setLastCheck(new Date().toLocaleTimeString());
    };

    // Check immediately
    checkBackend();

    // Then check every 5 seconds
    const interval = setInterval(checkBackend, 5000);

    return () => clearInterval(interval);
  }, []);

  const getBackendUrl = (): string => {
    // ELECTRON CODE COMMENTED OUT - Always use fixed port for browser mode
    // if (typeof window !== "undefined" && (window as any).electronAPI) {
    //   const electronAPI = (window as any).electronAPI;
    //   const backendStatus = electronAPI.getBackendStatus();
    //   const port = backendStatus.port || 8000;
    //   return `http://127.0.0.1:${port}`;
    // }
    return "http://127.0.0.1:8000";
  };

  if (status === "online") {
    // Don't show anything when online
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "12px 20px",
        background: darkMode
          ? "rgba(220, 53, 69, 0.2)"
          : "rgba(220, 53, 69, 0.1)",
        border: `1px solid ${theme.btnDanger}`,
        borderRadius: 8,
        backdropFilter: theme.glassBlur,
        WebkitBackdropFilter: theme.glassBlur,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        zIndex: 9999,
        maxWidth: 300,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background:
              status === "checking"
                ? theme.amber
                : status === "online"
                ? "#28a745"
                : theme.btnDanger,
            animation:
              status === "checking"
                ? "pulse 1.5s ease-in-out infinite"
                : "none",
          }}
        />
        <div>
          <div
            style={{
              fontWeight: 600,
              color: theme.text,
              marginBottom: 4,
            }}
          >
            Backend {status === "checking" ? "Checking..." : "Offline"}
          </div>
          {error && (
            <div
              style={{
                fontSize: 12,
                color: theme.textSecondary,
              }}
            >
              {error}
            </div>
          )}
          {lastCheck && (
            <div
              style={{
                fontSize: 10,
                color: theme.textSecondary,
                marginTop: 4,
              }}
            >
              Last check: {lastCheck}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
