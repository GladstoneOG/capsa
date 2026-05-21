import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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
  socket.on('create-room', ({ playerName, avatar }) => {
    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room = {
      code: roomCode,
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
      rules: {
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
    console.log(`Room created: ${roomCode} by ${playerName}`);
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

    if (room.players.length >= 4) {
      socket.emit('join-error', 'Room is full (max 4 players).');
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
    if (!room || room.gameState !== 'lobby' || room.players.length >= 4) return;

    // Verify requesting player is Host
    const requestingPlayer = room.players.find(p => p.id === socket.id);
    if (!requestingPlayer?.isHost) return;

    const botNames = ['Budi Bot', 'Siti Bot', 'Joko Bot', 'Dewi Bot'];
    // Find unused bot name
    const existingNames = room.players.map(p => p.name);
    const botName = botNames.find(n => !existingNames.includes(n)) || `Bot ${room.players.length + 1}`;

    const botAvatars = [
      { skinColor: '#FFDBAC', hairStyle: 'spiky', hairColor: '#1A1A1A', expression: 'cool', clothesColor: '#2F855A' },
      { skinColor: '#F1C27D', hairStyle: 'bob', hairColor: '#E5C158', expression: 'smile', clothesColor: '#6B46C1' },
      { skinColor: '#E0AC69', hairStyle: 'short', hairColor: '#B83B1D', expression: 'excited', clothesColor: '#C53030' },
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

  // Helper to start the game round
  function startRound(room) {
    room.gameState = 'playing';
    room.roundNumber += 1;
    room.activePlay = null;
    room.lastPlayerPlayedId = null;

    // Deal cards (13 each)
    const deck = shuffle(createDeck());
    room.players.forEach((p, idx) => {
      p.cards = sortCards(deck.slice(idx * 13, (idx + 1) * 13));
      p.passed = false;
      p.lastPlay = null;
      delete p.finishRank;
      delete p.roundPoints;
    });

    // Find who has 3 of Diamonds (3♦) to start first
    let startIdx = 0;
    room.players.forEach((p, idx) => {
      const has3D = p.cards.some(c => c.rank === '3' && c.suit === 'D');
      if (has3D) {
        startIdx = idx;
      }
    });

    room.turnIndex = startIdx;
    
    // Broadcast round started. We send individual hands securely so players cannot see other hands
    room.players.forEach(p => {
      if (!p.isBot) {
        const clientSocket = io.sockets.sockets.get(p.id);
        if (clientSocket) {
          // Send specific player state with their actual cards, and only card counts for others
          const sanitizedRoomState = getSanitizedRoomState(room, p.id);
          clientSocket.emit('game-started', sanitizedRoomState);
        }
      }
    });

    // Send full state to host to coordinate bots
    const host = room.players.find(p => p.isHost);
    if (host && !host.isBot) {
      const hostSocket = io.sockets.sockets.get(host.id);
      if (hostSocket) {
        hostSocket.emit('bot-coordinator-sync', room);
      }
    }
  }

  // Sanitize room state: replace other players' cards with just the lengths for privacy
  function getSanitizedRoomState(room, socketId) {
    return {
      ...room,
      players: room.players.map(p => ({
        ...p,
        cards: p.id === socketId ? p.cards : Array(p.cards.length).fill(null), // hide cards unless it's the client's socket
        actualCardCount: p.cards.length,
      })),
    };
  }

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

    // Auto-fill empty slots with bots up to 4 players
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

    startRound(room);
  });

  // 8. Play Cards
  socket.on('play-cards', ({ roomCode, cards }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    const currentPlayer = room.players[room.turnIndex];
    
    // Safety check: is it really this player's turn?
    // In multiplayer, bots are played via the host, so we allow host to play on behalf of bot.
    const isBotTurn = currentPlayer.isBot;
    const isAuthorized = currentPlayer.id === socket.id || (isBotTurn && room.players.find(p => p.id === socket.id)?.isHost);
    
    if (!isAuthorized) return;

    // Remove played cards from player's hand
    const playedCardIds = cards.map(c => c.id);
    const remainingCards = currentPlayer.cards.filter(c => !playedCardIds.includes(c.id));
    currentPlayer.cards = remainingCards;
    currentPlayer.lastPlay = cards;
    currentPlayer.passed = false;

    // Count how many players have already finished
    const finishedCount = room.players.filter(p => p.finishRank !== undefined).length;
    if (remainingCards.length === 0) {
      currentPlayer.finishRank = finishedCount + 1;
    }

    // Update active play
    room.activePlay = {
      type: cards.length === 1 ? 'single' : cards.length === 2 ? 'pair' : cards.length === 3 ? 'tris' : 'unknown', // client calculates comboType
      cards: cards,
    };
    room.lastPlayerPlayedId = currentPlayer.id;

    // Send system play chat message
    const comboType = cards.length === 1 ? 'Single' : cards.length === 2 ? 'Pair' : cards.length === 3 ? 'Tris' : '5-Card Combination';
    io.to(roomCode).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `${currentPlayer.name} played ${comboType}: ${describeCards(cards)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    // Check if round should end (when only <= 1 players have cards left)
    const playersWithCards = room.players.filter(p => p.cards.length > 0);
    if (playersWithCards.length <= 1) {
      // Assign the last player the remaining rank
      room.players.forEach(p => {
        if (p.cards.length > 0 && p.finishRank === undefined) {
          p.finishRank = room.players.length;
        }
      });
      handleRoundOver(room);
      return;
    }

    // Check if trick is won: all other players with cards have passed
    const otherPlayersWithCards = room.players.filter(p => p.id !== currentPlayer.id && p.cards.length > 0);
    const allOthersPassed = otherPlayersWithCards.every(p => p.passed);

    if (allOthersPassed) {
      if (remainingCards.length === 0) {
        // Hibah / Gift: Clear active play and pass lead clockwise to next player with cards
        room.activePlay = null;
        room.lastPlayerPlayedId = null;

        room.players.forEach(p => {
          p.passed = false;
          p.lastPlay = null;
        });

        let nextIdx = room.turnIndex;
        let found = false;
        for (let i = 0; i < room.players.length; i++) {
          nextIdx = (nextIdx + 1) % room.players.length;
          if (room.players[nextIdx].cards.length > 0) {
            found = true;
            break;
          }
        }
        if (!found) {
          nextIdx = room.turnIndex;
        }
        room.turnIndex = nextIdx;

        const leadPlayerName = room.players[nextIdx].name;
        io.to(roomCode).emit('chat-message', {
          id: `sys_${Math.random().toString(36).substr(2, 9)}`,
          senderName: 'System',
          senderId: 'system',
          text: `Trick finished. ${currentPlayer.name} won the trick but has no cards left! Lead goes to ${leadPlayerName} (Hibah).`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      } else {
        // Trick won by the current player (who still has cards)
        room.activePlay = null;
        room.lastPlayerPlayedId = null;

        room.players.forEach(p => {
          p.passed = false;
          p.lastPlay = null;
        });

        // turnIndex remains currentPlayer's index (room.turnIndex)

        io.to(roomCode).emit('chat-message', {
          id: `sys_${Math.random().toString(36).substr(2, 9)}`,
          senderName: 'System',
          senderId: 'system',
          text: `Trick finished. ${currentPlayer.name} gets the lead!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      }
    } else {
      // Advance turn to next active player
      room.turnIndex = getNextTurnIndex(room.turnIndex, room.players);
    }

    broadcastGameUpdate(room);
  });

  // 9. Pass Turn
  socket.on('pass-turn', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.gameState !== 'playing') return;

    const currentPlayer = room.players[room.turnIndex];
    const isBotTurn = currentPlayer.isBot;
    const isAuthorized = currentPlayer.id === socket.id || (isBotTurn && room.players.find(p => p.id === socket.id)?.isHost);

    if (!isAuthorized) return;

    currentPlayer.passed = true;
    currentPlayer.lastPlay = null;

    io.to(roomCode).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `${currentPlayer.name} passed.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    // Check if everyone else has passed
    const activeCount = getActivePlayerCount(room.players);
    if (activeCount <= 1) {
      // Trick over! The last player who played cards wins the trick.
      const lastPlayerIdx = room.players.findIndex(p => p.id === room.lastPlayerPlayedId);
      const lastPlayer = room.players[lastPlayerIdx];
      const lastPlayerName = lastPlayer ? lastPlayer.name : 'Unknown';
      
      // Clear table
      room.activePlay = null;
      room.lastPlayerPlayedId = null;

      // Reset passed status for everyone who has cards left
      room.players.forEach(p => {
        p.passed = false;
        p.lastPlay = null;
      });

      // Set turn to trick winner. If trick winner has finished, find the next clockwise player who still has cards
      let nextIdx = lastPlayerIdx;
      if (nextIdx === -1 || room.players[nextIdx].cards.length === 0) {
        let searchIdx = lastPlayerIdx !== -1 ? lastPlayerIdx : room.turnIndex;
        let found = false;
        for (let i = 0; i < room.players.length; i++) {
          searchIdx = (searchIdx + 1) % room.players.length;
          if (room.players[searchIdx].cards.length > 0) {
            nextIdx = searchIdx;
            found = true;
            break;
          }
        }
        if (!found) {
          nextIdx = room.turnIndex;
        }
      }
      room.turnIndex = nextIdx;

      const leadPlayerName = room.players[nextIdx].name;

      io.to(roomCode).emit('chat-message', {
        id: `sys_${Math.random().toString(36).substr(2, 9)}`,
        senderName: 'System',
        senderId: 'system',
        text: lastPlayerIdx !== -1 && room.players[lastPlayerIdx].cards.length === 0
          ? `Trick finished. ${lastPlayerName} won the trick but has no cards left! Lead goes to ${leadPlayerName}.`
          : `Trick finished. ${lastPlayerName} gets the lead!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
    } else {
      // Trick continues: advance turn
      room.turnIndex = getNextTurnIndex(room.turnIndex, room.players);
    }

    broadcastGameUpdate(room);
  });

  // Broadcast game updates safely to all clients
  function broadcastGameUpdate(room) {
    room.players.forEach(p => {
      if (!p.isBot) {
        const clientSocket = io.sockets.sockets.get(p.id);
        if (clientSocket) {
          clientSocket.emit('game-updated', getSanitizedRoomState(room, p.id));
        }
      }
    });

    // Send full state to host to coordinate bots
    const host = room.players.find(p => p.isHost);
    if (host && !host.isBot) {
      const hostSocket = io.sockets.sockets.get(host.id);
      if (hostSocket) {
        hostSocket.emit('bot-coordinator-sync', room);
      }
    }
  }

  // Handle Round Over scoring
  function handleRoundOver(room) {
    room.gameState = 'roundover';

    // Find the player who finished first (finishRank === 1)
    const winner = room.players.find(p => p.finishRank === 1);
    const winnerName = winner ? winner.name : 'Unknown';

    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `🎉 ${winnerName} won the round! 🎉`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });
    
    // Calculate Points based on finishRank
    // 1st: 4 pts (if 4 players), 3 pts (if 3 players), 2 pts (if 2 players)
    // 2nd: 3 pts (if 4 players), 2 pts (if 3 players), 1 pt (if 2 players)
    // and so on.
    const numPlayers = room.players.length;
    room.players.forEach(p => {
      const rank = p.finishRank || numPlayers;
      const points = numPlayers - rank + 1;
      p.score += points;
      p.roundPoints = points; // points earned this round
    });

    // Check if anyone reached target points
    const winScore = room.rules.pointsToWin;
    const gameOver = room.players.some(p => p.score >= winScore);
    if (gameOver) {
      room.gameState = 'gameover';
    }

    io.to(room.code).emit('round-over', room);
  }

  // 10. Restart Game / Next Round
  socket.on('restart-game', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || (room.gameState !== 'roundover' && room.gameState !== 'gameover')) return;

    const host = room.players.find(p => p.isHost);
    if (host?.id !== socket.id) return;

    if (room.gameState === 'gameover') {
      // Reset scores for completely new game
      room.players.forEach(p => {
        p.score = 0;
        p.roundPoints = 0;
      });
    }

    startRound(room);
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
