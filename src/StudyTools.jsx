import { useEffect, useMemo, useState } from "react";
import { BookOpen, Brain, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Flame, Pause, Pencil, Play, Plus, RotateCcw, Sparkles, Star, Target, Trash2, Trophy } from "lucide-react";
import { ProfileShowcase } from "./components/ProfileShowcase.jsx";

const localDay = (value = new Date()) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const dateLabel = (value, options = { month: "short", day: "numeric" }) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, options) : "No date";
const safeDate = (value) => value ? new Date(value) : new Date();
const cardDue = (card) => !card.dueAt || new Date(card.dueAt) <= new Date();
function shuffleList(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function SectionHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subheading">{subtitle}</p></div>{action}</div>;
}

export function FlashcardsPage({ cards, lectures, onCreate, onUpdate, onDelete, notify }) {
  const [deck, setDeck] = useState("All decks");
  const [shuffleCards, setShuffleCards] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [studyDeck, setStudyDeck] = useState(null);
  const [studyIds, setStudyIds] = useState([]);
  const [flipped, setFlipped] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [form, setForm] = useState({ front: "", back: "", subject: "", deck: "", frontImage: "", backImage: "" });
  const decks = useMemo(() => [...new Set(cards.map((card) => card.deck || card.subject || "My cards"))].sort(), [cards]);
  const visibleCards = cards.filter((card) => deck === "All decks" || (card.deck || card.subject || "My cards") === deck);
  const studyCards = useMemo(() => studyIds.map((id) => cards.find((card) => card.id === id)).filter(Boolean), [cards, studyIds]);
  const activeCard = studyCards[cardIndex];
  function updateForm(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event) {
    event.preventDefault();
    if (!form.front.trim() || !form.back.trim()) return;
    const result = await onCreate({ ...form, front: form.front.trim(), back: form.back.trim(), subject: form.subject || "General", deck: form.deck.trim() || form.subject || "My cards", intervalDays: 0, repetitions: 0, ease: 2.5, dueAt: new Date().toISOString(), createdAt: new Date().toISOString() });
    if (result !== false) { setForm({ front: "", back: "", subject: "", deck: "", frontImage: "", backImage: "" }); setIsCreating(false); }
  }
  function beginStudy(name) { setStudyDeck(name); const ids = (name === "Due cards" ? cards.filter(cardDue) : cards.filter((card) => (card.deck || card.subject || "My cards") === name)).map((card) => card.id); setStudyIds(shuffleCards ? shuffleList(ids) : ids); setCardIndex(0); setFlipped(false); }
  async function review(rating) {
    if (!activeCard) return;
    const intervals = { again: 0, hard: Math.max(1, Math.round((activeCard.intervalDays || 0) * 1.2) || 1), good: activeCard.intervalDays ? Math.max(1, Math.round(activeCard.intervalDays * (activeCard.ease || 2.5))) : 1, easy: activeCard.intervalDays ? Math.max(2, Math.round(activeCard.intervalDays * (activeCard.ease || 2.5) * 1.35)) : 3 };
    const intervalDays = intervals[rating];
    const dueAt = new Date(Date.now() + (rating === "again" ? 10 * 60 * 1000 : intervalDays * 86400000)).toISOString();
    const ease = Math.max(1.3, (activeCard.ease || 2.5) + (rating === "easy" ? 0.15 : rating === "again" ? -0.2 : 0));
    const saved = await onUpdate(activeCard.id, { intervalDays, repetitions: (activeCard.repetitions || 0) + (rating === "again" ? 0 : 1), ease, dueAt, lastReviewedAt: new Date().toISOString(), reviewCount: (activeCard.reviewCount || 0) + 1 });
    if (saved === false) return;
    setFlipped(false);
    if (cardIndex + 1 < studyCards.length) setCardIndex(cardIndex + 1);
    else { setStudyDeck(null); setStudyIds([]); setCardIndex(0); notify?.("Review session complete. Nice work."); }
  }
  if (studyDeck) return <>
    <button className="back-link" onClick={() => setStudyDeck(null)}><ChevronLeft size={16} /> Back to flashcards</button>
    <section className="panel flash-study-panel">
      <div className="flash-study-top"><span className="eyebrow">{studyDeck === "Due cards" ? "SPACED REVIEW" : studyDeck.toUpperCase()}</span><span>{Math.min(cardIndex + 1, studyCards.length)} / {studyCards.length}</span></div>
      {activeCard ? <>
        <button className={`flash-study-card${flipped ? " is-flipped" : ""}`} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Show flashcard front" : "Reveal flashcard answer"}>
          <span className="flash-card-side-label">{flipped ? "ANSWER" : "PROMPT"}</span>
          {flipped && activeCard.backImage && <img src={activeCard.backImage} alt="Flashcard answer" />}
          {!flipped && activeCard.frontImage && <img src={activeCard.frontImage} alt="Flashcard prompt" />}
          <strong>{flipped ? activeCard.back : activeCard.front}</strong><small>Click or tap to {flipped ? "see prompt" : "reveal answer"}</small>
        </button>
        {flipped && <div className="flash-rating-row"><span>How well did you recall it?</span><div><button className="button secondary" onClick={() => review("again")}>Again · 10 min</button><button className="button secondary" onClick={() => review("hard")}>Hard · 1 day</button><button className="button primary" onClick={() => review("good")}>Good</button><button className="button primary" onClick={() => review("easy")}>Easy</button></div></div>}
      </> : <div className="empty-state"><span><Check /></span><p>{studyDeck === "Due cards" ? "No cards are due. Choose a deck to review ahead." : "This deck has no cards to review."}</p><button className="button secondary" onClick={() => { setStudyDeck(null); setStudyIds([]); }}>Back to decks</button></div>}
    </section>
  </>;
  return <>
    <SectionHeading eyebrow="RECALL, THEN REPEAT" title="Flashcards" subtitle="Build durable memory with quick, spaced review sessions." action={<button className="button primary" onClick={() => setIsCreating((value) => !value)}><Plus size={16} /> {isCreating ? "Close" : "Create cards"}</button>} />
    {isCreating && <form className="panel form-panel study-tool-form" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">NEW FLASHCARD</p><h2>Add a prompt and answer</h2></div></div><div className="form-grid"><label>Front<textarea required rows="3" maxLength="2000" value={form.front} onChange={(event) => updateForm("front", event.target.value)} placeholder="Question, term, or concept" /></label><label>Back<textarea required rows="3" maxLength="4000" value={form.back} onChange={(event) => updateForm("back", event.target.value)} placeholder="Answer or explanation" /></label><label>Subject<input list="flashcard-subjects" value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} placeholder="e.g. Biology" /><datalist id="flashcard-subjects">{[...new Set(lectures.map((lecture) => lecture.subject))].map((subject) => <option key={subject} value={subject} />)}</datalist></label><label>Deck<input value={form.deck} onChange={(event) => updateForm("deck", event.target.value)} placeholder="e.g. Cell structure" /></label><label>Front image URL<input type="url" value={form.frontImage} onChange={(event) => updateForm("frontImage", event.target.value)} placeholder="https://…" /></label><label>Back image URL<input type="url" value={form.backImage} onChange={(event) => updateForm("backImage", event.target.value)} placeholder="https://…" /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={() => setIsCreating(false)}>Cancel</button><button className="button primary">Save flashcard</button></div></form>}
    <section className="flash-summary-grid"><div className="panel flash-summary-card"><span className="stat-icon lavender"><Brain size={17} /></span><span className="stat-label">Cards in your library</span><strong className="stat-value">{cards.length}</strong><span className="stat-foot">Across {decks.length} {decks.length === 1 ? "deck" : "decks"}</span></div><div className="panel flash-summary-card"><span className="stat-icon mint"><RotateCcw size={17} /></span><span className="stat-label">Ready to review</span><strong className="stat-value">{cards.filter(cardDue).length}</strong><span className="stat-foot">Based on each card's next review time</span><button className="button secondary small" disabled={!cards.some(cardDue)} onClick={() => beginStudy("Due cards")}>Review due cards</button></div></section>
    <div className="flash-deck-toolbar"><h2>Your decks</h2><div className="flash-deck-controls"><select value={deck} onChange={(event) => setDeck(event.target.value)} aria-label="Filter flashcards by deck"><option>All decks</option>{decks.map((name) => <option key={name}>{name}</option>)}</select><button type="button" className={`button secondary small${shuffleCards ? " is-active" : ""}`} aria-pressed={shuffleCards} onClick={() => setShuffleCards((value) => !value)}>Shuffle {shuffleCards ? "on" : "off"}</button></div></div>
    <div className="flashcard-grid">{visibleCards.map((card) => <article className="panel flashcard-item" key={card.id}><div className="flashcard-item-head"><span className="subject-label">{card.subject || "General"}</span><button className="icon-button" aria-label={`Delete ${card.front}`} title="Delete card" onClick={() => { if (window.confirm("Delete this flashcard?")) onDelete(card.id); }}><Trash2 size={15} /></button></div><strong>{card.front}</strong><p>{card.back}</p><div className="flashcard-item-foot"><span>{card.deck || "My cards"}</span><span>{cardDue(card) ? "Due now" : `Due ${dateLabel(localDay(safeDate(card.dueAt)))}`}</span></div></article>)}{!visibleCards.length && <div className="panel empty-library"><span><Brain /></span><h2>Start with one card</h2><p>Your custom cards sync with your account and are ready on your next visit.</p><button className="button secondary" onClick={() => setIsCreating(true)}>Create your first flashcard</button></div>}</div>
    {decks.length > 0 && <section className="flash-deck-list"><h2>Study a deck</h2><div className="flash-deck-buttons">{decks.map((name) => <button className="panel flash-deck-button" key={name} onClick={() => beginStudy(name)}><span className="subject-icon">{name.slice(0, 1).toUpperCase()}</span><span><strong>{name}</strong><small>{cards.filter((card) => (card.deck || card.subject || "My cards") === name).length} cards</small></span><ChevronRight size={18} /></button>)}</div></section>}
  </>;
}

export function PlannerPage({ tasks, sessions, lectures, onCreate, onUpdate, onDelete, onSessionComplete, onOpenSchedule }) {
  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [isCreating, setIsCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [form, setForm] = useState({ title: "", subject: "", dueDate: localDay(), priority: "Medium", notes: "", recurring: "None" });
  const dayKey = localDay(anchor);
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), view === "month" ? 1 : anchor.getDate() - anchor.getDay());
  const rangeDays = view === "day" ? 1 : view === "week" ? 7 : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: rangeDays }, (_, index) => { const date = new Date(firstDay); date.setDate(firstDay.getDate() + index); return localDay(date); });
  const visibleDates = new Set(dates);
  const visibleTasks = tasks.filter((task) => visibleDates.has(task.dueDate)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]));
  const visibleSessions = sessions.filter((session) => visibleDates.has(session.date)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const rangeTitle = view === "day" ? dateLabel(dayKey, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : view === "month" ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : `${dateLabel(dates[0])} – ${dateLabel(dates[6])}`;
  function shiftRange(amount) { setAnchor((current) => { const date = new Date(current); if (view === "day") date.setDate(date.getDate() + amount); else if (view === "week") date.setDate(date.getDate() + amount * 7); else date.setMonth(date.getMonth() + amount); return date; }); }
  function resetTaskForm() { setEditingTaskId(null); setForm({ title: "", subject: "", dueDate: localDay(), priority: "Medium", notes: "", recurring: "None" }); setIsCreating(false); }
  function editTask(task) { setEditingTaskId(task.id); setForm({ title: task.title || "", subject: task.subject || "", dueDate: task.dueDate || localDay(), priority: task.priority || "Medium", notes: task.notes || "", recurring: task.recurring || "None" }); setIsCreating(true); }
  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    const values = { ...form, title: form.title.trim(), subject: form.subject || "General" };
    const saved = editingTaskId ? await onUpdate(editingTaskId, values) : await onCreate({ ...values, completed: false, createdAt: new Date().toISOString() });
    if (saved !== false) resetTaskForm();
  }
  async function toggleTask(task) {
    const completed = !task.completed;
    const result = await onUpdate(task.id, { completed, completedAt: completed ? new Date().toISOString() : "" });
    if (result === false || !completed || task.recurring === "None") return;
    const next = new Date(`${task.dueDate}T12:00:00`);
    const recurrenceDay = task.recurring === "Monthly" ? (task.recurrenceDay || Number(task.dueDate.slice(-2))) : task.recurrenceDay;
    if (task.recurring === "Monthly") {
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(recurrenceDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    }
    else next.setDate(next.getDate() + (task.recurring === "Weekly" ? 7 : 1));
    const nextTask = { ...task, id: undefined, dueDate: localDay(next), completed: false, completedAt: "", createdAt: new Date().toISOString() };
    if (task.recurring === "Monthly") nextTask.recurrenceDay = recurrenceDay;
    else delete nextTask.recurrenceDay;
    await onCreate(nextTask);
  }
  return <>
    <SectionHeading eyebrow="MAKE TIME FOR WHAT MATTERS" title="Study planner" subtitle="Keep study sessions, exams, and assignment deadlines in one view." action={<button className="button primary" onClick={() => { resetTaskForm(); setIsCreating(true); }}><Plus size={16} /> Add task</button>} />
    {isCreating && <form className="panel form-panel study-tool-form" onSubmit={submit}><div className="panel-heading"><div><p className="eyebrow">{editingTaskId ? "UPDATE DEADLINE OR TASK" : "NEW DEADLINE OR TASK"}</p><h2>{editingTaskId ? "Edit your plan" : "Plan your next step"}</h2></div></div><div className="form-grid"><label>Task title<input required maxLength="160" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Review chapter 4" /></label><label>Subject<input list="planner-subjects" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="e.g. Biology" /><datalist id="planner-subjects">{[...new Set(lectures.map((lecture) => lecture.subject))].map((subject) => <option key={subject} value={subject} />)}</datalist></label><label>Due date<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label><label>Repeat<select value={form.recurring} onChange={(event) => setForm({ ...form, recurring: event.target.value })}><option>None</option><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label><label className="wide">Notes<textarea rows="2" maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional details" /></label></div><div className="form-actions"><button type="button" className="button secondary" onClick={resetTaskForm}>Cancel</button><button className="button primary">{editingTaskId ? "Save changes" : "Save task"}</button></div></form>}
    <section className="panel planner-calendar"><div className="planner-toolbar"><div className="planner-range-controls"><button className="icon-button" onClick={() => shiftRange(-1)} aria-label="Previous period"><ChevronLeft size={17} /></button><h2>{rangeTitle}</h2><button className="icon-button" onClick={() => shiftRange(1)} aria-label="Next period"><ChevronRight size={17} /></button><button className="button secondary small" onClick={() => setAnchor(new Date())}>Today</button></div><div className="planner-view-tabs" role="group" aria-label="Calendar view">{["day", "week", "month"].map((item) => <button key={item} className={view === item ? "selected" : ""} aria-pressed={view === item} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></div>
      {view === "month" && <div className="planner-month-grid">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong key={day}>{day}</strong>)}{Array.from({ length: firstDay.getDay() }, (_, index) => <span className="planner-month-blank" key={`blank-${index}`} />)}{dates.map((date) => { const taskCount = tasks.filter((task) => task.dueDate === date && !task.completed).length; const sessionCount = sessions.filter((session) => session.date === date).length; return <button className={`planner-month-day${date === localDay() ? " today" : ""}${date === dayKey ? " selected" : ""}`} key={date} onClick={() => { setAnchor(new Date(`${date}T12:00:00`)); setView("day"); }}><span>{Number(date.slice(-2))}</span>{(taskCount + sessionCount) > 0 && <small>{taskCount + sessionCount} item{taskCount + sessionCount === 1 ? "" : "s"}</small>}</button>; })}</div>}
      {view !== "month" && <div className="planner-agenda">{dates.map((date) => { const dayTasks = visibleTasks.filter((task) => task.dueDate === date); const daySessions = visibleSessions.filter((session) => session.date === date); return <section className="planner-day" key={date}><div className={`planner-day-label${date === localDay() ? " today" : ""}`}><strong>{dateLabel(date, { weekday: "short" })}</strong><span>{Number(date.slice(-2))}</span></div><div className="planner-day-items">{daySessions.map((session) => <article className={`planner-item planner-session${session.completed ? " completed" : ""}`} key={session.id}><CalendarDays size={15} /><span><strong>{session.topic}</strong><small>{session.subject} · {session.start}–{session.end}</small></span>{!session.completed && <button className="text-button" onClick={() => onSessionComplete(session.id)}>Complete</button>}</article>)}{dayTasks.map((task) => <article className={`planner-item planner-task${task.completed ? " completed" : ""}`} key={task.id}><input type="checkbox" checked={Boolean(task.completed)} onChange={() => toggleTask(task)} aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`} /><span><strong>{task.title}</strong><small>{task.subject || "General"}{task.notes ? ` · ${task.notes}` : ""}</small></span><span className={`priority-tag priority-${(task.priority || "medium").toLowerCase()}`}>{task.priority || "Medium"}</span><button className="icon-button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => editTask(task)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${task.title}`} onClick={() => { if (window.confirm(`Delete "${task.title}" from your planner?`)) onDelete(task.id); }}><Trash2 size={14} /></button></article>)}{!dayTasks.length && !daySessions.length && <p className="planner-day-empty">Nothing planned</p>}</div></section>; })}</div>}
      <div className="planner-footer"><span>{visibleTasks.filter((task) => !task.completed).length} open tasks · {visibleSessions.length} study sessions</span><button className="text-button" onClick={onOpenSchedule}>Manage study sessions <ChevronRight size={14} /></button></div>
    </section>
  </>;
}

