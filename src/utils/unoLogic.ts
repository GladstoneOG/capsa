export interface UnoCard {
  id: string;
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild';
  value: string; // '0'-'9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'
}

/**
 * Check if a card can be played based on the current state.
 */
export function isCardPlayable(
  card: UnoCard,
  currentColor: string,
  currentValue: string,
  accumulatedDrawCount: number,
  stackingEnabled: boolean
): boolean {
  // 1. If stacking is active (penalty accumulation)
  if (stackingEnabled && accumulatedDrawCount > 0) {
    if (currentValue === 'draw2') {
      return card.value === 'draw2';
    }
    if (currentValue === 'wild4') {
      return card.value === 'wild4';
    }
    return false;
  }

  // 2. Normal play (no stacking penalty active)
  if (card.color === 'wild') {
    return true; // Wild and Wild4 can always be played
  }

  return card.color === currentColor || card.value === currentValue;
}

/**
 * Get all playable cards in hand.
 */
export function getPlayableCards(
  hand: UnoCard[],
  currentColor: string,
  currentValue: string,
  accumulatedDrawCount: number,
  stackingEnabled: boolean
): UnoCard[] {
  return hand.filter(card =>
    isCardPlayable(card, currentColor, currentValue, accumulatedDrawCount, stackingEnabled)
  );
}

/**
 * Let a bot decide which card to play, choosing the best color for Wilds.
 */
export function getBotPlayDecision(
  hand: UnoCard[],
  currentColor: string,
  currentValue: string,
  accumulatedDrawCount: number,
  stackingEnabled: boolean
): { action: 'play'; card: UnoCard; chosenColor?: 'red' | 'yellow' | 'green' | 'blue' } | { action: 'draw' } {
  const playable = getPlayableCards(hand, currentColor, currentValue, accumulatedDrawCount, stackingEnabled);

  if (playable.length === 0) {
    return { action: 'draw' };
  }

  // Simple heuristic: Bot prefers to play action/number cards before Wilds to keep Wilds for emergencies.
  // Sort cards: numbers first, actions next, wild last.
  const scoreCard = (c: UnoCard) => {
    if (c.color === 'wild') return 3; // Wilds last
    if (['skip', 'reverse', 'draw2'].includes(c.value)) return 2; // Actions second
    return 1; // Numbers first
  };

  playable.sort((a, b) => scoreCard(a) - scoreCard(b));
  const cardToPlay = playable[0];

  if (cardToPlay.color === 'wild') {
    // Choose the color the bot has the most of in hand
    const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
    hand.forEach(c => {
      if (c.color !== 'wild') {
        counts[c.color]++;
      }
    });

    let bestColor: 'red' | 'yellow' | 'green' | 'blue' = 'red';
    let max = -1;
    (Object.keys(counts) as Array<'red' | 'yellow' | 'green' | 'blue'>).forEach(col => {
      if (counts[col] > max) {
        max = counts[col];
        bestColor = col;
      }
    });

    return { action: 'play', card: cardToPlay, chosenColor: bestColor };
  }

  return { action: 'play', card: cardToPlay };
}

/**
 * Score a hand at the end of the round (for display or sync validation).
 */
export function calculateUnoHandScore(hand: UnoCard[]): number {
  return hand.reduce((sum, card) => {
    if (card.color === 'wild') {
      return sum + 50;
    }
    if (['skip', 'reverse', 'draw2'].includes(card.value)) {
      return sum + 20;
    }
    const val = parseInt(card.value, 10);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
}
