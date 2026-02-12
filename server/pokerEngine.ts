/**
 * Server-side Poker Engine — REAL game logic
 * All game state lives on the server. Clients receive only what they're allowed to see.
 */

// ─── Types ───────────────────────────────────────────────
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type Phase = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";

export interface PlayerState {
  oddsId: number; // index in seats array
  oddsUserId: number | null; // DB user ID (null for bots)
  seatIndex: number;
  name: string;
  avatar: string;
  chipStack: number;
  currentBet: number;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  isBot: boolean;
  botDifficulty?: "beginner" | "medium" | "pro";
  lastAction?: string;
  disconnected: boolean;
  sittingOut: boolean;
}

export interface PotInfo {
  amount: number;
  eligiblePlayerIds: number[]; // seatIndex values
}

export interface GameState {
  tableId: number;
  phase: Phase;
  communityCards: Card[];
  deck: Card[];
  players: PlayerState[];
  pots: PotInfo[];
  currentBet: number;
  minRaise: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  actionSeat: number; // whose turn
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  actionDeadline: number; // timestamp ms
  lastRaiserSeat: number;
  roundActionCount: number;
}

// ─── Deck ────────────────────────────────────────────────
const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Hand Evaluation ─────────────────────────────────────
const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

export interface HandResult {
  rank: number; // 0=high card, 1=pair, 2=two pair, 3=trips, 4=straight, 5=flush, 6=full house, 7=quads, 8=straight flush, 9=royal flush
  name: string;
  values: number[]; // for tiebreaking
}

const HAND_NAMES = [
  "High Card", "Pair", "Two Pair", "Three of a Kind", "Straight",
  "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush"
];

export function evaluateBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);
  let best: HandResult = { rank: -1, name: "", values: [] };

  for (const combo of combos) {
    const result = evaluateHand(combo);
    if (compareHands(result, best) > 0) {
      best = result;
    }
  }
  return best;
}

function getCombinations(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: Card[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = getCombinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

function evaluateHand(cards: Card[]): HandResult {
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);

  // Count ranks
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ value: Number(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (isFlush && isStraight) {
    const straightHigh = getStraightHigh(values);
    if (straightHigh === 14) return { rank: 9, name: "Royal Flush", values: [14] };
    return { rank: 8, name: "Straight Flush", values: [straightHigh] };
  }
  if (groups[0].count === 4) {
    return { rank: 7, name: "Four of a Kind", values: [groups[0].value, groups[1].value] };
  }
  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: 6, name: "Full House", values: [groups[0].value, groups[1].value] };
  }
  if (isFlush) {
    return { rank: 5, name: "Flush", values };
  }
  if (isStraight) {
    return { rank: 4, name: "Straight", values: [getStraightHigh(values)] };
  }
  if (groups[0].count === 3) {
    const kickers = groups.filter(g => g.count === 1).map(g => g.value);
    return { rank: 3, name: "Three of a Kind", values: [groups[0].value, ...kickers] };
  }
  if (groups[0].count === 2 && groups[1].count === 2) {
    const kicker = groups.find(g => g.count === 1)?.value || 0;
    return { rank: 2, name: "Two Pair", values: [groups[0].value, groups[1].value, kicker] };
  }
  if (groups[0].count === 2) {
    const kickers = groups.filter(g => g.count === 1).map(g => g.value);
    return { rank: 1, name: "Pair", values: [groups[0].value, ...kickers] };
  }
  return { rank: 0, name: "High Card", values };
}

function checkStraight(values: number[]): boolean {
  const sorted = Array.from(new Set(values)).sort((a, b) => b - a);
  if (sorted.length < 5) return false;
  // Normal straight
  if (sorted[0] - sorted[4] === 4 && sorted.length === 5) return true;
  // Wheel (A-2-3-4-5)
  if (sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2) return true;
  return false;
}

function getStraightHigh(values: number[]): number {
  const sorted = Array.from(new Set(values)).sort((a, b) => b - a);
  if (sorted[0] === 14 && sorted[1] === 5) return 5; // wheel
  return sorted[0];
}

export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
    if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
  }
  return 0;
}

// ─── Game Logic ──────────────────────────────────────────