export function AnalyticsPage({ lectures, attempts, sessions, focusSessions, preferences }) {
  const scores = [...attempts].sort((a, b) => safeDate(a.date) - safeDate(b.date)).slice(-12);
  const scoreValues = scores.map((attempt) => Math.max(0, Math.min(100, Math.round(100 * (attempt.score || 0) / Math.max(1, attempt.total || 0)))));
  const points = scoreValues.map((score, index) => `${scores.length < 2 ? 50 : 35 + (index * 530 / (scores.length - 1))},${165 - score * 1.35}`).join(" ");
  const subjects = [...new Set(lectures.map((lecture) => lecture.subject || "General"))].map((subject) => {
    const subjectLectures = lectures.filter((lecture) => (lecture.subject || "General") === subject);
    const subjectAttempts = attempts.filter((attempt) => (attempt.subject || "General") === subject);
    const average = subjectAttempts.length ? Math.round(subjectAttempts.reduce((sum, attempt) => sum + 100 * (attempt.score || 0) / Math.max(1, attempt.total || 0), 0) / subjectAttempts.length) : null;
    const coverage = Math.round(100 * subjectLectures.filter((lecture) => lecture.studied).length / Math.max(1, subjectLectures.length));
    return { subject, count: subjectLectures.length, average, coverage };
  });
  const topicStats = lectures.map((lecture) => { const subjectAttempts = attempts.filter((attempt) => attempt.lectureId === lecture.id); const average = subjectAttempts.length ? Math.round(subjectAttempts.reduce((sum, attempt) => sum + 100 * attempt.score / Math.max(1, attempt.total), 0) / subjectAttempts.length) : null; return { title: lecture.title, average, attempts: subjectAttempts.length }; }).filter((topic) => topic.average !== null).sort((a, b) => a.average - b.average);
  const activityDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); const key = localDay(date); const focusMinutes = focusSessions.filter((session) => localDay(safeDate(session.finishedAt || session.date)) === key).reduce((sum, session) => sum + (session.minutes || 0), 0); const plannedMinutes = sessions.filter((session) => session.completed && session.date === key).reduce((sum, session) => { const [startHour, startMinute] = (session.start || "00:00").split(":").map(Number); const [endHour, endMinute] = (session.end || "00:00").split(":").map(Number); return sum + Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute); }, 0); return { key, day: date.toLocaleDateString(undefined, { weekday: "short" }), minutes: focusMinutes + plannedMinutes }; });
  const totalMinutes = activityDays.reduce((sum, day) => sum + day.minutes, 0);
  const averageScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length) : 0;
  const weeklyGoal = preferences?.weeklyStudyGoalMinutes || 300;
  const activeDays = activityDays.filter((day) => day.minutes > 0 || attempts.some((attempt) => localDay(safeDate(attempt.date)) === day.key)).length;
  return <>
    <SectionHeading eyebrow="YOUR WORK, MADE VISIBLE" title="Learning analytics" subtitle="A clear view of study time, quiz results, and topics to revisit." />
    <div className="stats-grid analytics-stats"><div className="stat-card"><span className="stat-icon lavender"><Target size={17} /></span><span className="stat-label">Quiz average</span><strong className="stat-value">{averageScore}%</strong><span className="stat-foot">Across {attempts.length} attempts</span></div><div className="stat-card"><span className="stat-icon mint"><Clock3 size={17} /></span><span className="stat-label">Study time this week</span><strong className="stat-value">{(totalMinutes / 60).toFixed(1)}h</strong><span className="stat-foot">Goal: {(weeklyGoal / 60).toFixed(0)}h · {Math.min(100, Math.round(totalMinutes / weeklyGoal * 100))}% complete</span></div><div className="stat-card"><span className="stat-icon peach"><BookOpen size={17} /></span><span className="stat-label">Materials studied</span><strong className="stat-value">{lectures.filter((lecture) => lecture.studied).length}/{lectures.length}</strong><span className="stat-foot">Completed learning materials</span></div><div className="stat-card"><span className="stat-icon blue"><Flame size={17} /></span><span className="stat-label">Active days this week</span><strong className="stat-value">{activeDays}/7</strong><span className="stat-foot">Consistency at your own pace</span></div></div>
    <div className="analytics-grid"><section className="panel analytics-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT QUIZZES</p><h2>Score trend</h2></div><span>{scores.length} attempts</span></div>{scores.length ? <><div className="analytics-chart-wrap"><div className="analytics-chart-y"><span>100%</span><span>50%</span><span>0%</span></div><svg className="analytics-score-chart" viewBox="0 0 600 190" role="img" aria-label="Quiz scores over recent attempts"><path d="M35 30H565 M35 98H565 M35 165H565" className="chart-grid-line" /><polyline points={points} className="chart-trend-line" />{scoreValues.map((score, index) => { const x = scores.length < 2 ? 300 : 35 + index * 530 / (scores.length - 1); const y = 165 - score * 1.35; return <circle key={`${scores[index].id}-${index}`} cx={x} cy={y} r="4" className="chart-point"><title>{`${scores[index].title}: ${score}%`}</title></circle>; })}</svg></div><div className="chart-labels"><span>{scores[0]?.title}</span><span>{scores[scores.length - 1]?.title}</span></div></> : <div className="analytics-empty"><CircleHelp /><p>Complete a quiz to start your score trend.</p></div>}</section>
      <section className="panel analytics-panel"><div className="panel-heading"><div><p className="eyebrow">LAST 7 DAYS</p><h2>Time spent studying</h2></div><span>{totalMinutes} min</span></div><div className="study-time-bars">{activityDays.map((day) => <div className="study-time-bar" key={day.key}><div className="study-time-bar-track"><span style={{ height: `${Math.max(day.minutes > 0 ? 5 : 0, Math.min(100, day.minutes / Math.max(60, ...activityDays.map((item) => item.minutes)) * 100))}%` }} title={`${day.minutes} minutes`} /></div><small>{day.day}</small><strong>{day.minutes ? `${day.minutes}m` : "—"}</strong></div>)}</div></section></div>
    <section className="panel analytics-panel subject-progress"><div className="panel-heading"><div><p className="eyebrow">BY SUBJECT</p><h2>Coverage and quiz averages</h2></div></div>{subjects.length ? subjects.map((item, index) => <div className="analytics-subject-row" key={item.subject}><div><span className={`subject-icon subject-color-${index % 4}`}>{item.subject.slice(0, 1)}</span><strong>{item.subject}</strong><span>{item.count} materials</span>{item.average !== null && <b>{item.average}% quiz avg.</b>}</div><div className="analytics-subject-track" aria-label={`${item.coverage}% materials studied`}><span style={{ width: `${item.coverage}%` }} /></div></div>) : <div className="analytics-empty"><BookOpen /><p>Add materials to see progress by subject.</p></div>}</section>
    <div className="analytics-grid"><section className="panel analytics-panel"><div className="panel-heading"><div><p className="eyebrow">BUILD ON YOUR STRENGTHS</p><h2>Strongest topics</h2></div></div>{topicStats.length ? [...topicStats].sort((a, b) => b.average - a.average).slice(0, 3).map((topic) => <div className="topic-analytics-row" key={topic.title}><span>{topic.title}</span><strong>{topic.average}%</strong><small>{topic.attempts} attempts</small></div>) : <div className="analytics-empty"><Sparkles /><p>Take a quiz to see topic strengths.</p></div>}</section><section className="panel analytics-panel"><div className="panel-heading"><div><p className="eyebrow">A PLACE TO START</p><h2>Topics to revisit</h2></div></div>{topicStats.length ? topicStats.slice(0, 3).map((topic) => <div className="topic-analytics-row needs-work" key={topic.title}><span>{topic.title}</span><strong>{topic.average}%</strong><small>{topic.average < 60 ? "Could use another review" : "Keep practicing"}</small></div>) : <div className="analytics-empty"><Target /><p>Your quiz results will suggest what to review.</p></div>}</section></div>
  </>;
}

