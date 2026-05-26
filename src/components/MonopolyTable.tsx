// src/components/MonopolyTable.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AvatarSVG } from './AvatarCreator';
import { sfx } from '../utils/audio';
import '../monopoly.css';

interface Player {
  id: string;
  name: string;
  avatar: any;
  isHost: boolean;
  isBot: boolean;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  freeTollCards?: number;
  oddEvenCards?: number;
  angelCards?: number;
  bankrupt: boolean;
  lastRoll: number[];
  rollCount: number;
  doublesRolled?: boolean;
  netWorth: number;
  score?: number;
  finishRank?: number;
  status?: 'managing' | 'trading' | null;
}

interface TileState {
  index: number;
  name: string;
  type: 'go' | 'property' | 'tax' | 'railroad' | 'utility' | 'chance' | 'chest' | 'jail' | 'parking' | 'gotojail';
  color?: 'brown' | 'lightblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkblue';
  price?: number;
  rent?: number[];
  housePrice?: number;
  mortgageValue?: number;
  owner: string | null;
  houses: number;
  mortgaged: boolean;
  festivalTurns?: number;
}

interface MonopolyTableProps {
  playerId: string;
  players: Player[];
  turnIndex: number;
  monopolyBoard: TileState[];
  dice: number[];
  monopolyPhase: string;
  currentCard: any | null;
  cardType: string | null;
  activeDebt: any | null;
  auctionState?: any | null;
  activeTrade?: any | null;
  gameState: 'lobby' | 'playing' | 'roundover' | 'gameover';
  roomCode?: string;
  isHost: boolean;
  isSinglePlayer: boolean;
  onMonopolyAction: (action: string, payload?: any) => void;
  onLeaveRoom: () => void;
  onRestartGame: () => void;
  onAnimationStateChange?: (isAnimating: boolean) => void;
  onToggleChat?: () => void;
  onVisualPositionsChange?: (positions: Record<string, number>) => void;
  rollId?: string | null;
  rules?: any;
  lastActionDetail?: any;
  pendingForceAcquire?: any | null;
  pendingRent?: any | null;
  landedBuildMaxHouses?: number;
  monopolyTurnCount?: number;
  tradeRejectedName?: string | null;
  casinoState?: any | null;
}

// Maps board index to grid row and column (1-indexed CSS Grid)
function getTileGridCoords(index: number): { row: number; col: number } {
  if (index >= 0 && index <= 10) {
    // Bottom row (Right to Left): 0 = col 11, 10 = col 1
    return { row: 11, col: 11 - index };
  } else if (index > 10 && index <= 20) {
    // Left col (Bottom to Top): 11 = row 10, 20 = row 1
    return { row: 11 - (index - 10), col: 1 };
  } else if (index > 20 && index <= 30) {
    // Top row (Left to Right): 21 = col 2, 30 = col 11
    return { row: 1, col: 1 + (index - 20) };
  } else {
    // Right col (Top to Bottom): 31 = row 2, 39 = row 10
    return { row: 1 + (index - 30), col: 11 };
  }
}

// Returns local board coordinates (X, Y) relative to board center (0, 0)
// ranging from -319 to +319 for X and -310 to +310 for Y based on non-uniform grid tracks (85px corners, 52px/50px sides)
function getTileLocalCoords(index: number): { x: number; y: number } {
  const { row, col } = getTileGridCoords(index);

  const getCenterOfCol = (idx: number) => {
    if (idx === 1) return 42.5;
    if (idx >= 2 && idx <= 10) return 111 + (idx - 2) * 52;
    return 595.5; // 638 - 42.5
  };

  const getCenterOfRow = (idx: number) => {
    if (idx === 1) return 42.5;
    if (idx >= 2 && idx <= 10) return 110 + (idx - 2) * 50;
    return 577.5; // 620 - 42.5
  };

  const tileX = getCenterOfCol(col) - 319;
  const tileY = getCenterOfRow(row) - 310;
  return { x: tileX, y: tileY };
}

const render2DDie = (value: number, isRolling: boolean, playerColor?: string) => {
  const dots: { col: number; row: number }[] = [];
  if (value === 1) {
    dots.push({ col: 2, row: 2 });
  } else if (value === 2) {
    dots.push({ col: 1, row: 1 }, { col: 3, row: 3 });
  } else if (value === 3) {
    dots.push({ col: 1, row: 1 }, { col: 2, row: 2 }, { col: 3, row: 3 });
  } else if (value === 4) {
    dots.push({ col: 1, row: 1 }, { col: 3, row: 1 }, { col: 1, row: 3 }, { col: 3, row: 3 });
  } else if (value === 5) {
    dots.push({ col: 1, row: 1 }, { col: 3, row: 1 }, { col: 2, row: 2 }, { col: 1, row: 3 }, { col: 3, row: 3 });
  } else if (value === 6) {
    dots.push({ col: 1, row: 1 }, { col: 1, row: 2 }, { col: 1, row: 3 }, { col: 3, row: 1 }, { col: 3, row: 2 }, { col: 3, row: 3 });
  }

  return (
    <div
      className={`die-2d ${isRolling ? 'rolling-2d' : 'settled-2d'}`}
      style={{ background: playerColor || '#ffffff' }}
    >
      {dots.map((dot, idx) => (
        <div key={idx} className="dot-2d" style={{ gridColumn: dot.col, gridRow: dot.row }} />
      ))}
    </div>
  );
};


