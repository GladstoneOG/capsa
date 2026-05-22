import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { type Card, type Combination, checkCombination, canBeat, contains3Diamonds, sortCards, getValidPlays, RANK_ORDER, SUIT_ORDER } from '../utils/gameLogic';
import { AvatarSVG } from './AvatarCreator';
import { sfx } from '../utils/audio';

interface Player {
  id: string;
  name: string;
  avatar: any;
  isHost: boolean;
  isBot: boolean;
  cards: (Card | null)[];
  passed: boolean;
  score: number;
  lastPlay: Card[] | null;
  roundPoints?: number;
  isReady?: boolean;
  finishRank?: number;
}

interface GameTableProps {
  playerId: string;
  players: Player[];
  turnIndex: number;
  activePlay: Combination | null;
  lastPlayerPlayedId: string | null;
  gameState: 'lobby' | 'playing' | 'roundover' | 'gameover';
  rules: {
    pointsToWin: number;
    turnDuration: number;
    enableBombsSingle: boolean;
    enableBombsPair: boolean;
  };
  onPlayCards: (cards: Card[]) => void;
  onPass: () => void;
  onRestartGame: () => void;
  onLeaveRoom: () => void;
  isSinglePlayer: boolean;
  roomCode?: string;
  isHost: boolean;
}

function triggerConfetti(playerId: string) {
  const element = document.getElementById(`avatar-seat-${playerId}`);
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;

  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle-burst';
    
    const size = (5 + Math.random() * 6) + 'px';
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    p.style.position = 'absolute';
    p.style.left = `${startX}px`;
    p.style.top = `${startY}px`;
    p.style.backgroundColor = color;
    p.style.width = size;
    p.style.height = size;
    
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 70;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    
    p.style.setProperty('--x', `${x}px`);
    p.style.setProperty('--y', `${y}px`);
    p.style.animation = `confetti-burst ${1 + Math.random() * 1}s cubic-bezier(0.1, 0.8, 0.25, 1) forwards`;
    
    if (Math.random() > 0.5) {
      p.style.borderRadius = '50%';
    }
    
    container.appendChild(p);
  }

  setTimeout(() => {
    container.remove();
  }, 2500);
}

