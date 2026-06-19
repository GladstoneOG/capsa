function getPublicRoomState(room) {
  return {
    ...room,
    players: room.players.map(p => {
      const { sessionId, ...publicPlayer } = p;
      return publicPlayer;
    }),
  };
}

export function getSanitizedRoomState(room, socketId) {
  return getPublicRoomState(room);
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

// Spawns players equidistant on a circle of given radius
function setupSpawns(room) {
  const centerX = 400;
  const centerY = 400;
  const spawnRadius = 180;
  const numPlayers = room.players.length;

  room.players.forEach((p, i) => {
    const angle = i * (2 * Math.PI / numPlayers) - Math.PI / 2;
    p.positionX = centerX + Math.cos(angle) * spawnRadius;
    p.positionY = centerY + Math.sin(angle) * spawnRadius;
    p.velocityX = 0;
    p.velocityY = 0;
    p.radius = 18;
    p.mass = 1;
    p.alive = true;
    p.team = p.id; // Assign unique team for Free-for-all
  });
}

// Generate static bumpers on the arena
function generateBumpers(room) {
  const count = room.rules?.bumpersCount ?? 2;
  const bumpers = [];
  const centerX = 400;
  const centerY = 400;

  for (let i = 0; i < count; i++) {
    // Distribute bumpers around the middle-inner section
    const angle = (i * (2 * Math.PI / count)) + (Math.random() * 0.5);
    const dist = 100 + Math.random() * 50;
    bumpers.push({
      pos: {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist
      },
      radius: 20,
      restitution: 1.6,
      pulseTimer: 0
    });
  }
  room.sumoBumpers = bumpers;
}

export function startRound(room, io) {
  room.gameState = 'playing';
  room.roundNumber += 1;

  // Sumo properties
  room.sumoPhase = 'aiming';
  room.sumoArenaRadius = room.rules?.arenaRadius || 300;
  room.sumoMoves = {};
  room.sumoTurnTimer = room.rules?.turnDuration || 10;
  room.sumoRoundCount = 0;

  setupSpawns(room);
  generateBumpers(room);

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random()}`,
    senderName: 'System',
    senderId: 'system',
    text: '🤼 Turn-Based Sumo started! Drag and release to push your opponents off the ring!',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Start the aiming countdown timer loop
  startAimingTimer(room, io);

  // Notify clients and transition to table
  room.players.forEach(p => {
    if (!p.isBot) {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit('game-started', getSanitizedRoomState(room, p.id));
      }
    }
  });

  broadcastGameUpdate(room, io);
}

let roomTimers = new Map();

function startAimingTimer(room, io) {
  // Clear any existing timer
  if (roomTimers.has(room.code)) {
    clearInterval(roomTimers.get(room.code));
  }

  room.sumoTurnTimer = room.rules?.turnDuration || 10;

  const intervalId = setInterval(() => {
    const activeRoom = roomTimers.has(room.code) ? room : null;
    if (!activeRoom || activeRoom.gameState !== 'playing' || activeRoom.sumoPhase !== 'aiming') {
      clearInterval(intervalId);
      roomTimers.delete(room.code);
      return;
    }

    activeRoom.sumoTurnTimer -= 1;

    if (activeRoom.sumoTurnTimer <= 0) {
      clearInterval(intervalId);
      roomTimers.delete(room.code);
      executeTurn(activeRoom, io);
    } else {
      broadcastGameUpdate(activeRoom, io);
    }
  }, 1000);

  roomTimers.set(room.code, intervalId);
}

function executeTurn(room, io) {
  room.sumoPhase = 'animating';

  // Ensure all active players have a move (default to zero if none submitted)
  room.players.forEach(p => {
    if (p.alive && !room.sumoMoves[p.id]) {
      room.sumoMoves[p.id] = { angle: 0, power: 0 };
    }
  });

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random()}`,
    senderName: 'System',
    senderId: 'system',
    text: '⚡ Launching moves! Watch the arena!',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  broadcastGameUpdate(room, io);
}

export function handleAction(room, socket, action, payload, io) {
  const player = room.players.find(p => p.id === socket.id);
  const isHost = player?.isHost;

  if (action === 'submit-move') {
    if (room.sumoPhase !== 'aiming') return;

    const { angle, power, locked, playerId } = payload;
    const targetPlayerId = playerId || socket.id;

    // Authorization: player can submit for themselves, or host can submit for bots
    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer || (!targetPlayer.isBot && targetPlayer.id !== socket.id)) return;

    room.sumoMoves[targetPlayer.id] = { angle, power, locked };

    // Check if all connected/alive players have explicitly locked in
    const activeHumans = room.players.filter(p => !p.isBot && p.alive && !p.disconnected);
    const activeBots = room.players.filter(p => p.isBot && p.alive);
    const totalExpected = activeHumans.length + activeBots.length;
    
    const lockedCount = Object.values(room.sumoMoves).filter(m => m.locked).length;

    if (lockedCount >= totalExpected) {
      // Clear timer and execute immediately
      if (roomTimers.has(room.code)) {
        clearInterval(roomTimers.get(room.code));
        roomTimers.delete(room.code);
      }
      executeTurn(room, io);
    } else {
      broadcastGameUpdate(room, io);
    }
  } 
  
  else if (action === 'resolve-turn') {
    // Only host client resolves the physics animation authoritatively
    if (!isHost) return;
    if (room.sumoPhase !== 'animating') return;

    const { playerStates, eliminations } = payload;

    // Apply resolved player positions, velocities, and alive statuses
    playerStates.forEach(state => {
      const p = room.players.find(pl => pl.id === state.id);
      if (p) {
        p.positionX = state.x;
        p.positionY = state.y;
        p.velocityX = state.vx;
        p.velocityY = state.vy;
        p.alive = state.alive;
        if (!state.alive && !p.eliminatedRound) {
          p.eliminatedRound = room.sumoRoundCount + 1;
        }
      }
    });

    // Chat announcement for eliminations
    if (eliminations && eliminations.length > 0) {
      eliminations.forEach(elimId => {
        const p = room.players.find(pl => pl.id === elimId);
        if (p) {
          io.to(room.code).emit('chat-message', {
            id: `sys_${Math.random()}`,
            senderName: 'System',
            senderId: 'system',
            text: `💥 ${p.name} fell off the arena!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          });
        }
      });
    }

    room.sumoRoundCount += 1;

    // Arena Shrinking: reduce radius by 15px each turn
    if (room.rules?.shrinkingArena !== false) {
      room.sumoArenaRadius = Math.max(100, room.sumoArenaRadius - 15);
      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: `⚠️ The arena is shrinking! Radius: ${room.sumoArenaRadius}px`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
    }

    // Check game over or round over conditions
    const alivePlayers = room.players.filter(p => p.alive);

    if (alivePlayers.length <= 1) {
      room.gameState = 'gameover';
      room.sumoPhase = 'gameover';

      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        winner.score += 100;
        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: `👑 ${winner.name} wins the match!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      } else {
        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: '🤝 It\'s a draw! Everyone fell off.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      }
      broadcastGameUpdate(room, io);
    } else {
      // Continue next turn: reset moves, transition to aiming phase, restart timer
      room.sumoMoves = {};
      room.sumoPhase = 'aiming';
      startAimingTimer(room, io);
      broadcastGameUpdate(room, io);
    }
  }
}
