import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import fs from 'fs';
import path from 'path';
import * as capsaEngine from './games/capsa.js';
import * as unoEngine from './games/uno.js';
import * as monopolyEngine from './games/monopoly.js';
import * as snakesLaddersEngine from './games/snakes_ladders.js';
import * as bowmastersEngine from './games/bowmasters.js';
import * as sumoEngine from './games/sumo.js';

const BOT_NAMES = [
  // Indonesian Names
  'Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot', 'Agus Bot', 
  'Sari Bot', 'Rudi Bot', 'Ani Bot', 'Aris Bot', 'Dewo Bot', 
  'Fitri Bot', 'Mega Bot', 'Candra Bot', 'Nugroho Bot', 'Putri Bot', 
  'Taufik Bot', 'Wulan Bot', 'Hendra Bot', 'Bambang Bot', 'Slamet Bot', 
  'Kartini Bot', 'Surya Bot', 'Guntur Bot', 'Indah Bot', 'Ratna Bot', 
  'Wira Bot', 'Eko Bot', 'Yanto Bot', 'Rian Bot', 'Laras Bot', 
  'Giri Bot', 'Hadi Bot', 'Indra Bot', 'Kartika Bot', 'Utami Bot',
  // Western Names
  'Alex Bot', 'Emma Bot', 'Liam Bot', 'Olivia Bot', 'Noah Bot', 
  'Sophia Bot', 'Logan Bot', 'Ava Bot', 'Lucas Bot', 'Mia Bot', 
  'Ethan Bot', 'Isabella Bot', 'Jackson Bot', 'Charlotte Bot', 'Oliver Bot', 
  'Amelia Bot', 'James Bot', 'Harper Bot', 'Benjamin Bot', 'Evelyn Bot', 
  'Leo Bot', 'Lily Bot', 'Max Bot', 'Zoe Bot', 'Sam Bot', 
  'Grace Bot', 'Jack Bot', 'Ruby Bot', 'Toby Bot', 'Chloe Bot'
];

const app = express();
app.use(cors());

// Serve static stickers from project root stickers/ folder
const stickersPath = path.join(process.cwd(), 'stickers');
if (!fs.existsSync(stickersPath)) {
  fs.mkdirSync(stickersPath, { recursive: true });
}
app.use('/stickers', express.static(stickersPath));

