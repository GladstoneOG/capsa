// Capsa Banting Backend Engine

const SUIT_ORDER = { D: 0, C: 1, H: 2, S: 3 };
const RANK_ORDER = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6,
  '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12
};

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

function getNextTurnIndex(currentIndex, players) {
  let idx = currentIndex;
  for (let i = 0; i < players.length; i++) {
    idx = (idx + 1) % players.length;
    if (!players[idx].passed && players[idx].cards.length > 0) {
      return idx;
    }
  }
  return currentIndex;
}

function getActivePlayerCount(players) {
  return players.filter(p => !p.passed && p.cards.length > 0).length;
}

function getPublicPlayerState(player) {
  const { sessionId, ...publicPlayer } = player;
  return publicPlayer;
}

function getPublicRoomState(room) {
  return {
    ...room,
    players: room.players.map(getPublicPlayerState),
  };
}

function isFirstPlayOfRound(room) {
  return !room.activePlay && room.players.every(p => p.cards.length === 13);
}

function contains3Diamonds(cards) {
  return cards.some(c => c.rank === '3' && c.suit === 'D');
}

export function getSanitizedRoomState(room, socketId) {
  return {
    ...room,
    players: room.players.map(p => {
      const publicPlayer = getPublicPlayerState(p);
      return {
        ...publicPlayer,
        cards: p.id === socketId ? p.cards : Array(p.cards.length).fill(null),
        actualCardCount: p.cards.length,
      };
    }),
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
      hostSocket.emit('bot-coordinator-sync', getPublicRoomState(room));
    }
  }
}

export function startRound(room, io) {
  room.gameState = 'playing';
  room.roundNumber += 1;
  room.activePlay = null;
  room.lastPlayerPlayedId = null;

  const deck = shuffle(createDeck());
  room.players.forEach((p, idx) => {
    p.cards = sortCards(deck.slice(idx * 13, (idx + 1) * 13));
    p.passed = false;
    p.lastPlay = null;
    delete p.finishRank;
    delete p.roundPoints;
  });

  let startIdx = 0;
  room.players.forEach((p, idx) => {
    const has3D = p.cards.some(c => c.rank === '3' && c.suit === 'D');
    if (has3D) {
      startIdx = idx;
    }
  });

  room.turnIndex = startIdx;

  room.players.forEach(p => {
    if (!p.isBot) {
      const clientSocket = io.sockets.sockets.get(p.id);
      if (clientSocket) {
        clientSocket.emit('game-started', getSanitizedRoomState(room, p.id));
      }
    }
  });

  const host = room.players.find(p => p.isHost);
  if (host && !host.isBot) {
    const hostSocket = io.sockets.sockets.get(host.id);
    if (hostSocket) {
      hostSocket.emit('bot-coordinator-sync', getPublicRoomState(room));
    }
  }
}

function handleRoundOver(room, io) {
  room.gameState = 'roundover';

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

  const numPlayers = room.players.length;
  room.players.forEach(p => {
    const rank = p.finishRank || numPlayers;
    const points = numPlayers - rank + 1;
    p.score += points;
    p.roundPoints = points;
  });

  const winScore = room.rules.pointsToWin;
  const gameOver = room.players.some(p => p.score >= winScore);
  if (gameOver) {
    room.gameState = 'gameover';
  }

  io.to(room.code).emit('round-over', getPublicRoomState(room));
}

export function playCards(room, socket, { cards, comboType }, io) {
  const currentPlayer = room.players[room.turnIndex];
  const isBotTurn = currentPlayer.isBot;
  const isAuthorized = currentPlayer.id === socket.id || (isBotTurn && room.players.find(p => p.id === socket.id)?.isHost);

  if (!isAuthorized) return;
  if (!cards?.length) return;
  if (isFirstPlayOfRound(room) && !contains3Diamonds(cards)) return;

  const playedCardIds = cards.map(c => c.id);
  const remainingCards = currentPlayer.cards.filter(c => !playedCardIds.includes(c.id));
  currentPlayer.cards = remainingCards;
  currentPlayer.lastPlay = cards;
  currentPlayer.passed = false;

  const finishedCount = room.players.filter(p => p.finishRank !== undefined).length;
  if (remainingCards.length === 0) {
    currentPlayer.finishRank = finishedCount + 1;
  }

  room.activePlay = {
    type: comboType || (cards.length === 1 ? 'single' : cards.length === 2 ? 'pair' : cards.length === 3 ? 'tris' : 'unknown'),
    cards: cards,
  };
  room.lastPlayerPlayedId = currentPlayer.id;

  const comboNames = {
    single: 'Single',
    pair: 'Pair',
    tris: 'Tris',
    straight: 'Straight',
    flush: 'Flush',
    fullhouse: 'Full House',
    bomber: 'Bomber',
    straightflush: 'Straight Flush'
  };
  const comboTypeName = comboNames[comboType] || (cards.length === 1 ? 'Single' : cards.length === 2 ? 'Pair' : cards.length === 3 ? 'Tris' : '5-Card Combination');
  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `${currentPlayer.name} played ${comboTypeName}: ${describeCards(cards)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  const playersWithCards = room.players.filter(p => p.cards.length > 0);
  if (playersWithCards.length <= 1) {
    room.players.forEach(p => {
      if (p.cards.length > 0 && p.finishRank === undefined) {
        p.finishRank = room.players.length;
      }
    });
    handleRoundOver(room, io);
    return;
  }

  const otherPlayersWithCards = room.players.filter(p => p.id !== currentPlayer.id && p.cards.length > 0);
  const allOthersPassed = otherPlayersWithCards.every(p => p.passed);

  if (allOthersPassed) {
    if (remainingCards.length === 0) {
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
      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random().toString(36).substr(2, 9)}`,
        senderName: 'System',
        senderId: 'system',
        text: `Trick finished. ${currentPlayer.name} won the trick but has no cards left! Lead goes to ${leadPlayerName} (Hibah).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
    } else {
      room.activePlay = null;
      room.lastPlayerPlayedId = null;

      room.players.forEach(p => {
        p.passed = false;
        p.lastPlay = null;
      });

      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random().toString(36).substr(2, 9)}`,
        senderName: 'System',
        senderId: 'system',
        text: `Trick finished. ${currentPlayer.name} gets the lead!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
    }
  } else {
    room.turnIndex = getNextTurnIndex(room.turnIndex, room.players);
  }

  broadcastGameUpdate(room, io);
}

export function passTurn(room, socket, io) {
  const currentPlayer = room.players[room.turnIndex];
  const isBotTurn = currentPlayer.isBot;
  const isAuthorized = currentPlayer.id === socket.id || (isBotTurn && room.players.find(p => p.id === socket.id)?.isHost);

  if (!isAuthorized) return;
  if (isFirstPlayOfRound(room)) return;

  currentPlayer.passed = true;
  currentPlayer.lastPlay = null;

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `${currentPlayer.name} passed.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  const activeCount = getActivePlayerCount(room.players);
  if (activeCount <= 1) {
    const lastPlayerIdx = room.players.findIndex(p => p.id === room.lastPlayerPlayedId);
    const lastPlayer = room.players[lastPlayerIdx];
    const lastPlayerName = lastPlayer ? lastPlayer.name : 'Unknown';

    room.activePlay = null;
    room.lastPlayerPlayedId = null;

    room.players.forEach(p => {
      p.passed = false;
      p.lastPlay = null;
    });

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

    io.to(room.code).emit('chat-message', {
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
    room.turnIndex = getNextTurnIndex(room.turnIndex, room.players);
  }

  broadcastGameUpdate(room, io);
}
