import type { Card, Suit } from './gameLogic';

export const POKER_RANK_ORDER: Record<string, number> = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  '10': 8,
  'J': 9,
  'Q': 10,
  'K': 11,
  'A': 12,
};

export const POKER_SUIT_NAMES: Record<Suit, string> = {
  D: 'Diamonds',
  C: 'Clubs',
  H: 'Hearts',
  S: 'Spades',
};

export type PokerComboType =
  | 'highcard'
  | 'pair'
  | 'twopair'
  | 'trips'
  | 'straight'
  | 'flush'
  | 'fullhouse'
  | 'quads'
  | 'straightflush'
  | 'royalflush';

export const POKER_COMBO_VALUES: Record<PokerComboType, number> = {
  highcard: 0,
  pair: 1,
  twopair: 2,
  trips: 3,
  straight: 4,
  flush: 5,
  fullhouse: 6,
  quads: 7,
  straightflush: 8,
  royalflush: 9,
};

export interface PokerHandResult {
  type: PokerComboType;
  score: [number, number, number, number, number, number]; // [category_val, tie1, tie2, tie3, tie4, tie5]
  handName: string;
  bestFive: Card[];
}

// Helper to get combination combinations of k items from array of n items
export function getCombinations<T>(array: T[], k: number): T[][] {
  const result: T[][] = [];
  function helper(start: number, combo: T[]) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

// Evaluate a exact 5 card hand
export function evaluateFiveCardHand(cards: Card[]): PokerHandResult {
  if (cards.length !== 5) {
    throw new Error('Must evaluate exactly 5 cards');
  }

  // Sort cards descending by poker rank order
  const sorted = [...cards].sort((a, b) => POKER_RANK_ORDER[b.rank] - POKER_RANK_ORDER[a.rank]);
  const ranks = sorted.map(c => POKER_RANK_ORDER[c.rank]);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHighVal = -1;

  // Regular straight check (5 consecutive values)
  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHighVal = ranks[0];
  } else if (
    ranks[0] === 12 && // Ace
    ranks[1] === 3 &&  // 5
    ranks[2] === 2 &&  // 4
    ranks[3] === 1 &&  // 3
    ranks[4] === 0     // 2
  ) {
    // Ace-low straight (A-2-3-4-5), high card is 5 (value 3)
    isStraight = true;
    straightHighVal = 3;
  }

  // Count occurrences of each rank
  const counts: Record<number, number> = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const countPairs = Object.entries(counts).map(([rank, count]) => ({
    rank: parseInt(rank, 10),
    count,
  }));

  // Sort counts by count descending, then by rank value descending
  countPairs.sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Determine hand type based on group sizes
  if (isFlush && isStraight) {
    if (straightHighVal === 12) {
      return {
        type: 'royalflush',
        score: [9, 12, 0, 0, 0, 0],
        handName: 'Royal Flush',
        bestFive: sorted,
      };
    }
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'straightflush',
      score: [8, straightHighVal, 0, 0, 0, 0],
      handName: `Straight Flush, ${rankNames[straightHighVal]}-high`,
      bestFive: sorted,
    };
  }

  if (countPairs[0].count === 4) {
    const quadRank = countPairs[0].rank;
    const kickerRank = countPairs[1].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'quads',
      score: [7, quadRank, kickerRank, 0, 0, 0],
      handName: `Four of a Kind, ${rankNames[quadRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === quadRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kickerRank),
      ],
    };
  }

  if (countPairs[0].count === 3 && countPairs[1].count === 2) {
    const tripRank = countPairs[0].rank;
    const pairRank = countPairs[1].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'fullhouse',
      score: [6, tripRank, pairRank, 0, 0, 0],
      handName: `Full House, ${rankNames[tripRank]}s full of ${rankNames[pairRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === tripRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pairRank),
      ],
    };
  }

  if (isFlush) {
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'flush',
      score: [5, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]],
      handName: `Flush, ${rankNames[ranks[0]]}-high`,
      bestFive: sorted,
    };
  }

  if (isStraight) {
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    // Reorder cards if it's Ace-low straight to put Ace at the end
    let straightFive = sorted;
    if (straightHighVal === 3 && ranks[0] === 12) {
      // Ace-low: sorted is [A, 5, 4, 3, 2]. Let's make it [5, 4, 3, 2, A]
      straightFive = [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]];
    }
    return {
      type: 'straight',
      score: [4, straightHighVal, 0, 0, 0, 0],
      handName: `Straight, ${rankNames[straightHighVal]}-high`,
      bestFive: straightFive,
    };
  }

  if (countPairs[0].count === 3) {
    const tripRank = countPairs[0].rank;
    const kicker1 = countPairs[1].rank;
    const kicker2 = countPairs[2].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'trips',
      score: [3, tripRank, kicker1, kicker2, 0, 0],
      handName: `Three of a Kind, ${rankNames[tripRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === tripRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kicker1),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kicker2),
      ],
    };
  }

  if (countPairs[0].count === 2 && countPairs[1].count === 2) {
    const pair1 = countPairs[0].rank;
    const pair2 = countPairs[1].rank;
    const kicker = countPairs[2].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'twopair',
      score: [2, pair1, pair2, kicker, 0, 0],
      handName: `Two Pair, ${rankNames[pair1]}s and ${rankNames[pair2]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pair1),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pair2),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kicker),
      ],
    };
  }

  if (countPairs[0].count === 2) {
    const pairRank = countPairs[0].rank;
    const k1 = countPairs[1].rank;
    const k2 = countPairs[2].rank;
    const k3 = countPairs[3].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'pair',
      score: [1, pairRank, k1, k2, k3, 0],
      handName: `One Pair of ${rankNames[pairRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pairRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === k1),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === k2),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === k3),
      ],
    };
  }

  const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return {
    type: 'highcard',
    score: [0, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]],
    handName: `High Card, ${rankNames[ranks[0]]}`,
    bestFive: sorted,
  };
}

// Evaluate best 5-card combination from 5 to 7 cards
export function evaluateSevenCardHand(cards: Card[]): PokerHandResult {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate');
  }

  // If exactly 5 cards, just evaluate it
  if (cards.length === 5) {
    return evaluateFiveCardHand(cards);
  }

  // Get all C(n, 5) combinations
  const combos = getCombinations(cards, 5);
  let bestHand: PokerHandResult | null = null;

  for (const combo of combos) {
    const res = evaluateFiveCardHand(combo);
    if (!bestHand || compareScores(res.score, bestHand.score) > 0) {
      bestHand = res;
    }
  }

  return bestHand!;
}

// Compare two scores lexicographically
export function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < 6; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

// Check if a starting hand is suited or not
export function getStartingHandName(card1: Card, card2: Card): string {
  const r1 = POKER_RANK_ORDER[card1.rank];
  const r2 = POKER_RANK_ORDER[card2.rank];
  const highRank = r1 >= r2 ? card1.rank : card2.rank;
  const lowRank = r1 >= r2 ? card2.rank : card1.rank;

  if (card1.rank === card2.rank) {
    return `${card1.rank}${card2.rank}`;
  }
  return `${highRank}${lowRank}${card1.suit === card2.suit ? 's' : 'o'}`;
}

export function getBotPokerAction(
  player: any,
  gameState: any,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): { action: 'fold' | 'check' | 'call' | 'raise' | 'all-in'; amount?: number } {
  const currentBet = gameState.currentBet || 0;
  const myCurrentBet = player.currentBet || 0;
  const callAmount = currentBet - myCurrentBet;
  const chips = player.chips || 0;
  const bigBlind = gameState.rules?.bigBlind || 10;
  const minRaiseTo = currentBet + (gameState.minRaise || bigBlind);
  const maxRaiseTo = chips + myCurrentBet;

  // 1. Evaluate hand strength
  let handStrength: 'high' | 'medium' | 'low' = 'low';
  const cards = player.cards || [];
  const community = gameState.communityCards || [];

  if (cards.length === 2) {
    if (community.length === 0) {
      // Pre-flop strength
      const r1 = POKER_RANK_ORDER[cards[0].rank];
      const r2 = POKER_RANK_ORDER[cards[1].rank];
      const isPair = cards[0].rank === cards[1].rank;
      const isSuited = cards[0].suit === cards[1].suit;
      const highRank = Math.max(r1, r2);
      const lowRank = Math.min(r1, r2);

      if (isPair && highRank >= 8) {
        handStrength = 'high'; // 10s or better
      } else if (isPair || (highRank === 12 && lowRank >= 9) || (highRank === 11 && lowRank >= 10)) {
        handStrength = 'medium'; // Any pair, AQ, AJ, KQ
      } else if (highRank >= 10 || isSuited || Math.abs(r1 - r2) === 1) {
        handStrength = 'low'; // Playable
      } else {
        handStrength = 'low'; // Trash
      }
    } else {
      // Post-flop strength
      const combined = [...cards, ...community];
      if (combined.length >= 5) {
        const evalResult = evaluateSevenCardHand(combined);
        const rankVal = evalResult.score[0]; // 0-9
        if (rankVal >= 4) {
          handStrength = 'high'; // Straight or better
        } else if (rankVal === 3 || rankVal === 2) {
          handStrength = 'medium'; // Trips or Two Pair
        } else if (rankVal === 1) {
          // One pair
          const pairRank = evalResult.score[1];
          if (pairRank >= 9) {
            handStrength = 'medium'; // Pair of Js or better
          } else {
            handStrength = 'low';
          }
        } else {
          handStrength = 'low';
        }
      }
    }
  }

  // Adjust strength based on difficulty levels
  const rand = Math.random();

  // Easy bot: calls too much, rarely folds or raises
  if (difficulty === 'easy') {
    if (callAmount === 0) {
      return { action: 'check' };
    }
    if (callAmount <= bigBlind * 2 || rand < 0.7) {
      return { action: 'call' };
    }
    return { action: 'fold' };
  }

  // Medium / Hard Bot logic
  if (callAmount === 0) {
    if (handStrength === 'high' && rand < 0.6) {
      // Value bet: bet half the pot
      const pot = gameState.pot || 0;
      const betSize = Math.max(minRaiseTo, Math.floor(pot * 0.5));
      const finalBet = Math.min(betSize, maxRaiseTo);
      return { action: finalBet >= maxRaiseTo ? 'all-in' : 'raise', amount: finalBet };
    }
    if (handStrength === 'medium' && rand < 0.3) {
      const betSize = Math.max(minRaiseTo, bigBlind * 2);
      const finalBet = Math.min(betSize, maxRaiseTo);
      return { action: finalBet >= maxRaiseTo ? 'all-in' : 'raise', amount: finalBet };
    }
    return { action: 'check' };
  } else {
    if (handStrength === 'high') {
      if (rand < 0.4 && maxRaiseTo >= minRaiseTo) {
        const raiseSize = Math.max(minRaiseTo, currentBet + Math.max(callAmount * 2, bigBlind * 3));
        const finalRaise = Math.min(raiseSize, maxRaiseTo);
        return { action: finalRaise >= maxRaiseTo ? 'all-in' : 'raise', amount: finalRaise };
      }
      return { action: 'call' };
    } else if (handStrength === 'medium') {
      if (callAmount <= chips * 0.4 || rand < 0.5) {
        return { action: 'call' };
      }
      return { action: 'fold' };
    } else {
      if (callAmount <= bigBlind && rand < 0.4) {
        return { action: 'call' };
      }
      if (difficulty === 'hard' && rand < 0.15 && maxRaiseTo >= minRaiseTo) {
        const raiseSize = minRaiseTo;
        return { action: 'raise', amount: raiseSize };
      }
      return { action: 'fold' };
    }
  }
}
