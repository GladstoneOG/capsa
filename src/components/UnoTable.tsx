import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AvatarSVG } from './AvatarCreator';
import { sfx } from '../utils/audio';
import { isCardPlayable, getPlayableCards, type UnoCard } from '../utils/unoLogic';

interface Player {
  id: string;
  name: string;
  avatar: any;
  isHost: boolean;
  isBot: boolean;
  cards: (UnoCard | null)[];
  passed: boolean;
  score: number;
  lastPlay: UnoCard[] | null;
  roundPoints?: number;
  isReady?: boolean;
  safeUno?: boolean;
}

interface UnoTableProps {
  playerId: string;
  players: Player[];
  turnIndex: number;
  currentColor: string;
  currentValue: string;
  playDirection: number;
  accumulatedDrawCount: number;
  sevenSwappingPlayerId: string | null;
  lastSevenSwap?: { requesterId: string; targetId: string } | null;
  discardPile: UnoCard[];
  gameState: 'lobby' | 'playing' | 'roundover' | 'gameover';
  rules: {
    pointsToWin: number;
    turnDuration: number;
    stacking: boolean;
    jumpIn: boolean;
    sevenSwap: boolean;
    zeroRotate: boolean;
    drawTillPlay: boolean;
  };
  roomCode?: string;
  isHost: boolean;
  isSinglePlayer: boolean;
  onPlayCard: (card: UnoCard, chosenColor?: string, isJumpIn?: boolean) => void;
  onDrawCard: () => void;
  onPass: () => void;
  onUnoCall: () => void;
  onUnoChallenge: (targetPlayerId: string) => void;
  onSwapHand: (targetPlayerId: string) => void;
  onRestartGame: () => void;
  onLeaveRoom: () => void;
}

// Seat position mapper for up to 8 players around stadium table
function getUnoSeatClass(playerIdx: number, localIdx: number, numPlayers: number): number {
  if (localIdx === -1) return 0;
  const relativeIdx = (playerIdx - localIdx + numPlayers) % numPlayers;
  if (numPlayers === 2) return relativeIdx === 0 ? 0 : 4;
  if (numPlayers === 3) {
    if (relativeIdx === 0) return 0;
    if (relativeIdx === 1) return 2;
    return 6;
  }
  if (numPlayers === 4) {
    if (relativeIdx === 0) return 0;
    if (relativeIdx === 1) return 2;
    if (relativeIdx === 2) return 4;
    return 6;
  }
  if (numPlayers === 5) {
    if (relativeIdx === 0) return 0;
    if (relativeIdx === 1) return 2;
    if (relativeIdx === 2) return 3;
    if (relativeIdx === 3) return 5;
    return 6;
  }
  if (numPlayers === 6) {
    if (relativeIdx === 0) return 0;
    if (relativeIdx === 1) return 1;
    if (relativeIdx === 2) return 2;
    if (relativeIdx === 3) return 4;
    if (relativeIdx === 4) return 6;
    return 7;
  }
  if (numPlayers === 7) {
    if (relativeIdx === 0) return 0;
    if (relativeIdx === 1) return 1;
    if (relativeIdx === 2) return 2;
    if (relativeIdx === 3) return 3;
    if (relativeIdx === 4) return 5;
    if (relativeIdx === 5) return 6;
    return 7;
  }
  return relativeIdx;
}

const glyphs: Record<string, string> = {
  skip: '🚫',
  reverse: '⇄',
  draw2: '+2',
  wild: 'W',
  wild4: '+4',
};

const UnoCardComponent: React.FC<{
  card: UnoCard | null;
  isBack?: boolean;
  onClick?: () => void;
  className?: string;
  chosenColor?: string;
}> = ({ card, isBack = false, onClick, className = '', chosenColor }) => {
  if (isBack || !card) {
    return (
      <div className={`uno-card uno-card-back ${className}`} onClick={onClick}>
        <div className="uno-back-oval">
          <span className="uno-back-text">UNO</span>
        </div>
      </div>
    );
  }

  const isWild = card.color === 'wild';
  const displayVal = glyphs[card.value] || card.value;
  const colorClass = isWild && chosenColor ? `${card.color} chosen-${chosenColor}` : card.color;

  return (
    <div className={`uno-card ${colorClass} ${className}`} onClick={onClick}>
      <div className="uno-card-corner-val top-left">{displayVal}</div>
      <div className="uno-card-oval">
        <div className="uno-card-center-val">{displayVal}</div>
      </div>
      <div className="uno-card-corner-val bottom-right">{displayVal}</div>
    </div>
  );
};

interface FlyingAnim {
  id: string;
  type: 'card' | 'plus-number';
  animClass: string;
  text?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  card?: UnoCard;
  targetRotation?: number;
}

