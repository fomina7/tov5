/**
 * Server-side Poker Engine — Production-grade Texas Hold'em
 * Proper betting rounds, side pots, rake, hand evaluation.
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
  seatIndex: number;
  oddsUserId: number | null; // DB user ID (null for bots)
  name: string;
  avatar: string;
  chipStack: number;
  currentBet: number; // amount bet THIS STREET
  totalBetThisHand: number; // total invested this hand (for side pot calc)
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  isBot: boolean;
  botDifficulty?: "beginner" | "medium" | "pro";
  lastAction?: string;
  disconnected: boolean;
  sittingOut: boolean;
  hasActedThisRound: boolean; // track if player has acted in current betting round
}

export interface PotInfo {
  amount: number;
  eligiblePlayerIds: number[]; // seatIndex values
}

export interface RakeConfig {
  percentage: number; // e.g. 0.05 = 5%
  cap: number; // max rake per hand
  minPotForRake: number; // minimum pot to take rake from
}

export interface GameState {
  tableId: number;
  phase: Phase;
  communityCards: Card[];
  deck: Card[];
  players: PlayerState[];
  pots: PotInfo[];
  currentBet: number; // current bet level this street
  minRaise: number; // minimum raise increment
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  actionSeat: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  actionDeadline: number;
  lastRaiserSeat: number;
  rake: RakeConfig;
  rakeCollected: number; // rake taken this hand
  totalPotBeforeRake: number; // for display
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
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ─── Hand Evaluation ─────────────────────────────────────
const RANK_VALUES: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

export interface HandResult {
  rank: number; // 0=high card .. 9=royal flush
  name: string;
  values: number[]; // for tiebreaking, descending
}

export function evaluateBestHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  if (allCards.length < 5) {
    return { rank: -1, name: "Incomplete", values: [] };
  }
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

  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ value: Number(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (isFlush && isStraight) {
    const high = getStraightHigh(values);
    if (high === 14) return { rank: 9, name: "Royal Flush", values: [14] };
    return { rank: 8, name: "Straight Flush", values: [high] };
  }
  if (groups[0].count === 4) {
    return { rank: 7, name: "Four of a Kind", values: [groups[0].value, groups[1].value] };
  }
  if (groups[0].count === 3 && groups[1]?.count === 2) {
    return { rank: 6, name: "Full House", values: [groups[0].value, groups[1].value] };
  }
  if (isFlush) {
    return { rank: 5, name: "Flush", values };
  }
  if (isStraight) {
    return { rank: 4, name: "Straight", values: [getStraightHigh(values)] };
  }
  if (groups[0].count === 3) {
    const kickers = groups.filter(g => g.count === 1).map(g => g.value).sort((a, b) => b - a);
    return { rank: 3, name: "Three of a Kind", values: [groups[0].value, ...kickers] };
  }
  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairs = groups.filter(g => g.count === 2).map(g => g.value).sort((a, b) => b - a);
    const kicker = groups.find(g => g.count === 1)?.value || 0;
    return { rank: 2, name: "Two Pair", values: [...pairs, kicker] };
  }
  if (groups[0].count === 2) {
    const kickers = groups.filter(g => g.count === 1).map(g => g.value).sort((a, b) => b - a);
    return { rank: 1, name: "Pair", values: [groups[0].value, ...kickers] };
  }
  return { rank: 0, name: "High Card", values };
}

function checkStraight(values: number[]): boolean {
  const unique = Array.from(new Set(values)).sort((a, b) => b - a);
  if (unique.length < 5) return false;
  if (unique[0] - unique[4] === 4) return true;
  // Wheel: A-2-3-4-5
  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) return true;
  return false;
}

function getStraightHigh(values: number[]): number {
  const unique = Array.from(new Set(values)).sort((a, b) => b - a);
  if (unique[0] === 14 && unique[1] === 5) return 5; // wheel
  return unique[0];
}

export function compareHands(a: HandResult, b: HandResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.min(a.values.length, b.values.length); i++) {
    if (a.values[i] !== b.values[i]) return a.values[i] - b.values[i];
  }
  return 0;
}

// ─── Game Logic ──────────────────────────────────────────

/**
 * Find the next active (not folded, not sitting out, not disconnected, has chips) seat
 */
