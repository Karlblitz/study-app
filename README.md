# Studyspace — Personal Study Planner

Studyspace is a responsive React app for organizing lectures, planning study sessions, taking quizzes, and tracking progress. It is designed as a beginner-friendly, local-first project: lecture data and study activity are stored in the browser rather than on a server.

## Features

- **Dashboard:** view study progress, today's sessions, upcoming sessions, and shortcuts.
- **Lecture library:** add subjects, lecture titles, descriptions, notes, transcripts, and study files; search and filter lectures.
- **Lecture viewer:** read saved PDFs, play saved MP4s, embed YouTube videos, and download supported files.
- **Study checklist:** mark lectures as studied or needing review, grouped by subject.
- **Study schedule:** add, edit, delete, and complete sessions.
- **Quizzes:** take unlimited attempts and review attempt history and scores.
- **Progress:** see completion by subject, quiz average, and highest score.
- **Sign-in screen:** create a local profile and choose whether to stay signed in on this device. Google Identity Services can be enabled with an OAuth client ID.

## Requirements

- Node.js and npm
- A modern browser

The project uses React, Vite, PDF.js, Mammoth, and JSZip. There is no database or required backend.

## Run locally

Open a terminal in this folder and run:

```powershell
npm install
npm run dev
```

Open the local URL shown in the terminal, usually `http://localhost:5173`.

If PowerShell blocks `npm.ps1`, use the Windows command wrapper:

```powershell
npm.cmd install
npm.cmd run dev
```

To create a production build:

```powershell
npm.cmd run build
```

## Sign-in and data storage

Sign-up uses a name, email, and password; login checks that local account. Passwords are salted and hashed with the browser Web Crypto API instead of being stored as plain text. **Yes, stay signed in** saves the profile to localStorage. **No, just for this session** keeps the profile only until the page is refreshed or closed.

Study data and local account records are stored in localStorage and remain in that browser on this device. Signing out does not delete lectures or progress. Clearing browser site data removes the saved app data. This version does not sync between devices or provide server-backed account security; browser-local login is suitable for a prototype, not sensitive data.

Google sign-in requires a Google OAuth Web client ID. Follow [LOGIN_SETUP.md](./LOGIN_SETUP.md) to configure it. Do not place a Google client secret in this frontend app. Production authentication requires a backend to verify Google credentials.

## Quizzes from lecture material

Built-in sample topics have 10 hand-written questions. For uploaded files, Studyspace can extract readable text from:

- PDF
- DOCX (Microsoft Word)
- PPTX (Microsoft PowerPoint)
- Plain text files

The app creates up to 15 fill-in-the-blank practice questions from sentences and terms found in the extracted text. This is a local, rule-based generator, not an AI model, so review generated questions for accuracy. Use **Customize questions (optional)** to add or remove questions. A quiz needs at least 10 questions and supports up to 20.

Older `.doc` and `.ppt` files are not parsed; convert them to `.docx` or `.pptx` first. A PDF that contains only scanned images may not have readable text unless it has OCR text embedded.

### Videos

MP4 files can be played in the lecture viewer. To make a quiz about a video, paste its transcript or captions in the lecture notes field. This version does not transcribe video audio or fetch YouTube captions automatically.

Files up to 3 MB are saved for in-app preview. Larger files can be read for quiz generation when supported, but the file itself is not retained for preview after upload. Browser localStorage has limited capacity, so avoid adding many large files.

## Project structure

```text
Study-App/
├── src/
│   ├── App.jsx                 # App pages and interactions
│   ├── App.css                 # Responsive styles
│   ├── contentExtraction.js    # PDF, DOCX, PPTX, and text extraction
│   ├── quizGenerator.js        # Local text-based quiz generation
│   ├── questions.js            # Built-in topic question sets
│   └── main.jsx                # React entry point
├── index.html
├── package.json
└── LOGIN_SETUP.md
```

## Extending the app

- Add or edit built-in topic questions in `src/questions.js`.
- Add extraction support in `src/contentExtraction.js`.
- Improve generated questions in `src/quizGenerator.js`.
- The current app has no AI API integration. Adding AI-based quiz generation would require an AI service and a backend to keep credentials private and handle lecture content securely.