const timerModes = { focus: "Focus", short: "Short break", long: "Long break" };
export function FocusTimerPage({ focusSessions, preferences, onPreferenceChange, onComplete }) {
  const [mode, setMode] = useState("focus");
  const [durations, setDurations] = useState({ focus: preferences?.focusMinutes || 25, short: preferences?.shortBreakMinutes || 5, long: preferences?.longBreakMinutes || 20 });
  const [remaining, setRemaining] = useState((preferences?.focusMinutes || 25) * 60);
  const [running, setRunning] = useState(false);
  const [completedFocusCount, setCompletedFocusCount] = useState(() => focusSessions.length);
  const [startedAt, setStartedAt] = useState(null);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => { if (running && remaining === 0) finishPhase(); }, [running, remaining]);
  function changeMode(nextMode) { setRunning(false); setMode(nextMode); setRemaining(durations[nextMode] * 60); setStartedAt(null); }
  async function finishPhase() {
    setRunning(false);
    if (mode === "focus") {
      const minutes = durations.focus;
      const result = await onComplete({ minutes, startedAt: startedAt || new Date(Date.now() - minutes * 60000).toISOString(), finishedAt: new Date().toISOString(), date: localDay(), mode: "focus" });
      if (result === false) return;
      const nextCount = completedFocusCount + 1;
      setCompletedFocusCount(nextCount);
      const nextMode = nextCount % 4 === 0 ? "long" : "short";
      setMode(nextMode); setRemaining(durations[nextMode] * 60); setStartedAt(null);
    } else { setMode("focus"); setRemaining(durations.focus * 60); setStartedAt(null); }
  }
  function updateDuration(key, rawValue) { const value = Math.max(1, Math.min(90, Number(rawValue) || 1)); const keyName = key === "focus" ? "focusMinutes" : key === "short" ? "shortBreakMinutes" : "longBreakMinutes"; setDurations((current) => ({ ...current, [key]: value })); onPreferenceChange({ [keyName]: value }); if (!running && mode === key) setRemaining(value * 60); }
  const elapsedToday = focusSessions.filter((session) => session.date === localDay()).reduce((sum, session) => sum + (session.minutes || 0), 0);
  const todaySessions = focusSessions.filter((session) => session.date === localDay()).length;
  const minutes = Math.floor(remaining / 60); const seconds = remaining % 60;
  const progress = Math.max(0, Math.min(100, 100 * (1 - remaining / (durations[mode] * 60))));
  return <>
    <SectionHeading eyebrow="ONE THING AT A TIME" title="Focus timer" subtitle="Settle in for a focused session, then take a real break." />
    <div className="focus-page-grid"><section className="panel focus-timer-panel"><div className="focus-mode-tabs">{Object.entries(timerModes).map(([key, label]) => <button key={key} className={mode === key ? "selected" : ""} onClick={() => changeMode(key)}>{label}</button>)}</div><div className="timer-ring" style={{ "--timer-progress": `${progress}%` }}><div><span>{timerModes[mode]}</span><strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong><small>{running ? "Stay with this moment" : "Ready when you are"}</small></div></div><div className="timer-controls"><button className="button primary" onClick={() => { if (!running) setStartedAt((current) => current || new Date().toISOString()); setRunning((value) => !value); }}>{running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Start focus</>}</button><button className="button secondary" onClick={() => { setRunning(false); setRemaining(durations[mode] * 60); setStartedAt(null); }}><RotateCcw size={15} /> Reset</button></div><p className="timer-cycle-note">After each focus session, take a {completedFocusCount % 4 === 3 ? durations.long : durations.short}-minute break. Every fourth break is longer.</p></section>
      <aside className="focus-side-column"><section className="panel focus-today-card"><p className="eyebrow">TODAY'S FOCUS</p><h2>{elapsedToday} <span>minutes</span></h2><div className="focus-goal-track"><span style={{ width: `${Math.min(100, elapsedToday / Math.max(1, preferences?.dailyFocusGoal || 60) * 100)}%` }} /></div><p>{todaySessions} completed focus {todaySessions === 1 ? "session" : "sessions"}</p><label className="focus-goal-setting">Daily goal <select value={preferences?.dailyFocusGoal || 60} onChange={(event) => onPreferenceChange({ dailyFocusGoal: Number(event.target.value) })}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120">2 hours</option><option value="180">3 hours</option></select></label></section><section className="panel timer-settings"><p className="eyebrow">TIMER LENGTHS</p><h2>Make it yours</h2>{[["focus", "Focus"], ["short", "Short break"], ["long", "Long break"]].map(([key, label]) => <label key={key}>{label}<span><input type="number" min="1" max="90" value={durations[key]} onChange={(event) => updateDuration(key, event.target.value)} /> min</span></label>)}</section></aside></div>
    <section className="panel focus-history"><div className="panel-heading"><div><p className="eyebrow">RECENT SESSIONS</p><h2>Focus history</h2></div></div>{focusSessions.length ? focusSessions.slice().sort((a, b) => safeDate(b.finishedAt) - safeDate(a.finishedAt)).slice(0, 8).map((session) => <div className="focus-history-row" key={session.id}><span className="subject-icon"><Clock3 size={15} /></span><span><strong>{session.minutes} minute focus session</strong><small>{session.date ? dateLabel(session.date, { month: "short", day: "numeric", year: "numeric" }) : "Completed"}</small></span><span>{session.minutes} min</span></div>) : <div className="analytics-empty"><Clock3 /><p>Completed focus sessions will appear here.</p></div>}</section>
  </>;
}