export function findNextActiveSeat(state: GameState, currentSeat: number): number {
  const maxSeats = state.players.length;
  if (maxSeats === 0) return currentSeat;
  let seat = currentSeat;
  for (let i = 0; i < maxSeats; i++) {
    seat = (seat + 1) % maxSeats;
    const player = state.players.find(p => p.seatIndex === seat);
    if (player && !player.folded && !player.sittingOut && !player.disconnected && player.chipStack > 0) {
      return seat;
    }
  }
  return currentSeat;
}

/**
 * Find next player who can still act (not folded, not all-in)
 */
function findNextActionSeat(state: GameState, currentSeat: number): number {
  const maxSeats = state.players.length;
  if (maxSeats === 0) return -1;
  let seat = currentSeat;
  for (let i = 0; i < maxSeats; i++) {
    seat = (seat + 1) % maxSeats;
    const player = state.players.find(p => p.seatIndex === seat);
    if (player && !player.folded && !player.allIn && !player.sittingOut && !player.disconnected) {
      return seat;
    }
  }
  return -1;
}

/**
 * Create a new hand — deal cards, post blinds, set action
 */
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
    pots: [],
    handNumber: state.handNumber + 1,
    lastRaiserSeat: -1,
    rakeCollected: 0,
    totalPotBeforeRake: 0,
  };

  // Reset all players for new hand
  for (const p of newState.players) {
    p.holeCards = [];
    p.currentBet = 0;
    p.totalBetThisHand = 0;
    p.folded = p.chipStack <= 0 || p.sittingOut || p.disconnected;
    p.allIn = false;
    p.lastAction = undefined;
    p.hasActedThisRound = false;
  }

  // Advance dealer button
  newState.dealerSeat = findNextActiveSeat(newState, state.dealerSeat);

  // Heads-up: dealer is SB
  if (activePlayers.length === 2) {
    newState.smallBlindSeat = newState.dealerSeat;
    newState.bigBlindSeat = findNextActiveSeat(newState, newState.dealerSeat);
  } else {
    newState.smallBlindSeat = findNextActiveSeat(newState, newState.dealerSeat);
    newState.bigBlindSeat = findNextActiveSeat(newState, newState.smallBlindSeat);
  }

  // Post blinds
  const sbPlayer = newState.players.find(p => p.seatIndex === newState.smallBlindSeat)!;
  const bbPlayer = newState.players.find(p => p.seatIndex === newState.bigBlindSeat)!;

  const sbAmount = Math.min(state.smallBlind, sbPlayer.chipStack);
  sbPlayer.chipStack -= sbAmount;
  sbPlayer.currentBet = sbAmount;
  sbPlayer.totalBetThisHand = sbAmount;
  if (sbPlayer.chipStack === 0) sbPlayer.allIn = true;

  const bbAmount = Math.min(state.bigBlind, bbPlayer.chipStack);
  bbPlayer.chipStack -= bbAmount;
  bbPlayer.currentBet = bbAmount;
  bbPlayer.totalBetThisHand = bbAmount;
  if (bbPlayer.chipStack === 0) bbPlayer.allIn = true;

  // Deal hole cards
  for (const p of newState.players) {
    if (!p.folded) {
      p.holeCards = [newState.deck.pop()!, newState.deck.pop()!];
    }
  }

  // Set action to player after BB (UTG)
  newState.actionSeat = findNextActionSeat(newState, newState.bigBlindSeat);
  newState.actionDeadline = Date.now() + 30000;

  // If only one player can act (everyone else all-in), go straight to showdown
  const canAct = newState.players.filter(p => !p.folded && !p.allIn);
  if (canAct.length <= 1) {
    return collectBetsIntoPots(newState, true);
  }

  return newState;
}

/**
 * Process a player action
 */
