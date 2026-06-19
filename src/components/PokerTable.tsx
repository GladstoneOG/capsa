import React, { useState, useEffect, useRef } from 'react';
import { AvatarSVG } from './AvatarCreator';
import { getStartingHandName } from '../utils/pokerLogic';

interface PokerTableProps {
  socket: any;
  roomId: string;
  players: any[];
  gameState: any;
  myPlayerId: string;
  isHost: boolean;
}

const suitSymbols: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
const suitColors: Record<string, string> = { D: 'red', C: 'black', H: 'red', S: 'black' };

export const PokerTable: React.FC<PokerTableProps> = ({
  socket,
  roomId,
  players,
  gameState,
  myPlayerId,
  isHost,
}) => {
  const [raiseAmount, setRaiseAmount] = useState<number>(10);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const timerRef = useRef<any>(null);

  const myPlayer = players.find(p => p.id === myPlayerId);
  const isMyTurn = gameState.currentPlayerIndex !== undefined && players[gameState.currentPlayerIndex]?.id === myPlayerId;
  const isRoundOver = gameState.gameState === 'roundover';


  // Calculate raise bounds
  const currentBet = gameState.currentBet || 0;
  const minRaiseIncrement = gameState.minRaise || 10;
  const myCurrentBetContribution = myPlayer?.currentBet || 0;
  const myChips = myPlayer?.chips || 0;

  // Minimum amount player must raise TO
  const minRaiseTo = currentBet + minRaiseIncrement;
  // Maximum amount player can raise TO
  const maxRaiseTo = myChips + myCurrentBetContribution;

  // Handle timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (gameState.currentPlayerIndex !== undefined && gameState.gameState === 'playing') {
      setTimeLeft(30);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // If it is my turn, auto-fold or check
            if (isMyTurn) {
              const callAmount = currentBet - myCurrentBetContribution;
              if (callAmount <= 0) {
                handlePokerAction('check');
              } else {
                handlePokerAction('fold');
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.currentPlayerIndex, isMyTurn]);

  // Adjust raise slider when my turn starts or currentBet changes
  useEffect(() => {
    if (isMyTurn) {
      setRaiseAmount(Math.min(minRaiseTo, maxRaiseTo));
    }
  }, [isMyTurn, currentBet]);

  const handlePokerAction = (action: string, amount?: number) => {
    socket.emit('poker-action', {
      roomCode: roomId,
      action,
      payload: { amount: amount !== undefined ? amount : raiseAmount },
    });
  };

  const handleRestart = () => {
    socket.emit('restart-game', { roomCode: roomId });
  };

  // Sound effects helper
  const playSound = (type: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'tick') {
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } else if (type === 'turn') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
    } catch (e) {
      // Audio context error
    }
  };

  // Play tick sound on low time
  useEffect(() => {
    if (isMyTurn && timeLeft <= 5 && timeLeft > 0) {
      playSound('tick');
    }
  }, [timeLeft, isMyTurn]);

  // Seat layout logic (rotates table so 'You' are at position 0)
  const myIndexInRoom = players.findIndex(p => p.id === myPlayerId);
  const myIndex = myIndexInRoom === -1 ? 0 : myIndexInRoom;

  function getPhysicalSeat(relIdx: number, total: number): number {
    if (total === 2) {
      return relIdx === 0 ? 0 : 4;
    }
    if (total === 3) {
      return relIdx === 0 ? 0 : relIdx === 1 ? 3 : 5;
    }
    if (total === 4) {
      return relIdx === 0 ? 0 : relIdx === 1 ? 2 : relIdx === 2 ? 4 : 6;
    }
    if (total === 5) {
      const mapping = [0, 1, 3, 5, 7];
      return mapping[relIdx];
    }
    if (total === 6) {
      const mapping = [0, 1, 2, 4, 6, 7];
      return mapping[relIdx];
    }
    if (total === 7) {
      const mapping = [0, 1, 2, 3, 5, 6, 7];
      return mapping[relIdx];
    }
    return relIdx;
  }

  // Pre-flop preset raise values
  const handlePreset = (multiplier: number) => {
    const target = currentBet * multiplier;
    setRaiseAmount(Math.max(minRaiseTo, Math.min(target, maxRaiseTo)));
  };

  const handlePotPreset = () => {
    const totalPot = (gameState.pot || 0) + players.reduce((sum, p) => sum + (p.currentBet || 0), 0);
    const target = totalPot + currentBet * 2;
    setRaiseAmount(Math.max(minRaiseTo, Math.min(target, maxRaiseTo)));
  };

  const getHandLabel = () => {
    if (!myPlayer?.cards || myPlayer.cards.length < 2) return '';
    if (myPlayer.folded) return 'Folded';
    return getStartingHandName(myPlayer.cards[0], myPlayer.cards[1]);
  };

  return (
    <div className="poker-table-container">
      {/* Felt Table */}
      <div className="poker-table-felt">
        
        {/* Center Table Area */}
        <div className="poker-table-center">
          {/* Pot Display */}
          <div className="poker-pot-display">
            <div className="poker-pot-icon" />
            <span>POT: ${gameState.pot || 0}</span>
          </div>

          {/* Community Cards */}
          <div className="poker-community-cards">
            {Array.from({ length: 5 }).map((_, i) => {
              const card = gameState.communityCards?.[i];
              if (card) {
                return (
                  <div key={card.id || i} className={`poker-card poker-card-anim ${suitColors[card.suit]}`}>
                    <div className="poker-card-top">
                      <span className="poker-card-value">{card.rank}</span>
                      <span className="poker-card-suit-small">{suitSymbols[card.suit]}</span>
                    </div>
                    <span className="poker-card-suit-large">{suitSymbols[card.suit]}</span>
                  </div>
                );
              }
              return <div key={i} className="poker-community-card-placeholder" />;
            })}
          </div>
        </div>

        {/* Players Seats */}
        <div className="poker-seats-container">
          {players.map((player, idx) => {
            const relIdx = (idx - myIndex + players.length) % players.length;
            const physicalSeat = getPhysicalSeat(relIdx, players.length);
            const isTurn = gameState.currentPlayerIndex === idx;
            const isDealer = gameState.dealerIndex === idx;
            const hasFolded = player.folded;
            const isLocal = player.id === myPlayerId;
            const isEliminated = player.isEliminated;

            return (
              <div
                key={player.id}
                className={`poker-seat poker-seat-${physicalSeat} ${isTurn ? 'active' : ''} ${hasFolded ? 'folded' : ''}`}
              >
                {/* Player Card UI */}
                <div className="poker-player-card">
                  {/* Timer Circular Arc */}
                  {isTurn && (
                    <svg className="poker-timer-svg">
                      <circle
                        className="poker-timer-circle"
                        cx="24"
                        cy="24"
                        r="20"
                        style={{
                          strokeDashoffset: 126 - (126 * timeLeft) / 30,
                          stroke: timeLeft > 15 ? '#10b981' : timeLeft > 5 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </svg>
                  )}

                  <div className="poker-avatar-wrapper">
                    <AvatarSVG config={player.avatar} size={40} />
                    {isDealer && <div className="poker-dealer-button">D</div>}
                  </div>

                  <span className="poker-player-name">{player.name} {isLocal ? '(You)' : ''}</span>
                  <span className="poker-player-chips">
                    {isEliminated ? 'BUST' : `$${player.chips ?? 0}`}
                  </span>

                  {/* Hole Cards */}
                  {!isEliminated && !hasFolded && (
                    <div className="poker-seat-cards">
                      {player.cards && player.cards.map((card: any, cIdx: number) => {
                        if (card) {
                          return (
                            <div key={card.id || cIdx} className={`poker-card-mini ${suitColors[card.suit]}`}>
                              {card.rank}{suitSymbols[card.suit]}
                            </div>
                          );
                        }
                        return <div key={cIdx} className="poker-card-mini back" />;
                      })}
                    </div>
                  )}

                  {/* Action Badges */}
                  {player.lastAction && (
                    <div className={`poker-action-badge ${player.lastAction.toLowerCase()}`}>
                      {player.lastAction}
                    </div>
                  )}
                </div>

                {/* Bet Chips in front of seat */}
                {player.currentBet > 0 && (
                  <div className="poker-seat-bet">
                    🪙 ${player.currentBet}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hand Log Panel */}
      {gameState.handLog && gameState.handLog.length > 0 && (
        <div className="poker-hand-log">
          {gameState.handLog.slice(-10).map((log: string, i: number) => (
            <div key={i} className="poker-log-entry">{log}</div>
          ))}
        </div>
      )}

      {/* Showdown Overlays */}
      {isRoundOver && gameState.showdownResults && (
        <div className="poker-overlay">
          <div className="poker-overlay-content">
            <h2 className="poker-overlay-title">Hand Showdown</h2>
            
            <div className="poker-showdown-list">
              {gameState.showdownResults.playerHands?.map((ph: any) => (
                <div key={ph.playerId} className="poker-showdown-player">
                  <span className="poker-showdown-name">
                    {players.find(p => p.id === ph.playerId)?.name}
                  </span>
                  <span className="poker-showdown-hand">{ph.handName}</span>
                </div>
              ))}
            </div>

            <div className="poker-winners-announcement">
              {gameState.showdownResults.winners?.map((w: any) => (
                <div key={w.playerId}>
                  🏆 {w.name} wins ${w.amount}!
                </div>
              ))}
            </div>

            {isHost && (
              <button onClick={handleRestart} className="poker-btn poker-btn-raise" style={{ maxWidth: '200px' }}>
                Next Hand
              </button>
            )}
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState.gameState === 'gameover' && (
        <div className="poker-overlay">
          <div className="poker-overlay-content">
            <h2 className="poker-overlay-title">Tournament Over</h2>
            <div className="poker-winners-announcement" style={{ fontSize: '1.5rem', margin: '20px 0' }}>
              🎉 {players.find(p => p.id === gameState.gameWinner)?.name} is the Poker Champion! 🎉
            </div>
            {isHost && (
              <button onClick={handleRestart} className="poker-btn poker-btn-raise" style={{ maxWidth: '200px' }}>
                New Tournament
              </button>
            )}
          </div>
        </div>
      )}

      {/* Local Action Control Panel */}
      {!myPlayer?.isEliminated && !myPlayer?.folded && gameState.gameState === 'playing' && (
        <div className="poker-control-panel" style={{ opacity: isMyTurn ? 1 : 0.7, pointerEvents: isMyTurn ? 'auto' : 'none' }}>
          
          <div className="poker-my-hand-info">
            <div className="poker-my-cards">
              {myPlayer?.cards?.map((card: any, i: number) => (
                <div key={card?.id || i} className={`poker-card ${suitColors[card?.suit]}`}>
                  <div className="poker-card-top">
                    <span className="poker-card-value">{card?.rank}</span>
                    <span className="poker-card-suit-small">{suitSymbols[card?.suit]}</span>
                  </div>
                  <span className="poker-card-suit-large">{suitSymbols[card?.suit]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <span className="poker-hand-strength-label">{getHandLabel()}</span>
              {isMyTurn && <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>YOUR TURN ({timeLeft}s)</span>}
            </div>
          </div>

          {/* Raise Slider (Only if turn & raise is possible) */}
          {isMyTurn && maxRaiseTo > minRaiseTo && (
            <div className="poker-raise-panel">
              <input
                type="range"
                min={minRaiseTo}
                max={maxRaiseTo}
                step={5}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                className="poker-slider"
              />
              <div className="poker-raise-presets">
                {currentBet > 0 && (
                  <>
                    <button onClick={() => handlePreset(2)} className="poker-btn-preset">2x</button>
                    <button onClick={() => handlePreset(3)} className="poker-btn-preset">3x</button>
                    <button onClick={handlePotPreset} className="poker-btn-preset">Pot</button>
                  </>
                )}
                <button onClick={() => setRaiseAmount(maxRaiseTo)} className="poker-btn-preset">All-in</button>
              </div>
              <div className="poker-raise-value">${raiseAmount}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="poker-action-buttons">
            <button
              onClick={() => handlePokerAction('fold')}
              disabled={!isMyTurn}
              className="poker-btn poker-btn-fold"
            >
              FOLD
            </button>
            
            {currentBet <= myCurrentBetContribution ? (
              <button
                onClick={() => handlePokerAction('check')}
                disabled={!isMyTurn}
                className="poker-btn poker-btn-check"
              >
                CHECK
              </button>
            ) : (
              <button
                onClick={() => handlePokerAction('call')}
                disabled={!isMyTurn}
                className="poker-btn poker-btn-call"
              >
                CALL (${currentBet - myCurrentBetContribution})
              </button>
            )}

            <button
              onClick={() => handlePokerAction(raiseAmount >= maxRaiseTo ? 'all-in' : 'raise', raiseAmount)}
              disabled={!isMyTurn || maxRaiseTo < minRaiseTo}
              className="poker-btn poker-btn-raise"
            >
              {raiseAmount >= maxRaiseTo ? 'ALL-IN' : 'RAISE'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PokerTable;
