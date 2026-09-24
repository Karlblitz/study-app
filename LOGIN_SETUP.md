# Sign-in setup

The app keeps accounts and study data in the browser for this beginner version. The email form creates a local profile and does not provide password-based or secure multi-device authentication.

After sign-in, choose **Yes, stay signed in** to remember the profile on this device, or **No, just for this session** to sign out when the browser is refreshed or closed.

To enable Google Identity Services:

1. Create a Google OAuth **Web application** client in Google Cloud Console.
2. Add `http://localhost:5173` as an authorized JavaScript origin.
3. Copy `.env.example` to `.env.local` and replace its placeholder with the client ID.
4. Restart the Vite dev server.

The client ID is public configuration; never put a Google client secret in this frontend project. A production app should send the returned credential to a backend and verify it there. This prototype only reads the profile for a local browser session.

# Lecture quizzes

Built-in topic quizzes contain 10 questions. For other lectures, the app can extract text from PDF, DOCX, and PPTX files, then create 10–15 fill-in-the-blank practice questions from readable sentences in that material. This is a local text-based generator, not an AI model; customize the generated set or add questions with the optional button. Older DOC/PPT files should be converted to DOCX/PPTX first.

Video files and YouTube links need captions or a transcript pasted into the lecture notes field. This version does not transcribe audio or send lecture files to an AI service. The generator needs enough readable text to make at least 10 questions; otherwise it opens the question editor with any questions it could create so the set can be completed.