export function processAction(
  state: GameState,
  seatIndex: number,
  action: "fold" | "check" | "call" | "raise" | "allin",
  amount?: number
): GameState {
  // Deep clone
  const newState: GameState = JSON.parse(JSON.stringify(state));
  const player = newState.players.find(p => p.seatIndex === seatIndex);
  if (!player) return state;

  // Validate it's this player's turn
  if (newState.actionSeat !== seatIndex) return state;

  switch (action) {
    case "fold":
      player.folded = true;
      player.lastAction = "FOLD";
      player.hasActedThisRound = true;
      break;

    case "check":
      // Can only check if no bet to call
      if (newState.currentBet > player.currentBet && !player.allIn) {
        // Invalid check — treat as fold
        player.folded = true;
        player.lastAction = "FOLD";
      } else {
        player.lastAction = "CHECK";
      }
      player.hasActedThisRound = true;
      break;

    case "call": {
      const toCall = newState.currentBet - player.currentBet;
      const callAmount = Math.min(toCall, player.chipStack);
      player.chipStack -= callAmount;
      player.currentBet += callAmount;
      player.totalBetThisHand += callAmount;
      player.lastAction = "CALL";
      player.hasActedThisRound = true;
      if (player.chipStack === 0) player.allIn = true;
      break;
    }

    case "raise": {
      // amount = total bet the player wants to have this street
      const raiseToTotal = amount || (newState.currentBet + newState.minRaise);
      // Ensure minimum raise
      const minRaiseTo = newState.currentBet + newState.minRaise;
      const actualRaiseTo = Math.max(raiseToTotal, minRaiseTo);
      const additionalChips = actualRaiseTo - player.currentBet;
      const actualPay = Math.min(additionalChips, player.chipStack);
      
      player.chipStack -= actualPay;
      const newBet = player.currentBet + actualPay;
      
      // Update min raise (difference between new bet and old current bet)
      if (newBet > newState.currentBet) {
        newState.minRaise = newBet - newState.currentBet;
        newState.currentBet = newBet;
        newState.lastRaiserSeat = seatIndex;
        // Reset hasActedThisRound for everyone else (they need to act again)
        for (const p of newState.players) {
          if (p.seatIndex !== seatIndex && !p.folded && !p.allIn) {
            p.hasActedThisRound = false;
          }
        }
      }
      
      player.currentBet = newBet;
      player.totalBetThisHand += actualPay;
      player.lastAction = "RAISE";
      player.hasActedThisRound = true;
      if (player.chipStack === 0) player.allIn = true;
      break;
    }

    case "allin": {
      const allInAmount = player.chipStack;
      player.currentBet += allInAmount;
      player.totalBetThisHand += allInAmount;
      player.chipStack = 0;
      player.allIn = true;
      player.hasActedThisRound = true;
      
      if (player.currentBet > newState.currentBet) {
        // This is a raise
        const raiseBy = player.currentBet - newState.currentBet;
        if (raiseBy >= newState.minRaise) {
          newState.minRaise = raiseBy;
        }
        newState.currentBet = player.currentBet;
        newState.lastRaiserSeat = seatIndex;
        // Reset hasActedThisRound for everyone else
        for (const p of newState.players) {
          if (p.seatIndex !== seatIndex && !p.folded && !p.allIn) {
            p.hasActedThisRound = false;
          }
        }
      }
      player.lastAction = "ALL-IN";
      break;
    }
  }

  // Check if hand is over (only one player left)
  const activePlayers = newState.players.filter(p => !p.folded);
  if (activePlayers.length === 1) {
    return collectBetsIntoPots(newState, false);
  }

  // Check if everyone is all-in (or only one can act)
  const canAct = activePlayers.filter(p => !p.allIn);
  if (canAct.length <= 1) {
    // Check if the one remaining player has matched the bet or is the only non-allin
    const allBetsMatched = canAct.every(p => p.currentBet >= newState.currentBet || p.allIn);
    if (allBetsMatched && player.hasActedThisRound) {
      return collectBetsIntoPots(newState, true);
    }
  }

  // Check if betting round is complete
  if (isBettingRoundComplete(newState)) {
    return advancePhase(newState);
  }

  // Move to next player
  newState.actionSeat = findNextActionSeat(newState, seatIndex);
  newState.actionDeadline = Date.now() + 30000;

  return newState;
}

