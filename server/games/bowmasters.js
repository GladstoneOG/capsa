// Midpoint displacement terrain generation on the server to keep all clients in sync
function generateServerTerrain(width = 1200, roughness = 0.5) {
  const size = 1024; // Must be power of 2
  const heights = new Array(size + 1).fill(0);
  
  heights[0] = 350 + Math.random() * 100;
  heights[size] = 350 + Math.random() * 100;
  
  let step = size;
  let displacement = roughness * 200;
  
  while (step > 1) {
    const half = step / 2;
    for (let i = 0; i < size; i += step) {
      const left = heights[i];
      const right = heights[i + step];
      const mid = (left + right) / 2 + (Math.random() - 0.5) * displacement;
      heights[i + half] = Math.max(220, Math.min(520, mid));
    }
    step = half;
    displacement *= 0.5;
  }
  
  const finalHeights = [];
  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const index = t * size;
    const i0 = Math.floor(index);
    const i1 = Math.min(size, i0 + 1);
    const frac = index - i0;
    const height = heights[i0] * (1 - frac) + heights[i1] * frac;
    finalHeights.push(Math.round(height));
  }
  
  return finalHeights;
}

// Helper to deform terrain (craters) on the server
function deformServerTerrain(heights, centerX, radius, depth) {
  const newHeights = [...heights];
  const width = heights.length;
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(width - 1, Math.ceil(centerX + radius));
  
  for (let x = startX; x <= endX; x++) {
    const dx = x - centerX;
    if (Math.abs(dx) < radius) {
      const craterDepth = Math.sqrt(radius * radius - dx * dx) * (depth / radius);
      newHeights[x] = Math.min(550, newHeights[x] + craterDepth);
    }
  }
  return newHeights;
}

