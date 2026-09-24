import { useEffect, useMemo, useRef, useState } from "react";
import questionSets from "./questions.js";
import { extractLectureText } from "./contentExtraction.js";
import { generateQuestionsFromText } from "./quizGenerator.js";

const seedLectures = [
  { id: "l1", subject: "Microbiology", title: "Antimicrobial Susceptibility Testing", description: "Disk diffusion, MIC, and interpretation of susceptibility results.", studied: true, dateAdded: "2026-09-23", fileName: "", fileType: "", fileData: "", questions: questionSets["Antimicrobial Susceptibility Testing"] },
  { id: "l2", subject: "Clinical Chemistry", title: "Liver Function Tests", description: "Markers of liver injury, cholestasis, and synthetic function.", studied: true, dateAdded: "2026-09-22", fileName: "", fileType: "", fileData: "", questions: questionSets["Liver Function Tests"] },
  { id: "l3", subject: "Hematology", title: "RBC Morphology", description: "Recognizing red cell size, shape, and color changes.", studied: false, dateAdded: "2026-09-21", fileName: "", fileType: "", fileData: "", questions: questionSets["RBC Morphology"] },
  { id: "l4", subject: "Microbiology", title: "Culture Media", description: "Common media and the organisms they help identify.", studied: false, dateAdded: "2026-09-20", fileName: "", fileType: "", fileData: "", questions: questionSets["Culture Media"] },
  { id: "l5", subject: "Immunology", title: "Antigen and Antibody Reactions", description: "A review of binding, agglutination, and precipitation.", studied: false, dateAdded: "2026-09-19", fileName: "", fileType: "", fileData: "", questions: questionSets["Antigen and Antibody Reactions"] },
];
const today = () => new Date().toISOString().slice(0, 10);
const initialSessions = [
  { id: "s1", subject: "Microbiology", topic: "Antimicrobial Susceptibility Testing", date: today(), start: "09:00", end: "10:00", notes: "Review disk diffusion and MIC", completed: false },
  { id: "s2", subject: "Clinical Chemistry", topic: "Liver Function Tests", date: today(), start: "14:00", end: "15:00", notes: "", completed: false },
  { id: "s3", subject: "Hematology", topic: "RBC Morphology", date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), start: "10:00", end: "11:00", notes: "", completed: false },
];
const navItems = [["home", "⌂", "Dashboard"], ["lectures", "▤", "My Lectures"], ["checklist", "✓", "Study Checklist"], ["schedule", "▦", "Study Schedule"], ["quizzes", "▧", "Quizzes"], ["progress", "◔", "Progress"]];
const readStore = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
const fmtDate = (date, options = { month: "long", day: "numeric", year: "numeric" }) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
const fmtTime = (time) => { if (!time) return ""; const [h, m] = time.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
const percent = (num, den) => den ? Math.round((num / den) * 100) : 0;
function getLectureQuestions(lecture) {
  if ((lecture.quizSource === "custom" || lecture.quizSource === "generated") && lecture.questions?.length) return lecture.questions;
  if (questionSets[lecture.title]) return questionSets[lecture.title];
  if (/\b(conic|conics|ellipse|ellipses|hyperbola|hyperbolas|parabola|parabolas)\b/i.test(lecture.title)) return questionSets["Equations of Conic- Quarter 1_Module 5"];
  return [];
}

function App() {
  const [profile, setProfile] = useState(() => readStore("studyspace-profile", null));
  const [authChoice, setAuthChoice] = useState(null);
  const [page, setPage] = useState("home");
  const [lectures, setLectures] = useState(() => readStore("studyspace-lectures", seedLectures));
  const [sessions, setSessions] = useState(() => readStore("studyspace-sessions", initialSessions));
  const [attempts, setAttempts] = useState(() => readStore("studyspace-attempts", []));
  const [search, setSearch] = useState("");
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [generatingLectureId, setGeneratingLectureId] = useState(null);
  const googleButton = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  useEffect(() => { localStorage.setItem("studyspace-lectures", JSON.stringify(lectures)); }, [lectures]);
  useEffect(() => { localStorage.setItem("studyspace-sessions", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem("studyspace-attempts", JSON.stringify(attempts)); }, [attempts]);
  useEffect(() => {
    if (!googleClientId || !googleButton.current) return;
    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !googleButton.current || googleButton.current.dataset.rendered) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          try {
            const encoded = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
            const payload = JSON.parse(new TextDecoder().decode(bytes));
            login(payload.name || "Student", payload.email || "", "google");
          } catch { notify("Google sign-in could not read the account response"); }
        },
      });
      window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320 });
      googleButton.current.dataset.rendered = "true";
    };
    if (window.google?.accounts?.id) { renderGoogleButton(); return; }
    let script = document.querySelector("script[data-studyspace-google]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.dataset.studyspaceGoogle = "true";
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderGoogleButton);
    return () => script.removeEventListener("load", renderGoogleButton);
  }, [googleClientId, profile]);
  const studied = lectures.filter((lecture) => lecture.studied).length;
  const completion = percent(studied, lectures.length);
  const matchingLectures = useMemo(() => lectures.filter((lecture) => `${lecture.title} ${lecture.subject} ${lecture.description}`.toLowerCase().includes(search.toLowerCase())), [lectures, search]);
  const pageTitle = navItems.find(([id]) => id === page)?.[2] || "My Lectures";

  function notify(message) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function go(next) { setPage(next); setSelectedLecture(null); setQuizState(null); setMobileNav(false); }
  function toggleStudied(id) { setLectures((items) => items.map((item) => item.id === id ? { ...item, studied: !item.studied } : item)); }
  function saveLecture(form) {
    setLectures((items) => [{ ...form, id: crypto.randomUUID(), studied: false, dateAdded: today(), questions: [], quizSource: "none" }, ...items]);
    setPage("lectures"); notify("Lecture added to your library");
  }
  function saveSession(form) {
    setSessions((items) => [{ ...form, id: crypto.randomUUID(), completed: false }, ...items]);
    notify("Study session scheduled");
  }
  async function startQuiz(lecture) {
    let qs = getLectureQuestions(lecture);
    setSelectedLecture(lecture);
    if (qs.length < 10) {
      setGeneratingLectureId(lecture.id);
      try {
        let material = lecture.lectureContent || "";
        if (!material && lecture.fileData) {
          const file = await fetch(lecture.fileData).then((response) => response.blob());
          material = await extractLectureText(file, lecture.fileName, lecture.fileType);
        }
        qs = generateQuestionsFromText(material, lecture.title);
        const updated = { ...lecture, lectureContent: material.slice(0, 90000), questions: qs, quizSource: "generated" };
        setLectures((items) => items.map((item) => item.id === lecture.id ? updated : item));
        setSelectedLecture(updated);
        if (qs.length < 10) {
          setQuizState(null); setPage("quizSetup");
          notify(qs.length ? `Found ${qs.length} usable questions. Add a few to reach 10.` : "I couldn't find enough readable lecture text to build 10 questions. Add notes or a transcript.");
          return;
        }
      } catch (error) {
        notify(error.message || "Could not read this lecture file");
        setQuizState(null); setPage("quizSetup");
        return;
      } finally { setGeneratingLectureId(null); }
    }
    setQuizState({ questions: qs, index: 0, answers: [], done: false }); setPage("quizRun");
  }
  function saveCustomQuestions(questions) {
    const updated = { ...selectedLecture, questions, quizSource: "custom" };
    setLectures((items) => items.map((item) => item.id === updated.id ? updated : item));
    setSelectedLecture(updated);
    setQuizState({ questions, index: 0, answers: [], done: false }); setPage("quizRun");
  }
  function customizeQuiz(lecture) { setSelectedLecture(lecture); setQuizState(null); setPage("quizSetup"); }
  function login(name, email, source = "local") { setAuthChoice({ name, email, source }); }
  function finishLogin(staySignedIn) {
    if (!authChoice) return;
    if (staySignedIn) localStorage.setItem("studyspace-profile", JSON.stringify(authChoice));
    else localStorage.removeItem("studyspace-profile");
    setProfile(authChoice); setAuthChoice(null);
  }
  function logout() { localStorage.removeItem("studyspace-profile"); setProfile(null); go("home"); }
  function answerQuiz(answer) { setQuizState((state) => ({ ...state, answers: [...state.answers.slice(0, state.index), answer] })); }
  function advanceQuiz() {
    if (quizState.answers[quizState.index] == null) return;
    if (quizState.index + 1 < quizState.questions.length) setQuizState((state) => ({ ...state, index: state.index + 1 }));
    else {
      const score = quizState.questions.reduce((total, question, index) => total + (question.answer === quizState.answers[index] ? 1 : 0), 0);
      const attempt = { id: crypto.randomUUID(), lectureId: selectedLecture.id, title: selectedLecture.title, subject: selectedLecture.subject, score, total: quizState.questions.length, date: new Date().toISOString() };
      setAttempts((items) => [attempt, ...items]); setQuizState((state) => ({ ...state, done: true, score }));
    }
  }
  function retryQuiz() { startQuiz(selectedLecture); }
  function openLecture(lecture) { setSelectedLecture(lecture); setPage("viewer"); }
  function addToSchedule(lecture) { setPage("schedule"); setSelectedLecture(lecture); }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark">s<span>.</span></div><span>studyspace</span></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{navItems.map(([id, icon, label]) => <button key={id} className={`nav-link ${page === id || (id === "quizzes" && page === "quizRun") ? "active" : ""}`} onClick={() => go(id)}><span className="nav-icon">{icon}</span>{label}{id === "lectures" && <span className="nav-count">{lectures.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="study-tip"><span className="tip-icon">✦</span><strong>A little every day</strong><p>Small study sessions add up to big progress.</p><div className="tip-progress"><span style={{ width: `${completion}%` }} /></div><span className="tip-meta">{completion}% of your library covered</span></div><button className="profile profile-button" onClick={logout} title="Sign out"><div className="avatar">{(profile?.name || "S").slice(0, 1).toUpperCase()}</div><div><strong>{profile?.name || "Student"}</strong><span>Sign out</span></div><span className="profile-dots">↗</span></button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle menu">☰</button><div className="breadcrumbs">Workspace <span>/</span> <strong>{pageTitle}</strong></div><div className="top-actions"><span className="date-chip">◷ &nbsp;{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span><div className="top-avatar">{(profile?.name || "S").slice(0, 1).toUpperCase()}</div></div></header>
      <div className="content">
        {page === "home" && <Dashboard lectures={lectures} sessions={sessions} completion={completion} studied={studied} onNavigate={go} onOpen={openLecture} onAdd={() => go("lectures")} />}
        {page === "lectures" && <LecturesPage lectures={matchingLectures} search={search} setSearch={setSearch} onOpen={openLecture} onToggle={toggleStudied} onQuiz={startQuiz} onAdd={saveLecture} />}
        {page === "checklist" && <Checklist lectures={lectures} studied={studied} completion={completion} onToggle={toggleStudied} />}
        {page === "schedule" && <SchedulePage sessions={sessions} lectures={lectures} onSave={saveSession} onChange={setSessions} selectedLecture={selectedLecture} clearSelected={() => setSelectedLecture(null)} />}
        {page === "viewer" && selectedLecture && <LectureViewer lecture={selectedLecture} onBack={() => go("lectures")} onToggle={() => toggleStudied(selectedLecture.id)} onSchedule={() => addToSchedule(selectedLecture)} onQuiz={() => startQuiz(selectedLecture)} />}
        {page === "quizRun" && quizState && <QuizRun state={quizState} lecture={selectedLecture} onAnswer={answerQuiz} onNext={advanceQuiz} onRetry={retryQuiz} onBack={() => go("quizzes")} />}
        {page === "quizSetup" && selectedLecture && <QuizSetup lecture={selectedLecture} onSave={saveCustomQuestions} onBack={() => go("quizzes")} />}
        {page === "quizzes" && <QuizHistory attempts={attempts} lectures={lectures} onQuiz={startQuiz} onCustomize={customizeQuiz} generatingLectureId={generatingLectureId} />}
        {page === "progress" && <ProgressPage lectures={lectures} attempts={attempts} studied={studied} completion={completion} />}
      </div>
    </main>
    {toast && <div className="toast">✓ &nbsp;{toast}</div>}
    {!profile && <LoginScreen googleClientId={googleClientId} googleButton={googleButton} authChoice={authChoice} onLogin={login} onFinish={finishLogin} />}
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, action }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subheading">{subtitle}</p></div>{action}</div>; }
function ProgressBar({ value, color = "green" }) { return <div className={`progress-bar ${color}`}><span style={{ width: `${value}%` }} /></div>; }
function Dashboard({ lectures, sessions, completion, studied, onNavigate, onOpen, onAdd }) {
  const hour = new Date().getHours(); const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todays = sessions.filter((s) => s.date === today()).sort((a, b) => a.start.localeCompare(b.start));
  const next = sessions.filter((s) => s.date > today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  return <><PageHeading eyebrow="TUESDAY, SEPTEMBER 24" title={`${greeting}, Student`} subtitle="Welcome back to your study space. One focused session at a time." action={<button className="button primary" onClick={onAdd}>＋ Add lecture</button>} />
    <div className="stats-grid"><Stat icon="▤" tint="lavender" label="In your library" value={lectures.length} foot="Study materials" /><Stat icon="✓" tint="mint" label="Studied so far" value={`${studied} / ${lectures.length}`} foot={`${completion}% of your lectures`} /><Stat icon="◷" tint="peach" label="Sessions today" value={todays.length} foot="Keep your rhythm" /><Stat icon="✧" tint="blue" label="Quiz attempts" value={lectures.length ? "Ready" : "—"} foot="Practice as often as you like" /> </div>
    <div className="dashboard-grid"><section className="panel focus-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR OVERVIEW</p><h2>Study progress</h2></div><button className="text-button" onClick={() => onNavigate("progress")}>See progress <span>→</span></button></div><div className="progress-overview"><div className="ring" style={{ "--progress": `${completion}%` }}><div><strong>{completion}%</strong><span>complete</span></div></div><div className="progress-copy"><strong>{studied} of {lectures.length} lectures studied</strong><p>You’re building a great habit. Keep going at your own pace.</p><ProgressBar value={completion} /><button className="button secondary small" onClick={() => onNavigate("checklist")}>Open checklist</button></div></div><div className="panel-divider"/><div className="panel-heading compact"><div><p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p><h2>Recently added</h2></div><button className="text-button" onClick={() => onNavigate("lectures")}>All lectures →</button></div><div className="recent-list">{lectures.slice(0, 3).map((lecture) => <button className="recent-row" key={lecture.id} onClick={() => onOpen(lecture)}><div className="subject-icon">{lecture.subject.slice(0, 1)}</div><div className="recent-info"><strong>{lecture.title}</strong><span>{lecture.subject} · {lecture.studied ? "Studied" : "Not studied"}</span></div><span className="row-arrow">↗</span></button>)}</div></section>
      <section className="panel schedule-panel"><div className="panel-heading"><div><p className="eyebrow">STAY ON TRACK</p><h2>Today’s schedule</h2></div><button className="icon-button" onClick={() => onNavigate("schedule")}>＋</button></div>{todays.length ? <div className="timeline">{todays.map((s) => <div className="timeline-row" key={s.id}><div className="timeline-time">{fmtTime(s.start)}</div><div className={`timeline-dot ${s.completed ? "done" : ""}`} /><div className="timeline-card"><div className="timeline-top"><strong>{s.subject}</strong><span className={`status ${s.completed ? "complete" : "upcoming"}`}>{s.completed ? "Completed" : "Upcoming"}</span></div><p>{s.topic}</p><span>{fmtTime(s.start)} – {fmtTime(s.end)}</span></div></div>)}</div> : <Empty text="No sessions planned for today." action="Add a study session" onClick={() => onNavigate("schedule")} />}<div className="upcoming-block"><div className="panel-heading compact"><div><p className="eyebrow">NEXT UP</p><h2>Coming soon</h2></div></div>{next.length ? next.map((s) => <div className="upcoming-row" key={s.id}><span className="upcoming-date">{new Date(`${s.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span><span><strong>{s.topic}</strong><small>{s.subject} · {fmtDate(s.date, { month: "short", day: "numeric" })}</small></span><span className="upcoming-arrow">→</span></div>) : <p className="muted small-text">Your calendar is clear. Plan a review session.</p>}</div></section></div>
    <section className="quick-actions"><div><p className="eyebrow">MAKE IT COUNT</p><h2>What would you like to do?</h2></div><div className="quick-grid"><QuickAction icon="▤" title="Add a lecture" subtitle="Save new study materials" onClick={onAdd} /><QuickAction icon="✓" title="Study checklist" subtitle="Check off a topic" onClick={() => onNavigate("checklist")} /><QuickAction icon="▦" title="Plan a session" subtitle="Make time to review" onClick={() => onNavigate("schedule")} /><QuickAction icon="✧" title="Take a quiz" subtitle="Practice your recall" onClick={() => onNavigate("quizzes")} /></div></section></>;
}
function Stat({ icon, tint, label, value, foot }) { return <div className="stat-card"><div className={`stat-icon ${tint}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-foot">{foot}</span></div>; }
function QuickAction({ icon, title, subtitle, onClick }) { return <button className="quick-action" onClick={onClick}><span className="quick-icon">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span><span className="row-arrow">↗</span></button>; }
function Empty({ text, action, onClick }) { return <div className="empty-state"><span>✦</span><p>{text}</p>{action && <button className="text-button" onClick={onClick}>{action} →</button>}</div>; }

function LoginScreen({ googleClientId, googleButton, authChoice, onLogin, onFinish }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  if (authChoice) return <div className="auth-overlay"><section className="auth-card stay-card"><div className="auth-brand"><div className="brand-mark">s<span>.</span></div><span>studyspace</span></div><p className="eyebrow">SIGN-IN PREFERENCE</p><h1>Stay signed in?</h1><p className="auth-intro">Keep your Studyspace profile signed in on this device, {authChoice.name}. You can sign out anytime from the profile menu.</p><button className="button primary auth-submit" onClick={() => onFinish(true)}>Yes, stay signed in</button><button className="button secondary auth-submit" onClick={() => onFinish(false)}>No, just for this session</button><p className="auth-local-note">If you choose session only, refreshing or closing this browser will sign you out.</p></section></div>;
  return <div className="auth-overlay"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">s<span>.</span></div><span>studyspace</span></div><p className="eyebrow">YOUR PERSONAL STUDY SPACE</p><h1>{mode === "signup" ? "Make room to grow." : "Welcome back."}</h1><p className="auth-intro">{mode === "signup" ? "Create a profile to keep your lectures, schedule, and progress together on this device." : "Sign in to continue to your study space on this device."}</p><form className="auth-form" onSubmit={(event) => { event.preventDefault(); onLogin(name.trim() || email.split("@")[0], email.trim()); }}>
    {mode === "signup" && <label>Your name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Student" /></label>}
    <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
    <button className="button primary auth-submit">{mode === "signup" ? "Create local profile" : "Continue"}</button>
  </form><div className="auth-divider"><span>or</span></div>{googleClientId ? <div ref={googleButton} className="google-button-slot" /> : <button className="google-placeholder" type="button" disabled><span className="google-g">G</span> Continue with Google <small>Set a Google client ID to enable</small></button>}<p className="auth-switch">{mode === "signup" ? "Already have a profile on this device?" : "New to Studyspace?"} <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Sign in" : "Create profile"}</button></p><p className="auth-local-note">This first version keeps profile and study data in this browser. The email form is a local profile, not password-protected authentication.</p></section></div>;
}

function QuizSetup({ lecture, onSave, onBack }) {
  const [questions, setQuestions] = useState(lecture.quizSource === "custom" ? lecture.questions || [] : getLectureQuestions(lecture));
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  function addQuestion(event) {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim());
    if (questions.length >= 20 || !question.trim() || cleanOptions.some((option) => !option)) return;
    setQuestions((items) => [...items, { question: question.trim(), options: cleanOptions, answer: cleanOptions[answerIndex] }]);
    setQuestion(""); setOptions(["", "", "", ""]); setAnswerIndex(0);
  }
  return <><button className="back-link" onClick={onBack}>← &nbsp;Back to quizzes</button><section className="panel quiz-setup"><p className="eyebrow">CUSTOMIZE THIS QUIZ · OPTIONAL</p><h1>{lecture.title}</h1><p className="subheading">Questions generated from this lecture are preloaded when readable text is available. Edit the set or add your own; quizzes need 10–20 questions.</p><form className="question-builder" onSubmit={addQuestion}><label>Question<textarea required rows="2" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Write a question from the lecture notes" /></label><div className="builder-options">{options.map((option, index) => <label key={index}>Choice {String.fromCharCode(65 + index)}<input required value={option} onChange={(event) => setOptions((items) => items.map((item, i) => i === index ? event.target.value : item))} placeholder={`Answer choice ${index + 1}`} /></label>)}</div><label>Correct answer<select value={answerIndex} onChange={(event) => setAnswerIndex(Number(event.target.value))}>{options.map((option, index) => <option key={index} value={index}>Choice {String.fromCharCode(65 + index)}{option.trim() ? ` — ${option}` : ""}</option>)}</select></label><button className="button secondary" disabled={questions.length >= 20}>＋ Add question</button></form><div className="builder-list"><div className="panel-heading"><h2>Your questions</h2><span>{questions.length} added</span></div>{questions.length ? questions.map((item, index) => <div className="builder-question" key={`${item.question}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.question}</strong><small>Correct answer: {item.answer}</small></div><button type="button" className="text-button delete-text" onClick={() => setQuestions((items) => items.filter((_, i) => i !== index))}>Remove</button></div>) : <p className="muted small-text">No questions yet. Add questions here, or provide more lecture text if generation could not find enough.</p>}</div><div className="form-actions"><button type="button" className="button secondary" onClick={onBack}>Cancel</button><button type="button" className="button primary" disabled={questions.length < 10 || questions.length > 20} onClick={() => onSave(questions)}>{questions.length < 10 ? `Add ${10 - questions.length} more for a 10-question quiz` : "Save & start quiz"}</button></div></section></>;
}

function LecturesPage({ lectures, search, setSearch, onOpen, onToggle, onQuiz, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const subjects = ["All", ...new Set(lectures.map((item) => item.subject))];
  const shown = filter === "All" ? lectures : lectures.filter((item) => item.subject === filter);
  function submit(form) { onAdd(form); setShowForm(false); }
  return <><PageHeading eyebrow="YOUR PERSONAL LIBRARY" title="My lectures" subtitle="Keep your notes, videos, and study resources all in one place." action={<button className="button primary" onClick={() => setShowForm(!showForm)}>{showForm ? "× Close" : "＋ Add lecture"}</button>} />
    {showForm && <LectureForm onSave={submit} onCancel={() => setShowForm(false)} />}
    <div className="library-toolbar"><label className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lectures, subjects, or topics..." /></label><div className="filter-chips">{subjects.map((item) => <button className={`filter-chip ${filter === item ? "selected" : ""}`} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
    {shown.length ? <div className="lecture-grid">{shown.map((lecture) => <LectureCard key={lecture.id} lecture={lecture} onOpen={onOpen} onToggle={onToggle} onQuiz={onQuiz} />)}</div> : <div className="panel empty-library"><span>▤</span><h2>No lectures found</h2><p>Try a different search or add a new study material.</p><button className="button secondary" onClick={() => setShowForm(true)}>＋ Add lecture</button></div>}</>;
}
function LectureCard({ lecture, onOpen, onToggle, onQuiz }) { return <article className="lecture-card"><div className="lecture-card-top"><div className="file-icon">{lecture.fileType?.includes("pdf") ? "PDF" : lecture.fileType?.startsWith("video") ? "▶" : "▤"}</div><span className={`status ${lecture.studied ? "complete" : "pending"}`}>{lecture.studied ? "✓ Studied" : "Not studied"}</span></div><span className="subject-label">{lecture.subject}</span><h3>{lecture.title}</h3><p className="lecture-desc">{lecture.description || "No description added yet."}</p><div className="lecture-meta">Added {fmtDate(lecture.dateAdded, { month: "short", day: "numeric" })}{lecture.fileName && <span> · {lecture.fileName}</span>}</div><div className="lecture-actions"><button className="button secondary small" onClick={() => onOpen(lecture)}>Open lecture</button><button className="icon-button" title="Take quiz" onClick={() => onQuiz(lecture)}>✧</button><button className="icon-button" title={lecture.studied ? "Mark as not studied" : "Mark as studied"} onClick={() => onToggle(lecture.id)}>{lecture.studied ? "✓" : "○"}</button></div></article>; }
function LectureForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ title: "", subject: "", description: "", lectureContent: "", fileName: "", fileType: "", fileData: "", youtubeUrl: "" }); const [busy, setBusy] = useState(false); const [extractMessage, setExtractMessage] = useState("");
  function set(key, value) { setForm((state) => ({ ...state, [key]: value })); }
  async function attach(file) {
    if (!file) return;
    set("fileName", file.name); set("fileType", file.type); setBusy(true); setExtractMessage("Reading lecture text…");
    const fileDataPromise = file.size <= 3 * 1024 * 1024 ? new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(""); reader.readAsDataURL(file); }) : Promise.resolve("");
    if (file.size > 3 * 1024 * 1024) setExtractMessage("File is over 3 MB; text can still be extracted, but the file itself will not be saved for preview.");
    if (file.type.startsWith("video/")) { set("fileData", await fileDataPromise); setExtractMessage("Video audio needs a transcript. Paste captions or transcript in the notes field below."); setBusy(false); return; }
    try {
      const [extracted, fileData] = await Promise.all([extractLectureText(file, file.name, file.type), fileDataPromise]);
      set("fileData", fileData);
      set("lectureContent", extracted.slice(0, 90000)); setExtractMessage(`Read ${extracted.length.toLocaleString()} characters from this file.`);
    } catch (error) { setExtractMessage(error.message || "Could not extract text; you can paste notes below."); }
    setBusy(false);
  }
  return <form className="panel form-panel" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, fileName: form.fileName || form.youtubeUrl, fileType: form.fileType || (form.youtubeUrl ? "video/youtube" : ""), fileData: form.fileData || "", lectureContent: form.lectureContent.trim() }); }}><div className="panel-heading"><div><p className="eyebrow">NEW MATERIAL</p><h2>Add a lecture</h2></div></div><div className="form-grid"><label>Lecture title<input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Kidney Function Tests" /></label><label>Subject<input required value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Clinical Chemistry" /></label><label className="wide">Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows="2" placeholder="A short note about what this lecture covers" /></label><label className="wide">Lecture notes or video transcript<textarea value={form.lectureContent} onChange={(e) => set("lectureContent", e.target.value)} rows="4" placeholder="File text is extracted here. For videos, paste captions or a transcript to generate related questions." /></label><label>YouTube URL<input type="url" value={form.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label><label className="upload-field">Study material <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.txt,video/mp4" onChange={(e) => attach(e.target.files?.[0])} /><small>{form.fileName ? `${form.fileName}${busy ? " · Reading file…" : ""}` : "PDF, DOCX, PPTX, text, or MP4 · Up to 3 MB for preview"}</small>{extractMessage && <small className="extract-message">{extractMessage}</small>}</label></div><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" disabled={busy}>Save lecture</button></div></form>;
}
function Checklist({ lectures, studied, completion, onToggle }) { const groups = [...new Set(lectures.map((l) => l.subject))]; return <><PageHeading eyebrow="A LITTLE PROGRESS ADDS UP" title="Study checklist" subtitle="Mark topics as you study them. You can always revisit one later." /><section className="panel checklist-overview"><div className="checklist-summary"><div><p className="eyebrow">OVERALL STUDY PROGRESS</p><h2>{studied} of {lectures.length} lectures studied</h2><p className="muted">{completion}% of your study library is complete</p></div><strong>{completion}%</strong></div><ProgressBar value={completion} /></section><div className="checklist-groups">{groups.map((subject) => { const items = lectures.filter((l) => l.subject === subject); const done = items.filter((l) => l.studied).length; return <section className="panel checklist-group" key={subject}><div className="check-group-title"><div className="subject-icon">{subject.slice(0, 1)}</div><div><h2>{subject}</h2><span>{done} of {items.length} completed</span></div><ProgressBar value={percent(done, items.length)} /></div>{items.map((lecture) => <label key={lecture.id} className={`check-item ${lecture.studied ? "checked" : ""}`}><input type="checkbox" checked={lecture.studied} onChange={() => onToggle(lecture.id)} /><span className="custom-check">✓</span><span>{lecture.title}</span><span className="check-date">Added {fmtDate(lecture.dateAdded, { month: "short", day: "numeric" })}</span></label>)}</section>; })}{!lectures.length && <Empty text="Add a lecture to start your checklist." />}</div></>; }

