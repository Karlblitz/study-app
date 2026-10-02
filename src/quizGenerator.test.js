import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_QUIZ_SETTINGS,
  generateQuestionsFromText,
  getQuizProgress,
  getQuizQuestionIndex,
  getUniqueValidQuestions,
  scoreQuizQuestions,
  selectQuizQuestions,
  validateGeneratedQuiz,
  validateQuizSettings,
} from "./quizGenerator.js";

const lectureText = [
  "Osmosis refers to the movement of water across a selectively permeable membrane toward a higher solute concentration.",
  "Diffusion describes particles spreading from a region of higher concentration toward a region of lower concentration.",
  "Active transport is defined as cellular movement that uses energy to move substances against a concentration gradient.",
  "Facilitated diffusion means passive movement through membrane proteins without directly consuming cellular energy.",
  "Homeostasis describes coordinated processes that maintain stable internal conditions despite external changes.",
  "Enzymes are biological catalysts that accelerate chemical reactions without being permanently consumed in the process.",
  "Substrate means the specific reactant molecule that binds to an enzyme during a biochemical reaction.",
  "Metabolism refers to the complete collection of chemical reactions that sustain activity within a living organism.",
  "Catabolism describes metabolic pathways that break complex molecules down and release usable cellular energy.",
  "Anabolism means metabolic pathways that build complex molecules from smaller components using cellular energy.",
].join(" ");

test("generates and selects exactly 1, 5, and 10 distinct valid questions", () => {
  const generated = generateQuestionsFromText(lectureText, "Cell Transport");
  assert.equal(generated.length, 10);

  for (const count of [1, 5, 10]) {
    const result = selectQuizQuestions(generated, count);
    assert.equal(result.questions.length, count);
    assert.equal(result.available, 10);
    assert.equal(new Set(result.questions.map((item) => item.question)).size, count);
  }
});

test("reports when fewer distinct questions are available than requested", () => {
  const result = selectQuizQuestions(generateQuestionsFromText(lectureText, "Cell Transport").slice(0, 1), 5);
  assert.equal(result.questions.length, 1);
  assert.equal(result.available, 1);
});

test("filters duplicate and invalid questions and preserves the full stored question array", () => {
  const questions = generateQuestionsFromText(lectureText, "Cell Transport");
  const withDuplicates = [
    ...questions,
    { ...questions[0], id: "duplicate", question: `  ${questions[0].question.toUpperCase()}  ` },
    { question: "Missing options", answer: "No choices" },
  ];
  const restored = getUniqueValidQuestions(JSON.parse(JSON.stringify(withDuplicates)));
  assert.equal(restored.length, 10);
  assert.deepEqual(restored.map((item) => item.question), questions.map((item) => item.question));
});

test("scores every selected question", () => {
  const questions = generateQuestionsFromText(lectureText, "Cell Transport").slice(0, 10);
  const answers = Object.fromEntries(questions.map((item, index) => [index, index < 7 ? item.correctAnswer : "incorrect"]));
  assert.equal(scoreQuizQuestions(questions, answers), 7);
});

test("question navigation and progress use the complete question count", () => {
  for (const count of [1, 5, 10]) {
    let index = 0;
    const visited = [index];
    while (index < count - 1) {
      index = getQuizQuestionIndex(index, 1, count);
      visited.push(index);
    }
    assert.equal(visited.length, count);
    assert.equal(getQuizQuestionIndex(index, 1, count), count - 1);
    assert.equal(getQuizQuestionIndex(0, -1, count), 0);
    assert.equal(getQuizProgress(Object.fromEntries(visited.map((item) => [item, true])), count), 100);
  }
});

test("quick quiz settings default to five medium multiple-choice questions with explanations", () => {
  assert.deepEqual(validateQuizSettings(), {
    difficulty: "Medium",
    count: 5,
    type: "Multiple choice",
    includeExplanations: true,
  });
  assert.deepEqual(DEFAULT_QUIZ_SETTINGS, {
    difficulty: "Medium",
    count: 5,
    type: "Multiple choice",
    includeExplanations: true,
  });
});

