import { describe, it, expect } from 'vitest';
import {
  createDeck, evaluateBestHand, compareHands,
  createNewHand, processAction, sanitizeForPlayer, sanitizeForAdmin,
  findNextActiveSeat, getBotAction,
  type GameState, type PlayerState, type Card, type RakeConfig,
} from './pokerEngine';

// ─── Helper: build a minimal GameState for testing ───────
function makeGameState(playerCount: number, opts?: {
  sb?: number; bb?: number; tableId?: number;
}): GameState {
  const sb = opts?.sb ?? 5;
  const bb = opts?.bb ?? 10;
  const players: PlayerState[] = Array.from({ length: playerCount }, (_, i) => ({
    seatIndex: i,
    oddsUserId: i === 0 ? 100 : null, // first player is human
    name: i === 0 ? 'Hero' : `Bot${i}`,
    avatar: 'fox',
    chipStack: 1000,
    currentBet: 0,
    totalBetThisHand: 0,
    holeCards: [],
    folded: false,
    allIn: false,
    isBot: i > 0,
    botDifficulty: i > 0 ? 'medium' as const : undefined,
    disconnected: false,
    sittingOut: false,
    hasActedThisRound: false,
  }));

  return {
    tableId: opts?.tableId ?? 1,
    phase: 'waiting',
    communityCards: [],
    deck: [],
    players,
    pots: [],
    currentBet: 0,
    minRaise: bb,
    dealerSeat: 0,
    smallBlindSeat: 0,
    bigBlindSeat: 1,
    actionSeat: -1,
    smallBlind: sb,
    bigBlind: bb,
    handNumber: 0,
    actionDeadline: 0,
    lastRaiserSeat: -1,
    rake: { percentage: 0.05, cap: 3, minPotForRake: 20 },
    rakeCollected: 0,
    totalPotBeforeRake: 0,
  };
}

// ─── Deck Tests ──────────────────────────────────────────
describe('Deck', () => {
  it('creates a shuffled 52-card deck', () => {
    const deck = createDeck();
    expect(deck.length).toBe(52);
    const suits = new Set(deck.map(c => c.suit));
    expect(suits.size).toBe(4);
    const ranks = new Set(deck.map(c => c.rank));
    expect(ranks.size).toBe(13);
  });

  it('two decks are in different order (shuffle works)', () => {
    const d1 = createDeck();
    const d2 = createDeck();
    const sameOrder = d1.every((c, i) => c.suit === d2[i].suit && c.rank === d2[i].rank);
    expect(sameOrder).toBe(false); // probability of same order is 1/52!
  });
});

