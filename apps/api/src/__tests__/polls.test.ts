import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PollService } from '../services/poll.service';
import { buildServer } from '../server';

// Helper to safely extract string values from Drizzle AST objects without circular errors
function getStringsFrom(obj: any, visited = new Set<any>()): string[] {
  if (!obj || visited.has(obj)) return [];
  visited.add(obj);
  const results: string[] = [];
  if (typeof obj === 'string') {
    results.push(obj);
    return results;
  }
  if (typeof obj === 'object') {
    for (const key of Object.getOwnPropertyNames(obj)) {
      try {
        results.push(...getStringsFrom(obj[key], visited));
      } catch (_) {}
    }
    for (const sym of Object.getOwnPropertySymbols(obj)) {
      try {
        results.push(...getStringsFrom((obj as any)[sym], visited));
      } catch (_) {}
    }
  }
  return results;
}

describe('Polls System & Real-time Voting (T-26)', () => {
  const proAccountId = '11111111-1111-1111-1111-111111111111';
  const freeAccountId = '22222222-2222-2222-2222-222222222222';
  const mockConvId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const user1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const user2Id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const user3Id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  let mockPollsData: any[] = [];
  let mockOptionsData: any[] = [];
  let mockVotesData: any[] = [];
  let mockMessagesData: any[] = [];
  let mockConversationsData: any[] = [];
  let mockMembersData: any[] = [];
  let mockIo: any;
  let mockPresenceService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPollsData = [];
    mockOptionsData = [];
    mockVotesData = [];
    mockMessagesData = [];
    mockConversationsData = [
      {
        id: mockConvId,
        accountId: proAccountId,
        type: 'group',
        title: 'Squad Geral',
        status: 'active',
      },
    ];
    mockMembersData = [
      { conversationId: mockConvId, userId: user1Id, role: 'admin' },
      { conversationId: mockConvId, userId: user2Id, role: 'member' },
      { conversationId: mockConvId, userId: user3Id, role: 'member' },
    ];

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    mockPresenceService = {
      isUserOnline: vi.fn(async () => true),
      setIoServer: vi.fn(),
    };
  });

  const createMockDb = () => {
    const mockAccounts: Record<string, any> = {
      [proAccountId]: { id: proAccountId, name: 'Pro Corp', plan: 'pro', status: 'active' },
      [freeAccountId]: { id: freeAccountId, name: 'Free Org', plan: 'free', status: 'active' },
    };

    const mockUsersList = [
      { id: user1Id, accountId: proAccountId, name: 'Lucas Admin', email: 'lucas@corp.com', role: 'admin', status: 'active' },
      { id: user2Id, accountId: proAccountId, name: 'Beatriz Dev', email: 'beatriz@corp.com', role: 'member', status: 'active' },
      { id: user3Id, accountId: proAccountId, name: 'Marcos QA', email: 'marcos@corp.com', role: 'member', status: 'active' },
    ];

    return {
      query: {
        accounts: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            for (const accId of Object.keys(mockAccounts)) {
              if (strings.includes(accId)) return mockAccounts[accId];
            }
            return mockAccounts[proAccountId];
          }),
        },
        users: {
          findMany: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockUsersList.filter((u) => strings.includes(u.accountId) || strings.includes(u.id));
          }),
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            return mockUsersList.find((u) => strings.includes(u.id)) || mockUsersList[0];
          }),
        },
        conversations: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const conv = mockConversationsData.find((c) => strings.includes(c.id));
            if (!conv) return null;
            return {
              ...conv,
              members: mockMembersData.filter((m) => m.conversationId === conv.id),
            };
          }),
        },
        polls: {
          findFirst: vi.fn(async ({ where }: any) => {
            const strings = getStringsFrom(where);
            const poll = mockPollsData.find((p) => strings.includes(p.id));
            if (!poll) return null;
            const conv = mockConversationsData.find((c) => c.id === poll.conversationId);
            const options = mockOptionsData.filter((o) => o.pollId === poll.id);
            const votes = mockVotesData
              .filter((v) => v.pollId === poll.id)
              .map((v) => ({
                ...v,
                user: mockUsersList.find((u) => u.id === v.userId),
              }));

            return {
              ...poll,
              conversation: {
                ...conv,
                members: mockMembersData.filter((m) => m.conversationId === conv?.id),
              },
              creator: mockUsersList.find((u) => u.id === poll.creatorId),
              options,
              votes,
            };
          }),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          let returnedVal: any = [val];
          if (Array.isArray(val)) {
            val.forEach((item) => {
              if (item.pollId && item.text) {
                const optRecord = { id: crypto.randomUUID(), ...item, createdAt: new Date() };
                mockOptionsData.push(optRecord);
              } else if (item.pollId && item.optionId) {
                const voteRecord = { id: crypto.randomUUID(), ...item, createdAt: new Date() };
                mockVotesData.push(voteRecord);
              }
            });
            returnedVal = val;
          } else if (val.question !== undefined && val.allowMultiple !== undefined) {
            const pollRecord = { id: crypto.randomUUID(), ...val, createdAt: new Date(), updatedAt: new Date() };
            mockPollsData.push(pollRecord);
            returnedVal = [pollRecord];
          } else if (val.content !== undefined) {
            const msgRecord = { id: crypto.randomUUID(), ...val, createdAt: new Date() };
            mockMessagesData.push(msgRecord);
            returnedVal = [msgRecord];
          }
          return {
            returning: () => returnedVal,
            then: (resolve: any) => Promise.resolve(returnedVal).then(resolve),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((setVals: any) => ({
          where: vi.fn((whereClause: any) => {
            const strings = getStringsFrom(whereClause);
            const targetPoll = mockPollsData.find((p) => strings.includes(p.id));
            if (targetPoll) {
              Object.assign(targetPoll, setVals);
            }
            return {
              returning: () => (targetPoll ? [targetPoll] : []),
              then: (resolve: any) => Promise.resolve([targetPoll]).then(resolve),
            };
          }),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn((whereClause: any) => {
          const strings = getStringsFrom(whereClause);
          mockVotesData = mockVotesData.filter((v) => !(strings.includes(v.pollId) && strings.includes(v.userId)));
          return {
            then: (resolve: any) => Promise.resolve({ rowCount: 1 }).then(resolve),
          };
        }),
      })),
    };
  };

  describe('Plan & Feature Gate (T-26)', () => {
    it('blocks Free plan accounts from creating polls with 403 error', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      await expect(
        pollService.createPoll(freeAccountId, user1Id, {
          conversationId: mockConvId,
          question: 'Qual o melhor dia para o deploy?',
          options: ['Segunda', 'Quarta', 'Sexta'],
        })
      ).rejects.toThrow('O recurso de enquetes não está disponível no plano Free.');
    });
  });

  describe('Poll Creation & Validation (T-26)', () => {
    it('creates a single-choice identified poll with options and broadcasts event', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      const poll = await pollService.createPoll(proAccountId, user1Id, {
        conversationId: mockConvId,
        question: 'Qual framework frontend devemos adotar?',
        options: ['React', 'Vue', 'Svelte'],
        allowMultiple: false,
        isAnonymous: false,
      });

      expect(poll.question).toBe('Qual framework frontend devemos adotar?');
      expect(poll.allowMultiple).toBe(false);
      expect(poll.isAnonymous).toBe(false);
      expect(poll.options).toHaveLength(3);
      expect(poll.options.map((o) => o.text)).toEqual(['React', 'Vue', 'Svelte']);
      expect(poll.status).toBe('active');
      expect(poll.totalVotes).toBe(0);

      // Verify WebSocket broadcast
      expect(mockIo.to).toHaveBeenCalledWith(`conversation:${mockConvId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('poll:new', expect.any(Object));
    });

    it('rejects poll creation with deadline in the past', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();

      await expect(
        pollService.createPoll(proAccountId, user1Id, {
          conversationId: mockConvId,
          question: 'Pergunta inválida',
          options: ['Opção 1', 'Opção 2'],
          expiresAt: pastDate,
        })
      ).rejects.toThrow('O prazo de votação da enquete deve ser no futuro.');
    });
  });

  describe('Voting System & Real-time Results (T-26)', () => {
    it('records single-choice votes and updates percentages accurately', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      // 1. Create poll
      const poll = await pollService.createPoll(proAccountId, user1Id, {
        conversationId: mockConvId,
        question: 'Horário do alinhamento diário',
        options: ['09:00', '10:00'],
        allowMultiple: false,
        isAnonymous: false,
      });

      const opt1Id = poll.options[0].id;
      const opt2Id = poll.options[1].id;

      // 2. User 1 votes for option 1
      const res1 = await pollService.votePoll(proAccountId, user1Id, poll.id, {
        optionIds: [opt1Id],
      });
      expect(res1.totalVotes).toBe(1);
      expect(res1.options[0].votesCount).toBe(1);
      expect(res1.options[0].percentage).toBe(100);
      expect(res1.options[1].votesCount).toBe(0);
      expect(res1.options[1].percentage).toBe(0);
      expect(res1.options[0].voters?.[0].name).toBe('Lucas Admin');

      // 3. User 2 votes for option 2
      const res2 = await pollService.votePoll(proAccountId, user2Id, poll.id, {
        optionIds: [opt2Id],
      });
      expect(res2.totalVotes).toBe(2);
      expect(res2.options[0].percentage).toBe(50);
      expect(res2.options[1].percentage).toBe(50);

      // 4. User 1 changes vote from option 1 to option 2 (replaces previous vote, no duplicate counts)
      const res3 = await pollService.votePoll(proAccountId, user1Id, poll.id, {
        optionIds: [opt2Id],
      });
      expect(res3.totalVotes).toBe(2);
      expect(res3.options[0].votesCount).toBe(0);
      expect(res3.options[0].percentage).toBe(0);
      expect(res3.options[1].votesCount).toBe(2);
      expect(res3.options[1].percentage).toBe(100);
    });

    it('rejects multiple options on a single-choice poll', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      const poll = await pollService.createPoll(proAccountId, user1Id, {
        conversationId: mockConvId,
        question: 'Escolha seu prato favorito',
        options: ['Pizza', 'Sushi'],
        allowMultiple: false,
      });

      const optIds = poll.options.map((o) => o.id);

      await expect(
        pollService.votePoll(proAccountId, user1Id, poll.id, {
          optionIds: optIds,
        })
      ).rejects.toThrow('Esta enquete permite apenas voto único.');
    });

    it('withholds voter identities on anonymous polls', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      const poll = await pollService.createPoll(proAccountId, user1Id, {
        conversationId: mockConvId,
        question: 'Feedback Anônimo sobre Clima',
        options: ['Excelente', 'Regular'],
        allowMultiple: false,
        isAnonymous: true,
      });

      const opt1Id = poll.options[0].id;
      const res = await pollService.votePoll(proAccountId, user1Id, poll.id, {
        optionIds: [opt1Id],
      });

      expect(res.isAnonymous).toBe(true);
      expect(res.options[0].votesCount).toBe(1);
      expect(res.options[0].voters).toBeUndefined();
    });
  });

  describe('Poll Closure & Deadlines (T-26)', () => {
    it('allows creator or admin to close poll and blocks subsequent votes', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      const poll = await pollService.createPoll(proAccountId, user1Id, {
        conversationId: mockConvId,
        question: 'Votação Rápida',
        options: ['Sim', 'Não'],
      });

      // Close poll
      const closed = await pollService.closePoll(proAccountId, user1Id, 'admin', poll.id);
      expect(closed.status).toBe('closed');
      expect(closed.isExpired).toBe(true);

      // Subsequent vote is rejected
      await expect(
        pollService.votePoll(proAccountId, user2Id, poll.id, {
          optionIds: [poll.options[0].id],
        })
      ).rejects.toThrow('Esta enquete já está encerrada e não aceita novos votos.');
    });
  });

  describe('Fastify Poll Routes (/api/polls)', () => {
    it('POST /api/polls creates poll via HTTP and returns 201', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);
      const app = buildServer({ pollService });
      await app.ready();

      const token = app.jwt.sign({
        userId: user1Id,
        accountId: proAccountId,
        role: 'admin',
        email: 'lucas@corp.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/polls',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          conversationId: mockConvId,
          question: 'Local da confraternização',
          options: ['Churrascaria', 'Restaurante Italiano'],
          allowMultiple: false,
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.payload);
      expect(json.question).toBe('Local da confraternização');
      expect(json.options).toHaveLength(2);

      await app.close();
    });

    it('POST /api/polls/:pollId/vote casts vote via HTTP and returns 200', async () => {
      const mockDb = createMockDb() as any;
      const pollService = new PollService(mockDb, mockPresenceService, mockIo);

      const poll = await pollService.createPoll(proAccountId, user1Id, {
        conversationId: mockConvId,
        question: 'Enquete HTTP',
        options: ['Opção A', 'Opção B'],
      });

      const app = buildServer({ pollService });
      await app.ready();

      const token = app.jwt.sign({
        userId: user2Id,
        accountId: proAccountId,
        role: 'member',
        email: 'beatriz@corp.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/polls/${poll.id}/vote`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          optionIds: [poll.options[0].id],
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.totalVotes).toBe(1);
      expect(json.userHasVoted).toBe(true);

      await app.close();
    });
  });
});
