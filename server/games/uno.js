// Uno Backend Engine

function createUnoDeck() {
  const colors = ['red', 'yellow', 'green', 'blue'];
  const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
  const deck = [];

  // Generate card colors
  for (const color of colors) {
    // One '0' card per color
    deck.push({ id: `uno_${color}_0`, color, value: '0' });

    // Two of '1'-'9', skip, reverse, draw2
    for (let i = 1; i < values.length; i++) {
      const val = values[i];
      deck.push({ id: `uno_${color}_${val}_a`, color, value: val });
      deck.push({ id: `uno_${color}_${val}_b`, color, value: val });
    }
  }

  // 4 Wilds and 4 Wild Draw Fours (+4)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `uno_wild_${i}`, color: 'wild', value: 'wild' });
    deck.push({ id: `uno_wild4_${i}`, color: 'wild', value: 'wild4' });
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

export function getSanitizedRoomState(room, socketId) {
  return {
    ...room,
    players: room.players.map(p => ({
      ...p,
      cards: p.id === socketId ? p.cards : Array(p.cards.length).fill(null),
      actualCardCount: p.cards.length,
    })),
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

// Get index of the next player in direction of play
function getNextPlayerIndex(currentIndex, numPlayers, direction) {
  return (currentIndex + direction + numPlayers) % numPlayers;
}

export function startRound(room, io) {
  room.gameState = 'playing';
  room.roundNumber += 1;
  room.playDirection = 1; // 1 = Clockwise, -1 = Counter-Clockwise
  room.accumulatedDrawCount = 0;
  room.sevenSwappingPlayerId = null;
  room.lastSevenSwap = null;

  let deck = shuffle(createUnoDeck());

  // Deal 7 cards to each player
  room.players.forEach((p) => {
    p.cards = deck.splice(0, 7);
    p.passed = false;
    p.lastPlay = null;
    p.safeUno = false;
    delete p.finishRank;
    delete p.roundPoints;
  });

  room.drawPile = deck;
  room.discardPile = [];

  // Flip starting card
  let startingCard = room.drawPile.pop();
  
  // Wild Draw 4 cannot be the starting card. Put it back, shuffle, draw another.
  while (startingCard.value === 'wild4') {
    room.drawPile.push(startingCard);
    room.drawPile = shuffle(room.drawPile);
    startingCard = room.drawPile.pop();
  }

  room.discardPile.push(startingCard);
  room.currentValue = startingCard.value;
  
  if (startingCard.color === 'wild') {
    // Choose random starting color for Wild
    room.currentColor = ['red', 'yellow', 'green', 'blue'][Math.floor(Math.random() * 4)];
  } else {
    room.currentColor = startingCard.color;
  }

  // Set initial turn
  let currentTurn = 0;
  room.turnIndex = currentTurn;

  // Emit starting message
  const cardNames = {
    skip: 'Skip',
    reverse: 'Reverse',
    draw2: 'Draw Two (+2)',
    wild: 'Wild',
    wild4: 'Wild Draw Four (+4)'
  };
  const startCardDesc = startingCard.color === 'wild' 
    ? `Wild (Chosen Color: ${room.currentColor.toUpperCase()})`
    : `${startingCard.color.toUpperCase()} ${cardNames[startingCard.value] || startingCard.value}`;
  
  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `Game started! Starting card is ${startCardDesc}.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Apply starting card actions
  if (startingCard.value === 'reverse') {
    room.playDirection = -1;
    // In 2 player games, Reverse skips the first player
    if (room.players.length === 2) {
      room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
    }
  } else if (startingCard.value === 'skip') {
    room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
  } else if (startingCard.value === 'draw2') {
    if (room.rules.stacking) {
      room.accumulatedDrawCount = 2;
    } else {
      // First player immediately draws 2 cards and skips turn
      const firstPlayer = room.players[0];
      firstPlayer.cards.push(...room.drawPile.splice(0, 2));
      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random().toString(36).substr(2, 9)}`,
        senderName: 'System',
        senderId: 'system',
        text: `${firstPlayer.name} drew 2 cards from starting Draw Two and turn is skipped.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
      room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
    }
  }

  // Send starts securely
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
      hostSocket.emit('bot-coordinator-sync', room);
    }
  }
}

function handleRoundOver(room, io) {
  room.gameState = 'roundover';

  const winner = room.players.find(p => p.cards.length === 0);
  const winnerName = winner ? winner.name : 'Unknown';

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `🎉 ${winnerName} won the round! 🎉`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Calculate points: winner gets the sum of card values remaining in other hands
  let roundPoints = 0;
  room.players.forEach(p => {
    if (p.id !== winner.id) {
      let handPoints = 0;
      p.cards.forEach(c => {
        if (c.color === 'wild') {
          handPoints += 50; // Wild and Wild Draw Four
        } else if (['skip', 'reverse', 'draw2'].includes(c.value)) {
          handPoints += 20; // Action cards
        } else {
          handPoints += parseInt(c.value, 10); // Number cards (0-9)
        }
      });
      p.roundPoints = 0;
      roundPoints += handPoints;
    }
  });

  winner.roundPoints = roundPoints;
  winner.score += roundPoints;

  const winScore = room.rules.pointsToWin || 250;
  const gameOver = room.players.some(p => p.score >= winScore);
  if (gameOver) {
    room.gameState = 'gameover';
  }

  io.to(room.code).emit('round-over', room);
}

export function drawCard(room, socket, io) {
  const currentPlayer = room.players[room.turnIndex];
  const isBotTurn = currentPlayer.isBot;
  const isAuthorized = currentPlayer.id === socket.id || (isBotTurn && room.players.find(p => p.id === socket.id)?.isHost);

  if (!isAuthorized) return;

  // Make sure deck has cards
  if (room.drawPile.length < 5) {
    const topCard = room.discardPile.pop();
    room.drawPile.push(...room.discardPile);
    room.drawPile = shuffle(room.drawPile);
    room.discardPile = [topCard];
  }

  // 1. Stacking penalty draw
  if (room.accumulatedDrawCount > 0) {
    const drawCount = room.accumulatedDrawCount;
    const drawn = room.drawPile.splice(0, drawCount);
    currentPlayer.cards.push(...drawn);
    currentPlayer.safeUno = false;
    room.accumulatedDrawCount = 0;

    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `${currentPlayer.name} drew ${drawCount} cards (stack penalty) and turn is skipped.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
    broadcastGameUpdate(room, io);
    return;
  }

  // 2. Normal draw
  if (room.rules.drawTillPlay) {
    // Keep drawing until finding a playable card
    let drawnCards = [];
    let foundPlayable = false;

    while (!foundPlayable && room.drawPile.length > 0) {
      const card = room.drawPile.pop();
      drawnCards.push(card);
      
      const matchesColor = card.color === 'wild' || card.color === room.currentColor;
      const matchesValue = card.value === room.currentValue;
      if (matchesColor || matchesValue) {
        foundPlayable = true;
      }
      
      // Safety break to prevent infinite loops if draw pile empty
      if (room.drawPile.length === 0) {
        const topCard = room.discardPile.pop();
        room.drawPile.push(...room.discardPile);
        room.drawPile = shuffle(room.drawPile);
        room.discardPile = [topCard];
      }
    }

    currentPlayer.cards.push(...drawnCards);
    currentPlayer.safeUno = false;

    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `${currentPlayer.name} drew ${drawnCards.length} card(s) until finding a play.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });
    
    // The player can now choose to play the playable card that was just drawn, or pass. Let's wait for their move.
    broadcastGameUpdate(room, io);
  } else {
    // Draw 1 card
    const card = room.drawPile.pop();
    currentPlayer.cards.push(card);
    currentPlayer.safeUno = false;

    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `${currentPlayer.name} drew a card.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    // Auto-advance turn if drawn card is NOT playable (no manual pass in Uno)
    const matchesColor = card.color === 'wild' || card.color === room.currentColor;
    const matchesValue = card.value === room.currentValue;
    if (!matchesColor && !matchesValue) {
      room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
    }
    // If the card IS playable, leave the turn on the player so they can choose to play it.
    broadcastGameUpdate(room, io);
  }
}

export function playCard(room, socket, { cards, chosenColor, isJumpIn }, io) {
  const card = cards[0];
  const player = room.players.find(p => p.id === socket.id || (p.isBot && room.players.find(pl => pl.id === socket.id)?.isHost));
  if (!player) return;

  const playerIdx = room.players.indexOf(player);

  // Validate Turn
  const isMyTurn = room.turnIndex === playerIdx;

  if (!isMyTurn) {
    if (isJumpIn && room.rules.jumpIn) {
      // Jump In logic: card played must match top card exactly (color & value)
      const matchesColor = card.color === room.currentColor;
      const matchesValue = card.value === room.currentValue;
      if (matchesColor && matchesValue && card.color !== 'wild') {
        room.turnIndex = playerIdx; // Turn jumps to this player
        io.to(room.code).emit('chat-message', {
          id: `sys_${Math.random().toString(36).substr(2, 9)}`,
          senderName: 'System',
          senderId: 'system',
          text: `⚡ Jump-in! ${player.name} cut in out of turn!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          system: true,
        });
      } else {
        return; // invalid jump in
      }
    } else {
      return; // not your turn
    }
  }

  // Remove card from player hand
  player.cards = player.cards.filter(c => c.id !== card.id);
  player.lastPlay = [card];
  
  // Put to discard pile
  room.discardPile.push(card);
  
  // Set current color / value
  const previousColor = room.currentColor;
  room.currentColor = (card.color === 'wild') ? chosenColor : card.color;
  room.currentValue = card.value;

  const cardNames = {
    skip: 'Skip',
    reverse: 'Reverse',
    draw2: 'Draw Two (+2)',
    wild: 'Wild',
    wild4: 'Wild Draw Four (+4)'
  };
  const cardDesc = card.color === 'wild'
    ? `${cardNames[card.value]} (Chosen Color: ${chosenColor.toUpperCase()})`
    : `${card.color.toUpperCase()} ${cardNames[card.value] || card.value}`;

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `${player.name} played ${cardDesc}.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Check Round Over
  if (player.cards.length === 0) {
    handleRoundOver(room, io);
    return;
  }

  // Check 7 Swap Phase
  if (card.value === '7' && room.rules.sevenSwap) {
    room.sevenSwappingPlayerId = player.id;
    // Pause normal turn advance, wait for swap target selection
    broadcastGameUpdate(room, io);
    return;
  }

  // Check 0 Rotate Phase
  if (card.value === '0' && room.rules.zeroRotate) {
    const numPlayers = room.players.length;
    
    // Rotate hands in current play direction
    // If direction is 1 (clockwise): i's cards go to (i+1)
    // We make a shift array
    const originalHands = room.players.map(p => [...p.cards]);
    room.players.forEach((p, idx) => {
      const sourceIdx = (idx - room.playDirection + numPlayers) % numPlayers;
      p.cards = originalHands[sourceIdx];
      p.safeUno = false;
    });

    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `🔄 Hands rotated ${room.playDirection === 1 ? 'clockwise' : 'counter-clockwise'}!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });
  }

  // Execute standard card actions
  let turnsToAdvance = 1;

  if (card.value === 'reverse') {
    room.playDirection *= -1;
    // In 2 player games, reverse acts as skip, so turn goes back to same player.
    if (room.players.length === 2) {
      turnsToAdvance = 0;
    }
  } else if (card.value === 'skip') {
    turnsToAdvance = 2;
  } else if (card.value === 'draw2') {
    if (room.rules.stacking) {
      room.accumulatedDrawCount += 2;
      turnsToAdvance = 1;
    } else {
      // Force next player to draw 2 and skip
      const nextIdx = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
      const targetPlayer = room.players[nextIdx];
      
      // Make sure deck has cards
      if (room.drawPile.length < 2) {
        const topCard = room.discardPile.pop();
        room.drawPile.push(...room.discardPile);
        room.drawPile = shuffle(room.drawPile);
        room.discardPile = [topCard];
      }
      
      targetPlayer.cards.push(...room.drawPile.splice(0, 2));
      targetPlayer.safeUno = false;
      
      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random().toString(36).substr(2, 9)}`,
        senderName: 'System',
        senderId: 'system',
        text: `${targetPlayer.name} drew 2 cards and turn is skipped.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
      turnsToAdvance = 2;
    }
  } else if (card.value === 'wild4') {
    if (room.rules.stacking) {
      room.accumulatedDrawCount += 4;
      turnsToAdvance = 1;
    } else {
      // Force next player to draw 4 and skip
      const nextIdx = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
      const targetPlayer = room.players[nextIdx];
      
      // Make sure deck has cards
      if (room.drawPile.length < 4) {
        const topCard = room.discardPile.pop();
        room.drawPile.push(...room.discardPile);
        room.drawPile = shuffle(room.drawPile);
        room.discardPile = [topCard];
      }

      targetPlayer.cards.push(...room.drawPile.splice(0, 4));
      targetPlayer.safeUno = false;

      io.to(room.code).emit('chat-message', {
        id: `sys_${Math.random().toString(36).substr(2, 9)}`,
        senderName: 'System',
        senderId: 'system',
        text: `${targetPlayer.name} drew 4 cards and turn is skipped.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        system: true,
      });
      turnsToAdvance = 2;
    }
  }

  // Advance turns
  if (turnsToAdvance > 0) {
    for (let i = 0; i < turnsToAdvance; i++) {
      room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
    }
  }

  broadcastGameUpdate(room, io);
}

export function passTurn(room, socket, io) {
  const currentPlayer = room.players[room.turnIndex];
  const isBotTurn = currentPlayer.isBot;
  const isAuthorized = currentPlayer.id === socket.id || (isBotTurn && room.players.find(p => p.id === socket.id)?.isHost);

  if (!isAuthorized) return;

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `${currentPlayer.name} passed.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Turn advances
  room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
  broadcastGameUpdate(room, io);
}

export function swapHand(room, socket, { targetPlayerId }, io) {
  const requestingPlayer = room.players.find(p => p.id === socket.id || (p.isBot && room.players.find(pl => pl.id === socket.id)?.isHost));
  if (!requestingPlayer || room.sevenSwappingPlayerId !== requestingPlayer.id) return;

  const targetPlayer = room.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer || targetPlayer.id === requestingPlayer.id) return;

  // Swap hands
  const temp = [...requestingPlayer.cards];
  requestingPlayer.cards = [...targetPlayer.cards];
  targetPlayer.cards = temp;

  requestingPlayer.safeUno = false;
  targetPlayer.safeUno = false;
  room.sevenSwappingPlayerId = null;
  room.lastSevenSwap = {
    requesterId: requestingPlayer.id,
    targetId: targetPlayer.id,
  };

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `🤝 ${requestingPlayer.name} swapped hands with ${targetPlayer.name}!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Advance turn
  room.turnIndex = getNextPlayerIndex(room.turnIndex, room.players.length, room.playDirection);
  broadcastGameUpdate(room, io);
}

export function unoCall(room, socket, io) {
  const player = room.players.find(p => p.id === socket.id || (p.isBot && room.players.find(pl => pl.id === socket.id)?.isHost));
  if (!player || player.cards.length > 2) return; // Can call Uno with 2 cards (before playing) or 1 card

  player.safeUno = true;

  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text: `📣 UNO! ${player.name} is down to their last card!`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  broadcastGameUpdate(room, io);
}

export function unoChallenge(room, socket, { targetPlayerId }, io) {
  const challenger = room.players.find(p => p.id === socket.id);
  const target = room.players.find(p => p.id === targetPlayerId);
  if (!challenger || !target) return;

  // Verify target player is down to 1 card and has NOT called UNO
  if (target.cards.length === 1 && !target.safeUno) {
    // Stacking safety check: deck refilling
    if (room.drawPile.length < 2) {
      const topCard = room.discardPile.pop();
      room.drawPile.push(...room.discardPile);
      room.drawPile = shuffle(room.drawPile);
      room.discardPile = [topCard];
    }

    target.cards.push(...room.drawPile.splice(0, 2));
    target.safeUno = true; // Mark safe now

    io.to(room.code).emit('chat-message', {
      id: `sys_${Math.random().toString(36).substr(2, 9)}`,
      senderName: 'System',
      senderId: 'system',
      text: `👮 Caught! ${challenger.name} caught ${target.name} not calling UNO! Penalty: draw 2 cards.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      system: true,
    });

    broadcastGameUpdate(room, io);
  }
}
