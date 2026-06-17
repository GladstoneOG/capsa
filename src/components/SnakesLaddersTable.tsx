import React, { useEffect, useState, useRef } from 'react';
import { AvatarSVG } from './AvatarCreator';
import { SNAKES, LADDERS } from '../utils/snakesLaddersLogic';
import { sfx } from '../utils/audio';
import './SnakesLaddersTable.css';

interface TableProps {
  playerId: string;
  players: any[];
  turnIndex: number;
  dice: number[];
  rollId: string | null;
  phase: 'roll' | 'rolling_animation';
  lastAction: any;
  gameState: 'lobby' | 'playing' | 'gameover' | 'roundover';
  roomCode: string;
  isHost: boolean;
  isSinglePlayer: boolean;
  rules: any;
  onRollDice: () => void;
  onLeaveRoom: () => void;
  onRestartGame: () => void;
  onAnimationStateChange?: (animating: boolean) => void;
}

export const SnakesLaddersTable: React.FC<TableProps> = ({
  playerId,
  players,
  turnIndex,
  dice,
  phase,
  lastAction,
  gameState,
  roomCode,
  isHost,
  onRollDice,
  onLeaveRoom,
  onRestartGame,
  onAnimationStateChange
}) => {
  const [cellCenters, setCellCenters] = useState<Record<number, { x: number; y: number }>>({});
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const [isAnimating, setIsAnimating] = useState(false);
  const [diceDisplay, setDiceDisplay] = useState<number>(1);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const activeAnimationRef = useRef<string | null>(null);
  const isAnimatingRef = useRef(false);
  const onAnimationStateChangeRef = useRef(onAnimationStateChange);
  onAnimationStateChangeRef.current = onAnimationStateChange;

  // Computes the grid index for boustrophedon layout (1 at bottom-left, 100 at top-left)
  const getCellNumber = (row: number, col: number): number => {
    // row 0 is the bottom row, row 9 is the top row
    // col 0 is left, col 9 is right
    const isRowEven = row % 2 === 0;
    const base = row * 10;
    return isRowEven ? (base + col + 1) : (base + (9 - col) + 1);
  };

  // Recalculates exact cell center coordinates relative to the board parent container
  const updateCellCenters = () => {
    if (!boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const centers: Record<number, { x: number; y: number }> = {};

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const num = getCellNumber(row, col);
        const cellEl = boardRef.current.querySelector(`[data-cell-num="${num}"]`);
        if (cellEl) {
          const rect = cellEl.getBoundingClientRect();
          centers[num] = {
            x: (rect.left + rect.width / 2) - boardRect.left,
            y: (rect.top + rect.height / 2) - boardRect.top
          };
        }
      }
    }
    setCellCenters(centers);
  };

  // Setup layout listening
  useEffect(() => {
    const timer = setTimeout(updateCellCenters, 100);
    window.addEventListener('resize', updateCellCenters);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateCellCenters);
    };
  }, [players]);

  // Synchronize non-animating players — use the ref to avoid the race condition
  // where players and lastAction update in the same render cycle
  useEffect(() => {
    if (!isAnimatingRef.current) {
      const newPos: Record<string, number> = {};
      players.forEach(p => {
        newPos[p.id] = p.position || 1;
      });
      setVisualPositions(newPos);
    }
  }, [players]);

  // Handle dice roll cycle animation
  useEffect(() => {
    if (phase === 'rolling_animation') {
      const interval = setInterval(() => {
        setDiceDisplay(Math.floor(Math.random() * 6) + 1);
      }, 85);
      return () => clearInterval(interval);
    } else {
      if (dice && dice[0]) {
        setDiceDisplay(dice[0]);
      }
    }
  }, [phase, dice]);

  // Handle movements from action trigger
  const animateMove = async (action: any) => {
    if (!action || !action.rollId || activeAnimationRef.current === action.rollId) return;
    activeAnimationRef.current = action.rollId;

    // Set the ref immediately (same tick) to gate the sync effect
    isAnimatingRef.current = true;
    setIsAnimating(true);
    onAnimationStateChangeRef.current?.(true);
    const { playerId: animPlayerId, oldPos, finalPos, landedEffect } = action;

    // Sync start position
    setVisualPositions(prev => ({
      ...prev,
      [animPlayerId]: oldPos
    }));

    await new Promise(resolve => setTimeout(resolve, 300));

    // Calculate step-by-step path (considering bounce back)
    const path: number[] = [];
    let current = oldPos;
    let direction = 1;
    const totalSteps = action.roll;

    for (let i = 0; i < totalSteps; i++) {
      if (current === 100) {
        direction = -1;
      }
      current += direction;
      path.push(current);
    }

    // Move cell by cell
    for (const step of path) {
      setVisualPositions(prev => ({
        ...prev,
        [animPlayerId]: step
      }));
      sfx.playTick();
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    // Pause at intermediate position
    await new Promise(resolve => setTimeout(resolve, 400));

    if (landedEffect) {
      sfx.playReverse();
      setVisualPositions(prev => ({
        ...prev,
        [animPlayerId]: finalPos
      }));
      await new Promise(resolve => setTimeout(resolve, 850));
    }

    isAnimatingRef.current = false;
    setIsAnimating(false);
    onAnimationStateChangeRef.current?.(false);
  };

  useEffect(() => {
    if (lastAction) {
      animateMove(lastAction);
    }
  }, [lastAction]);

  const activePlayer = players[turnIndex];
  const myTurn = activePlayer && activePlayer.id === playerId;

  // Offset players standing on the same tile so they don't completely overlap
  const getPlayerOffset = (pId: string, currentPos: number) => {
    const playersAtPos = players.filter(p => (visualPositions[p.id] || p.position || 1) === currentPos);
    const idx = playersAtPos.findIndex(p => p.id === pId);
    if (idx === -1) return { x: 0, y: 0 };
    
    const count = playersAtPos.length;
    if (count <= 1) return { x: 0, y: 0 };
    if (count === 2) {
      return {
        x: idx === 0 ? -6 : 6,
        y: 0
      };
    }
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    return {
      x: col === 0 ? -6 : 6,
      y: row === 0 ? -6 : 6
    };
  };

  // Render a detailed wooden ladder path
  const renderLadder = (start: number, end: number) => {
    const p1 = cellCenters[start];
    const p2 = cellCenters[end];
    if (!p1 || !p2) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return null;

    const ux = dx / length;
    const uy = dy / length;
    const px = -uy;
    const py = ux;
    const width = 7; // Half spacing width

    const r1x1 = p1.x + px * width;
    const r1y1 = p1.y + py * width;
    const r1x2 = p2.x + px * width;
    const r1y2 = p2.y + py * width;

    const r2x1 = p1.x - px * width;
    const r2y1 = p1.y - py * width;
    const r2x2 = p2.x - px * width;
    const r2y2 = p2.y - py * width;

    const rungSpacing = 18;
    const numRungs = Math.floor(length / rungSpacing);
    const rungs = [];

    for (let i = 1; i < numRungs; i++) {
      const t = i / numRungs;
      const cx = p1.x + dx * t;
      const cy = p1.y + dy * t;
      rungs.push({
        x1: cx + px * width,
        y1: cy + py * width,
        x2: cx - px * width,
        y2: cy - py * width
      });
    }

    return (
      <g key={`ladder-${start}-${end}`} className="sl-ladder-path">
        {/* Rails */}
        <line x1={r1x1} y1={r1y1} x2={r1x2} y2={r1y2} stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        <line x1={r2x1} y1={r2y1} x2={r2x2} y2={r2y2} stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        {/* Rungs */}
        {rungs.map((r, idx) => (
          <line key={idx} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="#b45309" strokeWidth="2" />
        ))}
      </g>
    );
  };

  // Render a detailed slithering wavy snake path
  const renderSnake = (start: number, end: number) => {
    const p1 = cellCenters[start]; // Head (high)
    const p2 = cellCenters[end];   // Tail (low)
    if (!p1 || !p2) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    // Generate curvy waves
    const cx1 = p1.x + dx * 0.25 + Math.sin(dy / 10) * 35;
    const cy1 = p1.y + dy * 0.25;
    const cx2 = p1.x + dx * 0.75 - Math.sin(dy / 10) * 35;
    const cy2 = p1.y + dy * 0.75;

    const pathD = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;

    return (
      <g key={`snake-${start}-${end}`} className="sl-snake-path">
        {/* Shadow */}
        <path
          d={pathD}
          stroke="rgba(0, 0, 0, 0.35)"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          style={{ transform: 'translate(2px, 3px)' }}
        />
        {/* Main Body */}
        <path
          d={pathD}
          stroke="#10b981"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        {/* Scales Stripe */}
        <path
          d={pathD}
          stroke="#047857"
          strokeWidth="2.5"
          strokeDasharray="4,5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Poisonous Red Head */}
        <circle cx={p1.x} cy={p1.y} r="6.5" fill="#ef4444" stroke="#991b1b" strokeWidth="1.2" />
        <circle cx={p1.x - 1.8} cy={p1.y - 1.8} r="1.2" fill="white" />
        <circle cx={p1.x + 1.8} cy={p1.y - 1.8} r="1.2" fill="white" />
        {/* Rattle Tail */}
        <circle cx={p2.x} cy={p2.y} r="4" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
      </g>
    );
  };

  const renderDicePips = (value: number) => {
    const val = value >= 1 && value <= 6 ? value : 1;
    const pipPositions: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };

    const activePips = pipPositions[val];

    return (
      <div className="sl-dice-pip-grid">
        {Array.from({ length: 9 }).map((_, idx) => (
          <div
            key={idx}
            className={`sl-dice-pip ${activePips.includes(idx) ? 'active' : ''}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="sl-table-container">
      <div className="sl-header">
        <h2>🐍 Snakes & Ladders 🪜</h2>
        <div className="sl-room-info">Room: <strong>{roomCode || 'LOCAL'}</strong></div>
      </div>

      <div className="sl-layout">
        <div className="sl-board-wrapper" ref={boardRef}>
          {/* 10x10 Grid board */}
          <div className="sl-grid">
            {Array.from({ length: 10 }).map((_, rIdx) => {
              const row = 9 - rIdx; // Render row 9 (100-91) at the top, row 0 (1-10) at bottom
              return (
                <div key={row} className="sl-row">
                  {Array.from({ length: 10 }).map((_, col) => {
                    const cellNum = getCellNumber(row, col);
                    const playersOnCell = players.filter(p => p.position === cellNum);
                    
                    return (
                      <div
                        key={cellNum}
                        className={`sl-cell ${(row + col) % 2 === 0 ? 'even' : 'odd'}`}
                        data-cell-num={cellNum}
                      >
                        <span className="sl-cell-label">{cellNum}</span>
                        
                        {/* Fallback to inline tokens if centers not yet calculated */}
                        {Object.keys(cellCenters).length === 0 && (
                          <div className="sl-cell-tokens">
                            {playersOnCell.map((p, idx) => (
                              <div
                                key={p.id}
                                className={`sl-token ${p.id === playerId ? 'is-me' : ''}`}
                                style={{
                                  transform: `translate(${(idx % 2) * 6 - 3}px, ${(Math.floor(idx / 2)) * 6 - 3}px)`
                                }}
                                title={p.name}
                              >
                                <AvatarSVG config={p.avatar} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* SVG Overlay for drawing Snakes and Ladders */}
          <svg className="sl-svg-overlay">
            {/* Draw Ladders */}
            {Object.entries(LADDERS).map(([start, end]) => renderLadder(Number(start), Number(end)))}

            {/* Draw Snakes */}
            {Object.entries(SNAKES).map(([start, end]) => renderSnake(Number(start), Number(end)))}
          </svg>

          {/* Absolute positioned overlay layer for player tokens */}
          {Object.keys(cellCenters).length > 0 && (
            <div className="sl-tokens-overlay">
              {players.map((p, idx) => {
                const currentPos = visualPositions[p.id] || p.position || 1;
                const center = cellCenters[currentPos];
                if (!center) return null;

                const offset = getPlayerOffset(p.id, currentPos);
                const isMe = p.id === playerId;
                const isActive = p.id === activePlayer?.id;

                return (
                  <div
                    key={p.id}
                    className="sl-token-container-wrapper"
                    style={{
                      position: 'absolute',
                      left: `${center.x}px`,
                      top: `${center.y}px`,
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                      transition: 'left 0.4s ease-out, top 0.4s ease-out, transform 0.3s ease',
                      zIndex: 10 + idx,
                      pointerEvents: 'none'
                    }}
                  >
                    <div
                      className={`sl-anim-token ${isMe ? 'is-me' : ''} ${isActive ? 'is-active' : ''}`}
                      title={p.name}
                    >
                      <AvatarSVG config={p.avatar} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sl-control-panel">
          <div className="sl-turn-status">
            {gameState === 'gameover' ? (
              <div className="sl-win-banner">🏆 Round Over!</div>
            ) : (
              <h3>Turn: {activePlayer?.name} {myTurn ? '(You)' : ''}</h3>
            )}
          </div>

          <div className="sl-dice-area">
            <div className={`sl-die-face ${phase === 'rolling_animation' ? 'rolling' : ''}`}>
              {renderDicePips(diceDisplay)}
            </div>
            {gameState === 'playing' && (
              <button
                className="btn-gold roll-btn"
                disabled={!myTurn || phase === 'rolling_animation' || isAnimating}
                onClick={onRollDice}
              >
                🎲 Roll Die
              </button>
            )}
          </div>

          <div className="sl-scores">
            <h4>Players Position:</h4>
            {players.map(p => (
              <div key={p.id} className={`sl-player-row ${p.id === activePlayer?.id ? 'active' : ''}`}>
                <div className="sl-row-avatar">
                  <AvatarSVG config={p.avatar} />
                </div>
                <span>{p.name}: Tile <strong>{p.position || '1 (Start)'}</strong></span>
              </div>
            ))}
          </div>

          <div className="sl-actions">
            {(gameState === 'gameover' || gameState === 'roundover') && isHost && (
              <button className="btn-primary" onClick={onRestartGame}>Play Again</button>
            )}
            <button className="btn-utility" onClick={onLeaveRoom}>Exit Room</button>
          </div>
        </div>
      </div>
    </div>
  );
};
