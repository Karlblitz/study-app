# Firebase sign-in and cloud data setup

The app uses Firebase Authentication for account identity and Cloud Firestore for user data. Existing local accounts and study records remain in browser storage and are not imported automatically. Users must register a Firebase account; local password hashes cannot be converted into Firebase credentials.

## Configure the Firebase web app

1. In Firebase Console, create or select a project and register a **Web app**.
2. Copy the web app's configuration values into a local `.env.local` file based on `.env.example`:

   ```dotenv
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**. Add your development and production hostnames under **Authentication → Settings → Authorized domains**.
4. Create a **Cloud Firestore** database.
5. Open **Firestore Database → Rules**, replace the editor contents with [`firestore.rules`](./firestore.rules), and click **Publish**.
6. Restart the Vite development server after changing `.env.local`.

These Firebase Web App values are client configuration, not service-account credentials. Do not put a Google client secret, Firebase Admin SDK key, or service-account JSON in the frontend or `.env.local`.

## Enable profile background uploads

Profile banners use Firebase Storage separately from Firestore. In **Firebase Console → Databases & Storage → Storage**, create or select the project's bucket and copy its exact bucket name into `VITE_FIREBASE_STORAGE_BUCKET` in `.env.local`. Bucket names may end in `.firebasestorage.app` or `.appspot.com`; use the name shown in that project's Storage page.

Open the bucket's **Rules** tab and publish the profile-background rules from [`storage.rules`](./storage.rules). If the project already has Storage rules for other data, merge the `match /users/{userId}/profile/backgrounds/{fileName}` block into the existing rules instead of replacing them. The rules only allow an authenticated user to access files under their own UID. Restart Vite after changing the bucket setting, then sign out and back in before trying the upload again.

If the save reports `storage/unauthorized`, the deployed rules or signed-in account do not match the configured Firebase project. If it reports `storage/bucket-not-found`, check that the bucket exists and that its exact name is configured. New default Storage buckets may also require the Firebase project's billing plan to be upgraded; check the Storage setup prompt in Firebase Console.

## Configure Cloudinary profile pictures

Set `VITE_CLOUDINARY_CLOUD_NAME` in `.env.local` to the Cloudinary cloud name. `VITE_CLOUDINARY_UPLOAD_PRESET` defaults to `studyspace_avatars`. In Cloudinary, create an **unsigned** image upload preset with that name, restrict allowed formats to JPG, JPEG, PNG, and WebP, set the maximum file size to 2 MB, and apply a centered `c_fill` 256 × 256 incoming transformation. The app also crops selected images to 256 × 256 before upload and requests `f_auto,q_auto` for delivery.

Unsigned presets are public and can be used outside this app. Keep the preset restricted by format, file size, and transformation; never add the Cloudinary API Secret to frontend environment variables. The app requires Firebase Authentication before it sends an upload and writes `photoURL` plus `photoPublicId` into the existing UID-protected profile document. Removing a photo clears those Firestore fields but does not delete the Cloudinary asset; deleting old assets should be handled by a trusted backend using a server-side secret.

## Firestore layout

- `users/{uid}/lectures/{lectureId}` — lecture fields, checklist completion, resource name/type metadata, notes, and question sets.
- `users/{uid}/sessions/{sessionId}` — scheduled study sessions and completion status.
- `users/{uid}/quizzes/{quizId}` — complete saved quiz settings and question arrays, including choices, answers, hints, and explanations.
- `users/{uid}/quizAttempts/{attemptId}` — score, duration, lecture/topic, date, difficulty, and question type.
- `users/{uid}/profile/preferences` — profile details, display name, theme, and time format.

Study progress is calculated from the lecture and quiz-attempt records. Original upload bytes are not stored in Firestore; a selected file's preview is cached only in that browser, while metadata and extracted text sync through Firestore.

## Verify saving and retrieval

1. Start the app with `npm.cmd run dev`, register a Firebase account, and choose **Yes, stay signed in**.
2. Add a lecture and a study session, mark a lecture studied, and complete a quiz.
3. In Firebase Console, inspect the signed-in user's UID under **Firestore Database → Data** and confirm the corresponding lecture, session, quiz-attempt, and profile documents exist.
4. Refresh the page. Confirm the records load again and the interface reflects the saved completion/progress state.
5. Sign in to the same Firebase account in another browser/device. Confirm the same records appear. File previews are local-only; reattach their files on that device if needed.
6. Sign in as a different Firebase user and confirm those records are not visible.

If Firestore rejects reads or writes, verify that the published rules match [`firestore.rules`](./firestore.rules), both Authentication providers are enabled, and the app's Firebase project values belong to the same project. Do not treat the data as protected until the rules are published and these tests pass.

## Sign-in persistence

After sign-in, **Yes, stay signed in** selects browser-local Firebase Auth persistence. **No, just for this session** selects browser-session persistence. Signing out does not delete Firestore records.

# Lecture quizzes

**Generate Quiz Now** immediately requests five medium-difficulty multiple-choice questions with explanations. **Customize Quiz** optionally selects 5, 10, 15, or 20 questions, question type, difficulty, and whether explanations are included. Both actions use the same Gemini endpoint and require readable lecture text; supported PDF, DOCX, PPTX, and text files are extracted in the browser. Saved quiz records include every question and answer choice and can be reopened from the Quizzes page without another AI request.

To generate quizzes, start the local Python Gemini service using the instructions in the README and set `GEMINI_API_KEY` in that service's terminal. The key is never sent to the browser. Video uploads and YouTube links need captions, a transcript, or a summary in the lecture notes; the quiz endpoint does not transcribe audio or process video. If Gemini returns an incomplete or invalid set, the app shows an error instead of launching a short quiz. Older DOC/PPT files should be converted to DOCX/PPTX first.
