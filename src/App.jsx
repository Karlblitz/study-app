import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import questionSets from "./questions.js";
import { extractLectureText } from "./contentExtraction.js";
import {
  DEFAULT_QUIZ_SETTINGS,
  getUniqueValidQuestions,
  getQuizProgress,
  getQuizQuestionIndex,
  scoreQuizQuestions,
  selectQuizQuestions,
  validateGeneratedQuiz,
  validateQuizSettings,
} from "./quizGenerator.js";
import {
  createFirebaseAccount,
  getAuthErrorMessage,
  setFirebasePersistence,
  signInFirebaseAccount,
  signInWithGoogle,
  signOutFirebaseUser,
  updateFirebaseDisplayName,
} from "./auth.js";
import { auth, firebaseConfigured, missingFirebaseConfig } from "./firebase.js";
import {
  createUserRecord,
  deleteUserRecord,
  saveUserProfile,
  subscribeToUserProfile,
  subscribeToUserRecords,
  updateUserRecord,
} from "./firestore.js";
import { onAuthStateChanged } from "firebase/auth";
import { Eye, EyeOff, FileText, FileVideo, X } from "lucide-react";
import { CalendarDays, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduleTimeField } from "./components/ScheduleTimeField.jsx";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";
import { ScoreTrendChart } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Plus } from "lucide-react";
const today = () => new Date().toISOString().slice(0, 10);
const navItems = [["home", "home", "Dashboard"], ["lectures", "▤", "My Lectures"], ["checklist", "✓", "Study Checklist"], ["schedule", "▦", "Study Schedule"], ["quizzes", "▧", "Quizzes"], ["progress", "◔", "Progress"]];

