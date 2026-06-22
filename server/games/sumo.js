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
  const sumoColors = ['#C53030', '#3182CE', '#2F855A', '#D69E2E', '#6B46C1', '#ED8936', '#38B2AC', '#E2E8F0'];

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

    if (!p.avatar) {
      p.avatar = {
        skinColor: '#F5CBA7',
        hairStyle: 'short',
        hairColor: '#1A1A1A',
        expression: 'smile',
      };
    }
    p.avatar.clothesColor = sumoColors[i % sumoColors.length];
  });
}

// Generate static bumpers on the arena
function generateBumpers(room) {
  const count = room.rules?.bumpersCount ?? 2;
  const bumpers = [];
  const centerX = 400;
  const centerY = 400;
  const startAngle = Math.random() * Math.PI * 2;
  const shapes = ['circle', 'triangle', 'square', 'line'];
  const alivePlayers = room.players.filter(p => p.alive);

  for (let i = 0; i < count; i++) {
    const type = shapes[Math.floor(Math.random() * shapes.length)];
    const shapeAngle = Math.random() * Math.PI * 2;

    let size = 20;
    let radius = 20; // bounding radius for broad phase
    if (type === 'square') {
      size = 30 + Math.random() * 10;
      radius = size * 0.707;
    } else if (type === 'triangle') {
      size = 25 + Math.random() * 10;
      radius = size;
    } else if (type === 'line') {
      size = 50 + Math.random() * 20;
      radius = size / 2;
    } else { // circle
      size = 18 + Math.random() * 8;
      radius = size;
    }

    let pos = null;
    for (let attempts = 0; attempts < 50; attempts++) {
      const angle = startAngle + (i * (2 * Math.PI / count)) + (Math.random() * 0.6 - 0.3) + (attempts * 0.1);
      const dist = 90 + Math.random() * 70;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;

      // Check collision with alive players
      let collides = false;
      for (const p of alivePlayers) {
        const px = p.positionX ?? 400;
        const py = p.positionY ?? 400;
        const pr = p.radius ?? 18;
        const dx = x - px;
        const dy = y - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < pr + radius + 15) { // 15px safety buffer
          collides = true;
          break;
        }
      }

      if (!collides) {
        pos = { x, y };
        break;
      }
    }

    if (!pos) {
      const angle = startAngle + (i * (2 * Math.PI / count)) + (Math.random() * 0.4 - 0.2);
      const dist = 100 + Math.random() * 60;
      pos = {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist
      };
    }

    bumpers.push({
      pos,
      type,
      size,
      angle: shapeAngle,
      radius, // bounding radius
      restitution: 1.6,
      pulseTimer: 0
    });
  }
  room.sumoBumpers = bumpers;
}

// Generate temporary round obstacles
function generateObstacles(room) {
  const count = 2 + Math.floor(Math.random() * 3); // 2 to 4 obstacles
  const obstacles = [];
  const centerX = 400;
  const centerY = 400;
  const alivePlayers = room.players.filter(p => p.alive);

  for (let i = 0; i < count; i++) {
    const type = Math.random() < 0.5 ? 'speed_boost' : 'slime';
    const obstacleAngle = Math.random() * Math.PI * 2;
    const radius = 26 + Math.random() * 8; // influence radius
    let pos = null;

    for (let attempts = 0; attempts < 50; attempts++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;

      // Check collision with alive players
      let collides = false;
      for (const p of alivePlayers) {
        const px = p.positionX ?? 400;
        const py = p.positionY ?? 400;
        const pr = p.radius ?? 18;
        const dx = x - px;
        const dy = y - py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < pr + radius + 15) { // 15px safety buffer
          collides = true;
          break;
        }
      }

      if (!collides) {
        pos = { x, y };
        break;
      }
    }

    if (!pos) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 140;
      pos = {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist
      };
    }

    obstacles.push({
      pos,
      type,
      radius,
      angle: obstacleAngle // boost direction for speed pads
    });
  }
  room.sumoObstacles = obstacles;
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
  generateObstacles(room);

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
      room.gameState = 'roundover';
      room.sumoPhase = 'gameover';

      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        winner.score = (winner.score || 0) + 1;
        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: `👑 ${winner.name} wins the match!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      } else {
        const lastSurvivorId = eliminations && eliminations.length > 0 ? eliminations[eliminations.length - 1] : null;
        const winner = lastSurvivorId ? room.players.find(p => p.id === lastSurvivorId) : null;

        if (winner) {
          winner.score = (winner.score || 0) + 1;
          io.to(room.code).emit('chat-message', {
            id: `sys_${Math.random()}`,
            senderName: 'System',
            senderId: 'system',
            text: `👑 ${winner.name} is the last survivor and wins the match!`,
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
      }
      broadcastGameUpdate(room, io);
    } else {
      // Continue next turn: reset moves, transition to aiming phase, restart timer
      room.sumoMoves = {};
      room.sumoPhase = 'aiming';
      generateObstacles(room);
      startAimingTimer(room, io);
      broadcastGameUpdate(room, io);
    }
  }
}