export function getSanitizedRoomState(room, socketId) {
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
  
  // Game phases: 'character_select' -> 'playing'
  room.bowmastersPhase = 'character_select';
  room.bowmastersTerrain = [];
  room.bowmastersWind = 0;
  room.bowmastersTurnOrder = [];
  room.bowmastersTurnIdx = 0;
  room.bowmastersLastShot = null;
  room.bowmastersTeams = null;
  room.bowmastersMode = room.rules?.mode || '1v1';
  room.bowmastersWindEnabled = room.rules?.windEnabled !== false;

  // Initialize player status for character selection
  room.players.forEach(p => {
    p.characterType = null;
    p.characterSelected = false;
    p.hp = 100;
    p.maxHp = 100;
    p.alive = true;
    p.positionX = 0;
    p.positionY = 0;
    p.team = 'a'; // default
    delete p.finishRank;
  });

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random()}`,
    senderName: 'System',
    senderId: 'system',
    text: '🏹 Bowmasters started! Select your character and prepare to fire!',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Auto-select characters for bots
  const characterTypes = ['archer', 'boulder', 'bomber', 'spear', 'slingshot'];
  room.players.forEach(p => {
    if (p.isBot) {
      p.characterType = characterTypes[Math.floor(Math.random() * characterTypes.length)];
      p.characterSelected = true;
    }
  });

  // Notify clients and transition to table
  room.players.forEach(p => {
    if (!p.isBot) {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit('game-started', getSanitizedRoomState(room, p.id));
      }
    }
  });

  // Check if we can proceed immediately (if all human players are already ready, or if all bots)
  checkCharacterSelectionComplete(room, io);
}

function checkCharacterSelectionComplete(room, io) {
  const allSelected = room.players.every(p => p.characterSelected);
  if (!allSelected) {
    // Keep waiting for human selections, sync state
    broadcastGameUpdate(room, io);
    return;
  }

  // Setup gameplay
  room.bowmastersPhase = 'playing';

  // 1. Generate Terrain (Authoritative server heightmap)
  const terrainWidth = 2000;
  room.bowmastersTerrain = generateServerTerrain(terrainWidth, 0.45);

  // 2. Assign teams & spawn positions
  const numPlayers = room.players.length;
  
  if (room.bowmastersMode === '2v2' && numPlayers >= 4) {
    // 2v2: assign team 'a' and 'b' (2 players each)
    const shuffled = [...room.players].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, idx) => {
      p.team = idx < 2 ? 'a' : 'b';
    });

    const teamAPlayers = room.players.filter(p => p.team === 'a');
    const teamBPlayers = room.players.filter(p => p.team === 'b');

    // Spawn X positions: Team A on left, Team B on right, with buffer (closer spawn by ~28% of original distance to center)
    teamAPlayers[0].positionX = 500;
    teamAPlayers[1].positionX = 600;
    teamBPlayers[0].positionX = 1500;
    teamBPlayers[1].positionX = 1400;

    // Turn order: A1 -> B1 -> A2 -> B2
    room.bowmastersTurnOrder = [
      teamAPlayers[0].id,
      teamBPlayers[0].id,
      teamAPlayers[1].id,
      teamBPlayers[1].id
    ];
  } else {
    // 1v1 mode
    room.bowmastersMode = '1v1';
    
    // Assign Team A / B
    room.players.forEach((p, idx) => {
      p.team = idx % 2 === 0 ? 'a' : 'b';
    });

    const teamAPlayers = room.players.filter(p => p.team === 'a');
    const teamBPlayers = room.players.filter(p => p.team === 'b');

    // Spawn positions: 570 vs 1430 (closer spawn by ~28% of original distance to center)
    teamAPlayers.forEach((p, idx) => {
      p.positionX = 570 + idx * 80;
    });
    teamBPlayers.forEach((p, idx) => {
      p.positionX = 1430 - idx * 80;
    });

    // Turn order: alternate A & B
    room.bowmastersTurnOrder = [];
    const maxLen = Math.max(teamAPlayers.length, teamBPlayers.length);
    for (let i = 0; i < maxLen; i++) {
      if (teamAPlayers[i]) room.bowmastersTurnOrder.push(teamAPlayers[i].id);
      if (teamBPlayers[i]) room.bowmastersTurnOrder.push(teamBPlayers[i].id);
    }
  }

  // Calculate spawn Ys matching terrain heights
  room.players.forEach(p => {
    const x = Math.floor(p.positionX);
    p.positionY = room.bowmastersTerrain[x];
  });

  // Randomize first turn
  room.bowmastersTurnIdx = Math.floor(Math.random() * room.bowmastersTurnOrder.length);
  
  // Set first wind
  room.bowmastersWind = room.bowmastersWindEnabled ? (Math.round((Math.random() * 6 - 3) * 10) / 10) : 0;

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random()}`,
    senderName: 'System',
    senderId: 'system',
    text: `💥 Match setup complete! Let the battle begin. First turn goes to ${room.players.find(p => p.id === room.bowmastersTurnOrder[room.bowmastersTurnIdx]).name}!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  broadcastGameUpdate(room, io);
}

export function handleAction(room, socket, action, payload, io) {
  // Character selection is handled before turn-based auth, since all players
  // need to select during character_select phase (turn order isn't set yet).
  if (action === 'select-character') {
    if (room.bowmastersPhase !== 'character_select') return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.characterSelected) return;

    player.characterType = payload.characterType;
    player.characterSelected = true;

    // Send selection update chat
    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random()}`,
      senderName: 'System',
      senderId: 'system',
      text: `👤 ${player.name} selected ${payload.characterType.toUpperCase()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    checkCharacterSelectionComplete(room, io);
    return;
  }

  if (action === 'resolve-shot') {
    if (room.bowmastersPhase !== 'animating') return;

    // Verify authorization: only host can resolve the shot authoritatively
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || !sender.isHost) return;

    // Authoritative host reports results:
    // payload: { hits: [{targetId, damage, limb}], terrainDeform: {centerX, radius, depth}, movedPositions: [{id, x, y}] }
    const { hits = [], terrainDeform, fellOffMapIds = [], movedPositions = [] } = payload;

    // 1. Process Hits
    hits.forEach(hit => {
      const target = room.players.find(p => p.id === hit.targetId);
      if (target && target.alive) {
        target.hp = Math.max(0, target.hp - hit.damage);
        if (target.hp <= 0) {
          target.alive = false;
          io.to(room.code).emit('chat-message', {
            id: `sys_${Math.random()}`,
            senderName: 'System',
            senderId: 'system',
            text: `💀 ${target.name} was defeated!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          });
        } else {
          let hitMsg = `💥 ${target.name} took ${hit.damage} damage!`;
          if (hit.limb === 'head') hitMsg = `🎯 HEADSHOT! ${target.name} took ${hit.damage} damage!`;
          io.to(room.code).emit('chat-message', {
            id: `sys_${Math.random()}`,
            senderName: 'System',
            senderId: 'system',
            text: hitMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          });
        }
      }
    });

    // 2. Process off-map deaths
    fellOffMapIds.forEach(id => {
      const target = room.players.find(p => p.id === id);
      if (target && target.alive) {
        target.hp = 0;
        target.alive = false;
        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random()}`,
          senderName: 'System',
          senderId: 'system',
          text: `💀 ${target.name} fell off the battlefield!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      }
    });

    // 3. Process Terrain Deformation
    if (terrainDeform && room.bowmastersTerrain && room.bowmastersTerrain.length > 0) {
      room.bowmastersTerrain = deformServerTerrain(
        room.bowmastersTerrain,
        terrainDeform.centerX,
        terrainDeform.radius,
        terrainDeform.depth
      );
      // Let players know terrain deformed
      room.players.forEach(p => {
        if (p.alive) {
          const x = Math.floor(p.positionX);
          p.positionY = room.bowmastersTerrain[x];
        }
      });
    }

    // 4. Apply post-knockback positions reported by the host client
    if (movedPositions.length > 0) {
      movedPositions.forEach(mp => {
        const target = room.players.find(p => p.id === mp.id);
        if (target && target.alive) {
          target.positionX = mp.x;
          // Snap Y to terrain height at the new X position
          const x = Math.max(0, Math.min(room.bowmastersTerrain.length - 1, Math.floor(mp.x)));
          target.positionY = room.bowmastersTerrain[x];
        }
      });
    }

    // 5. Check Victory Conditions
    const teamAAlive = room.players.some(p => p.team === 'a' && p.alive);
    const teamBAlive = room.players.some(p => p.team === 'b' && p.alive);

    if (!teamAAlive || !teamBAlive) {
      room.gameState = 'gameover';
      room.bowmastersPhase = 'game_over';

      let winnerMsg = '';
      if (room.bowmastersMode === '2v2') {
        const winningTeam = teamAAlive ? 'a' : 'b';
        winnerMsg = `🏆 Team ${winningTeam.toUpperCase()} Wins the Battle!`;
        room.players.forEach(p => {
          p.finishRank = p.team === winningTeam ? 1 : 2;
          p.score = p.team === winningTeam ? 100 : 0;
        });
      } else {
        const winner = room.players.find(p => p.alive);
        winnerMsg = winner ? `🏆 ${winner.name} Wins the Battle!` : '🤝 Draw! Everyone is defeated.';
        room.players.forEach(p => {
          p.finishRank = p.alive ? 1 : 2;
          p.score = p.alive ? 100 : 0;
        });
      }

      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: winnerMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });

      io.to(room.code).emit('round-over', getSanitizedRoomState(room, ''));
      return;
    }

    // 6. Advance Turn Order to Next Alive Player
    let safetyCounter = 0;
    do {
      room.bowmastersTurnIdx = (room.bowmastersTurnIdx + 1) % room.bowmastersTurnOrder.length;
      safetyCounter++;
    } while (!room.players.find(p => p.id === room.bowmastersTurnOrder[room.bowmastersTurnIdx]).alive && safetyCounter < 10);

    // Generate new wind
    room.bowmastersWind = room.bowmastersWindEnabled ? (Math.round((Math.random() * 6 - 3) * 10) / 10) : 0;
    
    // Clear last shot, return to playing phase
    room.bowmastersLastShot = null;
    room.bowmastersPhase = 'playing';

    broadcastGameUpdate(room, io);
  } else {
    // Normal turn-based actions (e.g. fire)
    const activePlayerId = room.bowmastersTurnOrder[room.bowmastersTurnIdx];
    const activePlayer = room.players.find(p => p.id === activePlayerId);

    if (!activePlayer) return;

    // Verify authorization: is current active player, or is bot triggered by host
    const isAuthorized = activePlayer.id === socket.id || (activePlayer.isBot && room.players.find(p => p.id === socket.id)?.isHost);
    if (!isAuthorized) return;

    if (action === 'fire') {
      if (room.bowmastersPhase !== 'playing') return;

      const { angle, power } = payload;
      room.bowmastersPhase = 'animating';
      room.bowmastersLastShot = {
        playerId: activePlayer.id,
        angle,
        power,
        characterType: activePlayer.characterType
      };

      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random()}`,
        senderName: 'System',
        senderId: 'system',
        text: `🏹 ${activePlayer.name} fired a shot!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });

      broadcastGameUpdate(room, io);
    }
  }
}