export function createNewHand(state: GameState): GameState {
  const activePlayers = state.players.filter(p => p.chipStack > 0 && !p.sittingOut && !p.disconnected);
  if (activePlayers.length < 2) return { ...state, phase: "waiting" };

  const deck = createDeck();
  const newState: GameState = {
    ...state,
    phase: "preflop",
    deck,
    communityCards: [],
    currentBet: state.bigBlind,
    minRaise: state.bigBlind,
    pots: [{ amount: 0, eligiblePlayerIds: [] }],
    handNumber: state.handNumber + 1,
    lastRaiserSeat: -1,
    roundActionCount: 0,
  };

  // Reset players
  for (const p of newState.players) {
    p.holeCards = [];
    p.currentBet = 0;
    p.folded = p.chipStack <= 0 || p.sittingOut || p.disconnected;
    p.allIn = false;
    p.lastAction = undefined;
  }

  // Advance dealer
  newState.dealerSeat = findNextActiveSeat(newState, state.dealerSeat);
  newState.smallBlindSeat = findNextActiveSeat(newState, newState.dealerSeat);
  newState.bigBlindSeat = findNextActiveSeat(newState, newState.smallBlindSeat);

  // Post blinds
  const sbPlayer = newState.players.find(p => p.seatIndex === newState.smallBlindSeat)!;
  const bbPlayer = newState.players.find(p => p.seatIndex === newState.bigBlindSeat)!;

  const sbAmount = Math.min(state.smallBlind, sbPlayer.chipStack);
  sbPlayer.chipStack -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  if (sbPlayer.chipStack === 0) sbPlayer.allIn = true;

  const bbAmount = Math.min(state.bigBlind, bbPlayer.chipStack);
  bbPlayer.chipStack -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  if (bbPlayer.chipStack === 0) bbPlayer.allIn = true;

  newState.pots[0].amount = sbAmount + bbAmount;
  newState.pots[0].eligiblePlayerIds = activePlayers.map(p => p.seatIndex);

  // Deal hole cards
  for (const p of newState.players) {
    if (!p.folded) {
      p.holeCards = [newState.deck.pop()!, newState.deck.pop()!];
    }
  }

  // Set action to player after BB
  newState.actionSeat = findNextActiveSeat(newState, newState.bigBlindSeat);
  newState.actionDeadline = Date.now() + 30000;

  return newState;
}

export function findNextActiveSeat(state: GameState, currentSeat: number): number {
  const maxSeats = state.players.length;
  let seat = currentSeat;
  for (let i = 0; i < maxSeats; i++) {
    seat = (seat + 1) % maxSeats;
    const player = state.players.find(p => p.seatIndex === seat);
    if (player && !player.folded && !player.sittingOut && !player.disconnected && player.chipStack >= 0) {
      return seat;
    }
  }
  return currentSeat;
}

function findNextActionSeat(state: GameState, currentSeat: number): number {
  const maxSeats = state.players.length;
  let seat = currentSeat;
  for (let i = 0; i < maxSeats; i++) {
    seat = (seat + 1) % maxSeats;
    const player = state.players.find(p => p.seatIndex === seat);
    if (player && !player.folded && !player.allIn && !player.sittingOut && !player.disconnected) {
      return seat;
    }
  }
  return -1; // no one can act
}

export function processAction(
  state: GameState,
  seatIndex: number,
  action: "fold" | "check" | "call" | "raise" | "allin",
  amount?: number
): GameState {
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
  const player = newState.players.find(p => p.seatIndex === seatIndex);
  if (!player) return state;

  switch (action) {
    case "fold":
      player.folded = true;
      player.lastAction = "FOLD";
      break;

    case "check":
      player.lastAction = "CHECK";
      break;

    case "call": {
      const callAmount = Math.min(newState.currentBet - player.currentBet, player.chipStack);
      player.chipStack -= callAmount;
      player.currentBet += callAmount;
      newState.pots[0].amount += callAmount;
      player.lastAction = "CALL";
      if (player.chipStack === 0) player.allIn = true;
      break;
    }

    case "raise": {
      const raiseTotal = amount || (newState.currentBet * 2);
      const raiseAmount = raiseTotal - player.currentBet;
      const actualRaise = Math.min(raiseAmount, player.chipStack);
      player.chipStack -= actualRaise;
      player.currentBet += actualRaise;
      newState.pots[0].amount += actualRaise;
      newState.currentBet = player.currentBet;
      newState.minRaise = player.currentBet - state.currentBet;
      newState.lastRaiserSeat = seatIndex;
      newState.roundActionCount = 0;
      player.lastAction = "RAISE";
      if (player.chipStack === 0) player.allIn = true;
      break;
    }

    case "allin": {
      const allInAmount = player.chipStack;
      player.currentBet += allInAmount;
      newState.pots[0].amount += allInAmount;
      player.chipStack = 0;
      player.allIn = true;
      if (player.currentBet > newState.currentBet) {
        newState.currentBet = player.currentBet;
        newState.lastRaiserSeat = seatIndex;
        newState.roundActionCount = 0;
      }
      player.lastAction = "ALL-IN";
      break;
    }
  }

  newState.roundActionCount++;

  // Check if round is over
  const activePlayers = newState.players.filter(p => !p.folded);
  const canActPlayers = activePlayers.filter(p => !p.allIn);

  // Only one player left — they win
  if (activePlayers.length === 1) {
    return resolveWinner(newState);
  }

  // Everyone all-in or only one can act
  if (canActPlayers.length <= 1) {
    // Deal remaining community cards and resolve
    return dealRemainingAndResolve(newState);
  }

  // Check if betting round is complete
  const allActed = canActPlayers.every(p =>
    p.currentBet === newState.currentBet || p.allIn
  );
  const enoughActions = newState.roundActionCount >= canActPlayers.length;

  if (allActed && enoughActions && action !== "raise") {
    return advancePhase(newState);
  }

  // Move to next player
  newState.actionSeat = findNextActionSeat(newState, seatIndex);
  newState.actionDeadline = Date.now() + 30000;

  return newState;
}