export const MonopolyTable: React.FC<MonopolyTableProps> = ({
  playerId,
  players,
  turnIndex,
  monopolyBoard = [],
  dice = [1, 1],
  monopolyPhase = 'roll',
  currentCard,
  cardType,
  activeDebt,
  auctionState = null,
  activeTrade = null,
  gameState,
  isHost,
  onMonopolyAction,
  onLeaveRoom,
  onRestartGame,
  onAnimationStateChange,
  onToggleChat,
  onVisualPositionsChange,
  rollId = null,
  rules = { ruleset: 'Default' },
  lastActionDetail,
  pendingForceAcquire = null,
  pendingRent = null,
  landedBuildMaxHouses = 4,
  monopolyTurnCount = 0,
  tradeRejectedName = null,
  casinoState = null
}) => {
  const [selectedDeedIndex, setSelectedDeedIndex] = useState<number | null>(null);
  const [tradeBoardSelectionMode, setTradeBoardSelectionMode] = useState<'me' | 'them' | null>(null);
  const [incomingTradeViewBoardMode, setIncomingTradeViewBoardMode] = useState<boolean>(false);
  const [isBuildManagerOpen, setIsBuildManagerOpen] = useState<boolean>(false);
  const [isTradeEditorOpen, setIsTradeEditorOpen] = useState<boolean>(false);
  const [tradeTargetId, setTradeTargetId] = useState<string | null>(null);
  const [offeredProperties, setOfferedProperties] = useState<number[]>([]);
  const [offeredMoney, setOfferedMoney] = useState<number>(0);
  const [offeredJailCards, setOfferedJailCards] = useState<number>(0);
  const [demandedProperties, setDemandedProperties] = useState<number[]>([]);
  const [demandedMoney, setDemandedMoney] = useState<number>(0);
  const [demandedJailCards, setDemandedJailCards] = useState<number>(0);
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const [isDiceRolling, setIsDiceRolling] = useState<boolean>(false);
  const [showRollBanner, setShowRollBanner] = useState<boolean>(false);
  const [showDiceModal, setShowDiceModal] = useState<boolean>(false);
  const [diceModalPhase, setDiceModalPhase] = useState<'rolling' | 'settled'>('rolling');
  const [animatedDice, setAnimatedDice] = useState<number[]>([1, 1]);
  const [movingPlayerSteps, setMovingPlayerSteps] = useState<Record<string, number>>({});
  const [isJailingInProgress, setIsJailingInProgress] = useState<boolean>(false);
  const rollIntervalRef = useRef<any | null>(null);
  const [flyingBills, setFlyingBills] = useState<{
    id: string;
    val: number;
    startX: number;
    startY: number;
    startZ: number;
    endX: number;
    endY: number;
    endZ: number;
    rotXStart: number;
    rotYStart: number;
    rotZStart: number;
    rotXEnd: number;
    rotYEnd: number;
    rotZEnd: number;
    delay: number;
  }[]>([]);
  const [displayMoney, setDisplayMoney] = useState<Record<string, number>>({});
  const [activeChanges, setActiveChanges] = useState<Record<string, {
    diff: number;
    currentDiff: number;
    currentTotal: number;
    stage: 'appearing' | 'counting';
  }>>({});
  // Camera coordinates and scale variables
  const [cameraX, setCameraX] = useState<number>(0);
  const [cameraY, setCameraY] = useState<number>(0);
  const [cameraScale, setCameraScale] = useState<number>(0.98);
  const [cameraTransition, setCameraTransition] = useState<string>('1.2s');
  const [cameraShake, setCameraShake] = useState<boolean>(false);
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(false);
  const [introCountdown, setIntroCountdown] = useState<'3' | '2' | '1' | 'Roll!' | null>(null);
  const [introTransitionActive, setIntroTransitionActive] = useState<boolean>(false);
  const [curtainOpen, setCurtainOpen] = useState<boolean>(false);

  // Customizable default camera position state (draggable & zoomable)
  const [defaultCameraX, setDefaultCameraX] = useState<number>(0);
  const [defaultCameraY, setDefaultCameraY] = useState<number>(0);
  const [defaultCameraScale, setDefaultCameraScale] = useState<number>(0.98);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const [isCameraManual, setIsCameraManual] = useState<boolean>(false);

  // Power bar and Odd/Even states
  const [powerValue, setPowerValue] = useState<number>(0);
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const powerDirectionRef = useRef<number>(1);
  const [oddEvenChoice, setOddEvenChoice] = useState<'odd' | 'even' | null>(null);
  const powerAnimIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPressing) {
      const updatePower = () => {
        setPowerValue(prev => {
          let next = prev + powerDirectionRef.current * 4;
          if (next >= 100) {
            next = 100;
            powerDirectionRef.current = -1;
          } else if (next <= 0) {
            next = 0;
            powerDirectionRef.current = 1;
          }
          return next;
        });
        powerAnimIdRef.current = requestAnimationFrame(updatePower);
      };
      powerAnimIdRef.current = requestAnimationFrame(updatePower);
    } else {
      if (powerAnimIdRef.current) {
        cancelAnimationFrame(powerAnimIdRef.current);
        powerAnimIdRef.current = null;
      }
    }
    return () => {
      if (powerAnimIdRef.current) {
        cancelAnimationFrame(powerAnimIdRef.current);
      }
    };
  }, [isPressing]);

  const handlePowerBarStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isDiceRolling || monopolyPhase !== 'roll' || activePlayer?.id !== playerId) return;
    setPowerValue(0);
    powerDirectionRef.current = 1;
    setIsPressing(true);
  };

  const handlePowerBarRelease = () => {
    if (!isPressing) return;
    setIsPressing(false);
    onMonopolyAction('roll-dice', { power: powerValue, oddEvenChoice });
    setOddEvenChoice(null);
  };

  const [tileFloatingTexts, setTileFloatingTexts] = useState<{
    id: string;
    tileIndex: number;
    text: string;
    type: 'bought' | 'rent' | 'built' | 'sold' | 'mortgaged' | 'jailed' | 'monopoly' | 'salary' | 'traded' | 'acquired' | 'festival' | 'airport';
  }[]>([]);
  const prevBoardForFloatingTextRef = useRef<TileState[]>([]);
  const prevPlayersForFloatingTextRef = useRef<Player[]>([]);
  const prevMonopolyColorGroupsRef = useRef<Record<string, string | null>>({});

  const addFloatingText = useCallback((tileIndex: number, text: string, type: 'bought' | 'rent' | 'built' | 'sold' | 'mortgaged' | 'jailed' | 'monopoly' | 'salary' | 'traded' | 'acquired' | 'festival' | 'airport') => {
    const id = `${type}_${tileIndex}_${Date.now()}_${Math.random()}`;
    setTileFloatingTexts(prev => [...prev, { id, tileIndex, text, type }]);
    setTimeout(() => {
      setTileFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 2300);
  }, []);

  const activePlayer = players[turnIndex] || null;

  const [detailedPlayerId, setDetailedPlayerId] = useState<string | null>(null);
  const [jailAnimationPlayerId, setJailAnimationPlayerId] = useState<string | null>(null);
  const [cardAnimationState, setCardAnimationState] = useState<'idle' | 'flying' | 'done'>('idle');
  const [flyingCard, setFlyingCard] = useState<{
    x: number;
    y: number;
    z: number;
    rot: number;
    opacity: number;
    scale: number;
    type: 'chance' | 'chest';
    text: string;
  } | null>(null);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const prevActivePlayerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (gameState === 'playing' && activePlayer) {
      if (activePlayer.id === playerId && prevActivePlayerIdRef.current !== playerId) {
        sfx.playPing();
      }
      prevActivePlayerIdRef.current = activePlayer.id;
    } else {
      prevActivePlayerIdRef.current = null;
    }
  }, [activePlayer, playerId, gameState]);

  useEffect(() => {
    if (monopolyPhase === 'card_drawn' && currentCard) {
      if (cardAnimationState === 'idle') {
        setCardAnimationState('flying');
        const isChance = cardType === 'chance';
        const startX = isChance ? 110 : -110;
        const startY = isChance ? -120 : 120;
        const startRot = isChance ? -45 : 135;

        const p = activePlayer;
        let endX = 0;
        let endY = 0;
        if (p) {
          const tilePos = visualPositions[p.id] ?? p.position;
          const coords = getTileLocalCoords(tilePos);
          endX = coords.x;
          endY = coords.y;
        }

        setFlyingCard({
          x: startX,
          y: startY,
          z: 2,
          rot: startRot,
          opacity: 1,
          scale: 0.8,
          type: cardType as 'chance' | 'chest',
          text: currentCard.text,
        });

        sfx.playDraw();

        const animTimer = setTimeout(() => {
          setFlyingCard(prev => {
            if (!prev) return null;
            return {
              ...prev,
              x: endX,
              y: endY,
              z: 50,
              rot: startRot + 360,
              scale: 1.2,
            };
          });
        }, 50);

        const endTimer = setTimeout(() => {
          setFlyingCard(null);
          setCardAnimationState('done');
        }, 1100);

        return () => {
          clearTimeout(animTimer);
          clearTimeout(endTimer);
        };
      }
    } else {
      if (cardAnimationState !== 'idle') {
        setCardAnimationState('idle');
        setFlyingCard(null);
      }
    }
  }, [monopolyPhase, currentCard, cardType, activePlayer, visualPositions, cardAnimationState]);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialCameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartDistanceRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const prevPlayersRef = useRef<Player[]>([]);
  const prevDiceRef = useRef<number[]>(dice);
  const prevRollIdRef = useRef<string | null>(null);
  const settleTimerRef = useRef<any>(null);
  const closeTimerRef = useRef<any>(null);
  const hopTimersRef = useRef<Record<string, any>>({});
  const hopTargetsRef = useRef<Record<string, number>>({});
  const prevBoardRef = useRef<TileState[]>([]);
  const prevBoardForMoneyRef = useRef<TileState[]>([]);
  const lastAutoOpenRef = useRef<string | null>(null);
  const prevBoardForBuyDetectRef = useRef<TileState[]>([]);



  const getPlayerStackCoords = (playerIdx: number) => {
    if (playerIdx === 0) return { x: 310, y: -110, z: 0 };
    if (playerIdx === 1) return { x: 820, y: 310, z: 0 };
    if (playerIdx === 2) return { x: 310, y: 730, z: 0 };
    if (playerIdx === 3) return { x: -200, y: 310, z: 0 };
    return { x: 310, y: 310, z: 0 };
  };

  const spawnFlyingBills = (fromIdx: number, toIdx: number, fromBank: boolean, toBank: boolean, amount: number) => {
    const startCoords = getPlayerStackCoords(fromIdx);
    const endCoords = getPlayerStackCoords(toIdx);

    // Determine realistic denomination bills to spawn based on the amount
    let tempAmount = amount;
    const denominations = [500, 100, 50, 10];
    const billsToSpawn: number[] = [];

    for (const denom of denominations) {
      const count = Math.floor(tempAmount / denom);
      if (count > 0) {
        for (let c = 0; c < count; c++) {
          billsToSpawn.push(denom);
        }
        tempAmount %= denom;
      }
    }

    // If it's less than $10, or somehow empty, default to at least one $10 bill
    if (billsToSpawn.length === 0) {
      billsToSpawn.push(10);
    }

    // Use the actual denominations directly without capping or padding limits
    const finalBillVals = billsToSpawn;

    const billCount = finalBillVals.length;
    const newBills: any[] = [];

    for (let i = 0; i < billCount; i++) {
      const id = `bill_${Date.now()}_${Math.random()}_${i}`;
      const val = finalBillVals[i];

      const offsetStart = {
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 30,
        z: (Math.random() - 0.5) * 10
      };
      const offsetEnd = {
        x: (Math.random() - 0.5) * 50,
        y: (Math.random() - 0.5) * 30,
        z: (Math.random() - 0.5) * 10
      };

      let sX = startCoords.x + offsetStart.x;
      let sY = startCoords.y + offsetStart.y;
      let sZ = startCoords.z + offsetStart.z;

      let eX = endCoords.x + offsetEnd.x;
      let eY = endCoords.y + offsetEnd.y;
      let eZ = endCoords.z + offsetEnd.z;

      if (fromBank) {
        sX = 310 + (Math.random() - 0.5) * 80;
        sY = 310 + (Math.random() - 0.5) * 80;
        sZ = 80 + (Math.random() - 0.5) * 30;
      } else if (toBank) {
        eX = 310 + (Math.random() - 0.5) * 80;
        eY = 310 + (Math.random() - 0.5) * 80;
        eZ = 80 + (Math.random() - 0.5) * 30;
      }

      const rotXStart = Math.random() * 360;
      const rotYStart = Math.random() * 360;
      const rotZStart = Math.random() * 360;

      const rotXEnd = (Math.random() - 0.5) * 45;
      const rotYEnd = (Math.random() - 0.5) * 45;
      const rotZEnd = (Math.random() - 0.5) * 45;

      newBills.push({
        id,
        val,
        startX: sX,
        startY: sY,
        startZ: sZ,
        endX: eX,
        endY: eY,
        endZ: eZ,
        rotXStart,
        rotYStart,
        rotZStart,
        rotXEnd,
        rotYEnd,
        rotZEnd,
        delay: i * 100
      });
    }

    setFlyingBills(prev => [...prev, ...newBills]);

    setTimeout(() => {
      const ids = newBills.map(b => b.id);
      setFlyingBills(prev => prev.filter(b => !ids.includes(b.id)));
    }, 1500 + billCount * 100);
  };

  useEffect(() => {
    if (players.length > 0) {
      setDisplayMoney(prev => {
        const next = { ...prev };
        players.forEach(p => {
          if (next[p.id] === undefined) {
            next[p.id] = p.money;
          }
        });
        return next;
      });
    }
  }, [players]);

  // Sound sync trigger for floating money changes & spawn money particles & 3D flying bills
  useEffect(() => {
    if (gameState !== 'playing') return;

    if (prevBoardForMoneyRef.current.length === 0 && monopolyBoard.length > 0) {
      prevBoardForMoneyRef.current = monopolyBoard;
    }

    // Task 5: Wait until all players have finished hopping before processing money changes
    const isAnyoneMoving = players.some(p => visualPositions[p.id] !== undefined && visualPositions[p.id] !== p.position);
    if (isAnyoneMoving) return;

    const prevPlayers = prevPlayersRef.current;
    if (prevPlayers.length > 0) {
      const senders: { id: string; idx: number; amount: number }[] = [];
      const receivers: { id: string; idx: number; amount: number }[] = [];

      players.forEach((p, idx) => {
        const prevP = prevPlayers.find(prev => prev.id === p.id);
        if (prevP && prevP.money !== p.money) {
          const diff = p.money - prevP.money;
          if (diff < 0) {
            senders.push({ id: p.id, idx, amount: -diff });
          } else {
            receivers.push({ id: p.id, idx, amount: diff });
          }
        }
      });

      // 1. Spawning 3D Flying Bills
      if (senders.length > 0 && receivers.length > 0) {
        // Player-to-player transfer
        senders.forEach(s => {
          receivers.forEach(r => {
            spawnFlyingBills(s.idx, r.idx, false, false, Math.max(s.amount, r.amount));
          });
        });
      } else if (senders.length > 0) {
        // Loss to Bank
        senders.forEach(s => {
          spawnFlyingBills(s.idx, s.idx, false, true, s.amount);
        });
      } else if (receivers.length > 0) {
        // Gain from Bank
        receivers.forEach(r => {
          spawnFlyingBills(r.idx, r.idx, true, false, r.amount);
        });
      }

      // Play sound if there was any change
      if (senders.length > 0 || receivers.length > 0) {
        sfx.playMoney();
      }

      // 2. Trigger Juicy Value Transfer Countdown/Countup and Scale Animation
      players.forEach((p) => {
        const prevP = prevPlayers.find(prev => prev.id === p.id);
        if (prevP && prevP.money !== p.money) {
          const diff = p.money - prevP.money;

          // Set stage to appearing
          setActiveChanges(prev => ({
            ...prev,
            [p.id]: {
              diff: diff,
              currentDiff: diff,
              currentTotal: prevP.money,
              stage: 'appearing'
            }
          }));

          // Trigger countdown after 600ms (so bills are in mid-air/landing)
          setTimeout(() => {
            setActiveChanges(prev => {
              if (!prev[p.id] || prev[p.id].stage !== 'appearing') return prev;
              return {
                ...prev,
                [p.id]: {
                  ...prev[p.id],
                  stage: 'counting'
                }
              };
            });

            const duration = 800; // ms
            const startTime = performance.now();
            const startDiff = diff;
            const startTotal = prevP.money;
            const endTotal = p.money;

            const updateValue = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);

              // Quadratic ease out
              const easeProgress = progress * (2 - progress);

              const nextDiff = Math.round(startDiff * (1 - easeProgress));
              const nextTotal = Math.round(startTotal + (endTotal - startTotal) * easeProgress);

              setActiveChanges(prev => {
                if (!prev[p.id] || prev[p.id].stage !== 'counting') return prev;
                return {
                  ...prev,
                  [p.id]: {
                    ...prev[p.id],
                    currentDiff: nextDiff,
                    currentTotal: nextTotal
                  }
                };
              });

              setDisplayMoney(prev => ({
                ...prev,
                [p.id]: nextTotal
              }));

              if (progress < 1) {
                requestAnimationFrame(updateValue);
              } else {
                // Done! Clean up active change and set display money exactly to p.money
                setActiveChanges(prev => {
                  const next = { ...prev };
                  delete next[p.id];
                  return next;
                });
                setDisplayMoney(prev => ({
                  ...prev,
                  [p.id]: p.money
                }));
              }
            };

            requestAnimationFrame(updateValue);
          }, 600);
        }
      });
    }

    prevPlayersRef.current = players;
    prevBoardForMoneyRef.current = monopolyBoard;
  }, [players, gameState, monopolyBoard, visualPositions]);

  // Start game curtain & countdown intro cinematic sweep
  useEffect(() => {
    if (gameState === 'playing') {
      setVisualPositions({});
      Object.keys(hopTimersRef.current).forEach(id => {
        clearTimeout(hopTimersRef.current[id]);
      });
      hopTimersRef.current = {};
      hopTargetsRef.current = {};
      setMovingPlayerSteps({});

      setIntroTransitionActive(true);
      setCurtainOpen(false); // Make sure curtains start completely closed

      // Cinematic zoom out starting point
      setCameraScale(0.12);
      setCameraX(0);
      setCameraY(380);
      setCameraTransition('0s'); // Instant start position

      const startTimer = setTimeout(() => {
        // Dramatic cinematic sweep zoom-in & pan
        setCameraScale(0.98);
        setCameraX(0);
        setCameraY(0);
        setCameraTransition('2.8s cubic-bezier(0.1, 0.85, 0.2, 1)');

        // Start countdown chimes
        setIntroCountdown('3');
        sfx.playCountdownBeep(false);

        const count2Timer = setTimeout(() => {
          setIntroCountdown('2');
          sfx.playCountdownBeep(false);
        }, 750);

        const count1Timer = setTimeout(() => {
          setIntroCountdown('1');
          sfx.playCountdownBeep(false);
        }, 1500);

        const rollTimer = setTimeout(() => {
          setIntroCountdown('Roll!');
          setCurtainOpen(true); // Split the curtains exactly now!
          sfx.playCountdownBeep(true);
        }, 2250);

        const endTimer = setTimeout(() => {
          setIntroCountdown(null);
          setIntroTransitionActive(false);
        }, 3050);

        return () => {
          clearTimeout(count2Timer);
          clearTimeout(count1Timer);
          clearTimeout(rollTimer);
          clearTimeout(endTimer);
        };
      }, 400);

      return () => clearTimeout(startTimer);
    }
  }, [gameState]);

  // Dice roll animation trigger (2D popup)
  useEffect(() => {
    const isNewRoll = rollId && rollId !== prevRollIdRef.current;
    if (isNewRoll && gameState === 'playing') {
      prevRollIdRef.current = rollId;
      prevDiceRef.current = dice;

      // Clear any existing active roll timers
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
        rollIntervalRef.current = null;
      }

      setIsDiceRolling(true);
      setShowDiceModal(true);
      setDiceModalPhase('rolling');
      setShowRollBanner(false);
      sfx.playDiceRoll();

      // Rapidly shuffle dice faces
      rollIntervalRef.current = setInterval(() => {
        setAnimatedDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
      }, 60);

      // Settle roll after 1000ms
      settleTimerRef.current = setTimeout(() => {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        setAnimatedDice(dice);
        setDiceModalPhase('settled');
        sfx.playDiceLand();
      }, 1000);

      // Close modal and start player movement after another 1200ms
      closeTimerRef.current = setTimeout(() => {
        setShowDiceModal(false);
        setIsDiceRolling(false); // Triggers visualPositions movement
        setShowRollBanner(true);
      }, 2200);
    }
  }, [rollId, dice, gameState]);

  // Unmount cleanup for active roll timers
  useEffect(() => {
    return () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  // Handle roll banner auto-fade
  useEffect(() => {
    if (showRollBanner) {
      const bannerTimer = setTimeout(() => {
        setShowRollBanner(false);
      }, 2500);
      return () => clearTimeout(bannerTimer);
    }
  }, [showRollBanner]);

  // Hopping loop to coordinate tile-by-tile movements
  const stepPlayerPos = useCallback((pId: string, current: number, target: number, isBackward?: boolean) => {
    const playerObj = players.find(p => p.id === pId);
    const isJailTeleport = target === 10 && playerObj?.inJail;

    if (isJailTeleport) {
      // Teleport instantly to Jail
      setVisualPositions(prev => ({ ...prev, [pId]: 10 }));

      // Trigger jail animation for this player
      setJailAnimationPlayerId(pId);
      setTimeout(() => {
        setJailAnimationPlayerId(null);
      }, 2500);

      // Smoothly pan camera onto Jail tile
      if (!isDraggingRef.current && !isCameraManual) {
        const localCoords = getTileLocalCoords(10);
        setCameraTransition('1.2s');
        setCameraX(-localCoords.x * 1.20);
        setCameraY(-localCoords.y * 1.20);
        setCameraScale(1.22);
        setCameraShake(true);
        setTimeout(() => setCameraShake(false), 400);
      }

      // Trigger dramatic jail impact
      sfx.playJail();

      setMovingPlayerSteps(prev => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
      delete hopTimersRef.current[pId];
      delete hopTargetsRef.current[pId];
      return;
    }

    if (current === target) {
      // Landed! Zoom camera onto landing space
      const localCoords = getTileLocalCoords(target);
      if (!isDraggingRef.current && !isCameraManual) {
        setCameraX(-localCoords.x * 1.20);
        setCameraY(-localCoords.y * 1.20);
        setCameraScale(1.22);
        setCameraTransition('0.4s');
      }

      // Trigger custom land sound (jail warning or standard card sound) and impact effects
      const tile = monopolyBoard[target];
      const isRentTile = tile && tile.owner && tile.owner !== pId && !tile.mortgaged;
      const isTaxTile = tile && tile.type === 'tax';
      const isGoToJail = tile && tile.type === 'gotojail';

      if (isRentTile || isTaxTile || isGoToJail) {
        if (!isDraggingRef.current) {
          setCameraShake(true);
          setTimeout(() => setCameraShake(false), 400);
        }
        sfx.playCard();
      } else {
        sfx.playCard();
      }

      // If they landed on Go To Jail tile (30) but their server position is 10 (Jail), pause and teleport them to jail.
      if (target === 30 && playerObj?.inJail && playerObj.position === 10) {
        setIsJailingInProgress(true);
        const timer = setTimeout(() => {
          setIsJailingInProgress(false);
          stepPlayerPos(pId, 30, 10);
        }, 1000);
        hopTimersRef.current[pId] = timer;
        return;
      }

      setMovingPlayerSteps(prev => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
      delete hopTimersRef.current[pId];
      delete hopTargetsRef.current[pId];
      return;
    }

    // Update remaining moves countdown
    const stepsLeft = isBackward ? (current - target + 40) % 40 : (target - current + 40) % 40;
    setMovingPlayerSteps(prev => ({ ...prev, [pId]: stepsLeft }));

    const next = isBackward ? (current - 1 + 40) % 40 : (current + 1) % 40;
    setVisualPositions(prev => ({ ...prev, [pId]: next }));

    if (next === 0 && !isBackward) {
      addFloatingText(0, 'Salary!', 'salary');
    }

    // Play hop tick
    sfx.playTick();

    hopTimersRef.current[pId] = setTimeout(() => {
      stepPlayerPos(pId, next, target, isBackward);
    }, 280);
  }, [monopolyBoard, players, addFloatingText]);

  // Watch players list to animate positions
  useEffect(() => {
    if (gameState !== 'playing') return;
    const isNewRoll = dice[0] !== prevDiceRef.current[0] || dice[1] !== prevDiceRef.current[1];
    if (isDiceRolling || isNewRoll) return; // Wait until dice roll is complete before starting token movement

    players.forEach(p => {
      const prevPos = visualPositions[p.id];
      if (prevPos === undefined) {
        // Initialize position
        setVisualPositions(prev => ({ ...prev, [p.id]: p.position }));
      } else {
        // Check if there is an active hop timer and if the target has changed
        if (hopTimersRef.current[p.id] && hopTargetsRef.current[p.id] !== undefined && hopTargetsRef.current[p.id] !== p.position) {
          // Server position changed while hopping (e.g. Chance card movement)
          // Cancel the current hopping sequence and restart towards the new target
          clearTimeout(hopTimersRef.current[p.id]);
          delete hopTimersRef.current[p.id];
          delete hopTargetsRef.current[p.id];
        }

        if (prevPos !== p.position && !hopTimersRef.current[p.id]) {
          // Position changed on server: start hop sequence!
          let targetPos = p.position;
          const diceSum = dice[0] + dice[1];

          // If player is sent to jail from Go To Jail tile (position 30)
          if (p.inJail && p.position === 10 && (prevPos + diceSum) % 40 === 30) {
            targetPos = 30;
          }

          const isBackward = (prevPos - targetPos + 40) % 40 === 3;

          if (!isDraggingRef.current && !isCameraManual && p.id === activePlayer?.id) {
            const targetCoords = getTileLocalCoords(targetPos);
            const stepsCount = isBackward ? (prevPos - targetPos + 40) % 40 : (targetPos - prevPos + 40) % 40;
            const duration = Math.max(0.4, stepsCount * 0.28);
            setCameraTransition(`${duration}s linear`);
            setCameraX(-targetCoords.x * 1.20);
            setCameraY(-targetCoords.y * 1.20);
            setCameraScale(1.28);
          }

          hopTargetsRef.current[p.id] = targetPos;
          stepPlayerPos(p.id, prevPos, targetPos, isBackward);
        }
      }
    });
  }, [players, gameState, visualPositions, stepPlayerPos, isDiceRolling, activePlayer?.id, isCameraManual, dice]);

  const isOverview = !isCameraLocked && Object.keys(hopTimersRef.current).length === 0 &&
    (monopolyPhase === 'roll' || isDiceRolling || (monopolyPhase === 'action' && !activePlayer));

  // Dynamic Camera Zoom-in Control based on gameplay phase
  useEffect(() => {
    if (introTransitionActive) return; // Cinematic intro has control of camera!
    if (isCameraLocked) return; // Keep focus on property upgrade construction
    if (isDragging) return; // Don't let phase changes override active dragging
    if (isCameraManual) return; // Don't snap back on phase changes if camera is manual

    if (isOverview) {
      setCameraTransition('1.2s');
      setCameraX(defaultCameraX);
      setCameraY(defaultCameraY);
      setCameraScale(defaultCameraScale);
    } else if (monopolyPhase === 'action' || monopolyPhase === 'card_drawn' || monopolyPhase === 'bankrupt_decision' || monopolyPhase === 'end_turn') {
      // Focus active landing tile
      if (activePlayer) {
        const activeTilePos = visualPositions[activePlayer.id] ?? activePlayer.position;
        const localCoords = getTileLocalCoords(activeTilePos);
        setCameraTransition('1.0s');
        setCameraX(-localCoords.x * 1.20);
        setCameraY(-localCoords.y * 1.20);

        setCameraScale(1.22);
      }
    } else {
      // Overview
      setCameraTransition('1.2s');
      setCameraX(defaultCameraX);
      setCameraY(defaultCameraY);
      setCameraScale(defaultCameraScale);
    }
  }, [monopolyPhase, activePlayer, isDiceRolling, visualPositions, monopolyBoard, isCameraLocked, isOverview, defaultCameraX, defaultCameraY, defaultCameraScale, isDragging, isCameraManual]);

  // Property building / upgrade camera focus tracking
  useEffect(() => {
    if (introTransitionActive) return; // Cinematic intro has control of camera!
    if (gameState !== 'playing' || monopolyBoard.length === 0) return;
    if (isCameraManual) return; // Ignore construction zoom if camera is manual

    const prevBoard = prevBoardRef.current;
    if (prevBoard && prevBoard.length > 0) {
      // Find if houses count has increased
      const upgradedTile = monopolyBoard.find(tile => {
        const prevTile = prevBoard.find(pt => pt.index === tile.index);
        return prevTile && tile.houses > prevTile.houses;
      });

      if (upgradedTile) {
        // Zoom and pan to construction site!
        const localCoords = getTileLocalCoords(upgradedTile.index);
        setIsCameraLocked(true);
        setCameraTransition('0.8s');
        setCameraX(-localCoords.x * 1.20);
        setCameraY(-localCoords.y * 1.20);
        setCameraScale(1.50); // Close focus on the upgrading tile

        // Lock camera focus there for 1.6s
        setTimeout(() => {
          setIsCameraLocked(false);
          // Re-evaluate normal camera position
          if (activePlayer) {
            const activeTilePos = visualPositions[activePlayer.id] ?? activePlayer.position;
            const activeCoords = getTileLocalCoords(activeTilePos);
            setCameraTransition('1.0s');
            setCameraX(-activeCoords.x * 1.20);
            setCameraY(-activeCoords.y * 1.20);

            setCameraScale(1.22);
          } else {
            setCameraX(defaultCameraX);
            setCameraY(defaultCameraY);
            setCameraScale(defaultCameraScale);
          }
        }, 1600);
      }
    }
    prevBoardRef.current = monopolyBoard;
  }, [monopolyBoard, gameState, activePlayer, visualPositions, defaultCameraX, defaultCameraY, defaultCameraScale, isCameraManual]);

  // Memoized check for monopolies to draw glowing outlines
  const monopolyColorGroups = useMemo(() => {
    const groups: Record<string, string | null> = {};
    const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'] as const;

    colors.forEach(color => {
      const tilesOfColor = monopolyBoard.filter(t => t.type === 'property' && t.color === color);
      if (tilesOfColor.length === 0) return;
      const firstOwner = tilesOfColor[0].owner;
      if (firstOwner && tilesOfColor.every(t => t.owner === firstOwner)) {
        groups[color] = firstOwner;
      } else {
        groups[color] = null;
      }
    });
    return groups;
  }, [monopolyBoard]);

  const isUpgradedGroup = useCallback((tile: TileState) => {
    if (rules?.ruleset === 'Get Rich') return false;
    if (tile.type !== 'property' || !tile.color) return false;
    return monopolyBoard.filter(t => t.color === tile.color).some(t => t.houses > 0);
  }, [monopolyBoard, rules]);

  // Floating text action triggers ("Bought!", "Rent!", "Built!", "Sold!", "Mortgaged!", "Unmortgaged!", "Jailed!", "Monopoly!")
  useEffect(() => {
    if (gameState !== 'playing' || monopolyBoard.length === 0) return;

    // Wait until hopping animation is complete to sync text popups with landing/money animations
    const isAnyoneMoving = players.some(p => visualPositions[p.id] !== undefined && visualPositions[p.id] !== p.position);
    if (isAnyoneMoving) return;

    if (prevBoardForFloatingTextRef.current.length === 0) {
      prevBoardForFloatingTextRef.current = monopolyBoard;
      prevPlayersForFloatingTextRef.current = players;
      prevMonopolyColorGroupsRef.current = { ...monopolyColorGroups };
      return;
    }

    const prevBoard = prevBoardForFloatingTextRef.current;
    const prevPlayers = prevPlayersForFloatingTextRef.current;
    const newTexts: { id: string; tileIndex: number; text: string; type: 'bought' | 'rent' | 'built' | 'sold' | 'mortgaged' | 'jailed' | 'monopoly' | 'traded' | 'acquired' | 'festival' | 'salary' | 'airport' }[] = [];

    const addText = (tileIndex: number, text: string, type: 'bought' | 'rent' | 'built' | 'sold' | 'mortgaged' | 'jailed' | 'monopoly' | 'traded' | 'acquired' | 'festival' | 'salary' | 'airport') => {
      const id = `${type}_${tileIndex}_${Date.now()}_${Math.random()}`;
      newTexts.push({ id, tileIndex, text, type });
      setTimeout(() => {
        setTileFloatingTexts(prev => prev.filter(t => t.id !== id));
      }, 2300);
    };

    // 1. Check for Buy, Upgrade, Sell, Mortgage, and Unmortgage (tile changes)
    monopolyBoard.forEach(tile => {
      const prevTile = prevBoard.find(pt => pt.index === tile.index);
      if (!prevTile) return;

      // Purchase: owner went from null to a player ID
      if (tile.owner && !prevTile.owner) {
        addText(tile.index, 'Bought!', 'bought');
      }

      // Trade: owner changed from Player A to Player B (both non-null)
      if (tile.owner && prevTile.owner && tile.owner !== prevTile.owner) {
        if (lastActionDetail?.type === 'force-acquire' && lastActionDetail?.tileIndex === tile.index) {
          addText(tile.index, 'Acquired!', 'acquired');
        } else {
          addText(tile.index, 'Traded!', 'traded');
        }
      }

      // Festival active: turns left went from 0 (or undefined) to > 0
      if (tile.festivalTurns && tile.festivalTurns > 0 && (!prevTile || !prevTile.festivalTurns)) {
        addText(tile.index, 'Festival! 🎉', 'festival');
      }

      // Upgrade: houses count increased
      if (tile.houses > prevTile.houses && tile.owner) {
        const text = tile.houses === 5 ? 'Hotel!' : 'Built!';
        addText(tile.index, text, 'built');
      }

      // Sell house: houses count decreased
      if (tile.houses < prevTile.houses && tile.owner) {
        addText(tile.index, 'Sold!', 'sold');
      }

      // Mortgage: went from unmortgaged to mortgaged
      if (tile.mortgaged && !prevTile.mortgaged) {
        addText(tile.index, 'Mortgaged!', 'mortgaged');
      }

      // Unmortgage: went from mortgaged to unmortgaged
      if (!tile.mortgaged && prevTile.mortgaged) {
        addText(tile.index, 'Unmortgaged!', 'built'); // use built style
      }
    });

    // 2. Check for Rent ("Rent!") & Tax Payments
    players.forEach(p => {
      const prevP = prevPlayers.find(pp => pp.id === p.id);
      if (prevP && p.money < prevP.money) {
        // Cash decreased. Find player's current tile
        const currentTilePos = visualPositions[p.id] ?? p.position;
        const tile = monopolyBoard[currentTilePos];
        if (tile) {
          const isLandedOnOtherProperty = (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility')
            && tile.owner
            && tile.owner !== p.id;

          if (isLandedOnOtherProperty) {
            // Make sure they didn't just buy the property in this render (which also decreases cash)
            const justBought = newTexts.some(t => t.tileIndex === currentTilePos && t.type === 'bought');
            if (!justBought) {
              addText(currentTilePos, 'Rent!', 'rent');
            }
          }

          // Check if landed on a tax tile (Income Tax or Luxury Tax)
          if (tile.type === 'tax') {
            const isGetRich = rules && rules.ruleset === 'Get Rich';
            if (!isGetRich) {
              addText(currentTilePos, `${tile.name}!`, 'rent');
            }
          }
        }
      }
    });



    // 4. Check for Monopoly acquisition
    const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'] as const;
    colors.forEach(color => {
      const prevOwner = prevMonopolyColorGroupsRef.current[color] || null;
      const currentOwner = monopolyColorGroups[color] || null;
      if (currentOwner && currentOwner !== prevOwner) {
        // Find all tiles of this color
        monopolyBoard.forEach(tile => {
          if (tile.type === 'property' && tile.color === color) {
            addText(tile.index, 'Monopoly!', 'monopoly');
          }
        });
      }
    });

    if (newTexts.length > 0) {
      setTileFloatingTexts(prev => [...prev, ...newTexts]);
    }

    prevBoardForFloatingTextRef.current = monopolyBoard;
    prevPlayersForFloatingTextRef.current = players;
    prevMonopolyColorGroupsRef.current = { ...monopolyColorGroups };
  }, [monopolyBoard, players, gameState, visualPositions, monopolyColorGroups, lastActionDetail]);

  // Mouse drag panning handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only allow left-click dragging

    // Do not initiate drag if clicking on buttons or modals/overlays
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('.corner-card') ||
      target.closest('.monopoly-unified-hud-bottom') ||
      target.closest('.deed-card') ||
      target.closest('.glass-panel') ||
      target.closest('.drawn-card-popup') ||
      target.closest('.deed-card-modal-backdrop') ||
      target.closest('.player-detail-modal') ||
      target.closest('.build-manager-modal')
    ) {
      return;
    }

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialCameraRef.current = { x: defaultCameraX, y: defaultCameraY };
    setIsDragging(true);
    setCameraTransition('0s');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      if (!isCameraManual) {
        setIsCameraManual(true);
      }
    }

    // Rotate screen coordinates by -45 degrees to align with rotated board local X/Y axes
    const angle = -45 * Math.PI / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Account for perspective tilt: screen Y movement is squashed by cos(42deg) = 0.743
    const tiltFactor = 0.743;
    const adjustedDy = dy / tiltFactor;

    // Scale movement speed relative to zoom scale (higher zoom = smaller board translation delta)
    const localDx = (dx * cosA - adjustedDy * sinA) / cameraScale;
    const localDy = (dx * sinA + adjustedDy * cosA) / cameraScale;

    let newX = initialCameraRef.current.x + localDx;
    let newY = initialCameraRef.current.y + localDy;

    // Elastic drag calculation (limit drag radius)
    const maxDist = 400;
    const dist = Math.sqrt(newX * newX + newY * newY);
    if (dist > maxDist) {
      const overDist = dist - maxDist;
      const elasticDist = maxDist + Math.log(overDist + 1) * 25;
      newX = (newX / dist) * elasticDist;
      newY = (newY / dist) * elasticDist;
    }

    setDefaultCameraX(newX);
    setDefaultCameraY(newY);

    // Apply changes to active camera instantly
    setCameraX(newX);
    setCameraY(newY);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setCameraTransition('0.4s');

      // Pull back if straying too far
      const maxDist = 400;
      let finalX = defaultCameraX;
      let finalY = defaultCameraY;

      const dist = Math.sqrt(finalX * finalX + finalY * finalY);
      if (dist > maxDist) {
        finalX = (finalX / dist) * maxDist;
        finalY = (finalY / dist) * maxDist;

        setDefaultCameraX(finalX);
        setDefaultCameraY(finalY);
        setCameraX(finalX);
        setCameraY(finalY);
      }
    }
  };

  // Touch-based camera handlers (drag panning and pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('.corner-card') ||
      target.closest('.monopoly-unified-hud-bottom') ||
      target.closest('.deed-card') ||
      target.closest('.glass-panel') ||
      target.closest('.drawn-card-popup') ||
      target.closest('.deed-card-modal-backdrop') ||
      target.closest('.player-detail-modal') ||
      target.closest('.build-manager-modal')
    ) {
      return;
    }

    if (e.touches.length === 1) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialCameraRef.current = { x: defaultCameraX, y: defaultCameraY };
      setIsDragging(true);
      setCameraTransition('0s');
      touchStartDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchStartDistanceRef.current = dist;
      touchStartScaleRef.current = defaultCameraScale;
      setCameraTransition('0.05s');
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDragging && touchStartDistanceRef.current === null) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (!isCameraManual) {
          setIsCameraManual(true);
        }
      }

      const angle = -45 * Math.PI / 180;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const tiltFactor = 0.743;
      const adjustedDy = dy / tiltFactor;

      const localDx = (dx * cosA - adjustedDy * sinA) / cameraScale;
      const localDy = (dx * sinA + adjustedDy * cosA) / cameraScale;

      let newX = initialCameraRef.current.x + localDx;
      let newY = initialCameraRef.current.y + localDy;

      const maxDist = 400;
      const dist = Math.sqrt(newX * newX + newY * newY);
      if (dist > maxDist) {
        const overDist = dist - maxDist;
        const elasticDist = maxDist + Math.log(overDist + 1) * 25;
        newX = (newX / dist) * elasticDist;
        newY = (newY / dist) * elasticDist;
      }

      setDefaultCameraX(newX);
      setDefaultCameraY(newY);
      setCameraX(newX);
      setCameraY(newY);
    } else if (e.touches.length === 2 && touchStartDistanceRef.current !== null) {
      if (e.cancelable) {
        e.preventDefault();
      }

      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (touchStartDistanceRef.current > 0) {
        const ratio = dist / touchStartDistanceRef.current;
        const newScale = Math.min(2.5, Math.max(0.4, touchStartScaleRef.current * ratio));
        setDefaultCameraScale(newScale);
        setCameraScale(newScale);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) {
      if (isDragging) {
        setIsDragging(false);
        setCameraTransition('0.4s');

        const maxDist = 400;
        let finalX = defaultCameraX;
        let finalY = defaultCameraY;

        const dist = Math.sqrt(finalX * finalX + finalY * finalY);
        if (dist > maxDist) {
          finalX = (finalX / dist) * maxDist;
          finalY = (finalY / dist) * maxDist;

          setDefaultCameraX(finalX);
          setDefaultCameraY(finalY);
          setCameraX(finalX);
          setCameraY(finalY);
        }
      }
      touchStartDistanceRef.current = null;
    } else if (e.touches.length === 1) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialCameraRef.current = { x: defaultCameraX, y: defaultCameraY };
      setIsDragging(true);
      touchStartDistanceRef.current = null;
    }
  };

  // Scroll to Zoom Wheel event listener (raw attachment to support passive: false preventDefault)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelEvent = (e: WheelEvent) => {
      // Do not zoom if scrolling inside scrollable lists/modals
      const target = e.target as HTMLElement;
      if (
        target.closest('.monopoly-build-sections-container') ||
        target.closest('.unified-hud-portfolio-list')
      ) {
        return;
      }

      e.preventDefault();
      const zoomFactor = 0.04;
      const direction = e.deltaY < 0 ? 1 : -1;

      setDefaultCameraScale(prev => {
        const newScale = Math.min(2.5, Math.max(0.4, prev + direction * zoomFactor));
        return newScale;
      });

      setCameraTransition('0.1s'); // small fast transition for smooth scrolling zoom
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, []);

  // Update active zoom scale when default camera scale is changed via wheel scroll
  useEffect(() => {
    if ((isOverview || isCameraManual) && !isDragging) {
      setCameraScale(defaultCameraScale);
    }
  }, [defaultCameraScale, isOverview, isCameraManual, isDragging]);

  // Animation state calculation & synchronization
  const isAnyoneMoving = players.some(p => visualPositions[p.id] !== undefined && visualPositions[p.id] !== p.position);
  const isAnimating = isDiceRolling || Object.keys(hopTimersRef.current).length > 0 || isCameraLocked || isJailingInProgress || !!jailAnimationPlayerId || isAnyoneMoving;

  useEffect(() => {
    if (onAnimationStateChange) {
      onAnimationStateChange(isAnimating);
    }
  }, [isAnimating, onAnimationStateChange]);

  useEffect(() => {
    if (onVisualPositionsChange) {
      onVisualPositionsChange(visualPositions);
    }
  }, [visualPositions, onVisualPositionsChange]);

  // Auto-open Build/Mortgage panel when landing on owned properties
  useEffect(() => {
    if (gameState === 'playing' && monopolyPhase === 'end_turn' && activePlayer?.id === playerId && !isAnimating) {
      const activeTilePos = visualPositions[activePlayer.id];
      if (activeTilePos === activePlayer.position) {
        const turnKey = `${activePlayer.id}-${activePlayer.rollCount}-${activeTilePos}`;
        if (lastAutoOpenRef.current !== turnKey) {
          const tile = monopolyBoard[activeTilePos];
          if (tile && tile.owner === playerId && tile.type === 'property' && !tile.mortgaged && tile.houses < 5 && tile.color) {
            const isFullMonopoly = monopolyColorGroups[tile.color] === playerId;
            const hasEnoughMoney = activePlayer.money >= (tile.housePrice || 0);
            if (isFullMonopoly && hasEnoughMoney) {
              setIsBuildManagerOpen(true);
            }
            lastAutoOpenRef.current = turnKey;
          }
        }
      }
    }
  }, [monopolyPhase, activePlayer, playerId, gameState, monopolyBoard, visualPositions, isAnimating, monopolyColorGroups]);

  // Auto-open Build/Mortgage panel when purchasing an upgradable property
  useEffect(() => {
    if (gameState !== 'playing' || monopolyBoard.length === 0 || !activePlayer || activePlayer.id !== playerId) {
      prevBoardForBuyDetectRef.current = monopolyBoard;
      return;
    }

    const prevBoard = prevBoardForBuyDetectRef.current;
    if (prevBoard && prevBoard.length > 0) {
      const activeTilePos = activePlayer.position;
      const currentTile = monopolyBoard[activeTilePos];
      const prevTile = prevBoard.find(t => t.index === activeTilePos);

      if (currentTile && prevTile) {
        // If owner went from null to playerId, it means we just bought it!
        if (prevTile.owner === null && currentTile.owner === playerId) {
          // Only open if the purchased tile is a street and doesn't already have a hotel
          if (currentTile.type === 'property' && currentTile.houses < 5 && currentTile.color) {
            const isFullMonopoly = monopolyColorGroups[currentTile.color] === playerId;
            const hasEnoughMoney = activePlayer.money >= (currentTile.housePrice || 0);
            if (isFullMonopoly && hasEnoughMoney) {
              setIsBuildManagerOpen(true);
            }
          }
        }
      }
    }
    prevBoardForBuyDetectRef.current = monopolyBoard;
  }, [monopolyBoard, gameState, activePlayer, playerId, monopolyColorGroups]);

  // Synchronize player status ('managing', 'trading', or null) with the server safely without loops
  const lastSentStatusRef = useRef<'managing' | 'trading' | null>(null);
  useEffect(() => {
    if (gameState !== 'playing') return;

    let status: 'managing' | 'trading' | null = null;
    if (isBuildManagerOpen) {
      status = 'managing';
    } else if (isTradeEditorOpen) {
      status = 'trading';
    }

    if (status !== lastSentStatusRef.current) {
      lastSentStatusRef.current = status;
      onMonopolyAction('set-player-status', status);
    }
  }, [isBuildManagerOpen, isTradeEditorOpen, gameState, onMonopolyAction]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(hopTimersRef.current).forEach(t => clearTimeout(t));
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
    };
  }, []);

  // Filter player properties to show build manager options
  const myProperties = useMemo(() => {
    return monopolyBoard.filter(t => t.owner === playerId && (t.type === 'property' || t.type === 'railroad' || t.type === 'utility'));
  }, [monopolyBoard, playerId]);

  // Group player properties by type/color for build manager
  const groupedProperties = useMemo(() => {
    const groups: Record<string, TileState[]> = {
      'brown': [], 'lightblue': [], 'pink': [], 'orange': [],
      'red': [], 'yellow': [], 'green': [], 'darkblue': [],
      'railroad': [], 'utility': []
    };
    myProperties.forEach(tile => {
      if (tile.type === 'property' && tile.color) {
        groups[tile.color].push(tile);
      } else if (tile.type === 'railroad') {
        groups['railroad'].push(tile);
      } else if (tile.type === 'utility') {
        groups['utility'].push(tile);
      }
    });
    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  }, [myProperties]);

  // Memoized rank calculator based on net worth
  const playersWithRanks = useMemo(() => {
    const sorted = [...players]
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => {
        if (a.p.bankrupt && !b.p.bankrupt) return 1;
        if (!a.p.bankrupt && b.p.bankrupt) return -1;
        return (b.p.netWorth || 0) - (a.p.netWorth || 0);
      });

    const ranks: Record<string, number> = {};
    let rank = 1;
    sorted.forEach((item) => {
      if (item.p.bankrupt) {
        ranks[item.p.id] = 4;
      } else {
        ranks[item.p.id] = rank++;
      }
    });
    return ranks;
  }, [players]);

  const getSpecialTileContent = (tile: TileState) => {
    if (tile.type === 'go') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.15))' }}>🏁</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a' }}>GO</span>
          <span style={{ fontSize: '0.45rem', color: '#64748b', fontWeight: 'bold' }}>COLLECT $200</span>
        </div>
      );
    }
    if (tile.type === 'jail') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#0f172a' }}>IN JAIL</span>
          <span style={{ fontSize: '0.45rem', color: '#64748b', fontWeight: 'bold' }}>JUST VISITING</span>
        </div>
      );
    }
    if (tile.type === 'parking') {
      if (rules?.ruleset === 'Get Rich') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>🎉</span>
            <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#d97706' }}>FESTIVAL</span>
            <span style={{ fontSize: '0.42rem', color: '#64748b', fontWeight: 'bold' }}>BOOST RENT x2</span>
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>🚗</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#0f172a' }}>FREE</span>
          <span style={{ fontSize: '0.45rem', color: '#64748b', fontWeight: 'bold' }}>PARKING</span>
        </div>
      );
    }
    if (tile.type === 'gotojail') {
      if (rules?.ruleset === 'Get Rich') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>✈️</span>
            <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#3b82f6' }}>AIRPORT</span>
            <span style={{ fontSize: '0.42rem', color: '#64748b', fontWeight: 'bold' }}>PAY $100 TO FLY</span>
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>👮</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#ef4444' }}>GO TO</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#ef4444' }}>JAIL</span>
        </div>
      );
    }
    if (tile.type === 'chance') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span className="premium-emoji-shake" style={{ fontSize: '1.75rem', color: '#ef4444', fontWeight: 950, display: 'inline-block' }}>❓</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ef4444' }}>CHANCE</span>
        </div>
      );
    }
    if (tile.type === 'chest') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span className="premium-emoji-shake" style={{ fontSize: '1.5rem', display: 'inline-block' }}>🧰</span>
          <span style={{ fontSize: '0.45rem', fontWeight: 800, color: '#3b82f6', textAlign: 'center', lineHeight: 1.1 }}>COMMUNITY CHEST</span>
        </div>
      );
    }
    if (tile.type === 'railroad') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>🚂</span>
          <span style={{ fontSize: '0.5rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1, color: '#0f172a' }}>{tile.name}</span>
        </div>
      );
    }
    if (tile.type === 'utility') {
      const isBali = tile.name.toLowerCase().includes('bali');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>{isBali ? '🌴' : '🌊'}</span>
          <span style={{ fontSize: '0.5rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1, color: '#0f172a' }}>{tile.name}</span>
        </div>
      );
    }
    if (tile.type === 'tax') {
      const isGetRich = rules && rules.ruleset === 'Get Rich';
      if (isGetRich) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }}>
            <span style={{ fontSize: '1.25rem' }}>🎰</span>
            <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#fbbf24', textAlign: 'center', width: '100%', display: 'block' }}>CASINO</span>
            <span style={{ fontSize: '0.45rem', color: '#fbbf24', fontWeight: 'bold', textAlign: 'center', width: '100%', display: 'block' }}>Flip to Win/Lose</span>
          </div>
        );
      }
      const isIncome = tile.name.includes('Income');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }}>
          <span style={{ fontSize: '1.25rem' }}>{isIncome ? '💸' : '💎'}</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ef4444', textAlign: 'center', width: '100%', display: 'block' }}>{tile.name}</span>
          <span style={{ fontSize: '0.5rem', color: '#ef4444', fontWeight: 'bold', textAlign: 'center', width: '100%', display: 'block' }}>Pay ${tile.price}</span>
        </div>
      );
    }
    return null;
  };

  const getPlayerColor = (ownerId: string | null) => {
    if (!ownerId) return '#cbd5e1';
    const idx = players.findIndex(p => p.id === ownerId);
    if (idx === 0) return '#3b82f6'; // Blue
    if (idx === 1) return '#10b981'; // Green
    if (idx === 2) return '#ef4444'; // Red
    if (idx === 3) return '#eab308'; // Yellow
    return '#8b5cf6'; // Default Violet
  };

  const getPlayerColorTint = (ownerId: string | null) => {
    if (!ownerId) return undefined;
    const idx = players.findIndex(p => p.id === ownerId);
    if (idx === 0) return 'rgba(59, 130, 246, 0.15)'; // Blue tint
    if (idx === 1) return 'rgba(16, 185, 129, 0.15)'; // Green tint
    if (idx === 2) return 'rgba(239, 68, 68, 0.15)';   // Red tint
    if (idx === 3) return 'rgba(234, 179, 8, 0.15)';  // Yellow tint
    return 'rgba(139, 92, 246, 0.15)'; // Violet tint
  };

  const activeLandedTile = activePlayer ? monopolyBoard[visualPositions[activePlayer.id] ?? activePlayer.position] : null;

  return (
    <div
      ref={containerRef}
      className="monopoly-table-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {introTransitionActive && (
        <div className="monopoly-intro-overlay">
          <div className={`monopoly-intro-curtain-left ${curtainOpen ? 'open' : ''}`} />
          <div className={`monopoly-intro-curtain-right ${curtainOpen ? 'open' : ''}`} />
          {introCountdown && (
            <div className={`monopoly-intro-countdown-text ${introCountdown === 'Roll!' ? 'roll-text' : ''}`}>
              {introCountdown}
            </div>
          )}
        </div>
      )}
      {/* Premium Rotating Background Rings */}
      <div className="monopoly-ambient-bg">
        <div className="bg-glow-ring" />
        <div className="bg-glow-ring-alt" />
      </div>

      {/* Dynamic Camera properties bound to CSS variables of tilted wrapper */}
      <div
        className="monopoly-board-wrapper"
        style={{
          ['--board-x' as any]: `${cameraX}px`,
          ['--board-y' as any]: `${cameraY}px`,
          ['--board-scale' as any]: cameraScale,
          ['--camera-transition' as any]: cameraTransition
        }}
      >
        <div className={`monopoly-board-tilt ${cameraShake ? 'camera-shake' : ''}`}>

          {/* 3D Money Stacks layer on tabletop middle sides */}
          {players.map((p, idx) => {
            if (p.bankrupt) return null;

            let stackStyle: React.CSSProperties = {};
            if (idx === 0) { stackStyle = { top: '-110px', left: '50%', transform: 'translateX(-50%)' }; }
            else if (idx === 1) { stackStyle = { top: '50%', right: '-200px', transform: 'translateY(-50%) rotateZ(90deg)' }; }
            else if (idx === 2) { stackStyle = { bottom: '-110px', left: '50%', transform: 'translateX(-50%)' }; }
            else if (idx === 3) { stackStyle = { top: '50%', left: '-200px', transform: 'translateY(-50%) rotateZ(-90deg)' }; }

            const cash = (activeChanges[p.id] !== undefined)
              ? (p.money || 0)
              : (displayMoney[p.id] !== undefined ? displayMoney[p.id] : (p.money || 0));

            // Dynamic realistic Monopoly cash breakdown by denomination
            let tempCash = cash;
            const num500 = Math.floor(tempCash / 500);
            tempCash %= 500;
            const num100 = Math.floor(tempCash / 100);
            tempCash %= 100;
            const num50 = Math.floor(tempCash / 50);
            tempCash %= 50;
            const num10 = Math.floor(tempCash / 10);

            const stacks: { val: number; count: number }[] = [];
            if (num500 > 0) stacks.push({ val: 500, count: Math.min(8, num500) });
            if (num100 > 0) stacks.push({ val: 100, count: Math.min(8, num100) });
            if (num50 > 0) stacks.push({ val: 50, count: Math.min(8, num50) });
            if (num10 > 0) stacks.push({ val: 10, count: Math.min(8, num10) });

            if (stacks.length === 0 && cash > 0) {
              stacks.push({ val: 10, count: 1 });
            }

            const playerColor = getPlayerColor(p.id);
            const labelRotZ = idx === 1 ? -135 : idx === 3 ? 45 : -45;
            const hasChange = !!activeChanges[p.id];
            const changeInfo = activeChanges[p.id];

            return (
              <div
                key={`table_stack_${p.id}`}
                className="table-money-stack-container"
                style={{ ...stackStyle, ['--owner-color' as any]: playerColor }}
              >
                <div style={{ display: 'flex', gap: '16px', transformStyle: 'preserve-3d', alignItems: 'flex-end' }}>
                  {stacks.map((stack, sIdx) => (
                    <div
                      key={sIdx}
                      className="table-money-stack"
                      style={{ transformStyle: 'preserve-3d', position: 'relative' }}
                    >
                      {/* 3D Bill stack */}
                      {Array.from({ length: stack.count }).map((_, bIdx) => (
                        <div
                          key={bIdx}
                          className={`table-bill val-${stack.val}`}
                          style={{
                            transform: `translate3d(0, 0, ${bIdx * 2.5}px) rotateZ(${bIdx % 2 === 0 ? 3 : -3}deg)`
                          }}
                        >
                          <div className="table-bill-inner">
                            <div className="table-bill-ellipse">
                              <span className="table-bill-center-val">M</span>
                            </div>
                            <span className="table-bill-corner tl">{stack.val}</span>
                            <span className="table-bill-corner tr">{stack.val}</span>
                            <span className="table-bill-corner bl">{stack.val}</span>
                            <span className="table-bill-corner br">{stack.val}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* 3D Special Keep-For-Later Cards */}
                  {((p.getOutOfJailCards || 0) > 0 || (p.freeTollCards || 0) > 0 || (p.oddEvenCards || 0) > 0 || (p.angelCards || 0) > 0) && (
                    <div className="table-3d-jailcard-stack">
                      {Array.from({ length: p.getOutOfJailCards || 0 }).map((_, cIdx) => (
                        <div
                          key={`jail_${cIdx}`}
                          className="table-3d-card jail-free-card"
                          style={{
                            transform: `translate3d(0, 0, ${cIdx * 3}px) rotateZ(${cIdx % 2 === 0 ? 4 : -4}deg) rotateX(15deg)`
                          }}
                        >
                          <div className="card-face-mini">Jail<br />Free</div>
                        </div>
                      ))}
                      {Array.from({ length: p.freeTollCards || 0 }).map((_, cIdx) => (
                        <div
                          key={`toll_${cIdx}`}
                          className="table-3d-card free-toll-card"
                          style={{
                            transform: `translate3d(8px, 0, ${cIdx * 3}px) rotateZ(${cIdx % 2 === 0 ? -4 : 4}deg) rotateX(15deg)`
                          }}
                        >
                          <div className="card-face-mini">Free<br />Toll</div>
                        </div>
                      ))}
                      {Array.from({ length: p.oddEvenCards || 0 }).map((_, cIdx) => (
                        <div
                          key={`oddeven_${cIdx}`}
                          className="table-3d-card odd-even-card"
                          style={{
                            transform: `translate3d(16px, 0, ${cIdx * 3}px) rotateZ(${cIdx % 2 === 0 ? 4 : -4}deg) rotateX(15deg)`
                          }}
                        >
                          <div className="card-face-mini">Odd<br />Even</div>
                        </div>
                      ))}
                      {Array.from({ length: p.angelCards || 0 }).map((_, cIdx) => (
                        <div
                          key={`angel_${cIdx}`}
                          className="table-3d-card angel-card"
                          style={{
                            transform: `translate3d(24px, 0, ${cIdx * 3}px) rotateZ(${cIdx % 2 === 0 ? -4 : 4}deg) rotateX(15deg)`
                          }}
                        >
                          <div className="card-face-mini">Angel</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Big number of change above the stacks standing upright */}
                {changeInfo && (
                  <div
                    className={`table-stack-change ${changeInfo.diff >= 0 ? 'positive' : 'negative'}`}
                    style={{
                      position: 'absolute',
                      bottom: '55px',
                      left: '50%',
                      marginLeft: '-40px',
                      width: '80px',
                      textAlign: 'center',
                      transform: `translate3d(0, 0, 60px) rotateZ(${labelRotZ}deg) rotateX(-42deg)`
                    }}
                  >
                    {changeInfo.currentDiff >= 0 ? '+' : '-'}${Math.abs(changeInfo.currentDiff)}
                  </div>
                )}

                {/* Table Stack Label standing upright */}
                <div
                  className="table-stack-label"
                  style={{
                    transform: `translate3d(0, 0, 40px) rotateZ(${labelRotZ}deg) rotateX(-42deg) scale(${hasChange ? 1.45 : 1})`
                  }}
                >
                  <span className="table-player-name">
                    {p.name.substring(0, 5)}: ${displayMoney[p.id] !== undefined ? displayMoney[p.id] : p.money}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 3D Flying Bills */}
          {flyingBills.map(bill => (
            <div
              key={bill.id}
              className={`flying-bill table-bill val-${bill.val}`}
              style={{
                left: 0,
                top: 0,
                ['--start-x' as any]: `${bill.startX}px`,
                ['--start-y' as any]: `${bill.startY}px`,
                ['--start-z' as any]: `${bill.startZ}px`,
                ['--end-x' as any]: `${bill.endX}px`,
                ['--end-y' as any]: `${bill.endY}px`,
                ['--end-z' as any]: `${bill.endZ}px`,
                ['--rot-x-start' as any]: `${bill.rotXStart}deg`,
                ['--rot-y-start' as any]: `${bill.rotYStart}deg`,
                ['--rot-z-start' as any]: `${bill.rotZStart}deg`,
                ['--rot-x-end' as any]: `${bill.rotXEnd}deg`,
                ['--rot-y-end' as any]: `${bill.rotYEnd}deg`,
                ['--rot-z-end' as any]: `${bill.rotZEnd}deg`,
                animationDelay: `${bill.delay}ms`,
              }}
            >
              <div className="table-bill-inner">
                <div className="table-bill-ellipse">
                  <span className="table-bill-center-val">M</span>
                </div>
                <span className="table-bill-corner tl">{bill.val}</span>
                <span className="table-bill-corner tr">{bill.val}</span>
                <span className="table-bill-corner bl">{bill.val}</span>
                <span className="table-bill-corner br">{bill.val}</span>
              </div>
            </div>
          ))}

          <div className="monopoly-board-grid">
            {/* Board-wide dimming overlay removed so selectable tiles render at full original brightness */}

            {/* Render 40 board spaces */}
            {monopolyBoard.map((tile, idx) => {
              const { row, col } = getTileGridCoords(idx);
              const isCorner = tile.type === 'go' || tile.type === 'jail' || tile.type === 'parking' || tile.type === 'gotojail';

              // Edge classifiers
              let sideClass = '';
              if (idx >= 0 && idx <= 10) sideClass = 'bottom-row';
              else if (idx > 10 && idx <= 20) sideClass = 'left-col';
              else if (idx > 20 && idx <= 30) sideClass = 'top-row';
              else sideClass = 'right-col';

              const isHorizontal = sideClass === 'bottom-row' || sideClass === 'top-row';

              const isProp = tile.type === 'property';
              const ownerColor = tile.owner ? getPlayerColor(tile.owner) : '#cbd5e1';

              // Monopoly Outline Glowing check
              const monopolyOwner = isProp && tile.color ? monopolyColorGroups[tile.color] : null;
              const hasMonopoly = !!monopolyOwner;
              const glowColor = getPlayerColor(monopolyOwner);

              // Interactive highlighting for trade selection / views
              let isInteractive = true;
              let customHighlightStyle: React.CSSProperties = {};

              if (tradeBoardSelectionMode) {
                const targetPlayer = players.find(p => p.id === tradeTargetId);
                const isTradable = !isUpgradedGroup(tile) && (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility');

                if (tradeBoardSelectionMode === 'me') {
                  const isOwnedByMe = tile.owner === playerId && isTradable;
                  isInteractive = isOwnedByMe;
                  if (isOwnedByMe) {
                    const isSelected = offeredProperties.includes(idx);
                    customHighlightStyle = {
                      boxShadow: isSelected
                        ? 'inset 0 0 15px rgba(16, 185, 129, 0.9), 0 0 12px rgba(16, 185, 129, 0.9)'
                        : 'inset 0 0 5px rgba(255, 255, 255, 0.3)',
                      border: '3.5px solid #10b981',
                      background: isSelected ? '#ecfdf5' : undefined,
                      cursor: 'pointer',
                      opacity: 1,
                      zIndex: 95,
                      transform: 'translateZ(3px)'
                    };
                  } else {
                    customHighlightStyle = {
                      opacity: 0.55,
                      pointerEvents: 'none'
                    };
                  }
                } else if (tradeBoardSelectionMode === 'them' && targetPlayer) {
                  const isOwnedByThem = tile.owner === targetPlayer.id && isTradable;
                  isInteractive = isOwnedByThem;
                  if (isOwnedByThem) {
                    const isSelected = demandedProperties.includes(idx);
                    customHighlightStyle = {
                      boxShadow: isSelected
                        ? 'inset 0 0 15px rgba(59, 130, 246, 0.9), 0 0 12px rgba(59, 130, 246, 0.9)'
                        : 'inset 0 0 5px rgba(255, 255, 255, 0.3)',
                      border: '3.5px solid #3b82f6',
                      background: isSelected ? '#eff6ff' : undefined,
                      cursor: 'pointer',
                      opacity: 1,
                      zIndex: 95,
                      transform: 'translateZ(3px)'
                    };
                  } else {
                    customHighlightStyle = {
                      opacity: 0.55,
                      pointerEvents: 'none'
                    };
                  }
                }
              } else if (incomingTradeViewBoardMode && activeTrade) {
                const isOfferedByThem = activeTrade.senderProperties.includes(idx);
                const isDemandedByThem = activeTrade.receiverProperties.includes(idx);

                if (isOfferedByThem) {
                  customHighlightStyle = {
                    boxShadow: 'inset 0 0 20px rgba(16, 185, 129, 0.9), 0 0 15px rgba(16, 185, 129, 0.9)',
                    border: '4px solid #10b981',
                    background: '#ecfdf5',
                    opacity: 1,
                    zIndex: 95,
                    transform: 'translateZ(3px)'
                  };
                } else if (isDemandedByThem) {
                  customHighlightStyle = {
                    boxShadow: 'inset 0 0 20px rgba(239, 68, 68, 0.9), 0 0 15px rgba(239, 68, 68, 0.9)',
                    border: '4px solid #ef4444',
                    background: '#fef2f2',
                    opacity: 1,
                    zIndex: 95,
                    transform: 'translateZ(3px)'
                  };
                } else {
                  customHighlightStyle = {
                    opacity: 0.55,
                    pointerEvents: 'none'
                  };
                }
              } else if (!isAnimating && monopolyPhase === 'airport_selection' && activePlayer?.id === playerId) {
                const isEligible = (rules?.ruleset === 'Get Rich' || tile.type !== 'gotojail') && tile.index !== activePlayer.position;
                isInteractive = isEligible;
                if (isEligible) {
                  customHighlightStyle = {
                    boxShadow: 'inset 0 0 15px rgba(59, 130, 246, 0.8), 0 0 10px rgba(59, 130, 246, 0.8)',
                    border: '3.5px solid #3b82f6',
                    cursor: 'pointer',
                    opacity: 1,
                    zIndex: 95,
                    transform: 'translateZ(3px)'
                  };
                } else {
                  customHighlightStyle = {
                    opacity: 0.55,
                    pointerEvents: 'none'
                  };
                }
              } else if (!isAnimating && monopolyPhase === 'festival_selection' && activePlayer?.id === playerId) {
                const isOwnProperty = (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === playerId;
                isInteractive = isOwnProperty;
                if (isOwnProperty) {
                  customHighlightStyle = {
                    boxShadow: 'inset 0 0 15px rgba(245, 158, 11, 0.8), 0 0 10px rgba(245, 158, 11, 0.8)',
                    border: '3.5px solid #f59e0b',
                    cursor: 'pointer',
                    opacity: 1,
                    zIndex: 95,
                    transform: 'translateZ(3px)'
                  };
                } else {
                  customHighlightStyle = {
                    opacity: 0.55,
                    pointerEvents: 'none'
                  };
                }
              }

              let getRichStyle: React.CSSProperties = {};
              if (rules?.ruleset === 'Get Rich') {
                if (tile.type === 'parking') {
                  getRichStyle = {
                    background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                    border: '2.5px solid #0284c7',
                  };
                } else if (tile.type === 'gotojail') {
                  getRichStyle = {
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    border: '2.5px solid #d97706',
                  };
                }
              }

              return (
                <div
                  key={tile.index}
                  className={`monopoly-tile ${isCorner ? 'corner-tile' : 'side-tile'} ${isProp ? 'property-tile' : ''} ${sideClass} ${isHorizontal ? 'horizontal-tile' : 'vertical-tile'} ${idx === 10 ? 'jail-space' : ''} tile-${tile.type} ${activeLandedTile?.index === idx ? 'highlighted' : ''} ${hasMonopoly ? 'monopoly-glow' : ''}`}
                  style={{
                    gridRow: row,
                    gridColumn: col,
                    ['--monopoly-glow-color' as any]: glowColor,
                    ['--tile-owner-tint' as any]: getPlayerColorTint(tile.owner),
                    border: tile.owner ? `3.5px solid ${ownerColor}` : undefined,
                    ...getRichStyle,
                    ...customHighlightStyle
                  }}
                  onClick={() => {
                    if (tradeBoardSelectionMode) {
                      if (tradeBoardSelectionMode === 'me') {
                        if (tile.owner === playerId && !isUpgradedGroup(tile)) {
                          setOfferedProperties(prev =>
                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                          );
                          sfx.playTick();
                        }
                      } else if (tradeBoardSelectionMode === 'them') {
                        const targetPlayer = players.find(p => p.id === tradeTargetId);
                        if (targetPlayer && tile.owner === targetPlayer.id && !isUpgradedGroup(tile)) {
                          setDemandedProperties(prev =>
                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                          );
                          sfx.playTick();
                        }
                      }
                    } else if (incomingTradeViewBoardMode) {
                      // No-op during incoming trade visualization
                    } else if (!isAnimating && monopolyPhase === 'airport_selection' && activePlayer?.id === playerId) {
                      const isEligible = (rules?.ruleset === 'Get Rich' || tile.type !== 'gotojail') && tile.index !== activePlayer.position;
                      if (isEligible) {
                        onMonopolyAction('airport-fly', { targetIndex: idx });
                        sfx.playTick();
                      }
                    } else if (!isAnimating && monopolyPhase === 'festival_selection' && activePlayer?.id === playerId) {
                      const isOwnProperty = (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === playerId;
                      if (isOwnProperty) {
                        onMonopolyAction('festival-select', idx);
                        sfx.playTick();
                      }
                    } else {
                      if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
                        setSelectedDeedIndex(idx);
                      }
                    }
                  }}
                >
                  {/* Click overlay for board selection/view modes to prevent any inner elements from blocking hits */}
                  {(tradeBoardSelectionMode ||
                    incomingTradeViewBoardMode ||
                    (!isAnimating && monopolyPhase === 'airport_selection' && activePlayer?.id === playerId) ||
                    (!isAnimating && monopolyPhase === 'festival_selection' && activePlayer?.id === playerId)) && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          zIndex: 98,
                          transform: 'translateZ(5px)',
                          cursor: isInteractive ? 'pointer' : 'default',
                          pointerEvents: 'auto'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tradeBoardSelectionMode) {
                            if (tradeBoardSelectionMode === 'me') {
                              if (tile.owner === playerId && !isUpgradedGroup(tile)) {
                                setOfferedProperties(prev =>
                                  prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                );
                                sfx.playTick();
                              }
                            } else if (tradeBoardSelectionMode === 'them') {
                              const targetPlayer = players.find(p => p.id === tradeTargetId);
                              if (targetPlayer && tile.owner === targetPlayer.id && !isUpgradedGroup(tile)) {
                                setDemandedProperties(prev =>
                                  prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                );
                                sfx.playTick();
                              }
                            }
                          } else if (!isAnimating && monopolyPhase === 'airport_selection' && activePlayer?.id === playerId) {
                            const isEligible = (rules?.ruleset === 'Get Rich' || tile.type !== 'gotojail') && tile.index !== activePlayer.position;
                            if (isEligible) {
                              onMonopolyAction('airport-fly', { targetIndex: idx });
                              sfx.playTick();
                            }
                          } else if (!isAnimating && monopolyPhase === 'festival_selection' && activePlayer?.id === playerId) {
                            const isOwnProperty = (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === playerId;
                            if (isOwnProperty) {
                              onMonopolyAction('festival-select', idx);
                              sfx.playTick();
                            }
                          }
                        }}
                      />
                    )}
                  {/* Visual badges for trade interaction modes */}
                  {tradeBoardSelectionMode && isInteractive && (() => {
                    const isSelected = tradeBoardSelectionMode === 'me'
                      ? offeredProperties.includes(idx)
                      : demandedProperties.includes(idx);
                    return (
                      <div style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: isSelected ? (tradeBoardSelectionMode === 'me' ? '#10b981' : '#3b82f6') : 'rgba(255,255,255,0.8)',
                        color: isSelected ? 'white' : '#64748b',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        border: '1.5px solid #0f172a',
                        zIndex: 96,
                        transform: 'translateZ(4px)'
                      }}>
                        {isSelected ? '✓' : '+'}
                      </div>
                    );
                  })()}

                  {/* Visual badges for Airport and Festival active player modes */}
                  {!isAnimating && activePlayer?.id === playerId && (() => {
                    if (monopolyPhase === 'airport_selection') {
                      const isEligible = (rules?.ruleset === 'Get Rich' || tile.type !== 'gotojail') && tile.index !== activePlayer.position;
                      if (isEligible) {
                        return (
                          <div style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            background: '#3b82f6',
                            color: 'white',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            border: '1.5px solid #0f172a',
                            zIndex: 96,
                            transform: 'translateZ(4px)'
                          }}>
                            ✈️
                          </div>
                        );
                      }
                    }
                    if (monopolyPhase === 'festival_selection') {
                      const isOwnProperty = (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && tile.owner === playerId;
                      if (isOwnProperty) {
                        return (
                          <div style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            background: '#f59e0b',
                            color: 'white',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            border: '1.5px solid #0f172a',
                            zIndex: 96,
                            transform: 'translateZ(4px)'
                          }}>
                            🎉
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}

                  {incomingTradeViewBoardMode && activeTrade && (() => {
                    const isOfferedByThem = activeTrade.senderProperties.includes(idx);
                    const isDemandedByThem = activeTrade.receiverProperties.includes(idx);
                    if (isOfferedByThem) {
                      return (
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: '#10b981',
                          color: 'white',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          fontSize: '0.55rem',
                          fontWeight: 'bold',
                          border: '1.5px solid #0f172a',
                          zIndex: 96,
                          transform: 'translateZ(4px)',
                          whiteSpace: 'nowrap'
                        }}>
                          GET
                        </div>
                      );
                    }
                    if (isDemandedByThem) {
                      return (
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: '#ef4444',
                          color: 'white',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          fontSize: '0.55rem',
                          fontWeight: 'bold',
                          border: '1.5px solid #0f172a',
                          zIndex: 96,
                          transform: 'translateZ(4px)',
                          whiteSpace: 'nowrap'
                        }}>
                          GIVE
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Property Color strip */}
                  {isProp && tile.color && (
                    <div className={`color-bar tile-group-${tile.color}`} style={{ position: 'relative' }}>
                      {hasMonopoly && !tile.mortgaged && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '-3px',
                            left: '50%',
                            transform: 'translateX(-50%) translateZ(2px)',
                            background: '#fbbf24',
                            color: '#0f172a',
                            fontSize: '0.45rem',
                            fontWeight: 'bold',
                            padding: '1px 3px',
                            borderRadius: '3px',
                            border: '1px solid #0f172a',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          👑 x2 Rent
                        </div>
                      )}
                    </div>
                  )}

                  {/* Festival crown indicator on any boosted tile */}
                  {(tile as any).festivalTurns > 0 && !tile.mortgaged && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '4px',
                        left: '50%',
                        transform: 'translateX(-50%) translateZ(2px)',
                        background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                        color: 'white',
                        fontSize: '0.5rem',
                        fontWeight: 900,
                        padding: '2px 4px',
                        borderRadius: '4px',
                        border: '1.2px solid #7c2d12',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3), 0 0 4px #fbbf24',
                        zIndex: 90,
                        pointerEvents: 'none'
                      }}
                    >
                      👑 🎉 x2 ({(tile as any).festivalTurns}T)
                    </div>
                  )}

                  {/* Tile name and details */}
                  <div className="tile-info-container">
                    {isProp ? (
                      <>
                        <div className="tile-name">
                          {tile.name}
                        </div>
                        {/* Price */}
                        {!tile.owner && tile.price && (
                          <span className="tile-price">${tile.price}</span>
                        )}
                      </>
                    ) : (
                      getSpecialTileContent(tile)
                    )}
                  </div>

                  {/* Jail landing animation */}
                  {idx === 10 && jailAnimationPlayerId && (
                    <div className="jail-bars-animation-container">
                      <div className="jail-bar-gate">
                        <div className="jail-bar-rail top" />
                        <div className="jail-bar" />
                        <div className="jail-bar" />
                        <div className="jail-bar" />
                        <div className="jail-bar" />
                        <div className="jail-bar" />
                        <div className="jail-bar-rail bottom" />
                      </div>
                      <div className="jailed-text-popup">
                        Jailed!
                      </div>
                    </div>
                  )}

                  {/* Renders house and hotel models on property */}
                  {tile.houses > 0 && !tile.mortgaged && (
                    <div className={`tile-buildings-container ${tile.houses === 4 ? 'grid-layout' : ''}`}>
                      {tile.houses === 5 ? (
                        <div className="cube-3d hotel" style={{ ['--building-color' as any]: ownerColor }}>
                          <div className="cube-face face-bottom" />
                          <div className="cube-face face-front" />
                          <div className="cube-face face-back" />
                          <div className="cube-face face-left" />
                          <div className="cube-face face-right" />
                          <div className="cube-face face-top" />
                        </div>
                      ) : (
                        Array.from({ length: tile.houses }).map((_, hIdx) => (
                          <div key={hIdx} className="cube-3d house" style={{ ['--building-color' as any]: ownerColor }}>
                            <div className="cube-face face-bottom" />
                            <div className="cube-face face-front" />
                            <div className="cube-face face-back" />
                            <div className="cube-face face-left" />
                            <div className="cube-face face-right" />
                            <div className="cube-face face-top" />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Mortgaged tag */}
                  {tile.mortgaged && (
                    <div className="tile-mortgaged-badge">MORTGAGED</div>
                  )}

                  {/* Player Directional Pointers on outer border */}
                  {players.filter(p => !p.bankrupt && (visualPositions[p.id] ?? p.position) === tile.index).map((p, pIdx, arr) => {
                    const color = getPlayerColor(p.id);
                    let pointerStyle: React.CSSProperties = {};
                    const offset = (pIdx - (arr.length - 1) / 2) * 12;
                    let pointerTransform = 'translateZ(3px)';

                    if (sideClass === 'bottom-row' || (sideClass === 'right-col' && tile.index === 10)) {
                      pointerStyle = { bottom: '-15px', left: `calc(50% + ${offset}px)` };
                      pointerTransform = 'rotate(180deg) translateZ(3px)';
                    } else if (sideClass === 'top-row' || (sideClass === 'left-col' && tile.index === 30)) {
                      pointerStyle = { top: '-15px', left: `calc(50% + ${offset}px)` };
                      pointerTransform = 'translateZ(3px)';
                    } else if (sideClass === 'left-col' || (sideClass === 'bottom-row' && tile.index === 20)) {
                      pointerStyle = { left: '-15px', top: `calc(50% + ${offset}px)` };
                      pointerTransform = 'rotate(-90deg) translateZ(3px)';
                    } else {
                      pointerStyle = { right: '-15px', top: `calc(50% + ${offset}px)` };
                      pointerTransform = 'rotate(90deg) translateZ(3px)';
                    }

                    // Adjust for exact corner pieces
                    if (tile.index === 0) {
                      pointerStyle = { bottom: '-15px', left: `calc(50% + ${offset}px)` };
                      pointerTransform = 'rotate(180deg) translateZ(3px)';
                    }
                    if (tile.index === 10) {
                      pointerStyle = { left: '-15px', top: `calc(50% + ${offset}px)` };
                      pointerTransform = 'rotate(-90deg) translateZ(3px)';
                    }
                    if (tile.index === 20) {
                      pointerStyle = { top: '-15px', left: `calc(50% + ${offset}px)` };
                      pointerTransform = 'translateZ(3px)';
                    }
                    if (tile.index === 30) {
                      pointerStyle = { right: '-15px', top: `calc(50% + ${offset}px)` };
                      pointerTransform = 'rotate(90deg) translateZ(3px)';
                    }

                    return (
                      <div
                        key={`pointer_${p.id}`}
                        style={{
                          position: 'absolute',
                          ...pointerStyle,
                          transform: pointerTransform,
                          width: '0',
                          height: '0',
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: `8px solid ${color}`,
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                          zIndex: 105
                        }}
                      />
                    );
                  })}

                  {/* Floating Action Text above tile */}
                  {tileFloatingTexts.filter(t => t.tileIndex === tile.index).map(t => (
                    <div key={t.id} className="tile-action-popup-wrapper">
                      <div className={`tile-action-popup ${t.type}`}>
                        {t.text}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Central Board elements */}
            <div className="monopoly-board-center">
              {/* Central dimming overlay during trade selection / incoming trade views */}
              {(tradeBoardSelectionMode || incomingTradeViewBoardMode) && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.22)',
                    zIndex: 89,
                    pointerEvents: 'none',
                    transform: 'translateZ(0.5px)'
                  }}
                />
              )}
              {/* Scrolling City Skyline Background */}
              <div className="board-center-scrolling-city">
                <div className="scrolling-city-diagonal-wrapper">
                  {/* Rotating Sun Graphic */}
                  <div className="background-sun-container">
                    <svg className="spinning-sun-svg" viewBox="0 0 100 100">
                      <g fill="#fde047" opacity="0.85">
                        <path d="M 50 10 L 54 36 L 46 36 Z" />
                        <path d="M 50 90 L 54 64 L 46 64 Z" />
                        <path d="M 10 50 L 36 54 L 36 46 Z" />
                        <path d="M 90 50 L 64 54 L 64 46 Z" />
                        <path d="M 22 22 L 40 38 L 36 42 Z" />
                        <path d="M 78 78 L 60 62 L 64 58 Z" />
                        <path d="M 78 22 L 62 40 L 58 36 Z" />
                        <path d="M 22 78 L 38 60 L 42 64 Z" />
                      </g>
                      <circle cx="50" cy="50" r="18" fill="url(#sunGradient)" />
                      <defs>
                        <radialGradient id="sunGradient" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ffffff" />
                          <stop offset="45%" stopColor="#fef08a" />
                          <stop offset="90%" stopColor="#facc15" />
                          <stop offset="100%" stopColor="#eab308" />
                        </radialGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="scrolling-clouds-ribbon">
                    <div className="clouds-panel">
                      <span className="cloud-item c1" style={{ top: '35%', left: '5%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c2" style={{ top: '15%', left: '20%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c3" style={{ top: '45%', left: '35%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c4" style={{ top: '25%', left: '50%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c5" style={{ top: '40%', left: '65%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c6" style={{ top: '10%', left: '80%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c7" style={{ top: '30%', left: '90%', position: 'absolute' }}>☁️</span>
                    </div>
                    <div className="clouds-panel">
                      <span className="cloud-item c1" style={{ top: '35%', left: '5%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c2" style={{ top: '15%', left: '20%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c3" style={{ top: '45%', left: '35%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c4" style={{ top: '25%', left: '50%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c5" style={{ top: '40%', left: '65%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c6" style={{ top: '10%', left: '80%', position: 'absolute' }}>☁️</span>
                      <span className="cloud-item c7" style={{ top: '30%', left: '90%', position: 'absolute' }}>☁️</span>
                    </div>
                  </div>
                  <div className="scrolling-city-ribbon">
                    <svg className="city-svg-ribbon" viewBox="0 0 1000 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                      <path d="M0 120 H1000 V80 H950 V95 H920 V85 H880 V90 H840 V75 H810 V95 H780 V70 H740 V85 H710 V60 H670 V85 H630 V80 H600 V95 H570 V85 H530 V90 H490 V75 H460 V95 H430 V70 H390 V85 H360 V60 H320 V85 H280 V80 H250 V95 H220 V85 H180 V90 H140 V75 H110 V95 H80 V70 H40 V85 H10 V60 Z" fill="#cbd5e1" opacity="0.4" />
                      <path d="M0 120 H1000 V95 H970 V105 H930 V100 H900 V105 H860 V90 H820 V105 H790 V95 H750 V102 H720 V90 H680 V105 H640 V95 H610 V105 H570 V100 H540 V105 H500 V90 H460 V105 H430 V95 H390 V102 H360 V90 H320 V105 H280 V95 H251 V105 H211 V100 H181 V105 H141 V90 H101 V105 H71 V95 H31 V102 H1 V90 Z" fill="#94a3b8" opacity="0.6" />
                      <path d="M0 120 H1000 V110 H990 V114 H960 V108 H940 V112 H910 V105 H880 V113 H850 V108 H830 V112 H800 V110 H770 V114 H740 V108 H720 V112 H690 V105 H660 V113 H630 V108 H610 V112 H580 V110 H550 V114 H520 V108 H500 V112 H470 V105 H440 V113 H410 V108 H390 V112 H360 V110 H330 V114 H300 V108 H280 V112 H250 V105 H220 V113 H190 V108 H170 V112 H140 V110 H110 V114 H80 V108 H60 V112 H30 V105 H0 Z" fill="#64748b" opacity="0.8" />
                    </svg>
                    <svg className="city-svg-ribbon" viewBox="0 0 1000 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                      <path d="M0 120 H1000 V80 H950 V95 H920 V85 H880 V90 H840 V75 H810 V95 H780 V70 H740 V85 H710 V60 H670 V85 H630 V80 H600 V95 H570 V85 H530 V90 H490 V75 H460 V95 H430 V70 H390 V85 H360 V60 H320 V85 H280 V80 H250 V95 H220 V85 H180 V90 H140 V75 H110 V95 H80 V70 H40 V85 H10 V60 Z" fill="#cbd5e1" opacity="0.4" />
                      <path d="M0 120 H1000 V95 H970 V105 H930 V100 H900 V105 H860 V90 H820 V105 H790 V95 H750 V102 H720 V90 H680 V105 H640 V95 H610 V105 H570 V100 H540 V105 H500 V90 H460 V105 H430 V95 H390 V102 H360 V90 H320 V105 H280 V95 H251 V105 H211 V100 H181 V105 H141 V90 H101 V105 H71 V95 H31 V102 H1 V90 Z" fill="#94a3b8" opacity="0.6" />
                      <path d="M0 120 H1000 V110 H990 V114 H960 V108 H940 V112 H910 V105 H880 V113 H850 V108 H830 V112 H800 V110 H770 V114 H740 V108 H720 V112 H690 V105 H660 V113 H630 V108 H610 V112 H580 V110 H550 V114 H520 V108 H500 V112 H470 V105 H440 V113 H410 V108 H390 V112 H360 V110 H330 V114 H300 V108 H280 V112 H250 V105 H220 V113 H190 V108 H170 V112 H140 V110 H110 V114 H80 V108 H60 V112 H30 V105 H0 Z" fill="#64748b" opacity="0.8" />
                    </svg>
                  </div>
                  <div className="scrolling-trees-ribbon">
                    <div className="trees-panel">
                      <div className="city-tree-sway t1" style={{ bottom: '15%', left: '5%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t2" style={{ bottom: '30%', left: '15%', position: 'absolute' }}>🌲</div>
                      <div className="city-tree-sway t3" style={{ bottom: '10%', left: '28%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t4" style={{ bottom: '25%', left: '40%', position: 'absolute' }}>🌲</div>
                      <div className="city-tree-sway t5" style={{ bottom: '15%', left: '52%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t1" style={{ bottom: '35%', left: '65%', position: 'absolute' }}>🌲</div>
                      <div className="city-tree-sway t2" style={{ bottom: '12%', left: '78%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t3" style={{ bottom: '28%', left: '90%', position: 'absolute' }}>🌲</div>
                    </div>
                    <div className="trees-panel">
                      <div className="city-tree-sway t1" style={{ bottom: '15%', left: '5%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t2" style={{ bottom: '30%', left: '15%', position: 'absolute' }}>🌲</div>
                      <div className="city-tree-sway t3" style={{ bottom: '10%', left: '28%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t4" style={{ bottom: '25%', left: '40%', position: 'absolute' }}>🌲</div>
                      <div className="city-tree-sway t5" style={{ bottom: '15%', left: '52%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t1" style={{ bottom: '35%', left: '65%', position: 'absolute' }}>🌲</div>
                      <div className="city-tree-sway t2" style={{ bottom: '12%', left: '78%', position: 'absolute' }}>🌳</div>
                      <div className="city-tree-sway t3" style={{ bottom: '28%', left: '90%', position: 'absolute' }}>🌲</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="monopoly-logo">{rules?.ruleset === 'Get Rich' ? 'GET RICH!' : 'MONOPOLY'}</div>

              {/* Turn Counter Overlay */}
              {rules?.turnLimit > 0 ? (
                <div style={{
                  position: 'absolute',
                  top: '35%',
                  left: '40%',
                  transform: 'translateX(-50%) rotateZ(-35deg) translateZ(1px)',
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  color: '#fbbf24',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                  zIndex: 90
                }}>
                  ⏱️ Turn: {monopolyTurnCount || 0} / {rules.turnLimit}
                </div>
              ) : (
                <div style={{
                  position: 'absolute',
                  top: '35%',
                  left: '40%',
                  transform: 'translateX(-50%) rotateZ(-35deg) translateZ(1px)',
                  background: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(2px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  color: '#cbd5e1',
                  fontSize: '0.75rem',
                  fontWeight: 'semibold',
                  whiteSpace: 'nowrap',
                  zIndex: 90
                }}>
                  🎲 Turn: {monopolyTurnCount || 0}
                </div>
              )}

              {/* 3D Physical Chance Deck Stack */}
              <div className="monopoly-deck-slot chance" style={{ border: 'none', background: 'transparent', transformStyle: 'preserve-3d' }}>
                {Array.from({ length: 10 }).map((_, cIdx) => (
                  <div
                    key={`chance_deck_${cIdx}`}
                    className="physical-deck-card chance-card-back"
                    style={{
                      transform: `translate3d(0, 0, ${cIdx * 2.2}px) rotateZ(${-45 + (cIdx % 2 === 0 ? 0.6 : -0.6)}deg)`
                    }}
                  >
                    <div className="card-back-design">
                      <span>❓</span>
                      <span className="card-back-text">CHANCE</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 3D Physical Community Chest Deck Stack */}
              <div className="monopoly-deck-slot chest" style={{ border: 'none', background: 'transparent', transformStyle: 'preserve-3d' }}>
                {Array.from({ length: 10 }).map((_, cIdx) => (
                  <div
                    key={`chest_deck_${cIdx}`}
                    className="physical-deck-card chest-card-back"
                    style={{
                      transform: `translate3d(0, 0, ${cIdx * 2.2}px) rotateZ(${135 + (cIdx % 2 === 0 ? 0.6 : -0.6)}deg)`
                    }}
                  >
                    <div className="card-back-design">
                      <span>🧰</span>
                      <span className="card-back-text">COMMUNITY CHEST</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rolling Dice removed from board center (handled by 2D Pop-up modal) */}
            </div>

            {/* 3D Flying Card Animation */}
            {flyingCard && (
              <div
                className={`flying-3d-card ${flyingCard.type}-card`}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${flyingCard.x}px)`,
                  top: `calc(50% + ${flyingCard.y}px)`,
                  transform: `translate(-50%, -50%) translateZ(${flyingCard.z}px) rotateZ(${flyingCard.rot}deg) scale(${flyingCard.scale}) rotateX(20deg)`,
                  opacity: flyingCard.opacity,
                  transition: 'left 1.0s cubic-bezier(0.25, 0.8, 0.25, 1), top 1.0s cubic-bezier(0.25, 0.8, 0.25, 1), transform 1.0s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  zIndex: 200,
                  pointerEvents: 'none'
                }}
              >
                <div className="card-back-design">
                  <span>{flyingCard.type === 'chance' ? '❓' : '🧰'}</span>
                  <span className="card-back-text">{flyingCard.type === 'chance' ? 'CHANCE' : 'COMMUNITY CHEST'}</span>
                </div>
              </div>
            )}

            {/* Standing Upright Player Tokens (hidden during board selection/view modes) */}
            {(!tradeBoardSelectionMode && !incomingTradeViewBoardMode) && players.map(p => {
              if (p.bankrupt) return null;

              // Use fanning/offsets if multiple players stand on same space
              const sameSpacePlayers = players.filter(other => !other.bankrupt && (visualPositions[other.id] ?? other.position) === (visualPositions[p.id] ?? p.position));
              const indexOnSpace = sameSpacePlayers.indexOf(p);
              const totalOnSpace = sameSpacePlayers.length;

              const tilePos = visualPositions[p.id] ?? p.position;
              const coords = getTileLocalCoords(tilePos);

              let dx = 0;
              let dy = 0;
              if (totalOnSpace > 1) {
                const angle = (indexOnSpace / totalOnSpace) * Math.PI * 2;
                dx = Math.cos(angle) * 12;
                dy = Math.sin(angle) * 12;
              }

              const isHopping = !!hopTimersRef.current[p.id];
              const playerColor = getPlayerColor(p.id);

              return (
                <div
                  key={p.id}
                  className={`monopoly-player-token ${isHopping ? 'hopping' : ''}`}
                  style={{
                    left: `calc(50% + ${coords.x + dx}px)`,
                    top: `calc(50% + ${coords.y + dy}px)`,
                  }}
                >
                  <div className="token-inner">

                    {/* Active turn arrow floating above the avatar */}
                    {gameState === 'playing' && activePlayer && p.id === activePlayer.id && (
                      <div
                        className={`board-turn-arrow ${movingPlayerSteps[p.id] > 0 ? 'higher' : ''}`}
                        style={{
                          '--player-color': playerColor
                        } as any}
                      >
                        ▼
                      </div>
                    )}

                    {/* Floating player status label (Trading... / Managing...) */}
                    {p.status && (
                      <div className={`player-status-badge ${p.status}`}>
                        {p.status === 'managing' ? '🛠️ Managing...' : '🤝 Trading...'}
                      </div>
                    )}

                    {/* Remaining steps countdown bubble */}
                    {movingPlayerSteps[p.id] !== undefined && movingPlayerSteps[p.id] > 0 && (
                      <div className="token-countdown-badge" style={{ transform: 'translateY(-20px)' }}>
                        {movingPlayerSteps[p.id]}
                      </div>
                    )}

                    {/* Colored pedestal base (Enlarged) */}
                    <div
                      className="token-pedestal"
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '34px',
                        height: '34px',
                        marginTop: '-17px',
                        marginLeft: '-17px',
                        borderRadius: '50%',
                        background: playerColor,
                        border: '1.5px solid #ffffff',
                        boxShadow: `0 2px 4px rgba(0,0,0,0.4), 0 0 8px ${playerColor}`,
                        transform: 'rotateX(90deg) translateZ(-6px)'
                      }}
                    />

                    {/* Thick player-colored border around avatar */}
                    <div
                      className="token-avatar-wrapper"
                      style={{
                        border: `3px solid ${playerColor}`,
                        borderRadius: '50%',
                        background: '#ffffff',
                        padding: '1.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 10px rgba(0,0,0,0.35), 0 0 10px ${playerColor}`,
                        width: '44px',
                        height: '44px',
                        boxSizing: 'border-box',
                        zIndex: 2,
                        position: 'relative'
                      }}
                    >
                      <AvatarSVG config={p.avatar} size={36} />
                    </div>
                  </div>
                </div>
              );
            })}

          </div>

          {/* Removed Flying 3D Bills as we now use 2D money particles */}
        </div>
      </div>

      {/* Removed 2D Flying particles layer */}

      {/* Floating Roll Total Banner removed to prevent obscuring player heads */}

      {/* Top Middle HUD Header */}
      <div className="monopoly-top-middle-header">
        <button
          className="top-header-btn-chat"
          onClick={() => {
            if (onToggleChat) onToggleChat();
          }}
        >
          💬 Chat
        </button>
        <button className="top-header-btn-leave" onClick={onLeaveRoom}>
          Leave Game
        </button>
      </div>

      {/* Turn Arrow indicator overlay removed in favor of floating board arrow */}

      {/* Corner Player Cards */}
      <div className="monopoly-corner-cards" style={{ pointerEvents: 'none' }}>
        {players.map((p, idx) => {
          let cornerClass = '';
          if (idx === 3) cornerClass = 'top-left';
          else if (idx === 0) cornerClass = 'top-right';
          else if (idx === 1) cornerClass = 'bottom-right';
          else if (idx === 2) cornerClass = 'bottom-left';

          const isActive = turnIndex === idx;

          const rank = playersWithRanks[p.id] || 4;
          const playerColor = getPlayerColor(p.id);
          const hasChange = !!activeChanges[p.id];
          const changeInfo = activeChanges[p.id];

          return (
            <div
              key={p.id}
              className={`corner-card ${cornerClass} ${isActive ? 'active-turn' : ''} ${p.bankrupt ? 'bankrupt-player' : ''}`}
              style={{
                borderLeft: `6px solid ${playerColor}`,
                transform: hasChange ? 'scale(1.2)' : undefined,
                zIndex: hasChange ? 60 : undefined,
                transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                cursor: 'pointer',
                pointerEvents: 'auto'
              }}
              onClick={() => {
                setDetailedPlayerId(p.id);
                sfx.playDraw();
              }}
            >
              <div className={`corner-rank-badge rank-${rank}`}>
                {rank === 1 ? '🥇 1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'}
              </div>
              <div
                className="corner-avatar-wrapper"
                style={{
                  border: `3px solid ${playerColor}`,
                  borderRadius: '50%',
                  background: '#ffffff',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 3px 8px rgba(0,0,0,0.12), 0 0 6px ${playerColor}`,
                  flexShrink: 0
                }}
              >
                <AvatarSVG config={p.avatar} size={30} />
              </div>
              <div className="corner-card-details">
                <div className="corner-card-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{p.name} {p.id === playerId ? '(You)' : ''}</span>
                  {p.status === 'managing' && <span className="corner-status-pill managing">🛠️ Managing</span>}
                  {p.status === 'trading' && <span className="corner-status-pill trading">🤝 Trading</span>}
                </div>
                <div className="corner-card-money" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>${displayMoney[p.id] !== undefined ? displayMoney[p.id] : p.money}</span>
                  {changeInfo && (
                    <span className={`corner-change-number ${changeInfo.diff >= 0 ? 'positive' : 'negative'}`}>
                      {changeInfo.currentDiff >= 0 ? '+' : '-'}${Math.abs(changeInfo.currentDiff)}
                    </span>
                  )}
                </div>
                <div className="corner-card-worth">Worth: ${p.netWorth}</div>
                <div className="corner-card-badges">
                  {p.inJail && <span className="jail-badge">🚨 JAIL</span>}
                  {p.getOutOfJailCards > 0 && <span className="card-badge">🔓 x{p.getOutOfJailCards}</span>}
                  {rules?.ruleset === 'Get Rich' && p.oddEvenCards !== undefined && p.oddEvenCards > 0 && (
                    <span className="card-badge" style={{ background: '#7c3aed' }}>🎯 x{p.oddEvenCards}</span>
                  )}
                  {rules?.ruleset === 'Get Rich' && p.angelCards !== undefined && p.angelCards > 0 && (
                    <span className="card-badge" style={{ background: '#10b981' }}>😇 x{p.angelCards}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unified bottom HUD Bar for turn control and property management */}
      {gameState === 'playing' && (
        <div className="monopoly-unified-hud-bottom">
          {/* Button 1: Turn Action */}
          {players[turnIndex]?.id === playerId ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {monopolyPhase === 'roll' && !isDiceRolling && !isAnimating ? (
                activePlayer?.inJail ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-roll-red roll-glow-animation"
                      onClick={() => onMonopolyAction('roll-jail-doubles')}
                      style={{ padding: '10px 18px', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem' }}
                    >
                      🎲 Roll for Doubles
                    </button>
                    {activePlayer.money >= 50 && (
                      <button
                        className="btn-secondary"
                        onClick={() => onMonopolyAction('pay-jail-fine')}
                        style={{ padding: '10px 14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem', background: '#3b82f6', color: 'white', border: 'none' }}
                      >
                        💵 Pay $50
                      </button>
                    )}
                    {activePlayer.getOutOfJailCards > 0 && (
                      <button
                        className="btn-secondary"
                        onClick={() => onMonopolyAction('use-jail-card')}
                        style={{ padding: '10px 14px', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem', background: '#10b981', color: 'white', border: 'none' }}
                      >
                        🔓 Use Card
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {rules.ruleset === 'Get Rich' && (activePlayer.oddEvenCards || 0) > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: '#cbd5e1' }}>INFLUENCE ROLL</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className={`btn-odd-even ${oddEvenChoice === 'odd' ? 'active' : ''}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              border: oddEvenChoice === 'odd' ? '1.5px solid #a78bfa' : '1.5px solid #475569',
                              background: oddEvenChoice === 'odd' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#1e293b',
                              color: 'white',
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                            onClick={() => setOddEvenChoice(prev => prev === 'odd' ? null : 'odd')}
                          >
                            Odd
                          </button>
                          <button
                            type="button"
                            className={`btn-odd-even ${oddEvenChoice === 'even' ? 'active' : ''}`}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.65rem',
                              fontWeight: 900,
                              border: oddEvenChoice === 'even' ? '1.5px solid #a78bfa' : '1.5px solid #475569',
                              background: oddEvenChoice === 'even' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : '#1e293b',
                              color: 'white',
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                            onClick={() => setOddEvenChoice(prev => prev === 'even' ? null : 'even')}
                          >
                            Even
                          </button>
                        </div>
                      </div>
                    )}
                    {rules.ruleset === 'Get Rich' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-roll-red roll-glow-animation"
                          onMouseDown={handlePowerBarStart}
                          onTouchStart={handlePowerBarStart}
                          onMouseUp={handlePowerBarRelease}
                          onTouchEnd={handlePowerBarRelease}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '12px',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            userSelect: 'none',
                            touchAction: 'none'
                          }}
                        >
                          {isPressing ? '🔥 RELEASE' : '🎲 Hold to Roll'}
                        </button>
                        {/* Power Bar visual */}
                        <div style={{
                          width: '120px',
                          height: '8px',
                          background: '#1e293b',
                          borderRadius: '4px',
                          border: '1.5px solid rgba(255,255,255,0.2)',
                          overflow: 'hidden',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${powerValue}%`,
                            height: '100%',
                            background: powerValue <= 33
                              ? 'linear-gradient(to right, #10b981 0%, #059669 100%)'
                              : powerValue <= 66
                                ? 'linear-gradient(to right, #eab308 0%, #ca8a04 100%)'
                                : 'linear-gradient(to right, #ef4444 0%, #dc2626 100%)'
                          }} />
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 800 }}>
                          Power: {powerValue}% ({powerValue <= 33 ? 'Low: 1-4' : powerValue <= 66 ? 'Mid: 5-8' : 'High: 9-12'})
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-roll-red roll-glow-animation"
                        onClick={() => onMonopolyAction('roll-dice')}
                        style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 900, fontSize: '0.9rem' }}
                      >
                        🎲 Roll Dice
                      </button>
                    )}
                  </div>
                )
              ) : monopolyPhase === 'end_turn' && !isAnimating ? (
                <button
                  className="btn-primary btn-end-turn-blue"
                  onClick={() => onMonopolyAction('end-turn')}
                  style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 900, fontSize: '0.9rem', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', color: 'white', border: 'none' }}
                >
                  ➡️ End Turn
                </button>
              ) : (
                <button
                  className="btn-primary btn-animating-grey"
                  disabled
                  style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', background: '#475569', color: '#94a3b8', border: 'none', cursor: 'not-allowed' }}
                >
                  ⏳ Animating...
                </button>
              )}
            </div>
          ) : (
            <button
              className="btn-primary btn-waiting-grey"
              disabled
              style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem', background: '#1e293b', color: '#94a3b8', border: 'none', cursor: 'not-allowed' }}
            >
              ⏳ {players[turnIndex]?.name || 'Next Player'}'s Turn
            </button>
          )}

          {/* Button 2: Manage Properties */}
          <button
            className="unified-hud-manage-btn"
            onClick={() => {
              setIsBuildManagerOpen(true);
              sfx.playDraw();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '0.9rem',
              background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            🛠️ Manage Properties
          </button>
        </div>
      )}

      {/* Buy property overlay */}
      {!isAnimating && monopolyPhase === 'action' && activePlayer?.id === playerId && activeLandedTile && (
        <div
          className="drawn-card-popup"
          style={{
            borderColor: '#10b981',
            background: 'white',
            boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
            height: 'auto'
          }}
        >
          <div className="card-header-icon">🏠</div>
          <div className="card-title-text" style={{ color: '#10b981' }}>Buy Land?</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>You landed on unowned:</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, margin: '10px 0' }}>{activeLandedTile.name}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginBottom: '20px' }}>Price: ${activeLandedTile.price}</div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              style={{ flexGrow: 1, padding: '10px' }}
              disabled={activePlayer.money < (activeLandedTile.price || 0)}
              onClick={() => onMonopolyAction('buy-property')}
            >
              Buy
            </button>
            <button
              className="btn-secondary"
              style={{ flexGrow: 1, padding: '10px' }}
              onClick={() => onMonopolyAction('pass-property')}
            >
              Pass
            </button>
          </div>
        </div>
      )}

      {/* Chance/Chest card drawn popup */}
      {!isAnimating && monopolyPhase === 'card_drawn' && currentCard && (
        <div className={`drawn-card-popup ${cardType === 'chest' ? 'chest' : ''}`}>
          <div className="card-header-icon">{cardType === 'chest' ? '🧰' : '❓'}</div>
          <div className="card-title-text">{cardType === 'chest' ? 'Community Chest' : 'Chance'}</div>
          <div className="card-body-text">"{currentCard.text}"</div>

          {activePlayer?.id === playerId ? (
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '10px', marginTop: '15px' }}
              onClick={() => onMonopolyAction('ok-card')}
            >
              OK
            </button>
          ) : (
            <div style={{ marginTop: '15px', color: '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
              Waiting for {activePlayer?.name} to acknowledge...
            </div>
          )}
        </div>
      )}

      {/* Debt and Bankruptcy management popup */}
      {!isAnimating && monopolyPhase === 'bankrupt_decision' && activePlayer?.id === playerId && activeDebt && (
        <div
          className="drawn-card-popup"
          style={{
            borderColor: '#ef4444',
            background: 'white',
            height: 'auto',
            width: '320px'
          }}
        >
          <div className="card-header-icon">🚨</div>
          <div className="card-title-text">Insufficent Funds</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            You owe {activeDebt.to === 'bank' ? 'the Bank' : 'another Player'} rent/fees:
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ef4444', margin: '10px 0' }}>
            ${activeDebt.amountValue}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '20px' }}>
            Current cash: <strong>${activePlayer.money}</strong>. Sell houses or mortgage property to cover the remaining debt of <strong>${activeDebt.amountValue - activePlayer.money}</strong>.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '10px' }}
              onClick={() => {
                setIsBuildManagerOpen(true);
                sfx.playDraw();
              }}
            >
              🛠️ Sell / Mortgage Property
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%', padding: '10px' }}
              onClick={() => {
                onMonopolyAction('declare-bankruptcy');
                sfx.playBankruptcy();
              }}
            >
              💀 Declare Bankruptcy
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GET RICH: Festival — choose property to double rent           */}
      {/* ============================================================ */}

      {!isAnimating && monopolyPhase === 'festival_selection' && activePlayer?.id === playerId && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2.5px solid #f59e0b',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          color: 'white',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          width: '90%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>🎉</span> FESTIVAL BOOSTER SELECTOR
          </div>
          <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
            Click one of your properties on the board to <strong style={{ color: '#f59e0b' }}>double its rent</strong> for 3 turns!
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            background: 'rgba(255,255,255,0.06)',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div>Properties Owned: <span style={{ color: '#f59e0b' }}>{monopolyBoard.filter(t => (t.type === 'property' || t.type === 'railroad' || t.type === 'utility') && t.owner === playerId).length}</span></div>
          </div>
          <button
            className="btn-secondary"
            style={{
              width: '100%',
              padding: '10px 0',
              fontWeight: 'bold',
              borderRadius: '8px',
              fontSize: '0.9rem',
              marginTop: '4px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => onMonopolyAction('festival-skip')}
          >
            Skip (No boost)
          </button>
        </div>
      )}

      {!isAnimating && monopolyPhase === 'festival_selection' && activePlayer?.id !== playerId && (
        <div className="drawn-card-popup" style={{ borderColor: '#f59e0b', background: 'white', height: 'auto' }}>
          <div className="card-header-icon">🎉</div>
          <div className="card-title-text" style={{ color: '#d97706' }}>Festival!</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            {activePlayer?.name} is choosing a property to boost...
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GET RICH: Airport — choose destination tile                   */}
      {/* ============================================================ */}

      {!isAnimating && monopolyPhase === 'airport_selection' && activePlayer?.id === playerId && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2.5px solid #3b82f6',
          borderRadius: '16px',
          padding: '16px 24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          color: 'white',
          textAlign: 'center',
          backdropFilter: 'blur(8px)',
          width: '90%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>✈️</span> AIRPORT DESTINATION SELECTOR
          </div>
          <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
            Click any tile on the board to fly there! (Cost: <strong style={{ color: '#fbbf24' }}>$100</strong>)
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            background: 'rgba(255,255,255,0.06)',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div>Your Cash: <span style={{ color: '#10b981' }}>${activePlayer.money}</span></div>
          </div>
          <button
            className="btn-secondary"
            style={{
              width: '100%',
              padding: '10px 0',
              fontWeight: 'bold',
              borderRadius: '8px',
              fontSize: '0.9rem',
              marginTop: '4px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => onMonopolyAction('airport-skip')}
          >
            Skip (Stay here)
          </button>
        </div>
      )}

      {!isAnimating && monopolyPhase === 'airport_selection' && activePlayer?.id !== playerId && (
        <div className="drawn-card-popup" style={{ borderColor: '#3b82f6', background: 'white', height: 'auto' }}>
          <div className="card-header-icon">✈️</div>
          <div className="card-title-text" style={{ color: '#1d4ed8' }}>Airport</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            {activePlayer?.name} is choosing a destination...
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* GET RICH: Angel Card — skip rent decision                     */}
      {/* ============================================================ */}
      {!isAnimating && monopolyPhase === 'use_angel_rent' && activePlayer?.id === playerId && (() => {
        const pr = pendingRent;
        const rentText = pr ? ` $${pr.amount}` : '';
        return (
          <div
            className="drawn-card-popup"
            style={{ borderColor: '#a78bfa', background: 'white', height: 'auto', width: '320px' }}
          >
            <div className="card-header-icon">😇</div>
            <div className="card-title-text" style={{ color: '#7c3aed' }}>Angel Card</div>
            <div style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
              You have an <strong>Angel Card</strong>! Use it to skip paying{rentText} rent entirely?
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '14px' }}>
              (You still own the card after use if you decline)
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-primary"
                style={{ flexGrow: 1, padding: '10px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
                onClick={() => onMonopolyAction('use-angel-rent')}
              >
                😇 Use Angel Card
              </button>
              <button
                className="btn-secondary"
                style={{ flexGrow: 1, padding: '10px' }}
                onClick={() => onMonopolyAction('decline-angel-rent')}
              >
                Pay Rent
              </button>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* GET RICH: Angel Card — block force acquisition               */}
      {/* ============================================================ */}
      {!isAnimating && monopolyPhase === 'use_angel_force' && (() => {
        const pfa = pendingForceAcquire;
        if (!pfa) return null;
        const faTile = monopolyBoard[pfa.tileIndex];
        if (!faTile) return null;
        const isOwner = faTile.owner === playerId;
        const isAcquirer = pfa.byId === playerId;
        if (isOwner) {
          return (
            <div
              className="drawn-card-popup"
              style={{ borderColor: '#a78bfa', background: 'white', height: 'auto', width: '330px' }}
            >
              <div className="card-header-icon">😇</div>
              <div className="card-title-text" style={{ color: '#7c3aed' }}>Block Acquisition?</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>
                <strong>{players.find(p => p.id === pfa.byId)?.name}</strong> wants to force-acquire{' '}
                <strong>{faTile.name}</strong> for <strong>${pfa.worth}</strong>.<br />
                Use your Angel Card to block this?
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-primary"
                  style={{ flexGrow: 1, padding: '10px', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
                  onClick={() => onMonopolyAction('use-angel-force')}
                >
                  😇 Block It
                </button>
                <button
                  className="btn-secondary"
                  style={{ flexGrow: 1, padding: '10px' }}
                  onClick={() => onMonopolyAction('decline-angel-force')}
                >
                  Allow
                </button>
              </div>
            </div>
          );
        }
        if (isAcquirer) {
          return (
            <div className="drawn-card-popup" style={{ borderColor: '#a78bfa', background: 'white', height: 'auto' }}>
              <div className="card-header-icon">😇</div>
              <div className="card-title-text" style={{ color: '#7c3aed' }}>Angel Card!</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                {players.find(p => p.id === faTile.owner)?.name} is deciding whether to block your acquisition...
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* ============================================================ */}
      {/* GET RICH: Force Acquire Decision                              */}
      {/* ============================================================ */}
      {!isAnimating && monopolyPhase === 'force_acquire_decision' && (() => {
        const pfa = pendingForceAcquire;
        if (!pfa) return null;
        const faTile = monopolyBoard[pfa.tileIndex];
        if (!faTile) return null;
        const prevOwnerName = players.find(p => p.id === faTile.owner)?.name || 'Owner';
        const isAcquirer = pfa.byId === playerId;
        if (isAcquirer) {
          return (
            <div
              className="drawn-card-popup"
              style={{ borderColor: '#ef4444', background: 'white', height: 'auto', width: '330px' }}
            >
              <div className="card-header-icon">💼</div>
              <div className="card-title-text" style={{ color: '#dc2626' }}>Force Acquire?</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                Force-acquire <strong>{faTile.name}</strong> from <strong>{prevOwnerName}</strong>?
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#dc2626', marginBottom: '14px' }}>
                Total cost: ${pfa.worth}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '14px' }}>
                Hotels cannot be force-acquired. Your cash: <strong>${activePlayer?.money}</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-primary"
                  style={{ flexGrow: 1, padding: '10px', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}
                  onClick={() => onMonopolyAction('force-acquire')}
                >
                  💼 Acquire!
                </button>
                <button
                  className="btn-secondary"
                  style={{ flexGrow: 1, padding: '10px' }}
                  onClick={() => onMonopolyAction('decline-force-acquire')}
                >
                  Pass
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="drawn-card-popup" style={{ borderColor: '#ef4444', background: 'white', height: 'auto' }}>
            <div className="card-header-icon">💼</div>
            <div className="card-title-text" style={{ color: '#dc2626' }}>Force Acquire</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
              {players.find(p => p.id === pfa.byId)?.name} is deciding whether to acquire {faTile.name}...
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* GET RICH: Landed Build — instant build on own property       */}
      {/* ============================================================ */}
      {monopolyPhase === 'landed_build' && activePlayer?.id === playerId && (() => {
        const landedTile = monopolyBoard[activePlayer.position];
        if (!landedTile || landedTile.type !== 'property') return null;
        return (
          <div
            className="drawn-card-popup"
            style={{ borderColor: '#3b82f6', background: 'white', height: 'auto', width: '320px' }}
          >
            <div className="card-header-icon">🏗️</div>
            <div className="card-title-text" style={{ color: '#1d4ed8' }}>Build Instantly!</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
              You landed on your own <strong>{landedTile.name}</strong>!
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '8px' }}>
              <span>Current: {landedTile.houses < 5 ? `${landedTile.houses} House(s)` : '🏨 Hotel'}</span>
              <span>Unit Price: <strong>${landedTile.housePrice}</strong></span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {[1, 2, 3, 4, 5].map(target => {
                const isHotel = target === 5;
                const label = isHotel ? '🏨 Hotel' : `🏠 ${target} House${target > 1 ? 's' : ''}`;

                // Check if target is already reached or exceeded
                const alreadyReached = landedTile.houses >= target;

                // Check max houses allowed for this landing
                const allowedForLanding = target <= (landedBuildMaxHouses ?? 4);

                // Cost to reach target
                const countNeeded = target - landedTile.houses;
                const cost = countNeeded * (landedTile.housePrice || 0);

                // Can build this option?
                let clickable = false;
                let reason = '';

                if (isAnimating) {
                  reason = 'Building...';
                } else if (alreadyReached) {
                  reason = 'Already reached';
                } else if (!allowedForLanding) {
                  reason = 'Requires landing again';
                } else if (activePlayer.money < cost) {
                  reason = `Need $${cost}`;
                } else {
                  if (isHotel) {
                    if (landedTile.houses === 4 && (landedBuildMaxHouses ?? 4) === 5) {
                      clickable = true;
                    } else {
                      reason = 'Requires 4 houses & landing again';
                    }
                  } else {
                    clickable = true;
                  }
                }

                return (
                  <button
                    key={target}
                    className="btn-primary"
                    disabled={!clickable}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      background: clickable
                        ? (isHotel ? 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)')
                        : '#cbd5e1',
                      color: clickable ? 'white' : '#64748b',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: clickable ? 'pointer' : 'not-allowed',
                      opacity: clickable ? 1 : 0.6,
                      boxShadow: 'none',
                      textShadow: 'none'
                    }}
                    onClick={() => onMonopolyAction('landed-build', { tileIndex: landedTile.index, count: countNeeded })}
                  >
                    <span>{label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>
                      {clickable ? `+$${cost}` : reason}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              className="btn-secondary"
              disabled={isAnimating}
              style={{
                width: '100%',
                padding: '10px',
                opacity: isAnimating ? 0.6 : 1,
                cursor: isAnimating ? 'not-allowed' : 'pointer'
              }}
              onClick={() => onMonopolyAction('landed-build-done')}
            >
              Done
            </button>
          </div>
        );
      })()}
      {monopolyPhase === 'landed_build' && activePlayer?.id !== playerId && (
        <div className="drawn-card-popup" style={{ borderColor: '#3b82f6', background: 'white', height: 'auto' }}>
          <div className="card-header-icon">🏗️</div>
          <div className="card-title-text" style={{ color: '#1d4ed8' }}>Building...</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
            {activePlayer?.name} is deciding whether to build...
          </div>
        </div>
      )}

      {/* Deed Card View modal */}
      {selectedDeedIndex !== null && (
        <div className="deed-card-modal-backdrop" onClick={() => setSelectedDeedIndex(null)}>
          <div className="deed-card" style={{ width: '580px', padding: '16px', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const tile = monopolyBoard[selectedDeedIndex];
              const isProp = tile.type === 'property';
              const isRail = tile.type === 'railroad';
              const isUtil = tile.type === 'utility';

              const getCurrentRent = () => {
                if (!tile.owner) return 0;
                if (tile.mortgaged) return 0;

                let rentVal = 0;
                if (isProp) {
                  const isMonopoly = tile.color ? monopolyColorGroups[tile.color] === tile.owner : false;
                  if (tile.houses === 0) {
                    rentVal = isMonopoly ? (tile.rent?.[0] || 0) * 2 : (tile.rent?.[0] || 0);
                  } else {
                    rentVal = tile.rent?.[tile.houses] || 0;
                  }
                } else if (isRail) {
                  const count = monopolyBoard.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
                  rentVal = tile.rent?.[Math.min(count - 1, 3)] || 25;
                } else if (isUtil) {
                  const count = monopolyBoard.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
                  const diceSum = dice[0] + dice[1];
                  const mult = count === 2 ? 10 : 4;
                  rentVal = diceSum * mult;
                }

                // Apply Festival x2
                if ((tile as any).festivalTurns && (tile as any).festivalTurns > 0) {
                  rentVal = rentVal * 2;
                }
                return rentVal;
              };

              const getRentMathBreakdown = () => {
                if (!tile.owner) {
                  return (
                    <section style={{ display: 'block', padding: '8px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.7rem', color: '#64748b', border: '1px solid #e2e8f0', marginTop: '10px', borderBottom: 'none' }}>
                      ℹ️ <strong>Unowned property</strong> has no active rent.
                    </section>
                  );
                }
                if (tile.mortgaged) {
                  return (
                    <section style={{ display: 'block', padding: '8px', background: 'rgba(239, 68, 68, 0.04)', borderRadius: '6px', fontSize: '0.7rem', color: '#ef4444', border: '1px dashed #ef4444', marginTop: '10px', borderBottom: 'none' }}>
                      ⚠️ <strong>Mortgaged property</strong> has no active rent ($0).
                    </section>
                  );
                }

                const ownerName = players.find(p => p.id === tile.owner)?.name || 'Owner';
                const hasFestival = (tile as any).festivalTurns && (tile as any).festivalTurns > 0;
                const festivalMultiplier = hasFestival ? 2 : 1;

                if (isProp) {
                  const isMonopoly = tile.color ? monopolyColorGroups[tile.color] === tile.owner : false;
                  const baseRent = tile.rent?.[0] || 0;
                  if (tile.houses === 0) {
                    const preFestivalRent = isMonopoly ? baseRent * 2 : baseRent;
                    const finalRent = preFestivalRent * festivalMultiplier;
                    return (
                      <section style={{ display: 'block', padding: '8px', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '6px', fontSize: '0.7rem', color: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '10px', borderBottom: 'none' }}>
                        <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block', marginBottom: '4px' }}>📊 Rent Calculation Math:</span>
                        <span style={{ display: 'block', margin: '2px 0' }}>• Base Rent: <strong>${baseRent}</strong></span>
                        <span style={{ display: 'block', margin: '2px 0' }}>• Group Status: <strong>{isMonopoly ? 'Monopoly Owned (+100%)' : 'No Monopoly'}</strong></span>
                        {hasFestival && (
                          <span style={{ display: 'block', margin: '2px 0', color: '#d97706' }}>• Festival Boost: <strong>Double Rent Active ({(tile as any).festivalTurns} turns left)</strong></span>
                        )}
                        <span style={{ borderTop: '1px dashed rgba(16, 185, 129, 0.2)', display: 'block', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
                          Total Rent = ${preFestivalRent} {hasFestival ? `× 2 = $${finalRent}` : ''}
                        </span>
                      </section>
                    );
                  } else {
                    const houseText = tile.houses === 5 ? 'Hotel' : `${tile.houses} House${tile.houses > 1 ? 's' : ''}`;
                    const rentWithUpgrades = tile.rent?.[tile.houses] || 0;
                    const finalRent = rentWithUpgrades * festivalMultiplier;
                    return (
                      <section style={{ display: 'block', padding: '8px', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '6px', fontSize: '0.7rem', color: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '10px', borderBottom: 'none' }}>
                        <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block', marginBottom: '4px' }}>📊 Rent Calculation Math:</span>
                        <span style={{ display: 'block', margin: '2px 0' }}>• Upgrades: <strong>{houseText} (${rentWithUpgrades})</strong></span>
                        {hasFestival && (
                          <span style={{ display: 'block', margin: '2px 0', color: '#d97706' }}>• Festival Boost: <strong>Double Rent Active ({(tile as any).festivalTurns} turns left)</strong></span>
                        )}
                        <span style={{ borderTop: '1px dashed rgba(16, 185, 129, 0.2)', display: 'block', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
                          Total Rent = ${rentWithUpgrades} {hasFestival ? `× 2 = $${finalRent}` : ''}
                        </span>
                      </section>
                    );
                  }
                }

                if (isRail) {
                  const railCount = monopolyBoard.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
                  const baseRent = tile.rent?.[Math.min(railCount - 1, 3)] || 25;
                  const finalRent = baseRent * festivalMultiplier;
                  return (
                    <section style={{ display: 'block', padding: '8px', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '6px', fontSize: '0.7rem', color: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '10px', borderBottom: 'none' }}>
                      <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block', marginBottom: '4px' }}>📊 Rent Calculation Math:</span>
                      <span style={{ display: 'block', margin: '2px 0' }}>• Railroads owned by {ownerName}: <strong>{railCount} of 4</strong></span>
                      <span style={{ display: 'block', margin: '2px 0' }}>• Base Railroad Rent: <strong>${baseRent}</strong></span>
                      {hasFestival && (
                        <span style={{ display: 'block', margin: '2px 0', color: '#d97706' }}>• Festival Boost: <strong>Double Rent Active ({(tile as any).festivalTurns} turns left)</strong></span>
                      )}
                      <span style={{ borderTop: '1px dashed rgba(16, 185, 129, 0.2)', display: 'block', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
                        Total Rent = ${baseRent} {hasFestival ? `× 2 = $${finalRent}` : ''}
                      </span>
                    </section>
                  );
                }

                if (isUtil) {
                  const utilCount = monopolyBoard.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
                  const diceSum = dice[0] + dice[1];
                  const mult = utilCount === 2 ? 10 : 4;
                  const baseRent = diceSum * mult;
                  const finalRent = baseRent * festivalMultiplier;
                  return (
                    <section style={{ display: 'block', padding: '8px', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '6px', fontSize: '0.7rem', color: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.2)', marginTop: '10px', borderBottom: 'none' }}>
                      <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block', marginBottom: '4px' }}>📊 Rent Calculation Math:</span>
                      <span style={{ display: 'block', margin: '2px 0' }}>• Utilities owned by {ownerName}: <strong>{utilCount} of 2</strong></span>
                      <span style={{ display: 'block', margin: '2px 0' }}>• Dice Sum: <strong>{diceSum}</strong> <span style={{ color: '#64748b' }}>({dice[0]} + {dice[1]})</span></span>
                      <span style={{ display: 'block', margin: '2px 0' }}>• Multiplier: <strong>{mult}x</strong></span>
                      {hasFestival && (
                        <span style={{ display: 'block', margin: '2px 0', color: '#d97706' }}>• Festival Boost: <strong>Double Rent Active ({(tile as any).festivalTurns} turns left)</strong></span>
                      )}
                      <span style={{ borderTop: '1px dashed rgba(16, 185, 129, 0.2)', display: 'block', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
                        Total Rent = {diceSum} × {mult} = ${baseRent} {hasFestival ? `× 2 = $${finalRent}` : ''}
                      </span>
                    </section>
                  );
                }

                return null;
              };

              return (
                <div className="deed-card-layout" style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>
                  {/* Left Column: Core Classical Deed Card */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '2px solid #0f172a', padding: '12px', background: '#fff', borderRadius: '4px' }}>
                    {/* Header */}
                    {isProp && (
                      <div className="deed-header" style={{ border: 'none', padding: '0 0 10px 0' }}>
                        <div className={`deed-header-color tile-group-${tile.color}`} style={{ border: '2px solid #0f172a', borderRadius: '2px' }} />
                        <span className="deed-title" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{tile.name}</span>
                      </div>
                    )}
                    {isRail && (
                      <div className="deed-header" style={{ background: '#cbd5e1', border: 'none', padding: '10px 10px 14px 10px', borderRadius: '4px', textAlign: 'center' }}>
                        <span style={{ fontSize: '1.75rem' }}>🚂</span>
                        <div className="deed-title" style={{ fontSize: '1.1rem', color: '#0f172a', marginTop: '6px' }}>{tile.name}</div>
                      </div>
                    )}
                    {isUtil && (
                      <div className="deed-header" style={{ background: '#cbd5e1', border: 'none', padding: '10px 10px 14px 10px', borderRadius: '4px', textAlign: 'center' }}>
                        <span style={{ fontSize: '1.75rem' }}>💡</span>
                        <div className="deed-title" style={{ fontSize: '1.1rem', color: '#0f172a', marginTop: '6px' }}>{tile.name}</div>
                      </div>
                    )}

                    {/* Rent Listings */}
                    <div className="deed-rents" style={{ flex: 1, borderTop: '2px solid #0f172a', paddingTop: '10px', marginTop: '10px' }}>
                      {isProp && tile.rent && (
                        <section style={{ display: 'block', borderBottom: 'none', padding: 0 }}>
                          <div><span>Rent:</span> <strong>${tile.rent[0]}</strong></div>
                          <div><span>With Monopoly:</span> <strong>${tile.rent[0] * 2}</strong></div>
                          <div><span>With 1 House:</span> <strong>${tile.rent[1]}</strong></div>
                          <div><span>With 2 Houses:</span> <strong>${tile.rent[2]}</strong></div>
                          <div><span>With 3 Houses:</span> <strong>${tile.rent[3]}</strong></div>
                          <div><span>With 4 Houses:</span> <strong>${tile.rent[4]}</strong></div>
                          <div><span>With Hotel:</span> <strong>${tile.rent[5]}</strong></div>
                          <div style={{ marginTop: '10px' }}><span>House Cost:</span> <strong>${tile.housePrice}</strong></div>
                          <div><span>Mortgage Value:</span> <strong>${tile.mortgageValue}</strong></div>
                        </section>
                      )}
                      {isRail && tile.rent && (
                        <section style={{ display: 'block', borderBottom: 'none', padding: 0 }}>
                          <div><span>Rent (1 owned):</span> <strong>$25</strong></div>
                          <div><span>Rent (2 owned):</span> <strong>$50</strong></div>
                          <div><span>Rent (3 owned):</span> <strong>$100</strong></div>
                          <div><span>Rent (4 owned):</span> <strong>$200</strong></div>
                          <div style={{ marginTop: '10px' }}><span>Mortgage Value:</span> <strong>${tile.mortgageValue}</strong></div>
                        </section>
                      )}
                      {isUtil && (
                        <section style={{ display: 'block', borderBottom: 'none', padding: 0 }}>
                          <p style={{ margin: '0 0 6px 0', fontSize: '0.7rem', color: '#64748b', lineHeight: '1.4' }}>
                            If 1 Utility is owned, rent is 4 times amount shown on dice.
                          </p>
                          <p style={{ margin: '0 0 6px 0', fontSize: '0.7rem', color: '#64748b', lineHeight: '1.4' }}>
                            If 2 Utilities are owned, rent is 10 times amount shown on dice.
                          </p>
                          <div style={{ marginTop: '10px' }}><span>Mortgage Value:</span> <strong>${tile.mortgageValue}</strong></div>
                        </section>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Dynamic Info, Math Calculations, & Actions */}
                  <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 0', textAlign: 'left' }}>
                    <div>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e293b' }}>
                        Live Status & Math
                      </h3>

                      {/* Owner status */}
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        marginBottom: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Current Owner</div>
                        <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>👤 {tile.owner ? (players.find(p => p.id === tile.owner)?.name || 'Unknown') : 'None (Available to Buy!)'}</span>
                          {tile.owner && tile.mortgaged && (
                            <span style={{ fontSize: '0.65rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>MORTGAGED</span>
                          )}
                        </div>
                      </div>

                      {/* Total current rent indicator */}
                      {tile.owner && (
                        <div style={{
                          background: tile.mortgaged ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          border: tile.mortgaged ? '1px dashed #ef4444' : '1px dashed #10b981',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          marginBottom: '10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          color: tile.mortgaged ? '#ef4444' : '#10b981',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                          <span>Total Current Rent:</span>
                          <strong style={{ fontSize: '1.1rem', fontFamily: 'monospace' }}>
                            {tile.mortgaged ? '$0' : `$${getCurrentRent()}`}
                          </strong>
                        </div>
                      )}

                      {/* Rent math breakdown */}
                      <div style={{ marginTop: '5px' }}>
                        {getRentMathBreakdown()}
                      </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                      {tile.owner && tile.owner !== playerId && (() => {
                        const isMyTurn = activePlayer?.id === playerId;
                        return (
                          <button
                            className="btn-gold"
                            disabled={!isMyTurn}
                            style={{
                              width: '100%',
                              padding: '10px',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              boxShadow: 'none',
                              borderRadius: '6px',
                              opacity: isMyTurn ? 1 : 0.6,
                              cursor: isMyTurn ? 'pointer' : 'not-allowed',
                              background: isMyTurn ? undefined : '#cbd5e1',
                              border: isMyTurn ? undefined : '1px solid #94a3b8',
                              color: isMyTurn ? undefined : '#64748b'
                            }}
                            onClick={() => {
                              if (!isMyTurn) return;
                              setTradeTargetId(tile.owner!);
                              setDemandedProperties([tile.index]);

                              // Reset other fields for a clean start
                              setOfferedProperties([]);
                              setOfferedMoney(0);
                              setOfferedJailCards(0);
                              setDemandedMoney(0);
                              setDemandedJailCards(0);

                              setIsTradeEditorOpen(true);
                              setSelectedDeedIndex(null);
                            }}
                          >
                            {isMyTurn ? '🤝 Propose Trade / Buy' : '🤝 Propose Trade (Your Turn Only)'}
                          </button>
                        );
                      })()}

                      <button
                        className="btn-primary"
                        style={{ width: '100%', padding: '10px', fontSize: '0.8rem', borderRadius: '6px' }}
                        onClick={() => setSelectedDeedIndex(null)}
                      >
                        Close Window
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Build & Mortgage management Modal */}
      {isBuildManagerOpen && (
        <div className="deed-card-modal-backdrop" onClick={() => setIsBuildManagerOpen(false)}>
          <div className="glass-panel build-manager-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="build-manager-title">
              Real Estate Portfolio & Build Manager
            </h3>

            <div className="monopoly-build-sections-container">
              {groupedProperties.length === 0 ? (
                <div className="build-empty-state">
                  No owned land. Buy properties when you land on them!
                </div>
              ) : (
                groupedProperties.map(([groupKey, list]) => {
                  const isColorGroup = groupKey !== 'railroad' && groupKey !== 'utility';
                  const isFullMonopoly = isColorGroup && monopolyColorGroups[groupKey] === playerId;

                  return (
                    <div key={groupKey} className="build-group-section">
                      <div className="build-group-header">
                        {isColorGroup && (
                          <div className={`build-group-color-dot tile-group-${groupKey}`} />
                        )}
                        <span className="build-group-title">
                          {isColorGroup ? `${groupKey} Group` : `${groupKey}s`}
                        </span>
                        {isFullMonopoly && (
                          <span className="build-group-badge">👑 Monopoly Set</span>
                        )}
                      </div>

                      <div className="build-properties-list">
                        {list.map(tile => {
                          const isProp = tile.type === 'property';
                          const canBuild = isProp && !tile.mortgaged;

                          const isCurrentTile = tile.index === (visualPositions[playerId] ?? players.find(p => p.id === playerId)?.position);

                          return (
                            <div key={tile.index} className={`build-property-row ${isCurrentTile ? 'current-tile-highlight' : ''}`}>
                              <div className="build-prop-info">
                                <span className="build-prop-name">{tile.name}</span>
                                <span className="build-prop-status">
                                  {tile.mortgaged ? 'Mortgaged' : tile.houses === 5 ? 'Hotel' : tile.houses === 0 ? 'Vacant Land' : `${tile.houses} Houses`}
                                </span>
                              </div>

                              <div className="build-prop-actions">
                                {/* Build button - separate, shown only if property is upgradeable */}
                                {canBuild && (
                                  <button
                                    className="build-action-btn build-add"
                                    disabled={rules?.ruleset === 'Get Rich' || tile.houses >= 5 || !isFullMonopoly || activePlayer?.id !== playerId || activePlayer?.money < (tile.housePrice || 0)}
                                    onClick={() => {
                                      onMonopolyAction('build-house', tile.index);
                                      sfx.playUpgrade();
                                    }}
                                    title={rules?.ruleset === 'Get Rich' ? "Building is only allowed instantly upon landing on the property in Get Rich mode." : !isFullMonopoly ? "Requires owning all properties of this color group (Monopoly Set)" : "Build House"}
                                  >
                                    🏢 Build (+${tile.housePrice})
                                  </button>
                                )}

                                {/* Combined Sell / Mortgage / Unmortgage Button */}
                                {tile.mortgaged ? (
                                  <button
                                    className="build-action-btn build-unmortgage"
                                    disabled={activePlayer?.id !== playerId || activePlayer?.money < Math.floor((tile.mortgageValue || 0) * 1.1)}
                                    onClick={() => {
                                      onMonopolyAction('unmortgage-property', tile.index);
                                      sfx.playMoney();
                                    }}
                                  >
                                    🏦 Pay Mortgage (-${Math.floor((tile.mortgageValue || 0) * 1.1)})
                                  </button>
                                ) : isProp && tile.houses > 0 ? (
                                  <button
                                    className="build-action-btn build-sell"
                                    disabled={activePlayer?.id !== playerId}
                                    onClick={() => {
                                      onMonopolyAction('sell-house', tile.index);
                                      sfx.playMoney();
                                    }}
                                    title="Sell House"
                                  >
                                    📉 Sell House (-${Math.floor((tile.housePrice || 0) / 2)})
                                  </button>
                                ) : (
                                  <button
                                    className="build-action-btn build-mortgage"
                                    disabled={activePlayer?.id !== playerId}
                                    onClick={() => {
                                      onMonopolyAction('mortgage-property', tile.index);
                                      sfx.playMoney();
                                    }}
                                  >
                                    💰 Mortgage (+${tile.mortgageValue})
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              className="btn-primary build-manager-done-btn"
              onClick={() => setIsBuildManagerOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Game Over screen overlay */}
      {gameState === 'gameover' && (
        <div className="deed-card-modal-backdrop" style={{ background: 'rgba(15, 23, 42, 0.9)', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', background: 'white', color: '#0f172a', textAlign: 'center', padding: '30px' }}>
            <h2 style={{ fontSize: '2rem', color: '#10b981', marginBottom: '10px' }}>Game Over</h2>

            {(() => {
              const winner = players.find(p => p.finishRank === 1);
              return (
                <div style={{ marginBottom: '25px' }}>
                  <div style={{ fontSize: '1rem', color: '#64748b' }}>The Tycoon Winner:</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: '5px 0' }}>{winner?.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>Final Worth: ${winner?.netWorth}</div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {isHost && (
                <button className="btn-primary" style={{ padding: '10px' }} onClick={onRestartGame}>Play Again</button>
              )}
              <button className="btn-secondary" style={{ padding: '10px' }} onClick={onLeaveRoom}>Exit to Menu</button>
            </div>
          </div>
        </div>
      )}

      {/* 2D Dice Roll Popup Modal */}
      {showDiceModal && (
        <div className="dice-modal-backdrop">
          <div className="glass-panel dice-modal-content">
            <h3 className="dice-modal-title">
              {diceModalPhase === 'rolling' ? 'ROLLING DICE...' : 'DICE ROLLED!'}
            </h3>

            <div className="dice-modal-container">
              {render2DDie(animatedDice[0], diceModalPhase === 'rolling', getPlayerColor(activePlayer?.id))}
              {render2DDie(animatedDice[1], diceModalPhase === 'rolling', getPlayerColor(activePlayer?.id))}
            </div>

            {diceModalPhase === 'settled' && (
              <div className="dice-modal-result-container">
                <div className="dice-modal-total">
                  🎲 {animatedDice[0] + animatedDice[1]}
                </div>
                {animatedDice[0] === animatedDice[1] && (
                  <div className="dice-modal-doubles">
                    🔥 Doubles! Go Again!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Detail Popup Modal */}
      {detailedPlayerId && (() => {
        const p = players.find(player => player.id === detailedPlayerId);
        if (!p) return null;
        const playerColor = getPlayerColor(p.id);
        const ownedProps = monopolyBoard.filter(t => t.owner === p.id);
        const railroadCount = ownedProps.filter(t => t.type === 'railroad').length;
        const utilityCount = ownedProps.filter(t => t.type === 'utility').length;

        return (
          <div className="player-detail-modal-backdrop" onClick={() => setDetailedPlayerId(null)}>
            <div className="player-detail-modal" style={{ borderColor: playerColor }} onClick={e => e.stopPropagation()}>
              <button className="player-detail-close" onClick={() => setDetailedPlayerId(null)}>✕</button>

              <div className="player-detail-header" style={{ ['--player-color' as any]: playerColor }}>
                <div className="player-detail-avatar-circle">
                  <AvatarSVG config={p.avatar} size={50} />
                </div>
                <div className="player-detail-header-info">
                  <h3 className="player-detail-name">{p.name}</h3>
                  <span className="player-detail-role">{p.isBot ? '🤖 BOT PLAYER' : p.id === playerId ? '👤 YOU' : '🎮 PLAYER'}</span>
                </div>
              </div>

              <div className="player-detail-body">
                <div className="player-detail-stats">
                  <div className="player-detail-stat-card">
                    <span className="stat-label">💵 CURRENT CASH</span>
                    <span className="stat-val cash-val">${p.money}</span>
                  </div>
                  <div className="player-detail-stat-card">
                    <span className="stat-label">🏆 NET WORTH</span>
                    <span className="stat-val net-val">${p.netWorth}</span>
                  </div>
                </div>

                <div className="player-detail-section">
                  <h4 className="section-title">🔓 SPECIAL CARDS</h4>
                  <div className="special-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {p.getOutOfJailCards > 0 && (
                      <div className="detail-special-card jail-free">
                        🎟️ Get Out of Jail Free Card (x{p.getOutOfJailCards})
                      </div>
                    )}
                    {rules?.ruleset === 'Get Rich' && (p as any).oddEvenCards !== undefined && (p as any).oddEvenCards > 0 && (
                      <div className="detail-special-card odd-even" style={{ background: '#7c3aed', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                        🎯 Odd/Even Card (x{(p as any).oddEvenCards})
                      </div>
                    )}
                    {rules?.ruleset === 'Get Rich' && (p as any).angelCards !== undefined && (p as any).angelCards > 0 && (
                      <div className="detail-special-card angel" style={{ background: '#10b981', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                        😇 Angel Card (x{(p as any).angelCards})
                      </div>
                    )}
                    {p.getOutOfJailCards <= 0 && (!(rules?.ruleset === 'Get Rich') || (((p as any).oddEvenCards || 0) <= 0 && ((p as any).angelCards || 0) <= 0)) && (
                      <span className="detail-empty">No special cards</span>
                    )}
                  </div>
                </div>

                <div className="player-detail-section">
                  <h4 className="section-title">🏠 PROPERTIES OWNED ({ownedProps.length})</h4>
                  <div className="properties-list-detail">
                    {ownedProps.length === 0 ? (
                      <span className="detail-empty">None owned</span>
                    ) : (
                      ownedProps.map(tile => {
                        const isProp = tile.type === 'property';
                        const isRail = tile.type === 'railroad';
                        const isUtil = tile.type === 'utility';
                        const isMonopoly = isProp && tile.color ? monopolyColorGroups[tile.color] === p.id : false;

                        let currentRentLabel = '';
                        if (tile.mortgaged) {
                          currentRentLabel = '$0 (Mortgaged)';
                        } else if (isProp && tile.rent) {
                          const currentRentValue = tile.houses === 0 ? (isMonopoly ? tile.rent[0] * 2 : tile.rent[0]) : tile.rent[tile.houses];
                          currentRentLabel = `$${currentRentValue}`;
                        } else if (isRail && tile.rent) {
                          const currentRentValue = tile.rent[Math.min(railroadCount - 1, 3)];
                          currentRentLabel = `$${currentRentValue}`;
                        } else if (isUtil) {
                          currentRentLabel = utilityCount === 2 ? '10x Dice' : '4x Dice';
                        }

                        return (
                          <div key={tile.index} className="detail-property-card">
                            <div className="detail-property-card-header">
                              <div className="detail-property-card-title-group">
                                {tile.color ? (
                                  <div className={`detail-card-color-dot tile-group-${tile.color}`} />
                                ) : (
                                  <div className="detail-card-color-dot special-type" style={{ background: isRail ? '#475569' : '#0ea5e9', color: 'white' }}>
                                    {isRail ? '🚂' : '⚡'}
                                  </div>
                                )}
                                <span className="detail-property-card-name">{tile.name}</span>
                              </div>
                              <span className={`detail-property-card-status ${tile.mortgaged ? 'mortgaged' : 'active'}`}>
                                {tile.mortgaged ? 'Mortgaged' : tile.houses === 5 ? 'Hotel' : tile.houses > 0 ? `${tile.houses} Houses` : 'Owned'}
                              </span>
                            </div>

                            <div className="detail-property-card-body">
                              <div className="detail-property-financials">
                                <div className="detail-property-fin-row">
                                  <span>Value:</span>
                                  <strong>${tile.price || 0}</strong>
                                </div>
                                <div className="detail-property-fin-row">
                                  <span>Mortgage:</span>
                                  <strong>${tile.mortgageValue || 0}</strong>
                                </div>
                                {isProp && (
                                  <div className="detail-property-fin-row">
                                    <span>Build Cost:</span>
                                    <strong>${tile.housePrice || 0}</strong>
                                  </div>
                                )}
                                <div className="detail-property-fin-row" style={{ marginTop: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
                                  <span>Current Rent:</span>
                                  <strong style={{ color: tile.mortgaged ? '#ef4444' : '#10b981' }}>{currentRentLabel}</strong>
                                </div>
                              </div>

                              {isProp && tile.rent && tile.rent.length >= 6 && (
                                <div className="detail-property-rents-grid">
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 0 && !isMonopoly ? 'active' : ''}`}>
                                    <span className="rent-label">Base</span>
                                    <span className="rent-value">${tile.rent[0]}</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 0 && isMonopoly ? 'active' : ''}`}>
                                    <span className="rent-label">Mono</span>
                                    <span className="rent-value">${tile.rent[0] * 2}</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 1 ? 'active' : ''}`}>
                                    <span className="rent-label">1 House</span>
                                    <span className="rent-value">${tile.rent[1]}</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 2 ? 'active' : ''}`}>
                                    <span className="rent-label">2 House</span>
                                    <span className="rent-value">${tile.rent[2]}</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 3 ? 'active' : ''}`}>
                                    <span className="rent-label">3 House</span>
                                    <span className="rent-value">${tile.rent[3]}</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 4 ? 'active' : ''}`}>
                                    <span className="rent-label">4 House</span>
                                    <span className="rent-value">${tile.rent[4]}</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && tile.houses === 5 ? 'active' : ''}`}>
                                    <span className="rent-label">Hotel</span>
                                    <span className="rent-value">${tile.rent[5]}</span>
                                  </div>
                                </div>
                              )}

                              {isRail && tile.rent && tile.rent.length >= 4 && (
                                <div className="detail-property-rents-grid">
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && railroadCount === 1 ? 'active' : ''}`}>
                                    <span className="rent-label">1 RR</span>
                                    <span className="rent-value">$25</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && railroadCount === 2 ? 'active' : ''}`}>
                                    <span className="rent-label">2 RRs</span>
                                    <span className="rent-value">$50</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && railroadCount === 3 ? 'active' : ''}`}>
                                    <span className="rent-label">3 RRs</span>
                                    <span className="rent-value">$100</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && railroadCount === 4 ? 'active' : ''}`}>
                                    <span className="rent-label">4 RRs</span>
                                    <span className="rent-value">$200</span>
                                  </div>
                                </div>
                              )}

                              {isUtil && (
                                <div className="detail-property-rents-grid">
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && utilityCount === 1 ? 'active' : ''}`}>
                                    <span className="rent-label">1 Util</span>
                                    <span className="rent-value">4x Roll</span>
                                  </div>
                                  <div className={`detail-property-rent-item ${!tile.mortgaged && utilityCount === 2 ? 'active' : ''}`}>
                                    <span className="rent-label">2 Utils</span>
                                    <span className="rent-value">10x Roll</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                {p.id !== playerId && !p.bankrupt && ['roll', 'end_turn', 'action'].includes(monopolyPhase) && activePlayer?.id === playerId && (
                  <div className="player-detail-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                    <button
                      className="btn-primary"
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 'bold' }}
                      onClick={() => {
                        setTradeTargetId(p.id);
                        setOfferedProperties([]);
                        setOfferedMoney(0);
                        setOfferedJailCards(0);
                        setDemandedProperties([]);
                        setDemandedMoney(0);
                        setDemandedJailCards(0);
                        setIsTradeEditorOpen(true);
                        setDetailedPlayerId(null);
                      }}
                    >
                      🤝 Propose Trade Deal
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Reset Camera Button */}
      {isCameraManual && (
        <button
          className="reset-camera-btn"
          onClick={() => {
            setIsCameraManual(false);
            setDefaultCameraX(0);
            setDefaultCameraY(0);
            setDefaultCameraScale(0.98);
            setCameraTransition('1.0s');
          }}
        >
          📷 Reset Camera
        </button>
      )}

      {/* Property Auction Modal */}
      {monopolyPhase === 'auction' && auctionState && (() => {
        const tile = monopolyBoard[auctionState.tileIndex];
        if (!tile) return null;

        const bidderId = auctionState.bidders[auctionState.activeBidderIndex];
        const activeBidder = players.find(p => p.id === bidderId);
        const isMyBiddingTurn = bidderId === playerId;
        const highestBidderName = auctionState.highestBidder
          ? players.find(p => p.id === auctionState.highestBidder)?.name || 'Unknown'
          : 'None';

        return (
          <div className="deed-card-modal-backdrop">
            <div className="player-detail-modal auction-modal" style={{ maxWidth: '520px', borderColor: 'var(--primary)' }}>
              <div className="auction-header" style={{ textAlign: 'center', marginBottom: '15px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-gold)' }}>🎲 PROPERTY AUCTION 🎲</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>The highest bidder gets the title deed!</p>
              </div>

              {/* Auctioned Property Details */}
              <div style={{ display: 'flex', gap: '15px', background: 'rgba(0,0,0,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '15px', alignItems: 'center' }}>
                {tile.color ? (
                  <div className="deed-card" style={{ transform: 'scale(0.8)', margin: 0, pointerEvents: 'none' }}>
                    <div className="deed-header">
                      <div className={`deed-header-color tile-group-${tile.color}`} />
                      <div className="deed-title">{tile.name}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: '5px' }}>Original Price: ${tile.price}</div>
                  </div>
                ) : (
                  <div style={{ background: '#0ea5e9', color: 'white', padding: '15px', borderRadius: '10px', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {tile.type === 'railroad' ? '🚂' : '⚡'} {tile.name}
                    <div style={{ fontSize: '0.75rem', fontWeight: 'normal', marginTop: '4px' }}>Original Price: ${tile.price}</div>
                  </div>
                )}
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>CURRENT BID</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#10b981' }}>${auctionState.highestBid}</div>
                  <div style={{ fontSize: '0.85rem' }}>
                    Highest Bidder: <strong style={{ color: 'var(--text-primary)' }}>{highestBidderName}</strong>
                  </div>
                </div>
              </div>

              {/* Financials & Rents Details (Requirement 3) */}
              <div style={{
                background: 'rgba(0,0,0,0.02)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '15px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '8px' }}>
                  <div>💵 Price: <strong>${tile.price}</strong></div>
                  <div>🏦 Mortgage: <strong>${tile.mortgageValue}</strong></div>
                  {tile.type === 'property' && <div>🛠️ Build Cost: <strong>${tile.housePrice}/house</strong></div>}
                </div>

                <div>
                  <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Rent Breakdown:</strong>
                  {tile.type === 'property' && tile.rent && tile.rent.length >= 6 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Base</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[0]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Monopoly</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[0] * 2}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>1 House</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[1]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>2 Houses</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[2]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>3 Houses</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[3]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>4 Houses</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[4]}</strong>
                      </div>
                      <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.2)', gridColumn: 'span 3', marginTop: '2px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--accent-gold-hover)' }}>🏨 Hotel Rent</div>
                        <strong style={{ color: 'var(--accent-gold-hover)' }}>${tile.rent[5]}</strong>
                      </div>
                    </div>
                  )}
                  {tile.type === 'railroad' && tile.rent && tile.rent.length >= 4 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>1 RR</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[0]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>2 RRs</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[1]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>3 RRs</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[2]}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>4 RRs</div>
                        <strong style={{ color: 'var(--text-primary)' }}>${tile.rent[3]}</strong>
                      </div>
                    </div>
                  )}
                  {tile.type === 'utility' && tile.rent && tile.rent.length >= 2 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>1 Utility</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{tile.rent[0]}x Roll</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>2 Utilities</div>
                        <strong style={{ color: 'var(--text-primary)' }}>{tile.rent[1]}x Roll</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bidder List */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '4px' }}>Bidders In Room</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                  {players.filter(p => !p.bankrupt).map(p => {
                    const isBiddingActive = auctionState.bidders.includes(p.id);
                    const isCurrentBidder = bidderId === p.id;
                    const isWinner = auctionState.highestBidder === p.id;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '8px',
                          borderRadius: '8px',
                          background: isCurrentBidder ? '#dcfce7' : '#f1f5f9',
                          border: isCurrentBidder ? '2px solid #10b981' : isWinner ? '2px solid #fbbf24' : '1px solid transparent',
                          opacity: isBiddingActive ? 1 : 0.5,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AvatarSVG config={p.avatar} size={20} />
                          <span style={{ fontSize: '0.8rem', fontWeight: isCurrentBidder ? 'bold' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexGrow: 1 }} title={p.name}>
                            {p.name} {p.id === playerId ? '(You)' : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '4px', marginTop: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Cash:</span>
                            <strong style={{ color: '#10b981' }}>${p.money}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Worth:</span>
                            <strong style={{ color: '#3b82f6' }}>${p.netWorth}</strong>
                          </div>
                        </div>
                        {!isBiddingActive && (
                          <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold', textAlign: 'center', marginTop: '2px' }}>
                            Passed
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bid Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {isMyBiddingTurn ? (
                  <>
                    <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 'bold', textAlign: 'center' }}>
                      👉 IT IS YOUR TURN TO BID OR FOLD!
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-primary"
                        style={{ flexGrow: 1, padding: '12px 0', justifyContent: 'center' }}
                        onClick={() => onMonopolyAction('auction-bid', { bid: Math.max(10, auctionState.highestBid + 10) })}
                      >
                        Bid ${Math.max(10, auctionState.highestBid + 10)}
                      </button>
                      <button
                        className="btn-primary"
                        style={{ flexGrow: 1, padding: '12px 0', background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', boxShadow: 'none', justifyContent: 'center' }}
                        onClick={() => onMonopolyAction('auction-bid', { bid: Math.max(10, auctionState.highestBid + 50) })}
                      >
                        Bid ${Math.max(10, auctionState.highestBid + 50)}
                      </button>
                    </div>
                    <button
                      className="btn-secondary"
                      style={{ padding: '12px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      onClick={() => onMonopolyAction('auction-pass')}
                    >
                      Fold (Pass)
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    ⏳ Waiting for <strong style={{ color: 'var(--text-primary)' }}>{activeBidder?.name || 'opponent'}</strong> to bid...
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Propose Trade Editor Modal */}
      {isTradeEditorOpen && tradeTargetId && !tradeBoardSelectionMode && (() => {
        const targetPlayer = players.find(p => p.id === tradeTargetId);
        const me = players.find(p => p.id === playerId);
        if (!targetPlayer || !me) return null;

        const myProperties = monopolyBoard.filter(t => t.owner === me.id);
        const targetProperties = monopolyBoard.filter(t => t.owner === targetPlayer.id);

        const isUpgradedGroup = (tile: TileState) => {
          if (rules?.ruleset === 'Get Rich') return false;
          if (tile.type !== 'property' || !tile.color) return false;
          return monopolyBoard.filter(t => t.color === tile.color).some(t => t.houses > 0);
        };

        const getRentForTile = (tile: TileState) => {
          if (tile.mortgaged) return 0;
          if (tile.type === 'property') {
            const color = tile.color;
            const isMonopoly = color ? monopolyColorGroups[color] === tile.owner : false;
            if (tile.houses === 0) {
              return isMonopoly ? (tile.rent?.[0] || 0) * 2 : (tile.rent?.[0] || 0);
            }
            return tile.rent?.[tile.houses] || 0;
          }
          if (tile.type === 'railroad') {
            const count = monopolyBoard.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
            return tile.rent?.[Math.min(count - 1, 3)] || 25;
          }
          if (tile.type === 'utility') {
            const count = monopolyBoard.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
            return 7 * (count === 2 ? 10 : 4);
          }
          return 0;
        };

        const handleSendTrade = () => {
          onMonopolyAction('trade-propose', {
            receiverId: tradeTargetId,
            senderProperties: offeredProperties,
            senderMoney: offeredMoney,
            receiverProperties: demandedProperties,
            receiverMoney: demandedMoney,
            senderJailCards: offeredJailCards,
            receiverJailCards: demandedJailCards
          });
          setIsTradeEditorOpen(false);
        };

        const offeredPropsWorth = offeredProperties.reduce((sum, idx) => sum + (monopolyBoard[idx].price || 0), 0);
        const demandedPropsWorth = demandedProperties.reduce((sum, idx) => sum + (monopolyBoard[idx].price || 0), 0);

        const totalOfferedValue = offeredPropsWorth + offeredMoney;
        const totalDemandedValue = demandedPropsWorth + demandedMoney;
        const netDifference = totalOfferedValue - totalDemandedValue;

        return (
          <div className="deed-card-modal-backdrop">
            <div className="player-detail-modal" style={{ maxWidth: '640px', width: '95%' }}>
              <button
                className="player-detail-close"
                onClick={() => {
                  setIsTradeEditorOpen(false);
                  if (activeTrade && activeTrade.status === 'countering' && activeTrade.receiverId === playerId) {
                    onMonopolyAction('trade-decline');
                  }
                }}
              >
                ✕
              </button>

              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '15px', color: 'var(--primary)', textAlign: 'center' }}>
                🤝 PROPOSE TRADE DEAL
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                {/* Offered Side (Left) */}
                <div style={{ borderRight: '1px solid rgba(0,0,0,0.08)', paddingRight: '10px' }}>
                  <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#10b981', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AvatarSVG config={me.avatar} size={18} /> YOUR OFFER
                  </h4>

                  {/* Cash offer */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>CASH (Max ${me.money})</label>
                    <input
                      type="number"
                      min="0"
                      max={me.money}
                      value={offeredMoney}
                      onChange={e => setOfferedMoney(Math.min(me.money, Math.max(0, parseInt(e.target.value) || 0)))}
                      style={{ width: '100%', padding: '6px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  {/* Jail cards offer */}
                  {me.getOutOfJailCards > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>JAIL CARDS (Max {me.getOutOfJailCards})</label>
                      <input
                        type="number"
                        min="0"
                        max={me.getOutOfJailCards}
                        value={offeredJailCards}
                        onChange={e => setOfferedJailCards(Math.min(me.getOutOfJailCards, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: '100%', padding: '6px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  )}

                  {/* Properties checklist */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>PROPERTIES</label>
                      <button
                        className="btn-gold"
                        style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px', boxShadow: 'none', margin: 0 }}
                        onClick={() => setTradeBoardSelectionMode('me')}
                      >
                        🗺️ Choose from Board
                      </button>
                    </div>
                    {myProperties.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No properties owned</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {myProperties.map(tile => {
                          const hasHouses = isUpgradedGroup(tile);
                          const rent = getRentForTile(tile);
                          return (
                            <label key={tile.index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', cursor: hasHouses ? 'not-allowed' : 'pointer', opacity: hasHouses ? 0.6 : 1, padding: '4px 0' }}>
                              <input
                                type="checkbox"
                                disabled={hasHouses}
                                checked={offeredProperties.includes(tile.index)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setOfferedProperties(prev => [...prev, tile.index]);
                                  } else {
                                    setOfferedProperties(prev => prev.filter(idx => idx !== tile.index));
                                  }
                                }}
                                style={{ marginTop: '3px' }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {tile.color && <div className={`detail-card-color-dot tile-group-${tile.color}`} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />}
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tile.name}</span>
                                  {hasHouses && <span style={{ fontSize: '0.65rem', color: '#ef4444', marginLeft: '6px' }}>(Has Houses)</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Worth: <span style={{ color: '#10b981', fontWeight: 600 }}>${tile.price}</span> | Rent: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{tile.mortgaged ? 'Mortgaged' : tile.type === 'utility' ? `$${rent} (avg)` : `$${rent}`}</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Requested Side (Right) */}
                <div>
                  <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3b82f6', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AvatarSVG config={targetPlayer.avatar} size={18} /> YOUR DEMAND
                  </h4>

                  {/* Cash demand */}
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>CASH (Max ${targetPlayer.money})</label>
                    <input
                      type="number"
                      min="0"
                      max={targetPlayer.money}
                      value={demandedMoney}
                      onChange={e => setDemandedMoney(Math.min(targetPlayer.money, Math.max(0, parseInt(e.target.value) || 0)))}
                      style={{ width: '100%', padding: '6px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  {/* Jail cards demand */}
                  {targetPlayer.getOutOfJailCards > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.75rem', display: 'block', marginBottom: '4px', color: 'var(--text-muted)' }}>JAIL CARDS (Max {targetPlayer.getOutOfJailCards})</label>
                      <input
                        type="number"
                        min="0"
                        max={targetPlayer.getOutOfJailCards}
                        value={demandedJailCards}
                        onChange={e => setDemandedJailCards(Math.min(targetPlayer.getOutOfJailCards, Math.max(0, parseInt(e.target.value) || 0)))}
                        style={{ width: '100%', padding: '6px', fontSize: '0.9rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  )}

                  {/* Properties checklist */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>PROPERTIES</label>
                      <button
                        className="btn-gold"
                        style={{ padding: '2px 8px', fontSize: '0.65rem', borderRadius: '4px', boxShadow: 'none', margin: 0 }}
                        onClick={() => setTradeBoardSelectionMode('them')}
                      >
                        🗺️ Choose from Board
                      </button>
                    </div>
                    {targetProperties.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No properties owned</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {targetProperties.map(tile => {
                          const hasHouses = isUpgradedGroup(tile);
                          const rent = getRentForTile(tile);
                          return (
                            <label key={tile.index} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8rem', cursor: hasHouses ? 'not-allowed' : 'pointer', opacity: hasHouses ? 0.6 : 1, padding: '4px 0' }}>
                              <input
                                type="checkbox"
                                disabled={hasHouses}
                                checked={demandedProperties.includes(tile.index)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setDemandedProperties(prev => [...prev, tile.index]);
                                  } else {
                                    setDemandedProperties(prev => prev.filter(idx => idx !== tile.index));
                                  }
                                }}
                                style={{ marginTop: '3px' }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {tile.color && <div className={`detail-card-color-dot tile-group-${tile.color}`} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />}
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tile.name}</span>
                                  {hasHouses && <span style={{ fontSize: '0.65rem', color: '#ef4444', marginLeft: '6px' }}>(Has Houses)</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Worth: <span style={{ color: '#10b981', fontWeight: 600 }}>${tile.price}</span> | Rent: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{tile.mortgaged ? 'Mortgaged' : tile.type === 'utility' ? `$${rent} (avg)` : `$${rent}`}</span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Trade Balance Summary & Auto-Balance Button */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '15px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Total Offered Value: <strong>${totalOfferedValue}</strong> <span style={{ fontSize: '0.7rem' }}>(Props: ${offeredPropsWorth} + Cash: ${offeredMoney})</span></span>
                  <span>Total Demanded Value: <strong>${totalDemandedValue}</strong> <span style={{ fontSize: '0.7rem' }}>(Props: ${demandedPropsWorth} + Cash: ${demandedMoney})</span></span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '8px'
                }}>
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    color: netDifference === 0 ? '#10b981' : netDifference > 0 ? '#f59e0b' : '#ef4444'
                  }}>
                    {netDifference === 0
                      ? '⚖️ Trade is perfectly balanced!'
                      : netDifference > 0
                        ? `📈 Proposer is overpaying by $${netDifference}`
                        : `📉 Proposer is underpaying by $${-netDifference}`
                    }
                  </span>

                  <button
                    className="btn-primary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const propDiff = demandedPropsWorth - offeredPropsWorth;
                      if (propDiff > 0) {
                        setOfferedMoney(Math.min(me.money, propDiff));
                        setDemandedMoney(0);
                      } else if (propDiff < 0) {
                        setOfferedMoney(0);
                        setDemandedMoney(Math.min(targetPlayer.money, -propDiff));
                      } else {
                        setOfferedMoney(0);
                        setDemandedMoney(0);
                      }
                      sfx.playMoney();
                    }}
                  >
                    ⚖️ Auto-Balance Cash
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-primary" style={{ flexGrow: 1, padding: '12px 0' }} onClick={handleSendTrade}>
                  📤 Send Offer
                </button>
                <button
                  className="btn-secondary"
                  style={{ flexGrow: 1, padding: '12px 0' }}
                  onClick={() => {
                    setIsTradeEditorOpen(false);
                    if (activeTrade && activeTrade.status === 'countering' && activeTrade.receiverId === playerId) {
                      onMonopolyAction('trade-decline');
                    }
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Incoming Trade Proposal Modal */}
      {activeTrade && activeTrade.receiverId === playerId && activeTrade.status === 'pending' && !incomingTradeViewBoardMode && (() => {
        const sender = players.find(p => p.id === activeTrade.senderId);
        if (!sender) return null;

        return (
          <div className="deed-card-modal-backdrop">
            <div className="player-detail-modal" style={{ maxWidth: '540px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary)', textAlign: 'center', marginBottom: '15px' }}>
                🤝 INCOMING TRADE OFFER
              </h3>
              <p style={{ textAlign: 'center', fontSize: '0.9rem', marginBottom: '15px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{sender.name}</strong> proposed a trade deal to you:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: 'rgba(0,0,0,0.03)', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
                {/* Offered assets */}
                <div style={{ borderRight: '1px solid rgba(0,0,0,0.08)', paddingRight: '10px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>THEY OFFER</h4>
                  {activeTrade.senderMoney > 0 && <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>💵 Cash: <strong>${activeTrade.senderMoney}</strong></div>}
                  {activeTrade.senderJailCards > 0 && <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>🎟️ Jail Cards: <strong>{activeTrade.senderJailCards}</strong></div>}
                  {activeTrade.senderProperties.length > 0 ? (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Properties:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        {activeTrade.senderProperties.map((idx: number) => {
                          const tile = monopolyBoard[idx];
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                              {tile?.color && <div className={`detail-card-color-dot tile-group-${tile.color}`} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />}
                              <span>
                                {tile?.name || `Tile ${idx}`}{' '}
                                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                  (Worth: ${tile?.price || 0}
                                  {tile?.rent ? `, Rent: $${tile.houses > 0 ? tile.rent[tile.houses] : tile.rent[0]}` : ''}
                                  {tile?.mortgaged ? ' - Mortgaged' : ''})
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    activeTrade.senderMoney === 0 && activeTrade.senderJailCards === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing offered</span>
                  )}
                </div>

                {/* Demanded assets */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '8px' }}>THEY DEMAND</h4>
                  {activeTrade.receiverMoney > 0 && <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>💵 Cash: <strong>${activeTrade.receiverMoney}</strong></div>}
                  {activeTrade.receiverJailCards > 0 && <div style={{ fontSize: '0.9rem', marginBottom: '4px' }}>🎟️ Jail Cards: <strong>{activeTrade.receiverJailCards}</strong></div>}
                  {activeTrade.receiverProperties.length > 0 ? (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Properties:</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        {activeTrade.receiverProperties.map((idx: number) => {
                          const tile = monopolyBoard[idx];
                          return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                              {tile?.color && <div className={`detail-card-color-dot tile-group-${tile.color}`} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />}
                              <span>
                                {tile?.name || `Tile ${idx}`}{' '}
                                <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                  (Worth: ${tile?.price || 0}
                                  {tile?.rent ? `, Rent: $${tile.houses > 0 ? tile.rent[tile.houses] : tile.rent[0]}` : ''}
                                  {tile?.mortgaged ? ' - Mortgaged' : ''})
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    activeTrade.receiverMoney === 0 && activeTrade.receiverJailCards === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing requested</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn-primary" style={{ flex: '1 1 30%', padding: '10px 0' }} onClick={() => onMonopolyAction('trade-accept')}>
                  Accept
                </button>
                <button
                  className="btn-gold"
                  style={{ flex: '1 1 30%', padding: '10px 0', boxShadow: 'none' }}
                  onClick={() => setIncomingTradeViewBoardMode(true)}
                >
                  👁️ View Board
                </button>
                <button className="btn-secondary" style={{ flex: '1 1 30%', padding: '10px 0' }} onClick={() => onMonopolyAction('trade-decline')}>
                  Decline
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Awaiting Trade Response Banner */}
      {activeTrade && activeTrade.senderId === playerId && (activeTrade.status === 'pending' || activeTrade.status === 'countering') && (() => {
        const receiver = players.find(p => p.id === activeTrade.receiverId);
        return (
          <div className="deed-card-modal-backdrop" style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'none' }}>
            <div className="player-detail-modal" style={{ maxWidth: '380px', padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>⏳</div>
              <h4 style={{ fontWeight: 'bold', marginBottom: '6px' }}>
                {activeTrade.status === 'countering' ? 'Opponent Countering!' : 'Offer Sent!'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                {activeTrade.status === 'countering'
                  ? `${receiver?.name || 'opponent'} is preparing a counter offer...`
                  : `Awaiting response from ${receiver?.name || 'opponent'}...`}
              </p>
              <button
                className="btn-secondary"
                style={{ width: '100%', padding: '10px 0' }}
                onClick={() => onMonopolyAction('trade-cancel')}
              >
                Cancel Offer
              </button>
            </div>
          </div>
        );
      })()}

      {/* Trade Rejected Popup */}
      {tradeRejectedName && (
        <div className="deed-card-modal-backdrop" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(3px)', zIndex: 1100 }}>
          <div 
            className="player-detail-modal" 
            style={{ 
              maxWidth: '360px', 
              padding: '24px 16px', 
              textAlign: 'center', 
              border: '2px solid #ef4444', 
              boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.25), 0 10px 10px -5px rgba(239, 68, 68, 0.25)' 
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>❌</div>
            <h3 style={{ fontWeight: 900, fontSize: '1.4rem', color: '#ef4444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Offer Declined
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.4' }}>
              <strong>{tradeRejectedName}</strong> declined your trade offer.
            </p>
          </div>
        </div>
      )}

      {/* Floating HUD Panel for Trade Board Selection Mode */}
      {tradeBoardSelectionMode && (() => {
        const targetPlayer = players.find(p => p.id === tradeTargetId);
        if (!targetPlayer) return null;

        const selectionTitle = tradeBoardSelectionMode === 'me' ? 'YOUR OFFER (GIVE)' : 'YOUR DEMAND (GET)';
        const count = tradeBoardSelectionMode === 'me' ? offeredProperties.length : demandedProperties.length;
        const worth = (tradeBoardSelectionMode === 'me' ? offeredProperties : demandedProperties)
          .reduce((sum, idx) => sum + (monopolyBoard[idx]?.price || 0), 0);

        return (
          <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '2px solid var(--primary, #fbbf24)',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
            width: '90%',
            maxWidth: '480px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px', color: 'var(--primary, #fbbf24)' }}>
              🗺️ SELECT FROM BOARD
            </div>
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
              Click properties owned by <strong>{tradeBoardSelectionMode === 'me' ? 'you' : targetPlayer.name}</strong> to toggle selection
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              background: 'rgba(255,255,255,0.06)',
              padding: '8px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div>Mode: <span style={{ color: tradeBoardSelectionMode === 'me' ? '#10b981' : '#3b82f6' }}>{selectionTitle}</span></div>
              <div>Selected: <span style={{ color: 'var(--primary, #fbbf24)' }}>{count}</span> (${worth})</div>
            </div>
            <button
              className="btn-primary"
              style={{
                width: '100%',
                padding: '10px 0',
                fontWeight: 'bold',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginTop: '4px'
              }}
              onClick={() => setTradeBoardSelectionMode(null)}
            >
              Done (Return to Trade)
            </button>
          </div>
        );
      })()}

      {/* Floating HUD Panel for Incoming Trade Board View Mode */}
      {incomingTradeViewBoardMode && activeTrade && (() => {
        const sender = players.find(p => p.id === activeTrade.senderId);
        if (!sender) return null;

        return (
          <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '2px solid var(--primary, #fbbf24)',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: 'white',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
            width: '90%',
            maxWidth: '480px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px', color: 'var(--primary, #fbbf24)' }}>
              👁️ VIEWING PROPOSED TRADE
            </div>
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
              Visualizing the assets in the proposal from <strong>{sender.name}</strong> on the board
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(255,255,255,0.06)',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#10b981', borderRadius: '3px', boxShadow: '0 0 8px #10b981' }} />
                <span><strong>Properties you will receive</strong> ({activeTrade.senderProperties.length} properties)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px', boxShadow: '0 0 8px #ef4444' }} />
                <span><strong>Properties you will give</strong> ({activeTrade.receiverProperties.length} properties)</span>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{
                width: '100%',
                padding: '10px 0',
                fontWeight: 'bold',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginTop: '4px'
              }}
              onClick={() => setIncomingTradeViewBoardMode(false)}
            >
              Return to Trade Proposal
            </button>
          </div>
        );
      })()}

      {/* ==================== Casino Premium Coin Flip Modal ==================== */}
      {!isAnimating && casinoState && (() => {
        const activeFlippingPlayer = players.find(p => p.id === casinoState.playerId);
        const isActivePlayerFlipping = casinoState.playerId === playerId;
        const isFlipping = casinoState.status === 'flipping';
        const isWon = casinoState.status === 'won';
        const isLost = casinoState.status === 'lost';
        const isPending = casinoState.status === 'pending_flip';
        const coinFinalRotation = casinoState.result === 'win' ? '1800deg' : '1980deg';

        return (
          <div className="casino-modal-overlay">
            {isWon && <div className="confetti-shimmer" />}
            <div className="casino-card">
              <div className="casino-title">🎰 GET RICH CASINO 🎰</div>
              <div className="casino-subtitle">
                {activeFlippingPlayer ? (
                  <>
                    Player <strong>{activeFlippingPlayer.name}</strong> is rolling their fortune!
                  </>
                ) : (
                  "Rolling your fortune!"
                )}
              </div>

              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', marginBottom: '20px' }}>
                Round {casinoState.round} — Target: ${casinoState.payout}
              </div>

              {/* 3D Coin flip container */}
              <div className="coin-container">
                <div 
                  className={`coin-3d ${isFlipping ? 'flipping' : ''} ${isWon ? 'won-state' : ''} ${isLost ? 'lost-state' : ''}`}
                  style={{ '--coin-final-rotation': coinFinalRotation } as React.CSSProperties}
                >
                  <div className="coin-side coin-front">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className="coin-crown">👑</span>
                      <span style={{ fontSize: '0.9rem', color: '#1e1b4b' }}>WIN</span>
                    </div>
                  </div>
                  <div className="coin-side coin-back">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className="coin-crown">💀</span>
                      <span style={{ fontSize: '0.9rem', color: '#ef4444' }}>LOSE</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div style={{ minHeight: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                {isPending && (
                  <>
                    {isActivePlayerFlipping ? (
                      <button 
                        className="btn-primary roll-glow-animation"
                        style={{ padding: '12px 28px', borderRadius: '14px', fontWeight: 900, background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', color: '#1e1b4b', border: 'none', cursor: 'pointer', fontSize: '1rem', width: '100%' }}
                        onClick={() => onMonopolyAction('casino-flip')}
                      >
                        🪙 Flip the Coin!
                      </button>
                    ) : (
                      <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: '#94a3b8' }}>
                        Waiting for {activeFlippingPlayer?.name || 'player'} to flip the coin...
                      </div>
                    )}
                  </>
                )}

                {isFlipping && (
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', animation: 'pulse 1s infinite' }}>
                    🪙 Coin in the air...
                  </div>
                )}

                {isWon && (
                  <>
                    <div className="win-text-effect" style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                      🎉 WIN! Won +${casinoState.payout}! 🎉
                    </div>
                    {isActivePlayerFlipping ? (
                      <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        <button
                          className="btn-primary"
                          style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 'bold' }}
                          onClick={() => onMonopolyAction('casino-collect')}
                        >
                          💰 Collect ${casinoState.payout}
                        </button>
                        {casinoState.round < 3 && (
                          <button
                            className="btn-gold"
                            style={{ flex: 1, padding: '10px', borderRadius: '10px', fontWeight: 'bold', background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', color: 'white', border: 'none' }}
                            onClick={() => onMonopolyAction('casino-push')}
                          >
                            🎲 Push Luck! (Round {casinoState.round + 1})
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#94a3b8' }}>
                        Waiting for {activeFlippingPlayer?.name || 'player'} to make a decision...
                      </div>
                    )}
                  </>
                )}

                {isLost && (
                  <div className="lose-shake-effect" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    💀 LOSE! Lost -${casinoState.payout}! 💀
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== GO Landing Free Build Select Modal ==================== */}
      {!isAnimating && rules.ruleset === 'Get Rich' && monopolyPhase === 'go_build_select' && activePlayer?.id === playerId && (() => {
        const buildable = monopolyBoard.filter(t => t.type === 'property' && t.owner === playerId && (t.houses || 0) < 5 && !t.mortgaged);
        return (
          <div className="casino-modal-overlay">
            <div className="casino-card" style={{ border: '3px solid #10b981', boxShadow: '0 0 50px rgba(16, 185, 129, 0.35)' }}>
              <div className="casino-title" style={{ color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.6)' }}>🎯 GO LANDING BONUS 🎯</div>
              <div className="casino-subtitle" style={{ marginBottom: '16px' }}>
                You landed exactly on GO! You are granted one free build option (paying normal house price) on ANY owned property tile!
              </div>

              <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', width: '100%', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', boxSizing: 'border-box' }}>
                {buildable.map(prop => {
                  const currentHouses = prop.houses || 0;
                  const buildCost = prop.housePrice || 50;
                  const isAffordable = activePlayer.money >= buildCost;

                  return (
                    <div key={prop.index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flexGrow: 1, textAlign: 'left' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f8fafc' }}>{prop.name}</span>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          Houses: {currentHouses} | Cost: ${buildCost}
                        </span>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.7rem', borderRadius: '6px', cursor: isAffordable ? 'pointer' : 'not-allowed', background: isAffordable ? '#10b981' : '#475569', border: 'none', color: 'white', fontWeight: 'bold' }}
                        disabled={!isAffordable}
                        onClick={() => onMonopolyAction('go-build', prop.index)}
                      >
                        🧱 {currentHouses === 4 ? 'Build Hotel' : 'Build House'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                className="btn-secondary"
                style={{ width: '100%', padding: '10px', borderRadius: '10px', fontWeight: 'bold', background: '#475569', color: 'white', border: 'none', cursor: 'pointer' }}
                onClick={() => onMonopolyAction('go-build-skip')}
              >
                Skip Bonus
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
