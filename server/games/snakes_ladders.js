const LADDERS = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 87: 94 };
const SNAKES = { 16: 6, 46: 25, 49: 11, 62: 19, 64: 60, 74: 53, 89: 68, 92: 88, 95: 75, 99: 80 };

export function getSanitizedRoomState(room, socketId) {
  // All board states are public in Snakes and Ladders
  return {
    ...room,
    players: room.players.map(p => {
      const { sessionId, ...publicPlayer } = p;
      return publicPlayer;
    })
  };
}

export function broadcastGameUpdate(room, io) {
  room.players.forEach(p => {
    if (!p.isBot) {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit('game-updated', getSanitizedRoomState(room, p.id));
      }
    }
  });

  const host = room.players.find(p => p.isHost);
  if (host && !host.isBot) {
    const hostSocket = io.sockets.sockets.get(host.id);
    if (hostSocket) {
      hostSocket.emit('bot-coordinator-sync', room);
    }
  }
}

export function startRound(room, io) {
  room.gameState = 'playing';
  room.roundNumber += 1;
  room.turnIndex = 0;
  room.snakesLaddersDice = [1];
  room.snakesLaddersRollId = null;
  room.snakesLaddersPhase = 'roll';
  room.snakesLaddersLastAction = null;

  room.players.forEach(p => {
    p.position = 1; // Resets positions to 1
    p.score = 0;
    p.roundPoints = 0;
    p.lastRoll = null;
    p.lastPositionBeforeMove = null;
    p.hadExtraTurn = false;
    p.lastObstacleType = null;
    p.lastObstacleStart = null;
    p.lastObstacleEnd = null;
    delete p.finishRank;
  });

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random()}`,
    senderName: 'System',
    senderId: 'system',
    text: '🎲 Snakes & Ladders started! First to square 100 wins! 🐍',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Notify clients transition to Table
  room.players.forEach(p => {
    if (!p.isBot) {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit('game-started', getSanitizedRoomState(room, p.id));
      }
    }
  });

  // Initial Sync
  const host = room.players.find(p => p.isHost);
  if (host && !host.isBot) {
    const hostSocket = io.sockets.sockets.get(host.id);
    if (hostSocket) {
      hostSocket.emit('bot-coordinator-sync', room);
    }
  }
}

export function handleAction(room, socket, action, payload, io) {
  const currentPlayer = room.players[room.turnIndex];
  if (!currentPlayer) return;

  const isAuthorized = currentPlayer.id === socket.id || (currentPlayer.isBot && room.players.find(p => p.id === socket.id)?.isHost);
  if (!isAuthorized) return;

  if (action === 'roll-dice') {
    if (room.snakesLaddersPhase !== 'roll') return;

    const roll = Math.floor(Math.random() * 6) + 1;
    room.snakesLaddersDice = [roll];
    room.snakesLaddersRollId = Math.random().toString(36).substring(2, 9);
    room.snakesLaddersPhase = 'rolling_animation';

    broadcastGameUpdate(room, io);

    // Roll Chat Log
    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text: `🎲 ${currentPlayer.name} rolled a ${roll}!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    // 1.5s delay to match frontend rolling animation
    setTimeout(() => {
      if (room.gameState !== 'playing') return;

      let oldPos = currentPlayer.position || 1;
      let nextPos = oldPos + roll;
      let landedEffect = null;
      let landedEffectPos = null;

      // Bounce-back
      if (nextPos > 100) {
        nextPos = 100 - (nextPos - 100);
      }

      let finalPos = nextPos;
      if (LADDERS[nextPos]) {
        finalPos = LADDERS[nextPos];
        landedEffect = 'ladder';
        landedEffectPos = nextPos;
      } else if (SNAKES[nextPos]) {
        finalPos = SNAKES[nextPos];
        landedEffect = 'snake';
        landedEffectPos = nextPos;
      }

      currentPlayer.position = finalPos;
      currentPlayer.lastPositionBeforeMove = oldPos;
      currentPlayer.lastRoll = roll;
      currentPlayer.lastObstacleType = landedEffect;
      currentPlayer.lastObstacleStart = landedEffectPos;
      currentPlayer.lastObstacleEnd = landedEffect ? finalPos : null;

      let chatText = `${currentPlayer.name} moved from ${oldPos} to ${nextPos}`;
      if (landedEffect === 'ladder') {
        chatText += `, then climbed a ladder from ${landedEffectPos} to ${finalPos}! 🪜`;
      } else if (landedEffect === 'snake') {
        chatText += `, then slid down a snake from ${landedEffectPos} to ${finalPos}! 🐍`;
      } else {
        chatText += '.';
      }

      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: chatText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });

      room.snakesLaddersLastAction = {
        playerId: currentPlayer.id,
        roll,
        oldPos,
        intermediatePos: nextPos,
        finalPos,
        landedEffect,
        landedEffectPos
      };

      if (finalPos === 100) {
        room.gameState = 'gameover';
        currentPlayer.finishRank = 1;
        currentPlayer.score = 100;

        room.players.forEach(p => {
          if (p.id !== currentPlayer.id) {
            p.finishRank = 2;
            p.score = p.position || 1;
          }
        });

        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: `🏆 ${currentPlayer.name} reached 100 and won!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });

        io.to(room.code).emit('round-over', getSanitizedRoomState(room, ''));
        return;
      }

      // Roll 6 grants extra turn
      const rollSixBonus = room.rules && room.rules.rollSixBonus;
      currentPlayer.hadExtraTurn = (roll === 6 && rollSixBonus);

      if (roll === 6 && rollSixBonus) {
        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: `🔥 Bonus turn! ${currentPlayer.name} rolled a 6 and rolls again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      } else {
        room.turnIndex = (room.turnIndex + 1) % room.players.length;
      }

      room.snakesLaddersPhase = 'roll';
      broadcastGameUpdate(room, io);
    }, 1500);
  }
}
