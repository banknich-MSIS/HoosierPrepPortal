# Hoosier Prep Portal

A local AI-powered study tool that generates practice exams from your course materials. Upload PDFs, Word docs, slides, or notes, and get quizzes to help you prepare for exams.

---

## Why Use This Tool?

Use this tool to increase your studying effectiveness by generating the kinds of quizzes you'd see on exams. It helps you get familiar with the material, understand the proper answers, and overall prep you for your exams.

You can generate practice quizzes directly from your study materials, track your performance over time, and identify areas that need more work. Everything runs **locally** for full privacy and control — no data harvesting, no subscriptions, no tracking.

It's designed for students looking for a **no-nonsense, quick way** to generate practice exams and get studying done.

---

## Features

### 🎯 Two Ways to Generate Exams

- **Exam Generator**: Fast and streamlined. Upload PDFs, Word docs, PowerPoint slides, or other study materials, configure your settings, and generate instantly.
- **AI Assistant**: Interactive chat experience. Discuss your study goals with the AI, upload files during the conversation, and get guided through exam configuration.

### 📚 Smart File Processing

- Supports **multiple file formats**: PDF, DOCX, PPTX, images (OCR), text files, Excel/CSV
- Extracts text automatically and uses AI to generate relevant questions
- Handles up to 100 questions per exam with configurable difficulty levels

### 📊 Progress Tracking & Analytics

- Track performance over time across all your exams
- View detailed results for each attempt
- Identify weak areas and topics that need more review
- Export your performance data anytime

### 🎓 Flexible Testing Options

- **Exam Mode**: Full exam experience with submission for grading
- **Practice Mode**: One question at a time with instant feedback
- Multiple question types: Multiple Choice, True/False, Short Answer, Fill-in-the-Blank
- Submit partially completed exams (unanswered questions marked as incorrect)

### 🔧 Additional Features

- **Classes**: Organize your study materials by course or topic
- **Backup & Restore**: Export all your data to migrate between computers or keep safety copies
- **Dark Mode**: Easy on the eyes during late-night study sessions
- **Responsive Design**: Works seamlessly on desktop and tablet

---

## How It Works

1. **Set up your API key** - Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Upload your materials** - PDFs, slides, notes, or documents
3. **Configure your exam** - Choose question count (1-100), difficulty, and question types
4. **Take the exam** - Answer questions in Exam Mode or Practice Mode
5. **Review your results** - See what you got right/wrong and track your progress

The AI processes your uploaded materials, extracts key concepts, and generates questions that test your understanding of the content.

---

## Technology Stack

### Frontend
- **React + TypeScript** - Type-safe, component-based UI
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API communication

### Backend
- **FastAPI (Python)** - High-performance async API framework
- **SQLAlchemy** - ORM for database operations
- **SQLite** - Embedded database (no setup required)
- **Google Gemini API** - AI-powered question generation
- **PyPDF2, python-docx, python-pptx** - Document processing

### AI Integration
- **Gemini 1.5 Flash/Pro** - For conversational assistance and exam generation
- Intelligent file processing and content extraction
- Context-aware question generation with difficulty scaling

---

## Installation & Setup

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** and npm
- **Gemini API Key** (free from [Google AI Studio](https://aistudio.google.com/app/apikey))

### Quick Start

1. **Clone the repository** in the IDE of your choice:
```bash
git clone https://github.com/banknich-MSIS/HoosierPrepPortal.git
```

2. **Create the desktop shortcut** (Recommended):
```powershell
cd HoosierPrepPortal/StudyTool
.\create_shortcut.ps1
```

This creates a "Hoosier Prep Portal" shortcut on your desktop with a custom icon.

3. **Launch the tool**:
- Right-click the desktop shortcut → **"Run as Administrator"**
- The script will automatically:
  - Create Python virtual environment
  - Install all dependencies
  - Start backend and frontend servers
  - Open the app in your browser at `http://127.0.0.1:5173`

4. **Stopping the servers**:
- Press **Ctrl+C** in the PowerShell window
- Then run `.\stop.ps1` to properly close ports and clean up processes
- This prevents port conflicts on the next launch

### Alternative: Manual Launch

If you prefer not to create a shortcut, you can run `.\start.ps1` directly from the StudyTool folder. See [SETUP.md](StudyTool/SETUP.md) for detailed manual instructions.

---

## Usage

### Creating Your First Exam

**Option 1: Exam Generator (Fast)**
1. Navigate to "Exam Generator" from the sidebar
2. Upload your study materials
3. Configure settings (question count, difficulty, types)
4. Click "Generate Exam"
5. Start the exam from your Dashboard

**Option 2: AI Assistant (Guided)**
1. Navigate to "AI Assistant" from the sidebar
2. Chat with the AI about what you want to study
3. Upload files during the conversation
4. AI helps configure the exam based on your needs
5. Generate and take the exam from your Dashboard

### Taking Exams

- **Exam Mode**: Submit at the end for grading (like a real exam)
- **Practice Mode**: Get instant feedback question-by-question
- Navigate between questions using the sidebar
- Bookmark difficult questions for later review

### Viewing Results

- Review all your attempts from the Dashboard
- See detailed breakdowns of correct/incorrect answers
- Track performance trends over time
- Override individual question grades if needed

---

## Project Structure

```
StudyTool/
├── server/              # Python FastAPI backend
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic (AI, file processing)
│   ├── models.py        # Database models
│   └── main.py          # App entry point
├── web/                 # React frontend
│   ├── src/
│   │   ├── pages/       # Page components
│   │   ├── components/  # Reusable UI components
│   │   ├── api/         # API client
│   │   └── store/       # State management
│   └── vite.config.ts
├── start.ps1            # Startup script
└── stop.ps1             # Shutdown script
```

---

## What Makes This Different

This tool offers more than just asking an AI to generate questions:

- **Saved Progress** - All your attempts are stored with detailed results
- **Structured Testing** - Dedicated exam interface with question navigation
- **Multi-File Processing** - Upload entire textbooks, slides, and notes together
- **Performance Tracking** - See which topics you're struggling with
- **Local & Private** - Your data stays on your computer
- **Flexible Generation** - Fast mode or guided AI chat
- **Backup/Restore** - Transfer your data between computers  

---

## Feedback & Bug Reports

Found a bug or have a suggestion? Feel free to:

- Report issues via [GitHub Issues](https://github.com/banknich-MSIS/HoosierPrepPortal/issues)
- Share feedback and suggestions

---

## Support

For questions, issues, or feedback:
- **Email**: banknich@iu.edu
- **GitHub Issues**: [Submit an issue](https://github.com/banknich-MSIS/HoosierPrepPortal/issues)

---

## Acknowledgments

Built at Indiana University as a tool to help students study more effectively using AI. Special thanks to Jay Newquist and everyone who contributed feedback during development.

---

**Happy studying! 📚**