export const UnoTable: React.FC<UnoTableProps> = ({
  playerId,
  players,
  turnIndex,
  currentColor,
  currentValue,
  playDirection,
  accumulatedDrawCount,
  sevenSwappingPlayerId,
  lastSevenSwap,
  discardPile,
  gameState,
  rules,
  roomCode,
  isHost,
  isSinglePlayer,
  onPlayCard,
  onDrawCard,
  onPass,
  onUnoCall,
  onUnoChallenge,
  onSwapHand,
  onRestartGame,
  onLeaveRoom,
}) => {
  const [selectedWildCard, setSelectedWildCard] = useState<UnoCard | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(rules.turnDuration);
  const timerRef = useRef<any>(null);

  const [flyingAnims, setFlyingAnims] = useState<FlyingAnim[]>([]);
  const [skippedSeats, setSkippedSeats] = useState<Set<number>>(new Set());
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const [showReverseAnim, setShowReverseAnim] = useState<boolean>(false);
  const [reverseAnimDir, setReverseAnimDir] = useState<'cw' | 'ccw'>('cw');
  const [showSkipAnim, setShowSkipAnim] = useState<boolean>(false);
  const [showSevenSwapAnim, setShowSevenSwapAnim] = useState<boolean>(false);
  const [showZeroRotateAnim, setShowZeroRotateAnim] = useState<boolean>(false);
  const [showWildAnim, setShowWildAnim] = useState<boolean>(false);
  const [swapSeats, setSwapSeats] = useState<{ seat1: number; seat2: number } | null>(null);
  const [swapCoords, setSwapCoords] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const tableAreaRef = useRef<HTMLDivElement>(null);

  const getElementCoords = useCallback((selector: string): { x: number; y: number } | null => {
    if (!tableAreaRef.current) return null;
    const parentRect = tableAreaRef.current.getBoundingClientRect();
    let element = document.querySelector(selector);
    if (!element && selector.includes(' ')) {
      // Fallback to parent container if sub-element is not rendered/present
      element = document.querySelector(selector.split(' ')[0]);
    }
    if (!element) return null;
    const elementRect = element.getBoundingClientRect();
    
    // Center of the element relative to parent
    return {
      x: elementRect.left + elementRect.width / 2 - parentRect.left,
      y: elementRect.top + elementRect.height / 2 - parentRect.top,
    };
  }, []);

  useEffect(() => {
    if (swapSeats) {
      const coord1 = getElementCoords(`.uno-seat-${swapSeats.seat1}`);
      const coord2 = getElementCoords(`.uno-seat-${swapSeats.seat2}`);
      if (coord1 && coord2) {
        setSwapCoords({ x1: coord1.x, y1: coord1.y, x2: coord2.x, y2: coord2.y });
      }
    } else {
      setSwapCoords(null);
    }
  }, [swapSeats, getElementCoords]);

  // Initial deal synchronization states
  const [isInitialDealing, setIsInitialDealing] = useState<boolean>(false);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(new Set());
  const [revealedCardCounts, setRevealedCardCounts] = useState<Record<string, number>>({});
  const [showStartingDiscard, setShowStartingDiscard] = useState<boolean>(false);
  const dealingTimeoutsRef = useRef<any[]>([]);

  const clearDealingTimeouts = useCallback(() => {
    console.log('UnoTable: clearDealingTimeouts called, had timeouts:', dealingTimeoutsRef.current.length);
    dealingTimeoutsRef.current.forEach(t => clearTimeout(t));
    dealingTimeoutsRef.current = [];
  }, []);

  const skipTimerRef = useRef<any>(null);

  const addFlyingAnim = useCallback((
    fromSelector: string,
    toSelector: string,
    type: 'card' | 'plus-number',
    animClass: string,
    text?: string,
    delay: number = 0,
    card?: UnoCard,
    targetRotation?: number
  ) => {
    if (type === 'card' && animClass.includes('play') && card) {
      setPlayingCardId(card.id);
    }

    setTimeout(() => {
      const start = getElementCoords(fromSelector);
      let end = getElementCoords(toSelector);
      if (!end && toSelector.includes(' ')) {
        // Fallback to parent container if sub-element is not rendered/present
        end = getElementCoords(toSelector.split(' ')[0]);
      }
      if (!start || !end) {
        if (type === 'card' && animClass.includes('play') && card) {
          setPlayingCardId(prev => prev === card.id ? null : prev);
        }
        return;
      }

      const id = `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setFlyingAnims(prev => [
        ...prev,
        {
          id,
          type,
          animClass,
          text,
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          card,
          targetRotation,
        }
      ]);

      // Remove after animation completes (e.g. 700ms)
      setTimeout(() => {
        setFlyingAnims(prev => prev.filter(anim => anim.id !== id));
        if (type === 'card' && animClass.includes('play') && card) {
          setPlayingCardId(prev => prev === card.id ? null : prev);
        }
      }, 700);
    }, delay);
  }, [getElementCoords]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      console.log('UnoTable: unmount cleanup effect called');
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      clearDealingTimeouts();
    };
  }, [clearDealingTimeouts]);

  // Local player references
  const localIdx = useMemo(() => players.findIndex(p => p.id === playerId), [players, playerId]);
  const isMyTurn = turnIndex === localIdx && localIdx !== -1;

  // Turn Timer Countdown logic
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (gameState !== 'playing' || rules.turnDuration === 0) return;

    setTimeLeft(rules.turnDuration);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time out!
          if (isMyTurn) {
            sfx.playPass();
            onPass();
          }
          return rules.turnDuration;
        }
        if (isMyTurn && prev <= 6) {
          sfx.playTick(); // Tick sound for last 5 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [turnIndex, gameState, isMyTurn, rules.turnDuration, onPass]);

  const localPlayer = localIdx !== -1 ? players[localIdx] : null;
  const localHand = useMemo(() => {
    if (!localPlayer) return [];
    return localPlayer.cards.filter((c): c is UnoCard => c !== null);
  }, [localPlayer]);

  // Track previous hand length for draw animation detection
  const prevHandLenRef = useRef<number>(localHand.length);
  const [drawnCardIds, setDrawnCardIds] = useState<Set<string>>(new Set());
  const handAnimatedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (gameState !== 'playing' || localHand.length === 0) {
      handAnimatedIdsRef.current.clear();
    }
  }, [gameState, localHand.length]);

  useEffect(() => {
    const prevLen = prevHandLenRef.current;
    const currentLen = localHand.length;
    if (currentLen > prevLen) {
      // New cards were drawn — mark them for fly-in animation
      const newIds = new Set<string>();
      const prevIds = new Set(localHand.slice(0, prevLen).map(c => c.id));
      localHand.forEach(c => {
        if (!prevIds.has(c.id)) newIds.add(c.id);
      });
      setDrawnCardIds(newIds);
      // Clear the drawn class after animation completes
      const timer = setTimeout(() => setDrawnCardIds(new Set()), 700);
      prevHandLenRef.current = currentLen;
      return () => clearTimeout(timer);
    }
    prevHandLenRef.current = currentLen;
  }, [localHand]);

  // State Change Detector for Animations and Skips
  const prevPlayersRef = useRef<Player[]>([]);
  const prevDiscardPileRef = useRef<UnoCard[]>([]);
  const prevTurnIdxRef = useRef<number>(-1);
  const prevSevenSwappingPlayerIdRef = useRef<string | null>(null);
  const lastPlayedAnimCardIdRef = useRef<string | null>(null);
  const prevLastSevenSwapRef = useRef<any>(null);
  const prevGameStateRef = useRef<'lobby' | 'playing' | 'roundover' | 'gameover' | null>(null);

  useEffect(() => {
    console.log('UnoTable: main useEffect running. gameState:', gameState, 'prevGameStateRef.current:', prevGameStateRef.current, 'isInitialDealing:', isInitialDealing, 'timeouts:', dealingTimeoutsRef.current.length);

    if (gameState !== 'playing') {
      clearDealingTimeouts();
      setIsInitialDealing(false);
      setRevealedCardIds(new Set());
      setRevealedCardCounts({});
      setShowStartingDiscard(false);
      setShowSkipAnim(false);
      setShowSevenSwapAnim(false);
      setShowZeroRotateAnim(false);
      setShowWildAnim(false);
      setSwapSeats(null);
      setSwapCoords(null);

      prevPlayersRef.current = players;
      prevDiscardPileRef.current = discardPile;
      prevTurnIdxRef.current = turnIndex;
      prevSevenSwappingPlayerIdRef.current = sevenSwappingPlayerId;
      lastPlayedAnimCardIdRef.current = null;
      prevLastSevenSwapRef.current = null;
      prevGameStateRef.current = gameState;
      return;
    }

    const prevPlayers = prevPlayersRef.current;
    const prevDiscardPile = prevDiscardPileRef.current;
    const prevTurnIdx = prevTurnIdxRef.current;
    const prevSevenSwappingPlayerId = prevSevenSwappingPlayerIdRef.current;
    const prevLastSevenSwap = prevLastSevenSwapRef.current;
    const prevGameState = prevGameStateRef.current;

    // Detect transition from non-playing (lobby/roundover) to playing
    const isNewGameStart = prevGameState !== 'playing';
    console.log('UnoTable: main useEffect, isNewGameStart:', isNewGameStart);

    if (isNewGameStart) {
      clearDealingTimeouts();
      setIsInitialDealing(true);
      setRevealedCardIds(new Set());
      setRevealedCardCounts({});
      setShowStartingDiscard(false);

      // Sync refs and exit to prevent triggering regular card draw/play animations on start
      prevPlayersRef.current = players;
      prevDiscardPileRef.current = discardPile;
      prevTurnIdxRef.current = turnIndex;
      prevSevenSwappingPlayerIdRef.current = sevenSwappingPlayerId;
      prevLastSevenSwapRef.current = lastSevenSwap;
      prevGameStateRef.current = gameState;
      return;
    }

    // Schedule (or reschedule) dealing animations if dealing state is active but timeouts were cleared
    if (isInitialDealing) {
      console.log('UnoTable: main useEffect: isInitialDealing is true, timeouts length:', dealingTimeoutsRef.current.length);
      if (dealingTimeoutsRef.current.length === 0) {
        console.log('UnoTable: scheduling initial deal timeouts...');
        // 1. Initial Deal to all players' hands (staggered dealer sequence)
        players.forEach((p, pIdx) => {
          const seatNum = getUnoSeatClass(pIdx, localIdx, players.length);
          const isLocal = seatNum === 0;
          const numInitialCards = p.cards.length;

          for (let r = 0; r < numInitialCards; r++) {
            const delay = (r * players.length + pIdx) * 80;
            const cardObj = isLocal ? (localHand[r] || undefined) : undefined;
            const targetSelector = (isLocal && cardObj)
              ? `#uno-card-hand-${cardObj.id}`
              : isLocal
                ? '.uno-hand-cards-list'
                : `.uno-seat-${seatNum} .uno-seat-card-fan`;
            const animClass = isLocal ? 'uno-fly-draw-local' : 'uno-fly-draw-other';
            let targetRot = 0;
            if (isLocal) {
              const total = p.cards.length;
              const spreadAngle = Math.min(45, (total - 1) * 3);
              const angleStep = total > 1 ? spreadAngle / (total - 1) : 0;
              targetRot = r * angleStep - spreadAngle / 2;
            } else {
              const maxCards = Math.min(7, numInitialCards);
              const mid = (maxCards - 1) / 2;
              const angleStep = maxCards > 5 ? 6 : 10;
              const cardIdxInFan = r % maxCards;
              targetRot = maxCards > 1 ? (cardIdxInFan - mid) * angleStep : 0;
            }
            addFlyingAnim('.uno-draw-pile-target', targetSelector, 'card', animClass, undefined, delay, cardObj, targetRot);

            const tId = setTimeout(() => {
              console.log(`UnoTable: card timeout fired for player ${p.name}, cardObj:`, cardObj?.id);
              if (isLocal && cardObj) {
                setRevealedCardIds(prev => {
                  const next = new Set(prev);
                  next.add(cardObj.id);
                  return next;
                });
              } else {
                setRevealedCardCounts(prev => ({
                  ...prev,
                  [p.id]: (prev[p.id] || 0) + 1
                }));
              }
            }, delay + 700);
            dealingTimeoutsRef.current.push(tId);
          }
        });

        // 2. Initial Discard Pile Flip (starts after hands are dealt)
        const startingCard = discardPile[0];
        const flipDelay = players.length * 7 * 80 + 100;
        if (startingCard) {
          console.log('UnoTable: scheduling starting discard flip delay:', flipDelay);
          const targetRot = getCardOffsets(startingCard.id).angle;
          addFlyingAnim('.uno-draw-pile-target', '.uno-discard-pile-target', 'card', 'uno-fly-play-other', undefined, flipDelay, startingCard, targetRot);
          
          const tIdFlip = setTimeout(() => {
            console.log('UnoTable: starting discard flip timeout fired');
            setShowStartingDiscard(true);
          }, flipDelay + 700);
          dealingTimeoutsRef.current.push(tIdFlip);
        }

        // End initial dealing state once starting card lands
        const tIdEnd = setTimeout(() => {
          console.log('UnoTable: end initial dealing timeout fired, setting isInitialDealing to false');
          setIsInitialDealing(false);
        }, flipDelay + 700);
        dealingTimeoutsRef.current.push(tIdEnd);
      }

      // Sync refs and exit to prevent triggering regular card draw/play animations during dealing
      prevPlayersRef.current = players;
      prevDiscardPileRef.current = discardPile;
      prevTurnIdxRef.current = turnIndex;
      prevSevenSwappingPlayerIdRef.current = sevenSwappingPlayerId;
      prevLastSevenSwapRef.current = lastSevenSwap;
      prevGameStateRef.current = gameState;
      return;
    }

    // Initialize refs if empty (fallback/safety guard)
    if (!prevPlayers || prevPlayers.length === 0) {
      prevPlayersRef.current = players;
      prevDiscardPileRef.current = discardPile;
      prevTurnIdxRef.current = turnIndex;
      prevSevenSwappingPlayerIdRef.current = sevenSwappingPlayerId;
      prevLastSevenSwapRef.current = lastSevenSwap;
      prevGameStateRef.current = gameState;
      return;
    }

    const numPlayers = players.length;

    // 1. Detect Skip Turn (Skip overlay)
    if (prevTurnIdx !== -1 && turnIndex !== prevTurnIdx) {
      const steps: number[] = [];
      let curr = prevTurnIdx;
      for (let count = 0; count < numPlayers; count++) {
        curr = (curr + playDirection + numPlayers) % numPlayers;
        if (curr === turnIndex) {
          steps.push(curr);
          break;
        }
        steps.push(curr);
      }

      if (steps.length > 1) {
        const skippedIndices = steps.slice(0, steps.length - 1);
        const skippedSeatsSet = new Set<number>();
        skippedIndices.forEach(idx => {
          skippedSeatsSet.add(getUnoSeatClass(idx, localIdx, numPlayers));
        });
        setSkippedSeats(skippedSeatsSet);
        if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
        skipTimerRef.current = setTimeout(() => {
          setSkippedSeats(new Set());
        }, 1500);
      }
    }

    // 2. Detect Card Plays / Draws
    const topDiscardCard = discardPile[discardPile.length - 1] || null;
    if (!topDiscardCard) {
      lastPlayedAnimCardIdRef.current = null;
    }

    // Check 7-swap hand exchange
    const finishedSevenSwap = !!(
      (prevSevenSwappingPlayerId !== null && sevenSwappingPlayerId === null) ||
      (lastSevenSwap && lastSevenSwap !== prevLastSevenSwap)
    );

    // Check 0 rotate
    const isZeroPlayed = discardPile.length > prevDiscardPile.length && topDiscardCard?.value === '0' && rules.zeroRotate;

    if (finishedSevenSwap) {
      let seat1 = -1;
      let seat2 = -1;

      if (lastSevenSwap) {
        const idx1 = players.findIndex(p => p.id === lastSevenSwap.requesterId);
        const idx2 = players.findIndex(p => p.id === lastSevenSwap.targetId);
        if (idx1 !== -1 && idx2 !== -1) {
          seat1 = getUnoSeatClass(idx1, localIdx, numPlayers);
          seat2 = getUnoSeatClass(idx2, localIdx, numPlayers);
        }
      } else {
        // Fallback: detect by changed cards
        const changedPlayers: number[] = [];
        players.forEach((p, idx) => {
          const prevP = prevPlayers[idx];
          if (prevP) {
            const currentIds = p.cards.filter((c): c is UnoCard => c !== null).map(c => c.id).sort().join(',');
            const prevIds = prevP.cards.filter((c): c is UnoCard => c !== null).map(c => c.id).sort().join(',');
            if (currentIds !== prevIds) {
              changedPlayers.push(idx);
            }
          }
        });
        if (changedPlayers.length >= 2) {
          seat1 = getUnoSeatClass(changedPlayers[0], localIdx, numPlayers);
          seat2 = getUnoSeatClass(changedPlayers[1], localIdx, numPlayers);
        }
      }

      if (seat1 !== -1 && seat2 !== -1) {
        setSwapSeats({ seat1, seat2 });
        setShowSevenSwapAnim(true);
        setTimeout(() => {
          setShowSevenSwapAnim(false);
          setSwapSeats(null);
        }, 1200);

        const fromSel = seat1 === 0 ? '.uno-hand-cards-list' : `.uno-seat-${seat1} .uno-seat-card-fan`;
        const toSel = seat2 === 0 ? '.uno-hand-cards-list' : `.uno-seat-${seat2} .uno-seat-card-fan`;
        for (let i = 0; i < 4; i++) {
          addFlyingAnim(fromSel, toSel, 'card', 'uno-fly-swap', undefined, i * 120);
          addFlyingAnim(toSel, fromSel, 'card', 'uno-fly-swap', undefined, i * 120);
        }
      }
    } else if (isZeroPlayed) {
      // 1. Find who played the 0 card to trigger card flight and overlay
      let playerWhoPlayedZeroIdx = prevTurnIdx;
      if (playerWhoPlayedZeroIdx === -1) {
        playerWhoPlayedZeroIdx = players.findIndex(p => p.cards.length < (prevPlayers[players.indexOf(p)]?.cards.length || 0));
      }
      if (playerWhoPlayedZeroIdx !== -1 && topDiscardCard) {
        lastPlayedAnimCardIdRef.current = topDiscardCard.id;
        const seatNum = getUnoSeatClass(playerWhoPlayedZeroIdx, localIdx, numPlayers);
        const animClass = seatNum === 0 ? 'uno-fly-play-local' : 'uno-fly-play-other';
        const fromSelector = seatNum === 0 ? `.uno-seat-0` : `.uno-seat-${seatNum} .uno-seat-card-fan`;
        const targetRot = getCardOffsets(topDiscardCard.id).angle;
        addFlyingAnim(fromSelector, '.uno-discard-pile-target', 'card', animClass, undefined, 0, topDiscardCard, targetRot);
      }

      setShowZeroRotateAnim(true);
      setTimeout(() => {
        setShowZeroRotateAnim(false);
      }, 1200);

      // 2. Flying cards swap animation
      players.forEach((_, idx) => {
        const fromSeat = getUnoSeatClass(idx, localIdx, numPlayers);
        const toSeat = getUnoSeatClass((idx + playDirection + numPlayers) % numPlayers, localIdx, numPlayers);
        const fromSel = fromSeat === 0 ? '.uno-hand-cards-list' : `.uno-seat-${fromSeat} .uno-seat-card-fan`;
        const toSel = toSeat === 0 ? '.uno-hand-cards-list' : `.uno-seat-${toSeat} .uno-seat-card-fan`;
        for (let i = 0; i < 3; i++) {
          addFlyingAnim(fromSel, toSel, 'card', 'uno-fly-swap', undefined, 200 + i * 120);
        }
      });
    } else {
      players.forEach((p, idx) => {
        const prevP = prevPlayers[idx];
        if (!prevP) return;

        const seatNum = getUnoSeatClass(idx, localIdx, numPlayers);

        // A. Card Played
        if (p.cards.length < prevP.cards.length && discardPile.length > prevDiscardPile.length) {
          if (topDiscardCard && topDiscardCard.id !== lastPlayedAnimCardIdRef.current) {
            lastPlayedAnimCardIdRef.current = topDiscardCard.id;
            const animClass = seatNum === 0 ? 'uno-fly-play-local' : 'uno-fly-play-other';
            const fromSelector = seatNum === 0 ? `.uno-seat-0` : `.uno-seat-${seatNum} .uno-seat-card-fan`;
            const targetRot = getCardOffsets(topDiscardCard.id).angle;
            addFlyingAnim(fromSelector, '.uno-discard-pile-target', 'card', animClass, undefined, 0, topDiscardCard, targetRot);

            if (topDiscardCard) {
              const val = topDiscardCard.value;
              if (val === 'reverse') {
                setReverseAnimDir(playDirection === 1 ? 'cw' : 'ccw');
                setShowReverseAnim(true);
                setTimeout(() => {
                  setShowReverseAnim(false);
                }, 1200);
              } else if (val === 'skip') {
                setShowSkipAnim(true);
                setTimeout(() => {
                  setShowSkipAnim(false);
                }, 1200);
              } else if (val === '7') {
                setShowSevenSwapAnim(true);
                setTimeout(() => {
                  setShowSevenSwapAnim(false);
                }, 1200);
              } else if (val === '0') {
                setShowZeroRotateAnim(true);
                setTimeout(() => {
                  setShowZeroRotateAnim(false);
                }, 1200);
              } else if (val === 'wild' && val !== 'wild4') {
                setShowWildAnim(true);
                setTimeout(() => {
                  setShowWildAnim(false);
                }, 1200);
              }
            }
          }
        }

        // B. Card Drawn
        if (p.cards.length > prevP.cards.length) {
          const diff = p.cards.length - prevP.cards.length;
          const animClass = seatNum === 0 ? 'uno-fly-draw-local' : 'uno-fly-draw-other';
          
          let newCards: UnoCard[] = [];
          if (seatNum === 0) {
            const prevIds = new Set(prevP.cards.filter((c): c is UnoCard => c !== null).map(c => c.id));
            newCards = p.cards.filter((c): c is UnoCard => c !== null && !prevIds.has(c.id));
          }

          for (let i = 0; i < diff; i++) {
            const cardObj = seatNum === 0 ? (newCards[i] || undefined) : undefined;
            const targetSelector = (seatNum === 0 && cardObj)
              ? `#uno-card-hand-${cardObj.id}`
              : seatNum === 0
                ? '.uno-hand-cards-list'
                : `.uno-seat-${seatNum} .uno-seat-card-fan`;
            
            let targetRot = 0;
            if (seatNum === 0) {
              const total = p.cards.length;
              const spreadAngle = Math.min(45, (total - 1) * 3);
              const angleStep = total > 1 ? spreadAngle / (total - 1) : 0;
              const index = total - diff + i;
              targetRot = index * angleStep - spreadAngle / 2;
            } else {
              const maxCards = Math.min(7, p.cards.length);
              const mid = (maxCards - 1) / 2;
              const angleStep = maxCards > 5 ? 6 : 10;
              const cardIdxInFan = (p.cards.length - diff + i) % maxCards;
              targetRot = maxCards > 1 ? (cardIdxInFan - mid) * angleStep : 0;
            }
            addFlyingAnim('.uno-draw-pile-target', targetSelector, 'card', animClass, undefined, i * 150, cardObj, targetRot);
          }
          if (diff > 1) {
            const targetSelector = seatNum === 0 ? '.uno-hand-cards-list' : `.uno-seat-${seatNum} .uno-seat-card-fan`;
            addFlyingAnim('.uno-discard-pile-target', targetSelector, 'plus-number', 'uno-fly-number-class', `+${diff}`, 100);
          }
        }
      });
    }

    prevPlayersRef.current = players;
    prevDiscardPileRef.current = discardPile;
    prevTurnIdxRef.current = turnIndex;
    prevSevenSwappingPlayerIdRef.current = sevenSwappingPlayerId;
    prevLastSevenSwapRef.current = lastSevenSwap;
    prevGameStateRef.current = gameState;
  }, [players, discardPile, turnIndex, playDirection, sevenSwappingPlayerId, lastSevenSwap, gameState, localIdx, rules.zeroRotate, addFlyingAnim, clearDealingTimeouts, localHand, isInitialDealing]);

  // Check if a card is playable
  const playableIds = useMemo(() => {
    return localHand
      .filter(card => isCardPlayable(card, currentColor, currentValue, accumulatedDrawCount, rules.stacking))
      .map(c => c.id);
  }, [localHand, currentColor, currentValue, accumulatedDrawCount, rules.stacking]);

  const isForcedToDraw = isMyTurn && gameState === 'playing' && playableIds.length === 0;

  // Click card handler
  const handleCardClick = (card: UnoCard) => {
    // 1. My Turn Play
    if (isMyTurn) {
      if (!playableIds.includes(card.id)) {
        sfx.playPass(); // Invalid play audio cue
        return;
      }
      
      if (card.color === 'wild') {
        setSelectedWildCard(card);
      } else {
        sfx.playCard();
        onPlayCard(card);
      }
      return;
    }

    // 2. Jump-in out of turn validation
    if (rules.jumpIn && !isMyTurn) {
      // Must match exactly (color & value) and cannot be wild
      const isExactMatch = card.color === currentColor && card.value === currentValue && card.color !== 'wild';
      if (isExactMatch) {
        sfx.playCard();
        onPlayCard(card, undefined, true); // Send as jumpIn = true
      } else {
        sfx.playPass();
      }
    }
  };

  // Color picker selection
  const handleChooseColor = (color: 'red' | 'yellow' | 'green' | 'blue') => {
    if (selectedWildCard) {
      sfx.playCard();
      onPlayCard(selectedWildCard, color);
      setSelectedWildCard(null);
    }
  };

  // Sound cues for state changes
  useEffect(() => {
    if (gameState === 'playing' && discardPile.length > 0) {
      sfx.playCard();
    }
  }, [discardPile.length, gameState]);

  // Determine top card of discard pile, delaying it if the top card is currently flying
  const topDiscardCard = useMemo(() => {
    if (discardPile.length === 0) return null;
    if (isInitialDealing && !showStartingDiscard) return null;
    const actualTop = discardPile[discardPile.length - 1];
    if (playingCardId && actualTop.id === playingCardId) {
      return discardPile[discardPile.length - 2] || null;
    }
    return actualTop;
  }, [discardPile, playingCardId, isInitialDealing, showStartingDiscard]);

  // Helper to compute stable rotations and offsets for discard pile stacking
  const getCardOffsets = useCallback((cardId: string) => {
    let hash = 0;
    for (let i = 0; i < cardId.length; i++) {
      hash = cardId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const angle = (Math.abs(hash) % 25) - 12; // angle between -12 and 12 deg
    const offsetX = (Math.abs(hash) % 11) - 5; // offset X between -5 and 5 px
    const offsetY = (Math.abs(hash >> 4) % 11) - 5; // offset Y between -5 and 5 px
    return { angle, offsetX, offsetY };
  }, []);

  const visibleDiscardPile = useMemo(() => {
    if (discardPile.length === 0) return [];
    if (isInitialDealing && !showStartingDiscard) return [];
    if (playingCardId) {
      const topCard = discardPile[discardPile.length - 1];
      if (topCard && topCard.id === playingCardId) {
        return discardPile.slice(0, -1);
      }
    }
    return discardPile;
  }, [discardPile, isInitialDealing, showStartingDiscard, playingCardId]);

  const visibleDiscardCards = useMemo(() => {
    return visibleDiscardPile.slice(-6);
  }, [visibleDiscardPile]);

  // Find winner
  const roundWinner = useMemo(() => {
    if (gameState === 'roundover' || gameState === 'gameover') {
      return players.find(p => p.cards.length === 0 || p.roundPoints! > 0);
    }
    return null;
  }, [players, gameState]);

  return (
    <div className="uno-container">
      {/* HUD Header */}
      <div className="uno-hud-header">
        <div className="uno-hud-left">
          <span className="uno-hud-title">
            UNO MULTIVERSE
          </span>
          {roomCode && (
            <span className="uno-hud-room-badge">
              ROOM: {roomCode}
            </span>
          )}
        </div>
        
        {/* Rules Summary Banner */}
        <div className="uno-hud-rules-banner">
          <span className={`uno-hud-rule-item ${rules.stacking ? 'enabled' : ''}`}>Stacking</span>
          <span className="uno-hud-rule-dot">•</span>
          <span className={`uno-hud-rule-item ${rules.jumpIn ? 'enabled' : ''}`}>Jump-In</span>
          <span className="uno-hud-rule-dot">•</span>
          <span className={`uno-hud-rule-item ${rules.sevenSwap ? 'enabled' : ''}`}>7-Swap</span>
          <span className="uno-hud-rule-dot">•</span>
          <span className={`uno-hud-rule-item ${rules.zeroRotate ? 'enabled' : ''}`}>0-Rotate</span>
        </div>

        <button onClick={onLeaveRoom} className="uno-hud-exit-btn">
          Exit Game
        </button>
      </div>

      {/* Main Table Arena */}
      <div className="uno-table-area" ref={tableAreaRef}>
        {/* Seating Arrangement (2-8 Players) */}
        {players.map((player, pIdx) => {
          const seatNum = getUnoSeatClass(pIdx, localIdx, players.length);
          const isTurn = turnIndex === pIdx && gameState === 'playing';
          const cardsCount = isInitialDealing
            ? (revealedCardCounts[player.id] || 0)
            : player.cards.length;
          
          // Other players challenge triggers: down to 1 card & forgotten UNO call
          const showChallenge = player.id !== playerId && cardsCount === 1 && !player.safeUno && gameState === 'playing';

          return (
            <div key={player.id} className={`uno-player-seat uno-seat-${seatNum}`}>
              {/* If it's seat 0 and it's my turn, show the YOUR TURN indicator above the avatar box */}
              {seatNum === 0 && isTurn && (
                <div className="uno-my-turn-indicator">⚡ YOUR TURN ⚡</div>
              )}

              {/* Challenge button */}
              {showChallenge && (
                <button
                  className="uno-challenge-btn"
                  onClick={() => onUnoChallenge(player.id)}
                >
                  👮 CATCH!
                </button>
              )}

              {/* Uno Call banner */}
              {cardsCount === 1 && player.safeUno && (
                <div className={`uno-call-overlay-container ${[3, 4, 5].includes(seatNum) ? 'pos-below' : 'pos-above'}`}>
                  <div className="uno-spiky-balloon-wrapper">
                    <div className="uno-spiky-balloon-bounce">
                      <svg className="uno-spiky-bubble" viewBox="0 0 100 100">
                        <polygon
                          points="50,2 63,20 80,10 75,30 98,35 80,48 90,70 70,70 75,95 55,80 50,98 40,80 25,95 30,70 10,70 20,48 2,35 25,30 20,10 37,20"
                          fill="var(--uno-red)"
                          stroke="#fff"
                          strokeWidth="3.5"
                          strokeLinejoin="miter"
                        />
                      </svg>
                      <span className="uno-call-text">UNO!</span>
                    </div>
                  </div>
                </div>
              )}

              <div className={`uno-seat-card ${isTurn ? 'active-turn' : ''} ${player.passed ? 'passed' : ''}`}>
                {skippedSeats.has(seatNum) && (
                  <div className="uno-skip-overlay">
                    <div className="uno-skip-content">
                      <span className="uno-skip-icon">🚫</span>
                      <span className="uno-skip-text">SKIPPED</span>
                    </div>
                  </div>
                )}
                <div className="uno-avatar-wrap">
                  <AvatarSVG config={player.avatar} size={36} />
                  {isTurn && (
                    <div className="uno-turn-ping" />
                  )}
                  {isTurn && rules.turnDuration > 0 && (
                    <div className="uno-timer-badge">{timeLeft}s</div>
                  )}
                </div>

                <div className="uno-player-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="uno-player-name">{player.name}</span>
                    {player.isHost && <span className="uno-host-badge">H</span>}
                  </div>
                  <div className="uno-player-stats">
                    <span className="uno-score-pill">{player.score} pts</span>
                  </div>
                </div>
              </div>

              {/* Show card fan behind the seat badge for other players */}
              {player.id !== playerId && (
                <div className="uno-seat-card-fan">
                  {cardsCount > 0 && (() => {
                    const maxCards = Math.min(7, cardsCount);
                    const mid = (maxCards - 1) / 2;
                    const angleStep = maxCards > 5 ? 6 : 10;
                    const xStep = maxCards > 5 ? 5 : 7;
                    const yStep = 1.5;

                    return Array.from({ length: maxCards }).map((_, idx) => {
                      const angle = maxCards > 1 ? (idx - mid) * angleStep : 0;
                      const xOffset = maxCards > 1 ? (idx - mid) * xStep : 0;
                      const yOffset = maxCards > 1 ? Math.abs(idx - mid) * yStep : 0;
                      return (
                        <div
                          key={idx}
                          className="uno-mini-card-back"
                          style={{
                            transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${angle}deg)`,
                            zIndex: idx,
                          }}
                        />
                      );
                    });
                  })()}
                  {cardsCount > 0 && <div className="uno-fan-count-badge">{cardsCount}</div>}
                </div>
              )}
            </div>
          );
        })}

        {/* Outer Glowing Neon Oval Table */}
        <div className={`uno-felt-table glow-${currentColor}`}>
          
          {/* Rotational Direction Ring System */}
          <div className="uno-direction-container">
            <div className={`uno-dir-ring outer ${playDirection === 1 ? 'cw' : 'ccw'}`} />
            <div className={`uno-dir-ring middle ${playDirection === 1 ? 'cw' : 'ccw'}`} />
            <div className={`uno-dir-ring inner ${playDirection === 1 ? 'cw' : 'ccw'}`} />
            <div className={`uno-dir-lines ${playDirection === 1 ? 'cw' : 'ccw'}`}>
              <div className="line line-1"></div>
              <div className="line line-2"></div>
              <div className="line line-3"></div>
              <div className="line line-4"></div>
            </div>
          </div>
          <div className="uno-direction-arrows">
            <span>{playDirection === 1 ? '↻ Clockwise' : '↺ Counter-Clockwise'}</span>
          </div>

          {/* Center Play Area (Draw Pile + Discard Pile) */}
          <div className="uno-center-decks">
            
            {/* Draw Deck Holder */}
            <div className={`uno-deck-holder uno-draw-pile-target ${isForcedToDraw ? 'force-draw-active' : ''}`}>
              {isForcedToDraw && (
                <div className="uno-deck-draw-prompt">
                  <span>DRAW!</span>
                </div>
              )}
              <div className="uno-draw-pile" onClick={isMyTurn ? onDrawCard : undefined}>
                <UnoCardComponent card={null} isBack={true} />
              </div>
            </div>

            {/* Discard Pile */}
            <div className="uno-deck-holder uno-discard-pile-target" style={{ position: 'relative' }}>
              {visibleDiscardCards.length > 0 ? (
                visibleDiscardCards.map((card, idx) => {
                  const isTop = idx === visibleDiscardCards.length - 1;
                  const { angle, offsetX, offsetY } = getCardOffsets(card.id);
                  return (
                    <div 
                      key={card.id}
                      className="uno-discard-pile-wrapper"
                      style={{
                        position: 'absolute',
                        transform: `rotate(${angle}deg) translate(${offsetX}px, ${offsetY}px)`,
                        zIndex: idx,
                      }}
                    >
                      <div className="uno-discard-pile">
                        <UnoCardComponent card={card} chosenColor={isTop ? currentColor : undefined} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>Empty</span>
              )}

              {/* Stack Penalty Badge — large, above the discard pile */}
              {accumulatedDrawCount > 0 && (
                <div className="uno-stack-badge">
                  +{accumulatedDrawCount}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 7-Swap connecting arrows */}
        {swapCoords && (
          <svg className="uno-swap-arrows-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 15 }}>
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
              </marker>
              <filter id="neon-glow-line">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <line
              x1={swapCoords.x1}
              y1={swapCoords.y1}
              x2={swapCoords.x2}
              y2={swapCoords.y2}
              stroke="#a855f7"
              strokeWidth="4"
              strokeDasharray="8, 6"
              markerStart="url(#arrow)"
              markerEnd="url(#arrow)"
              filter="url(#neon-glow-line)"
              style={{ animation: 'uno-dash-slide 1s linear infinite' }}
            />
          </svg>
        )}

        {/* Transient Flying Animations Overlay */}
        {flyingAnims.map(anim => {
          const dx = anim.endX - anim.startX;
          const dy = anim.endY - anim.startY;
          
          if (anim.type === 'card') {
            return (
              <div
                key={anim.id}
                className={`uno-flying-card ${anim.animClass}`}
                style={{
                  left: anim.startX,
                  top: anim.startY,
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  '--dr': anim.targetRotation !== undefined ? `${anim.targetRotation}deg` : '0deg',
                } as React.CSSProperties}
              >
                {anim.card ? (
                  <UnoCardComponent card={anim.card} chosenColor={anim.animClass.includes('play') ? currentColor : undefined} />
                ) : (
                  <UnoCardComponent card={null} isBack={true} />
                )}
              </div>
            );
          } else {
            return (
              <div
                key={anim.id}
                className="uno-flying-number"
                style={{
                  left: anim.startX,
                  top: anim.startY,
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                } as React.CSSProperties}
              >
                {anim.text}
              </div>
            );
          }
        })}
      </div>

      {/* Local Player Controls Area — fixed at bottom, always centred */}
      {localPlayer && (
        <div className="uno-my-hand-container">
          
          {/* Active hand cards slider list */}
          <div className="uno-hand-scroll-container">
            <div className={`uno-hand-cards-list ${isForcedToDraw ? 'hand-greyed-out' : ''} ${isInitialDealing ? 'dealing-active' : ''}`}>
              {localHand.map((card, index) => {
                const isPlayable = playableIds.includes(card.id);
                const isJustDrawn = drawnCardIds.has(card.id);
                
                // Determine if we should play the deal-in animation
                let shouldDealIn = false;
                if (isInitialDealing) {
                  handAnimatedIdsRef.current.add(card.id);
                } else if (isJustDrawn) {
                  handAnimatedIdsRef.current.add(card.id);
                } else if (!handAnimatedIdsRef.current.has(card.id)) {
                  shouldDealIn = true;
                  handAnimatedIdsRef.current.add(card.id);
                }

                // Fan out positions (spaced out horizontally wider with premium flatter fan arc)
                const total = localHand.length;
                const spreadAngle = Math.min(45, (total - 1) * 3);
                const angleStep = total > 1 ? spreadAngle / (total - 1) : 0;
                const rotation = index * angleStep - spreadAngle / 2;
                
                const translationX = (index - (total - 1) / 2) * Math.min(70, 800 / total);
                const translationY = Math.abs(rotation) * 0.4;

                const isHidden = isInitialDealing && !revealedCardIds.has(card.id);

                return (
                  <div
                    key={card.id}
                    id={`uno-card-hand-${card.id}`}
                    className={`uno-my-card-wrapper ${isMyTurn && isPlayable ? 'playable' : 'unplayable'} ${isJustDrawn ? 'uno-card-just-drawn' : ''} ${shouldDealIn ? 'uno-card-deal-in' : ''}`}
                    style={{
                      transform: `translateX(${translationX}px) translateY(${translationY}px) rotate(${rotation}deg)`,
                      zIndex: index + 10,
                      animationDelay: isJustDrawn ? '0s' : `${index * 0.05}s`,
                      opacity: isHidden ? 0 : 1,
                      pointerEvents: isHidden ? 'none' : 'auto'
                    }}
                  >
                    <UnoCardComponent
                      card={card}
                      onClick={() => handleCardClick(card)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Row Buttons — Draw is redundant, done by clicking deck, no Pass button */}
          <div className="uno-action-controls">
            {/* UNO Call — shown when you have 2 cards (and can play one) or 1 card and haven't called */}
            {((isMyTurn && localHand.length === 2 && playableIds.length > 0 && !localPlayer.safeUno) ||
              (localHand.length === 1 && !localPlayer.safeUno)) && (
              <button
                className="uno-btn uno-btn-danger uno-btn-pulse"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onUnoCall();
                }}
              >
                📣 UNO!
              </button>
            )}
          </div>
        </div>
      )}

      {/* OVERLAYS */}

      {/* 1. Wild Color Chooser Wheel */}
      {selectedWildCard && (
        <div className="uno-overlay-pane">
          <div className="uno-modal">
            <h3 className="uno-modal-title">CHOOSE A COLOR</h3>
            <p className="uno-modal-desc">Select a color to set the active suit color.</p>
            
            <div className="uno-color-wheel">
              <div className="uno-color-quadrant red" onClick={() => handleChooseColor('red')}>Red</div>
              <div className="uno-color-quadrant yellow" onClick={() => handleChooseColor('yellow')}>Yellow</div>
              <div className="uno-color-quadrant blue" onClick={() => handleChooseColor('blue')}>Blue</div>
              <div className="uno-color-quadrant green" onClick={() => handleChooseColor('green')}>Green</div>
            </div>
            
            <button
              onClick={() => setSelectedWildCard(null)}
              className="uno-btn-secondary"
              style={{ margin: '24px auto 0 auto' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2. 7 Swap Target Selector */}
      {sevenSwappingPlayerId === playerId && (
        <div className="uno-overlay-pane">
          <div className="uno-modal">
            <h3 className="uno-modal-title font-bold color-swap-gradient">
              🤝 7-SWAP TARGET!
            </h3>
            <p className="uno-modal-desc">You played a 7! Select a player to swap your entire hand deck with.</p>
            
            <div className="uno-swap-grid">
              {players
                .filter(p => p.id !== playerId)
                .map(p => (
                  <div
                    key={p.id}
                    className="uno-swap-player-item"
                    onClick={() => onSwapHand(p.id)}
                  >
                    <AvatarSVG config={p.avatar} size={28} />
                    <span className="uno-swap-player-name">{p.name} ({p.cards.length} cards)</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Round Over & Game Over Summary modal */}
      {(gameState === 'roundover' || gameState === 'gameover') && (
        <div className="uno-overlay-pane">
          <div className="uno-modal">
            <h2 className="uno-modal-title-glow">
              {gameState === 'gameover' ? 'GAME OVER!' : 'ROUND OVER!'}
            </h2>
            
            <div className="uno-modal-winner-card">
              {roundWinner && (
                <>
                  <AvatarSVG config={roundWinner.avatar} size={54} />
                  <span className="uno-modal-winner-name">
                    🎉 {roundWinner.name} Won! 🎉
                  </span>
                  <span className="uno-modal-winner-points">
                    Points Earned: +{roundWinner.roundPoints || 0} pts
                  </span>
                </>
              )}
            </div>

            {/* Standings scoreboard list */}
            <div className="uno-modal-standings">
              {players
                .sort((a, b) => b.score - a.score)
                .map((p, rankIdx) => (
                  <div key={p.id} className="uno-modal-standings-row">
                    <span className="uno-modal-standings-rank">{rankIdx + 1}.</span>
                    <span className="uno-modal-standings-name">{p.name}</span>
                    <span className="uno-modal-standings-score">{p.score} pts</span>
                  </div>
                ))}
            </div>

            <div className="uno-modal-actions">
              {isHost && (
                <button
                  onClick={onRestartGame}
                  className="uno-btn"
                >
                  {gameState === 'gameover' ? 'Play Again' : 'Next Round'}
                </button>
              )}
              <button
                onClick={onLeaveRoom}
                className="uno-btn-secondary"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Reverse Card Play Animation Overlay */}
      {showReverseAnim && (
        <div className={`uno-reverse-overlay glow-${currentColor} ${reverseAnimDir}`}>
          <div className="uno-reverse-arrow">
            <svg viewBox="0 0 100 100" width="160" height="160">
              <path
                d="M 50 15 A 35 35 0 1 1 15 50"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 15 50 L 5 40 M 15 50 L 25 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </svg>
            <div className="uno-reverse-text">REVERSE!</div>
          </div>
        </div>
      )}

      {/* 5. Skip Play Animation Overlay */}
      {showSkipAnim && (
        <div className={`uno-special-overlay skip-overlay glow-${currentColor}`}>
          <div className="uno-special-content">
            <span className="uno-special-icon">🚫</span>
            <div className="uno-special-text">SKIPPED!</div>
          </div>
        </div>
      )}

      {/* 6. Wildcard Play Animation Overlay */}
      {showWildAnim && (
        <div className="uno-special-overlay wildcard-burst">
          <div className="uno-special-content">
            <span className="uno-special-icon">🌈</span>
            <div className="uno-special-text">WILD CARD!</div>
          </div>
        </div>
      )}

      {/* 7. 7-Swap Play Animation Overlay */}
      {showSevenSwapAnim && (
        <div className={`uno-special-overlay swap-overlay glow-${currentColor}`}>
          <div className="uno-special-content">
            <span className="uno-special-icon">🤝</span>
            <div className="uno-special-text">HAND SWAP!</div>
          </div>
        </div>
      )}

      {/* 8. 0-Rotate Play Animation Overlay */}
      {showZeroRotateAnim && (
        <div className={`uno-special-overlay rotate-overlay glow-${currentColor}`}>
          <div className="uno-special-content">
            <span className="uno-special-icon">🔄</span>
            <div className="uno-special-text">BOARD ROTATE!</div>
          </div>
        </div>
      )}
    </div>
  );
};