export function AssistantPage({ lectures, onAsk, onSaveCards, onSaveQuestions }) {
  const [lectureId, setLectureId] = useState(lectures[0]?.id || "");
  const [action, setAction] = useState("answer");
  const [questionType, setQuestionType] = useState("Multiple choice");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const selected = lectures.find((lecture) => lecture.id === lectureId);
  useEffect(() => { if (!lectures.some((lecture) => lecture.id === lectureId)) setLectureId(lectures[0]?.id || ""); }, [lectures, lectureId]);
  async function submit(event) { event.preventDefault(); setError(""); setResult(null); if (!selected) { setError("Add a lecture or study material first so answers can be grounded in your own sources."); return; } if ((action === "answer" || action === "explain") && !question.trim()) { setError("Enter a question or concept to work on."); return; } setBusy(true); try { setResult(await onAsk({ action, question: question.trim(), questionType, lecture: selected })); } catch (requestError) { setError(requestError.message || "The study assistant could not respond."); } finally { setBusy(false); } }
  async function saveCards() { if (result?.flashcards?.length) { const saved = await onSaveCards(result.flashcards, selected); if (saved !== false) setResult((current) => ({ ...current, saved: true })); } }
  async function saveQuestions() { if (result?.questions?.length) { const saved = await onSaveQuestions(result.questions, selected); if (saved !== false) setResult((current) => ({ ...current, saved: true })); } }
  return <>
    <SectionHeading eyebrow="GROUNDED IN YOUR MATERIALS" title="AI study assistant" subtitle="Ask about a lecture, simplify a concept, or create study prompts from your notes." />
    <div className="assistant-layout"><section className="panel assistant-chat-panel"><div className="assistant-context"><span className="assistant-orb"><Sparkles size={19} /></span><div><strong>Start with a source</strong><p>The assistant uses the selected material as its reference and flags information the source does not support.</p></div></div><form onSubmit={submit} className="assistant-form"><label>Source material<select value={lectureId} onChange={(event) => setLectureId(event.target.value)}><option value="">Choose a lecture</option>{lectures.map((lecture) => <option value={lecture.id} key={lecture.id}>{lecture.subject} · {lecture.title}</option>)}</select></label><div className="assistant-action-list" role="group" aria-label="Assistant task">{[["answer", "Ask a question"], ["explain", "Explain simply"], ["summarize", "Summarize"], ["quiz", "Generate quiz questions"], ["flashcards", "Create flashcards"]].map(([key, label]) => <button type="button" key={key} className={action === key ? "selected" : ""} aria-pressed={action === key} onClick={() => setAction(key)}>{label}</button>)}</div>{action === "quiz" && <label>Question format<select value={questionType} onChange={(event) => setQuestionType(event.target.value)}><option>Multiple choice</option><option>Identification</option></select></label>}{["answer", "explain"].includes(action) && <label>Your question<textarea rows="3" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={action === "explain" ? "Which concept should I explain in simple language?" : "Ask about a definition, relationship, or example in this material"} /></label>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="button primary assistant-submit" disabled={busy || !selected}>{busy ? "Working from your material…" : <><Sparkles size={16} /> {action === "quiz" ? "Generate questions" : action === "flashcards" ? "Create flashcards" : action === "summarize" ? "Summarize source" : "Get an explanation"}</>}</button></form></section>
      <section className="panel assistant-answer-panel" aria-live="polite"><div className="panel-heading"><div><p className="eyebrow">SOURCE FIRST</p><h2>{result ? "Study response" : "Your response appears here"}</h2></div></div>{busy ? <div className="assistant-loading"><span className="assistant-loader" /><p>Reading the selected material…</p></div> : result ? <div className="assistant-result">{result.text && <p className="assistant-result-text">{result.text}</p>}{result.flashcards?.map((card, index) => <article className="assistant-generated-card" key={`${index}-${card.front}`}><span>Card {index + 1}</span><strong>{card.front}</strong><p>{card.back}</p></article>)}{result.questions?.map((item, index) => <article className="assistant-generated-card" key={`${index}-${item.question}`}><span>Question {index + 1}</span><strong>{item.question}</strong><p>{item.options?.join(" · ")}</p><small>Answer: {item.correctAnswer}</small></article>)}{(result.flashcards?.length || result.questions?.length) > 0 && <button className="button secondary" disabled={result.saved} onClick={result.flashcards?.length ? saveCards : saveQuestions}>{result.saved ? <><Check size={15} /> Saved to your study space</> : result.flashcards?.length ? "Save these flashcards" : "Save to lecture question bank"}</button>}</div> : <div className="assistant-empty"><span><Brain size={26} /></span><p>Select one of your saved materials and choose a study task to get started.</p><small>Answers are limited to the notes and summaries saved with that material.</small></div>}</section></div>
  </>;
}

const achievementDefinitions = [
  { id: "first-material", name: "First page", description: "Add your first learning material.", icon: <BookOpen size={19} />, xp: 10, condition: (m) => m.materials >= 1 },
  { id: "first-quiz", name: "Give it a go", description: "Complete your first quiz.", icon: <Brain size={19} />, xp: 15, condition: (m) => m.quizzes >= 1 },
  { id: "five-quizzes", name: "Recall practice", description: "Complete five quiz attempts.", icon: <Target size={19} />, xp: 30, condition: (m) => m.quizzes >= 5 },
  { id: "focus-hour", name: "Focused hour", description: "Complete 60 minutes of focus time.", icon: <Clock3 size={19} />, xp: 25, condition: (m) => m.focusMinutes >= 60 },
  { id: "flashcard-review", name: "Active recall", description: "Review a flashcard.", icon: <RotateCcw size={19} />, xp: 15, condition: (m) => m.cardReviews >= 1 },
  { id: "steady-week", name: "Steady steps", description: "Study on three consecutive days.", icon: <Flame size={19} />, xp: 35, condition: (m) => m.streakDays >= 3 },
  { id: "planner-ten", name: "Plan in motion", description: "Complete ten planned study tasks or sessions.", icon: <CalendarDays size={19} />, xp: 35, condition: (m) => m.completions >= 10 },
];
export function AchievementsPage({ metrics, achievements, onUnlock }) {
  const earnedIds = new Set(achievements.map((item) => item.achievementId || item.id));
  useEffect(() => { achievementDefinitions.filter((item) => item.condition(metrics) && !earnedIds.has(item.id)).forEach((item) => onUnlock(item)); }, [metrics, achievements]);
  const earned = achievementDefinitions.filter((item) => earnedIds.has(item.id) || item.condition(metrics));
  const totalXp = achievements.reduce((sum, item) => sum + (item.xp || achievementDefinitions.find((definition) => definition.id === (item.achievementId || item.id))?.xp || 0), 0);
  const currentLevel = Math.floor(totalXp / 100) + 1;
  return <>
    <SectionHeading eyebrow="RECOGNIZE YOUR PROGRESS" title="Achievements" subtitle="Small milestones make a steady study habit easier to see." />
    <section className="panel xp-overview"><div className="xp-medal"><Star size={24} /></div><div><p className="eyebrow">YOUR LEARNING JOURNEY</p><h2>Level {currentLevel}</h2><p>{totalXp} XP earned · {Math.max(0, currentLevel * 100 - totalXp)} XP to the next level · {metrics.streakDays || 0} day streak</p><div className="xp-progress"><span style={{ width: `${totalXp % 100}%` }} /></div></div><span className="xp-count">{earned.length} / {achievementDefinitions.length} badges</span></section>
    <div className="achievement-grid">{achievementDefinitions.map((item) => { const unlocked = earnedIds.has(item.id) || item.condition(metrics); return <article className={`panel achievement-card${unlocked ? " unlocked" : " locked"}`} key={item.id}><span className="achievement-icon">{unlocked ? item.icon : <Trophy size={19} />}</span><div><strong>{item.name}</strong><p>{item.description}</p><small>{unlocked ? `+${item.xp} XP` : "Keep learning to unlock"}</small></div><span className="achievement-status">{unlocked ? <Check size={16} /> : "Locked"}</span></article>; })}</div>
    <p className="achievement-note">Badges celebrate personal progress. There are no rankings or comparisons with other students.</p>
  </>;
}

export function SettingsPage({ profile, onPreferenceChange, onEditProfile, onLogout }) {
  return <>
    <SectionHeading eyebrow="YOUR STUDY SPACE" title="Settings" subtitle="Choose how your workspace looks and how your study sessions feel." />
    <div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT</p><h2>Profile</h2></div></div><ProfileShowcase profile={profile} onEditProfile={onEditProfile} /><div className="settings-actions"><button className="text-button delete-text" onClick={onLogout}>Sign out</button></div></section>
      <section className="panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">APPEARANCE</p><h2>Workspace theme</h2></div></div><p className="muted">Pick a comfortable reading environment.</p><div className="settings-choice-row">{["light", "dark"].map((theme) => <button key={theme} className={`settings-choice${profile?.theme === theme ? " selected" : ""}`} aria-pressed={profile?.theme === theme} onClick={() => onPreferenceChange({ theme })}><span className={`theme-swatch ${theme}`} />{theme === "light" ? "Light mode" : "Dark mode"}{profile?.theme === theme && <Check size={15} />}</button>)}</div></section>
      <section className="panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">PLANNING</p><h2>Time format</h2></div></div><p className="muted">Choose how session times appear in your planner.</p><div className="settings-choice-row">{[["12h", "12-hour · 2:30 PM"], ["24h", "24-hour · 14:30"]].map(([value, label]) => <button key={value} className={`settings-choice${(profile?.timeFormat || "12h") === value ? " selected" : ""}`} aria-pressed={(profile?.timeFormat || "12h") === value} onClick={() => onPreferenceChange({ timeFormat: value })}>{label}{(profile?.timeFormat || "12h") === value && <Check size={15} />}</button>)}</div></section>
      <section className="panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">WEEKLY RHYTHM</p><h2>Study goal</h2></div></div><p className="muted">Set a personal weekly goal for your focus time and completed study sessions.</p><label className="weekly-goal-setting">Weekly study goal<select value={profile?.weeklyStudyGoalMinutes || 300} onChange={(event) => onPreferenceChange({ weeklyStudyGoalMinutes: Number(event.target.value) })}><option value="180">3 hours</option><option value="300">5 hours</option><option value="420">7 hours</option><option value="600">10 hours</option><option value="900">15 hours</option></select></label></section>
      <section className="panel settings-panel"><div className="panel-heading"><div><p className="eyebrow">YOUR DATA</p><h2>Private study records</h2></div></div><p className="muted">Your materials, quiz attempts, tasks, flashcards, and focus history are stored in your signed-in account. Uploaded file previews remain in this browser's local storage.</p><span className="settings-data-note"><Check size={15} /> Account data is scoped to your signed-in profile</span></section></div>
  </>;
}