// API endpoint to list available stickers
app.get('/api/stickers', (req, res) => {
  fs.readdir(stickersPath, (err, files) => {
    if (err) {
      console.error('Error reading stickers directory:', err);
      return res.json([]);
    }
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const stickerUrls = files
      .filter(file => validExtensions.includes(path.extname(file).toLowerCase()))
      .map(file => `/stickers/${file}`);
    res.json(stickerUrls);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.send({ status: 'healthy' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*', // Allow dynamic Vercel frontend or local dev
    methods: ['GET', 'POST'],
  },
  transports: ['websocket'],
  pingInterval: 25000,
  pingTimeout: 60000,
});

const rooms = new Map();
const roomCleanupTimers = new Map();
const ROOM_RECONNECT_TTL_MS = 10 * 60 * 1000;

function getPublicRoomState(room) {
  return {
    ...room,
    players: room.players.map(p => {
      const { sessionId, ...publicPlayer } = p;
      return publicPlayer;
    }),
  };
}

function emitRoomUpdated(roomCode, room) {
  io.to(roomCode).emit('room-updated', getPublicRoomState(room));
}

function getRoomEngine(room) {
  if (room.gameType === 'monopoly') return monopolyEngine;
  if (room.gameType === 'snakes_ladders' || room.gameType === 'snakes-ladders') return snakesLaddersEngine;
  if (room.gameType === 'bowmasters') return bowmastersEngine;
  if (room.gameType === 'sumo') return sumoEngine;
  return room.gameType === 'uno' ? unoEngine : capsaEngine;
}

function broadcastCurrentRoomState(room) {
  if (room.gameState === 'playing') {
    getRoomEngine(room).broadcastGameUpdate(room, io);
  } else if (room.gameState === 'roundover' || room.gameState === 'gameover') {
    io.to(room.code).emit('round-over', getPublicRoomState(room));
  } else {
    emitRoomUpdated(room.code, room);
  }
}

function emitRoomSnapshotToSocket(room, socket) {
  if (room.gameState === 'playing') {
    socket.emit('room-resumed', getRoomEngine(room).getSanitizedRoomState(room, socket.id));
    return;
  }

  socket.emit('room-resumed', getPublicRoomState(room));
}

function clearRoomCleanup(roomCode) {
  const timer = roomCleanupTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(roomCode);
  }
}

function scheduleRoomCleanup(roomCode) {
  if (roomCleanupTimers.has(roomCode)) return;

  const timer = setTimeout(() => {
    const room = rooms.get(roomCode);
    const hasConnectedHuman = room?.players.some(p => !p.isBot && !p.disconnected);
    if (room && !hasConnectedHuman) {
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} deleted after reconnect timeout`);
    }
    roomCleanupTimers.delete(roomCode);
  }, ROOM_RECONNECT_TTL_MS);

  roomCleanupTimers.set(roomCode, timer);
}

function replacePlayerIdReferences(room, oldId, newId) {
  if (room.lastPlayerPlayedId === oldId) {
    room.lastPlayerPlayedId = newId;
  }
  if (room.bowmastersTurnOrder) {
    room.bowmastersTurnOrder = room.bowmastersTurnOrder.map(id => id === oldId ? newId : id);
  }
  if (room.bowmastersLastShot && room.bowmastersLastShot.playerId === oldId) {
    room.bowmastersLastShot.playerId = newId;
  }
  if (room.sevenSwappingPlayerId === oldId) {
    room.sevenSwappingPlayerId = newId;
  }
  if (room.lastSevenSwap?.requesterId === oldId) {
    room.lastSevenSwap.requesterId = newId;
  }
  if (room.lastSevenSwap?.targetId === oldId) {
    room.lastSevenSwap.targetId = newId;
  }
  if (room.monopolyBoard) {
    room.monopolyBoard.forEach(tile => {
      if (tile.owner === oldId) {
        tile.owner = newId;
      }
    });
  }
  if (room.sumoMoves && room.sumoMoves[oldId]) {
    room.sumoMoves[newId] = room.sumoMoves[oldId];
    delete room.sumoMoves[oldId];
  }
}

function findDisconnectedPlayer(room, sessionId) {
  if (!sessionId) return null;
  return room.players.find(p => p.sessionId === sessionId);
}

function restoreDisconnectedPlayer(room, roomCode, player, socket, { sessionId, playerName, avatar }) {
  clearRoomCleanup(roomCode);

  const oldId = player.id;
  player.id = socket.id;
  player.sessionId = sessionId;
  player.name = playerName || player.name;
  if (avatar) {
    player.avatar = avatar;
  }
  player.isBot = false;
  player.isReady = true;
  player.disconnected = false;
  delete player.disconnectedAt;
  replacePlayerIdReferences(room, oldId, socket.id);

  const connectedHost = room.players.find(p => p.isHost && !p.isBot && !p.disconnected);
  if (!connectedHost) {
    player.isHost = true;
  }

  socket.join(roomCode);
  emitRoomSnapshotToSocket(room, socket);
  broadcastCurrentRoomState(room);

  io.to(roomCode).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `${player.name} rejoined the room.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to shuffle cards on server (so clients don't cheat / know cards)
function createDeck() {
  const suits = ['D', 'C', 'H', 'S'];
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  for (const r of ranks) {
    for (const s of suits) {
      deck.push({ id: `${r}_${s}`, rank: r, suit: s });
    }
  }
  return deck;
}

function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SUIT_ORDER = { D: 0, C: 1, H: 2, S: 3 };
const RANK_ORDER = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6,
  '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12
};

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    const diff = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (diff !== 0) return diff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

function describeCards(cards) {
  const suitSymbols = { D: '♦', C: '♣', H: '♥', S: '♠' };
  return cards.map(c => `${c.rank}${suitSymbols[c.suit]}`).join(' ');
}


// Find next active player index clockwise
function getNextTurnIndex(currentIndex, players) {
  let idx = currentIndex;
  for (let i = 0; i < players.length; i++) {
    idx = (idx + 1) % players.length;
    // Next player must not have passed and must have cards
    if (!players[idx].passed && players[idx].cards.length > 0) {
      return idx;
    }
  }
  return currentIndex;
}

// Check how many players have NOT passed and still have cards
function getActivePlayerCount(players) {
  return players.filter(p => !p.passed && p.cards.length > 0).length;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create-room', ({ playerName, avatar, gameType, sessionId }) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const type = gameType || 'capsa';

    const room = {
      code: roomCode,
      gameType: type,
      players: [
        {
          id: socket.id,
          name: playerName || 'Host',
          avatar,
          isHost: true,
          isReady: true,
          isBot: false,
          sessionId,
          cards: [],
          passed: false,
          score: 0,
          lastPlay: null,
        },
      ],
      rules: type === 'monopoly' ? {
        pointsToWin: 0,
        ruleset: 'Default',
        turnDuration: 30,
        startingCash: 1500,
        turnLimit: 0
      } : type === 'uno' ? {
        pointsToWin: 250,
        turnDuration: 30,
        stacking: true,
        jumpIn: true,
        sevenSwap: true,
        zeroRotate: true,
        drawTillPlay: true,
      } : (type === 'snakes_ladders' || type === 'snakes-ladders') ? {
        pointsToWin: 100,
        rollSixBonus: true
      } : type === 'bowmasters' ? {
        mode: '1v1',
        windEnabled: true,
      } : type === 'sumo' ? {
        turnDuration: 10,
        arenaRadius: 300,
        shrinkingArena: true,
        bumpersCount: 2,
      } : {
        pointsToWin: 15,
        turnDuration: 30, // 30 seconds
        enableBombsSingle: true,
        enableBombsPair: true,
      },
      gameState: 'lobby', // 'lobby' | 'playing' | 'roundover' | 'gameover'
      activePlay: null,
      lastPlayerPlayedId: null,
      turnIndex: 0,
      roundNumber: 0,
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room-created', { roomCode, room: getPublicRoomState(room) });
    console.log(`Room created: ${roomCode} (${type}) by ${playerName}`);
  });

  // 2. Join Room
  socket.on('join-room', ({ roomCode, playerName, avatar, sessionId }) => {
    const code = roomCode?.toUpperCase();
    if (!rooms.has(code)) {
      socket.emit('join-error', 'Room not found.');
      return;
    }

    const room = rooms.get(code);
    const disconnectedPlayer = findDisconnectedPlayer(room, sessionId);
    if (disconnectedPlayer) {
      restoreDisconnectedPlayer(room, code, disconnectedPlayer, socket, { sessionId, playerName, avatar });
      return;
    }

    if (room.gameState !== 'lobby') {
      socket.emit('join-error', 'Game already in progress.');
      return;
    }

    const maxPlayers = (room.gameType === 'uno' || room.gameType === 'sumo') ? 8 : 4;
    if (room.players.length >= maxPlayers) {
      socket.emit('join-error', `Room is full (max ${maxPlayers} players).`);
      return;
    }

    const newPlayer = {
      id: socket.id,
      name: playerName || `Player ${room.players.length + 1}`,
      avatar,
      isHost: false,
      isReady: false,
      isBot: false,
      sessionId,
      cards: [],
      passed: false,
      score: 0,
      lastPlay: null,
    };

    room.players.push(newPlayer);
    socket.join(code);

    socket.emit('room-joined', { roomCode: code, room: getPublicRoomState(room) });
    emitRoomUpdated(code, room);
    console.log(`User ${playerName} joined room ${code}`);

    io.to(code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `${newPlayer.name} joined the lobby.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });
  });

  socket.on('resume-room', ({ roomCode, playerName, avatar, sessionId }) => {
    const code = roomCode?.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      socket.emit('join-error', 'Room not found.');
      return;
    }

    const disconnectedPlayer = findDisconnectedPlayer(room, sessionId);
    if (disconnectedPlayer) {
      restoreDisconnectedPlayer(room, code, disconnectedPlayer, socket, { sessionId, playerName, avatar });
    } else {
      socket.emit('join-error', 'Session not found in room.');
    }
  });

  // 3. Add AI Bot
  socket.on('add-bot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const maxPlayers = (room.gameType === 'uno' || room.gameType === 'sumo') ? 8 : 4;
    if (room.players.length >= maxPlayers) return;

    // Verify requesting player is Host
    const requestingPlayer = room.players.find(p => p.id === socket.id);
    if (!requestingPlayer?.isHost) return;

    // Find unused bot name
    const existingNames = room.players.map(p => p.name);
    const unusedNames = BOT_NAMES.filter(n => !existingNames.includes(n));
    const botName = unusedNames.length > 0 
      ? unusedNames[Math.floor(Math.random() * unusedNames.length)] 
      : `Bot ${room.players.length + 1}`;

    const botAvatars = [
      { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
      { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
      { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
      { skinColor: '#F1C27D', hairStyle: 'dreads', hairColor: '#4A5568', expression: 'wink', clothesColor: '#3182CE' },
    ];
    const botAvatar = botAvatars[room.players.length % botAvatars.length];

    const bot = {
      id: `bot_${Math.random().toString(36).substr(2, 9)}`,
      name: botName,
      avatar: botAvatar,
      isHost: false,
      isReady: true,
      isBot: true,
      cards: [],
      passed: false,
      score: 0,
      lastPlay: null,
    };

    room.players.push(bot);
    emitRoomUpdated(roomCode, room);
  });

  // 4. Remove Player / Bot
  socket.on('kick-player', ({ roomCode, playerId }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const requestingPlayer = room.players.find(p => p.id === socket.id);
    if (!requestingPlayer?.isHost) return;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const removed = room.players.splice(playerIndex, 1)[0];
      
      // If it's a real player, disconnect socket from room
      const clientSocket = io.sockets.sockets.get(playerId);
      if (clientSocket) {
        clientSocket.leave(roomCode);
        clientSocket.emit('kicked');
      }

      emitRoomUpdated(roomCode, room);
    }
  });

  // 5. Update Rules
  socket.on('update-rules', ({ roomCode, rules }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const requestingPlayer = room.players.find(p => p.id === socket.id);
    if (!requestingPlayer?.isHost) return;

    room.rules = { ...room.rules, ...rules };
    emitRoomUpdated(roomCode, room);
  });

  // 6. Toggle Ready
  socket.on('toggle-ready', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      emitRoomUpdated(roomCode, room);
    }
  });

  // 7. Start Game
  socket.on('start-game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const host = room.players.find(p => p.isHost);
    if (host?.id !== socket.id) return; // Only host can start

    // Check if everyone is ready
    const allReady = room.players.every(p => p.isReady);
    if (!allReady) {
      socket.emit('start-error', 'All players must be ready.');
      return;
    }

    if (room.gameType === 'monopoly') {
      if (room.players.length < 2) {
        socket.emit('start-error', 'Need at least 2 players to start Monopoly.');
        return;
      }
      monopolyEngine.startRound(room, io);
    } else if (room.gameType === 'uno') {
      if (room.players.length < 2) {
        socket.emit('start-error', 'Need at least 2 players to start Uno.');
        return;
      }
      unoEngine.startRound(room, io);
    } else if (room.gameType === 'bowmasters') {
      const requiredPlayers = room.rules?.mode === '2v2' ? 4 : 2;
      const botAvatars = [
        { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
        { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
        { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
        { skinColor: '#F1C27D', hairStyle: 'dreads', hairColor: '#4A5568', expression: 'wink', clothesColor: '#3182CE' },
      ];
      let botsAdded = false;

      while (room.players.length < requiredPlayers) {
        const existingNames = room.players.map(p => p.name);
        const unusedNames = BOT_NAMES.filter(n => !existingNames.includes(n));
        const botName = unusedNames.length > 0 
          ? unusedNames[Math.floor(Math.random() * unusedNames.length)] 
          : `Bot ${room.players.length + 1}`;
        const botAvatar = botAvatars[room.players.length % botAvatars.length];
        
        const bot = {
          id: `bot_${Math.random().toString(36).substr(2, 9)}`,
          name: botName,
          avatar: botAvatar,
          isHost: false,
          isReady: true,
          isBot: true,
          cards: [],
          passed: false,
          score: 0,
          lastPlay: null,
        };
        room.players.push(bot);
        botsAdded = true;
      }

      if (botsAdded) {
        emitRoomUpdated(roomCode, room);
      }

      bowmastersEngine.startRound(room, io);
    } else if (room.gameType === 'sumo') {
      const requiredPlayers = 2;
      let botsAdded = false;
      const botAvatars = [
        { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
        { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
        { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
        { skinColor: '#F1C27D', hairStyle: 'dreads', hairColor: '#4A5568', expression: 'wink', clothesColor: '#3182CE' },
      ];
      while (room.players.length < requiredPlayers) {
        const existingNames = room.players.map(p => p.name);
        const unusedNames = BOT_NAMES.filter(n => !existingNames.includes(n));
        const botName = unusedNames.length > 0 
          ? unusedNames[Math.floor(Math.random() * unusedNames.length)] 
          : `Bot ${room.players.length + 1}`;
        const botAvatar = botAvatars[room.players.length % botAvatars.length];
        
        const bot = {
          id: `bot_${Math.random().toString(36).substr(2, 9)}`,
          name: botName,
          avatar: botAvatar,
          isHost: false,
          isReady: true,
          isBot: true,
          cards: [],
          passed: false,
          score: 0,
          lastPlay: null,
        };
        room.players.push(bot);
        botsAdded = true;
      }

      if (botsAdded) {
        emitRoomUpdated(roomCode, room);
      }

      sumoEngine.startRound(room, io);
    } else if (room.gameType === 'snakes_ladders' || room.gameType === 'snakes-ladders') {
      if (room.players.length < 2) {
        socket.emit('start-error', 'Need at least 2 players to start Snakes & Ladders.');
        return;
      }
      snakesLaddersEngine.startRound(room, io);
    } else {
      // Auto-fill empty slots with bots up to 4 players for Capsa Banting
      const botAvatars = [
        { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
        { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
        { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
      ];
      let botsAdded = false;

      while (room.players.length < 4) {
        const existingNames = room.players.map(p => p.name);
        const unusedNames = BOT_NAMES.filter(n => !existingNames.includes(n));
        const botName = unusedNames.length > 0 
          ? unusedNames[Math.floor(Math.random() * unusedNames.length)] 
          : `Bot ${room.players.length + 1}`;
        const botAvatar = botAvatars[room.players.length % botAvatars.length];
        
        const bot = {
          id: `bot_${Math.random().toString(36).substr(2, 9)}`,
          name: botName,
          avatar: botAvatar,
          isHost: false,
          isReady: true,
          isBot: true,
          cards: [],
          passed: false,
          score: 0,
          lastPlay: null,
        };
        room.players.push(bot);
        botsAdded = true;
      }

      if (botsAdded) {
        emitRoomUpdated(roomCode, room);
      }

      capsaEngine.startRound(room, io);
    }
  });

  // 8. Play Cards (Unified/Delegated)
  socket.on('play-cards', ({ roomCode, cards, comboType }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    if (room.gameType === 'uno') {
      unoEngine.playCard(room, socket, { cards, chosenColor: cards[0]?.color, isJumpIn: false }, io);
    } else {
      capsaEngine.playCards(room, socket, { cards, comboType }, io);
    }
  });

  // 8.5 Uno specific handlers
  socket.on('play-card', ({ roomCode, cards, chosenColor, isJumpIn }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'uno') {
      unoEngine.playCard(room, socket, { cards, chosenColor, isJumpIn }, io);
    }
  });

  socket.on('draw-card', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'uno') {
      unoEngine.drawCard(room, socket, io);
    }
  });

  socket.on('uno-call', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'uno') {
      unoEngine.unoCall(room, socket, io);
    }
  });

  socket.on('uno-challenge', ({ roomCode, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'uno') {
      unoEngine.unoChallenge(room, socket, { targetPlayerId }, io);
    }
  });

  socket.on('swap-hand', ({ roomCode, targetPlayerId }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'uno') {
      unoEngine.swapHand(room, socket, { targetPlayerId }, io);
    }
  });

  // 9. Pass Turn
  socket.on('pass-turn', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    if (room.gameType === 'uno') {
      unoEngine.passTurn(room, socket, io);
    } else {
      capsaEngine.passTurn(room, socket, io);
    }
  });

  socket.on('monopoly-action', ({ roomCode, action, payload }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'monopoly') {
      monopolyEngine.handleAction(room, socket, action, payload, io);
    }
  });

  socket.on('snakes-ladders-action', ({ roomCode, action, payload }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'snakes_ladders' || room.gameType === 'snakes-ladders') {
      snakesLaddersEngine.handleAction(room, socket, action, payload, io);
    }
  });

  socket.on('bowmasters-action', ({ roomCode, action, payload }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'bowmasters') {
      bowmastersEngine.handleAction(room, socket, action, payload, io);
    }
  });

  socket.on('sumo-action', ({ roomCode, action, payload }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;
    if (room.gameType === 'sumo') {
      sumoEngine.handleAction(room, socket, action, payload, io);
    }
  });

  // 10. Restart Game / Next Round
  socket.on('restart-game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || (room.gameState !== 'roundover' && room.gameState !== 'gameover')) return;

    const host = room.players.find(p => p.isHost);
    if (host?.id !== socket.id) return;

    if (room.gameState === 'gameover') {
      room.players.forEach(p => {
        p.score = 0;
        p.roundPoints = 0;
      });
    }

    if (room.gameType === 'monopoly') {
      monopolyEngine.startRound(room, io);
    } else if (room.gameType === 'uno') {
      unoEngine.startRound(room, io);
    } else if (room.gameType === 'snakes_ladders' || room.gameType === 'snakes-ladders') {
      snakesLaddersEngine.startRound(room, io);
    } else if (room.gameType === 'bowmasters') {
      bowmastersEngine.startRound(room, io);
    } else if (room.gameType === 'sumo') {
      sumoEngine.startRound(room, io);
    } else {
      capsaEngine.startRound(room, io);
    }
  });

  // 10.5 Send Chat Message
  socket.on('send-chat', ({ roomCode, message, type, stickerUrl }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(roomCode).emit('chat-message', {
      id: `msg_${Math.random().toString(36).substr(2, 9)}`,
      senderName: player.name,
      senderId: player.id,
      text: message || '',
      type: type || 'text',
      stickerUrl: stickerUrl || null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: false,
      isAuto: false,
    });
  });

  // 11. Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find room the user was in
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        const shouldKeepSeat = room.gameState !== 'lobby' && !player.isBot;

        if (shouldKeepSeat) {
          player.isBot = true;
          player.isReady = true;
          player.disconnected = true;
          player.disconnectedAt = Date.now();
          console.log(`Player ${player.name} disconnected from room ${roomCode}; temporary bot enabled`);

          if (player.isHost) {
            player.isHost = false;
            const nextRealPlayer = room.players.find((p, idx) => idx !== playerIndex && !p.isBot && !p.disconnected);
            if (nextRealPlayer) {
              nextRealPlayer.isHost = true;
              nextRealPlayer.isReady = true;
              console.log(`New host assigned in room ${roomCode}: ${nextRealPlayer.name}`);
            }
          }

          const hasConnectedHuman = room.players.some(p => !p.isBot && !p.disconnected);
          if (hasConnectedHuman) {
            clearRoomCleanup(roomCode);
          } else {
            scheduleRoomCleanup(roomCode);
          }

          broadcastCurrentRoomState(room);

          io.to(roomCode).emit('chat-message', {
            id: `sys_${Math.random().toString(36).substr(2, 9)}`,
            senderName: 'System',
            senderId: 'system',
            text: `${player.name} disconnected. A bot will play this seat until they rejoin.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          });
          break;
        }

        const removedPlayer = room.players.splice(playerIndex, 1)[0];
        console.log(`Player ${removedPlayer.name} removed from room ${roomCode}`);

        if (room.players.length === 0 || room.players.every(p => p.isBot && !p.disconnected)) {
          // Close room if empty or only bots left
          clearRoomCleanup(roomCode);
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          // If the player was host, assign next real player as host
          if (removedPlayer.isHost) {
            const nextRealPlayer = room.players.find(p => !p.isBot && !p.disconnected);
            if (nextRealPlayer) {
              nextRealPlayer.isHost = true;
              nextRealPlayer.isReady = true; // Host is always ready
              console.log(`New host assigned in room ${roomCode}: ${nextRealPlayer.name}`);
            }
          }

          emitRoomUpdated(roomCode, room);

          io.to(roomCode).emit('chat-message', {
            id: `sys_${Math.random().toString(36).substr(2, 9)}`,
            senderName: 'System',
            senderId: 'system',
            text: `${removedPlayer.name} has left the room.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true,
          });
        }
        break;
      }
    }
  });
});

function getLocalIpAddresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({ interface: name, address: net.address });
      }
    }
  }
  return addresses;
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`Capsa Banting Server running on:`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  if (ips.length > 0) {
    console.log(`  - Network (Active IPs):`);
    ips.forEach(ip => {
      console.log(`    * [${ip.interface}] http://${ip.address}:${PORT}`);
    });
  }
});
