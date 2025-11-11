import { useNavigate, useOutletContext } from "react-router-dom";

export default function SupportPage() {
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
        <h2 style={{ margin: 0, fontSize: 28, color: theme.text }}>
          Support & Contact
        </h2>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Back to Dashboard
        </button>
      </div>

      {/* Contact Information */}
      <div
        style={{
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 20, color: theme.text }}>
          Contact Information
        </h3>
        <p style={{ margin: "0 0 12px 0", color: theme.text, lineHeight: 1.6 }}>
          If you have questions, feedback, or need assistance with the Hoosier
          Prep Portal, please reach out:
        </p>
        <div style={{ marginTop: 20 }}>
          <div style={{ marginBottom: 12, color: theme.text }}>
            <strong>Developer:</strong> Banks
          </div>
          <div style={{ marginBottom: 12, color: theme.text }}>
            <strong>Email:</strong>{" "}
            <a
              href="mailto:banknich@iu.edu"
              style={{ color: theme.crimson, textDecoration: "underline" }}
            >
              banknich@iu.edu
            </a>
          </div>
          <div style={{ marginBottom: 12, color: theme.text }}>
            <strong>GitHub:</strong>{" "}
            <a
              href="https://github.com/banknich-MSIS/HoosierPrepPortal"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.crimson, textDecoration: "underline" }}
            >
              github.com/banknich-MSIS/HoosierPrepPortal
            </a>
          </div>
          <div style={{ marginBottom: 12, color: theme.text }}>
            <strong>Issues/Bugs:</strong>{" "}
            <a
              href="https://github.com/banknich-MSIS/HoosierPrepPortal/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.crimson, textDecoration: "underline" }}
            >
              Submit an issue on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div
        style={{
          backgroundColor: theme.cardBg,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          padding: 24,
        }}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 20, color: theme.text }}>
          Frequently Asked Questions
        </h3>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                color: theme.text,
              }}
            >
              How do I create a practice exam?
            </h4>
            <p
              style={{
                margin: 0,
                color: theme.textSecondary,
                lineHeight: 1.6,
              }}
            >
              Use the <strong>Exam Generator</strong> to upload PDFs, Word docs,
              PowerPoint slides, or other study materials and configure settings
              to generate an exam instantly.
            </p>
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                color: theme.text,
              }}
            >
              What file types can I upload?
            </h4>
            <p
              style={{
                margin: 0,
                color: theme.textSecondary,
                lineHeight: 1.6,
              }}
            >
              The tool supports PDFs, Word documents (.docx), PowerPoint
              presentations (.pptx), images (with OCR), text files, Excel/CSV
              files, and more. Files are processed to extract text and generate
              questions automatically using AI.
            </p>
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                color: theme.text,
              }}
            >
              Where do I get a Gemini API key?
            </h4>
            <p
              style={{
                margin: 0,
                color: theme.textSecondary,
                lineHeight: 1.6,
              }}
            >
              Visit{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.crimson, textDecoration: "underline" }}
              >
                Google AI Studio
              </a>{" "}
              to get a free API key. Use a personal Google account (not IU
              school account) for best compatibility. The free tier provides 60
              requests/hour and 1M tokens/day.
            </p>
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                color: theme.text,
              }}
            >
              Can I submit an exam without answering all questions?
            </h4>
            <p
              style={{
                margin: 0,
                color: theme.textSecondary,
                lineHeight: 1.6,
              }}
            >
              Yes! You'll get a warning showing how many questions are
              unanswered, but you can proceed with submission. Unanswered
              questions will be marked as incorrect and clearly labeled as "No
              answer provided" in your results.
            </p>
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                color: theme.text,
              }}
            >
              How do I backup or transfer my data?
            </h4>
            <p
              style={{
                margin: 0,
                color: theme.textSecondary,
                lineHeight: 1.6,
              }}
            >
              Go to Utilities → Backup & Restore. Create a backup to download
              all your study materials, exams, and performance history as a JSON
              file. You can restore this backup on another computer or after
              reinstalling the tool.
            </p>
          </div>
          <div>
            <h4
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                color: theme.text,
              }}
            >
              Common errors and solutions
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                color: theme.textSecondary,
                lineHeight: 1.6,
              }}
            >
              <li>
                <strong>"Invalid API key":</strong> Trim whitespace from your
                key, ensure the API is enabled in Google AI Studio, and use a
                personal Google account (not school account).
              </li>
              <li>
                <strong>"Network Error":</strong> Ensure the backend server is
                running (run start.ps1 from the StudyTool folder).
              </li>
              <li>
                <strong>"Could not extract content":</strong> Upload files with
                selectable text (not scanned images). For images, ensure text is
                clear and readable for OCR.
              </li>
              <li>
                <strong>"File too large":</strong> Keep files under 10MB. For
                large PDFs, consider splitting into chapters.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