function SchedulePage({ sessions, lectures, onSave, onChange, selectedLecture, clearSelected }) {
  const [editing, setEditing] = useState(null); const [formOpen, setFormOpen] = useState(Boolean(selectedLecture));
  function save(form) { if (editing) onChange((items) => items.map((s) => s.id === editing.id ? { ...s, ...form } : s)); else onSave(form); setEditing(null); setFormOpen(false); clearSelected(); }
  function edit(s) { setEditing(s); setFormOpen(true); }
  function remove(id) { onChange((items) => items.filter((s) => s.id !== id)); }
  function toggle(id) { onChange((items) => items.map((s) => s.id === id ? { ...s, completed: !s.completed } : s)); }
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const todaySessions = sorted.filter((s) => s.date === today() && !s.completed); const upcoming = sorted.filter((s) => s.date > today() && !s.completed); const completed = sorted.filter((s) => s.completed);
  return <><PageHeading eyebrow="MAKE SPACE TO LEARN" title="Study schedule" subtitle="Plan your sessions, stay consistent, and celebrate each one you complete." action={<button className="button primary" onClick={() => { setEditing(null); setFormOpen(!formOpen); }}>＋ Add session</button>} />
    {formOpen && <ScheduleForm lectures={lectures} initial={editing || (selectedLecture ? { subject: selectedLecture.subject, topic: selectedLecture.title, date: today() } : null)} onSave={save} onCancel={() => { setFormOpen(false); setEditing(null); clearSelected(); }} />}
    <div className="schedule-columns"><div><ScheduleGroup title="TODAY" date={fmtDate(today())} sessions={todaySessions} onEdit={edit} onDelete={remove} onToggle={toggle} /><ScheduleGroup title="UPCOMING" sessions={upcoming} onEdit={edit} onDelete={remove} onToggle={toggle} /><ScheduleGroup title="COMPLETED" sessions={completed} onEdit={edit} onDelete={remove} onToggle={toggle} /></div><div className="schedule-side panel"><span className="calendar-icon">▦</span><p className="eyebrow">MAKE A PLAN</p><h2>Give your goals a time and place.</h2><p className="muted">A short, focused review can make a big difference. Add notes to remember what you want to cover.</p><button className="button secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>Plan a session</button><div className="side-stat"><strong>{completed.length}</strong><span>completed sessions</span></div></div></div>
  </>;
}
function ScheduleForm({ lectures, initial, onSave, onCancel }) { const [form, setForm] = useState({ subject: initial?.subject || "", topic: initial?.topic || "", date: initial?.date || today(), start: initial?.start || "19:00", end: initial?.end || "20:00", notes: initial?.notes || "" }); function set(k, v) { setForm((s) => ({ ...s, [k]: v })); } return <form className="panel form-panel" onSubmit={(e) => { e.preventDefault(); onSave(form); }}><div className="panel-heading"><div><p className="eyebrow">{initial?.id ? "UPDATE SESSION" : "MAKE TIME TO STUDY"}</p><h2>{initial?.id ? "Edit session" : "Add study session"}</h2></div></div><div className="form-grid"><label>Subject<input list="subjects" required value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Microbiology" /><datalist id="subjects">{[...new Set(lectures.map((l) => l.subject))].map((s) => <option key={s} value={s} />)}</datalist></label><label>Lecture or topic<input list="topics" required value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="What will you study?" /><datalist id="topics">{lectures.map((l) => <option key={l.id} value={l.title} />)}</datalist></label><label>Date<input required type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></label><div className="time-fields"><label>Start<input required type="time" value={form.start} onChange={(e) => set("start", e.target.value)} /></label><label>End<input required type="time" value={form.end} onChange={(e) => set("end", e.target.value)} /></label></div><label className="wide">Notes <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows="2" placeholder="Optional reminders for your session" /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary">{initial?.id ? "Save changes" : "Add to schedule"}</button></div></form>; }
function ScheduleGroup({ title, date, sessions, onEdit, onDelete, onToggle }) { return <section className="schedule-group"><div className="schedule-group-heading"><div><p className="eyebrow">{title}</p>{date && <h2>{date}</h2>}</div><span>{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span></div>{sessions.length ? sessions.map((s) => <article className={`panel session-card ${s.completed ? "session-done" : ""}`} key={s.id}><div className="session-time"><strong>{fmtTime(s.start)}</strong><span>{fmtTime(s.end)}</span></div><div className="session-info"><div className="session-header"><span className="subject-label">{s.subject}</span><span className={`status ${s.completed ? "complete" : "upcoming"}`}>{s.completed ? "Completed" : s.date === today() && new Date().toTimeString().slice(0, 5) >= s.start && new Date().toTimeString().slice(0, 5) <= s.end ? "In progress" : "Upcoming"}</span></div><h3>{s.topic}</h3>{s.notes && <p>{s.notes}</p>}{s.date !== today() && <small>{fmtDate(s.date)}</small>}<div className="session-actions"><button className="text-button" onClick={() => onToggle(s.id)}>{s.completed ? "↶ Mark upcoming" : "✓ Mark complete"}</button><button className="text-button" onClick={() => onEdit(s)}>Edit</button><button className="text-button delete-text" onClick={() => onDelete(s.id)}>Delete</button></div></div></article>) : <div className="panel schedule-empty"><span>◷</span><p>Nothing scheduled here yet.</p></div>}</section>; }

function LectureViewer({ lecture, onBack, onToggle, onSchedule, onQuiz }) { const youtube = lecture.fileName?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i); const src = youtube ? `https://www.youtube-nocookie.com/embed/${youtube[1]}` : lecture.fileData; return <><button className="back-link" onClick={onBack}>← &nbsp;Back to lectures</button><div className="viewer-heading"><div><p className="eyebrow">{lecture.subject}</p><h1>{lecture.title}</h1><p className="subheading">{lecture.description || "Study material"}</p></div><span className={`status ${lecture.studied ? "complete" : "pending"}`}>{lecture.studied ? "✓ Studied" : "Not studied"}</span></div><section className="panel viewer-panel">{src && lecture.fileType === "application/pdf" ? <iframe className="document-viewer" src={src} title={lecture.title} /> : youtube ? <iframe className="video-viewer" src={src} title={lecture.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : src && lecture.fileType.startsWith("video/") ? <video className="video-viewer" controls src={src} /> : <div className="file-preview"><span className="file-icon large">{lecture.fileName ? "▤" : "✦"}</span><h2>{lecture.fileName || "Your lecture notes"}</h2><p>{lecture.fileName ? "This file is ready to open or download." : "Use the description below as a starting point for your review."}</p>{lecture.fileData && <a className="button secondary" href={lecture.fileData} download={lecture.fileName}>Download file</a>}</div>}
      <div className="viewer-description"><p className="eyebrow">LECTURE NOTES</p><p>{lecture.description || "No description was added for this lecture."}</p>{lecture.fileName && !lecture.fileData && <p className="muted small-text">The file name is saved in your library. Reattach files up to 3 MB for an in-app preview; YouTube links can be pasted as the file URL when adding a lecture.</p>}</div></section><div className="viewer-actions"><button className="button primary" onClick={onToggle}>{lecture.studied ? "✓ Studied · Mark for review" : "✓ Mark as studied"}</button><button className="button secondary" onClick={onSchedule}>＋ Add to schedule</button><button className="button secondary" onClick={onQuiz}>✧ Quiz me</button></div></>; }

function QuizRun({ state, lecture, onAnswer, onNext, onRetry, onBack }) { const question = state.questions[state.index]; const selected = state.answers[state.index]; const correct = state.score || 0; return <><button className="back-link" onClick={onBack}>← &nbsp;Back to quizzes</button><div className="quiz-wrap panel">{state.done ? <div className="quiz-result"><div className="quiz-success">✓</div><p className="eyebrow">PRACTICE MAKES PROGRESS</p><h1>Quiz complete!</h1><p className="subheading">{lecture.title}</p><div className="score-circle"><strong>{percent(correct, state.questions.length)}%</strong><span>score</span></div><div className="score-details"><div><strong>{correct}</strong><span>Correct</span></div><div><strong>{state.questions.length - correct}</strong><span>Incorrect</span></div><div><strong>{correct}/{state.questions.length}</strong><span>Score</span></div></div><div className="quiz-result-actions"><button className="button primary" onClick={onRetry}>↻ Try again</button><button className="button secondary" onClick={onBack}>Back to quizzes</button></div></div> : <><div className="quiz-top"><div><p className="eyebrow">{lecture.subject}</p><h1>{lecture.title}</h1></div><span className="question-number">{String(state.index + 1).padStart(2, "0")} <span>/ {String(state.questions.length).padStart(2, "0")}</span></span></div><ProgressBar value={percent(state.index, state.questions.length)} /><p className="question-label">QUESTION {state.index + 1}</p><h2 className="quiz-question">{question.question}</h2><div className="quiz-options">{question.options.map((option, index) => <button key={option} className={`quiz-option ${selected === option ? "chosen" : ""}`} onClick={() => onAnswer(option)}><span>{String.fromCharCode(65 + index)}</span>{option}<i>{selected === option ? "✓" : ""}</i></button>)}</div><div className="quiz-footer"><span>{state.index + 1} of {state.questions.length} questions</span><button className="button primary" disabled={!selected} onClick={onNext}>{state.index + 1 === state.questions.length ? "Finish quiz" : "Next question →"}</button></div></>}</div></>; }
function QuizHistory({ attempts, lectures, onQuiz, onCustomize, generatingLectureId }) { return <><PageHeading eyebrow="PRACTICE, REFLECT, REPEAT" title="Quizzes" subtitle="Take a quick quiz and keep track of every attempt. There’s no limit." /><div className="quiz-start-grid">{lectures.map((lecture) => { const count = getLectureQuestions(lecture).length; const hasMaterial = Boolean(lecture.lectureContent || lecture.fileData); const busy = generatingLectureId === lecture.id; return <article className="panel quiz-start-card" key={lecture.id}><div className="quiz-card-icon">✧</div><span className="subject-label">{lecture.subject}</span><h2>{lecture.title}</h2><p>{count ? `${count} lecture-specific questions · Unlimited attempts` : hasMaterial ? "Generate questions from this lecture's content" : "Add notes or a transcript to generate a quiz"}</p><button className="button primary" disabled={busy} onClick={() => onQuiz(lecture)}>{busy ? "Generating…" : count ? "Start quiz" : hasMaterial ? "Generate quiz" : "Build quiz"} <span>{busy ? "…" : "→"}</span></button>{count > 0 && <button className="quiz-customize-button" onClick={() => onCustomize(lecture)}>Customize questions <span>(optional)</span></button>}</article>; })}</div><section className="panel history-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR PRACTICE LOG</p><h2>Quiz history <span className="pill-count">{attempts.length}</span></h2></div></div>{attempts.length ? <div className="history-table"><div className="history-head"><span>QUIZ</span><span>DATE</span><span>SCORE</span><span>RESULT</span></div>{attempts.map((a) => <div className="history-row" key={a.id}><div><strong>{a.title}</strong><small>{a.subject}</small></div><span>{new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><strong>{a.score}/{a.total}</strong><span className="result-pill">{percent(a.score, a.total)}%</span></div>)}</div> : <Empty text="Your quiz attempts will show up here." />}</section></>; }
function ProgressPage({ lectures, attempts, studied, completion }) { const scores = attempts.map((a) => percent(a.score, a.total)); const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0; const highest = scores.length ? Math.max(...scores) : 0; const subjects = [...new Set(lectures.map((l) => l.subject))]; return <><PageHeading eyebrow="NOTICE HOW FAR YOU'VE COME" title="Your progress" subtitle="A simple snapshot of your study habits and quiz practice." /><div className="stats-grid progress-stats"><Stat icon="✓" tint="mint" label="Study progress" value={`${studied} / ${lectures.length}`} foot={`${completion}% of lectures studied`} /><Stat icon="✧" tint="lavender" label="Quizzes taken" value={attempts.length} foot="Every attempt counts" /><Stat icon="↗" tint="peach" label="Average score" value={`${avg}%`} foot={attempts.length ? "Across all your attempts" : "Your first quiz is waiting"} /><Stat icon="★" tint="blue" label="Personal best" value={`${highest}%`} foot="Your highest quiz score" /></div><section className="panel subject-progress"><div className="panel-heading"><div><p className="eyebrow">ONE STEP AT A TIME</p><h2>Progress by subject</h2></div></div>{subjects.length ? subjects.map((subject, index) => { const group = lectures.filter((l) => l.subject === subject); const done = group.filter((l) => l.studied).length; const value = percent(done, group.length); return <div className="subject-progress-row" key={subject}><div className="subject-row-label"><div className={`subject-icon subject-color-${index % 4}`}>{subject.slice(0, 1)}</div><strong>{subject}</strong><span>{done} of {group.length} studied</span><b>{value}%</b></div><ProgressBar value={value} color={index % 2 ? "purple" : "green"} /></div>; }) : <Empty text="Add lectures to see progress by subject." />}</section><section className="panel study-insight"><span>✦</span><div><strong>Progress is built one session at a time.</strong><p>Keep checking off topics and revisiting quizzes to see your confidence grow.</p></div></section></>; }

export default App;