/**
 * Check if the current betting round is complete
 */
function isBettingRoundComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(p => !p.folded);
  const canAct = activePlayers.filter(p => !p.allIn);

  // If no one can act, round is over
  if (canAct.length === 0) return true;

  // All players who can act must have acted AND matched the current bet
  for (const p of canAct) {
    if (!p.hasActedThisRound) return false;
    if (p.currentBet < state.currentBet) return false;
  }

  return true;
}

/**
 * Collect bets into pots (handles side pots for all-in scenarios)
 */
function collectBetsIntoPots(state: GameState, dealRemaining: boolean): GameState {
  const newState = { ...state };
  
  // Gather all bets from this street
  const activePlayers = newState.players.filter(p => !p.folded || p.currentBet > 0);
  
  // Build side pots
  // Get unique bet levels from all-in players
  const allInBets = newState.players
    .filter(p => p.allIn && p.totalBetThisHand > 0)
    .map(p => p.totalBetThisHand)
    .sort((a, b) => a - b);
  
  const uniqueLevels = Array.from(new Set(allInBets));
  
  // Add current street bets to existing pots
  let totalCollected = 0;
  const betsRemaining = new Map<number, number>(); // seatIndex -> remaining bet
  for (const p of newState.players) {
    betsRemaining.set(p.seatIndex, p.currentBet);
    totalCollected += p.currentBet;
  }

  // If we have existing pots, add to them; otherwise create new
  if (newState.pots.length === 0 || totalCollected > 0) {
    // Simple pot collection: just add all bets to main pot
    // For proper side pots, we recalculate from totalBetThisHand
    const mainPotAmount = totalCollected;
    if (newState.pots.length === 0) {
      newState.pots.push({
        amount: mainPotAmount,
        eligiblePlayerIds: newState.players.filter(p => !p.folded).map(p => p.seatIndex),
      });
    } else {
      newState.pots[0].amount += mainPotAmount;
      newState.pots[0].eligiblePlayerIds = newState.players.filter(p => !p.folded).map(p => p.seatIndex);
    }
  }

  // Reset street bets
  for (const p of newState.players) {
    p.currentBet = 0;
  }
  newState.currentBet = 0;

  // Now rebuild pots properly using totalBetThisHand for side pots
  if (uniqueLevels.length > 0 && dealRemaining) {
    newState.pots = buildSidePots(newState);
  }

  if (dealRemaining) {
    // Deal remaining community cards and go to showdown
    return dealRemainingAndResolve(newState);
  } else {
    // Single winner (everyone else folded)
    return resolveWinner(newState);
  }
}

/**
 * Build side pots from totalBetThisHand
 */
function buildSidePots(state: GameState): PotInfo[] {
  const players = state.players.filter(p => p.totalBetThisHand > 0);
  if (players.length === 0) return state.pots;

  // Sort by total investment
  const sorted = [...players].sort((a, b) => a.totalBetThisHand - b.totalBetThisHand);
  const pots: PotInfo[] = [];
  let prevLevel = 0;

  for (let i = 0; i < sorted.length; i++) {
    const level = sorted[i].totalBetThisHand;
    if (level <= prevLevel) continue;

    const increment = level - prevLevel;
    let potAmount = 0;
    const eligible: number[] = [];

    for (const p of players) {
      if (p.totalBetThisHand >= level) {
        potAmount += increment;
        if (!p.folded) {
          eligible.push(p.seatIndex);
        }
      } else if (p.totalBetThisHand > prevLevel) {
        potAmount += p.totalBetThisHand - prevLevel;
      }
    }

    if (potAmount > 0 && eligible.length > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    }
    prevLevel = level;
  }

  // If pots are empty, fall back to simple pot
  if (pots.length === 0) {
    const total = players.reduce((s, p) => s + p.totalBetThisHand, 0);
    return [{
      amount: total,
      eligiblePlayerIds: state.players.filter(p => !p.folded).map(p => p.seatIndex),
    }];
  }

  return pots;
}

