import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as capsaEngine from './games/capsa.js';
import * as unoEngine from './games/uno.js';

const app = express();
app.use(cors());

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
});

const rooms = new Map();

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
  socket.on('create-room', ({ playerName, avatar, gameType }) => {
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
          cards: [],
          passed: false,
          score: 0,
          lastPlay: null,
        },
      ],
      rules: type === 'uno' ? {
        pointsToWin: 250,
        turnDuration: 30,
        stacking: true,
        jumpIn: true,
        sevenSwap: true,
        zeroRotate: true,
        drawTillPlay: false,
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

    socket.emit('room-created', { roomCode, room });
    console.log(`Room created: ${roomCode} (${type}) by ${playerName}`);
  });

  // 2. Join Room
  socket.on('join-room', ({ roomCode, playerName, avatar }) => {
    const code = roomCode?.toUpperCase();
    if (!rooms.has(code)) {
      socket.emit('join-error', 'Room not found.');
      return;
    }

    const room = rooms.get(code);
    if (room.gameState !== 'lobby') {
      socket.emit('join-error', 'Game already in progress.');
      return;
    }

    const maxPlayers = room.gameType === 'uno' ? 8 : 4;
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
      cards: [],
      passed: false,
      score: 0,
      lastPlay: null,
    };

    room.players.push(newPlayer);
    socket.join(code);

    io.to(code).emit('room-updated', room);
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

  // 3. Add AI Bot
  socket.on('add-bot', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const maxPlayers = room.gameType === 'uno' ? 8 : 4;
    if (room.players.length >= maxPlayers) return;

    // Verify requesting player is Host
    const requestingPlayer = room.players.find(p => p.id === socket.id);
    if (!requestingPlayer?.isHost) return;

    const botNames = ['Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot', 'Agus Bot', 'Sari Bot', 'Rudi Bot', 'Ani Bot'];
    // Find unused bot name
    const existingNames = room.players.map(p => p.name);
    const botName = botNames.find(n => !existingNames.includes(n)) || `Bot ${room.players.length + 1}`;

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
    io.to(roomCode).emit('room-updated', room);
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

      io.to(roomCode).emit('room-updated', room);
    }
  });

  // 5. Update Rules
  socket.on('update-rules', ({ roomCode, rules }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const requestingPlayer = room.players.find(p => p.id === socket.id);
    if (!requestingPlayer?.isHost) return;

    room.rules = { ...room.rules, ...rules };
    io.to(roomCode).emit('room-updated', room);
  });

  // 6. Toggle Ready
  socket.on('toggle-ready', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'lobby') return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      io.to(roomCode).emit('room-updated', room);
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

    if (room.gameType === 'uno') {
      if (room.players.length < 2) {
        socket.emit('start-error', 'Need at least 2 players to start Uno.');
        return;
      }
      unoEngine.startRound(room, io);
    } else {
      // Auto-fill empty slots with bots up to 4 players for Capsa Banting
      const botNames = ['Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot'];
      const botAvatars = [
        { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
        { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
        { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
      ];
      let botsAdded = false;

      while (room.players.length < 4) {
        const existingNames = room.players.map(p => p.name);
        const botName = botNames.find(n => !existingNames.includes(n)) || `Bot ${room.players.length + 1}`;
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
        io.to(roomCode).emit('room-updated', room);
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

    if (room.gameType === 'uno') {
      unoEngine.startRound(room, io);
    } else {
      capsaEngine.startRound(room, io);
    }
  });

  // 10.5 Send Chat Message
  socket.on('send-chat', ({ roomCode, message }) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(roomCode).emit('chat-message', {
      id: `msg_${Math.random().toString(36).substr(2, 9)}`,
      senderName: player.name,
      senderId: player.id,
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: false,
    });
  });

  // 11. Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find room the user was in
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const removedPlayer = room.players.splice(playerIndex, 1)[0];
        console.log(`Player ${removedPlayer.name} removed from room ${roomCode}`);

        if (room.players.length === 0 || room.players.every(p => p.isBot)) {
          // Close room if empty or only bots left
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (empty)`);
        } else {
          // If the player was host, assign next real player as host
          if (removedPlayer.isHost) {
            const nextRealPlayer = room.players.find(p => !p.isBot);
            if (nextRealPlayer) {
              nextRealPlayer.isHost = true;
              nextRealPlayer.isReady = true; // Host is always ready
              console.log(`New host assigned in room ${roomCode}: ${nextRealPlayer.name}`);
            }
          }

          // If game was playing, reset to lobby
          if (room.gameState === 'playing') {
            room.gameState = 'lobby';
            room.players.forEach(p => {
              p.cards = [];
              p.passed = false;
              p.score = 0;
            });
            io.to(roomCode).emit('game-aborted', 'A player disconnected. Returning to lobby.');
          }

          io.to(roomCode).emit('room-updated', room);

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

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Capsa Banting Server running on port ${PORT}`);
});
