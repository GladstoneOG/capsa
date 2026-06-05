export type Suit = 'D' | 'C' | 'H' | 'S'; // Diamonds (♦), Clubs (♣), Hearts (♥), Spades (♠)
export type Rank = '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

export interface Card {
  id: string; // unique ID e.g. "3_D"
  suit: Suit;
  rank: Rank;
}

export type ComboType =
  | 'single'
  | 'pair'
  | 'tris'
  | 'straight'
  | 'flush'
  | 'fullhouse'
  | 'bomber'
  | 'straightflush'
  | 'invalid';

export interface Combination {
  type: ComboType;
  cards: Card[];
}

export const SUIT_ORDER: Record<Suit, number> = {
  D: 0, // Diamond (Lowest)
  C: 1, // Club
  H: 2, // Heart
  S: 3, // Spade (Highest)
};

export const RANK_ORDER: Record<Rank, number> = {
  '3': 0,
  '4': 1,
  '5': 2,
  '6': 3,
  '7': 4,
  '8': 5,
  '9': 6,
  '10': 7,
  'J': 8,
  'Q': 9,
  'K': 10,
  'A': 11,
  '2': 12,
};

export const COMBO_VALUE: Record<ComboType, number> = {
  invalid: 0,
  single: 1,
  pair: 2,
  tris: 3,
  straight: 4,
  flush: 5,
  fullhouse: 6,
  bomber: 7,
  straightflush: 8,
};

export function cardToString(card: Card): string {
  const suitSymbols = { D: '♦', C: '♣', H: '♥', S: '♠' };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

// Sort cards by rank, then by suit
export function sortCards(cards: Card[], method: 'rank' | 'suit' = 'rank'): Card[] {
  return [...cards].sort((a, b) => {
    if (method === 'rank') {
      const diff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
      if (diff !== 0) return diff;
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    } else {
      const diff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
      if (diff !== 0) return diff;
      return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    }
  });
}

// Generate a full deck
export function createDeck(): Card[] {
  const suits: Suit[] = ['D', 'C', 'H', 'S'];
  const ranks: Rank[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck: Card[] = [];
  for (const r of ranks) {
    for (const s of suits) {
      deck.push({ id: `${r}_${s}`, rank: r, suit: s });
    }
  }
  return deck;
}

// Shuffle a deck
export function shuffleDeck(deck: Card[]): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Deal cards to N players
export function dealCards(playerCount: number): Card[][] {
  const deck = shuffleDeck(createDeck());
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  
  // Big Two deals 13 cards to each player
  for (let i = 0; i < 13; i++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck[i * playerCount + p]);
    }
  }
  
  return hands.map(hand => sortCards(hand, 'rank'));
}

// Check combination type
const VALID_STRAIGHTS: Rank[][] = [
  ['A', '2', '3', '4', '5'],
  ['2', '3', '4', '5', '6'],
  ['3', '4', '5', '6', '7'],
  ['4', '5', '6', '7', '8'],
  ['5', '6', '7', '8', '9'],
  ['6', '7', '8', '9', '10'],
  ['7', '8', '9', '10', 'J'],
  ['8', '9', '10', 'J', 'Q'],
  ['9', '10', 'J', 'Q', 'K'],
  ['10', 'J', 'Q', 'K', 'A'],
  ['J', 'Q', 'K', 'A', '2']
];

export function getConsecutiveStraight(cards: Card[]): Card[] | null {
  if (cards.length !== 5) return null;
  const cardRanks = cards.map(c => c.rank);
  for (const seq of VALID_STRAIGHTS) {
    const isMatch = seq.every(r => cardRanks.includes(r));
    if (isMatch) {
      return seq.map(r => cards.find(c => c.rank === r)!);
    }
  }
  return null;
}

