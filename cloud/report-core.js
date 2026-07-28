"use strict";

const { AUTHORITATIVE_SCORING_VERSION, SCORE_VERIFICATION_SERVER, TESTS } = require("./assessment-core");

const MAX_GENERATED_REPORT_CHARS = 200000;

function safeText(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildReportSkillInsights(blockResults) {
  const ranked = Object.keys(blockResults || {}).map(key => {
    const block = blockResults[key] || {};
    return {
      key,
      name: String(block.name || key),
      percent: Math.max(0, Math.min(100, Number(block.percent || 0))),
      earned: Number(block.earned || 0),
      total: Number(block.total || 0)
    };
  }).sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name));
  const strengths = ranked.filter(item => item.percent >= 80)
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name)).slice(0, 3);
  const developmentAreas = ranked.filter(item => item.percent < 70).slice(0, 3);
  const interviewChecks = (developmentAreas.length ? developmentAreas : ranked.slice(0, 2)).map(item => ({
    ...item,
    prompt: "Попросить разобрать практический кейс по этому блоку и вслух объяснить ход решения."
  }));
  return { strengths, developmentAreas, interviewChecks };
}

function buildTxtReport(data) {
  const answers = Array.isArray(data.answerDetails || data.answers) ? (data.answerDetails || data.answers) : [];
  const blocks = data.blockResults && typeof data.blockResults === "object" ? data.blockResults : {};
  const testTitle = data.testTitle || TESTS[data.testId] && TESTS[data.testId].title || data.testId || "Тест";
  const lines = [];
  lines.push("SKILLCHECK RESULT REPORT", "========================", "");
  lines.push("Код результата: " + safeText(data.code));
  lines.push("Test ID: " + safeText(data.testId));
  lines.push("Тест: " + safeText(testTitle));
  lines.push("Дата и время прохождения: " + safeText(data.completedAt));
  lines.push("Проверка балла: серверный расчёт по закрытому ключу ответов (" + safeText(data.scoringAlgorithmVersion || AUTHORITATIVE_SCORING_VERSION) + ")");
  lines.push("Проверка телеметрии: клиентские технические признаки не верифицированы", "");

  lines.push("КАНДИДАТ", "--------");
  lines.push("Имя/ФИО: " + safeText(data.name));
  lines.push("Email: " + safeText(data.email));
  if (data.telegram) lines.push("Telegram: " + safeText(data.telegram));
  lines.push("Английский: " + safeText(data.englishLevel));
  lines.push("Опыт: " + safeText(data.candidateExperience));
  lines.push("Источник: " + safeText(data.candidateSource));
  lines.push("Версия отдельного согласия на обработку ПДн: " + safeText(data.privacyConsentVersion));
  lines.push("Согласие зафиксировано backend: " + safeText(data.privacyConsentedAt));
  lines.push("Подтверждение 18+: " + (data.ageConfirmed === true ? "да" : "нет"));
  lines.push("Передача работодателю: выключена в текущем MVP; отдельное согласие для конкретного получателя не оформлялось", "");

  lines.push("РЕЗУЛЬТАТ", "---------");
  lines.push("Сырой результат: " + Number(data.rawScore || 0) + "/" + Number(data.rawTotal || 0));
  lines.push("Итоговый балл: " + Number(data.finalScore || 0));
  lines.push("Процент: " + Number(data.percent || 0));
  lines.push("Без ответа: " + Number(data.unansweredCount || 0));
  lines.push("Штрафы: 0");
  lines.push("Рекомендательный штраф по клиентской телеметрии (не влияет на итог): " + Number(data.advisoryPenalty || 0));
  lines.push("Уходы со вкладки: " + Number(data.tabSwitches || 0));
  lines.push("Trust Score: " + Number(data.trustScore || 0));
  lines.push("Плашка: " + safeText(data.badge));
  lines.push("Статус: " + safeText(data.status || data.passStatus));
  lines.push("Итоговый вывод: " + safeText(data.recommendation || data.finalDecision), "");

  if (Object.keys(blocks).length) {
    const insights = buildReportSkillInsights(blocks);
    lines.push("SKILL CARD", "----------");
    Object.keys(blocks).forEach(key => {
      const block = blocks[key] || {};
      lines.push(safeText(block.name || key) + ": " + Number(block.percent || 0) + "% (" +
        Number(block.earned || 0) + "/" + Number(block.total || 0) + " баллов, вес " + Math.round(Number(block.weight || 0) * 100) + "%)");
    });
    lines.push("", "СИЛЬНЫЕ СТОРОНЫ", "----------------");
    if (insights.strengths.length) insights.strengths.forEach(item => lines.push("- " + safeText(item.name) + ": " + item.percent + "%"));
    else lines.push("- По порогу 80% сильные блоки пока не выделены.");
    lines.push("", "ЗОНЫ РАЗВИТИЯ", "-------------");
    if (insights.developmentAreas.length) insights.developmentAreas.forEach(item => lines.push("- " + safeText(item.name) + ": " + item.percent + "%"));
    else lines.push("- Блоков ниже 70% не выявлено.");
    lines.push("", "ЧТО ПРОВЕРИТЬ НА ИНТЕРВЬЮ", "--------------------------");
    insights.interviewChecks.forEach(item => lines.push("- " + safeText(item.name) + " (" + item.percent + "%): " + safeText(item.prompt)));
    lines.push("Результат теста — сигнал для структурированного интервью, а не самостоятельное доказательство профессиональной пригодности.", "");
  }

  lines.push("ВОПРОСЫ И ОТВЕТЫ", "----------------");
  answers.forEach((answer, index) => {
    lines.push("Вопрос " + (index + 1) + ": " + safeText(answer.question));
    lines.push("Ответ кандидата: " + safeText(answer.selectedAnswer));
    lines.push("Правильный ответ: " + safeText(answer.correctAnswer));
    lines.push("Результат: " + (answer.isCorrect ? "верно" : "неверно"));
    lines.push("Статус ответа: " + safeText(answer.status));
    lines.push("Баллы: " + Number(answer.earnedPoints || 0) + "/" + Number(answer.points || 0));
    lines.push("Время: " + Number(answer.timeSpent || 0) + "/" + Number(answer.timeLimit || 0) + " сек.");
    if (answer.comment) lines.push("Комментарий: " + safeText(answer.comment));
    lines.push("");
  });

  const report = lines.join("\n");
  if (report.length > MAX_GENERATED_REPORT_CHARS) throw new Error("report_too_large");
  if (data.scoreVerification && data.scoreVerification !== SCORE_VERIFICATION_SERVER) throw new Error("report_requires_server_score");
  return report;
}

module.exports = { MAX_GENERATED_REPORT_CHARS, buildReportSkillInsights, buildTxtReport, safeText };
