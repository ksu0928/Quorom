import { describe, it, expect } from 'vitest';
import { viewFor } from './view-filter.js';
import type { Room } from '@quorum/shared';

describe('viewFor', () => {
  const baseRoom: Room = {
    id: 'TEST123',
    title: 'Test Room',
    phase: 'lobby',
    hostId: 'p1',
    participants: [
      { id: 'p1', name: 'Alice', connected: true, isAI: false, joinedAt: Date.now() },
      { id: 'p2', name: 'Bob', connected: true, isAI: false, joinedAt: Date.now() },
      { id: 'p3', name: 'Charlie', connected: true, isAI: false, joinedAt: Date.now() },
    ],
    options: [
      { id: 'opt1', title: 'Option 1', addedBy: 'p1', suggestedByAI: false },
      { id: 'opt2', title: 'Option 2', addedBy: 'p2', suggestedByAI: false },
    ],
    ratings: {
      p1: {
        opt1: { score: 5, reason: 'Alice likes opt1' },
        opt2: { score: 3, reason: 'Alice neutral on opt2' },
      },
      p2: {
        opt1: { score: 2, reason: 'Bob dislikes opt1' },
        opt2: { score: 4, reason: 'Bob likes opt2' },
      },
      p3: {
        opt1: { score: 4 },
        opt2: { score: 5, reason: 'Charlie loves opt2' },
      },
    },
    votes: {},
    analysis: null,
    summary: null,
    locked: false,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  describe('rating phase - privacy enforcement', () => {
    it('should only show requesting participant\'s own ratings', () => {
      const room: Room = { ...baseRoom, phase: 'rating' };
      
      const view = viewFor(room, 'p1');
      
      // Should have p1's ratings
      expect(view.ratings['p1']).toBeDefined();
      expect(view.ratings['p1'].opt1.score).toBe(5);
      expect(view.ratings['p1'].opt1.reason).toBe('Alice likes opt1');
      
      // Should NOT have p2's or p3's ratings
      expect(view.ratings['p2']).toBeUndefined();
      expect(view.ratings['p3']).toBeUndefined();
      
      // Serialize and check JSON doesn't contain other ratings
      const json = JSON.stringify(view);
      expect(json).not.toContain('Bob dislikes opt1');
      expect(json).not.toContain('Charlie loves opt2');
      expect(json).toContain('Alice likes opt1');
    });

    it('should not leak other participants\' scores in serialized JSON', () => {
      const room: Room = { ...baseRoom, phase: 'rating' };
      
      const viewP2 = viewFor(room, 'p2');
      const json = JSON.stringify(viewP2);
      
      // Should contain p2's data
      expect(json).toContain('"score":2');
      expect(json).toContain('Bob dislikes opt1');
      
      // Should NOT contain p1's or p3's scores or reasons
      expect(json).not.toContain('"score":5');
      expect(json).not.toContain('Alice likes opt1');
      expect(json).not.toContain('Charlie loves opt2');
    });

    it('should show rating progress without revealing individual ratings', () => {
      const room: Room = { ...baseRoom, phase: 'rating' };
      
      const view = viewFor(room, 'p1');
      
      expect(view.ratingProgress).toBeDefined();
      expect(view.ratingProgress?.finished).toBe(3); // All 3 rated both options
      expect(view.ratingProgress?.total).toBe(3);
    });

    it('should handle participant with no ratings yet', () => {
      const room: Room = {
        ...baseRoom,
        phase: 'rating',
        ratings: {
          p1: { opt1: { score: 5 } },
        },
      };
      
      const view = viewFor(room, 'p2');
      
      expect(view.ratings).toEqual({});
      expect(view.ratingProgress?.finished).toBe(0); // p1 hasn't rated all options
      expect(view.ratingProgress?.total).toBe(3);
    });

    it('should count finished participants correctly', () => {
      const room: Room = {
        ...baseRoom,
        phase: 'rating',
        ratings: {
          p1: {
            opt1: { score: 5 },
            opt2: { score: 4 },
          },
          p2: {
            opt1: { score: 3 }, // Only rated one option
          },
          p3: {
            opt1: { score: 2 },
            opt2: { score: 1 },
          },
        },
      };
      
      const view = viewFor(room, 'p1');
      
      expect(view.ratingProgress?.finished).toBe(2); // p1 and p3
      expect(view.ratingProgress?.total).toBe(3);
    });
  });

  describe('revealed phase and later - full visibility', () => {
    it('should show all ratings in revealed phase', () => {
      const room: Room = { ...baseRoom, phase: 'revealed' };
      
      const view = viewFor(room, 'p1');
      
      expect(view.ratings['p1']).toBeDefined();
      expect(view.ratings['p2']).toBeDefined();
      expect(view.ratings['p3']).toBeDefined();
      
      expect(view.ratings['p2'].opt1.score).toBe(2);
      expect(view.ratings['p3'].opt2.reason).toBe('Charlie loves opt2');
    });

    it('should show all ratings in voting phase', () => {
      const room: Room = { ...baseRoom, phase: 'voting' };
      
      const view = viewFor(room, 'p2');
      
      expect(Object.keys(view.ratings)).toHaveLength(3);
      expect(view.ratings['p1'].opt1.score).toBe(5);
    });

    it('should show all ratings in decided phase', () => {
      const room: Room = { ...baseRoom, phase: 'decided' };
      
      const view = viewFor(room, 'p3');
      
      expect(Object.keys(view.ratings)).toHaveLength(3);
      expect(view.ratings['p2'].opt2.reason).toBe('Bob likes opt2');
    });

    it('should not include ratingProgress after rating phase', () => {
      const room: Room = { ...baseRoom, phase: 'revealed' };
      
      const view = viewFor(room, 'p1');
      
      expect(view.ratingProgress).toBeUndefined();
    });
  });

  describe('lobby and options phases', () => {
    it('should show no ratings in lobby phase', () => {
      const room: Room = { ...baseRoom, phase: 'lobby' };
      
      const view = viewFor(room, 'p1');
      
      expect(view.ratings).toEqual({});
    });

    it('should show no ratings in options phase', () => {
      const room: Room = { ...baseRoom, phase: 'options' };
      
      const view = viewFor(room, 'p1');
      
      expect(view.ratings).toEqual({});
    });
  });

  describe('AI participant exclusion', () => {
    it('should not count AI participants in rating progress', () => {
      const room: Room = {
        ...baseRoom,
        phase: 'rating',
        participants: [
          ...baseRoom.participants,
          { id: 'ai1', name: 'AI Assistant', connected: true, isAI: true, joinedAt: Date.now() },
        ],
      };
      
      const view = viewFor(room, 'p1');
      
      // AI should not count toward total
      expect(view.ratingProgress?.total).toBe(3); // Still 3 humans
    });
  });

  describe('always visible fields', () => {
    it('should always include base room fields', () => {
      const room: Room = { ...baseRoom, phase: 'rating' };
      
      const view = viewFor(room, 'p1');
      
      expect(view.id).toBe('TEST123');
      expect(view.title).toBe('Test Room');
      expect(view.phase).toBe('rating');
      expect(view.hostId).toBe('p1');
      expect(view.participants).toHaveLength(3);
      expect(view.options).toHaveLength(2);
      expect(view.locked).toBe(false);
    });

    it('should include analysis and summary when present', () => {
      const room: Room = {
        ...baseRoom,
        phase: 'decided',
        analysis: {
          perOption: [
            { optionId: 'opt1', mean: 3.67, spread: 3, verdict: 'contested' },
            { optionId: 'opt2', mean: 4.0, spread: 2, verdict: 'consensus' },
          ],
          disagreements: [],
          compromise: { optionId: 'opt2', rationale: 'Highest mean and consensus' },
          aiUnavailable: false,
        },
        summary: 'The group selected Option 2 with strong consensus.',
      };
      
      const view = viewFor(room, 'p1');
      
      expect(view.analysis).toBeDefined();
      expect(view.summary).toBe('The group selected Option 2 with strong consensus.');
    });
  });
});