// ─── Hand Evaluation Tests ───────────────────────────────
describe('Hand Evaluation', () => {
  const card = (rank: string, suit: string): Card => ({ rank, suit });

  it('evaluates a royal flush (rank 9)', () => {
    const result = evaluateBestHand(
      [card('A', 'hearts'), card('K', 'hearts')],
      [card('Q', 'hearts'), card('J', 'hearts'), card('10', 'hearts'), card('2', 'clubs'), card('3', 'diamonds')],
    );
    expect(result.rank).toBe(9);
    expect(result.name).toBe('Royal Flush');
  });

  it('evaluates four of a kind (rank 7)', () => {
    const result = evaluateBestHand(
      [card('A', 'hearts'), card('A', 'diamonds')],
      [card('A', 'clubs'), card('A', 'spades'), card('K', 'hearts'), card('2', 'clubs'), card('3', 'diamonds')],
    );
    expect(result.rank).toBe(7);
  });

  it('evaluates a full house (rank 6)', () => {
    const result = evaluateBestHand(
      [card('K', 'hearts'), card('K', 'diamonds')],
      [card('K', 'clubs'), card('Q', 'spades'), card('Q', 'hearts'), card('2', 'clubs'), card('3', 'diamonds')],
    );
    expect(result.rank).toBe(6);
  });

  it('evaluates a flush (rank 5)', () => {
    const result = evaluateBestHand(
      [card('A', 'hearts'), card('J', 'hearts')],
      [card('9', 'hearts'), card('6', 'hearts'), card('3', 'hearts'), card('2', 'clubs'), card('K', 'diamonds')],
    );
    expect(result.rank).toBe(5);
  });

  it('evaluates a straight (rank 4)', () => {
    const result = evaluateBestHand(
      [card('9', 'hearts'), card('8', 'diamonds')],
      [card('7', 'clubs'), card('6', 'spades'), card('5', 'hearts'), card('2', 'clubs'), card('K', 'diamonds')],
    );
    expect(result.rank).toBe(4);
  });

  it('evaluates ace-low straight (wheel)', () => {
    const result = evaluateBestHand(
      [card('A', 'hearts'), card('2', 'diamonds')],
      [card('3', 'clubs'), card('4', 'spades'), card('5', 'hearts'), card('K', 'clubs'), card('J', 'diamonds')],
    );
    expect(result.rank).toBe(4);
  });

  it('evaluates three of a kind (rank 3)', () => {
    const result = evaluateBestHand(
      [card('Q', 'hearts'), card('Q', 'diamonds')],
      [card('Q', 'clubs'), card('9', 'spades'), card('6', 'hearts'), card('2', 'clubs'), card('3', 'diamonds')],
    );
    expect(result.rank).toBe(3);
  });

  it('evaluates two pair (rank 2)', () => {
    const result = evaluateBestHand(
      [card('K', 'hearts'), card('K', 'diamonds')],
      [card('9', 'clubs'), card('9', 'spades'), card('6', 'hearts'), card('2', 'clubs'), card('3', 'diamonds')],
    );
    expect(result.rank).toBe(2);
  });

  it('evaluates one pair (rank 1)', () => {
    const result = evaluateBestHand(
      [card('A', 'hearts'), card('A', 'diamonds')],
      [card('9', 'clubs'), card('6', 'spades'), card('3', 'hearts'), card('2', 'clubs'), card('K', 'diamonds')],
    );
    expect(result.rank).toBe(1);
  });

  it('evaluates high card (rank 0)', () => {
    const result = evaluateBestHand(
      [card('A', 'hearts'), card('J', 'diamonds')],
      [card('9', 'clubs'), card('6', 'spades'), card('3', 'hearts'), card('2', 'clubs'), card('K', 'diamonds')],
    );
    expect(result.rank).toBe(0);
  });

  it('compareHands: flush beats pair', () => {
    const flush = evaluateBestHand(
      [card('A', 'hearts'), card('J', 'hearts')],
      [card('9', 'hearts'), card('6', 'hearts'), card('3', 'hearts'), card('2', 'clubs'), card('K', 'diamonds')],
    );
    const pair = evaluateBestHand(
      [card('A', 'hearts'), card('A', 'diamonds')],
      [card('9', 'clubs'), card('6', 'spades'), card('3', 'hearts'), card('2', 'clubs'), card('K', 'diamonds')],
    );
    expect(compareHands(flush, pair)).toBeGreaterThan(0);
  });

  it('compareHands: same rank uses kickers', () => {
    const pairAces = evaluateBestHand(
      [card('A', 'hearts'), card('A', 'diamonds')],
      [card('K', 'clubs'), card('9', 'spades'), card('3', 'hearts'), card('2', 'clubs'), card('7', 'diamonds')],
    );
    const pairKings = evaluateBestHand(
      [card('K', 'hearts'), card('K', 'diamonds')],
      [card('A', 'clubs'), card('9', 'spades'), card('3', 'hearts'), card('2', 'clubs'), card('7', 'diamonds')],
    );
    expect(compareHands(pairAces, pairKings)).toBeGreaterThan(0);
  });
});