/**
 * Advance to next phase (flop, turn, river)
 */
function advancePhase(state: GameState): GameState {
  const newState = { ...state };

  // Collect bets into pot
  let streetBets = 0;
  for (const p of newState.players) {
    streetBets += p.currentBet;
    p.currentBet = 0;
    if (!p.folded) {
      p.lastAction = undefined;
      p.hasActedThisRound = false;
    }
  }

  // Add street bets to pot
  if (newState.pots.length === 0) {
    newState.pots.push({
      amount: streetBets,
      eligiblePlayerIds: newState.players.filter(p => !p.folded).map(p => p.seatIndex),
    });
  } else {
    newState.pots[0].amount += streetBets;
    newState.pots[0].eligiblePlayerIds = newState.players.filter(p => !p.folded).map(p => p.seatIndex);
  }

  newState.currentBet = 0;
  newState.minRaise = newState.bigBlind;
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
      // Collect final bets and resolve
      return resolveWinner(newState);
  }

  // First to act: first active player after dealer
  const nextAction = findNextActionSeat(newState, newState.dealerSeat);
  if (nextAction === -1) {
    // No one can act — deal remaining and resolve
    return dealRemainingAndResolve(newState);
  }
  newState.actionSeat = nextAction;
  newState.actionDeadline = Date.now() + 30000;

  return newState;
}

/**
 * Deal remaining community cards and go to showdown
 */
function dealRemainingAndResolve(state: GameState): GameState {
  const newState = { ...state };
  while (newState.communityCards.length < 5) {
    if (newState.communityCards.length === 0 || newState.communityCards.length === 3 || newState.communityCards.length === 4) {
      newState.deck.pop(); // burn
    }
    newState.communityCards.push(newState.deck.pop()!);
  }
  return resolveWinner(newState);
}

/**
 * Resolve winner(s) and distribute pot(s)
 */
function resolveWinner(state: GameState): GameState {
  const newState = { ...state };
  newState.phase = "showdown";

  // Collect any remaining street bets
  let remainingBets = 0;
  for (const p of newState.players) {
    remainingBets += p.currentBet;
    p.currentBet = 0;
  }
  if (remainingBets > 0) {
    if (newState.pots.length === 0) {
      newState.pots.push({
        amount: remainingBets,
        eligiblePlayerIds: newState.players.filter(p => !p.folded).map(p => p.seatIndex),
      });
    } else {
      newState.pots[0].amount += remainingBets;
    }
  }

  const activePlayers = newState.players.filter(p => !p.folded);

  // Single winner (everyone else folded)
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    const totalPot = newState.pots.reduce((s, p) => s + p.amount, 0);
    
    // Apply rake
    const { netPot, rake } = applyRake(totalPot, newState.rake);
    newState.rakeCollected = rake;
    newState.totalPotBeforeRake = totalPot;
    
    winner.chipStack += netPot;
    winner.lastAction = "WIN";
    newState.pots = [{ amount: 0, eligiblePlayerIds: [] }];
    return newState;
  }

  // Rebuild side pots for proper distribution
  const sidePots = buildSidePots(newState);
  if (sidePots.length > 0) {
    newState.pots = sidePots;
  }

  // Evaluate hands for all active players
  const handResults = new Map<number, HandResult>();
  for (const p of activePlayers) {
    handResults.set(p.seatIndex, evaluateBestHand(p.holeCards, newState.communityCards));
  }

  let totalRake = 0;
  const totalPotBeforeRake = newState.pots.reduce((s, p) => s + p.amount, 0);

  // Distribute each pot
  for (const pot of newState.pots) {
    if (pot.amount === 0) continue;

    // Find eligible players who haven't folded
    const eligible = pot.eligiblePlayerIds
      .map(sid => newState.players.find(p => p.seatIndex === sid))
      .filter((p): p is PlayerState => !!p && !p.folded);

    if (eligible.length === 0) continue;

    // Find best hand among eligible
    let bestHand: HandResult = { rank: -1, name: "", values: [] };
    for (const p of eligible) {
      const hand = handResults.get(p.seatIndex)!;
      if (compareHands(hand, bestHand) > 0) {
        bestHand = hand;
      }
    }

    // Find all winners (split pot)
    const winners = eligible.filter(p => compareHands(handResults.get(p.seatIndex)!, bestHand) === 0);

    // Apply rake to this pot
    const { netPot, rake } = applyRake(pot.amount, newState.rake);
    totalRake += rake;

    // Split among winners
    const share = Math.floor(netPot / winners.length);
    const remainder = netPot - share * winners.length;

    for (let i = 0; i < winners.length; i++) {
      const w = winners[i];
      w.chipStack += share + (i === 0 ? remainder : 0);
      const hand = handResults.get(w.seatIndex)!;
      w.lastAction = winners.length > 1
        ? `SPLIT - ${hand.name}`
        : `WIN - ${hand.name}`;
    }
  }

  newState.rakeCollected = totalRake;
  newState.totalPotBeforeRake = totalPotBeforeRake;
  newState.pots = [{ amount: 0, eligiblePlayerIds: [] }];
  return newState;
}

