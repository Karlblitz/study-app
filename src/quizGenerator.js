const stopWords = new Set("about above after again against all also another any are because been before being between both but can could does during each few from further had has have her here him his how into its itself just more most must not often only other our over same should since some such than that the their them then there these they this those through under until very was were what when where which while who will with would your you lecture notes topic students equation equations".split(" "));

function cleanWord(word) { return word.toLowerCase().replace(/[^a-z0-9-]/g, ""); }

export function generateQuestionsFromText(rawText, title = "lecture") {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (text.length < 250) return [];
  const sentences = rawText.replace(/\r/g, "\n").split(/(?<=[.!?])\s+|[\n•]+|(?<=;)\s+/).map((item) => item.replace(/\s+/g, " ").trim()).filter((item) => item.length >= 45 && item.length <= 260 && item.split(/\s+/).length >= 7);
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
    const words = sentence.match(/[A-Za-z][A-Za-z0-9-]{4,}/g) || [];
    const answerWord = words.find((word) => !stopWords.has(cleanWord(word)) && !usedTerms.has(cleanWord(word)) && cleanWord(word).length >= 6);
    if (!answerWord) continue;
    const answer = answerWord.replace(/[.,;:!?]+$/, "");
    const distractors = terms.filter((term) => term !== cleanWord(answer) && !sentence.toLowerCase().includes(term)).slice(0, 3);
    if (distractors.length < 3) continue;
    const blanked = sentence.replace(new RegExp(answerWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "________");
    questions.push({
      question: `According to “${title},” which term completes this statement? “${blanked}”`,
      options: [answer, ...distractors].sort(() => Math.random() - 0.5),
      answer,
    });
    usedTerms.add(cleanWord(answer));
  }
  return questions;
}
