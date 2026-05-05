import { Injectable } from '@nestjs/common';

// ─── Types (identical to lib/utils/scoring.ts) ────────────────────────────────
export type ScoringAnswer = {
  questionId: string;
  isCorrect: boolean | null;
  question: {
    subjectId: string;
    topicId: string | null;
    subject: { id: string; name: string };
    topic: { id: string; name: string } | null;
  };
};

export type SubjectBreakdownEntry = {
  subjectId: string;
  name: string;
  correct: number;
  total: number;
};

export type TopicBreakdownEntry = {
  topicId: string;
  name: string;
  correct: number;
  total: number;
};

export type ScoreResult = {
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  subjectBreakdown: SubjectBreakdownEntry[];
  topicBreakdown: TopicBreakdownEntry[];
};

@Injectable()
export class ScoringService {
  /**
   * Computes score, subject breakdown, and topic breakdown.
   * Identical logic to lib/utils/scoring.ts → computeScore().
   */
  computeScore(answers: ScoringAnswer[], totalQuestions: number): ScoreResult {
    const correct = answers.filter((a) => a.isCorrect === true).length;
    const incorrect = answers.filter((a) => a.isCorrect === false).length;
    const unanswered = totalQuestions - answers.length;
    const score = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;

    const subjectMap: Record<string, SubjectBreakdownEntry> = {};
    for (const answer of answers) {
      const sid = answer.question.subjectId;
      if (!subjectMap[sid]) {
        subjectMap[sid] = {
          subjectId: sid,
          name: answer.question.subject.name,
          correct: 0,
          total: 0,
        };
      }
      subjectMap[sid].total++;
      if (answer.isCorrect) subjectMap[sid].correct++;
    }

    const topicMap: Record<string, TopicBreakdownEntry> = {};
    for (const answer of answers) {
      if (!answer.question.topicId || !answer.question.topic) continue;
      const tid = answer.question.topicId;
      if (!topicMap[tid]) {
        topicMap[tid] = {
          topicId: tid,
          name: answer.question.topic.name,
          correct: 0,
          total: 0,
        };
      }
      topicMap[tid].total++;
      if (answer.isCorrect) topicMap[tid].correct++;
    }

    return {
      correct,
      incorrect,
      unanswered,
      score: Math.round(score * 100) / 100,
      subjectBreakdown: Object.values(subjectMap),
      topicBreakdown: Object.values(topicMap),
    };
  }
}
