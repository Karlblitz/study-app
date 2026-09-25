# Studyspace — Personal Study Planner

Studyspace is a responsive React app for organizing lectures, planning study sessions, taking quizzes, and tracking progress. It is designed as a beginner-friendly, local-first project: lecture data and study activity are stored in the browser rather than on a server.

## Features

- **Dashboard:** view study progress, today's sessions, upcoming sessions, and shortcuts.
- **Lecture library:** add subjects, lecture titles, descriptions, notes, transcripts, and study files; search and filter lectures.
- **Lecture viewer:** read saved PDFs, play saved MP4s, embed YouTube videos, and download supported files.
- **Lecture summaries:** optionally send saved notes, supported video files, or public YouTube links to Gemini and show generated study notes in the lecture viewer.
- **Study checklist:** mark lectures as studied or needing review, grouped by subject.
- **Study schedule:** add, edit, delete, and complete sessions.
- **Quizzes:** take unlimited attempts and review attempt history and scores.
- **Progress:** see completion by subject, quiz average, and highest score.
- **Sign-in screen:** create a local profile and choose whether to stay signed in on this device. Google Identity Services can be enabled with an OAuth client ID.

## Requirements

- Node.js and npm
- A modern browser
- Optional: Python 3 and a Gemini API key to use AI summaries

The frontend uses React, Vite, PDF.js, Mammoth, and JSZip. Gemini summaries use an optional local Python service; the rest of the app works without it.

## Run locally

Open a terminal in this folder and run:

```powershell
npm install
npm run dev
```

Open the local URL shown in the terminal, usually `http://localhost:5173`.

### Summarize lecture notes with Gemini

The **Summarize notes** button sends the lecture text or video to Gemini only when you click it. For an uploaded video, Gemini uses its audio and visuals to create study notes. Public YouTube links can also be summarized. The API key stays in the local Python service and is not included in the React app. Uploaded videos are deleted from Gemini after the request completes.

In a second PowerShell terminal, from the `Study-App` folder, create the Python environment and install the SDK:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Set your Gemini API key in that terminal and start the summary service:

```powershell
$env:GEMINI_API_KEY = "your-api-key"
.\.venv\Scripts\python.exe backend\server.py
```

Keep that terminal running while using the app. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey). If Python is not installed, install Python 3 first. The summary endpoint uses the Google GenAI Python SDK and the Gemini 3.5 Flash-Lite model.

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

Video summaries support MP4, MPEG, MPG, MOV, AVI, FLV, WebM, WMV, and 3GPP uploads up to 3 MB, plus public YouTube links. Private or unlisted YouTube videos are not available to Gemini. Video summaries use audio and visual content to create study notes; the app does not produce a verbatim transcript. Those notes are saved with the lecture and can be used to build a related quiz. Larger videos can be compressed or you can paste captions or a transcript into the lecture notes field.

Files up to 3 MB are saved for in-app preview. Larger files can be read for quiz generation when supported, but the file itself is not retained for preview after upload. Browser localStorage has limited capacity, so avoid adding many large files.

## Project structure

```text
Study-App/
├── backend/
│   ├── server.py                 # Local Gemini notes-summary endpoint
│   └── requirements.txt          # Python SDK dependency
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
- Gemini summaries are generated by the optional Python service in `backend/server.py`. Keep its API key in the service process environment, never in a `VITE_` variable or frontend source.