// ─── createNewHand Tests ─────────────────────────────────
describe('createNewHand', () => {
  it('deals 2 cards to each active player and posts blinds', () => {
    const state = makeGameState(3);
    const newState = createNewHand(state);

    expect(newState.phase).toBe('preflop');
    expect(newState.handNumber).toBe(1);
    expect(newState.communityCards.length).toBe(0);

    // Each non-folded player should have 2 hole cards
    const activePlayers = newState.players.filter(p => !p.folded);
    expect(activePlayers.length).toBe(3);
    activePlayers.forEach(p => {
      expect(p.holeCards.length).toBe(2);
    });

    // Deck should have 52 - 6 = 46 cards
    expect(newState.deck.length).toBe(46);

    // Blinds should be posted
    const sbPlayer = newState.players.find(p => p.seatIndex === newState.smallBlindSeat)!;
    const bbPlayer = newState.players.find(p => p.seatIndex === newState.bigBlindSeat)!;
    expect(sbPlayer.currentBet).toBe(5);
    expect(sbPlayer.chipStack).toBe(995);
    expect(bbPlayer.currentBet).toBe(10);
    expect(bbPlayer.chipStack).toBe(990);

    expect(newState.currentBet).toBe(10);
  });

  it('returns waiting state if less than 2 active players', () => {
    const state = makeGameState(1);
    const newState = createNewHand(state);
    expect(newState.phase).toBe('waiting');
  });

  it('handles heads-up correctly (dealer is SB)', () => {
    const state = makeGameState(2);
    const newState = createNewHand(state);
    expect(newState.smallBlindSeat).toBe(newState.dealerSeat);
    expect(newState.smallBlindSeat).not.toBe(newState.bigBlindSeat);
  });
});

// ─── processAction Tests ─────────────────────────────────
describe('processAction', () => {
  function startHand(playerCount = 3): GameState {
    return createNewHand(makeGameState(playerCount));
  }

  it('fold marks player as folded', () => {
    const state = startHand();
    const seat = state.actionSeat;
    const newState = processAction(state, seat, 'fold');
    const player = newState.players.find(p => p.seatIndex === seat)!;
    expect(player.folded).toBe(true);
    expect(player.lastAction).toBe('FOLD');
  });

  it('call deducts correct amount', () => {
    const state = startHand();
    const seat = state.actionSeat;
    const player = state.players.find(p => p.seatIndex === seat)!;
    const stackBefore = player.chipStack;
    const betBefore = player.currentBet;
    const callAmount = state.currentBet - betBefore;

    const newState = processAction(state, seat, 'call');
    const updatedPlayer = newState.players.find(p => p.seatIndex === seat)!;
    expect(updatedPlayer.chipStack).toBe(stackBefore - callAmount);
    expect(updatedPlayer.currentBet).toBe(state.currentBet);
  });

  it('check works when no bet to call', () => {
    // Create a state where currentBet equals player's bet
    const state = startHand();
    // Simulate: everyone calls, then on flop currentBet is 0
    // For simplicity, manually set up a check-able state
    const checkState: GameState = {
      ...state,
      phase: 'flop',
      currentBet: 0,
      communityCards: [
        { rank: 'A', suit: 'hearts' },
        { rank: 'K', suit: 'hearts' },
        { rank: 'Q', suit: 'hearts' },
      ],
    };
    for (const p of checkState.players) {
      p.currentBet = 0;
      p.hasActedThisRound = false;
    }

    const seat = checkState.actionSeat;
    const newState = processAction(checkState, seat, 'check');
    const player = newState.players.find(p => p.seatIndex === seat)!;
    expect(player.lastAction).toBe('CHECK');
    expect(player.hasActedThisRound).toBe(true);
  });

  it('raise increases current bet', () => {
    const state = startHand();
    const seat = state.actionSeat;
    const raiseTotal = 30;
    const newState = processAction(state, seat, 'raise', raiseTotal);
    expect(newState.currentBet).toBe(raiseTotal);
  });

  it('rejects action from wrong seat (returns original state)', () => {
    const state = startHand();
    const wrongSeat = (state.actionSeat + 1) % 3;
    const newState = processAction(state, wrongSeat, 'fold');
    // Should return the same state reference (no change)
    expect(newState).toBe(state);
  });

  it('allin sets allIn flag and puts all chips in', () => {
    const state = startHand();
    const seat = state.actionSeat;
    const player = state.players.find(p => p.seatIndex === seat)!;
    const totalStack = player.chipStack + player.currentBet;

    const newState = processAction(state, seat, 'allin');
    const updatedPlayer = newState.players.find(p => p.seatIndex === seat)!;
    expect(updatedPlayer.allIn).toBe(true);
    expect(updatedPlayer.chipStack).toBe(0);
    expect(updatedPlayer.currentBet).toBe(totalStack);
  });

  it('game progresses through full hand when all players act', () => {
    let state = startHand(2); // heads-up for simplicity

    // Play through preflop
    let maxActions = 20;
    while (state.phase === 'preflop' && maxActions-- > 0) {
      const seat = state.actionSeat;
      if (seat < 0) break;
      state = processAction(state, seat, 'call');
    }

    // Should have advanced past preflop
    expect(['flop', 'turn', 'river', 'showdown']).toContain(state.phase);
  });
});

