const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEST_FILES = [
  "data/fa-junior.json",
  "data/ca-junior.json",
  "data/fpa-junior.json",
  "data/acc-junior.json",
  "data/bi-junior.json"
];

function getQuestions(bank) {
  if (Array.isArray(bank)) return bank;
  if (Array.isArray(bank.questions)) return bank.questions;
  return [];
}

function getCorrectIndex(question) {
  if (Number.isInteger(question.correct)) return question.correct;
  if (Number.isInteger(question.correctIndex)) return question.correctIndex;
  return -1;
}

let hasError = false;

for (const file of TEST_FILES) {
  const fullPath = path.join(ROOT, file);
  const bank = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  const questions = getQuestions(bank);
  let structuralErrors = 0;
  let correctLongest = 0;

  questions.forEach((question, index) => {
    const options = Array.isArray(question.options) ? question.options : [];
    const correct = getCorrectIndex(question);

    if (!question.text && !question.question) {
      structuralErrors++;
      console.error(`${file} #${index + 1}: missing question text`);
    }
    if (options.length !== 4) {
      structuralErrors++;
      console.error(`${file} #${index + 1}: expected 4 options, got ${options.length}`);
    }
    if (correct < 0 || correct >= options.length) {
      structuralErrors++;
      console.error(`${file} #${index + 1}: invalid correct index ${correct}`);
    }

    if (options.length === 4 && correct >= 0 && correct < options.length) {
      const lengths = options.map(option => String(option).length);
      const maxLength = Math.max(...lengths);
      const isOnlyLongest = lengths[correct] === maxLength &&
        lengths.filter(length => length === maxLength).length === 1;
      if (isOnlyLongest) correctLongest++;
    }
  });

  const longestShare = questions.length ? Math.round((correctLongest / questions.length) * 100) : 0;
  const line = [
    `${file}:`,
    `questions=${questions.length}`,
    `structuralErrors=${structuralErrors}`,
    `correctLongest=${correctLongest}/${questions.length}`,
    `correctLongestShare=${longestShare}%`
  ].join(" ");
  console.log(line);

  if (structuralErrors > 0 || longestShare > 25) {
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
}
