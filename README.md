# Hoosier Prep Portal

An AI-powered study tool that transforms your course materials into personalized practice exams and quizzes. Built for students who want active learning, progress tracking, and real mastery — not just AI-generated summaries.

---

## Why Use This Tool?

This tool transforms studying into an **active, focused process** — not a passive scroll through notes. Unlike Gemini Canvas or similar AI study modes, it's built for **personal mastery**, not just AI convenience. You can generate quizzes and exams directly from your materials, track your progress over time, and identify weak spots with clear analytics.

Everything runs **locally** for full control and privacy — no data harvesting, no distractions, no subscription walls. It's designed for students who want **depth over flash** and a study experience that actually improves recall and understanding instead of automating it away.

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

### 🎓 Flexible Exam Modes

- **Exam Mode**: Timed, full exam experience with submission for grading
- **Practice Mode**: Untimed practice with instant feedback
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

1. **Clone the repository**
```bash
git clone https://github.com/banknich-MSIS/HoosierPrepPortal.git
cd HoosierPrepPortal/StudyTool
```

2. **Run the setup script**
```powershell
.\start.ps1
```

The script will:
- Create Python virtual environment
- Install all dependencies (backend and frontend)
- Start both servers
- Open the app in your browser at `http://127.0.0.1:5173`

3. **Optional: Create desktop shortcut**
```powershell
.\create_shortcut.ps1
```

### Manual Setup

See [SETUP.md](StudyTool/SETUP.md) for detailed manual installation instructions.

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

## Development Philosophy

This tool was built with a few core principles:

1. **Active Learning Over Passive Consumption** - Testing yourself is proven to improve retention better than re-reading notes
2. **Student Privacy & Control** - Your data stays local. No tracking, no analytics harvesting
3. **Depth Over Flash** - Focus on understanding, not just getting quick answers
4. **Practical AI Integration** - AI enhances the experience but doesn't replace the learning process
5. **Open Source & Accessible** - Free to use, modify, and learn from

---

## Unique Capabilities

While you could ask ChatGPT or Gemini to "generate 10 quiz questions," this tool offers:

✅ **Persistent Progress Tracking** - All your attempts are saved with detailed analytics  
✅ **Structured Testing Environment** - Mimics real exam conditions, not just a chat  
✅ **Multi-File Context** - Processes entire textbooks, lecture slides, and notes together  
✅ **Customizable Difficulty** - Adaptive question generation based on your skill level  
✅ **Performance Analytics** - See your weak areas and track improvement over time  
✅ **Flexible Workflows** - Choose between fast generation or guided AI assistance  
✅ **Data Portability** - Backup and restore your entire study history  
✅ **No Vendor Lock-in** - Runs locally with your own API key  

---

## Contributing

Contributions are welcome! This is an open-source project built for students by students. Feel free to:

- Report bugs or request features via [GitHub Issues](https://github.com/banknich-MSIS/HoosierPrepPortal/issues)
- Submit pull requests with improvements
- Share feedback and suggestions

---

## Support

For questions, issues, or feedback:
- **Email**: banknich@iu.edu
- **GitHub Issues**: [Submit an issue](https://github.com/banknich-MSIS/HoosierPrepPortal/issues)

---

## License

This project is open source and available for educational use.

---

## Acknowledgments

Built at Indiana University as a tool to help students study more effectively using AI. Special thanks to the open-source community and everyone who contributed feedback during development.

---

**Happy studying! 📚**