test("validates complete customized quiz sets and preserves selected settings", () => {
  for (const count of [5, 10, 15, 20]) {
    const settings = { difficulty: "Hard", count, type: "Multiple choice", includeExplanations: true };
    const generated = Array.from({ length: count }, (_, index) => ({
      id: `ai-${index}`,
      question: `Distinct question ${index}?`,
      options: ["Choice A", "Choice B", "Choice C", "Choice D"],
      correctAnswer: "Choice B",
      explanation: `Explanation ${index}.`,
    }));
    const questions = validateGeneratedQuiz(generated, settings);
    assert.equal(questions.length, count);
    assert.ok(questions.every((question) => question.options.length === 4 && question.correctAnswer === "Choice B"));
    assert.ok(questions.every((question) => question.difficulty === "Hard" && question.explanation));
  }
});

test("supports true/false customization and omits disabled explanations", () => {
  const settings = { difficulty: "Easy", count: 5, type: "True / False", includeExplanations: false };
  const generated = Array.from({ length: 5 }, (_, index) => ({
    question: `Statement ${index} is accurate?`,
    options: ["True", "False"],
    correctAnswer: "True",
    type: "True / False",
    explanation: "Should not be displayed.",
  }));
  const questions = validateGeneratedQuiz(generated, settings);
  assert.equal(questions[0].difficulty, "Easy");
  assert.equal(questions[0].explanation, "");
});

test("validates mixed quizzes contain both supported question types", () => {
  const settings = { difficulty: "Medium", count: 5, type: "Mixed", includeExplanations: true };
  const generated = Array.from({ length: 5 }, (_, index) => ({
    question: `Mixed question ${index}?`,
    options: [1, 3].includes(index) ? ["True", "False"] : ["A", "B", "C", "D"],
    correctAnswer: [1, 3].includes(index) ? "False" : "A",
    type: [1, 3].includes(index) ? "True / False" : "Multiple choice",
    explanation: "The lecture supports this answer.",
  }));
  assert.equal(validateGeneratedQuiz(generated, settings).length, 5);
  const allMultipleChoice = generated.map((item, index) => ({
    ...item,
    question: `Multiple-choice question ${index}?`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    type: "Multiple choice",
  }));
  assert.throws(() => validateGeneratedQuiz(allMultipleChoice, settings), /requested mix/);
  assert.throws(() => validateGeneratedQuiz(generated.map((item, index) => index === 3 ? {
    ...item,
    question: "Another multiple-choice question?",
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    type: "Multiple choice",
  } : item), settings), /balanced mix/);
});

test("preserves all choices and answers through a saved quiz round trip", () => {
  const generated = Array.from({ length: 5 }, (_, index) => ({
    id: `question-${index}`,
    question: `Saved question ${index}?`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "C",
    explanation: `Explanation ${index}.`,
  }));
  const beforeSave = validateGeneratedQuiz(generated, DEFAULT_QUIZ_SETTINGS);
  const reopened = validateGeneratedQuiz(JSON.parse(JSON.stringify(beforeSave)), DEFAULT_QUIZ_SETTINGS);
  assert.deepEqual(reopened, beforeSave);
});

test("rejects incomplete, duplicate, and malformed AI question sets", () => {
  const settings = { ...DEFAULT_QUIZ_SETTINGS };
  const questions = Array.from({ length: 5 }, (_, index) => ({
    question: `Distinct question ${index}?`,
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    explanation: "Because A is correct.",
  }));
  assert.throws(() => validateGeneratedQuiz(questions.slice(0, 1), settings), /fewer than/);
  assert.throws(() => validateGeneratedQuiz([...questions.slice(0, 4), { ...questions[0] }], settings), /duplicate/);
  assert.throws(() => validateGeneratedQuiz(questions.map((item, index) => index ? item : { ...item, options: ["A", "B", "B", "D"] }), settings), /duplicate answer choices/);
  assert.throws(() => validateGeneratedQuiz(questions.map((item, index) => index ? item : { ...item, correctAnswer: "missing" }), settings), /invalid questions/);
});
