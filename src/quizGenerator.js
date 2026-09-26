const stopWords = new Set("about above after again against all also another any are because been before being between both but can could does during each few from further had has have her here him his how into its itself just more most must not often only other our over same should since some such than that the their them then there these they this those through under until very was were what when where which while who will would your you lecture notes topic students equation equations".split(" "));

function cleanWord(word) { return word.toLowerCase().replace(/[^a-z0-9-]/g, ""); }

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
