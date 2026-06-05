import React, { useEffect, useState, useRef } from 'react';
import { AvatarSVG } from './AvatarCreator';
import { SNAKES, LADDERS } from '../utils/snakesLaddersLogic';
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
}

export const SnakesLaddersTable: React.FC<TableProps> = ({
  playerId,
  players,
  turnIndex,
  dice,
  rollId: _rollId,
  phase,
  lastAction: _lastAction,
  gameState,
  roomCode,
  isHost,
  isSinglePlayer: _isSinglePlayer,
  rules: _rules,
  onRollDice,
  onLeaveRoom,
  onRestartGame
}) => {
  const [cellCenters, setCellCenters] = useState<Record<number, { x: number; y: number }>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  // Computes the grid index for boustrophedon layout (1 at bottom-left, 100 at top-left)
  const getCellNumber = (row: number, col: number): number => {
    // row 0 is the bottom row, row 9 is the top row
    // col 0 is left, col 9 is right
    const isRowEven = row % 2 === 0;
    const base = row * 10;
    return isRowEven ? (base + col + 1) : (base + (9 - col) + 1);
  };

  // Recalculates exact cell center coordinates relative to the board parent container
  // so we can draw connecting lines for snakes/ladders via SVG overlay
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

  useEffect(() => {
    updateCellCenters();
    window.addEventListener('resize', updateCellCenters);
    return () => window.removeEventListener('resize', updateCellCenters);
  }, [players]);

  const activePlayer = players[turnIndex];
  const myTurn = activePlayer && activePlayer.id === playerId;

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
                        className={`sl-cell ${cellNum % 2 === 0 ? 'even' : 'odd'}`}
                        data-cell-num={cellNum}
                      >
                        <span className="sl-cell-label">{cellNum}</span>
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
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* SVG Overlay for drawing Snakes and Ladders */}
          <svg className="sl-svg-overlay">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#c53030" />
              </marker>
            </defs>
            {/* Draw Ladders */}
            {Object.entries(LADDERS).map(([start, end]) => {
              const p1 = cellCenters[Number(start)];
              const p2 = cellCenters[Number(end)];
              if (!p1 || !p2) return null;
              return (
                <g key={`ladder-${start}-${end}`} className="sl-ladder-path">
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2f855a" strokeWidth="6" strokeDasharray="3,3" opacity="0.7" />
                  <line x1={p1.x - 4} y1={p1.y} x2={p2.x - 4} y2={p2.y} stroke="#ecc94b" strokeWidth="2" opacity="0.9" />
                  <line x1={p1.x + 4} y1={p1.y} x2={p2.x + 4} y2={p2.y} stroke="#ecc94b" strokeWidth="2" opacity="0.9" />
                </g>
              );
            })}

            {/* Draw Snakes */}
            {Object.entries(SNAKES).map(([start, end]) => {
              const p1 = cellCenters[Number(start)]; // Head (high)
              const p2 = cellCenters[Number(end)];   // Tail (low)
              if (!p1 || !p2) return null;
              // Generate wavy cubic bezier curve
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              const cx1 = p1.x + dx * 0.25 + Math.sin(dy / 10) * 30;
              const cy1 = p1.y + dy * 0.25;
              const cx2 = p1.x + dx * 0.75 - Math.sin(dy / 10) * 30;
              const cy2 = p1.y + dy * 0.75;
              return (
                <path
                  key={`snake-${start}-${end}`}
                  d={`M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`}
                  stroke="#c53030"
                  strokeWidth="5"
                  fill="none"
                  markerEnd="url(#arrow)"
                  className="sl-snake-path"
                  opacity="0.85"
                />
              );
            })}
          </svg>
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
              {dice[0]}
            </div>
            {gameState === 'playing' && (
              <button
                className="btn-gold roll-btn"
                disabled={!myTurn || phase === 'rolling_animation'}
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
