import { describe, expect, it, jest } from '@jest/globals';
import { AnalyticsService } from './analytics.service';

const asyncMock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

// A student with `n` weak topics (1 of 4 right in each), one result.
function serviceWithWeakTopics(n: number, plan: 'FREE' | 'PREMIUM') {
  const topicBreakdowns = Array.from({ length: n }, (_, i) => ({
    topicId: `t${i}`,
    name: `Topic ${i}`,
    correct: 1,
    total: 4,
  }));
  const prisma = {
    result: {
      findMany: asyncMock().mockResolvedValue([
        {
          id: 'r1',
          score: 25,
          correct: n,
          incorrect: 3 * n,
          unanswered: 0,
          totalQuestions: 4 * n,
          createdAt: new Date('2026-11-20T10:00:00Z'),
          examSession: { mode: 'PRACTICE' },
          subjectBreakdowns: [],
          topicBreakdowns,
        },
      ]),
    },
    topic: {
      findMany: asyncMock().mockResolvedValue(topicBreakdowns.map((t) => ({ id: t.topicId, subjectId: 's1' }))),
    },
    user: { findUnique: asyncMock().mockResolvedValue({ plan }) },
  };
  const cache = { get: asyncMock().mockResolvedValue(null), set: asyncMock(), delByPrefix: asyncMock() };
  return new AnalyticsService(prisma as never, cache as never);
}

describe('AnalyticsService.getForStudent weak topics', () => {
  it('gives Premium every weak topic and counts them all (more than 100)', async () => {
    const data = await serviceWithWeakTopics(101, 'PREMIUM').getForStudent('u1');
    expect(data.weakTopics).toHaveLength(101);
    expect(data.weakTopicsTotal).toBe(101);
    expect(data.weakTopics.every((t) => t.subjectId === 's1')).toBe(true);
  });

  it('gives Free only the weakest topic, with the full total', async () => {
    const data = await serviceWithWeakTopics(101, 'FREE').getForStudent('u1');
    expect(data.weakTopics).toHaveLength(1);
    expect(data.weakTopicsTotal).toBe(101);
  });

  it('counts only topics under half right with at least 3 attempts', async () => {
    const service = serviceWithWeakTopics(0, 'PREMIUM');
    const prisma = (service as unknown as { prisma: { result: { findMany: ReturnType<typeof asyncMock> } } }).prisma;
    prisma.result.findMany.mockResolvedValue([
      {
        id: 'r1', score: 50, correct: 5, incorrect: 5, unanswered: 0, totalQuestions: 10,
        createdAt: new Date(), examSession: { mode: 'PRACTICE' }, subjectBreakdowns: [],
        topicBreakdowns: [
          { topicId: 'weak', name: 'Weak', correct: 1, total: 4 },
          { topicId: 'fine', name: 'Fine', correct: 3, total: 4 },
          { topicId: 'few', name: 'Too few', correct: 0, total: 2 },
        ],
      },
    ]);
    const data = await service.getForStudent('u1');
    expect(data.weakTopics.map((t) => t.topicId)).toEqual(['weak']);
    expect(data.weakTopicsTotal).toBe(1);
  });
});