function advancePhase(state: GameState): GameState {
  const newState = { ...state };

  // Reset bets for new round
  for (const p of newState.players) {
    p.currentBet = 0;
    if (!p.folded) p.lastAction = undefined;
  }
  newState.currentBet = 0;
  newState.roundActionCount = 0;
  newState.lastRaiserSeat = -1;

  switch (newState.phase) {
    case "preflop":
      newState.phase = "flop";
      newState.deck.pop(); // burn
      newState.communityCards.push(newState.deck.pop()!, newState.deck.pop()!, newState.deck.pop()!);
      break;
    case "flop":
      newState.phase = "turn";
      newState.deck.pop(); // burn
      newState.communityCards.push(newState.deck.pop()!);
      break;
    case "turn":
      newState.phase = "river";
      newState.deck.pop(); // burn
      newState.communityCards.push(newState.deck.pop()!);
      break;
    case "river":
      newState.phase = "showdown";
      return resolveWinner(newState);
  }

  // First to act after flop is first active player after dealer
  newState.actionSeat = findNextActionSeat(newState, newState.dealerSeat);
  newState.actionDeadline = Date.now() + 30000;

  return newState;
}

function dealRemainingAndResolve(state: GameState): GameState {
  const newState = { ...state };
  // Deal remaining community cards
  while (newState.communityCards.length < 5) {
    if (newState.communityCards.length === 0 || newState.communityCards.length === 3 || newState.communityCards.length === 4) {
      newState.deck.pop(); // burn
    }
    newState.communityCards.push(newState.deck.pop()!);
  }
  newState.phase = "showdown";
  return resolveWinner(newState);
}

function resolveWinner(state: GameState): GameState {
  const newState = { ...state };
  newState.phase = "showdown";

  const activePlayers = newState.players.filter(p => !p.folded);

  if (activePlayers.length === 1) {
    // Last man standing
    const winner = activePlayers[0];
    winner.chipStack += newState.pots.reduce((sum, p) => sum + p.amount, 0);
    winner.lastAction = "WIN";
    newState.pots = [{ amount: 0, eligiblePlayerIds: [] }];
    return newState;
  }

  // Evaluate hands
  const results = activePlayers.map(p => ({
    player: p,
    hand: evaluateBestHand(p.holeCards, newState.communityCards),
  }));

  // Sort by hand strength
  results.sort((a, b) => compareHands(b.hand, a.hand));

  // Simple pot distribution (main pot only for now)
  const totalPot = newState.pots.reduce((sum, p) => sum + p.amount, 0);

  // Find winners (could be split)
  const bestHand = results[0].hand;
  const winners = results.filter(r => compareHands(r.hand, bestHand) === 0);

  const share = Math.floor(totalPot / winners.length);
  for (const w of winners) {
    w.player.chipStack += share;
    w.player.lastAction = `WIN - ${w.hand.name}`;
  }

  newState.pots = [{ amount: 0, eligiblePlayerIds: [] }];
  return newState;
}

