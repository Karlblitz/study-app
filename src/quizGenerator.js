const stopWords = new Set("about above after again against all also another any are because been before being between both but can could does during each few from further had has have her here him his how into its itself just more most must not often only other our over same should since some such than that the their them then there these they this those through under until very was were what when where which while who will would your you lecture notes topic students equation equations".split(" "));

export const DEFAULT_QUIZ_SETTINGS = Object.freeze({
  difficulty: "Medium",
  count: 5,
  type: "Multiple choice",
  includeExplanations: true,
});

const quizQuestionTypes = new Set(["Multiple choice", "True / False", "Multi-select", "Problem solving", "Mixed"]);
const quizDifficulties = new Set(["Easy", "Medium", "Hard"]);
const quizQuestionCounts = new Set([5, 10, 15, 20]);

function cleanWord(word) { return word.toLowerCase().replace(/[^a-z0-9-]/g, ""); }

function normalizedQuestion(question) {
  return question.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getUniqueValidQuestions(questions = []) {
  const seen = new Set();
  const usedIds = new Set();
  return questions.filter((item) => {
    if (!item || typeof item.question !== "string" || !item.question.trim() || !Array.isArray(item.options)) return false;
    const options = [...new Set(item.options.filter((option) => typeof option === "string" && option.trim()).map((option) => option.trim()))];
    const answer = item.correctAnswer ?? item.answer;
    const validAnswer = Array.isArray(answer)
      ? answer.length > 0 && answer.every((value) => options.includes(value))
      : typeof answer === "string" && options.includes(answer.trim());
    const key = normalizedQuestion(item.question);
    if (options.length < 2 || !validAnswer || !key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item, index) => {
    const options = [...new Set(item.options.filter((option) => typeof option === "string" && option.trim()).map((option) => option.trim()))];
    const answer = item.correctAnswer ?? item.answer;
    const baseId = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `question-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return {
      ...item,
      id,
      options,
      correctAnswer: Array.isArray(answer) ? answer : answer.trim(),
      answer: Array.isArray(answer) ? answer : answer.trim(),
    };
  });
}

export function selectQuizQuestions(questions, requestedCount, excludedIds = []) {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error("The requested quiz question count must be a positive whole number.");
  }
  const excluded = new Set(excludedIds);
  const availableQuestions = getUniqueValidQuestions(questions)
    .filter((question) => !excluded.has(question.id));
  return {
    questions: availableQuestions.slice(0, requestedCount),
    available: availableQuestions.length,
  };
}

export function validateQuizSettings(settings = DEFAULT_QUIZ_SETTINGS) {
  if (!settings || !quizQuestionCounts.has(settings.count)) {
    throw new Error("Choose 5, 10, 15, or 20 questions.");
  }
  if (!quizDifficulties.has(settings.difficulty)) {
    throw new Error("Choose Easy, Medium, or Hard difficulty.");
  }
  if (!quizQuestionTypes.has(settings.type)) {
    throw new Error("Choose a supported question type.");
  }
  if (typeof settings.includeExplanations !== "boolean") {
    throw new Error("Choose whether to include explanations.");
  }
  return {
    count: settings.count,
    difficulty: settings.difficulty,
    type: settings.type,
    includeExplanations: settings.includeExplanations,
  };
}

export function validateGeneratedQuiz(questions, settings) {
  const config = validateQuizSettings(settings);
  if (!Array.isArray(questions) || questions.length !== config.count) {
    throw new Error(`The generator returned fewer than the ${config.count} requested questions. Try again.`);
  }
  questions.forEach((question, index) => {
    if (!question || !Array.isArray(question.options)) {
      throw new Error(`Question ${index + 1} is missing its answer choices.`);
    }
    const options = question.options.map((option) => typeof option === "string" ? option.trim() : "");
    const normalizedOptions = options.map((option) => option.toLowerCase());
    if (options.some((option) => !option) || new Set(normalizedOptions).size !== options.length) {
      throw new Error(`Question ${index + 1} has empty or duplicate answer choices.`);
    }
  });
  const uniqueQuestions = getUniqueValidQuestions(questions);
  if (uniqueQuestions.length !== config.count) {
    throw new Error("The generated quiz contains duplicate or invalid questions. Try again.");
  }

  const validatedQuestions = uniqueQuestions.map((question, index) => {
    const type = question.type || config.type;
    const distinctOptions = new Set(question.options);
    if (distinctOptions.size !== question.options.length) {
      throw new Error(`Question ${index + 1} contains duplicate answer choices.`);
    }
    if (config.type !== "Mixed" && type !== config.type) {
      throw new Error(`Question ${index + 1} does not match the selected question type.`);
    }
    if (type === "Multiple choice" || type === "Problem solving" || type === "Multi-select") {
      if (question.options.length !== 4) {
        throw new Error(`Question ${index + 1} must have exactly four answer choices.`);
      }
    } else if (type === "True / False") {
      if (question.options.length !== 2 || !["True", "False"].every((option) => question.options.includes(option))) {
        throw new Error(`Question ${index + 1} must have True and False answer choices.`);
      }
    } else {
      throw new Error(`Question ${index + 1} has an unsupported question type.`);
    }
    if (config.includeExplanations && (typeof question.explanation !== "string" || !question.explanation.trim())) {
      throw new Error(`Question ${index + 1} is missing its explanation.`);
    }
    if (question.explanation?.length > 500) {
      throw new Error(`Question ${index + 1} explanation is too long.`);
    }
    return {
      ...question,
      type,
      difficulty: config.difficulty,
      explanation: config.includeExplanations ? question.explanation.trim() : "",
      hint: typeof question.hint === "string" ? question.hint : "",
    };
  });
  if (config.type === "Mixed") {
    const multipleChoiceCount = validatedQuestions.filter((question) => question.type === "Multiple choice").length;
    const trueFalseCount = validatedQuestions.filter((question) => question.type === "True / False").length;
    if (!multipleChoiceCount || !trueFalseCount) {
      throw new Error("The generated quiz does not include the requested mix of question types.");
    }
    if (Math.abs(multipleChoiceCount - trueFalseCount) > 1) {
      throw new Error("The generated quiz does not have a balanced mix of question types.");
    }
  }
  return validatedQuestions;
}

export function scoreQuizQuestions(questions, answers) {
  return questions.reduce((score, question, index) => {
    const correct = question.correctAnswer;
    const answer = answers[index];
    const matches = Array.isArray(correct)
      ? Array.isArray(answer) && correct.length === answer.length && correct.every((item) => answer.includes(item))
      : correct === answer;
    return score + (matches ? 1 : 0);
  }, 0);
}

export function getQuizQuestionIndex(index, direction, questionCount) {
  return Math.max(0, Math.min(Math.max(0, questionCount - 1), index + direction));
}

export function getQuizProgress(submitted, questionCount) {
  const submittedCount = Object.values(submitted).filter(Boolean).length;
  return questionCount > 0 ? Math.round((submittedCount / questionCount) * 100) : 0;
}

export function generateQuestionsFromText(rawText = "", title = "lecture") {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (text.length < 250) return [];
  const sentences = rawText.replace(/\r/g, "\n").split(/(?<=[.!?])\s+|[\n\u2022]+|(?<=;)\s+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 45 && item.length <= 300 && item.split(/\s+/).length >= 7);
  const termCounts = new Map();
  for (const word of text.match(/[A-Za-z][A-Za-z0-9-]{4,}/g) || []) {
    const term = cleanWord(word);
    if (!stopWords.has(term)) termCounts.set(term, (termCounts.get(term) || 0) + 1);
  }
  const terms = [...termCounts].sort((a, b) => b[1] - a[1]).map(([term]) => term);
  if (sentences.length < 4 || terms.length < 4) return [];

  const questions = [];
  const usedTerms = new Set();
  for (const sentence of sentences) {
    if (questions.length >= 15) break;
    // Use explicit lecture definitions instead of copying a sentence and blanking a word.
    const definition = sentence.match(/^\s*(?:the\s+)?([A-Za-z][A-Za-z0-9 -]{1,48}?)\s+(?:is defined as|refers to|means|describes|represents|is|are)\s+(.{18,})$/i);
    if (!definition) continue;
    const answer = definition[1].trim().replace(/[.,;:!?]+$/, "");
    const normalizedAnswer = cleanWord(answer);
    if (!normalizedAnswer || usedTerms.has(normalizedAnswer) || stopWords.has(normalizedAnswer)) continue;
    const description = definition[2].replace(/[.!?]+$/, "").trim();
    const answerTokens = answer.toLowerCase().match(/[a-z]{4,}/g) || [];
    const distractors = terms.filter((term) => term !== normalizedAnswer && !answerTokens.includes(term) && !description.toLowerCase().includes(term)).slice(0, 3);
    if (distractors.length < 3) continue;
    questions.push({
      id: `generated-${normalizedAnswer}-${questions.length}`,
      topic: title,
      difficulty: "Medium",
      type: "Multiple choice",
      question: `Which concept from "${title}" is associated with this explanation: ${description}?`,
      options: [answer, ...distractors].sort(() => Math.random() - 0.5),
      correctAnswer: answer,
      answer,
      hint: "Think of the lecture term that names this idea; focus on the definition rather than memorizing the sentence.",
      explanation: `The notes define "${answer}" as: ${description}.`,
    });
    usedTerms.add(normalizedAnswer);
  }
  return questions;
}