/**
 * Apply rake to a pot
 */
function applyRake(potAmount: number, rakeConfig: RakeConfig): { netPot: number; rake: number } {
  if (potAmount < rakeConfig.minPotForRake) {
    return { netPot: potAmount, rake: 0 };
  }
  const rake = Math.min(Math.floor(potAmount * rakeConfig.percentage), rakeConfig.cap);
  return { netPot: potAmount - rake, rake };
}

// ─── Bot AI ──────────────────────────────────────────────

export function getBotAction(
  state: GameState,
  botPlayer: PlayerState
): { action: "fold" | "check" | "call" | "raise" | "allin"; amount?: number } {
  const callAmount = state.currentBet - botPlayer.currentBet;
  const potSize = state.pots.reduce((s, p) => s + p.amount, 0) + 
    state.players.reduce((s, p) => s + p.currentBet, 0);
  const difficulty = botPlayer.botDifficulty || "medium";
  const rand = Math.random();

  // Evaluate hand strength
  let handStrength = 0;
  if (state.phase === "preflop") {
    handStrength = evaluatePreflop(botPlayer.holeCards);
  } else if (botPlayer.holeCards.length === 2 && state.communityCards.length >= 3) {
    handStrength = evaluateBestHand(botPlayer.holeCards, state.communityCards).rank;
  }

  if (difficulty === "beginner") {
    return beginnerBotAction(callAmount, botPlayer, state, rand, handStrength);
  }
  if (difficulty === "pro") {
    return proBotAction(callAmount, botPlayer, state, rand, handStrength, potSize);
  }
  return mediumBotAction(callAmount, botPlayer, state, rand, handStrength, potSize);
}

function beginnerBotAction(
  callAmount: number, player: PlayerState, state: GameState, rand: number, handStrength: number
): { action: "fold" | "check" | "call" | "raise" | "allin"; amount?: number } {
  if (callAmount <= 0) {
    // No bet to call
    if (rand < 0.7) return { action: "check" };
    return { action: "raise", amount: state.currentBet + state.bigBlind };
  }
  if (callAmount > player.chipStack * 0.5) return { action: "fold" };
  if (rand < 0.6) return { action: "call" };
  return { action: "fold" };
}