function WorkspaceSidebarNavigation({ page, lectures, navigate }) {
  const { setOpenMobile } = useSidebar();
  const handleNavigate = (destination) => {
    navigate(destination);
    setOpenMobile(false);
  };

  return <SidebarGroup className="study-sidebar-group">
    <SidebarGroupLabel className="nav-label">WORKSPACE</SidebarGroupLabel>
    <SidebarGroupAction className="study-sidebar-add" aria-label="Open My Lectures" title="Open My Lectures" onClick={() => handleNavigate("lectures")}><Plus /></SidebarGroupAction>
    <SidebarGroupContent>
      <SidebarMenu>
        {navItems.map(([id, icon, label]) => {
          const isActive = page === id || (id === "lectures" && page === "viewer") || (id === "quizzes" && page.startsWith("quiz"));
          return <SidebarMenuItem key={id}>
          <SidebarMenuButton className={`nav-link${isActive ? " active" : ""}`} isActive={isActive} tooltip={label} onClick={() => handleNavigate(id)}>
            <span className="nav-icon">{icon === "home" ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> : id === "lectures" ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 0 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg> : id === "schedule" ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg> : icon}</span>
            <span>{label}</span>
            {id === "lectures" && <SidebarMenuBadge className="nav-count">{lectures.length}</SidebarMenuBadge>}
          </SidebarMenuButton>
        </SidebarMenuItem>;
        })}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>;
}
const localResourceKey = (uid) => `studyspace-resources:${uid}`;
function readLocalResources(uid) {
  const saved = localStorage.getItem(localResourceKey(uid));
  return saved ? JSON.parse(saved) : {};
}
function saveLocalResource(uid, lecture) {
  if (!lecture.fileData) return;
  const resources = readLocalResources(uid);
  resources[lecture.id] = { fileName: lecture.fileName, fileType: lecture.fileType, fileData: lecture.fileData };
  localStorage.setItem(localResourceKey(uid), JSON.stringify(resources));
}
const fmtDate = (date, options = { month: "long", day: "numeric", year: "numeric" }) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
const fmtTime = (time) => { if (!time) return ""; const [h, m] = time.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
function minutesFromClock(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
function getScheduleReminders(sessions) {
  const date = today();
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return sessions
    .filter((session) => !session.completed && session.date >= date)
    .filter((session) => session.date !== date || minutesFromClock(session.end) >= nowMins)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .slice(0, 8)
    .map((session) => {
      const startMins = minutesFromClock(session.start);
      const endMins = minutesFromClock(session.end);
      let reminderLabel = fmtDate(session.date, { weekday: "short", month: "short", day: "numeric" });
      let tone = "upcoming";
      if (session.date === date) {
        if (nowMins >= startMins && nowMins <= endMins) {
          reminderLabel = "In progress";
          tone = "live";
        } else if (startMins >= nowMins && startMins - nowMins <= 60) {
          reminderLabel = "Starting soon";
          tone = "soon";
        } else {
          reminderLabel = "Today";
        }
      } else if (session.date === tomorrow) {
        reminderLabel = "Tomorrow";
      }
      return { ...session, reminderLabel, tone };
    });
}
const formatScheduleTime = (time, format) => {
  if (format === "24h") return time;
  if (!time) return "";
  const [hour, minute] = time.split(":").map(Number);
  return `${String(hour % 12 || 12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
};
function parseScheduleTime(value, format) {
  const text = value.trim();
  if (format === "24h") {
    const match = text.match(/^(?:([01]\d|2[0-3])):([0-5]\d)$/);
    return match ? `${match[1]}:${match[2]}` : null;
  }
  const match = text.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return null;
  const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
function getScheduleTimeParts(time, format) {
  const [hourText, minute] = time.split(":");
  const hour24 = Number(hourText);
  return {
    hour: format === "12h" ? String(hour24 % 12 || 12).padStart(2, "0") : hourText,
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}
function scheduleTimeFromParts(parts, format) {
  let hour = Number(parts.hour);
  if (format === "12h") hour = (hour % 12) + (parts.period === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${parts.minute}`;
}
const percent = (num, den) => den ? Math.round((num / den) * 100) : 0;
const answerMatches = (question, answer) => Array.isArray(question.correctAnswer)
  ? Array.isArray(answer) && question.correctAnswer.length === answer.length && question.correctAnswer.every((item) => answer.includes(item))
  : question.correctAnswer === answer;
const answerText = (answer) => Array.isArray(answer) ? answer.join(", ") : answer || "No answer";
function getLectureQuestions(lecture) {
  if ((lecture.quizSource === "custom" || lecture.quizSource === "generated") && lecture.questions?.length) return lecture.questions;
  const title = lecture.title?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const questionSetTitle = title === "conic equations"
    ? "Equations of Conic- Quarter 1_Module 5"
    : Object.keys(questionSets).find((key) => key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === title);
  if (questionSetTitle && questionSets[questionSetTitle]?.length) return questionSets[questionSetTitle];
  if (lecture.questions?.length) return lecture.questions;
  return [];
}

function adaptQuizQuestion(question, mode, lectureTitle) {
  if (mode === "True / False") {
    const wrongOptions = (question.options || []).filter((option) => option !== question.correctAnswer);
    const truth = Math.random() >= 0.5 || !wrongOptions.length;
    const proposed = truth ? question.correctAnswer : wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
    return {
      ...question,
      type: mode,
      question: `True or False? “${proposed}” correctly answers: ${question.question}`,
      options: ["True", "False"],
      correctAnswer: truth ? "True" : "False",
      explanation: `For “${question.question}”, the lecture’s correct answer is “${question.correctAnswer}”.`,
    };
  }
  if (mode === "Multi-select") {
    const correctAnswer = (question.options || []).filter((option) => option !== question.correctAnswer);
    return {
      ...question,
      type: mode,
      question: `Select every option that does NOT correctly answer: ${question.question}`,
      correctAnswer,
      explanation: `Only “${question.correctAnswer}” answers the lecture question correctly. The remaining choices are distractors.`,
    };
  }
  if (mode === "Problem solving") {
    return { ...question, type: mode, question: `Apply the lecture concept to this problem: ${question.question}` };
  }
  return { ...question, type: "Multiple choice" };
}

function App() {
  const [isStarting, setIsStarting] = useState(true);
  const [theme, setTheme] = useState("light");
  const [profile, setProfile] = useState(null);
  const [cloudError, setCloudError] = useState("");
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [authChoice, setAuthChoice] = useState(null);
  const [page, setPage] = useState("home");
  const [lectures, setLectures] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [quizSetupCount, setQuizSetupCount] = useState(null);
  const [quizSetupSettings, setQuizSetupSettings] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [toast, setToast] = useState("");
  const [quizGenerationError, setQuizGenerationError] = useState("");
  const [generatingLectureId, setGeneratingLectureId] = useState(null);
  const [summarizingLectureId, setSummarizingLectureId] = useState(null);
  const calendarPopover = useRef(null);
  const notificationsPopover = useRef(null);
  const quizGenerationLock = useRef(false);
  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setIsStarting(false);
      return;
    }
    let dataUnsubscribers = [];
    const stopAuthListener = onAuthStateChanged(auth, (user) => {
      dataUnsubscribers.forEach((unsubscribe) => unsubscribe());
      dataUnsubscribers = [];
      setLectures([]);
      setSessions([]);
      setAttempts([]);
      setSavedQuizzes([]);
      setSelectedLecture(null);

      if (!user) {
        setProfile(null);
        setAuthChoice(null);
        setIsStarting(false);
        return;
      }

      setProfile({ uid: user.uid, name: user.displayName || user.email || "Student", email: user.email || "", theme: "light", timeFormat: "12h" });
      setIsStarting(true);
      const pending = new Set(["lectures", "sessions", "quiz attempts", "saved quizzes", "profile"]);
      let profileInitialized = false;
      const markLoaded = (collectionName) => {
        pending.delete(collectionName);
        if (!pending.size) setIsStarting(false);
      };
      const loadFailed = (collectionName, error) => {
        reportCloudError(`Could not load ${collectionName}`, error);
        markLoaded(collectionName);
      };

      dataUnsubscribers.push(subscribeToUserRecords(user.uid, "lectures", (records) => {
        let resources = {};
        try {
          resources = readLocalResources(user.uid);
        } catch (error) {
          reportCloudError("Could not read locally cached resource files", error);
        }
        const hydrated = records.map((record) => ({ ...record, fileData: resources[record.id]?.fileData || "" }));
        setLectures(hydrated);
        setSelectedLecture((current) => current ? hydrated.find((lecture) => lecture.id === current.id) || current : current);
        markLoaded("lectures");
      }, (error) => loadFailed("lectures", error)));

      dataUnsubscribers.push(subscribeToUserRecords(user.uid, "sessions", (records) => {
        setSessions(records);
        markLoaded("sessions");
      }, (error) => loadFailed("sessions", error)));

      dataUnsubscribers.push(subscribeToUserRecords(user.uid, "quizAttempts", (records) => {
        setAttempts(records);
        markLoaded("quiz attempts");
      }, (error) => loadFailed("quiz attempts", error)));

      dataUnsubscribers.push(subscribeToUserRecords(user.uid, "quizzes", (records) => {
        setSavedQuizzes(records);
        markLoaded("saved quizzes");
      }, (error) => loadFailed("saved quizzes", error)));

      dataUnsubscribers.push(subscribeToUserProfile(user.uid, (savedProfile) => {
        if (savedProfile) {
          const nextProfile = {
            uid: user.uid,
            name: user.displayName || user.email || "Student",
            email: user.email || "",
            theme: "light",
            timeFormat: "12h",
            ...savedProfile,
          };
          setProfile(nextProfile);
          if (nextProfile.theme === "dark" || nextProfile.theme === "light") setTheme(nextProfile.theme);
        } else {
          const defaults = {
            name: user.displayName || user.email || "Student",
            email: user.email || "",
            theme: "light",
            timeFormat: "12h",
          };
          setProfile({ uid: user.uid, ...defaults });
          if (!profileInitialized) {
            profileInitialized = true;
            saveUserProfile(user.uid, defaults).catch((error) => reportCloudError("Could not initialize your profile", error));
          }
        }
        markLoaded("profile");
      }, (error) => loadFailed("profile", error)));
    }, (error) => {
      reportCloudError("Could not check your Firebase sign-in", error);
      setIsStarting(false);
    });

    return () => {
      stopAuthListener();
      dataUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);
  useEffect(() => {
    if (!calendarOpen && !notificationsOpen) return;
    function dismissPopovers(event) {
      if (event.type === "keydown" && event.key === "Escape") {
        setCalendarOpen(false);
        setNotificationsOpen(false);
      }
      if (event.type === "mousedown") {
        if (calendarOpen && !calendarPopover.current?.contains(event.target)) setCalendarOpen(false);
        if (notificationsOpen && !notificationsPopover.current?.contains(event.target)) setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", dismissPopovers);
    document.addEventListener("keydown", dismissPopovers);
    return () => {
      document.removeEventListener("mousedown", dismissPopovers);
      document.removeEventListener("keydown", dismissPopovers);
    };
  }, [calendarOpen, notificationsOpen]);
  const studied = lectures.filter((lecture) => lecture.studied).length;
  const completion = percent(studied, lectures.length);
  const matchingLectures = useMemo(() => lectures.filter((lecture) => `${lecture.title} ${lecture.subject} ${lecture.description}`.toLowerCase().includes(search.toLowerCase())), [lectures, search]);
  const scheduleReminders = useMemo(() => getScheduleReminders(sessions), [sessions]);
  const pageTitle = page === "viewer"
    ? selectedLecture?.title || "My Lectures"
    : page === "quizRun" || page === "quizSetup" || page === "quizOptions" || page === "quizReview"
      ? selectedLecture?.title || "Quiz"
      : navItems.find(([id]) => id === page)?.[2] || "My Lectures";
  const breadcrumbParent = page === "viewer" ? "My Lectures" : page.startsWith("quiz") ? "Quizzes" : "Workspace";

  function notify(message) { setToast(message); window.setTimeout(() => setToast(""), 2400); }
  function reportCloudError(action, error) {
    console.error(`[Studyspace] ${action}`, error);
    const message = `${action}: ${error?.message || "Unknown Firebase error"}`;
    setCloudError(message);
    notify(message);
  }
  function currentUid() {
    const uid = auth?.currentUser?.uid;
    if (!uid) throw new Error("Sign in before saving study data.");
    return uid;
  }
  async function persistLecture(lecture, isNew = false) {
    const uid = currentUid();
    try {
      saveLocalResource(uid, lecture);
    } catch (error) {
      reportCloudError("Lecture metadata will sync, but its local file preview could not be cached", error);
    }
    const metadata = { ...lecture };
    delete metadata.fileData;
    if (isNew) await createUserRecord(uid, "lectures", metadata);
    else await updateUserRecord(uid, "lectures", lecture.id, metadata);
  }
  function go(next) { setPage(next); setSelectedLecture(null); setQuizState(null); }
  function navigate(next) {
    if (page === "quizRun" && quizState && !quizState.done && !window.confirm("Leave this quiz? Your current answers will be lost.")) return;
    go(next);
  }
  async function toggleStudied(id) {
    const lecture = lectures.find((item) => item.id === id);
    if (!lecture) return;
    const updated = { ...lecture, studied: !lecture.studied };
    try {
      await persistLecture(updated);
      setLectures((items) => items.map((item) => item.id === id ? updated : item));
    } catch (error) {
      reportCloudError("Could not update lecture progress", error);
    }
  }
  async function saveLecture(form) {
    const lecture = { ...form, id: crypto.randomUUID(), studied: false, dateAdded: today(), questions: [], quizSource: "none" };
    try {
      await persistLecture(lecture, true);
      setLectures((items) => [lecture, ...items.filter((item) => item.id !== lecture.id)]);
      setPage("lectures");
      notify("Lecture added to your library");
    } catch (error) {
      reportCloudError("Could not save lecture", error);
    }
  }
  async function saveSession(form) {
    const session = { ...form, id: crypto.randomUUID(), completed: false };
    try {
      await createUserRecord(currentUid(), "sessions", session);
      setSessions((items) => [session, ...items.filter((item) => item.id !== session.id)]);
      notify("Study session scheduled");
      return true;
    } catch (error) {
      reportCloudError("Could not save study session", error);
      return false;
    }
  }
  async function updateSession(id, updates) {
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    const updated = { ...session, ...updates };
    try {
      await updateUserRecord(currentUid(), "sessions", id, updated);
      setSessions((items) => items.map((item) => item.id === id ? updated : item));
      return true;
    } catch (error) {
      reportCloudError("Could not update study session", error);
      return false;
    }
  }
  async function deleteSession(id) {
    try {
      await deleteUserRecord(currentUid(), "sessions", id);
      setSessions((items) => items.filter((item) => item.id !== id));
      return true;
    } catch (error) {
      reportCloudError("Could not delete study session", error);
      return false;
    }
  }
  async function startQuiz(lecture, settings = DEFAULT_QUIZ_SETTINGS) {
    if (quizGenerationLock.current) return;
    quizGenerationLock.current = true;
    setGeneratingLectureId(lecture.id);
    setQuizGenerationError("");
    setSelectedLecture(lecture);
    try {
      const config = validateQuizSettings(settings);
      let material = lecture.lectureContent?.trim() || "";
      if (material.length < 80 && lecture.summary?.trim()) {
        material = [material, lecture.summary.trim()].filter(Boolean).join("\n\n");
      }
      if (material.length < 80 && lecture.fileData && !lecture.fileType?.startsWith("video/")) {
        const response = await fetch(lecture.fileData);
        if (!response.ok) throw new Error("Could not read the saved lecture file. Reattach the file or add its notes.");
        const file = await response.blob();
        const extracted = await extractLectureText(file, lecture.fileName, lecture.fileType);
        material = [material, extracted].filter(Boolean).join("\n\n");
      }
      if (material.length < 80 && lecture.description?.trim()) {
        material = [material, lecture.description.trim()].filter(Boolean).join("\n\n");
      }
      if (material.length < 80) {
        const questionSource = getLectureQuestions(lecture).map((question) => [
          question.question,
          `Choices: ${question.options.join("; ")}`,
          `Correct answer: ${answerText(question.correctAnswer ?? question.answer)}`,
        ].join("\n")).join("\n\n");
        material = [material, questionSource].filter(Boolean).join("\n\n");
      }
      if (material.trim().length < 80) {
        throw new Error("Add at least 80 characters of lecture notes, a transcript, or lecture-specific questions before generating a quiz.");
      }

      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: material.slice(0, 120000),
          title: lecture.title,
          subject: lecture.subject,
          ...config,
        }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("The quiz service returned an invalid response. Check that the Python Gemini service is running.");
      }
      if (!response.ok) throw new Error(result.error || "The quiz could not be generated. Try again.");

      const questions = validateGeneratedQuiz(result.questions, config);
      const savedQuiz = {
        id: crypto.randomUUID(),
        lectureId: lecture.id,
        title: lecture.title,
        subject: lecture.subject,
        config,
        questions,
        createdAt: new Date().toISOString(),
      };
      await createUserRecord(currentUid(), "quizzes", savedQuiz);
      setSavedQuizzes((items) => [savedQuiz, ...items.filter((item) => item.id !== savedQuiz.id)]);
      setQuizState({
        questions,
        index: 0,
        answers: {},
        submitted: {},
        hints: {},
        done: false,
        config,
        startedAt: Date.now(),
        savedQuizId: savedQuiz.id,
      });
      setPage("quizRun");
    } catch (error) {
      const message = error.message || "Could not generate this quiz.";
      setQuizGenerationError(message);
      notify(message);
    } finally {
      quizGenerationLock.current = false;
      setGeneratingLectureId(null);
    }
  }
  async function saveCustomQuestions(questions, requestedCount = null) {
    const validQuestions = getUniqueValidQuestions(questions);
    const count = requestedCount || validQuestions.length;
    if (validQuestions.length < count) {
      notify(`Add ${count - validQuestions.length} more valid, distinct question${count - validQuestions.length === 1 ? "" : "s"} before starting.`);
      return;
    }
    const updated = { ...selectedLecture, questions: validQuestions, quizSource: "custom" };
    try {
      await persistLecture(updated);
      setLectures((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSelectedLecture(updated);
      const settings = requestedCount
        ? quizSetupSettings || { difficulty: "Medium", count, type: "Multiple choice" }
        : { difficulty: "Medium", count, type: "Multiple choice" };
      const { questions: selected } = selectQuizQuestions(validQuestions, count);
      const prepared = selected.map((question) => {
        const mode = settings.type === "Mixed"
          ? ["Multiple choice", "True / False", "Multi-select", "Problem solving"][Math.floor(Math.random() * 4)]
          : settings.type;
        return {
          ...adaptQuizQuestion({
            ...question,
            topic: question.topic || updated.title,
            difficulty: settings.difficulty,
            hint: question.hint || `Recall the main idea from ${updated.title}.`,
            explanation: question.explanation || `The correct answer is “${question.correctAnswer}.” Review this concept in ${updated.title}.`,
          }, mode, updated.title),
          difficulty: settings.difficulty,
        };
      });
      const config = { ...settings, count: prepared.length, includeExplanations: true };
      const savedQuiz = {
        id: crypto.randomUUID(),
        lectureId: updated.id,
        title: updated.title,
        subject: updated.subject,
        config,
        questions: prepared,
        createdAt: new Date().toISOString(),
      };
      await createUserRecord(currentUid(), "quizzes", savedQuiz);
      setSavedQuizzes((items) => [savedQuiz, ...items.filter((item) => item.id !== savedQuiz.id)]);
      setQuizState({ questions: prepared, index: 0, answers: {}, submitted: {}, hints: {}, done: false, config, startedAt: Date.now(), savedQuizId: savedQuiz.id });
      setQuizSetupCount(null);
      setQuizSetupSettings(null);
      setPage("quizRun");
    } catch (error) {
      reportCloudError("Could not save custom quiz questions", error);
    }
  }
  function customizeQuiz(lecture) { setSelectedLecture(lecture); setQuizState(null); setQuizGenerationError(""); setQuizSetupCount(null); setQuizSetupSettings(null); setPage("quizSetup"); }
  async function login(credentials) {
    try {
      const user = credentials.mode === "signup"
        ? await createFirebaseAccount(credentials)
        : await signInFirebaseAccount(credentials);
      setAuthChoice({ uid: user.uid, name: user.displayName || user.email || "Student", email: user.email || "" });
      return "";
    } catch (error) { return getAuthErrorMessage(error); }
  }
  async function googleLogin() {
    try {
      const user = await signInWithGoogle();
      setAuthChoice({ uid: user.uid, name: user.displayName || user.email || "Student", email: user.email || "" });
      return "";
    } catch (error) { return getAuthErrorMessage(error); }
  }
  async function finishLogin(staySignedIn) {
    if (!authChoice) return;
    try {
      await setFirebasePersistence(staySignedIn);
      setAuthChoice(null);
    } catch (error) {
      reportCloudError("Could not save your sign-in preference", error);
    }
  }
  async function logout() {
    try {
      await signOutFirebaseUser();
      setProfileEditorOpen(false);
      go("home");
    } catch (error) {
      reportCloudError("Could not sign out", error);
    }
  }
  async function saveProfile(updates) {
    const updatedProfile = { ...profile, ...updates, name: updates.name.trim() };
    try {
      await updateFirebaseDisplayName(updatedProfile.name);
      await saveUserProfile(currentUid(), updatedProfile);
      setProfile(updatedProfile);
      setProfileEditorOpen(false);
      notify("Profile updated.");
      return "";
    } catch (error) {
      reportCloudError("Could not update your profile", error);
      return error?.message || "Could not update your profile.";
    }
  }
  async function updatePreference(updates) {
    const updatedProfile = { ...profile, ...updates };
    try {
      await saveUserProfile(currentUid(), updates);
      setProfile(updatedProfile);
      if (updates.theme === "light" || updates.theme === "dark") setTheme(updates.theme);
    } catch (error) {
      reportCloudError("Could not save your preference", error);
    }
  }
  async function finishQuiz(answers) {
    const score = scoreQuizQuestions(quizState.questions, answers);
    const attempt = { id: crypto.randomUUID(), quizId: quizState.savedQuizId || "", lectureId: selectedLecture.id, title: selectedLecture.title, subject: selectedLecture.subject, topic: selectedLecture.title, difficulty: quizState.config?.difficulty || "Medium", type: quizState.config?.type || "Multiple choice", score, total: quizState.questions.length, seconds: Math.round((Date.now() - quizState.startedAt) / 1000), date: new Date().toISOString() };
    try {
      await createUserRecord(currentUid(), "quizAttempts", attempt);
      setAttempts((items) => [attempt, ...items.filter((item) => item.id !== attempt.id)]);
      setQuizState((state) => ({ ...state, answers, done: true, score, attempt }));
    } catch (error) {
      reportCloudError("Could not save quiz attempt", error);
    }
  }
  function retryQuiz() { startQuiz(selectedLecture, quizState.config || DEFAULT_QUIZ_SETTINGS); }
  function startConfiguredQuiz(settings) { startQuiz(selectedLecture, settings); }
  function goToQuizReview() { setPage("quizReview"); }
  function openLecture(lecture) { setSelectedLecture(lecture); setPage("viewer"); }
  function addToSchedule(lecture) { setPage("schedule"); setSelectedLecture(lecture); }
  function openSavedQuiz(savedQuiz) {
    const lecture = lectures.find((item) => item.id === savedQuiz.lectureId);
    if (!lecture) {
      setQuizGenerationError("This saved quiz is linked to a lecture that is no longer in your library.");
      return;
    }
    const questions = getUniqueValidQuestions(savedQuiz.questions);
    if (!questions.length || questions.length !== savedQuiz.questions?.length || questions.length > 20) {
      setQuizGenerationError("This saved quiz has missing or invalid questions and cannot be opened.");
      return;
    }
    const config = {
      difficulty: "Medium",
      type: "Multiple choice",
      includeExplanations: true,
      ...savedQuiz.config,
      count: questions.length,
    };
    setQuizGenerationError("");
    setSelectedLecture(lecture);
    setQuizState({ questions, index: 0, answers: {}, submitted: {}, hints: {}, done: false, config, startedAt: Date.now(), savedQuizId: savedQuiz.id });
    setPage("quizRun");
  }
  function openQuizOptions(lecture) {
    setSelectedLecture(lecture);
    setQuizState(null);
    setQuizGenerationError("");
    setPage("quizOptions");
  }
  async function summarizeLecture(lecture) {
    setSummarizingLectureId(lecture.id);
    try {
      let notes = lecture.lectureContent?.trim() || "";
      if (!notes && lecture.fileData && !lecture.fileType?.startsWith("video/")) {
        const file = await fetch(lecture.fileData).then((response) => response.blob());
        notes = await extractLectureText(file, lecture.fileName, lecture.fileType);
      }
      notes ||= lecture.description?.trim() || "";
      const videoData = lecture.fileType?.startsWith("video/") && lecture.fileData ? lecture.fileData : "";
      const videoUrl = lecture.fileType === "video/youtube" ? lecture.fileName : "";
      if (lecture.fileType?.startsWith("video/") && !videoData && !videoUrl && !lecture.lectureContent?.trim()) {
        notify("Attach a supported video that is 3 MB or smaller, or paste its transcript into the lecture notes.");
        return;
      }
      if (!notes && !videoData && !videoUrl) {
        notify("Add lecture notes or a video transcript before creating a summary.");
        return;
      }
      console.log("Lecture:", lecture);
      console.log("Notes value:", notes);
      console.log("Notes type:", typeof notes);
      console.log("Notes length:", notes?.length);
      // Get the lecture text, or extract it from the stored PDF
        let lectureNotes = lecture.lectureContent?.trim() || "";

        if (!lectureNotes && lecture.file && lecture.fileType === "application/pdf") {
          const pdfResponse = await fetch(lecture.file);
          const pdfBlob = await pdfResponse.blob();

          const pdfFile = new File(
            [pdfBlob],
            lecture.fileName || "lecture.pdf",
            { type: "application/pdf" }
          );

          lectureNotes = await extractLectureText(
            pdfFile,
            lecture.fileName || "lecture.pdf",
            "application/pdf"
          );
        }

        console.log("Extracted PDF text:", lectureNotes);
        console.log("Extracted text length:", lectureNotes.length);

        if (!lectureNotes.trim()) {
          throw new Error("No text could be extracted from this PDF.");
        }

        const response = await fetch("/api/summarize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: lecture.title,
            subject: lecture.subject,
            notes: lectureNotes,
          }),
      });
      const result = await response.json().catch(() => ({}));

          console.log("Summary response:", response.status, result);

            if (!response.ok) {
              throw new Error(
         result.error || `Server error: ${response.status}`
      );
  }

if (!result.summary?.trim()) {
  throw new Error("The summarizer returned an empty summary. Try again.");
}
      const updated = { ...lecture, lectureContent: lecture.lectureContent || (videoData || videoUrl ? result.summary.trim() : notes), summary: result.summary.trim() };
      await persistLecture(updated);
      setLectures((items) => items.map((item) => item.id === lecture.id ? updated : item));
      setSelectedLecture((current) => current?.id === lecture.id ? updated : current);
    } catch (error) {
      notify(error instanceof TypeError ? "Summary service unavailable. Start the Python server and set GEMINI_API_KEY." : error.message);
    } finally {
      setSummarizingLectureId(null);
    }
  }

  if (isStarting) return <AppStartupSkeleton theme={theme} />;

  return <SidebarProvider className={`app-shell ${theme === "dark" ? "dark-mode dark" : ""}`} style={{ "--sidebar-width": "246px", "--sidebar-width-icon": "64px" }}>
    <Sidebar collapsible="icon" className="study-sidebar">
      <SidebarHeader className="study-sidebar-header">
        <button className="brand" type="button" onClick={() => go("home")} aria-label="Go to Studyspace homepage"><div className="brand-mark">s<span>.</span></div><span>studyspace</span></button>
      </SidebarHeader>
      <SidebarContent className="study-sidebar-content">
        <WorkspaceSidebarNavigation page={page} lectures={lectures} navigate={navigate} />
      </SidebarContent>
      <SidebarFooter className="study-sidebar-footer">
        <div className="study-tip"><span className="tip-icon">✦</span><strong>A little every day</strong><p>Small study sessions add up to big progress.</p><div className="tip-progress"><span style={{ width: `${completion}%` }} /></div><span className="tip-meta">{completion}% of your library covered</span></div>
        <button type="button" className="profile profile-button" onClick={() => setProfileEditorOpen(true)} title="Edit profile" aria-label={`Edit profile for ${profile?.name || "Student"}`}><div className="avatar">{(profile?.name || "S").slice(0, 1).toUpperCase()}</div><div><strong>{profile?.name || "Student"}</strong><span>Edit profile</span></div><span className="profile-dots">↗</span></button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <SidebarInset className="main-area">
      <header className="topbar">
        <SidebarTrigger className="sidebar-trigger" aria-label="Toggle sidebar" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="#workspace" onClick={(event) => { event.preventDefault(); navigate("home"); }}>Workspace</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            {breadcrumbParent !== "Workspace" && <><BreadcrumbItem><BreadcrumbLink href="#parent" onClick={(event) => { event.preventDefault(); navigate(breadcrumbParent === "My Lectures" ? "lectures" : "quizzes"); }}>{breadcrumbParent}</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></>}
            <BreadcrumbItem><BreadcrumbPage>{pageTitle}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="top-actions">
          <label className="theme-control"><span className="theme-icon">{theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}</span><span className="theme-label">{theme === "dark" ? "Dark" : "Light"}</span><Switch checked={theme === "dark"} onCheckedChange={(checked) => updatePreference({ theme: checked ? "dark" : "light" })} aria-label="Toggle dark mode" /></label>
          <div className="calendar-trigger-wrap" ref={notificationsPopover}>
            <button type="button" className={`notification-trigger${notificationsOpen ? " is-open" : ""}`} aria-label={scheduleReminders.length ? `Study schedule notifications, ${scheduleReminders.length} upcoming` : "Study schedule notifications"} aria-haspopup="dialog" aria-expanded={notificationsOpen} onClick={() => { setCalendarOpen(false); setNotificationsOpen((open) => !open); }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
              {scheduleReminders.length > 0 && <span className="notification-badge">{scheduleReminders.length > 9 ? "9+" : scheduleReminders.length}</span>}
            </button>
            {notificationsOpen && <div className="notification-popover" role="dialog" aria-label="Study schedule notifications">
              <div className="notification-popover-head"><strong>Study schedule</strong><span>{scheduleReminders.length ? `${scheduleReminders.length} upcoming` : "No upcoming sessions"}</span></div>
              {scheduleReminders.length ? <ul className="notification-list">{scheduleReminders.map((session) => <li key={session.id}><button type="button" className={`notification-item tone-${session.tone}`} onClick={() => { setNotificationsOpen(false); go("schedule"); }}><span className="notification-item-time">{fmtTime(session.start)}</span><span className="notification-item-body"><strong>{session.topic}</strong><small>{session.subject} · {session.reminderLabel}</small></span></button></li>)}</ul> : <p className="notification-empty">Nothing scheduled right now. Plan a session so reminders can show up here.</p>}
              <button type="button" className="text-button notification-footer" onClick={() => { setNotificationsOpen(false); go("schedule"); }}>Open study schedule →</button>
            </div>}
          </div>
          <div className="calendar-trigger-wrap" ref={calendarPopover}>
            <button type="button" className="date-chip" aria-label="Open calendar" aria-haspopup="dialog" aria-expanded={calendarOpen} onClick={() => { setNotificationsOpen(false); setCalendarOpen((open) => !open); }}><CalendarDays size={13} /><span>{calendarDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span></button>
            {calendarOpen && <div className="calendar-popover" role="dialog" aria-label="Study calendar"><Calendar mode="single" selected={calendarDate} onSelect={(date) => { if (date) setCalendarDate(date); }} /></div>}
          </div>
        </div>
      </header>
      <div className="content">
        {cloudError && <p className="auth-error" role="alert">{cloudError}</p>}
        {quizGenerationError && !["quizzes", "quizOptions"].includes(page) && <p className="quiz-setup-message" role="alert">{quizGenerationError}</p>}
        {page === "home" && <Dashboard lectures={lectures} sessions={sessions} completion={completion} studied={studied} onNavigate={go} onOpen={openLecture} onAdd={() => go("lectures")} />}
        {page === "lectures" && <LecturesPage lectures={matchingLectures} search={search} setSearch={setSearch} onOpen={openLecture} onToggle={toggleStudied} onQuiz={startQuiz} onCustomizeSettings={openQuizOptions} generatingLectureId={generatingLectureId} onAdd={saveLecture} />}
        {page === "checklist" && <Checklist lectures={lectures} studied={studied} completion={completion} onToggle={toggleStudied} />}
        {page === "schedule" && <SchedulePage sessions={sessions} lectures={lectures} onSave={saveSession} onUpdate={updateSession} onDelete={deleteSession} onPreferenceChange={updatePreference} timeFormat={profile?.timeFormat} selectedLecture={selectedLecture} clearSelected={() => setSelectedLecture(null)} />}
        {page === "viewer" && selectedLecture && <LectureViewer lecture={selectedLecture} onBack={() => go("lectures")} onToggle={() => toggleStudied(selectedLecture.id)} onSchedule={() => addToSchedule(selectedLecture)} onQuiz={() => startQuiz(selectedLecture)} onCustomizeSettings={() => openQuizOptions(selectedLecture)} generating={Boolean(generatingLectureId)} onSummarize={() => summarizeLecture(selectedLecture)} summarizing={summarizingLectureId === selectedLecture.id} />}
        {page === "quizRun" && quizState && <QuizRun state={quizState} lecture={selectedLecture} onChange={setQuizState} onFinish={finishQuiz} onRetry={retryQuiz} onReview={goToQuizReview} onBack={() => go("quizzes")} />}
        {page === "quizSetup" && selectedLecture && <QuizSetup lecture={selectedLecture} requestedCount={quizSetupCount} onSave={saveCustomQuestions} onBack={() => go("quizzes")} />}
        {page === "quizOptions" && selectedLecture && <QuizOptions lecture={selectedLecture} onStart={startConfiguredQuiz} onBack={() => go("quizzes")} isGenerating={Boolean(generatingLectureId)} error={quizGenerationError} />}
        {page === "quizReview" && quizState && <QuizReview state={quizState} lecture={selectedLecture} onStudy={() => openLecture(selectedLecture)} onRetry={retryQuiz} onBack={() => setPage("quizRun")} />}
        {page === "quizzes" && <QuizHistory attempts={attempts} lectures={lectures} savedQuizzes={savedQuizzes} onQuiz={startQuiz} onCustomizeSettings={openQuizOptions} onEditQuestions={customizeQuiz} onOpenSaved={openSavedQuiz} generatingLectureId={generatingLectureId} error={quizGenerationError} />}
        {page === "progress" && <ProgressPage lectures={lectures} attempts={attempts} studied={studied} completion={completion} />}
      </div>
    </SidebarInset>
    {toast && <div className="toast">✓ &nbsp;{toast}</div>}
    {profileEditorOpen && profile && <ProfileEditor profile={profile} onSave={saveProfile} onClose={() => setProfileEditorOpen(false)} onLogout={logout} />}
    {!profile && <LoginScreen firebaseReady={firebaseConfigured} missingConfig={missingFirebaseConfig} authChoice={authChoice} onLogin={login} onGoogleLogin={googleLogin} onFinish={finishLogin} />}
  </SidebarProvider>;
}

function AppStartupSkeleton({ theme }) {
  const darkClass = theme === "dark" ? "dark-mode dark" : "";
  return <div className={`app-shell app-loading-shell ${darkClass}`} role="status" aria-live="polite" aria-label="Loading Studyspace">
    <aside className="app-loading-sidebar" aria-hidden="true">
      <div className="app-loading-brand"><Skeleton className="loading-mark" /><Skeleton className="loading-wordmark" /></div>
      <Skeleton className="loading-nav-label" />
      <div className="app-loading-nav">{Array.from({ length: 6 }, (_, index) => <Skeleton className={`loading-nav-item ${index === 0 ? "is-active" : ""}`} key={index} />)}</div>
      <Skeleton className="loading-tip" />
    </aside>
    <main className="app-loading-main" aria-hidden="true">
      <header className="app-loading-topbar"><Skeleton className="loading-breadcrumb" /><div><Skeleton className="loading-theme" /><Skeleton className="loading-date" /><Skeleton className="loading-avatar" /></div></header>
      <section className="app-loading-content">
        <div className="loading-title-row"><div><Skeleton className="loading-eyebrow" /><Skeleton className="loading-title" /><Skeleton className="loading-subtitle" /></div><Skeleton className="loading-action" /></div>
        <div className="loading-stats">{Array.from({ length: 4 }, (_, index) => <div className="loading-stat-card" key={index}><Skeleton className="loading-stat-icon" /><Skeleton className="loading-stat-label" /><Skeleton className="loading-stat-value" /><Skeleton className="loading-stat-meta" /></div>)}</div>
        <div className="loading-panels"><div><Skeleton className="loading-panel loading-panel-large" /><Skeleton className="loading-panel loading-panel-short" /></div><Skeleton className="loading-panel loading-panel-side" /></div>
      </section>
    </main>
    <span className="sr-only">Loading your study space…</span>
  </div>;
}

function ProfileEditor({ profile, onSave, onClose, onLogout }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    email: profile.email || "",
    contactEmail: profile.contactEmail || "",
    phone: profile.phone || "",
    school: profile.school || "",
    program: profile.program || "",
    yearLevel: profile.yearLevel || "",
    yearLevelOther: profile.yearLevelOther || "",
    studyGoal: profile.studyGoal || "",
  });
  const [error, setError] = useState("");
  const yearLevels = ["Grade 11", "Grade 12", "1st Year College", "2nd Year College", "3rd Year College", "4th Year College", "5th Year College", "6th Year College", "Graduate Student", "Other", "Prefer not to say"];
  const savedYearLevel = form.yearLevel && !yearLevels.includes(form.yearLevel) ? [form.yearLevel, ...yearLevels] : yearLevels;
  function set(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) { setError("Enter your name to save your profile."); return; }
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) { setError("Enter a valid contact email address."); return; }
    setError("");
    const message = await onSave(form);
    if (message) setError(message);
  }
  return <div className="profile-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
      <div className="profile-editor-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h2 id="profile-editor-title">Edit profile</h2><p>Update the details shown in your study space.</p></div><button type="button" className="icon-button" aria-label="Close edit profile" onClick={onClose}>×</button></div>
      <form onSubmit={submit}>
        <div className="profile-form-grid">
          <label>Display name<input autoFocus required value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Your name" /></label>
          <label>Sign-in email<input type="email" value={form.email} readOnly aria-describedby="profile-email-note" /></label>
          <label>Contact email<input type="email" value={form.contactEmail} onChange={(event) => set("contactEmail", event.target.value)} placeholder="name@example.com" /></label>
          <label>Phone number<input type="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="Optional" /></label>
          <label>School or institution<input value={form.school} onChange={(event) => set("school", event.target.value)} placeholder="Optional" /></label>
          <label>Program or course<input value={form.program} onChange={(event) => set("program", event.target.value)} placeholder="Optional" /></label>
          <div className="profile-form-field">
            <label htmlFor="profile-year-level">Year or level</label>
            <Select value={form.yearLevel || null} onValueChange={(value) => setForm((current) => ({ ...current, yearLevel: value || "", yearLevelOther: value === "Other" ? current.yearLevelOther : "" }))}>
              <SelectTrigger id="profile-year-level" aria-label="Year or level">
                <SelectValue placeholder="Select your year or level" />
              </SelectTrigger>
              <SelectContent>
                {savedYearLevel.map((yearLevel) => <SelectItem key={yearLevel} value={yearLevel}>{yearLevel}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.yearLevel === "Other" && <label className="profile-year-level-other" htmlFor="profile-year-level-other">Please specify your year or level<input id="profile-year-level-other" value={form.yearLevelOther} onChange={(event) => set("yearLevelOther", event.target.value)} placeholder="Enter your year or level…" /></label>}
          </div>
          <label className="profile-form-wide">Study goal<textarea rows="3" value={form.studyGoal} onChange={(event) => set("studyGoal", event.target.value)} placeholder="What are you working toward? (Optional)" /></label>
        </div>
        <small className="profile-email-note" id="profile-email-note">Your sign-in email stays linked to this account. Add a contact email above if you want to use a different address in your profile.</small>
        {error && <p className="profile-form-error" role="alert">{error}</p>}
        <div className="profile-editor-actions"><button type="button" className="button text-button profile-sign-out" onClick={onLogout}>Sign out</button><div><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">Save profile</button></div></div>
      </form>
    </section>
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

function LoginScreen({ firebaseReady, missingConfig, authChoice, onLogin, onGoogleLogin, onFinish }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState("");
  async function submitCredentials(event) {
    event.preventDefault(); setError("");
    if (mode === "signup" && password !== confirmPassword) { setError("The passwords do not match."); return; }
    if (mode === "signup" && password.length < 8) { setError("Use at least 8 characters for your password."); return; }
    setSubmitting(true);
    const message = await onLogin({ mode, name, email, password });
    setSubmitting(false); setError(message || "");
  }
  function switchMode() { setMode(mode === "signup" ? "login" : "signup"); setPassword(""); setConfirmPassword(""); setError(""); }
  async function continueWithGoogle() {
    setSubmitting(true);
    setGoogleError("");
    const message = await onGoogleLogin();
    setSubmitting(false);
    setGoogleError(message || "");
  }
  if (authChoice) return <div className="auth-overlay"><Card className="auth-card stay-card"><div className="auth-brand"><div className="brand-mark">s<span>.</span></div><span>studyspace</span></div><p className="eyebrow">SIGN-IN PREFERENCE</p><h1>Stay signed in?</h1><p className="auth-intro">Keep your Studyspace profile signed in on this device, {authChoice.name}. You can sign out anytime from the profile menu.</p><button className="button primary auth-submit" onClick={() => onFinish(true)}>Yes, stay signed in</button><button className="button secondary auth-submit" onClick={() => onFinish(false)}>No, just for this session</button><p className="auth-local-note">Session-only sign-in ends when this browser session closes.</p></Card></div>;
  return <div className="auth-overlay"><Card className="auth-card"><div className="auth-brand"><div className="brand-mark">s<span>.</span></div><span>studyspace</span></div><p className="eyebrow">YOUR PERSONAL STUDY SPACE</p><h1>{mode === "signup" ? "Make room to grow." : "Welcome back."}</h1><p className="auth-intro">{mode === "signup" ? "Create an account to keep your lectures, schedule, and progress synced to your Firebase account." : "Sign in to continue to your synced study space."}</p><form className="auth-form" onSubmit={submitCredentials}>
    {mode === "signup" && <label>Your name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Student" /></label>}
    <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
    <label>Password<span className="password-field"><input required type={showPassword ? "text" : "password"} minLength="8" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} /><button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
    {mode === "signup" && <label>Confirm password<span className="password-field"><input required type={showConfirmPassword ? "text" : "password"} minLength="8" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /><button type="button" className="password-toggle" aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((shown) => !shown)}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button primary auth-submit" disabled={submitting}>{submitting ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}</button>
  </form><div className="auth-divider"><span>or</span></div><button className="google-placeholder" type="button" disabled={submitting || !firebaseReady} onClick={continueWithGoogle}><span className="google-g">G</span> Continue with Google {!firebaseReady && <small>Complete Firebase configuration to enable</small>}</button>{googleError && <p className="auth-error" role="alert">{googleError}</p>}{!firebaseReady && <p className="auth-error" role="alert">Firebase setup is incomplete. Replace the placeholder values in the project-root `.env.local` with your Firebase Web App configuration, then restart Vite. Missing values: {missingConfig.join(", ")}</p>}<p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to Studyspace?"} <button type="button" onClick={switchMode}>{mode === "signup" ? "Log in" : "Sign up"}</button></p><p className="auth-local-note">Your account uses Firebase Authentication. Lectures, study activity, and profile preferences sync to your account.</p></Card></div>;
}

function QuizSetup({ lecture, requestedCount, onSave, onBack }) {
  const [questions, setQuestions] = useState(() => getUniqueValidQuestions(getLectureQuestions(lecture)));
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [error, setError] = useState("");
  function addQuestion(event) {
    event.preventDefault();
    const cleanOptions = options.map((option) => option.trim());
    if (questions.length >= 20 || !question.trim() || cleanOptions.some((option) => !option)) return;
    const candidate = { question: question.trim(), options: cleanOptions, answer: cleanOptions[answerIndex] };
    if (getUniqueValidQuestions([...questions, candidate]).length === questions.length) {
      setError("This question duplicates an existing question or does not have valid answer choices.");
      return;
    }
    setError("");
    setQuestions((items) => getUniqueValidQuestions([...items, candidate]));
    setQuestion(""); setOptions(["", "", "", ""]); setAnswerIndex(0);
  }
  const validQuestionCount = getUniqueValidQuestions(questions).length;
  const requiredCount = requestedCount || 10;
  const countMessage = requestedCount
    ? `The selected quiz needs ${requestedCount} questions. ${Math.min(validQuestionCount, requestedCount)} of ${requestedCount} valid, distinct questions are ready.`
    : "Questions generated from readable lecture text are preloaded. Edit the set or add your own; this editor requires at least 10 questions.";
  return <><button className="back-link" onClick={onBack}>← &nbsp;Back to quizzes</button><section className="panel quiz-setup"><p className="eyebrow">CUSTOMIZE THIS QUIZ · OPTIONAL</p><h1>{lecture.title}</h1><p className="subheading">{countMessage}</p>{requestedCount && validQuestionCount < requestedCount && <p className="quiz-setup-message" role="alert">Add {requestedCount - validQuestionCount} more valid, distinct question{requestedCount - validQuestionCount === 1 ? "" : "s"} to start this quiz.</p>}<form className="question-builder" onSubmit={addQuestion}><label>Question<textarea required rows="2" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Write a question from the lecture notes" /></label><div className="builder-options">{options.map((option, index) => <label key={index}>Choice {String.fromCharCode(65 + index)}<input required value={option} onChange={(event) => setOptions((items) => items.map((item, i) => i === index ? event.target.value : item))} placeholder={`Answer choice ${index + 1}`} /></label>)}</div><label>Correct answer<select value={answerIndex} onChange={(event) => setAnswerIndex(Number(event.target.value))}>{options.map((option, index) => <option key={index} value={index}>Choice {String.fromCharCode(65 + index)}{option.trim() ? ` — ${option}` : ""}</option>)}</select></label>{error && <p className="quiz-setup-message" role="alert">{error}</p>}<button className="button secondary" disabled={questions.length >= 20}>＋ Add question</button></form><div className="builder-list"><div className="panel-heading"><h2>Your questions</h2><span>{validQuestionCount} added</span></div>{questions.length ? questions.map((item, index) => <div className="builder-question" key={`${item.question}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.question}</strong><small>Correct answer: {answerText(item.correctAnswer ?? item.answer)}</small></div><button type="button" className="text-button delete-text" onClick={() => setQuestions((items) => items.filter((_, i) => i !== index))}>Remove</button></div>) : <p className="muted small-text">No questions yet. Add questions here, or provide more lecture text if generation could not find enough.</p>}</div><div className="form-actions"><button type="button" className="button secondary" onClick={onBack}>Cancel</button><button type="button" className="button primary" disabled={validQuestionCount < requiredCount || validQuestionCount > 20} onClick={() => onSave(questions, requestedCount)}>{validQuestionCount < requiredCount ? `Add ${requiredCount - validQuestionCount} more question${requiredCount - validQuestionCount === 1 ? "" : "s"}` : requestedCount ? `Save & start ${requestedCount}-question quiz` : "Save & start quiz"}</button></div></section></>;
}

function LecturesPage({ lectures, search, setSearch, onOpen, onToggle, onQuiz, onCustomizeSettings, generatingLectureId, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("All");
  const subjects = ["All", ...new Set(lectures.map((item) => item.subject))];
  const shown = filter === "All" ? lectures : lectures.filter((item) => item.subject === filter);
  function submit(form) { onAdd(form); setShowForm(false); }
  return <><PageHeading eyebrow="YOUR PERSONAL LIBRARY" title="My lectures" subtitle="Keep your notes, videos, and study resources all in one place." action={<button className="button primary" onClick={() => setShowForm(!showForm)}>{showForm ? "× Close" : "＋ Add lecture"}</button>} />
    {showForm && <LectureForm onSave={submit} onCancel={() => setShowForm(false)} />}
    <div className="library-toolbar"><label className="search-box"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search lectures, subjects, or topics..." /></label><div className="filter-chips">{subjects.map((item) => <button className={`filter-chip ${filter === item ? "selected" : ""}`} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
    {shown.length ? <div className="lecture-grid">{shown.map((lecture) => <LectureCard key={lecture.id} lecture={lecture} onOpen={onOpen} onToggle={onToggle} onQuiz={onQuiz} onCustomizeSettings={onCustomizeSettings} generating={generatingLectureId === lecture.id} generationInProgress={Boolean(generatingLectureId)} />)}</div> : <div className="panel empty-library"><span>▤</span><h2>No lectures found</h2><p>Try a different search or add a new study material.</p><button className="button secondary" onClick={() => setShowForm(true)}>＋ Add lecture</button></div>}</>;
}
function LectureCard({ lecture, onOpen, onToggle, onQuiz, onCustomizeSettings, generating, generationInProgress }) { return <article className="lecture-card"><div className="lecture-card-top"><div className="file-icon">{lecture.fileType?.includes("pdf") ? "PDF" : lecture.fileType?.startsWith("video") ? "▶" : "▤"}</div><span className={`status ${lecture.studied ? "complete" : "pending"}`}>{lecture.studied ? "✓ Studied" : "Not studied"}</span></div><span className="subject-label">{lecture.subject}</span><h3>{lecture.title}</h3><p className="lecture-desc">{lecture.description || "No description added yet."}</p><div className="lecture-meta">Added {fmtDate(lecture.dateAdded, { month: "short", day: "numeric" })}{lecture.fileName && <span> · {lecture.fileName}</span>}</div><div className="lecture-actions"><button className="button secondary small" onClick={() => onOpen(lecture)}>Open lecture</button><button className="icon-button" disabled={generationInProgress} title={generating ? "Generating your quiz…" : "Generate quiz now"} aria-label={generating ? "Generating your quiz" : `Generate quiz now for ${lecture.title}`} onClick={() => onQuiz(lecture)}>{generating ? "…" : "✧"}</button><button className="icon-button" disabled={generationInProgress} title="Customize quiz" aria-label={`Customize quiz for ${lecture.title}`} onClick={() => onCustomizeSettings(lecture)}>⚙</button><button className="icon-button" title={lecture.studied ? "Mark as not studied" : "Mark as studied"} onClick={() => onToggle(lecture.id)}>{lecture.studied ? "✓" : "○"}</button></div></article>; }
function LectureForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ title: "", subject: "", description: "", lectureContent: "", fileName: "", fileType: "", fileData: "", fileSize: 0, youtubeUrl: "" }); const [busy, setBusy] = useState(false); const [extractMessage, setExtractMessage] = useState(""); const fileInput = useRef(null);
  function set(key, value) { setForm((state) => ({ ...state, [key]: value })); }
  function removeAttachment() { setForm((state) => ({ ...state, fileName: "", fileType: "", fileData: "", fileSize: 0 })); setExtractMessage(""); if (fileInput.current) fileInput.current.value = ""; }
  async function attach(file) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const videoMimeByExtension = { mp4: "video/mp4", mpeg: "video/mpeg", mpg: "video/mpg", mov: "video/mov", avi: "video/avi", flv: "video/x-flv", webm: "video/webm", wmv: "video/wmv", "3gp": "video/3gpp" };
    const fileType = videoMimeByExtension[extension] || file.type;
    set("fileName", file.name); set("fileType", fileType); set("fileSize", file.size); setBusy(true); setExtractMessage("Reading lecture text…");
    const fileDataPromise = file.size <= 3 * 1024 * 1024 ? new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(""); reader.readAsDataURL(file); }) : Promise.resolve("");
    if (file.size > 3 * 1024 * 1024) setExtractMessage("File is over 3 MB; text can still be extracted, but the file itself will not be saved for preview.");
    if (fileType.startsWith("video/")) {
      set("fileData", await fileDataPromise);
      setExtractMessage(file.size <= 3 * 1024 * 1024 ? "Video attached. Gemini will create study notes from its audio and visuals when you summarize." : "Video saved without its data because it exceeds 3 MB. Compress it or paste a transcript to summarize it.");
      setBusy(false); return;
    }
    try {
      const [extracted, fileData] = await Promise.all([extractLectureText(file, file.name, file.type), fileDataPromise]);
      set("fileData", fileData);
      set("lectureContent", extracted.slice(0, 90000)); setExtractMessage(`Read ${extracted.length.toLocaleString()} characters from this file.`);
    } catch (error) { setExtractMessage(error.message || "Could not extract text; you can paste notes below."); }
    setBusy(false);
  }
  return <form className="panel form-panel" onSubmit={(e) => { e.preventDefault(); onSave({ ...form, fileName: form.fileName || form.youtubeUrl, fileType: form.fileType || (form.youtubeUrl ? "video/youtube" : ""), fileData: form.fileData || "", lectureContent: form.lectureContent.trim() }); }}><div className="panel-heading"><div><p className="eyebrow">NEW MATERIAL</p><h2>Add a lecture</h2></div></div><div className="form-grid"><label>Lecture title<input required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Kidney Function Tests" /></label><label>Subject<input required value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Clinical Chemistry" /></label><label className="wide">Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows="2" placeholder="A short note about what this lecture covers" /></label><label className="wide">Lecture notes or video transcript<textarea value={form.lectureContent} onChange={(e) => set("lectureContent", e.target.value)} rows="4" placeholder="File text is extracted here. Paste captions or a transcript if the video is too large." /></label><label>YouTube URL<input type="url" value={form.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label><label className="upload-field">Study material<input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mpeg,.mpg,.mov,.avi,.flv,.webm,.wmv,.3gp,.txt" onChange={(e) => attach(e.target.files?.[0])} /><small>PDF, DOCX, PPTX, text, or video · Videos up to 3 MB</small>{form.fileName && <Attachment state={busy ? "processing" : "done"} size="sm" className="lecture-file-attachment"><AttachmentMedia>{form.fileType.startsWith("video/") ? <FileVideo size={18} /> : <FileText size={18} />}</AttachmentMedia><AttachmentContent><AttachmentTitle title={form.fileName}>{form.fileName}</AttachmentTitle><AttachmentDescription>{form.fileSize >= 1024 * 1024 ? `${(form.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(form.fileSize / 1024))} KB`} · {busy ? "Processing…" : "Ready"}</AttachmentDescription></AttachmentContent><AttachmentActions><AttachmentAction aria-label={`Remove ${form.fileName}`} title="Remove attachment" onClick={removeAttachment}><X size={15} /></AttachmentAction></AttachmentActions></Attachment>}{extractMessage && <small className="extract-message">{extractMessage}</small>}</label></div><div className="form-actions"><button className="button secondary" type="button" onClick={onCancel}>Cancel</button><button className="button primary" disabled={busy}>Save lecture</button></div></form>;
}
function Checklist({ lectures, studied, completion, onToggle }) { const groups = [...new Set(lectures.map((l) => l.subject))]; return <><PageHeading eyebrow="A LITTLE PROGRESS ADDS UP" title="Study checklist" subtitle="Mark topics as you study them. You can always revisit one later." /><section className="panel checklist-overview"><div className="checklist-summary"><div><p className="eyebrow">OVERALL STUDY PROGRESS</p><h2>{studied} of {lectures.length} lectures studied</h2><p className="muted">{completion}% of your study library is complete</p></div><strong>{completion}%</strong></div><ProgressBar value={completion} /></section><div className="checklist-groups">{groups.map((subject) => { const items = lectures.filter((l) => l.subject === subject); const done = items.filter((l) => l.studied).length; return <section className="panel checklist-group" key={subject}><div className="check-group-title"><div className="subject-icon">{subject.slice(0, 1)}</div><div><h2>{subject}</h2><span>{done} of {items.length} completed</span></div><ProgressBar value={percent(done, items.length)} /></div>{items.map((lecture) => <label key={lecture.id} className={`check-item ${lecture.studied ? "checked" : ""}`}><input type="checkbox" checked={lecture.studied} onChange={() => onToggle(lecture.id)} /><span className="custom-check">✓</span><span>{lecture.title}</span><span className="check-date">Added {fmtDate(lecture.dateAdded, { month: "short", day: "numeric" })}</span></label>)}</section>; })}{!lectures.length && <Empty text="Add a lecture to start your checklist." />}</div></>; }

