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
  bankrupt: boolean;
  lastRoll: number[];
  rollCount: number;
  doublesRolled?: boolean;
  netWorth: number;
  score?: number;
  finishRank?: number;
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
}

interface MonopolyTableProps {
  playerId: string;
  players: Player[];
  turnIndex: number;
  monopolyBoard: TileState[];
  dice: number[];
  monopolyPhase: 'roll' | 'action' | 'jail_decision' | 'card_drawn' | 'bankrupt_decision' | 'end_turn';
  currentCard: any | null;
  cardType: string | null;
  activeDebt: any | null;
  gameState: 'lobby' | 'playing' | 'roundover' | 'gameover';
  roomCode?: string;
  isHost: boolean;
  isSinglePlayer: boolean;
  onMonopolyAction: (action: string, payload?: any) => void;
  onLeaveRoom: () => void;
  onRestartGame: () => void;
  onAnimationStateChange?: (isAnimating: boolean) => void;
  onToggleChat?: () => void;
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
// ranging from -310 to +310 based on non-uniform grid tracks (85px corners, 50px sides)
function getTileLocalCoords(index: number): { x: number; y: number } {
  const { row, col } = getTileGridCoords(index);
  
  const getCenterOfIndex = (idx: number) => {
    if (idx === 1) return 42.5;
    if (idx >= 2 && idx <= 10) return 110 + (idx - 2) * 50;
    return 577.5; // idx === 11
  };

  const tileX = getCenterOfIndex(col) - 310;
  const tileY = getCenterOfIndex(row) - 310;
  return { x: tileX, y: tileY };
}

const render2DDie = (value: number, isRolling: boolean) => {
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
    <div className={`die-2d ${isRolling ? 'rolling-2d' : 'settled-2d'}`}>
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
  gameState,
  roomCode,
  isHost,
  isSinglePlayer,
  onMonopolyAction,
  onLeaveRoom,
  onRestartGame,
  onAnimationStateChange,
  onToggleChat,
}) => {
  const [selectedDeedIndex, setSelectedDeedIndex] = useState<number | null>(null);
  const [isBuildManagerOpen, setIsBuildManagerOpen] = useState<boolean>(false);
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const [isDiceRolling, setIsDiceRolling] = useState<boolean>(false);
  const [showRollBanner, setShowRollBanner] = useState<boolean>(false);
  const [dicePhysics, setDicePhysics] = useState<{
    tx1: number; ty1: number; tz1: number;
    tx2: number; ty2: number; tz2: number;
    rotX1: number; rotY1: number; rotZ1: number;
    rotX2: number; rotY2: number; rotZ2: number;
  }>({
    tx1: 0, ty1: 0, tz1: 0,
    tx2: 0, ty2: 0, tz2: 0,
    rotX1: 0, rotY1: 0, rotZ1: 0,
    rotX2: 0, rotY2: 0, rotZ2: 0
  });
  const [localDice, setLocalDice] = useState<number[]>([1, 1]);
  const [showDiceModal, setShowDiceModal] = useState<boolean>(false);
  const [diceModalPhase, setDiceModalPhase] = useState<'rolling' | 'settled'>('rolling');
  const [animatedDice, setAnimatedDice] = useState<number[]>([1, 1]);
  const [movingPlayerSteps, setMovingPlayerSteps] = useState<Record<string, number>>({});
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<{ id: string; text: string; isNegative: boolean; playerId: string }[]>([]);
  const [moneyParticles, setMoneyParticles] = useState<{ id: string; x: number; y: number; color: string; tx: number; ty: number }[]>([]);
  // Camera coordinates and scale variables
  const [cameraX, setCameraX] = useState<number>(0);
  const [cameraY, setCameraY] = useState<number>(0);
  const [cameraScale, setCameraScale] = useState<number>(0.98);
  const [cameraTransition, setCameraTransition] = useState<string>('1.2s');
  const [cameraShake, setCameraShake] = useState<boolean>(false);
  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(false);

  // Customizable default camera position state (draggable & zoomable)
  const [defaultCameraX, setDefaultCameraX] = useState<number>(0);
  const [defaultCameraY, setDefaultCameraY] = useState<number>(0);
  const [defaultCameraScale, setDefaultCameraScale] = useState<number>(0.98);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialCameraRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const prevPlayersRef = useRef<Player[]>([]);
  const prevDiceRef = useRef<number[]>([1, 1]);
  const hopTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const prevBoardRef = useRef<TileState[]>([]);
  const prevBoardForMoneyRef = useRef<TileState[]>([]);
  const lastAutoOpenRef = useRef<string | null>(null);

  const activePlayer = players[turnIndex] || null;

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
      const senders: { player: Player; amount: number }[] = [];
      const receivers: { player: Player; amount: number }[] = [];

      players.forEach(p => {
        const prevP = prevPlayers.find(prev => prev.id === p.id);
        if (prevP && prevP.money !== p.money) {
          const diff = p.money - prevP.money;
          const text = diff > 0 ? `+$${diff}` : `-$${Math.abs(diff)}`;
          const isNegative = diff < 0;

          // Add floating text
          const id = `float_${Date.now()}_${Math.random()}`;
          setFloatingTexts(prev => [...prev, { id, text, isNegative, playerId: p.id }]);
          setTimeout(() => {
            setFloatingTexts(prev => prev.filter(t => t.id !== id));
          }, 1500);

          // JAIL! Text effect
          if (prevP && !prevP.inJail && p.inJail) {
            const jailId = `float_${Date.now()}_jail_${p.id}`;
            setFloatingTexts(prev => [...prev, { id: jailId, text: 'JAIL! 🚔', isNegative: true, playerId: p.id }]);
            setTimeout(() => {
              setFloatingTexts(prev => prev.filter(t => t.id !== jailId));
            }, 2500);
          }

          const playerIdx = players.indexOf(p);
          const w = window.innerWidth;
          const h = window.innerHeight;
          let startX = 100;
          let startY = 100;
          if (playerIdx === 0) { startX = w - 200; startY = 100; } // Top-Right corner UI
          else if (playerIdx === 1) { startX = w - 200; startY = h - 150; } // Bottom-Right corner UI
          else if (playerIdx === 2) { startX = 100; startY = h - 150; } // Bottom-Left corner UI
          else if (playerIdx === 3) { startX = 100; startY = 100; } // Top-Left corner UI

          // Categorize as sender or receiver for flying particles effect
          if (diff < 0) {
            senders.push({ player: p, amount: -diff, startX, startY } as any);
          } else {
            receivers.push({ player: p, amount: diff, startX, startY } as any);
          }

          // Play money chime
          sfx.playMoney();
        }
      });

      // Generate 2D flying money particles from senders to receivers
      const newParticles: any[] = [];

      if (senders.length > 0 && receivers.length > 0) {
        senders.forEach((s: any) => {
          receivers.forEach((r: any) => {
            const count = Math.min(10, Math.max(3, Math.floor(s.amount / 50)));
            for (let i = 0; i < count; i++) {
              newParticles.push({
                id: `part_${Date.now()}_${Math.random()}_${i}`,
                x: s.startX + Math.random() * 80 - 40,
                y: s.startY + Math.random() * 40 - 20,
                color: '#10b981',
                tx: r.startX - s.startX,
                ty: r.startY - s.startY,
              });
            }
          });
        });
      } else if (senders.length > 0 && receivers.length === 0) {
        // Paying bank
        senders.forEach((s: any) => {
          const count = Math.min(10, Math.max(3, Math.floor(s.amount / 50)));
          for (let i = 0; i < count; i++) {
            newParticles.push({
              id: `part_${Date.now()}_${Math.random()}_${i}`,
              x: s.startX + Math.random() * 80 - 40,
              y: s.startY + Math.random() * 40 - 20,
              color: '#ef4444',
              tx: (window.innerWidth / 2) - s.startX,
              ty: (window.innerHeight / 2) - s.startY,
            });
          }
        });
      } else if (receivers.length > 0 && senders.length === 0) {
        // Receiving from bank
        receivers.forEach((r: any) => {
          const count = Math.min(10, Math.max(3, Math.floor(r.amount / 50)));
          for (let i = 0; i < count; i++) {
            newParticles.push({
              id: `part_${Date.now()}_${Math.random()}_${i}`,
              x: window.innerWidth / 2 + Math.random() * 80 - 40,
              y: window.innerHeight / 2 + Math.random() * 40 - 20,
              color: '#10b981',
              tx: r.startX - window.innerWidth / 2,
              ty: r.startY - window.innerHeight / 2,
            });
          }
        });
      }

      if (newParticles.length > 0) {
        setMoneyParticles(prev => [...prev, ...newParticles]);
        setTimeout(() => {
          const pIds = newParticles.map(part => part.id);
          setMoneyParticles(prev => prev.filter(part => !pIds.includes(part.id)));
        }, 1200);
      }
    }

    prevPlayersRef.current = players;
    prevBoardForMoneyRef.current = monopolyBoard;
  }, [players, gameState, monopolyBoard, visualPositions]);

  // Dice roll animation trigger (2D popup)
  useEffect(() => {
    const isNewRoll = dice[0] !== prevDiceRef.current[0] || dice[1] !== prevDiceRef.current[1];
    if (isNewRoll && gameState === 'playing') {
      setIsDiceRolling(true);
      setShowDiceModal(true);
      setDiceModalPhase('rolling');
      setShowRollBanner(false);
      sfx.playDiceRoll();

      // Rapidly shuffle dice faces
      if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = setInterval(() => {
        setAnimatedDice([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
      }, 60);

      // Settle roll after 1000ms
      const settleTimer = setTimeout(() => {
        if (rollIntervalRef.current) {
          clearInterval(rollIntervalRef.current);
          rollIntervalRef.current = null;
        }
        setAnimatedDice(dice);
        setDiceModalPhase('settled');
        setLocalDice(dice);
        sfx.playDiceLand();
        prevDiceRef.current = dice;
      }, 1000);

      // Close modal and start player movement after another 1200ms
      const closeTimer = setTimeout(() => {
        setShowDiceModal(false);
        setIsDiceRolling(false); // Triggers visualPositions movement
        setShowRollBanner(true);
      }, 2200);

      return () => {
        clearTimeout(settleTimer);
        clearTimeout(closeTimer);
        if (rollIntervalRef.current) clearInterval(rollIntervalRef.current);
      };
    }
  }, [dice, gameState]);

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
  const stepPlayerPos = useCallback((pId: string, current: number, target: number) => {
    const playerObj = players.find(p => p.id === pId);
    const isJailTeleport = target === 10 && playerObj?.inJail;

    if (isJailTeleport) {
      // Teleport instantly to Jail
      setVisualPositions(prev => ({ ...prev, [pId]: 10 }));
      
      // Smoothly pan camera onto Jail tile
      if (!isDraggingRef.current) {
        const localCoords = getTileLocalCoords(10);
        setCameraTransition('1.2s');
        setCameraX(-localCoords.x * 1.20);
        setCameraY(-localCoords.y * 1.20);
        setCameraScale(1.45);
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
      return;
    }

    if (current === target) {
      // Landed! Zoom camera onto landing space
      const localCoords = getTileLocalCoords(target);
      if (!isDraggingRef.current) {
        setCameraX(-localCoords.x * 1.20);
        setCameraY(-localCoords.y * 1.20);
      }

      // Trigger custom land sound (jail warning or standard card sound) and impact effects
      const tile = monopolyBoard[target];
      
      // Determine if this is a fined/tax tile or sending to jail
      const isRentTile = tile && tile.owner && tile.owner !== pId && !tile.mortgaged;
      const isTaxTile = tile && tile.type === 'tax';
      const isGoToJail = tile && tile.type === 'gotojail';

      if (isRentTile || isTaxTile || isGoToJail) {
        // Dramatic close zoom
        if (!isDraggingRef.current) {
          setCameraScale(1.45);
          setCameraTransition('0.3s');
          // Camera shake impact
          setCameraShake(true);
          setTimeout(() => setCameraShake(false), 400);
        }

        if (tile.type === 'gotojail') {
          sfx.playJail();
        } else {
          sfx.playCard();
        }
      } else {
        // Standard landing zoom
        if (!isDraggingRef.current) {
          setCameraScale(1.22);
          setCameraTransition('0.4s');
        }
        sfx.playCard();
      }

      setMovingPlayerSteps(prev => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
      delete hopTimersRef.current[pId];
      return;
    }

    // Update remaining moves countdown
    const stepsLeft = (target - current + 40) % 40;
    setMovingPlayerSteps(prev => ({ ...prev, [pId]: stepsLeft }));

    const next = (current + 1) % 40;
    setVisualPositions(prev => ({ ...prev, [pId]: next }));
    
    // Play hop tick
    sfx.playTick();

    hopTimersRef.current[pId] = setTimeout(() => {
      stepPlayerPos(pId, next, target);
    }, 280);
  }, [monopolyBoard, players]);

  // Watch players list to animate positions
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (isDiceRolling) return; // Wait until dice roll is complete before starting token movement

    players.forEach(p => {
      const prevPos = visualPositions[p.id];
      if (prevPos === undefined) {
        // Initialize position
        setVisualPositions(prev => ({ ...prev, [p.id]: p.position }));
      } else if (prevPos !== p.position && !hopTimersRef.current[p.id]) {
        // Position changed on server: start hop sequence!
        
        if (!isDraggingRef.current && p.id === activePlayer?.id) {
          const targetCoords = getTileLocalCoords(p.position);
          const stepsCount = (p.position - prevPos + 40) % 40;
          const duration = Math.max(0.4, stepsCount * 0.28);
          setCameraTransition(`${duration}s linear`);
          setCameraX(-targetCoords.x * 1.20);
          setCameraY(-targetCoords.y * 1.20);
          setCameraScale(1.28);
        }
        
        stepPlayerPos(p.id, prevPos, p.position);
      }
    });
  }, [players, gameState, visualPositions, stepPlayerPos, isDiceRolling, activePlayer?.id]);

  const isOverview = !isCameraLocked && Object.keys(hopTimersRef.current).length === 0 &&
    (monopolyPhase === 'roll' || isDiceRolling || (monopolyPhase === 'action' && !activePlayer));

  // Dynamic Camera Zoom-in Control based on gameplay phase
  useEffect(() => {
    if (isCameraLocked) return; // Keep focus on property upgrade construction
    if (isDragging) return; // Don't let phase changes override active dragging

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

        // Check if landed on fined/tax property to maintain zoom
        const tile = monopolyBoard[activeTilePos];
        const isFined = tile && ((tile.owner && tile.owner !== activePlayer.id && !tile.mortgaged) || tile.type === 'tax');
        setCameraScale(isFined ? 1.45 : 1.22);
      }
    } else {
      // Overview
      setCameraTransition('1.2s');
      setCameraX(defaultCameraX);
      setCameraY(defaultCameraY);
      setCameraScale(defaultCameraScale);
    }
  }, [monopolyPhase, activePlayer, isDiceRolling, visualPositions, monopolyBoard, isCameraLocked, isOverview, defaultCameraX, defaultCameraY, defaultCameraScale, isDragging]);

  // Property building / upgrade camera focus tracking
  useEffect(() => {
    if (gameState !== 'playing' || monopolyBoard.length === 0) return;

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

            const tile = monopolyBoard[activeTilePos];
            const isFined = tile && ((tile.owner && tile.owner !== activePlayer.id && !tile.mortgaged) || tile.type === 'tax');
            setCameraScale(isFined ? 1.45 : 1.22);
          } else {
            setCameraX(defaultCameraX);
            setCameraY(defaultCameraY);
            setCameraScale(defaultCameraScale);
          }
        }, 1600);
      }
    }
    prevBoardRef.current = monopolyBoard;
  }, [monopolyBoard, gameState, activePlayer, visualPositions, defaultCameraX, defaultCameraY, defaultCameraScale]);

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
      target.closest('.deed-card-modal-backdrop')
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
    if (isOverview && !isDragging) {
      setCameraScale(defaultCameraScale);
    }
  }, [defaultCameraScale, isOverview, isDragging]);

  // Animation state calculation & synchronization
  const isAnimating = isDiceRolling || Object.keys(hopTimersRef.current).length > 0 || isCameraLocked;

  useEffect(() => {
    if (onAnimationStateChange) {
      onAnimationStateChange(isAnimating);
    }
  }, [isAnimating, onAnimationStateChange]);

  // Auto-open Build/Mortgage panel when landing on owned properties
  useEffect(() => {
    if (gameState === 'playing' && monopolyPhase === 'end_turn' && activePlayer?.id === playerId && !isAnimating) {
      const activeTilePos = visualPositions[activePlayer.id];
      if (activeTilePos === activePlayer.position) {
        const turnKey = `${activePlayer.id}-${activePlayer.rollCount}-${activeTilePos}`;
        if (lastAutoOpenRef.current !== turnKey) {
          const tile = monopolyBoard[activeTilePos];
          if (tile && tile.owner === playerId && tile.type === 'property' && !tile.mortgaged) {
            setIsBuildManagerOpen(true);
            lastAutoOpenRef.current = turnKey;
          }
        }
      }
    }
  }, [monopolyPhase, activePlayer, playerId, gameState, monopolyBoard, visualPositions, isAnimating]);

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
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>🚗</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#0f172a' }}>FREE</span>
          <span style={{ fontSize: '0.45rem', color: '#64748b', fontWeight: 'bold' }}>PARKING</span>
        </div>
      );
    }
    if (tile.type === 'gotojail') {
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
          <span style={{ fontSize: '1.75rem', color: '#ef4444', fontWeight: 950 }}>❓</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ef4444' }}>CHANCE</span>
        </div>
      );
    }
    if (tile.type === 'chest') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span style={{ fontSize: '1.5rem' }}>🧰</span>
          <span style={{ fontSize: '0.45rem', fontWeight: 800, color: '#3b82f6', textAlign: 'center', lineHeight: 1.1 }}>COMMUNITY CHEST</span>
        </div>
      );
    }
    if (tile.type === 'railroad') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>🚂</span>
          <span style={{ fontSize: '0.5rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>{tile.name}</span>
        </div>
      );
    }
    if (tile.type === 'utility') {
      const isElectric = tile.name.includes('Electric');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>{isElectric ? '⚡' : '🚰'}</span>
          <span style={{ fontSize: '0.5rem', fontWeight: 800, textAlign: 'center', lineHeight: 1.1 }}>{tile.name}</span>
        </div>
      );
    }
    if (tile.type === 'tax') {
      const isIncome = tile.name.includes('Income');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.25rem' }}>{isIncome ? '💸' : '💎'}</span>
          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ef4444' }}>{tile.name}</span>
          <span style={{ fontSize: '0.5rem', color: '#ef4444', fontWeight: 'bold' }}>Pay ${tile.price}</span>
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

  const activeLandedTile = activePlayer ? monopolyBoard[visualPositions[activePlayer.id] ?? activePlayer.position] : null;

  return (
    <div 
      ref={containerRef}
      className="monopoly-table-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
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
            
            const cash = p.money || 0;
            const fullStacksCount = Math.floor(cash / 1000);
            const remainderBills = Math.floor((cash % 1000) / 100);
            const billStacks: number[] = [];
            for (let s = 0; s < fullStacksCount; s++) {
              billStacks.push(10);
            }
            if (remainderBills > 0 || (cash > 0 && billStacks.length === 0)) {
              billStacks.push(Math.max(1, remainderBills));
            }

            const playerColor = getPlayerColor(p.id);
            const rank = playersWithRanks[p.id] || 4;
            const labelRotZ = idx === 1 ? -135 : idx === 3 ? 45 : -45;

            return (
              <div 
                key={`table_stack_${p.id}`} 
                className="table-money-stack-container" 
                style={{ ...stackStyle, ['--owner-color' as any]: playerColor }}
              >
                <div style={{ display: 'flex', gap: '16px', transformStyle: 'preserve-3d' }}>
                  {billStacks.map((billsInThisStack, sIdx) => (
                    <div 
                      key={sIdx} 
                      className="table-money-stack" 
                      style={{ transformStyle: 'preserve-3d', position: 'relative' }}
                    >
                      {/* 3D Bill stack */}
                      {Array.from({ length: billsInThisStack }).map((_, bIdx) => (
                        <div 
                          key={bIdx} 
                          className="table-bill" 
                          style={{
                            transform: `translate3d(0, 0, ${bIdx * 2.5}px) rotateZ(${bIdx % 2 === 0 ? 3 : -3}deg)`
                          }}
                        >
                          <span className="table-bill-text">$100</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Table Stack Label standing upright */}
                <div 
                  className="table-stack-label" 
                  style={{ 
                    transform: `translate3d(0, 0, 40px) rotateZ(${labelRotZ}deg) rotateX(-42deg)`
                  }}
                >
                  <span className="table-rank-badge" style={{
                    background: rank === 1 ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' :
                                rank === 2 ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' :
                                rank === 3 ? 'linear-gradient(135deg, #b45309 0%, #78350f 100%)' : '#475569'
                  }}>
                    {rank === 1 ? '👑 1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'}
                  </span>
                  <span className="table-player-name">{p.name.substring(0, 5)}: ${p.money}</span>
                </div>
              </div>
            );
          })}

          <div className="monopoly-board-grid">
            
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
              const ownerName = tile.owner ? (players.find(p => p.id === tile.owner)?.name || 'Unknown') : null;
              const ownerColor = tile.owner ? getPlayerColor(tile.owner) : '#cbd5e1';
              
              // Monopoly Outline Glowing check
              const monopolyOwner = isProp && tile.color ? monopolyColorGroups[tile.color] : null;
              const hasMonopoly = !!monopolyOwner;
              const glowColor = getPlayerColor(monopolyOwner);

              return (
                <div 
                  key={tile.index} 
                  className={`monopoly-tile ${isCorner ? 'corner-tile' : 'side-tile'} ${isProp ? 'property-tile' : ''} ${sideClass} ${isHorizontal ? 'horizontal-tile' : 'vertical-tile'} ${idx === 10 ? 'jail-space' : ''} ${activeLandedTile?.index === idx ? 'highlighted' : ''} ${hasMonopoly ? 'monopoly-glow' : ''}`}
                  style={{
                    gridRow: row,
                    gridColumn: col,
                    ['--monopoly-glow-color' as any]: glowColor,
                    border: tile.owner ? `3.5px solid ${ownerColor}` : undefined
                  }}
                  onClick={() => {
                    if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
                      setSelectedDeedIndex(idx);
                    }
                  }}
                >
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

                  {/* Tile name and details */}
                  {isProp ? (
                    <>
                      <span className="tile-name">
                        {tile.name}
                      </span>
                      {/* Price */}
                      {!tile.owner && tile.price && (
                        <span className="tile-price">${tile.price}</span>
                      )}
                    </>
                  ) : (
                    getSpecialTileContent(tile)
                  )}

                  {/* Renders house and hotel models on property */}
                  {tile.houses > 0 && !tile.mortgaged && (
                    <div className="tile-buildings-container">
                      {tile.houses === 5 ? (
                        <div className="cube-3d hotel" style={{ ['--building-color' as any]: ownerColor }}>
                          <div className="cube-face front" />
                          <div className="cube-face back" />
                          <div className="cube-face left" />
                          <div className="cube-face right" />
                          <div className="cube-face top" />
                        </div>
                      ) : (
                        Array.from({ length: tile.houses }).map((_, hIdx) => (
                          <div key={hIdx} className="cube-3d house" style={{ ['--building-color' as any]: ownerColor }}>
                            <div className="cube-face front" />
                            <div className="cube-face back" />
                            <div className="cube-face left" />
                            <div className="cube-face right" />
                            <div className="cube-face top" />
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
                    
                    if (sideClass === 'bottom-row' || (sideClass === 'right-col' && tile.index === 10)) {
                      pointerStyle = { bottom: '-15px', left: `calc(50% + ${offset}px)`, transform: 'rotate(180deg)' };
                    } else if (sideClass === 'top-row' || (sideClass === 'left-col' && tile.index === 30)) {
                      pointerStyle = { top: '-15px', left: `calc(50% + ${offset}px)` };
                    } else if (sideClass === 'left-col' || (sideClass === 'bottom-row' && tile.index === 20)) {
                      pointerStyle = { left: '-15px', top: `calc(50% + ${offset}px)`, transform: 'rotate(-90deg)' };
                    } else {
                      pointerStyle = { right: '-15px', top: `calc(50% + ${offset}px)`, transform: 'rotate(90deg)' };
                    }

                    // Adjust for exact corner pieces
                    if (tile.index === 0) pointerStyle = { bottom: '-15px', left: `calc(50% + ${offset}px)`, transform: 'rotate(180deg)' };
                    if (tile.index === 10) pointerStyle = { left: '-15px', top: `calc(50% + ${offset}px)`, transform: 'rotate(-90deg)' };
                    if (tile.index === 20) pointerStyle = { top: '-15px', left: `calc(50% + ${offset}px)` };
                    if (tile.index === 30) pointerStyle = { right: '-15px', top: `calc(50% + ${offset}px)`, transform: 'rotate(90deg)' };

                    return (
                      <div 
                        key={`pointer_${p.id}`}
                        style={{
                          position: 'absolute',
                          ...pointerStyle,
                          width: '0', 
                          height: '0', 
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderTop: `8px solid ${color}`,
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                          zIndex: 20
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Central Board elements */}
            <div className="monopoly-board-center">
              <div className="monopoly-logo">MONOPOLY</div>
              
              <div className="monopoly-deck-slot chance">CHANCE</div>
              <div className="monopoly-deck-slot chest">COMMUNITY CHEST</div>

              {/* Rolling Dice removed from board center (handled by 2D Pop-up modal) */}
            </div>

            {/* Standing Upright Player Tokens */}
            {players.map((p, idx) => {
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

              const isCurrentTurn = turnIndex === idx;
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
                    {isCurrentTurn && <div className="token-ring-highlight" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '60px',
                        height: '60px',
                        marginTop: '-30px',
                        marginLeft: '-30px',
                        borderRadius: '50%',
                        border: '4px solid #10b981',
                        boxShadow: '0 0 15px #10b981, inset 0 0 10px rgba(16, 185, 129, 0.5)',
                        transform: 'rotateX(90deg) translateZ(-5px)'
                    }} />}
                    
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

      {/* Money Particles layer */}
      {moneyParticles.map(p => (
        <div 
          key={p.id}
          className="money-particle"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            color: p.color,
            ['--tx' as any]: `${p.tx}px`,
            ['--ty' as any]: `${p.ty}px`
          }}
        >
          <div className="table-bill" style={{ transform: 'scale(0.6)', margin: 0 }}>
            <span className="table-bill-text">$100</span>
          </div>
        </div>
      ))}

      {/* Floating Roll Total Banner */}
      {showRollBanner && dice && dice[0] + dice[1] > 0 && (
        <div className={`monopoly-roll-banner ${showRollBanner ? 'show' : ''}`}>
          <div className="roll-banner-total">🎲 {dice[0] + dice[1]}</div>
          {dice[0] === dice[1] && (
            <div className="roll-banner-doubles">🔥 Doubles! Go again!</div>
          )}
        </div>
      )}

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

      {/* Corner Player Cards */}
      <div className="monopoly-corner-cards" style={{ pointerEvents: 'none' }}>
        {players.map((p, idx) => {
          let cornerClass = '';
          if (idx === 3) cornerClass = 'top-left';
          else if (idx === 0) cornerClass = 'top-right';
          else if (idx === 1) cornerClass = 'bottom-right';
          else if (idx === 2) cornerClass = 'bottom-left';
          
          const isActive = turnIndex === idx;
          const billsCount = Math.min(10, Math.max(1, Math.floor((p.money || 0) / 150)));

          const rank = playersWithRanks[p.id] || 4;
          const playerColor = getPlayerColor(p.id);

          return (
            <div 
              key={p.id} 
              className={`corner-card ${cornerClass} ${isActive ? 'active-turn' : ''} ${p.bankrupt ? 'bankrupt-player' : ''}`}
              style={{ borderLeft: `6px solid ${playerColor}` }}
            >
              <div className={`corner-rank-badge rank-${rank}`}>
                {rank === 1 ? '🥇 1st' : rank === 2 ? '🥈 2nd' : rank === 3 ? '🥉 3rd' : '4th'}
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
                <div className="corner-card-name">
                  {p.name} {p.id === playerId ? '(You)' : ''}
                </div>
                <div className="corner-card-money" style={{ position: 'relative' }}>
                  ${p.money}
                  {floatingTexts.filter(t => t.playerId === p.id).map(t => (
                    <div 
                      key={t.id} 
                      className={`corner-floating-text ${t.isNegative ? 'negative' : 'positive'}`}
                    >
                      {t.text}
                    </div>
                  ))}
                </div>
                <div className="corner-card-worth">Worth: ${p.netWorth}</div>
                <div className="corner-card-badges">
                  {p.inJail && <span className="jail-badge">🚨 JAIL</span>}
                  {p.getOutOfJailCards > 0 && <span className="card-badge">🔓 x{p.getOutOfJailCards}</span>}
                </div>
              </div>
              
              {!p.bankrupt && (
                <div className="money-stack">
                  {Array.from({ length: billsCount }).map((_, bIdx) => (
                    <div 
                      key={bIdx} 
                      className="bill-layer" 
                      style={{
                        transform: `translate3d(0, -${bIdx * 2}px, ${bIdx}px) rotateX(10deg) rotateY(${bIdx % 2 === 0 ? 3 : -3}deg)`
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unified bottom HUD Bar for turn control and property management */}
      {gameState === 'playing' && (
        <div className="monopoly-unified-hud-bottom">
          {/* Left Column: Turn Actions / Active Player Info */}
          <div className="unified-hud-left">
            {players[turnIndex]?.id === playerId ? (
              <>
                <span className="unified-hud-turn-title">👉 Your Turn!</span>
                
                {monopolyPhase === 'roll' && !isDiceRolling && !isAnimating && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {activePlayer?.inJail ? (
                      <>
                        <button className="btn-roll-red btn-roll-pulse-red" onClick={() => onMonopolyAction('roll-jail-doubles')} style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Roll for Doubles</button>
                        {activePlayer.money >= 50 && (
                          <button className="btn-primary" onClick={() => onMonopolyAction('pay-jail-fine')} style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Pay $50 Fine</button>
                        )}
                        {activePlayer.getOutOfJailCards > 0 && (
                          <button className="btn-primary" onClick={() => onMonopolyAction('use-jail-card')} style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Use Free Release Card</button>
                        )}
                      </>
                    ) : (
                      <button className="btn-roll-red btn-roll-pulse-red" onClick={() => onMonopolyAction('roll-dice')} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>🎲 Roll Dice</button>
                    )}
                  </div>
                )}

                {monopolyPhase === 'end_turn' && !isAnimating && (
                  <button className="btn-primary" onClick={() => onMonopolyAction('end-turn')} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>➡️ End Turn</button>
                )}

                {isAnimating && (
                  <div className="unified-hud-waiting">
                    <div className="waiting-pulse-dot" style={{ backgroundColor: '#fbbf24' }} />
                    <span style={{ fontSize: '0.8rem' }}>Animating...</span>
                  </div>
                )}
              </>
            ) : (
              <div className="unified-hud-waiting">
                <div className="waiting-pulse-dot" />
                <span className="unified-hud-turn-title" style={{ fontSize: '0.85rem' }}>
                  Waiting for {players[turnIndex]?.name || 'Next Player'}...
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Quick Real Estate Portfolio List & Manager Button */}
          <div className="unified-hud-portfolio">
            <span className="unified-hud-portfolio-title">Land:</span>
            <div className="unified-hud-portfolio-list">
              {myProperties.length === 0 ? (
                <span className="unified-hud-empty">None owned</span>
              ) : (
                myProperties.map(tile => (
                  <div 
                    key={tile.index} 
                    className="unified-hud-property-pill"
                    onClick={() => setSelectedDeedIndex(tile.index)}
                    title={`Click to view ${tile.name}`}
                  >
                    {tile.color && (
                      <div className={`unified-hud-pill-color tile-group-${tile.color}`} />
                    )}
                    <span className="unified-hud-pill-name">{tile.name.split(' ')[0]}</span>
                    {tile.mortgaged ? (
                      <span className="unified-hud-pill-houses" style={{ color: '#ef4444' }}>M</span>
                    ) : tile.houses === 5 ? (
                      <span className="unified-hud-pill-houses">⭐</span>
                    ) : tile.houses > 0 ? (
                      <span className="unified-hud-pill-houses">{tile.houses}H</span>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <button 
              className="unified-hud-manage-btn"
              onClick={() => {
                setIsBuildManagerOpen(true);
                sfx.playDraw();
              }}
            >
              🛠️ Portfolio & Build
            </button>
          </div>
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
          <div className="card-header-icon">{cardType === 'chest' ? '📦' : '❓'}</div>
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

      {/* Deed Card View modal */}
      {selectedDeedIndex !== null && (
        <div className="deed-card-modal-backdrop" onClick={() => setSelectedDeedIndex(null)}>
          <div className="deed-card" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const tile = monopolyBoard[selectedDeedIndex];
              const isProp = tile.type === 'property';
              const isRail = tile.type === 'railroad';
              const isUtil = tile.type === 'utility';

              return (
                <>
                  {isProp && (
                    <div className="deed-header">
                      <div className={`deed-header-color tile-group-${tile.color}`} />
                      <span className="deed-title">{tile.name}</span>
                    </div>
                  )}
                  {isRail && (
                    <div className="deed-header" style={{ background: '#cbd5e1' }}>
                      <span style={{ fontSize: '1.75rem' }}>🚂</span>
                      <div className="deed-title">{tile.name}</div>
                    </div>
                  )}
                  {isUtil && (
                    <div className="deed-header" style={{ background: '#cbd5e1' }}>
                      <span style={{ fontSize: '1.75rem' }}>💡</span>
                      <div className="deed-title">{tile.name}</div>
                    </div>
                  )}

                  <div className="deed-rents">
                    {isProp && tile.rent && (
                      <>
                        <div><span>Rent:</span> <strong>${tile.rent[0]}</strong></div>
                        <div><span>With Monopoly:</span> <strong>${tile.rent[0] * 2}</strong></div>
                        <div><span>With 1 House:</span> <strong>${tile.rent[1]}</strong></div>
                        <div><span>With 2 Houses:</span> <strong>${tile.rent[2]}</strong></div>
                        <div><span>With 3 Houses:</span> <strong>${tile.rent[3]}</strong></div>
                        <div><span>With 4 Houses:</span> <strong>${tile.rent[4]}</strong></div>
                        <div><span>With Hotel:</span> <strong>${tile.rent[5]}</strong></div>
                        <div style={{ marginTop: '10px' }}><span>House Cost:</span> <strong>${tile.housePrice}</strong></div>
                        <div><span>Mortgage Value:</span> <strong>${tile.mortgageValue}</strong></div>
                      </>
                    )}
                    {isRail && tile.rent && (
                      <>
                        <div><span>Rent (1 owned):</span> <strong>$25</strong></div>
                        <div><span>Rent (2 owned):</span> <strong>$50</strong></div>
                        <div><span>Rent (3 owned):</span> <strong>$100</strong></div>
                        <div><span>Rent (4 owned):</span> <strong>$200</strong></div>
                        <div style={{ marginTop: '10px' }}><span>Mortgage Value:</span> <strong>${tile.mortgageValue}</strong></div>
                      </>
                    )}
                    {isUtil && (
                      <>
                        <div style={{ fontSize: '0.65rem', marginBottom: '8px' }}>
                          If 1 Utility is owned, rent is 4 times amount shown on dice.
                        </div>
                        <div style={{ fontSize: '0.65rem', marginBottom: '8px' }}>
                          If 2 Utilities are owned, rent is 10 times amount shown on dice.
                        </div>
                        <div style={{ marginTop: '10px' }}><span>Mortgage Value:</span> <strong>${tile.mortgageValue}</strong></div>
                      </>
                    )}

                    {tile.owner && (
                      <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#64748b' }}>
                        Owner: {players.find(p => p.id === tile.owner)?.name || 'Unknown'} {tile.mortgaged ? '(Mortgaged)' : ''}
                      </div>
                    )}
                  </div>

                  <button 
                    className="btn-primary" 
                    style={{ width: '100%', padding: '6px', fontSize: '0.75rem', marginTop: '12px' }}
                    onClick={() => setSelectedDeedIndex(null)}
                  >
                    Close
                  </button>
                </>
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
                                    disabled={tile.houses >= 5 || activePlayer?.id !== playerId || activePlayer?.money < (tile.housePrice || 0)}
                                    onClick={() => {
                                      onMonopolyAction('build-house', tile.index);
                                      sfx.playUpgrade();
                                    }}
                                    title="Build House"
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
              {render2DDie(animatedDice[0], diceModalPhase === 'rolling')}
              {render2DDie(animatedDice[1], diceModalPhase === 'rolling')}
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
    </div>
  );
};
