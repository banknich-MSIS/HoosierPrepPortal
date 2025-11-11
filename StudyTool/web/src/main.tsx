import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./index.css";
import Dashboard from "./pages/Dashboard";
// import UploadPage from "./pages/UploadPage";  // Hidden for release
import SmartExamCreator from "./pages/SmartExamCreator";
import SettingsPage from "./pages/SettingsPage";
import ExamPage from "./pages/ExamPage";
import PracticeModePage from "./pages/PracticeModePage";
import ReviewPage from "./pages/ReviewPage";
import AttemptReviewPage from "./pages/AttemptReviewPage";
import HistoryPage from "./pages/HistoryPage";
import SupportPage from "./pages/SupportPage";
import UtilitiesPage from "./pages/UtilitiesPage";
import ApiKeyManagementPage from "./pages/ApiKeyManagementPage";
import ClassesPage from "./pages/ClassesPage";
import BackupRestorePage from "./pages/BackupRestorePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "ai-exam-creator", element: <SmartExamCreator /> },
      // { path: "upload", element: <UploadPage /> },  // AI Assistant - hidden for release
      { path: "settings", element: <SettingsPage /> },
      { path: "exam/:examId", element: <ExamPage /> },
      { path: "practice/:examId", element: <PracticeModePage /> },
      { path: "review/:examId", element: <ReviewPage /> },
      // History list removed from nav; keep attempt review via direct link
      // Optionally, we could add a redirect from /history to /
      // { path: "history", element: <Dashboard /> },
      { path: "history/:attemptId", element: <AttemptReviewPage /> },
      { path: "classes", element: <ClassesPage /> },
      { path: "backup-restore", element: <BackupRestorePage /> },
      { path: "support", element: <SupportPage /> },
      { path: "utilities", element: <UtilitiesPage /> },
      { path: "api-keys", element: <ApiKeyManagementPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