// ─── Bot AI ──────────────────────────────────────────────
export function getBotAction(
  state: GameState,
  botPlayer: PlayerState
): { action: "fold" | "check" | "call" | "raise" | "allin"; amount?: number } {
  const callAmount = state.currentBet - botPlayer.currentBet;
  const potSize = state.pots.reduce((s, p) => s + p.amount, 0);
  const difficulty = botPlayer.botDifficulty || "medium";

  // Simple AI based on difficulty
  const rand = Math.random();

  if (difficulty === "beginner") {
    if (callAmount === 0) return rand < 0.7 ? { action: "check" } : { action: "raise", amount: state.currentBet + state.bigBlind };
    if (callAmount > botPlayer.chipStack * 0.5) return { action: "fold" };
    return rand < 0.6 ? { action: "call" } : { action: "fold" };
  }

  if (difficulty === "pro") {
    // Evaluate hand strength
    const handStrength = botPlayer.holeCards.length === 2
      ? evaluatePreflop(botPlayer.holeCards)
      : evaluateBestHand(botPlayer.holeCards, state.communityCards).rank;

    if (callAmount === 0) {
      if (handStrength >= 5) return { action: "raise", amount: Math.min(potSize, botPlayer.chipStack + botPlayer.currentBet) };
      if (handStrength >= 2) return rand < 0.4 ? { action: "raise", amount: state.currentBet + state.bigBlind * 2 } : { action: "check" };
      return rand < 0.15 ? { action: "raise", amount: state.currentBet + state.bigBlind } : { action: "check" }; // bluff
    }

    if (handStrength >= 6) return rand < 0.3 ? { action: "allin" } : { action: "raise", amount: state.currentBet * 2 };
    if (handStrength >= 3) return { action: "call" };
    if (callAmount < state.bigBlind * 3) return rand < 0.4 ? { action: "call" } : { action: "fold" };
    return { action: "fold" };
  }

  // Medium difficulty
  if (callAmount === 0) {
    return rand < 0.6 ? { action: "check" } : { action: "raise", amount: state.currentBet + state.bigBlind };
  }
  if (callAmount > botPlayer.chipStack * 0.3) return rand < 0.3 ? { action: "call" } : { action: "fold" };
  return rand < 0.65 ? { action: "call" } : rand < 0.85 ? { action: "raise", amount: state.currentBet + state.bigBlind * 2 } : { action: "fold" };
}

function evaluatePreflop(cards: Card[]): number {
  const v1 = RANK_VALUES[cards[0].rank];
  const v2 = RANK_VALUES[cards[1].rank];
  const suited = cards[0].suit === cards[1].suit;
  const pair = v1 === v2;

  if (pair && v1 >= 10) return 8; // AA, KK, QQ, JJ, TT
  if (pair) return 5;
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  if (high === 14 && low >= 10) return 7; // AK, AQ, AJ, AT
  if (high === 14 && suited) return 5;
  if (high >= 12 && low >= 10 && suited) return 6;
  if (high >= 10 && low >= 8 && suited) return 4;
  if (high >= 10 && low >= 8) return 3;
  if (suited && high - low <= 2) return 3;
  return 1;
}

// ─── Sanitize for Client ─────────────────────────────────
export function sanitizeForPlayer(state: GameState, seatIndex: number): any {
  return {
    tableId: state.tableId,
    phase: state.phase,
    communityCards: state.communityCards,
    currentBet: state.currentBet,
    minRaise: state.minRaise,
    dealerSeat: state.dealerSeat,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    actionSeat: state.actionSeat,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    handNumber: state.handNumber,
    actionDeadline: state.actionDeadline,
    pots: state.pots,
    players: state.players.map(p => ({
      seatIndex: p.seatIndex,
      name: p.name,
      avatar: p.avatar,
      chipStack: p.chipStack,
      currentBet: p.currentBet,
      folded: p.folded,
      allIn: p.allIn,
      isBot: p.isBot,
      lastAction: p.lastAction,
      disconnected: p.disconnected,
      sittingOut: p.sittingOut,
      // Only show hole cards for this player, or during showdown for non-folded
      holeCards: p.seatIndex === seatIndex
        ? p.holeCards
        : (state.phase === "showdown" && !p.folded ? p.holeCards : []),
      userId: p.oddsUserId,
    })),
  };
}

// Admin can see everything
export function sanitizeForAdmin(state: GameState): any {
  return {
    ...state,
    deck: undefined, // still hide deck from admin view for security
  };
}