// ─── sanitizeForPlayer Tests ─────────────────────────────
describe('sanitizeForPlayer', () => {
  it('shows hero cards but hides opponent cards during play', () => {
    const state = createNewHand(makeGameState(3));
    const heroSeat = 0;
    const sanitized = sanitizeForPlayer(state, heroSeat);

    // Hero should see their own cards
    const heroCards = sanitized.players.find((p: any) => p.seatIndex === heroSeat)!.holeCards;
    expect(heroCards.length).toBe(2);
    expect(heroCards[0].rank).not.toBe('?');

    // Opponents' cards should be hidden (empty array)
    for (const p of sanitized.players) {
      if (p.seatIndex !== heroSeat) {
        expect(p.holeCards.length).toBe(0);
      }
    }

    // mySeatIndex should be set
    expect(sanitized.mySeatIndex).toBe(heroSeat);

    // Deck should not be included
    expect(sanitized.deck).toBeUndefined();
  });

  it('shows all non-folded cards during showdown', () => {
    const state = createNewHand(makeGameState(3));
    state.phase = 'showdown';

    const sanitized = sanitizeForPlayer(state, 0);
    const nonFolded = sanitized.players.filter((p: any) => !p.folded);
    for (const p of nonFolded) {
      expect(p.holeCards.length).toBe(2);
    }
  });
});

// ─── sanitizeForAdmin Tests ──────────────────────────────
describe('sanitizeForAdmin', () => {
  it('shows all player cards to admin', () => {
    const state = createNewHand(makeGameState(3));
    const sanitized = sanitizeForAdmin(state);

    for (const p of sanitized.players) {
      if (!p.folded) {
        expect(p.holeCards.length).toBe(2);
      }
    }
    expect(sanitized.deck).toBeUndefined();
  });
});

// ─── findNextActiveSeat Tests ────────────────────────────
describe('findNextActiveSeat', () => {
  it('skips folded and sitting out players', () => {
    const state = makeGameState(4);
    state.players[1].folded = true;
    state.players[2].sittingOut = true;

    const next = findNextActiveSeat(state, 0);
    expect(next).toBe(3);
  });

  it('wraps around the table', () => {
    const state = makeGameState(3);
    const next = findNextActiveSeat(state, 2);
    expect(next).toBe(0);
  });
});

// ─── getBotAction Tests ──────────────────────────────────
describe('getBotAction', () => {
  it('returns a valid action for beginner bot', () => {
    const state = createNewHand(makeGameState(3));
    // Find a bot's seat
    const botPlayer = state.players.find(p => p.isBot)!;
    // Set action to bot's seat
    state.actionSeat = botPlayer.seatIndex;

    const action = getBotAction(state, botPlayer.seatIndex);
    expect(action).toBeDefined();
    expect(action.action).toBeDefined();
    expect(['fold', 'check', 'call', 'raise', 'allin']).toContain(action.action);
  });
});