function SchedulePage({ sessions, lectures, onSave, onUpdate, onDelete, onPreferenceChange, timeFormat, selectedLecture, clearSelected }) {
  const [editing, setEditing] = useState(null); const [formOpen, setFormOpen] = useState(Boolean(selectedLecture));
  async function save(form) {
    const saved = editing ? await onUpdate(editing.id, form) : await onSave(form);
    if (saved === false) return;
    setEditing(null); setFormOpen(false); clearSelected();
  }
  function edit(s) { setEditing(s); setFormOpen(true); }
  function remove(id) { onDelete(id); }
  function toggle(id) {
    const session = sessions.find((item) => item.id === id);
    if (session) onUpdate(id, { completed: !session.completed });
  }
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const todaySessions = sorted.filter((s) => s.date === today() && !s.completed); const upcoming = sorted.filter((s) => s.date > today() && !s.completed); const completed = sorted.filter((s) => s.completed);
  return <><PageHeading eyebrow="MAKE SPACE TO LEARN" title="Study schedule" subtitle="Plan your sessions, stay consistent, and celebrate each one you complete." action={<button className="button primary" onClick={() => { setEditing(null); setFormOpen(!formOpen); }}>＋ Add session</button>} />
    {formOpen && <ScheduleForm lectures={lectures} initial={editing || (selectedLecture ? { subject: selectedLecture.subject, topic: selectedLecture.title, date: today() } : null)} timeFormatPreference={timeFormat} onPreferenceChange={onPreferenceChange} onSave={save} onCancel={() => { setFormOpen(false); setEditing(null); clearSelected(); }} />}
    <div className="schedule-columns"><div><ScheduleGroup title="TODAY" date={fmtDate(today())} sessions={todaySessions} onEdit={edit} onDelete={remove} onToggle={toggle} /><ScheduleGroup title="UPCOMING" sessions={upcoming} onEdit={edit} onDelete={remove} onToggle={toggle} /><ScheduleGroup title="COMPLETED" sessions={completed} onEdit={edit} onDelete={remove} onToggle={toggle} /></div><div className="schedule-side panel"><span className="calendar-icon">▦</span><p className="eyebrow">MAKE A PLAN</p><h2>Give your goals a time and place.</h2><p className="muted">A short, focused review can make a big difference. Add notes to remember what you want to cover.</p><button className="button secondary" onClick={() => { setEditing(null); setFormOpen(true); }}>Plan a session</button><div className="side-stat"><strong>{completed.length}</strong><span>completed sessions</span></div></div></div>
  </>;
}
function ScheduleForm({ lectures, initial, timeFormatPreference, onPreferenceChange, onSave, onCancel }) {
  const [form, setForm] = useState({ subject: initial?.subject || "", topic: initial?.topic || "", date: initial?.date || today(), start: initial?.start || "19:00", end: initial?.end || "20:00", notes: initial?.notes || "" });
  const [timeFormat, setTimeFormat] = useState(() => timeFormatPreference === "24h" ? "24h" : "12h");
  const [timeDrafts, setTimeDrafts] = useState(() => ({ start: formatScheduleTime(initial?.start || "19:00", timeFormat), end: formatScheduleTime(initial?.end || "20:00", timeFormat) }));
  const [pickerField, setPickerField] = useState(null);
  function set(k, v) { setForm((s) => ({ ...s, [k]: v })); }
  useEffect(() => {
    if ((timeFormatPreference === "12h" || timeFormatPreference === "24h") && timeFormatPreference !== timeFormat) {
      setTimeDrafts((drafts) => Object.fromEntries(["start", "end"].map((field) => {
        const canonical = parseScheduleTime(drafts[field], timeFormat);
        return [field, canonical ? formatScheduleTime(canonical, timeFormatPreference) : drafts[field]];
      })));
      setTimeFormat(timeFormatPreference);
    }
  }, [timeFormatPreference]);
  const parsedTimes = { start: parseScheduleTime(timeDrafts.start, timeFormat), end: parseScheduleTime(timeDrafts.end, timeFormat) };
  const timeErrors = {
    start: parsedTimes.start ? "" : `Enter a valid ${timeFormat === "12h" ? "time such as 08:30 AM" : "time in HH:mm format"}.`,
    end: !parsedTimes.end ? `Enter a valid ${timeFormat === "12h" ? "time such as 08:30 AM" : "time in HH:mm format"}.` : parsedTimes.start && parsedTimes.end <= parsedTimes.start ? "End time must be later than start time." : "",
  };
  function changeFormat(nextFormat) {
    setTimeDrafts((drafts) => Object.fromEntries(["start", "end"].map((field) => {
      const canonical = parseScheduleTime(drafts[field], timeFormat);
      return [field, canonical ? formatScheduleTime(canonical, nextFormat) : drafts[field]];
    })));
    setTimeFormat(nextFormat);
    onPreferenceChange({ timeFormat: nextFormat });
  }
  function editTime(field, value) {
    setTimeDrafts((drafts) => ({ ...drafts, [field]: value }));
    const canonical = parseScheduleTime(value, timeFormat);
    if (canonical) set(field, canonical);
  }
  function chooseTime(field, value) {
    set(field, value);
    setTimeDrafts((drafts) => ({ ...drafts, [field]: formatScheduleTime(value, timeFormat) }));
  }
  function timeField(field, label) {
    const errorId = `schedule-${field}-time-error`;
    return <ScheduleTimeField field={field} label={label} format={timeFormat} canonicalTime={form[field]} draft={timeDrafts[field]} error={timeErrors[field]} errorId={errorId} open={pickerField === field} onOpenChange={(nextOpen) => setPickerField(nextOpen ? field : null)} onDraftChange={(value) => editTime(field, value)} onCommit={(value) => chooseTime(field, value)} onNormalize={(canonical) => setTimeDrafts((drafts) => ({ ...drafts, [field]: formatScheduleTime(canonical, timeFormat) }))} parseTime={parseScheduleTime} formatTime={formatScheduleTime} getParts={getScheduleTimeParts} toCanonical={scheduleTimeFromParts} />;
  }
  function submit(event) {
    event.preventDefault();
    if (!parsedTimes.start || !parsedTimes.end || parsedTimes.end <= parsedTimes.start) return;
    onSave({ ...form, start: parsedTimes.start, end: parsedTimes.end });
  }
  return <form className="panel form-panel" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">{initial?.id ? "UPDATE SESSION" : "MAKE TIME TO STUDY"}</p><h2>{initial?.id ? "Edit session" : "Add study session"}</h2></div></div><div className="form-grid"><label>Subject<input list="subjects" required value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Microbiology" /><datalist id="subjects">{[...new Set(lectures.map((l) => l.subject))].map((s) => <option key={s} value={s} />)}</datalist></label><label>Lecture or topic<input list="topics" required value={form.topic} onChange={(e) => set("topic", e.target.value)} placeholder="What will you study?" /><datalist id="topics">{lectures.map((l) => <option key={l.id} value={l.title} />)}</datalist></label><label>Date<input required type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></label><div className="time-fields"><div className="schedule-time-format"><label htmlFor="schedule-time-format-select">Time Format</label><Select value={timeFormat} onValueChange={changeFormat}><SelectTrigger id="schedule-time-format-select" aria-label="Time Format" className="schedule-format-trigger"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12h">12-hour (AM/PM)</SelectItem><SelectItem value="24h">24-hour</SelectItem></SelectContent></Select></div>{timeField("start", "Start")}{timeField("end", "End")}</div><label className="wide">Notes <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows="2" placeholder="Optional reminders for your session" /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button className="button primary" disabled={!parsedTimes.start || !parsedTimes.end || parsedTimes.end <= parsedTimes.start}>{initial?.id ? "Save changes" : "Add to schedule"}</button></div></form>;
}
function ScheduleGroup({ title, date, sessions, onEdit, onDelete, onToggle }) { return <section className="schedule-group"><div className="schedule-group-heading"><div><p className="eyebrow">{title}</p>{date && <h2>{date}</h2>}</div><span>{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span></div>{sessions.length ? sessions.map((s) => <article className={`panel session-card ${s.completed ? "session-done" : ""}`} key={s.id}><div className="session-time"><strong>{fmtTime(s.start)}</strong><span>{fmtTime(s.end)}</span></div><div className="session-info"><div className="session-header"><span className="subject-label">{s.subject}</span><span className={`status ${s.completed ? "complete" : "upcoming"}`}>{s.completed ? "Completed" : s.date === today() && new Date().toTimeString().slice(0, 5) >= s.start && new Date().toTimeString().slice(0, 5) <= s.end ? "In progress" : "Upcoming"}</span></div><h3>{s.topic}</h3>{s.notes && <p>{s.notes}</p>}{s.date !== today() && <small>{fmtDate(s.date)}</small>}<div className="session-actions"><button className="text-button" onClick={() => onToggle(s.id)}>{s.completed ? "↶ Mark upcoming" : "✓ Mark complete"}</button><button className="text-button" onClick={() => onEdit(s)}>Edit</button><button className="text-button delete-text" onClick={() => onDelete(s.id)}>Delete</button></div></div></article>) : <div className="panel schedule-empty"><span>◷</span><p>Nothing scheduled here yet.</p></div>}</section>; }

function LectureViewer({ lecture, onBack, onToggle, onSchedule, onQuiz, onCustomizeSettings, generating, onSummarize, summarizing })  {
  const [previewSize, setPreviewSize] = useState("normal");
  const previewRef = useRef(null);
  const youtube = lecture.fileName?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i);
  const src = youtube ? `https://www.youtube-nocookie.com/embed/${youtube[1]}` : lecture.fileData;
  const video = youtube || lecture.fileType?.startsWith("video/");
  const pdf = lecture.fileType === "application/pdf";
  const hasTextPreview = Boolean(lecture.lectureContent?.trim()) && !pdf && !video;
  return <>
    <button className="back-link" onClick={onBack}>← &nbsp;Back to lectures</button>
    <div className="viewer-heading"><div><p className="eyebrow">{lecture.subject}</p><h1>{lecture.title}</h1><p className="subheading">{lecture.description || "Study material"}</p></div><span className={`status ${lecture.studied ? "complete" : "pending"}`}>{lecture.studied ? "✓ Studied" : "Not studied"}</span></div>
    <section ref={previewRef} className={`panel viewer-panel viewer-size-${previewSize}`}>
      <div className="viewer-size-controls" role="group" aria-label="Lecture preview size"><span>Preview size</span>{[["compact", "Compact"], ["normal", "Default"], ["large", "Large"]].map(([value, label]) => <button key={value} type="button" className={previewSize === value ? "selected" : ""} aria-pressed={previewSize === value} onClick={() => setPreviewSize(value)}>{label}</button>)}</div>
      {src && pdf ? <iframe className="document-viewer" src={`${src}#zoom=page-fit`} title={lecture.title} /> : youtube ? <iframe className="video-viewer" src={src} title={lecture.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : src && lecture.fileType?.startsWith("video/") ? <video className="video-viewer" controls src={src} /> : hasTextPreview ? <article className="notes-text-preview" aria-label={`${lecture.title} extracted notes`}><h2>{lecture.fileName || "Lecture notes"}</h2><div>{lecture.lectureContent}</div></article> : <div className="file-preview"><span className="file-icon large">▤</span><h2>{lecture.fileName || "Your lecture notes"}</h2><p>{lecture.fileName ? "This file is ready to open or download." : "Use the description below as a starting point for your review."}</p>{lecture.fileData && <a className="button secondary" href={lecture.fileData} download={lecture.fileName}>Download file</a>}</div>}
      <div className="viewer-description"><p className="eyebrow">LECTURE NOTES</p><p>{lecture.description || "No description was added for this lecture."}</p>{lecture.fileName && !lecture.fileData && <p className="muted small-text">The file name is saved in your library. Reattach files up to 3 MB for an in-app preview; YouTube links can be pasted as the file URL when adding a lecture.</p>}<button className="button secondary summarize-button" onClick={onSummarize} disabled={summarizing}>{summarizing ? "Summarizing notes…" : "✦ Summarize notes"}</button>{lecture.summary && <div className="lecture-summary" aria-live="polite"><p className="eyebrow">SUMMARY</p><SummaryContent text={lecture.summary} /></div>}</div>
    </section>
    <div className="viewer-actions">
  <button className="button primary" onClick={onToggle}>
    {lecture.studied
      ? "✓ Studied · Mark for review"
      : "✓ Mark as studied"}
  </button>

  <button className="button secondary" onClick={onSchedule}>
    ＋ Add to schedule
  </button>

  <button className="button primary" onClick={onQuiz} disabled={generating}>
    {generating ? "Generating your quiz…" : "✧ Generate Quiz Now"}
  </button>

  <button className="button secondary" onClick={onCustomizeSettings} disabled={generating}>
    Customize quiz
  </button>

  <button className="button secondary" onClick={onSummarize}>
    ✨ Summarize notes
  </button>
</div>
</>
}

function normalizeSummaryMath(text) {
  return text
    .replace(/\\sqrt\[3\]\{([^{}]+)\}/g, "∛$1")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)")
    .replace(/\\infty\b/g, "∞")
    .replace(/\\neq?\b/g, "≠")
    .replace(/\\leq?\b/g, "≤")
    .replace(/\\geq?\b/g, "≥")
    .replace(/\\times\b/g, "×")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\pi\b/g, "π")
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\([{}])/g, "$1")
    .replace(/\^([0-9]+)/g, (_, digits) => [...digits].map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]).join(""));
}