function getComboDescription(combo: Combination | null): string {
  if (!combo || combo.type === 'invalid' || !combo.cards || combo.cards.length === 0) return '';
  const suitSymbolsMap: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
  const sorted = [...combo.cards].sort((a, b) => {
    const rDiff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (rDiff !== 0) return rDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
  const highestCard = sorted[sorted.length - 1];

  switch (combo.type) {
    case 'single':
      return `Single ${highestCard.rank}${suitSymbolsMap[highestCard.suit]}`;
    case 'pair':
      return `Pair ${highestCard.rank} (${suitSymbolsMap[highestCard.suit]} High)`;
    case 'tris':
      return `Tris ${highestCard.rank}`;
    case 'straight':
      return `Straight ${highestCard.rank} High (${suitSymbolsMap[highestCard.suit]})`;
    case 'flush':
      return `Flush (${suitSymbolsMap[highestCard.suit]})`;
    case 'fullhouse': {
      const r0 = sorted[0].rank;
      const r2 = sorted[2].rank;
      const tripleRank = (r0 === r2) ? r0 : sorted[4].rank;
      return `Full House of ${tripleRank}s`;
    }
    case 'bomber': {
      const r0 = sorted[0].rank;
      const r1 = sorted[1].rank;
      const quadRank = (r0 === r1) ? r0 : sorted[4].rank;
      return `Bomber of ${quadRank}s`;
    }
    case 'straightflush':
      return `Straight Flush ${highestCard.rank} High (${suitSymbolsMap[highestCard.suit]})`;
    default:
      return '';
  }
}

function getPlayerSeat(playerIdx: number, localIdx: number, numPlayers: number): number {
  if (localIdx === -1) return 0;
  if (numPlayers === 4) {
    return (playerIdx - localIdx + 4) % 4;
  } else if (numPlayers === 3) {
    const diff = (playerIdx - localIdx + 3) % 3;
    return diff === 2 ? 3 : diff;
  } else if (numPlayers === 2) {
    return (playerIdx - localIdx + 2) % 2 === 0 ? 0 : 2;
  }
  return 0;
}

export const GameTable: React.FC<GameTableProps> = ({
  playerId,
  players,
  turnIndex,
  activePlay,
  lastPlayerPlayedId,
  gameState,
  rules,
  onPlayCards,
  onPass,
  onRestartGame,
  onLeaveRoom,
  isSinglePlayer: _isSinglePlayer,
  roomCode,
  isHost,
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [localHand, setLocalHand] = useState<Card[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(rules.turnDuration);
  const [soundMuted, setSoundMuted] = useState<boolean>(sfx.getMuted());
  const [handKey, setHandKey] = useState<number>(0);

  // Drag and drop states & refs
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const dragStartIndexRef = useRef<number | null>(null);
  const dragCurrentIndexRef = useRef<number | null>(null);
  const dragHasMovedRef = useRef<boolean>(false);
  const dragStartCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragRectsRef = useRef<DOMRect[] | null>(null);
  const dragWrappersRef = useRef<NodeListOf<HTMLDivElement> | null>(null);

  const [hasActionedThisTurn, setHasActionedThisTurn] = useState<boolean>(false);
  useEffect(() => {
    setHasActionedThisTurn(false);
  }, [turnIndex, activePlay]);

  // Refs to capture freshest hand/selected states without re-binding event listeners
  const localHandRef = useRef<Card[]>(localHand);
  const selectedCardIdsRef = useRef<string[]>(selectedCardIds);
  useEffect(() => {
    localHandRef.current = localHand;
  }, [localHand]);
  useEffect(() => {
    selectedCardIdsRef.current = selectedCardIds;
  }, [selectedCardIds]);

  const [animateDeal, setAnimateDeal] = useState<boolean>(false);
  const [arrowRotation, setArrowRotation] = useState<number>(180);

  // Set animateDeal to true when handKey changes
  useEffect(() => {
    setAnimateDeal(true);
    const timer = setTimeout(() => {
      setAnimateDeal(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [handKey]);

  // Generate deterministic random-like offsets for up to 52 cards (decorations)
  const scatteredCardStyles = useMemo(() => {
    const styles = [];
    for (let i = 0; i < 52; i++) {
      const seedX = Math.sin(i + 1) * 10000;
      const seedY = Math.cos(i + 1) * 10000;
      const seedR = Math.sin(i + 2) * 10000;
      
      const randX = seedX - Math.floor(seedX);
      const randY = seedY - Math.floor(seedY);
      const randR = seedR - Math.floor(seedR);
      
      const x = (randX * 2 - 1) * 70;
      const y = (randY * 2 - 1) * 30;
      const r = (randR * 2 - 1) * 45;
      
      styles.push({
        transform: `translate(${x}px, ${y}px) rotate(${r}deg)`,
      });
    }
    return styles;
  }, []);

  // Calculate total played cards in the current round
  const totalPlayedCards = useMemo(() => {
    if (gameState === 'lobby') return 0;
    const remainingCardsCount = players.reduce((sum, p) => sum + (p.cards ? p.cards.length : 0), 0);
    return Math.max(0, (players.length * 13) - remainingCardsCount);
  }, [players, gameState]);

  // Scattered card count excludes the active play in the middle
  const scatteredCardCount = useMemo(() => {
    const activeCardsCount = activePlay?.cards?.length || 0;
    return Math.max(0, totalPlayedCards - activeCardsCount);
  }, [totalPlayedCards, activePlay]);

  // Play history for displaying previous plays
  const [playHistory, setPlayHistory] = useState<{ playerName: string; cards: Card[] }[]>([]);
  const prevPlaysListRef = useRef<HTMLDivElement | null>(null);

  const timerRef = useRef<any>(null);

  // Keep track of players who have already finished in this game round
  const finishedPlayerIdsRef = useRef<Set<string>>(new Set());

  // Watch players list to detect when a player runs out of cards
  useEffect(() => {
    // If game state resets to lobby or starts playing, reset finished tracking
    const isLobby = gameState === 'lobby';
    const isNewGame = gameState === 'playing' && players.every(p => p.cards.length === 13);
    if (isLobby || isNewGame) {
      finishedPlayerIdsRef.current.clear();
      return;
    }

    if (gameState === 'playing' || gameState === 'roundover') {
      players.forEach(p => {
        // If player has 0 cards and is not yet in the finished set
        if (p.cards.length === 0 && p.finishRank !== undefined && !finishedPlayerIdsRef.current.has(p.id)) {
          finishedPlayerIdsRef.current.add(p.id);
          
          // Trigger celebration!
          triggerConfetti(p.id);
          
          // Play celebration SFX
          if (p.id === playerId) {
            sfx.playWin();
          } else {
            sfx.playFinish();
          }
        }
      });
    }
  }, [players, gameState, playerId]);

  // Find local player and index
  const localPlayerIndex = players.findIndex((p) => p.id === playerId);
  const localPlayer = players[localPlayerIndex];
  const isMyTurn = turnIndex === localPlayerIndex && gameState === 'playing';

  // Synchronize local hand when cards are dealt or changed
  useEffect(() => {
    if (localPlayer && localPlayer.cards) {
      // Filter out null values (in multiplayer, other players have nulls, but local player has real cards)
      const realCards = localPlayer.cards.filter((c): c is Card => c !== null);
      
      // Only overwrite if card IDs are completely different (we want to preserve manual order)
      const currentIds = localHand.map(c => c.id).join(',');
      const newIds = realCards.map(c => c.id).join(',');
      
      if (currentIds !== newIds) {
        // If we played cards, we just want to remove them from our manual order
        const stillPresent = localHand.filter(lc => realCards.some(rc => rc.id === lc.id));
        const newlyAdded = realCards.filter(rc => !localHand.some(lc => lc.id === rc.id));
        setLocalHand([...stillPresent, ...newlyAdded]);
        
        // Only increment handKey if it's a completely new deal
        const isNewDeal = realCards.length === 13 && !realCards.some(rc => localHand.some(lc => lc.id === rc.id));
        if (isNewDeal) {
          setHandKey(prev => prev + 1);
        }
      }
    }
  }, [localPlayer?.cards]);

  // Track trick play history
  useEffect(() => {
    if (activePlay && activePlay.cards && activePlay.cards.length > 0) {
      const playerWhoPlayed = players.find(p => p.id === lastPlayerPlayedId);
      const playerName = playerWhoPlayed ? playerWhoPlayed.name : 'Unknown';
      
      setPlayHistory(prev => {
        const lastPlay = prev[prev.length - 1];
        const isDuplicate = lastPlay && 
          lastPlay.playerName === playerName && 
          lastPlay.cards.length === activePlay.cards.length &&
          lastPlay.cards.every((c, idx) => c.id === activePlay.cards[idx].id);
        
        if (isDuplicate) return prev;
        return [...prev, { playerName, cards: activePlay.cards }].slice(-20);
      });
    } else if (!activePlay) {
      setPlayHistory([]);
    }
  }, [activePlay, lastPlayerPlayedId, players]);

  // Scroll to bottom of previous plays without scrollIntoView window side-effects
  useEffect(() => {
    if (prevPlaysListRef.current) {
      prevPlaysListRef.current.scrollTop = prevPlaysListRef.current.scrollHeight;
    }
  }, [playHistory]);

  // Handle sfx for card deals, card plays, and passes
  useEffect(() => {
    if (gameState === 'playing') {
      // Sound cue for card played by anyone
      const activeCardsCount = activePlay?.cards?.length || 0;
      if (activeCardsCount > 0) {
        sfx.playCard();
      }
    }
  }, [activePlay]);

  // Monitor passes to play pass SFX
  const prevPassesRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    players.forEach(p => {
      const wasPassed = prevPassesRef.current[p.id] || false;
      if (p.passed && !wasPassed) {
        sfx.playPass();
      }
      prevPassesRef.current[p.id] = p.passed;
    });
  }, [players]);

  // Sound cues on game finish
  useEffect(() => {
    if (gameState === 'roundover') {
      const localWinner = players.find(p => p.cards.length === 0);
      if (localWinner?.id === playerId) {
        sfx.playWin();
      } else {
        sfx.playLose();
      }
    }
  }, [gameState]);

  // Turn Timer
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
  }, [turnIndex, gameState, isMyTurn]);

  // Toggle sound
  const toggleSound = () => {
    const muted = !soundMuted;
    sfx.setMuted(muted);
    setSoundMuted(muted);
  };

  // Card select/toggle
  const handleCardClick = (card: Card) => {
    setSelectedCardIds((prev) =>
      prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
    );
  };

  // Pointer drag and drop reordering handlers
  const handleWindowPointerMoveRef = useRef<(e: PointerEvent) => void>(undefined);
  const handleWindowPointerUpRef = useRef<() => void>(undefined);

  const onWindowPointerMove = useCallback((e: PointerEvent) => {
    if (handleWindowPointerMoveRef.current) {
      handleWindowPointerMoveRef.current(e);
    }
  }, []);

  const onWindowPointerUp = useCallback(() => {
    if (handleWindowPointerUpRef.current) {
      handleWindowPointerUpRef.current();
    }
  }, []);

  useEffect(() => {
    handleWindowPointerMoveRef.current = (e: PointerEvent) => {
      const startIndex = dragStartIndexRef.current;
      if (startIndex === null) return;

      const dx = e.clientX - dragStartCoordsRef.current.x;
      const dy = e.clientY - dragStartCoordsRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const currentHand = localHandRef.current;
      const clickedCard = currentHand[startIndex];
      if (!clickedCard) return;

      if (!dragHasMovedRef.current && distance > 8) {
        dragHasMovedRef.current = true;
        setIsDragging(true);
        setDraggedCardId(clickedCard.id);
      }

      if (!dragHasMovedRef.current) return;

      const wrappers = dragWrappersRef.current;
      const rects = dragRectsRef.current;
      if (!wrappers || !rects) return;

      // Move the dragged element directly in the DOM
      const draggedEl = wrappers[startIndex];
      if (draggedEl) {
        draggedEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.08) translateY(-15px)`;
        draggedEl.style.transition = 'none';
        draggedEl.style.zIndex = '1000';
      }

      // Compute spacing step dynamically
      let step = 50;
      if (rects.length > 1) {
        step = rects[1].left - rects[0].left;
      }

      // Calculate target slot index
      const targetIndex = Math.max(0, Math.min(rects.length - 1, startIndex + Math.round(dx / step)));
      dragCurrentIndexRef.current = targetIndex;

      // Apply translateX shifts to sibling cards to make room
      wrappers.forEach((el, idx) => {
        if (idx === startIndex) return;
        
        let translateX = 0;
        if (startIndex < targetIndex && idx > startIndex && idx <= targetIndex) {
          // Dragging right: items in between shift left
          translateX = -step;
        } else if (startIndex > targetIndex && idx >= targetIndex && idx < startIndex) {
          // Dragging left: items in between shift right
          translateX = step;
        }
        
        el.style.transform = translateX ? `translateX(${translateX}px)` : '';
        el.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
      });
    };

    handleWindowPointerUpRef.current = () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);

      const startIndex = dragStartIndexRef.current;
      const targetIndex = dragCurrentIndexRef.current;
      const hasMoved = dragHasMovedRef.current;

      const wrappers = dragWrappersRef.current;
      if (wrappers) {
        wrappers.forEach(el => {
          el.style.transform = '';
          el.style.transition = '';
          el.style.zIndex = '';
        });
      }
      dragWrappersRef.current = null;
      dragRectsRef.current = null;

      setIsDragging(false);
      setDraggedCardId(null);
      
      if (!hasMoved && startIndex !== null) {
        const currentHand = localHandRef.current;
        const card = currentHand[startIndex];
        if (card) {
          handleCardClick(card);
        }
      } else if (hasMoved && startIndex !== null && targetIndex !== null && startIndex !== targetIndex) {
        const currentHand = localHandRef.current;
        const newHand = [...currentHand];
        const [movedCard] = newHand.splice(startIndex, 1);
        newHand.splice(targetIndex, 0, movedCard);
        setLocalHand(newHand);
      }
      
      dragStartIndexRef.current = null;
      dragCurrentIndexRef.current = null;
      dragHasMovedRef.current = false;
    };
  });

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return; // Left click / touch only
    
    dragStartIndexRef.current = index;
    dragCurrentIndexRef.current = index;
    dragHasMovedRef.current = false;
    dragStartCoordsRef.current = { x: e.clientX, y: e.clientY };
    
    // Cache wrappers and rects
    const wrappers = document.querySelectorAll('.player-hand-fan .fanned-card-wrapper') as NodeListOf<HTMLDivElement>;
    dragWrappersRef.current = wrappers;
    dragRectsRef.current = Array.from(wrappers).map(w => w.getBoundingClientRect());
    
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [onWindowPointerMove, onWindowPointerUp]);

  // Dynamic shortest path turn indicator arrow rotation
  useEffect(() => {
    if (gameState !== 'playing' || localPlayerIndex === -1) return;
    
    const seat = getPlayerSeat(turnIndex, localPlayerIndex, players.length);
    
    // Seat angle mapping:
    // Seat 0 (South): 180deg
    // Seat 1 (West): 270deg
    // Seat 2 (North): 360deg
    // Seat 3 (East): 450deg
    const seatAngles: Record<number, number> = {
      0: 180,
      1: 270,
      2: 360,
      3: 450,
    };
    
    const targetAngle = seatAngles[seat];
    if (targetAngle === undefined) return;
    
    let diff = (targetAngle - arrowRotation) % 360;
    
    if (diff > 180) {
      diff -= 360;
    } else if (diff < -180) {
      diff += 360;
    }
    
    setArrowRotation(prev => prev + diff);
  }, [turnIndex, gameState, players, localPlayerIndex]);

  // Sort local hand
  const handleSort = (method: 'rank' | 'suit') => {
    const sorted = sortCards(localHand, method);
    setLocalHand(sorted);
  };

  // Removed handleGroupSelected (grouping is done manually by dragging)

  // Determine current selected combination
  const selectedCards = localHand.filter((c) => selectedCardIds.includes(c.id));
  const selectedCombo = checkCombination(selectedCards);

  // Validate play
  const isFirstPlayOfRound = players.every(p => p.cards.length === 13) && !activePlay;

  // Determine if there are valid plays possible for the player
  const validPlaysForMe = isMyTurn && activePlay && localPlayer
    ? getValidPlays(localHand, activePlay, isFirstPlayOfRound, {
        enableBombsSingle: rules.enableBombsSingle,
        enableBombsPair: rules.enableBombsPair,
      })
    : [];
  const hasNoValidPlays = isMyTurn && activePlay && !localPlayer?.passed && validPlaysForMe.length === 0;
  
  let canPlaySelected = false;
  let validationMessage = '';

  if (isMyTurn && selectedCards.length > 0) {
    if (selectedCombo.type === 'invalid') {
      validationMessage = 'Invalid Card Combination';
    } else {
      // Must contain 3 Diamonds if first play of round
      if (isFirstPlayOfRound && !contains3Diamonds(selectedCards)) {
        validationMessage = 'First play of round must contain 3♦';
      } else {
        // Must beat active play
        const ruleSettings = {
          enableBombsSingle: rules.enableBombsSingle,
          enableBombsPair: rules.enableBombsPair,
        };
        if (canBeat(selectedCombo, activePlay, ruleSettings)) {
          canPlaySelected = true;
          validationMessage = `Play: ${selectedCombo.type.toUpperCase()}`;
        } else {
          validationMessage = activePlay 
            ? 'Must beat the cards on the table' 
            : 'Valid combination';
          if (!activePlay) {
            canPlaySelected = true;
          }
        }
      }
    }
  }

  const handlePlayClick = () => {
    if (canPlaySelected && !hasActionedThisTurn) {
      setHasActionedThisTurn(true);
      onPlayCards(selectedCards);
      setSelectedCardIds([]);
    }
  };

  const handlePassClick = () => {
    if (isMyTurn && !hasActionedThisTurn) {
      setHasActionedThisTurn(true);
      onPass();
      setSelectedCardIds([]);
    }
  };

  // Map players to seats around the table
  const getSeatedPlayers = () => {
    if (localPlayerIndex === -1) return [];
    const seated = [];
    const n = players.length;

    if (n === 4) {
      seated.push({ seat: 0, player: players[localPlayerIndex], label: 'South (You)' });
      seated.push({ seat: 1, player: players[(localPlayerIndex + 1) % 4], label: 'West' });
      seated.push({ seat: 2, player: players[(localPlayerIndex + 2) % 4], label: 'North' });
      seated.push({ seat: 3, player: players[(localPlayerIndex + 3) % 4], label: 'East' });
    } else if (n === 3) {
      seated.push({ seat: 0, player: players[localPlayerIndex], label: 'South (You)' });
      seated.push({ seat: 1, player: players[(localPlayerIndex + 1) % 3], label: 'West' });
      seated.push({ seat: 3, player: players[(localPlayerIndex + 2) % 3], label: 'East' });
    } else if (n === 2) {
      seated.push({ seat: 0, player: players[localPlayerIndex], label: 'South (You)' });
      seated.push({ seat: 2, player: players[(localPlayerIndex + 1) % 2], label: 'North' });
    }

    return seated;
  };

  const suitSymbols: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
  const suitNames: Record<string, string> = { D: 'red-suit', C: 'black-suit', H: 'red-suit', S: 'black-suit' };

  return (
    <div className="game-layout">
      {/* Top Header Bar */}
      <div className="game-top-bar">
        <div className="game-title-info">
          <h2>Capsa Banting</h2>
          {roomCode && <div className="lobby-code-badge" style={{ fontSize: '1rem', padding: '0.2rem 0.6rem' }}>Room: {roomCode}</div>}
          <div className="game-points-target">Target: {rules.pointsToWin} pts</div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="sound-toggle-btn" onClick={toggleSound} title={soundMuted ? 'Unmute SFX' : 'Mute SFX'}>
            {soundMuted ? '🔇' : '🔊'}
          </button>
          <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={onLeaveRoom}>
            Exit Table
          </button>
        </div>
      </div>

      {/* 3D Felt Card Table */}
      <div className="table-container">
        <div className="felt-table">
          {/* Seats around the table */}
          {getSeatedPlayers().map(({ seat, player }) => {
            const isPlayerTurn = turnIndex === players.findIndex((p) => p.id === player.id);
            const cardCount = player.cards.length;

            return (
              <div key={player.id} className={`seat seat-${seat}`}>
                {/* Active Indicator Ring */}
                <div 
                  id={`avatar-seat-${player.id}`}
                  className={`player-game-avatar ${isPlayerTurn ? 'active-turn' : ''} ${player.passed ? 'has-passed' : ''}`}
                >
                  <AvatarSVG config={player.avatar} size={75} />

                  {/* Medal Overlay */}
                  {player.finishRank !== undefined && player.finishRank >= 1 && player.finishRank <= 3 && (
                    <div className={`finish-medal medal-rank-${player.finishRank}`} title={`Finished ${player.finishRank === 1 ? '1st' : player.finishRank === 2 ? '2nd' : '3rd'}`}>
                      {player.finishRank === 1 ? '🥇' : player.finishRank === 2 ? '🥈' : '🥉'}
                    </div>
                  )}
                  
                  {isPlayerTurn && rules.turnDuration > 0 && (
                    <div className="turn-timer-ring">
                      {player.id === playerId && <div className="timer-badge" style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', background: '#fbbf24', color: '#1e1b4b', padding: '0 4px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>{timeLeft}s</div>}
                    </div>
                  )}

                  {player.passed && <div className="pass-indicator">PASS</div>}

                  <span className="seat-name">{player.name}</span>
                  <span className="seat-score">{player.score} pts</span>
                  
                  {/* Host badge */}
                  {player.isHost && (
                    <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#fbbf24', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: '#1e1b4b', fontWeight: 'bold' }}>H</div>
                  )}
                </div>

                {/* Show card count fan if not the local user */}
                {player.id !== playerId && (
                  <div className="seat-card-fan">
                    {(() => {
                      const maxCards = cardCount;
                      const mid = (maxCards - 1) / 2;
                      const angleStep = maxCards > 8 ? 5 : maxCards > 5 ? 7 : 10;
                      const xStep = maxCards > 8 ? 4 : maxCards > 5 ? 6 : 8;
                      const yStep = maxCards > 8 ? 1 : maxCards > 5 ? 1.5 : 2;

                      return Array.from({ length: maxCards }).map((_, idx) => {
                        const angle = maxCards > 1 ? (idx - mid) * angleStep : 0;
                        const xOffset = maxCards > 1 ? (idx - mid) * xStep : 0;
                        const yOffset = maxCards > 1 ? Math.abs(idx - mid) * yStep : 0;
                        return (
                          <div
                            key={idx}
                            className="mini-card-back"
                            style={{
                              transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${angle}deg)`,
                              zIndex: idx,
                            }}
                          />
                        );
                      });
                    })()}
                    <div className="mini-card-count-badge">{cardCount}</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Scattered Played Cards Pile (Decoration) */}
          {scatteredCardCount > 0 && (
            <div className="scattered-cards-container">
              {Array.from({ length: Math.min(scatteredCardCount, 52) }).map((_, idx) => (
                <div
                  key={idx}
                  className="scattered-card"
                  style={scatteredCardStyles[idx]}
                />
              ))}
            </div>
          )}

          {/* Cards Played in the Center */}
          <div className="table-center">
            <div className={`table-cards-pool ${!activePlay ? 'empty' : ''}`}>
              {!activePlay && isFirstPlayOfRound && (
                <div className="first-play-instruction">Play cards containing 3♦ to start</div>
              )}
              {(() => {
                if (!activePlay) return null;
                const seatedPlayers = getSeatedPlayers();
                const seatedPlay = seatedPlayers.find(sp => sp.player.id === lastPlayerPlayedId);
                const relativeSeat = seatedPlay ? seatedPlay.seat : 0;

                const throwOffsets: Record<number, { x: string; y: string }> = {
                  0: { x: '0px', y: '250px' },  // South
                  1: { x: '-350px', y: '0px' }, // West
                  2: { x: '0px', y: '-250px' }, // North
                  3: { x: '350px', y: '0px' },  // East
                };
                const throwOffset = throwOffsets[relativeSeat] || { x: '0px', y: '250px' };

                return activePlay.cards.map((c, i) => {
                  const cardsCount = activePlay.cards.length;
                  const mid = (cardsCount - 1) / 2;
                  const rotation = cardsCount > 1 ? (i - mid) * 8 : 0;
                  const xOffset = cardsCount > 1 ? (i - mid) * 15 : 0;
                  const yOffset = cardsCount > 1 ? Math.abs(i - mid) * 2 : 0;

                  return (
                    <div
                      key={c.id || i}
                      className={`playing-card ${suitNames[c.suit]}`}
                      style={{
                        cursor: 'default',
                        transform: `translateX(${xOffset}px) translateY(${yOffset}px) rotate(${rotation}deg)`,
                        animationDelay: `${i * 75}ms`,
                        '--throw-x': throwOffset.x,
                        '--throw-y': throwOffset.y,
                      } as React.CSSProperties}
                    >
                      <div className="card-top-left">
                        <span className="card-value">{c.rank}</span>
                        <span className="card-suit-small">{suitSymbols[c.suit]}</span>
                      </div>
                      <div className="card-suit-large">{suitSymbols[c.suit]}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Previous Plays Panel (Left Side of Table) */}
          {playHistory.length > 1 && (
            <div className="previous-plays-panel">
              <div className="previous-plays-title">Previous Plays</div>
              <div className="previous-plays-list" ref={prevPlaysListRef}>
                {playHistory.slice(0, -1).map((play, playIdx) => (
                  <div key={playIdx} className="previous-play-row">
                    <span className="prev-play-name">{play.playerName}:</span>
                    <div className="prev-play-cards">
                      {play.cards.map((c, cardIdx) => (
                        <div key={c.id || cardIdx} className={`prev-card-mini ${suitNames[c.suit]}`}>
                          {c.rank}{suitSymbols[c.suit]}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last Play Panel (Right Side of Table) */}
          {activePlay && (
            <div className="last-play-panel">
              <div className="last-play-title">Last Play</div>
              <div className="last-play-player">
                By: <span>{players.find((p) => p.id === lastPlayerPlayedId)?.name || 'Unknown'}</span>
              </div>
              <div className="last-play-combo">
                {getComboDescription(activePlay)}
              </div>
            </div>
          )}

          {/* Active Turn Indicator Arrow */}
          {gameState === 'playing' && (
            <div 
              className="table-turn-arrow"
              style={{
                transform: `translate(-50%, -50%) rotate(${arrowRotation}deg) translateY(-100px)`
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L12 20M12 4L6 10M12 4L18 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* User Hand and Controls */}
      <div className="hand-controls-container">
        {/* Card scrolling container */}
        <div className="hand-scroller">
          <div className={`player-hand-fan ${animateDeal ? 'deal-animate' : ''} ${isDragging ? 'is-dragging-active' : ''}`} key={handKey}>
            {localHand.map((card, index) => {
              const isSelected = selectedCardIds.includes(card.id);
              const isCardDragging = draggedCardId === card.id;
              return (
                <div 
                  key={card.id} 
                  className={`fanned-card-wrapper ${isCardDragging ? 'dragging' : ''}`}
                  data-index={index}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  style={{ 
                    touchAction: 'none',
                    animationDelay: `${index * 30}ms`
                  }}
                >
                  <div
                    className={`playing-card ${suitNames[card.suit]} ${isSelected ? `selected ${isMyTurn ? (canPlaySelected ? 'playable' : 'unplayable') : 'not-turn'}` : ''} ${!isMyTurn ? 'unselectable' : ''}`}
                  >
                    <div className="card-top-left">
                      <span className="card-value">{card.rank}</span>
                      <span className="card-suit-small">{suitSymbols[card.suit]}</span>
                    </div>
                    <div className="card-suit-large">{suitSymbols[card.suit]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Organizer Utilities (Sort, shift, combos) */}
        <div className="hand-utilities-row">
          <div className="hand-organizer-buttons">
            <button className="btn-utility" onClick={() => handleSort('rank')}>Sort Rank</button>
            <button className="btn-utility" onClick={() => handleSort('suit')}>Sort Suit</button>
          </div>

          <div className="selected-cards-label">
            {selectedCards.length > 0 ? (
              <>
                Selected ({selectedCards.length}): <span>{validationMessage}</span>
              </>
            ) : (
              isMyTurn ? "Your turn! Select cards to play." : "Waiting for other players..."
            )}
          </div>
        </div>

        {/* Warning Banner if no plays are possible */}
        {hasNoValidPlays && (
          <div className="no-plays-warning">
            ⚠️ No combinations in hand can beat the table. You must Pass!
          </div>
        )}

        {/* Primary Play Actions */}
        <div className="hand-actions-row">
          <button
            className="btn-primary"
            style={{ minWidth: '120px' }}
            disabled={!canPlaySelected || hasActionedThisTurn}
            onClick={handlePlayClick}
          >
            Play Hand
          </button>
          <button
            className="btn-danger"
            style={{ minWidth: '120px' }}
            disabled={!isMyTurn || isFirstPlayOfRound || !activePlay || hasActionedThisTurn}
            onClick={handlePassClick}
          >
            Pass
          </button>
        </div>
      </div>

      {/* Scoring / Round Over overlay */}
      {(gameState === 'roundover' || gameState === 'gameover') && (
        <div className="modal-overlay">
          <div className="glass-panel score-modal">
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#fbbf24' }}>
              {gameState === 'gameover' ? '🏆 Tournament Over! 🏆' : 'Round Finished'}
            </h2>
            <p className="subtitle" style={{ color: 'var(--text-muted)' }}>
              {gameState === 'gameover' ? 'We have a grand champion!' : 'Points calculated for this round'}
            </p>

            <table className="round-results-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Cards Left</th>
                  <th>Points Earned</th>
                  <th>Total Score</th>
                </tr>
              </thead>
              <tbody>
                {players
                  .map(p => p)
                  .sort((a, b) => b.score - a.score) // Sort by total score
                  .map((player) => {
                    const isWinner = player.cards.length === 0;
                    return (
                      <tr key={player.id} className={isWinner ? 'winner-row' : ''}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                          <AvatarSVG config={player.avatar} size={28} />
                          <span>{player.name} {player.id === playerId ? '(You)' : ''}</span>
                        </td>
                        <td>{player.cards.length}</td>
                        <td>
                          <span className="points-pill">+{player.roundPoints || 0}</span>
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{player.score}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              {isHost && (
                <button className="btn-gold" onClick={onRestartGame}>
                  {gameState === 'gameover' ? 'New Tournament' : 'Next Round'}
                </button>
              )}
              {!isHost && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                  Waiting for host to start next round...
                </div>
              )}
              <button className="btn-secondary" onClick={onLeaveRoom}>
                Leave Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
