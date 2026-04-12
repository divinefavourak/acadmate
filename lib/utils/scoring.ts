import type { Prisma } from "@prisma/client";

type AnswerWithQuestion = {
  questionId: string;
  isCorrect: boolean | null;
  question: {
    subjectId: string;
    topicId: string | null;
    subject: { id: string; name: string };
    topic: { id: string; name: string } | null;
  };
};

export function computeScore(answers: AnswerWithQuestion[], totalQuestions: number) {
  const correct = answers.filter((a) => a.isCorrect === true).length;
  const incorrect = answers.filter((a) => a.isCorrect === false).length;
  const unanswered = totalQuestions - answers.length;
  const score = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;

  // Subject breakdown
  const subjectMap: Record<string, { subjectId: string; name: string; correct: number; total: number }> = {};
  for (const answer of answers) {
    const sid = answer.question.subjectId;
    if (!subjectMap[sid]) {
      subjectMap[sid] = { subjectId: sid, name: answer.question.subject.name, correct: 0, total: 0 };
    }
    subjectMap[sid].total++;
    if (answer.isCorrect) subjectMap[sid].correct++;
  }

  // Topic breakdown
  const topicMap: Record<string, { topicId: string; name: string; correct: number; total: number }> = {};
  for (const answer of answers) {
    if (!answer.question.topicId || !answer.question.topic) continue;
    const tid = answer.question.topicId;
    if (!topicMap[tid]) {
      topicMap[tid] = { topicId: tid, name: answer.question.topic.name, correct: 0, total: 0 };
    }
    topicMap[tid].total++;
    if (answer.isCorrect) topicMap[tid].correct++;
  }

  return {
    correct,
    incorrect,
    unanswered,
    score: Math.round(score * 100) / 100,
    subjectBreakdown: Object.values(subjectMap) as Prisma.InputJsonValue,
    topicBreakdown: Object.values(topicMap) as Prisma.InputJsonValue,
  };
}