function formatSummaryInline(text) {
  const pieces = text.split(/(\*\*[^*]+\*\*|\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|`[^`]+`)/g).filter(Boolean);
  return pieces.map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) return <strong key={index}>{piece.slice(2, -2)}</strong>;
    if ((piece.startsWith("$$") && piece.endsWith("$$")) || (piece.startsWith("$") && piece.endsWith("$"))) {
      return <InlineMath math={piece.startsWith("$$") ? piece.slice(2, -2) : piece.slice(1, -1)} key={index} />;
    }
    if (piece.startsWith("\\(") && piece.endsWith("\\)")) return <InlineMath math={piece.slice(2, -2)} key={index} />;
    if (piece.startsWith("\\[") && piece.endsWith("\\]")) return <InlineMath math={piece.slice(2, -2)} key={index} />;
    if (piece.startsWith("`") && piece.endsWith("`")) return <code key={index}>{piece.slice(1, -1)}</code>;
    return normalizeSummaryMath(piece);
  });
}

function InlineMath({ math }) {
  const html = katex.renderToString(math, { displayMode: false, throwOnError: false, strict: "ignore", trust: false });
  return <span className="summary-inline-math" aria-label={math} dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderFunctionSummary(item) {
  const sections = item.split(/\s*(?:·|;)\s*(?=(?:Graph|Description|Domain|Range):)/i);
  return sections.map((section, index) => {
    const field = section.match(/^\*\*(Graph|Description|Domain|Range):\*\*\s*(.*)$/i) || section.match(/^\*\*(Graph|Description|Domain|Range)\*\*:\s*(.*)$/i) || section.match(/^(Graph|Description|Domain|Range):\s*(.*)$/i);
    if (field) {
      const math = /^(Domain|Range)$/i.test(field[1]);
      const value = math ? <InlineMath math={field[2].replace(/^\$(.*)\$$/, "$1")} /> : formatSummaryInline(field[2]);
      return <span className="summary-function-part" key={index}>{index > 0 && <span className="summary-function-separator"> · </span>}<strong>{field[1]}:</strong> {value}</span>;
    }
    const named = section.match(/^([^:]+):\s*(.*)$/);
    if (index === 0 && named) {
      const equation = named[2].match(/^\$([^$]+)\$(.*)$/) || named[2].match(/^([A-Za-z]\s*=\s*.+?)(?=\s+[—–-]\s+|$)(.*)$/);
      if (equation) {
        const formula = equation[1].startsWith("$") ? equation[1].slice(1, -1) : equation[1];
        return <span className="summary-function-part" key={index}><strong>{named[1]}:</strong> <InlineMath math={formula} />{equation[2] && <> {formatSummaryInline(equation[2])}</>}</span>;
      }
      return <span className="summary-function-part" key={index}><strong>{named[1]}:</strong> {formatSummaryInline(named[2])}</span>;
    }
    return <span className="summary-function-part" key={index}>{formatSummaryInline(section)}</span>;
  });
}

function SummaryContent({ text }) {
  const blocks = [];
  let listItems = [];
  let orderedList = false;
  const flushList = () => {
    if (listItems.length) {
      const List = orderedList ? "ol" : "ul";
      blocks.push(<List key={`list-${blocks.length}`}>{listItems.map((item, index) => {
        const isFunction = orderedList && /(?:Domain|Range):/i.test(item);
        return <li className={isFunction ? "summary-function" : undefined} key={index}>{isFunction ? renderFunctionSummary(item) : formatSummaryInline(item)}</li>;
      })}</List>);
    }
    listItems = [];
  };

  text.replace(/\r/g, "").split("\n").forEach((line) => {
    const content = line.trim();
    if (!content) { if (!orderedList) flushList(); return; }
    if (/^(---+|___+|\*\*\*+)$/.test(content)) { flushList(); return; }
    const heading = content.match(/^(#{1,6})\s+(.+)$/) || content.match(/^<h[1-6]>(.*?)<\/h[1-6]>$/i);
    if (heading) { flushList(); blocks.push(<h3 key={`heading-${blocks.length}`}>{formatSummaryInline(heading[2] || heading[1])}</h3>); return; }
    const numberedItem = content.match(/^\d+[.)]\s+(.+)$/);
    const bulletItem = content.match(/^[*+-]\s+(.+)$/);
    if (numberedItem || bulletItem) {
      const isOrdered = Boolean(numberedItem);
      if (listItems.length && orderedList !== isOrdered) flushList();
      orderedList = isOrdered;
      listItems.push((numberedItem || bulletItem)[1]); return;
    }
    const functionField = content.match(/^\*\*(Graph|Description|Domain|Range):\*\*\s*(.+)$/i) || content.match(/^\*\*(Graph|Description|Domain|Range)\*\*:\s*(.+)$/i) || content.match(/^(Graph|Description|Domain|Range):\s*(.+)$/i);
    if (orderedList && listItems.length && functionField) {
      listItems[listItems.length - 1] += ` · ${functionField[1]}: ${functionField[2]}`;
      return;
    }
    flushList();
    blocks.push(<p key={`paragraph-${blocks.length}`}>{formatSummaryInline(content)}</p>);
  });
  flushList();
  return <div className="summary-content">{blocks}</div>;
}
function QuizOptions({ lecture, onStart, onBack, isGenerating, error }) {
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(5);
  const [type, setType] = useState("Multiple choice");
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const settings = { difficulty, count, type, includeExplanations };
  return <>
    <button className="back-link" onClick={onBack}>← &nbsp;Back to quizzes</button>
    <section className="panel quiz-options-panel">
      <p className="eyebrow">GENERATE A QUIZ · {lecture.subject}</p>
      <h1>{lecture.title}</h1>
      <p className="subheading">Start right away with five medium-difficulty multiple-choice questions, or optionally choose your settings.</p>
      <button className="button primary quiz-generate-now" disabled={isGenerating} onClick={() => onStart(DEFAULT_QUIZ_SETTINGS)}>
        {isGenerating ? "Generating your quiz…" : "Generate Quiz Now"}
      </button>
      <button type="button" className="quiz-customize-toggle" aria-expanded={customizing} onClick={() => setCustomizing((open) => !open)}>
        {customizing ? "Hide customization ▲" : "Customize Quiz ▼"}
      </button>
      {customizing && <div className="quiz-custom-panel">
        <div className="quiz-settings-grid">
          <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option>Easy</option><option>Medium</option><option>Hard</option></select><small>{difficulty === "Easy" ? "Recall key terms and definitions." : difficulty === "Hard" ? "Analyze and apply related ideas." : "Explain concepts and connect ideas."}</small></label>
          <label>Questions<select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value="5">5 questions</option><option value="10">10 questions</option><option value="15">15 questions</option><option value="20">20 questions</option></select></label>
          <label>Question type<select value={type} onChange={(event) => setType(event.target.value)}><option>Multiple choice</option><option>True / False</option><option>Mixed</option><option>Multi-select</option><option>Problem solving</option></select><small>Every question is grounded in the selected lecture.</small></label>
        </div>
        <label className="quiz-explanation-setting"><input type="checkbox" checked={includeExplanations} onChange={(event) => setIncludeExplanations(event.target.checked)} /> Include short explanations for correct answers</label>
        <div className="form-actions"><button className="button primary" disabled={isGenerating} onClick={() => onStart(settings)}>{isGenerating ? "Generating your quiz…" : "Generate Customized Quiz"}</button></div>
      </div>}
      {isGenerating && <p className="quiz-generation-status" role="status">Generating your quiz from the lecture content…</p>}
      {error && <p className="quiz-setup-message" role="alert">{error}</p>}
    </section>
  </>;
}

function QuizRun({ state, lecture, onChange, onFinish, onRetry, onReview, onBack }) {
  const index = state.index;
  const question = state.questions[index];
  const selected = state.answers[index] || "";
  const submitted = Boolean(state.submitted[index]);
  const isCorrect = answerMatches(question, selected);
  const progress = getQuizProgress(state.submitted, state.questions.length);
  const elapsed = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
  function update(changes) { onChange((current) => ({ ...current, ...changes })); }
  function choose(option) {
    if (submitted) return;
    const value = question.type === "Multi-select"
      ? (Array.isArray(selected) ? selected : []).includes(option)
        ? selected.filter((item) => item !== option)
        : [...(Array.isArray(selected) ? selected : []), option]
      : option;
    update({ answers: { ...state.answers, [index]: value } });
  }
  function submitCurrent() {
    if (!selected || (Array.isArray(selected) && !selected.length)) return;
    if (submitted) {
      if (index === state.questions.length - 1) onFinish(state.answers);
      return;
    }
    update({ submitted: { ...state.submitted, [index]: true } });
  }
  function previous() { update({ index: getQuizQuestionIndex(index, -1, state.questions.length) }); }
  function next() { update({ index: getQuizQuestionIndex(index, 1, state.questions.length) }); }
  if (state.done) {
    const mistakes = state.questions.filter((item, i) => !answerMatches(item, state.answers[i])).length;
    const seconds = state.attempt?.seconds || elapsed;
    const scorePct = percent(state.score, state.questions.length);
    return <><button className="back-link" onClick={onBack}>← &nbsp;Back to quizzes</button><section className="panel quiz-wrap quiz-result"><div className="quiz-success">{scorePct >= 70 ? "✓" : "↗"}</div><p className="eyebrow">QUIZ RESULTS · {state.config?.difficulty || "Medium"}</p><h1>{scorePct >= 80 ? "Excellent work!" : scorePct >= 60 ? "Good progress—keep practicing." : "A good starting point for review."}</h1><p className="subheading">{lecture.title}</p><div className="score-circle"><strong>{scorePct}%</strong><span>score</span></div><div className="score-details"><div><strong>{state.score}</strong><span>Correct</span></div><div><strong>{mistakes}</strong><span>Incorrect</span></div><div><strong>{Math.floor(seconds / 60)}m {seconds % 60}s</strong><span>Time</span></div></div>{scorePct < 60 && <p className="quiz-low-score">Review this topic before your next attempt to strengthen your mastery.</p>}<div className="quiz-result-actions">{mistakes > 0 && <button className="button secondary" onClick={onReview}>Review mistakes</button>}<button className="button primary" onClick={onRetry}>↻ Try again</button><button className="button secondary" onClick={onBack}>Back to quizzes</button></div></section></>;
  }
  return <><button className="back-link" onClick={() => { if (window.confirm("Leave this quiz? Your current answers will be lost.")) onBack(); }}>← &nbsp;Exit quiz</button><section className="panel quiz-wrap quiz-run-panel"><div className="quiz-top"><div><p className="eyebrow">{lecture.subject} · {state.config?.difficulty || "Medium"}</p><h1>{lecture.title}</h1></div><span className="quiz-counter">{String(index + 1).padStart(2, "0")} / {String(state.questions.length).padStart(2, "0")}</span></div><div className="quiz-progress-track"><span style={{ width: `${Math.max(5, progress)}%` }} /></div><div className="quiz-run-content"><p className="question-label">QUESTION {index + 1} · {question.type || state.config?.type || "Multiple choice"}</p><h2 className="quiz-question">{question.question}</h2><div className="quiz-options">{question.options.map((option, choiceIndex) => { const isSelected = Array.isArray(selected) ? selected.includes(option) : selected === option; const isRight = Array.isArray(question.correctAnswer) ? question.correctAnswer.includes(option) : question.correctAnswer === option; return <button key={`${option}-${choiceIndex}`} type="button" className={`quiz-option ${isSelected ? "selected" : ""} ${submitted && isRight ? "correct" : ""} ${submitted && isSelected && !isRight ? "incorrect" : ""}`} disabled={submitted} aria-pressed={isSelected} onClick={() => choose(option)}><span className="quiz-choice-letter">{String.fromCharCode(65 + choiceIndex)}</span><span className="quiz-option-text">{option}</span>{submitted && isRight && <span className="quiz-option-mark">✓</span>}</button>; })}</div>{!submitted && <div className="quiz-hint-area"><button className="text-button" type="button" onClick={() => update({ hints: { ...state.hints, [index]: true } })}>Show hint</button>{state.hints[index] && <p className="quiz-hint">{question.hint}</p>}</div>}{submitted && <div className={`quiz-feedback ${isCorrect ? "is-correct" : "is-incorrect"}`} role="status"><strong>{isCorrect ? "That’s right." : `Not quite. The answer is: ${answerText(question.correctAnswer)}`}</strong>{question.explanation && <p>{question.explanation}</p>}</div>}</div><div className="quiz-run-footer"><span>{index + 1} of {state.questions.length} questions</span><div><button className="button secondary" onClick={previous} disabled={index === 0}>← Previous</button>{submitted && index < state.questions.length - 1 ? <button className="button primary" onClick={next}>Next question →</button> : <button className="button primary" onClick={submitCurrent} disabled={!selected || (Array.isArray(selected) && !selected.length)}>{submitted ? "Finish quiz" : "Submit answer"}</button>}</div></div></section></>;
}

function QuizReview({ state, lecture, onStudy, onRetry, onBack }) {
  const mistakes = state.questions.map((question, index) => ({ question, index })).filter(({ question, index }) => !answerMatches(question, state.answers[index]));
  return <><button className="back-link" onClick={onBack}>← &nbsp;Back to results</button><section className="quiz-review"><PageHeading eyebrow="LEARN FROM MISSES" title="Review mistakes" subtitle={`${mistakes.length} question${mistakes.length === 1 ? "" : "s"} to revisit in ${lecture.title}.`} />{mistakes.map(({ question, index }) => <article className="panel quiz-review-card" key={question.id}><p className="question-label">QUESTION {index + 1} · {question.topic}</p><h2>{question.question}</h2><p><span>Your answer</span><strong>{answerText(state.answers[index])}</strong></p><p><span>Correct answer</span><strong>{answerText(question.correctAnswer)}</strong></p>{question.explanation && <p className="quiz-review-explanation">{question.explanation}</p>}<button className="text-button" onClick={onStudy}>Study this topic →</button></article>)}{!mistakes.length && <div className="panel"><p>No mistakes to review. Nice work!</p></div>}<div className="quiz-result-actions"><button className="button primary" onClick={onRetry}>Try again</button><button className="button secondary" onClick={onStudy}>Back to lesson</button></div></section></>;
}

function QuizHistory({ attempts, lectures, savedQuizzes, onQuiz, onCustomizeSettings, onEditQuestions, onOpenSaved, generatingLectureId, error }) {
  return <>
    <PageHeading eyebrow="PRACTICE, REFLECT, REPEAT" title="Quizzes" subtitle="Generate a quiz right away or optionally customize it. Your saved quizzes and scores sync to your account." />
    {error && <p className="quiz-setup-message" role="alert">{error}</p>}
    <div className="quiz-start-grid">
      {lectures.map((lecture) => {
        const count = getLectureQuestions(lecture).length;
        const hasMaterial = Boolean(
          lecture.lectureContent?.trim()
          || lecture.summary?.trim()
          || (lecture.description?.trim().length || 0) >= 80
          || (lecture.fileData && !lecture.fileType?.startsWith("video/"))
          || count,
        );
        const busy = generatingLectureId === lecture.id;
        const topicAttempts = attempts.filter((attempt) => attempt.lectureId === lecture.id);
        const best = topicAttempts.length ? Math.max(...topicAttempts.map((attempt) => percent(attempt.score, attempt.total))) : null;
        const average = topicAttempts.length ? Math.round(topicAttempts.reduce((sum, attempt) => sum + percent(attempt.score, attempt.total), 0) / topicAttempts.length) : null;
        return <article className="panel quiz-start-card" key={lecture.id}>
          <div className="quiz-card-icon">✧</div>
          <span className="subject-label">{lecture.subject}</span>
          <h2>{lecture.title}</h2>
          <p>{count ? `${count} lecture-specific questions · Unlimited attempts` : hasMaterial ? "Generate questions from this lecture's content" : "Add notes or a transcript to generate a quiz"}</p>
          {best !== null && <p className="quiz-topic-stat">Best {best}% · Average {average}% across {topicAttempts.length} attempt{topicAttempts.length === 1 ? "" : "s"}</p>}
          <div className="quiz-start-actions">
            <button className="button primary" disabled={Boolean(generatingLectureId) || !hasMaterial} title={!hasMaterial ? "Add lecture notes or a transcript first." : ""} onClick={() => onQuiz(lecture)}>
              {busy ? "Generating your quiz…" : "Generate Quiz Now"}
            </button>
            <button className="button secondary" disabled={Boolean(generatingLectureId)} onClick={() => onCustomizeSettings(lecture)}>Customize Quiz</button>
          </div>
          {count > 0 && <button className="quiz-customize-button" disabled={busy} onClick={() => onEditQuestions(lecture)}>Edit question bank <span>(optional)</span></button>}
        </article>;
      })}
    </div>
    {savedQuizzes.length > 0 && <section className="panel saved-quizzes-panel">
      <div className="panel-heading"><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Saved quizzes <span className="pill-count">{savedQuizzes.length}</span></h2></div></div>
      <div className="saved-quiz-list">
        {[...savedQuizzes].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).map((quiz) => (
          <article className="saved-quiz-row" key={quiz.id}>
            <div><strong>{quiz.title}</strong><span>{quiz.subject} · {quiz.questions?.length || 0} questions · {quiz.config?.difficulty || "Medium"}</span></div>
            <button className="button secondary small" onClick={() => onOpenSaved(quiz)}>Reopen quiz →</button>
          </article>
        ))}
      </div>
    </section>}
    <section className="panel history-panel">
      <div className="panel-heading"><div><p className="eyebrow">YOUR PRACTICE LOG</p><h2>Quiz history <span className="pill-count">{attempts.length}</span></h2></div></div>
      {attempts.length ? <div className="history-table">
        <div className="history-head"><span>QUIZ</span><span>DATE</span><span>SCORE</span><span>RESULT</span></div>
        {attempts.map((attempt) => <div className="history-row" key={attempt.id}>
          <div><strong>{attempt.title}</strong><small>{attempt.subject} · {attempt.difficulty || "Medium"}</small></div>
          <span>{new Date(attempt.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          <strong>{attempt.score}/{attempt.total}</strong><span className="result-pill">{percent(attempt.score, attempt.total)}%</span>
        </div>)}
      </div> : <Empty text="Your quiz attempts will show up here." />}
    </section>
  </>;
}
function ProgressPage({ lectures, attempts, studied, completion }) { const scores = attempts.map((a) => percent(a.score, a.total)); const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0; const highest = scores.length ? Math.max(...scores) : 0; const subjects = [...new Set(lectures.map((l) => l.subject))]; const topics = lectures.map((lecture) => { const topicAttempts = attempts.filter((attempt) => attempt.lectureId === lecture.id); const average = topicAttempts.length ? Math.round(topicAttempts.reduce((sum, attempt) => sum + percent(attempt.score, attempt.total), 0) / topicAttempts.length) : null; const best = topicAttempts.length ? Math.max(...topicAttempts.map((attempt) => percent(attempt.score, attempt.total))) : null; return { lecture, average, best, tries: topicAttempts.length }; }); const needsReview = topics.filter((topic) => topic.average !== null && topic.average < 60); return <><PageHeading eyebrow="NOTICE HOW FAR YOU'VE COME" title="Your progress" subtitle="A simple snapshot of your study habits and quiz practice." /><div className="stats-grid progress-stats"><Stat icon="✓" tint="mint" label="Study progress" value={`${studied} / ${lectures.length}`} foot={`${completion}% of lectures studied`} /><Stat icon="✧" tint="lavender" label="Quizzes taken" value={attempts.length} foot="Every attempt counts" /><Stat icon="↗" tint="peach" label="Average score" value={`${avg}%`} foot={attempts.length ? "Across all your attempts" : "Your first quiz is waiting"} /><Stat icon="★" tint="blue" label="Personal best" value={`${highest}%`} foot="Your highest quiz score" /></div><ScoreTrendChart attempts={attempts} /><section className="panel subject-progress"><div className="panel-heading"><div><p className="eyebrow">ONE STEP AT A TIME</p><h2>Progress by subject</h2></div></div>{subjects.length ? subjects.map((subject, index) => { const group = lectures.filter((l) => l.subject === subject); const done = group.filter((l) => l.studied).length; const value = percent(done, group.length); return <div className="subject-progress-row" key={subject}><div className="subject-row-label"><div className={`subject-icon subject-color-${index % 4}`}>{subject.slice(0, 1)}</div><strong>{subject}</strong><span>{done} of {group.length} studied</span><b>{value}%</b></div><ProgressBar value={value} color={index % 2 ? "purple" : "green"} /></div>; }) : <Empty text="Add lectures to see progress by subject." />}</section><section className="panel subject-progress quiz-mastery"><div className="panel-heading"><div><p className="eyebrow">QUIZ MASTERY</p><h2>Progress by topic</h2></div></div>{topics.length ? topics.map(({ lecture, average, best, tries }) => <div className="quiz-mastery-row" key={lecture.id}><div><strong>{lecture.title}</strong><span>{tries ? `${tries} attempt${tries === 1 ? "" : "s"} · Best ${best}% · Average ${average}%` : "No quiz attempts yet"}</span></div>{average !== null && <b className={average < 60 ? "needs-review" : ""}>{average}%</b>}</div>) : <Empty text="Add lectures to see quiz mastery." />}{needsReview.length > 0 && <p className="quiz-review-reminder">Review suggested: {needsReview.map(({ lecture }) => lecture.title).join(", ")}. A short revision session may help.</p>}</section><section className="panel study-insight"><span>✦</span><div><strong>Progress is built one session at a time.</strong><p>Keep checking off topics and revisiting quizzes to see your confidence grow.</p></div></section></>; }

export default App;
