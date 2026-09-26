# Studyspace — Personal Study Planner

Studyspace is a responsive React app for organizing lecture materials, planning study sessions, taking quizzes, and tracking progress. This is a local-first learning project: your profile, lectures, and study activity are saved in the browser on your device.

## Features

- **Dashboard:** review study progress, today’s sessions, upcoming sessions, and shortcuts.
- **Lecture library:** add and filter lectures with descriptions, notes, transcripts, and supported study files.
- **Lecture viewer:** view PDFs and extracted text, play supported saved video files, and embed YouTube videos. The viewer includes preview-size controls.
- **AI summaries (optional):** use Gemini to summarize lecture notes, supported uploaded video clips, or public YouTube videos.
- **Study checklist:** mark lectures as studied and group them by subject.
- **Study schedule:** add, edit, delete, and complete study sessions.
- **Quizzes:** set difficulty, question count, and question type; take quizzes, review mistakes, and view attempt history. Question creation is optional.
- **Progress dashboard:** track completed lectures, quiz averages, personal bests, and subject or topic progress.
- **Math summaries:** render inline equations in generated summaries.
- **Responsive layout:** the main study tools reflow for narrow mobile screens and wide desktop screens.
- **Sign-in screen:** create a local profile. Google Identity Services can be enabled with an OAuth client ID.

## Requirements

- Node.js and npm
- A modern browser
- Optional for Gemini summaries: Python 3 and a Gemini API key

The frontend uses React and Vite, along with PDF.js, Mammoth, JSZip, and KaTeX. Gemini summaries use a separate local Python service. Other app features work without Python or an API key.

## Run the app

Open PowerShell in the `Study-App` folder and run:

```powershell
npm install
npm run dev
```

Open the `Local` URL printed by Vite, usually `http://localhost:5173`. If port 5173 is already in use, Vite may select another port, such as 5174; use the URL shown in the terminal.

If PowerShell reports that `npm.ps1` cannot run because script execution is disabled, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

## Optional: enable Gemini summaries

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey). Keep the key private.
2. Open a **second** PowerShell window in the `Study-App` folder. Create a virtual environment and install the Python dependencies:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
   ```

3. In that same PowerShell window, set the key and start the summary service:

   ```powershell
   $env:GEMINI_API_KEY = "paste-your-api-key-here"
   .\.venv\Scripts\python.exe backend\server.py
   ```

4. Keep the Python service running while you use **Summarize notes** in the app. The Vite dev server should also remain running in its own terminal.

The API key is read by the Python service and should not be added to React code, a `VITE_` variable, or a committed file. The service uses the `google-genai` Python SDK and defaults to the `gemini-3.5-flash-lite` model; you can override the model by setting `GEMINI_MODEL` before starting the service.

### Summary source limits

- Text summaries accept up to 120,000 characters.
- Video uploads must use a supported format and be **3 MB or smaller**. Larger video files are not retained in the browser library or sent to Gemini; compress the clip or paste its captions/transcript into the notes field.
- Public YouTube links can be sent to Gemini. The app does not create a verbatim transcript. Private or unlisted videos may not be accessible.
- Uploaded video files are removed from Gemini after processing.

## Lecture files and quizzes

The app can extract readable text from PDF, DOCX (Word), PPTX (PowerPoint), and plain text files. Older `.doc` and `.ppt` files are not parsed; convert them to `.docx` or `.pptx`. Scanned PDFs need embedded OCR text for extraction.

Built-in sample topics include prepared questions. For supported lecture text, the app can also make practice questions locally using a rule-based generator. Generated questions may need editing, so review them before studying. The quiz setup supports 5, 10, or 20 questions when enough questions are available. Use the optional question editor to add or remove questions.

Files up to 3 MB can be retained for an in-app preview. Larger non-video documents may still have text extracted, but the original file itself is not saved for preview. Browser storage is limited, so avoid adding many large files.

## Sign-in and data storage

Sign-up uses a name, email, and password. Passwords are salted and hashed with the browser Web Crypto API. Choosing **Yes, stay signed in** saves the profile in localStorage; **No, just for this session** keeps it only until the page is refreshed or closed.

Lecture data, account records, and study activity are stored in localStorage in that browser on that device. Signing out does not delete study data. Clearing the browser’s site data removes it. This prototype does not sync data across devices and does not provide server-backed account security; do not use it for sensitive information.

To enable Google sign-in, follow [LOGIN_SETUP.md](./LOGIN_SETUP.md) and configure a Google OAuth Web client ID. Never put a Google client secret in the frontend. Production authentication requires a backend to verify Google credentials.

## Build for production

```powershell
npm.cmd run build
npm.cmd run preview
```

## Project structure

```text
Study-App/
├── backend/
│   ├── server.py              # Local Gemini summary service
│   └── requirements.txt       # Python dependencies
├── src/
│   ├── App.jsx                # App pages and interactions
│   ├── App.css                # App and responsive styles
│   ├── contentExtraction.js   # PDF, DOCX, PPTX, and text extraction
│   ├── quizGenerator.js       # Local question generation
│   ├── questions.js           # Built-in question sets
│   └── main.jsx               # React entry point
├── index.html
├── package.json
└── LOGIN_SETUP.md
```

## Customize

- Edit built-in question sets in `src/questions.js`.
- Add document extraction support in `src/contentExtraction.js`.
- Adjust generated questions in `src/quizGenerator.js`.
- Update the optional Gemini summary service in `backend/server.py`.
