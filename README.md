# Studyspace — Personal Study Planner

Studyspace is a responsive React app for organizing lecture materials, planning study sessions, taking quizzes, and tracking progress. Firebase Authentication and Cloud Firestore store each signed-in user's study data in that user's UID-scoped records.

## Features

- **Dashboard:** review study progress, today’s sessions, upcoming sessions, and shortcuts.
- **Lecture library:** add and filter lectures with descriptions, notes, transcripts, and supported study files.
- **Lecture viewer:** view PDFs and extracted text, play supported saved video files, and embed YouTube videos. The viewer includes preview-size controls.
- **AI study tools (optional):** use Gemini to summarize lecture notes and generate quizzes grounded in lecture content.
- **Study checklist:** mark lectures as studied and group them by subject.
- **Study schedule:** add, edit, delete, and complete study sessions.
- **Quizzes:** generate a default five-question quiz immediately, optionally customize the question count, type, difficulty, and explanations, reopen saved quizzes, review mistakes, and view attempt history.
- **Progress dashboard:** track completed lectures, quiz averages, personal bests, and subject or topic progress.
- **Math summaries:** render inline equations in generated summaries.
- **Responsive layout:** the main study tools reflow for narrow mobile screens and wide desktop screens.
- **Sign-in screen:** Firebase Email/Password and Google sign-in.

## Requirements

- Node.js and npm
- A modern browser
- Optional for Gemini summaries and AI quiz generation: Python 3 and a Gemini API key

The frontend uses React and Vite, along with PDF.js, Mammoth, JSZip, and KaTeX. Gemini features use a local Python service. Saved quizzes, manual question editing, and other app features remain available without Python or an API key.

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

## Optional: enable Gemini summaries and quiz generation

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

4. Keep the Python service running while you use **Summarize notes** or **Generate Quiz Now**. The Vite dev server should also remain running in its own terminal.

The API key is read by the Python service and should not be added to React code, a `VITE_` variable, or a committed file. The service uses the `google-genai` Python SDK and defaults to the `gemini-3.5-flash-lite` model; you can override the model by setting `GEMINI_MODEL` before starting the service. Quiz generation sends lecture text and the selected settings to `/api/generate-quiz`, validates the response, and saves the complete question set to the signed-in user's Firestore `quizzes` collection.

If the Python service or Gemini is unavailable, quiz generation shows an error and does not launch an incomplete quiz. Reopen previously saved quizzes from the **Saved quizzes** section without another generation request.

### Summary source limits

- Text summaries accept up to 120,000 characters.
- Video uploads must use a supported format and be **3 MB or smaller**. Larger video files are not retained in the browser library or sent to Gemini; compress the clip or paste its captions/transcript into the notes field.
- Public YouTube links can be sent to Gemini. The app does not create a verbatim transcript. Private or unlisted videos may not be accessible.
- Uploaded video files are removed from Gemini after processing.

## Lecture files and quizzes

The app can extract readable text from PDF, DOCX (Word), PPTX (PowerPoint), and plain text files. Older `.doc` and `.ppt` files are not parsed; convert them to `.docx` or `.pptx`. Scanned PDFs need embedded OCR text for extraction. Quiz generation uses the lecture's saved text, extracted document text, or lecture-specific question bank as source material. Multiple-choice questions are checked for four distinct choices and an answer that matches one of them; incomplete or duplicate results are rejected rather than shown as a completed quiz.

Quick generation defaults to five medium-difficulty multiple-choice questions with explanations. Optional settings allow 5, 10, 15, or 20 questions, multiple-choice, true/false, mixed, multi-select, or problem-solving types, Easy/Medium/Hard difficulty, and explanations on or off. Use **Edit question bank** to manually add or remove questions.

Files up to 3 MB can be retained for an in-app preview. Larger non-video documents may still have text extracted, but the original file itself is not saved for preview. Browser storage is limited, so avoid adding many large files.

## Sign-in and data storage

Copy `.env.example` to `.env.local`, fill in the Firebase Web App configuration values, and restart Vite. In Firebase Console, enable Email/Password and Google under **Authentication → Sign-in method**, create a Firestore database, and publish [firestore.rules](./firestore.rules). The frontend uses Firebase's modular JavaScript SDK; no Admin SDK or service-account key belongs in the browser.

Data is stored at `users/{uid}/lectures/{lectureId}`, `users/{uid}/sessions/{sessionId}`, `users/{uid}/quizzes/{quizId}`, `users/{uid}/quizAttempts/{attemptId}`, and `users/{uid}/profile/preferences`. Checklist completion is the `studied` field on each lecture; dashboard and progress summaries are calculated from the lectures and quiz attempts. Firestore listeners keep the UI current when the signed-in user's data changes.

Uploaded file names and types, extracted lecture text, and manually edited question banks are stored with the lecture. Generated quiz records include the complete configured questions, answer choices, answers, hints, and explanations in the user's `quizzes` collection. Original file bytes are not uploaded to Firestore: local preview data remains on the current browser/device, so reattach a file on another device if you need to preview or download it there. Existing local account and study-data entries are left untouched and are not automatically imported into Firebase. Legacy local accounts must register again with Firebase Authentication.

See [LOGIN_SETUP.md](./LOGIN_SETUP.md) for configuration, rules publishing, and an end-to-end save/reload test. The rules file restricts reads and writes to the authenticated UID, but database security is not verified until you publish the rules and test the setup in your Firebase project.

## Build for production

```powershell
npm.cmd run build
npm.cmd run preview
```

## Project structure

```text
Study-App/
├── backend/
│   ├── server.py              # Local Gemini summaries and quiz generation API
│   ├── quiz_generation.py     # Quiz prompt construction and response validation
│   └── test_quiz_generation.py # Quiz request and response tests
│   └── requirements.txt       # Python dependencies
├── src/
│   ├── App.jsx                # App pages and interactions
│   ├── auth.js                # Firebase Authentication operations
│   ├── firebase.js            # Firebase app, Auth, and Firestore initialization
│   ├── firestore.js           # UID-scoped Firestore data services
│   ├── App.css                # App and responsive styles
│   ├── contentExtraction.js   # PDF, DOCX, PPTX, and text extraction
│   ├── quizGenerator.js       # Quiz settings, validation, navigation, and scoring helpers
│   ├── questions.js           # Built-in question sets
│   └── main.jsx               # React entry point
├── index.html
├── firestore.rules            # UID-scoped Firestore access rules
├── package.json
└── LOGIN_SETUP.md
```

## Customize

- Edit built-in question sets in `src/questions.js`.
- Add document extraction support in `src/contentExtraction.js`.
- Update quiz response validation and prompts in `backend/quiz_generation.py`.
- Update the optional Gemini service endpoints in `backend/server.py`.
