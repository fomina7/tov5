import { describe, expect, it } from "vitest";
import {
  createDeck,
  evaluateBestHand,
  compareHands,
  createNewHand,
  processAction,
  getBotAction,
  sanitizeForPlayer,
  type GameState,
  type PlayerState,
  type Card,
} from "./pokerEngine";

describe("Poker Engine - Deck", () => {
  it("creates a full 52-card deck", () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    // Check all unique
    const unique = new Set(deck.map(c => `${c.rank}_${c.suit}`));
    expect(unique.size).toBe(52);
  });

  it("shuffles the deck (not in original order)", () => {
    const deck1 = createDeck();
    const deck2 = createDeck();
    // Very unlikely to be identical after shuffle
    const same = deck1.every((c, i) => c.rank === deck2[i].rank && c.suit === deck2[i].suit);
    // This could theoretically fail but probability is astronomically low
    expect(same).toBe(false);
  });
});

describe("Poker Engine - Hand Evaluation", () => {
  it("detects a pair", () => {
    const hole: Card[] = [
      { rank: "A", suit: "hearts" },
      { rank: "A", suit: "diamonds" },
    ];
    const community: Card[] = [
      { rank: "3", suit: "clubs" },
      { rank: "7", suit: "spades" },
      { rank: "9", suit: "hearts" },
      { rank: "J", suit: "diamonds" },
      { rank: "2", suit: "clubs" },
    ];
    const result = evaluateBestHand(hole, community);
    expect(result.name).toBe("Pair");
    expect(result.rank).toBe(1);
  });

  it("detects a flush", () => {
    const hole: Card[] = [
      { rank: "A", suit: "hearts" },
      { rank: "K", suit: "hearts" },
    ];
    const community: Card[] = [
      { rank: "3", suit: "hearts" },
      { rank: "7", suit: "hearts" },
      { rank: "9", suit: "hearts" },
      { rank: "J", suit: "diamonds" },
      { rank: "2", suit: "clubs" },
    ];
    const result = evaluateBestHand(hole, community);
    expect(result.name).toBe("Flush");
    expect(result.rank).toBe(5);
  });

  it("detects a straight", () => {
    const hole: Card[] = [
      { rank: "5", suit: "hearts" },
      { rank: "6", suit: "diamonds" },
    ];
    const community: Card[] = [
      { rank: "7", suit: "clubs" },
      { rank: "8", suit: "spades" },
      { rank: "9", suit: "hearts" },
      { rank: "J", suit: "diamonds" },
      { rank: "2", suit: "clubs" },
    ];
    const result = evaluateBestHand(hole, community);
    expect(result.name).toBe("Straight");
  });

  it("detects a full house", () => {
    const hole: Card[] = [
      { rank: "K", suit: "hearts" },
      { rank: "K", suit: "diamonds" },
    ];
    const community: Card[] = [
      { rank: "K", suit: "clubs" },
      { rank: "7", suit: "spades" },
      { rank: "7", suit: "hearts" },
      { rank: "J", suit: "diamonds" },
      { rank: "2", suit: "clubs" },
    ];
    const result = evaluateBestHand(hole, community);
    expect(result.name).toBe("Full House");
    expect(result.rank).toBe(6);
  });

  it("compares hands correctly", () => {
    const flush = { rank: 5, name: "Flush", values: [14, 13, 9, 7, 3] };
    const pair = { rank: 1, name: "Pair", values: [14, 11, 9, 7] };
    expect(compareHands(flush, pair)).toBeGreaterThan(0);
    expect(compareHands(pair, flush)).toBeLessThan(0);
  });
});

describe("Poker Engine - Game Flow", () => {
  function createTestState(): GameState {
    return {
      tableId: 1,
      phase: "waiting",
      communityCards: [],
      deck: [],
      players: [
        {
          oddsId: 0, oddsUserId: 1, seatIndex: 0, name: "Player1", avatar: "fox",
          chipStack: 1000, currentBet: 0, holeCards: [], folded: false, allIn: false,
          isBot: false, lastAction: undefined, disconnected: false, sittingOut: false,
        },
        {
          oddsId: 1, oddsUserId: null, seatIndex: 1, name: "Bot1", avatar: "shark",
          chipStack: 1000, currentBet: 0, holeCards: [], folded: false, allIn: false,
          isBot: true, botDifficulty: "medium", lastAction: undefined, disconnected: false, sittingOut: false,
        },
        {
          oddsId: 2, oddsUserId: null, seatIndex: 2, name: "Bot2", avatar: "owl",
          chipStack: 1000, currentBet: 0, holeCards: [], folded: false, allIn: false,
          isBot: true, botDifficulty: "beginner", lastAction: undefined, disconnected: false, sittingOut: false,
        },
      ],
      pots: [{ amount: 0, eligiblePlayerIds: [0, 1, 2] }],
      currentBet: 0,
      minRaise: 10,
      dealerSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 2,
      actionSeat: 0,
      smallBlind: 5,
      bigBlind: 10,
      handNumber: 0,
      actionDeadline: 0,
      lastRaiserSeat: -1,
      roundActionCount: 0,
    };
  }

  it("creates a new hand with proper blinds", () => {
    const state = createTestState();
    const newState = createNewHand(state);

    expect(newState.phase).toBe("preflop");
    expect(newState.handNumber).toBe(1);
    // All players should have hole cards
    for (const p of newState.players) {
      expect(p.holeCards.length).toBe(2);
    }
    // Blinds should be posted
    const sbPlayer = newState.players.find(p => p.seatIndex === newState.smallBlindSeat);
    const bbPlayer = newState.players.find(p => p.seatIndex === newState.bigBlindSeat);
    expect(sbPlayer!.currentBet).toBe(5);
    expect(bbPlayer!.currentBet).toBe(10);
  });

  it("processes fold action correctly", () => {
    const state = createTestState();
    const handState = createNewHand(state);
    const actionSeat = handState.actionSeat;
    const result = processAction(handState, actionSeat, "fold");
    const foldedPlayer = result.players.find(p => p.seatIndex === actionSeat);
    expect(foldedPlayer!.folded).toBe(true);
    expect(foldedPlayer!.lastAction).toBe("FOLD");
  });

  it("processes call action correctly", () => {
    const state = createTestState();
    const handState = createNewHand(state);
    const actionSeat = handState.actionSeat;
    const player = handState.players.find(p => p.seatIndex === actionSeat)!;
    const callAmount = handState.currentBet - player.currentBet;

    const result = processAction(handState, actionSeat, "call");
    const calledPlayer = result.players.find(p => p.seatIndex === actionSeat);
    expect(calledPlayer!.lastAction).toBe("CALL");
    expect(calledPlayer!.currentBet).toBe(handState.currentBet);
  });

  it("sanitizes state for player (hides other cards)", () => {
    const state = createTestState();
    const handState = createNewHand(state);
    const sanitized = sanitizeForPlayer(handState, 0);

    // Player 0 should see their own cards
    const self = sanitized.players.find((p: any) => p.seatIndex === 0);
    expect(self.holeCards.length).toBe(2);

    // Other players' cards should be hidden (preflop, not showdown)
    const other = sanitized.players.find((p: any) => p.seatIndex === 1);
    expect(other.holeCards.length).toBe(0);
  });

  it("bot generates a valid action", () => {
    const state = createTestState();
    const handState = createNewHand(state);
    const bot = handState.players.find(p => p.isBot)!;
    const action = getBotAction(handState, bot);
    expect(["fold", "check", "call", "raise", "allin"]).toContain(action.action);
  });
});