export function getStraightHighCard(cards: Card[]): Card {
  const ranks = cards.map(c => c.rank);
  const hasAce = ranks.includes('A');
  const hasTwo = ranks.includes('2');
  const hasThree = ranks.includes('3');
  const hasFour = ranks.includes('4');
  const hasFive = ranks.includes('5');
  const hasSix = ranks.includes('6');

  if (hasAce && hasTwo && hasThree && hasFour && hasFive) {
    return cards.find(c => c.rank === '5')!;
  }
  if (hasTwo && hasThree && hasFour && hasFive && hasSix) {
    return cards.find(c => c.rank === '6')!;
  }
  const sorted = [...cards].sort((a, b) => {
    const rDiff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (rDiff !== 0) return rDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
  return sorted[sorted.length - 1];
}

export function checkCombination(cards: Card[]): Combination {
  const sorted = sortCards(cards, 'rank');
  const count = sorted.length;

  if (count === 1) {
    return { type: 'single', cards: sorted };
  }

  if (count === 2) {
    if (sorted[0].rank === sorted[1].rank) {
      return { type: 'pair', cards: sorted };
    }
    return { type: 'invalid', cards };
  }

  if (count === 3) {
    if (sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank) {
      return { type: 'tris', cards: sorted };
    }
    return { type: 'invalid', cards };
  }

  if (count === 5) {
    const consecutiveS = getConsecutiveStraight(sorted);
    const isS = consecutiveS !== null;
    const isF = isFlush(sorted);

    if (isS && isF) {
      return { type: 'straightflush', cards: consecutiveS };
    }

    if (isBomber(sorted)) {
      return { type: 'bomber', cards: sorted };
    }

    if (isFullHouse(sorted)) {
      return { type: 'fullhouse', cards: sorted };
    }

    if (isF) {
      return { type: 'flush', cards: sorted };
    }

    if (isS) {
      return { type: 'straight', cards: consecutiveS };
    }
  }

  return { type: 'invalid', cards };
}

function isFlush(sorted: Card[]): boolean {
  const suit = sorted[0].suit;
  return sorted.every(c => c.suit === suit);
}

function isFullHouse(sorted: Card[]): boolean {
  // Either 3 of same rank + 2 of another, or 2 of same + 3 of another
  const r0 = sorted[0].rank;
  const r1 = sorted[1].rank;
  const r2 = sorted[2].rank;
  const r3 = sorted[3].rank;
  const r4 = sorted[4].rank;

  // Case 1: AAABB
  if (r0 === r1 && r1 === r2 && r3 === r4 && r2 !== r3) {
    return true;
  }
  // Case 2: AABBB
  if (r0 === r1 && r2 === r3 && r3 === r4 && r1 !== r2) {
    return true;
  }
  return false;
}

function isBomber(sorted: Card[]): boolean {
  // 4 of same rank + 1 kicker
  const r0 = sorted[0].rank;
  const r1 = sorted[1].rank;
  const r2 = sorted[2].rank;
  const r3 = sorted[3].rank;
  const r4 = sorted[4].rank;

  // Case 1: AAAAB
  if (r0 === r1 && r1 === r2 && r2 === r3) {
    return true;
  }
  // Case 2: ABBBB
  if (r1 === r2 && r2 === r3 && r3 === r4) {
    return true;
  }
  return false;
}

// Compare two cards
export function compareCards(a: Card, b: Card): number {
  const rankDiff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  if (rankDiff !== 0) return rankDiff;
  return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
}

// Compare 5-card combinations of the SAME type
function compareSameFiveCard(a: Combination, b: Combination): number {
  const type = a.type;
  if (type === 'straight' || type === 'straightflush') {
    // Compare highest card rank, then highest card suit
    const highA = a.cards[4];
    const highB = b.cards[4];
    return compareCards(highA, highB);
  }

  if (type === 'flush') {
    // Ranked by suit first, then by highest card rank
    const suitA = a.cards[0].suit;
    const suitB = b.cards[0].suit;
    if (suitA !== suitB) {
      return SUIT_ORDER[suitA] - SUIT_ORDER[suitB];
    }
    // Same suit, compare highest card
    return compareCards(a.cards[4], b.cards[4]);
  }

  if (type === 'fullhouse') {
    // Triple rank decides.
    // Full house is sorted. The triple rank will be at index 2.
    // e.g. AAA-BB (idx 2 is A) or AA-BBB (idx 2 is B).
    const rankA = a.cards[2].rank;
    const rankB = b.cards[2].rank;
    return RANK_ORDER[rankA] - RANK_ORDER[rankB];
  }

  if (type === 'bomber') {
    // Bomber has 4 of same rank. The four-of-a-kind rank will always be at index 2.
    // e.g. AAAA-B or B-AAAA (idx 2 is A).
    const rankA = a.cards[2].rank;
    const rankB = b.cards[2].rank;
    return RANK_ORDER[rankA] - RANK_ORDER[rankB];
  }

  return 0;
}

// Verify if nextPlay beats prevPlay.
// rules: { enableBombsSingle: boolean, enableBombsPair: boolean }
export function canBeat(
  nextPlay: Combination,
  prevPlay: Combination | null,
  rules = { enableBombsSingle: true, enableBombsPair: true }
): boolean {
  if (nextPlay.type === 'invalid') return false;

  // Lead turn: anything valid can be played
  if (!prevPlay) return true;

  const nextVal = COMBO_VALUE[nextPlay.type];
  const prevVal = COMBO_VALUE[prevPlay.type];

  // Special Bombing / Slamming Rules:
  // Bomber (7) or Straight Flush (8) can beat a single '2' or pair of '2's
  if (rules.enableBombsSingle && prevPlay.type === 'single' && prevPlay.cards[0].rank === '2') {
    if (nextPlay.type === 'bomber' || nextPlay.type === 'straightflush') {
      return true;
    }
  }

  if (rules.enableBombsPair && prevPlay.type === 'pair' && prevPlay.cards[0].rank === '2') {
    if (nextPlay.type === 'bomber' || nextPlay.type === 'straightflush') {
      return true;
    }
  }

  // Normal comparison: must be same category for 1, 2, 3 card hands
  if (prevVal <= 3) {
    if (nextPlay.type !== prevPlay.type) return false;

    if (nextPlay.type === 'single') {
      return compareCards(nextPlay.cards[0], prevPlay.cards[0]) > 0;
    }

    if (nextPlay.type === 'pair') {
      // Sort and compare the highest card in the pair
      const highNext = sortCards(nextPlay.cards, 'rank')[1];
      const highPrev = sortCards(prevPlay.cards, 'rank')[1];
      return compareCards(highNext, highPrev) > 0;
    }

    if (nextPlay.type === 'tris') {
      return RANK_ORDER[nextPlay.cards[0].rank] > RANK_ORDER[prevPlay.cards[0].rank];
    }
  }

  // 5-Card Hands comparison:
  // straight (4), flush (5), fullhouse (6), bomber (7), straightflush (8)
  if (prevVal >= 4 && prevVal <= 8) {
    if (nextVal < 4 || nextVal > 8) return false; // Must be a 5-card combo

    if (nextVal > prevVal) {
      return true; // Higher type beats lower type
    }
    if (nextVal === prevVal) {
      return compareSameFiveCard(nextPlay, prevPlay) > 0;
    }
  }

  return false;
}

// Verify if the play contains 3 of Diamonds
export function contains3Diamonds(cards: Card[]): boolean {
  return cards.some(c => c.rank === '3' && c.suit === 'D');
}

// ==================== AI Bot Logic ====================

// Generates all possible plays in a player's hand that beat the prevPlay
export function getValidPlays(
  hand: Card[],
  prevPlay: Combination | null,
  isFirstPlay: boolean,
  rules = { enableBombsSingle: true, enableBombsPair: true }
): Card[][] {
  const validPlays: Card[][] = [];

  // Helper to filter out plays that don't contain 3 of Diamonds if it's the very first play
  const filterFirstPlay = (plays: Card[][]) => {
    if (!isFirstPlay) return plays;
    return plays.filter(play => contains3Diamonds(play));
  };

  if (!prevPlay) {
    // Leading player can play any valid combination
    // Let's generate Singles, Pairs, Triples, and 5-card hands

    // Singles
    for (const c of hand) {
      validPlays.push([c]);
    }

    // Pairs
    const pairs = findCombinationsOfSize(hand, 2);
    validPlays.push(...pairs);

    // Tris
    const tris = findCombinationsOfSize(hand, 3);
    validPlays.push(...tris);

    // 5-Card hands
    const fiveCards = findFiveCardHands(hand);
    validPlays.push(...fiveCards);

    return filterFirstPlay(validPlays);
  }

  // Follow player: must beat prevPlay
  const targetSize = prevPlay.cards.length;

  if (targetSize === 1) {
    // Singles
    for (const c of hand) {
      const play = [c];
      const combo = checkCombination(play);
      if (canBeat(combo, prevPlay, rules)) {
        validPlays.push(play);
      }
    }
    // Check for Bombs (if active play is single 2)
    if (rules.enableBombsSingle && prevPlay.cards[0].rank === '2') {
      const bombs = findFiveCardHands(hand).filter(b => b.length === 5 && (checkCombination(b).type === 'bomber' || checkCombination(b).type === 'straightflush'));
      validPlays.push(...bombs);
    }
  } else if (targetSize === 2) {
    // Pairs
    const pairs = findCombinationsOfSize(hand, 2);
    for (const p of pairs) {
      const combo = checkCombination(p);
      if (canBeat(combo, prevPlay, rules)) {
        validPlays.push(p);
      }
    }
    // Check for Bombs (if active play is pair of 2s)
    if (rules.enableBombsPair && prevPlay.cards[0].rank === '2') {
      const bombs = findFiveCardHands(hand).filter(b => b.length === 5 && (checkCombination(b).type === 'bomber' || checkCombination(b).type === 'straightflush'));
      validPlays.push(...bombs);
    }
  } else if (targetSize === 3) {
    // Tris
    const tris = findCombinationsOfSize(hand, 3);
    for (const t of tris) {
      const combo = checkCombination(t);
      if (canBeat(combo, prevPlay, rules)) {
        validPlays.push(t);
      }
    }
  } else if (targetSize === 5) {
    // 5-Card hands
    const fiveCards = findFiveCardHands(hand);
    for (const f of fiveCards) {
      const combo = checkCombination(f);
      if (canBeat(combo, prevPlay, rules)) {
        validPlays.push(f);
      }
    }
  }

  return filterFirstPlay(validPlays);
}

// Find pairs or triples
function findCombinationsOfSize(hand: Card[], size: 2 | 3): Card[][] {
  const groups: Record<Rank, Card[]> = {} as any;
  for (const c of hand) {
    if (!groups[c.rank]) groups[c.rank] = [];
    groups[c.rank].push(c);
  }

  const results: Card[][] = [];
  for (const rank in groups) {
    const list = groups[rank as Rank];
    if (list.length >= size) {
      // Find combinations of this size
      getCombinations(list, size).forEach(comb => {
        results.push(comb);
      });
    }
  }
  return results;
}

// Helper to get combinations of k elements from an array
function getCombinations<T>(array: T[], k: number): T[][] {
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

// Find all valid 5-card hands in a deck
function findFiveCardHands(hand: Card[]): Card[][] {
  const results: Card[][] = [];
  const combosOf5 = getCombinations(hand, 5);
  for (const combo of combosOf5) {
    const validated = checkCombination(combo);
    if (validated.type !== 'invalid') {
      results.push(validated.cards);
    }
  }
  return results;
}

// Bot AI decider: returns the card array it chooses to play, or null (pass)
export function getBotPlay(
  hand: Card[],
  prevPlay: Combination | null,
  isFirstPlay: boolean,
  rules = { enableBombsSingle: true, enableBombsPair: true }
): Card[] | null {
  const validPlays = getValidPlays(hand, prevPlay, isFirstPlay, rules);
  if (validPlays.length === 0) return null;

  // We sort valid plays so the AI plays its lowest strength cards first (to be efficient!)
  // For single/pair/tris, we want to play the lowest card.
  // Let's rate each play.
  const ratedPlays = validPlays.map(play => {
    const combo = checkCombination(play);
    let rating: number;
    
    if (combo.type === 'single') {
      rating = RANK_ORDER[combo.cards[0].rank] * 10 + SUIT_ORDER[combo.cards[0].suit];
    } else if (combo.type === 'pair') {
      const highCard = sortCards(combo.cards, 'rank')[1];
      rating = 200 + RANK_ORDER[highCard.rank] * 10 + SUIT_ORDER[highCard.suit];
    } else if (combo.type === 'tris') {
      rating = 400 + RANK_ORDER[combo.cards[0].rank] * 10;
    } else {
      // 5-card hands: rated by their combination value
      const typeVal = COMBO_VALUE[combo.type]; // 4 to 8
      let highCard = combo.cards[4];
      if (combo.type === 'fullhouse' || combo.type === 'bomber') {
        highCard = combo.cards[2]; // the main rank card
      }
      rating = 600 + typeVal * 100 + RANK_ORDER[highCard.rank] * 10 + SUIT_ORDER[highCard.suit];
    }

    return { play, rating };
  });

  // Sort by rating ascending (lowest first)
  ratedPlays.sort((a, b) => a.rating - b.rating);

  // If there's an active play, the bot should sometimes decide to pass if it only has very high cards remaining
  // e.g. if the active play is a single 10, and the bot's only valid card is 2♠, it might want to pass to save the 2♠.
  // But let's keep the bot relatively straightforward:
  // If it's a lead play, play the absolute lowest combination. 
  // Prefer playing 5-card hands, then triples, then pairs, then singles to empty the hand faster!
  if (!prevPlay) {
    // Lead play: Bot wants to play a combination if possible to shed cards in groups.
    // Let's filter the rated plays by size.
    const fives = ratedPlays.filter(p => p.play.length === 5);
    if (fives.length > 0) return fives[0].play;

    const triples = ratedPlays.filter(p => p.play.length === 3);
    if (triples.length > 0) return triples[0].play;

    const pairs = ratedPlays.filter(p => p.play.length === 2);
    if (pairs.length > 0) return pairs[0].play;

    return ratedPlays[0].play;
  }

  // Follow play: play the lowest valid cards that can beat it
  const choice = ratedPlays[0];

  // Simple heuristic: if the choice requires wasting a 2 or an Ace on a very low card (e.g. beating a 4 with a 2), 
  // and the bot has other cards, it might want to pass.
  // But to keep it competitive and robust, playing the lowest valid card is actually the best default strategy.
  return choice.play;
}