function mediumBotAction(
  callAmount: number, player: PlayerState, state: GameState, rand: number, handStrength: number, potSize: number
): { action: "fold" | "check" | "call" | "raise" | "allin"; amount?: number } {
  if (callAmount <= 0) {
    if (handStrength >= 4) return { action: "raise", amount: state.bigBlind * 3 };
    if (rand < 0.6) return { action: "check" };
    return { action: "raise", amount: state.bigBlind * 2 };
  }
  
  // Pot odds consideration
  const potOdds = callAmount / (potSize + callAmount);
  if (handStrength >= 5) {
    return rand < 0.3 
      ? { action: "raise", amount: state.currentBet + state.bigBlind * 3 }
      : { action: "call" };
  }
  if (handStrength >= 3) return { action: "call" };
  if (potOdds < 0.2 && callAmount <= state.bigBlind * 3) {
    return rand < 0.5 ? { action: "call" } : { action: "fold" };
  }
  return rand < 0.3 ? { action: "call" } : { action: "fold" };
}

function proBotAction(
  callAmount: number, player: PlayerState, state: GameState, rand: number, handStrength: number, potSize: number
): { action: "fold" | "check" | "call" | "raise" | "allin"; amount?: number } {
  if (callAmount <= 0) {
    if (handStrength >= 6) {
      return { action: "raise", amount: Math.max(state.bigBlind * 3, Math.floor(potSize * 0.75)) };
    }
    if (handStrength >= 3) {
      return rand < 0.5
        ? { action: "raise", amount: state.bigBlind * 2 + state.currentBet }
        : { action: "check" };
    }
    // Bluff sometimes
    if (rand < 0.15) return { action: "raise", amount: state.bigBlind * 2 + state.currentBet };
    return { action: "check" };
  }

  // Facing a bet
  if (handStrength >= 7) {
    return rand < 0.4 ? { action: "allin" } : { action: "raise", amount: state.currentBet * 2 + state.bigBlind };
  }
  if (handStrength >= 5) {
    return { action: "raise", amount: state.currentBet + Math.floor(potSize * 0.6) };
  }
  if (handStrength >= 3) return { action: "call" };
  
  // Pot odds for marginal hands
  const potOdds = callAmount / (potSize + callAmount);
  if (potOdds < 0.15 && callAmount <= state.bigBlind * 4) {
    return rand < 0.5 ? { action: "call" } : { action: "fold" };
  }
  return { action: "fold" };
}

function evaluatePreflop(cards: Card[]): number {
  if (!cards || cards.length < 2) return 0;
  const v1 = RANK_VALUES[cards[0].rank];
  const v2 = RANK_VALUES[cards[1].rank];
  const suited = cards[0].suit === cards[1].suit;
  const pair = v1 === v2;

  if (pair && v1 >= 10) return 8; // AA, KK, QQ, JJ, TT
  if (pair && v1 >= 7) return 5; // 77-99
  if (pair) return 4; // 22-66
  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  if (high === 14 && low >= 10) return 7; // AK, AQ, AJ, AT
  if (high === 14 && suited) return 5; // Axs
  if (high >= 12 && low >= 10 && suited) return 6; // KQs, KJs, QJs
  if (high >= 12 && low >= 10) return 4; // KQ, KJ, QJ
  if (high >= 10 && low >= 8 && suited) return 4; // suited connectors
  if (high >= 10 && low >= 8) return 3;
  if (suited && high - low <= 2) return 3; // suited connectors
  if (suited) return 2;
  return 1;
}

// ─── Sanitize for Client ─────────────────────────────────

export function sanitizeForPlayer(state: GameState, seatIndex: number): any {
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0) +
    state.players.reduce((s, p) => s + p.currentBet, 0);

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
    totalPot,
    rakeCollected: state.rakeCollected,
    mySeatIndex: seatIndex,
    serverTime: Date.now(),
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
      holeCards: p.seatIndex === seatIndex
        ? p.holeCards
        : (state.phase === "showdown" && !p.folded ? p.holeCards : []),
      userId: p.oddsUserId,
    })),
  };
}

export function sanitizeForAdmin(state: GameState): any {
  return {
    ...state,
    deck: undefined,
    players: state.players.map(p => ({
      ...p,
      holeCards: p.holeCards, // Admin sees all cards
    })),
  };
}
