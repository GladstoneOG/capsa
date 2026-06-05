export interface SnakesLaddersPlayer {
  id: string;
  name: string;
  avatar: any;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
  position: number;
  score: number;
  roundPoints: number;
  finishRank?: number | null;
  lastRoll?: number | null;
  lastPositionBeforeMove?: number | null;
  hadExtraTurn?: boolean;
  lastObstacleType?: 'snake' | 'ladder' | null;
  lastObstacleStart?: number | null;
  lastObstacleEnd?: number | null;
}

// Map from start tile to destination tile
export const LADDERS: Record<number, number> = {
  2: 38,
  7: 14,
  8: 31,
  15: 26,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  78: 98,
  87: 94
};

export const SNAKES: Record<number, number> = {
  16: 6,
  46: 25,
  49: 11,
  62: 19,
  64: 60,
  74: 53,
  89: 68,
  92: 88,
  95: 75,
  99: 80
};

/**
 * Calculates the landing position including bounce-back logic if overshoot 100
 */
export function calculateNextPosition(current: number, roll: number): {
  intermediate: number; // Position after roll, before snake/ladder
  final: number;        // Position after snake/ladder effect
  effect: 'ladder' | 'snake' | null;
  effectPos: number | null;
} {
  let next = current + roll;
  if (next > 100) {
    next = 100 - (next - 100); // Bounce back
  }

  if (LADDERS[next]) {
    return {
      intermediate: next,
      final: LADDERS[next],
      effect: 'ladder',
      effectPos: next
    };
  }

  if (SNAKES[next]) {
    return {
      intermediate: next,
      final: SNAKES[next],
      effect: 'snake',
      effectPos: next
    };
  }

  return {
    intermediate: next,
    final: next,
    effect: null,
    effectPos: null
  };
}
