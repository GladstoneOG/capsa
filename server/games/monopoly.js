// server/games/monopoly.js
// Backend Monopoly Engine for capsa multiplayer/singleplayer

const BOARD_TILES = [
  { index: 0, name: 'GO', type: 'go' },
  { index: 1, name: 'Mediterranean Avenue', type: 'property', color: 'brown', price: 60, rent: [2, 4, 10, 30, 90, 160, 250], housePrice: 50, mortgageValue: 30 },
  { index: 2, name: 'Community Chest', type: 'chest' },
  { index: 3, name: 'Baltic Avenue', type: 'property', color: 'brown', price: 60, rent: [4, 8, 20, 60, 180, 320, 450], housePrice: 50, mortgageValue: 30 },
  { index: 4, name: 'Income Tax', type: 'tax', price: 200 },
  { index: 5, name: 'Reading Railroad', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 6, name: 'Oriental Avenue', type: 'property', color: 'lightblue', price: 100, rent: [6, 12, 30, 90, 270, 400, 550], housePrice: 50, mortgageValue: 50 },
  { index: 7, name: 'Chance', type: 'chance' },
  { index: 8, name: 'Vermont Avenue', type: 'property', color: 'lightblue', price: 100, rent: [6, 12, 30, 90, 270, 400, 550], housePrice: 50, mortgageValue: 50 },
  { index: 9, name: 'Connecticut Avenue', type: 'property', color: 'lightblue', price: 120, rent: [8, 16, 40, 100, 300, 450, 600], housePrice: 50, mortgageValue: 60 },
  { index: 10, name: 'Jail / Just Visiting', type: 'jail' },
  { index: 11, name: 'St. Charles Place', type: 'property', color: 'pink', price: 140, rent: [10, 20, 50, 150, 450, 625, 750], housePrice: 100, mortgageValue: 70 },
  { index: 12, name: 'Electric Company', type: 'utility', price: 150, rent: [4, 10], mortgageValue: 75 }, // Rent is 4x or 10x dice
  { index: 13, name: 'States Avenue', type: 'property', color: 'pink', price: 140, rent: [10, 20, 50, 150, 450, 625, 750], housePrice: 100, mortgageValue: 70 },
  { index: 14, name: 'Virginia Avenue', type: 'property', color: 'pink', price: 160, rent: [12, 24, 60, 180, 500, 700, 900], housePrice: 100, mortgageValue: 80 },
  { index: 15, name: 'Pennsylvania Railroad', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 16, name: 'St. James Place', type: 'property', color: 'orange', price: 180, rent: [14, 28, 70, 200, 550, 750, 950], housePrice: 100, mortgageValue: 90 },
  { index: 17, name: 'Community Chest', type: 'chest' },
  { index: 18, name: 'Tennessee Avenue', type: 'property', color: 'orange', price: 180, rent: [14, 28, 70, 200, 550, 750, 950], housePrice: 100, mortgageValue: 90 },
  { index: 19, name: 'New York Avenue', type: 'property', color: 'orange', price: 200, rent: [16, 32, 80, 220, 600, 800, 1000], housePrice: 100, mortgageValue: 100 },
  { index: 20, name: 'Free Parking', type: 'parking' },
  { index: 21, name: 'Kentucky Avenue', type: 'property', color: 'red', price: 220, rent: [18, 36, 90, 250, 700, 875, 1050], housePrice: 150, mortgageValue: 110 },
  { index: 22, name: 'Chance', type: 'chance' },
  { index: 23, name: 'Indiana Avenue', type: 'property', color: 'red', price: 220, rent: [18, 36, 90, 250, 700, 875, 1050], housePrice: 150, mortgageValue: 110 },
  { index: 24, name: 'Illinois Avenue', type: 'property', color: 'red', price: 240, rent: [20, 40, 100, 300, 750, 925, 1100], housePrice: 150, mortgageValue: 120 },
  { index: 25, name: 'B. & O. Railroad', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 26, name: 'Atlantic Avenue', type: 'property', color: 'yellow', price: 260, rent: [22, 44, 110, 330, 800, 975, 1150], housePrice: 150, mortgageValue: 130 },
  { index: 27, name: 'Ventnor Avenue', type: 'property', color: 'yellow', price: 260, rent: [22, 44, 110, 330, 800, 975, 1150], housePrice: 150, mortgageValue: 130 },
  { index: 28, name: 'Water Works', type: 'utility', price: 150, rent: [4, 10], mortgageValue: 75 },
  { index: 29, name: 'Marvin Gardens', type: 'property', color: 'yellow', price: 280, rent: [24, 48, 120, 360, 850, 1025, 1200], housePrice: 150, mortgageValue: 140 },
  { index: 30, name: 'Go To Jail', type: 'gotojail' },
  { index: 31, name: 'Pacific Avenue', type: 'property', color: 'green', price: 300, rent: [26, 52, 130, 390, 900, 1100, 1275], housePrice: 200, mortgageValue: 150 },
  { index: 32, name: 'North Carolina Avenue', type: 'property', color: 'green', price: 300, rent: [26, 52, 130, 390, 900, 1100, 1275], housePrice: 200, mortgageValue: 150 },
  { index: 33, name: 'Community Chest', type: 'chest' },
  { index: 34, name: 'Pennsylvania Avenue', type: 'property', color: 'green', price: 320, rent: [28, 56, 150, 450, 1000, 1200, 1400], housePrice: 200, mortgageValue: 160 },
  { index: 35, name: 'Short Line Railroad', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 36, name: 'Chance', type: 'chance' },
  { index: 37, name: 'Park Place', type: 'property', color: 'darkblue', price: 350, rent: [35, 70, 175, 500, 1100, 1300, 1500], housePrice: 200, mortgageValue: 175 },
  { index: 38, name: 'Luxury Tax', type: 'tax', price: 100 },
  { index: 39, name: 'Boardwalk', type: 'property', color: 'darkblue', price: 400, rent: [50, 100, 200, 600, 1400, 1700, 2000], housePrice: 200, mortgageValue: 200 }
];

const CHANCE_CARDS = [
  { id: 'ch_go', text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
  { id: 'ch_boardwalk', text: 'Advance to Boardwalk', action: 'move', target: 39 },
  { id: 'ch_illinois', text: 'Advance to Illinois Avenue', action: 'move', target: 24 },
  { id: 'ch_stcharles', text: 'Advance to St. Charles Place', action: 'move', target: 11 },
  { id: 'ch_railroad', text: 'Advance to nearest Railroad. If unowned, buy it. If owned, pay double rent.', action: 'nearest_railroad' },
  { id: 'ch_utility', text: 'Advance to nearest Utility. If unowned, buy it. If owned, throw dice and pay 10 times multiplier.', action: 'nearest_utility' },
  { id: 'ch_dividend', text: 'Bank pays you dividend of $50', action: 'give_money', amount: 50 },
  { id: 'ch_jail_free', text: 'Get Out of Jail Free card', action: 'jail_free' },
  { id: 'ch_back3', text: 'Go Back 3 Spaces', action: 'back_spaces', amount: 3 },
  { id: 'ch_goto_jail', text: 'Go directly to Jail. Do not pass GO, do not collect $200.', action: 'goto_jail' },
  { id: 'ch_repairs', text: 'Make general repairs on all your property. Pay $25 per house and $100 per hotel.', action: 'repairs', houseCost: 25, hotelCost: 100 },
  { id: 'ch_speeding', text: 'Speeding fine $15', action: 'take_money', amount: 15 },
  { id: 'ch_reading', text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.', action: 'move', target: 5 },
  { id: 'ch_chairman', text: 'You have been elected Chairman of the Board. Pay each player $50.', action: 'pay_each', amount: 50 }
];

const CHEST_CARDS = [
  { id: 'cc_go', text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
  { id: 'cc_bank_error', text: 'Bank error in your favor. Collect $200.', action: 'give_money', amount: 200 },
  { id: 'cc_doctor', text: "Doctor's fees. Pay $50.", action: 'take_money', amount: 50 },
  { id: 'cc_sale', text: 'From sale of stock you get $50.', action: 'give_money', amount: 50 },
  { id: 'cc_jail_free', text: 'Get Out of Jail Free card', action: 'jail_free' },
  { id: 'cc_goto_jail', text: 'Go directly to Jail. Do not pass GO, do not collect $200.', action: 'goto_jail' },
  { id: 'cc_holiday', text: 'Holiday fund matures. Receive $100.', action: 'give_money', amount: 100 },
  { id: 'cc_tax_refund', text: 'Income tax refund. Collect $20.', action: 'give_money', amount: 20 },
  { id: 'cc_birthday', text: 'It is your birthday. Collect $10 from every player.', action: 'collect_each', amount: 10 },
  { id: 'cc_life', text: 'Life insurance matures. Collect $100.', action: 'give_money', amount: 100 },
  { id: 'cc_hospital', text: 'Pay hospital fees of $100.', action: 'take_money', amount: 100 },
  { id: 'cc_school', text: 'Pay school fees of $50.', action: 'take_money', amount: 50 },
  { id: 'cc_consultancy', text: 'Receive $25 consultancy fee.', action: 'give_money', amount: 25 },
  { id: 'cc_street_repairs', text: 'You are assessed for street repairs. Pay $40 per house and $115 per hotel.', action: 'repairs', houseCost: 40, hotelCost: 115 },
  { id: 'cc_beauty', text: 'You have won second prize in a beauty contest. Collect $10.', action: 'give_money', amount: 10 },
  { id: 'cc_inherit', text: 'You inherit $100.', action: 'give_money', amount: 100 }
];

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getSanitizedRoomState(room, socketId) {
  // All Monopoly board states and player wealth are public
  return {
    ...room,
    players: room.players.map(p => {
      const { sessionId, ...publicPlayer } = p;
      return publicPlayer;
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
      hostSocket.emit('bot-coordinator-sync', room);
    }
  }
}

export function startRound(room, io) {
  room.gameState = 'playing';
  room.roundNumber += 1;

  // Initialize board state
  room.monopolyBoard = BOARD_TILES.map(t => ({
    ...t,
    owner: null,
    houses: 0,
    mortgaged: false
  }));

  // Shuffled decks
  room.chanceDeck = shuffle(CHANCE_CARDS);
  room.chestDeck = shuffle(CHEST_CARDS);

  // Initialize players
  room.players.forEach((p, idx) => {
    p.money = 1500;
    p.position = 0;
    p.inJail = false;
    p.jailTurns = 0;
    p.getOutOfJailCards = 0;
    p.bankrupt = false;
    p.lastRoll = [1, 1];
    p.rollCount = 0; // standard double counter (reset on turn start)
    p.netWorth = 1500;
    p.passed = false;
    p.lastPlay = null;
    delete p.finishRank;
    delete p.roundPoints;
  });

  room.dice = [1, 1];
  room.rollId = null;
  room.monopolyPhase = 'roll';
  room.currentCard = null;
  room.cardType = null;
  room.activeDebt = null;
  room.turnIndex = 0;

  // Chat message start
  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random()}`,
    senderName: 'System',
    senderId: 'system',
    text: '🎩 Monopoly Game Started! Good luck players! 🎲',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });

  // Send starts securely / transition to table screen
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

// Logic helper: count properties of color owned by player
function countPropertiesInColor(board, color) {
  return board.filter(t => t.type === 'property' && t.color === color).length;
}

function countPropertiesOwnedInColor(board, color, playerId) {
  return board.filter(t => t.type === 'property' && t.color === color && t.owner === playerId).length;
}

function ownsMonopoly(board, color, playerId) {
  if (!color || !playerId) return false;
  const total = countPropertiesInColor(board, color);
  const owned = countPropertiesOwnedInColor(board, color, playerId);
  return total > 0 && total === owned;
}

function updateNetWorth(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  let value = player.money;
  room.monopolyBoard.forEach(tile => {
    if (tile.owner === playerId) {
      if (tile.mortgaged) {
        value += tile.mortgageValue;
      } else {
        value += tile.price || 0;
        if (tile.houses > 0) {
          value += tile.houses * tile.housePrice;
        }
      }
    }
  });

  player.netWorth = value;
}

function addSystemChatMessage(room, io, text) {
  io.to(room.code).emit('chat-message', {
    id: `sys_${Math.random().toString(36).substr(2, 9)}`,
    senderName: 'System',
    senderId: 'system',
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    system: true,
  });
}

function getNextActiveTurnIndex(room) {
  let idx = room.turnIndex;
  const n = room.players.length;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    if (!room.players[idx].bankrupt) {
      return idx;
    }
  }
  return room.turnIndex;
}

function setEndTurnPhase(room, player, io) {
  if (player.inJail) {
    // Jail ends turn immediately
    room.players.forEach(p => {
      if (p.id === room.players[room.turnIndex].id) {
        p.rollCount = 0;
        p.doublesRolled = false;
      }
    });
    room.turnIndex = getNextActiveTurnIndex(room);
    room.monopolyPhase = 'roll';
  } else if (player.doublesRolled && !player.bankrupt) {
    // Skip end_turn phase and automatically start rolling again
    player.doublesRolled = false;
    room.monopolyPhase = 'roll';
    addSystemChatMessage(room, io, `🎲 Doubles! ${player.name} gets to roll again.`);
  } else {
    room.monopolyPhase = 'end_turn';
  }
}

function checkGameWinner(room, io) {
  const activePlayers = room.players.filter(p => !p.bankrupt);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    room.gameState = 'gameover';
    
    addSystemChatMessage(room, io, `🏆 ${winner.name} is the last tycoon standing! Victory is theirs! 🏆`);
    
    // Assign finish ranks to everyone
    room.players.forEach(p => {
      if (p.id === winner.id) {
        p.finishRank = 1;
        p.score = p.netWorth;
      } else if (!p.finishRank) {
        p.finishRank = room.players.length;
        p.score = p.netWorth;
      }
    });

    io.to(room.code).emit('round-over', getSanitizedRoomState(room, ''));
    return true;
  }
  return false;
}

function calculateRent(tile, board, diceSum, chanceDoubleMultiplier = false) {
  if (tile.type === 'property') {
    const isMonopoly = ownsMonopoly(board, tile.color, tile.owner);
    if (tile.houses === 0) {
      return isMonopoly ? tile.rent[0] * 2 : tile.rent[0];
    }
    return tile.rent[tile.houses];
  }

  if (tile.type === 'railroad') {
    const count = board.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
    const baseRent = tile.rent[Math.min(count - 1, 3)];
    return chanceDoubleMultiplier ? baseRent * 2 : baseRent;
  }

  if (tile.type === 'utility') {
    const count = board.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
    const mult = count === 2 ? 10 : 4;
    const finalMult = chanceDoubleMultiplier ? 10 : mult;
    return diceSum * finalMult;
  }

  return 0;
}

function handleLandedAction(room, player, diceSum, io, chanceDoubleMultiplier = false) {
  const tile = room.monopolyBoard[player.position];
  
  if (tile.type === 'go') {
    setEndTurnPhase(room, player, io);
    return;
  }

  if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
    if (tile.owner === null) {
      // Unowned: allow buy or pass
      room.monopolyPhase = 'action';
    } else if (tile.owner === player.id) {
      // Landed on own property
      setEndTurnPhase(room, player, io);
    } else if (tile.mortgaged) {
      // Mortgaged property: no rent
      addSystemChatMessage(room, io, `${player.name} landed on ${tile.name} (Mortgaged by owner). No rent paid.`);
      setEndTurnPhase(room, player, io);
    } else {
      // Rent payment
      const owner = room.players.find(p => p.id === tile.owner);
      const rentAmount = calculateRent(tile, room.monopolyBoard, diceSum, chanceDoubleMultiplier);
      
      addSystemChatMessage(room, io, `${player.name} landed on ${tile.name} and owes ${owner.name} $${rentAmount} rent.`);
      
      triggerPayment(room, player, owner, rentAmount, io);
    }
    return;
  }

  if (tile.type === 'tax') {
    addSystemChatMessage(room, io, `${player.name} landed on ${tile.name} and owes the bank $${tile.price}.`);
    triggerPayment(room, player, null, tile.price, io);
    return;
  }

  if (tile.type === 'jail') {
    setEndTurnPhase(room, player, io);
    return;
  }

  if (tile.type === 'parking') {
    addSystemChatMessage(room, io, `${player.name} relaxes at Free Parking!`);
    setEndTurnPhase(room, player, io);
    return;
  }

  if (tile.type === 'gotojail') {
    sendPlayerToJail(room, player, io);
    return;
  }

  if (tile.type === 'chance' || tile.type === 'chest') {
    drawCard(room, player, tile.type, diceSum, io);
    return;
  }
}

function triggerPayment(room, player, recipient, amount, io) {
  if (player.money >= amount) {
    player.money -= amount;
    if (recipient) {
      recipient.money += amount;
      addSystemChatMessage(room, io, `${player.name} paid $${amount} rent to ${recipient.name}.`);
      updateNetWorth(room, recipient.id);
    } else {
      addSystemChatMessage(room, io, `${player.name} paid $${amount} tax to the bank.`);
    }
    updateNetWorth(room, player.id);
    setEndTurnPhase(room, player, io);
  } else {
    // Debt mode
    room.activeDebt = {
      from: player.id,
      to: recipient ? recipient.id : 'bank',
      amountValue: amount
    };
    room.monopolyPhase = 'bankrupt_decision';
    addSystemChatMessage(room, io, `🚨 ${player.name} is in debt! Needs to raise $${amount - player.money} to pay the debt.`);
  }
}

function sendPlayerToJail(room, player, io) {
  player.position = 10; // Jail Just Visiting index
  player.inJail = true;
  player.jailTurns = 0;
  player.rollCount = 0;
  setEndTurnPhase(room, player, io);
  addSystemChatMessage(room, io, `👮 ${player.name} was sent directly to jail!`);
}

function startPropertyAuction(room, tileIndex, io) {
  const passingPlayer = room.players[room.turnIndex];
  const bidders = room.players.filter(p => !p.bankrupt).map(p => p.id);
  
  if (bidders.length === 0) {
    const player = room.players[room.turnIndex];
    resumeAfterAuction(room, player, io);
    return;
  }

  room.monopolyPhase = 'auction';
  room.auctionState = {
    tileIndex,
    highestBid: 0,
    highestBidder: null,
    bidders,
    activeBidderIndex: 0
  };
  
  const tile = room.monopolyBoard[tileIndex];
  addSystemChatMessage(room, io, `🎲 Auction started for ${tile.name}! Starting bid is $10.`);
}

function resumeAfterAuction(room, player, io) {
  room.auctionState = null;
  if (player.doublesRolled) {
    player.doublesRolled = false;
    room.monopolyPhase = 'roll';
  } else {
    setEndTurnPhase(room, player, io);
  }
}

function drawCard(room, player, type, diceSum, io) {
  let deck = type === 'chance' ? room.chanceDeck : room.chestDeck;
  if (deck.length === 0) {
    deck = type === 'chance' ? shuffle(CHANCE_CARDS) : shuffle(CHEST_CARDS);
    if (type === 'chance') room.chanceDeck = deck;
    else room.chestDeck = deck;
  }

  const card = deck.pop();
  room.currentCard = card;
  room.cardType = type;
  room.monopolyPhase = 'card_drawn';

  addSystemChatMessage(room, io, `✉️ ${player.name} drew a ${type.toUpperCase()} card: "${card.text}"`);
}

function resolveCardAction(room, player, io, diceSum) {
  const card = room.currentCard;
  if (!card) return;

  room.currentCard = null;
  room.cardType = null;

  if (card.action === 'move') {
    const oldPos = player.position;
    player.position = card.target;
    addSystemChatMessage(room, io, `${player.name} moved to ${room.monopolyBoard[player.position].name}.`);
    
    // Check pass GO
    if (player.position < oldPos) {
      player.money += 200;
      addSystemChatMessage(room, io, `${player.name} passed GO and collected $200!`);
      updateNetWorth(room, player.id);
    }
    
    // Trigger action on landed property
    handleLandedAction(room, player, diceSum, io);
    return;
  }

  if (card.action === 'give_money') {
    player.money += card.amount;
    addSystemChatMessage(room, io, `${player.name} received $${card.amount} from the card.`);
    updateNetWorth(room, player.id);
    setEndTurnPhase(room, player, io);
    return;
  }

  if (card.action === 'take_money') {
    triggerPayment(room, player, null, card.amount, io);
    return;
  }

  if (card.action === 'jail_free') {
    player.getOutOfJailCards += 1;
    addSystemChatMessage(room, io, `${player.name} received a Get Out of Jail Free card!`);
    setEndTurnPhase(room, player, io);
    return;
  }

  if (card.action === 'goto_jail') {
    sendPlayerToJail(room, player, io);
    return;
  }

  if (card.action === 'back_spaces') {
    player.position = (player.position - card.amount + 40) % 40;
    addSystemChatMessage(room, io, `${player.name} moved back ${card.amount} spaces to ${room.monopolyBoard[player.position].name}.`);
    handleLandedAction(room, player, diceSum, io);
    return;
  }

  if (card.action === 'nearest_railroad') {
    let curr = player.position;
    while (room.monopolyBoard[curr].type !== 'railroad') {
      curr = (curr + 1) % 40;
    }
    const oldPos = player.position;
    player.position = curr;
    addSystemChatMessage(room, io, `${player.name} advanced to nearest Railroad: ${room.monopolyBoard[player.position].name}.`);
    
    if (player.position < oldPos) {
      player.money += 200;
      addSystemChatMessage(room, io, `${player.name} passed GO and collected $200!`);
      updateNetWorth(room, player.id);
    }

    // Rent is doubled if owned
    handleLandedAction(room, player, diceSum, io, true);
    return;
  }

  if (card.action === 'nearest_utility') {
    let curr = player.position;
    while (room.monopolyBoard[curr].type !== 'utility') {
      curr = (curr + 1) % 40;
    }
    const oldPos = player.position;
    player.position = curr;
    addSystemChatMessage(room, io, `${player.name} advanced to nearest Utility: ${room.monopolyBoard[player.position].name}.`);
    
    if (player.position < oldPos) {
      player.money += 200;
      addSystemChatMessage(room, io, `${player.name} passed GO and collected $200!`);
      updateNetWorth(room, player.id);
    }

    // Rent is 10x dice roll if owned
    handleLandedAction(room, player, diceSum, io, true);
    return;
  }

  if (card.action === 'pay_each') {
    const activeOpponents = room.players.filter(p => !p.bankrupt && p.id !== player.id);
    const totalCost = activeOpponents.length * card.amount;
    
    if (player.money >= totalCost) {
      player.money -= totalCost;
      activeOpponents.forEach(p => {
        p.money += card.amount;
        updateNetWorth(room, p.id);
      });
      addSystemChatMessage(room, io, `${player.name} paid $${card.amount} to each player.`);
      updateNetWorth(room, player.id);
      setEndTurnPhase(room, player, io);
    } else {
      // Simple debt handle: first owe to one player, to keep state machine clean, let's say they owe to bank or we assign debt.
      // Owe the total cost to the bank to distribute or directly. Let's make it owe to bank
      room.activeDebt = {
        from: player.id,
        to: 'bank', // Simplify payout by collecting via bank debt
        amountValue: totalCost,
        payoutPlayers: activeOpponents.map(p => ({ id: p.id, share: card.amount }))
      };
      room.monopolyPhase = 'bankrupt_decision';
      addSystemChatMessage(room, io, `🚨 ${player.name} needs $${totalCost} to pay other players.`);
    }
    return;
  }

  if (card.action === 'collect_each') {
    let collected = 0;
    room.players.forEach(p => {
      if (!p.bankrupt && p.id !== player.id) {
        if (p.money >= card.amount) {
          p.money -= card.amount;
          collected += card.amount;
          updateNetWorth(room, p.id);
        } else {
          // Take whatever they have
          collected += p.money;
          p.money = 0;
          updateNetWorth(room, p.id);
        }
      }
    });

    player.money += collected;
    addSystemChatMessage(room, io, `${player.name} collected $${collected} from other players.`);
    updateNetWorth(room, player.id);
    setEndTurnPhase(room, player, io);
    return;
  }

  if (card.action === 'repairs') {
    let housesCount = 0;
    let hotelsCount = 0;
    room.monopolyBoard.forEach(t => {
      if (t.owner === player.id) {
        if (t.houses === 5) hotelsCount++;
        else housesCount += t.houses;
      }
    });

    const totalRepairBill = (housesCount * card.houseCost) + (hotelsCount * card.hotelCost);
    addSystemChatMessage(room, io, `${player.name} assessed street repairs: ${housesCount} houses, ${hotelsCount} hotels. Bill: $${totalRepairBill}`);
    
    if (totalRepairBill > 0) {
      triggerPayment(room, player, null, totalRepairBill, io);
    } else {
      setEndTurnPhase(room, player, io);
    }
    return;
  }

  // Fallback
  setEndTurnPhase(room, player, io);
}

function handleBankruptcyResolution(room, player, io) {
  const debt = room.activeDebt;
  if (!debt) return;

  const creditorId = debt.to;
  addSystemChatMessage(room, io, `💀 ${player.name} declared bankruptcy!`);

  player.bankrupt = true;
  player.money = 0;

  // Transfer assets
  room.monopolyBoard.forEach(tile => {
    if (tile.owner === player.id) {
      tile.houses = 0;
      if (creditorId === 'bank') {
        tile.owner = null;
        tile.mortgaged = false;
        addSystemChatMessage(room, io, `Property ${tile.name} returned to the bank.`);
      } else {
        tile.owner = creditorId;
        // Transfer mortgage as mortgaged
        addSystemChatMessage(room, io, `Property ${tile.name} transferred to ${room.players.find(p => p.id === creditorId).name}.`);
      }
    }
  });

  // Pay recipient whatever cash was left
  if (creditorId !== 'bank') {
    const creditor = room.players.find(p => p.id === creditorId);
    if (creditor) {
      // In bankruptcy, creditor gets whatever remaining cash the player had
      const remainingCash = Math.max(0, player.money);
      creditor.money += remainingCash;
      updateNetWorth(room, creditor.id);
    }
  }

  // If debt had payoutPlayers (pay_each card)
  if (debt.payoutPlayers) {
    debt.payoutPlayers.forEach(payout => {
      const recipient = room.players.find(p => p.id === payout.id);
      if (recipient && !recipient.bankrupt) {
        recipient.money += payout.share;
        updateNetWorth(room, recipient.id);
      }
    });
  }

  room.activeDebt = null;
  updateNetWorth(room, player.id);

  // Check if game is over
  const isOver = checkGameWinner(room, io);
  if (!isOver) {
    // Advance turn
    room.turnIndex = getNextActiveTurnIndex(room);
    room.monopolyPhase = 'roll';
  }
}

export function handleAction(room, socket, action, payload, io) {
  if (room.monopolyPhase === 'rolling_animation') return;

  const player = room.players[room.turnIndex];
  if (!player || player.bankrupt) return;

  // Certain actions can be taken by players other than the active turn player.
  // We bypass the active-turn authorization for these specific actions,
  // and validate them individually inside their case blocks.
  const bypassTurnAuth = [
    'auction-bid',
    'auction-pass',
    'trade-accept',
    'trade-decline',
    'trade-cancel',
    'trade-counter'
  ].includes(action);

  if (!bypassTurnAuth) {
    // Authorization: check if this player owns the turn
    const isAuthorized = player.id === socket.id || (player.isBot && room.players.find(p => p.id === socket.id)?.isHost);
    if (!isAuthorized) return;
  }

  switch (action) {
    case 'roll-dice': {
      if (room.monopolyPhase !== 'roll' || player.inJail) return;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      
      room.dice = [d1, d2];
      room.rollId = Math.random().toString(36).substring(2, 9);
      player.lastRoll = [d1, d2];
      
      const sum = d1 + d2;
      const isDoubles = d1 === d2;

      addSystemChatMessage(room, io, `🎲 ${player.name} rolled: ${d1} & ${d2} = ${sum}${isDoubles ? ' (DOUBLES!)' : ''}`);

      room.monopolyPhase = 'rolling_animation';
      broadcastGameUpdate(room, io);

      setTimeout(() => {
        // Guard: make sure the room and player are still valid/playing
        if (room.gameState !== 'playing' || player.bankrupt) return;

        if (isDoubles) {
          player.rollCount += 1;
          if (player.rollCount === 3) {
            addSystemChatMessage(room, io, `👮 ${player.name} rolled doubles three times and goes directly to Jail!`);
            sendPlayerToJail(room, player, io);
          } else {
            // Normal doubles move
            const oldPos = player.position;
            player.position = (player.position + sum) % 40;
            
            if (player.position < oldPos) {
              player.money += 200;
              addSystemChatMessage(room, io, `${player.name} passed GO and collected $200!`);
            }

            updateNetWorth(room, player.id);
            handleLandedAction(room, player, sum, io);

            // Phase is set inside handleLandedAction. If it is end_turn, we allow another roll
            if (room.monopolyPhase === 'end_turn') {
              room.monopolyPhase = 'roll'; // Let them roll again!
            } else {
              // Player landed on something requiring decision/payment.
              // Save doubles status so that once resolved, they can roll again!
              player.doublesRolled = true;
            }
          }
        } else {
          player.rollCount = 0;
          player.doublesRolled = false;

          const oldPos = player.position;
          player.position = (player.position + sum) % 40;
          
          if (player.position < oldPos) {
            player.money += 200;
            addSystemChatMessage(room, io, `${player.name} passed GO and collected $200!`);
          }

          updateNetWorth(room, player.id);
          handleLandedAction(room, player, sum, io);
        }

        broadcastGameUpdate(room, io);
      }, 2200);

      break;
    }

    case 'buy-property': {
      if (room.monopolyPhase !== 'action') return;
      const tile = room.monopolyBoard[player.position];
      if (tile.owner !== null || !tile.price) return;

      if (player.money >= tile.price) {
        player.money -= tile.price;
        tile.owner = player.id;
        addSystemChatMessage(room, io, `🏠 ${player.name} bought ${tile.name} for $${tile.price}.`);
        
        updateNetWorth(room, player.id);

        // Resume doubles state if set
        if (player.doublesRolled) {
          player.doublesRolled = false;
          room.monopolyPhase = 'roll';
        } else {
          setEndTurnPhase(room, player, io);
        }
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'pass-property': {
      if (room.monopolyPhase !== 'action') return;
      const tile = room.monopolyBoard[player.position];
      addSystemChatMessage(room, io, `${player.name} passed on buying ${tile.name}.`);
      startPropertyAuction(room, player.position, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'ok-card': {
      if (room.monopolyPhase !== 'card_drawn') return;
      const sum = player.lastRoll[0] + player.lastRoll[1];
      resolveCardAction(room, player, io, sum);

      // Check if ok-card movement landed them somewhere with no action, and they had doubles
      if (room.monopolyPhase === 'end_turn' && player.doublesRolled) {
        player.doublesRolled = false;
        room.monopolyPhase = 'roll';
      }

      broadcastGameUpdate(room, io);
      break;
    }

    case 'pay-jail-fine': {
      if (room.monopolyPhase !== 'roll' || !player.inJail) return;
      if (player.money >= 50) {
        player.money -= 50;
        player.inJail = false;
        player.jailTurns = 0;
        addSystemChatMessage(room, io, `🔓 ${player.name} paid $50 to get out of jail.`);
        updateNetWorth(room, player.id);
        
        // Let them roll normally now
        room.monopolyPhase = 'roll';
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'use-jail-card': {
      if (room.monopolyPhase !== 'roll' || !player.inJail) return;
      if (player.getOutOfJailCards > 0) {
        player.getOutOfJailCards -= 1;
        player.inJail = false;
        player.jailTurns = 0;
        addSystemChatMessage(room, io, `🔓 ${player.name} used a Get Out of Jail Free card.`);
        
        // Let them roll normally now
        room.monopolyPhase = 'roll';
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'roll-jail-doubles': {
      if (room.monopolyPhase !== 'roll' || !player.inJail) return;

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      room.dice = [d1, d2];
      room.rollId = Math.random().toString(36).substring(2, 9);
      player.lastRoll = [d1, d2];
      
      const sum = d1 + d2;
      const isDoubles = d1 === d2;

      addSystemChatMessage(room, io, `🎲 ${player.name} rolled for jail release: ${d1} & ${d2}`);

      room.monopolyPhase = 'rolling_animation';
      broadcastGameUpdate(room, io);

      setTimeout(() => {
        // Guard: make sure the room and player are still valid/playing
        if (room.gameState !== 'playing' || player.bankrupt) return;

        if (isDoubles) {
          player.inJail = false;
          player.jailTurns = 0;
          addSystemChatMessage(room, io, `🔓 Release successful! Doubles rolled!`);
          
          // Move immediately
          const oldPos = player.position;
          player.position = (player.position + sum) % 40;
          updateNetWorth(room, player.id);
          handleLandedAction(room, player, sum, io);
        } else {
          player.jailTurns += 1;
          if (player.jailTurns === 3) {
            addSystemChatMessage(room, io, `👮 3rd jail turn completed. ${player.name} must pay $50 fine and move.`);
            if (player.money >= 50) {
              player.money -= 50;
              player.inJail = false;
              player.jailTurns = 0;
              updateNetWorth(room, player.id);

              const oldPos = player.position;
              player.position = (player.position + sum) % 40;
              if (player.position < oldPos) player.money += 200;
              updateNetWorth(room, player.id);
              handleLandedAction(room, player, sum, io);
            } else {
              // Owe the jail fine
              player.inJail = false;
              player.jailTurns = 0;
              
              const oldPos = player.position;
              player.position = (player.position + sum) % 40;
              if (player.position < oldPos) player.money += 200;
              updateNetWorth(room, player.id);

              room.activeDebt = {
                from: player.id,
                to: 'bank',
                amountValue: 50
              };
              room.monopolyPhase = 'bankrupt_decision';
            }
          } else {
            addSystemChatMessage(room, io, `${player.name} remains in jail.`);
            setEndTurnPhase(room, player, io);
          }
        }
        broadcastGameUpdate(room, io);
      }, 2200);

      break;
    }

    case 'build-house': {
      // Allowed during end_turn or roll phase (property management)
      const tileIndex = payload;
      const tile = room.monopolyBoard[tileIndex];
      if (!tile || tile.type !== 'property' || tile.owner !== player.id || tile.mortgaged) return;

      const isMonopoly = ownsMonopoly(room.monopolyBoard, tile.color, player.id);
      if (!isMonopoly) return;

      // Check build balance: cannot build if it would be uneven (limit is +/- 1 difference)
      const colorGroup = room.monopolyBoard.filter(t => t.type === 'property' && t.color === tile.color);
      const isAnyMortgaged = colorGroup.some(t => t.mortgaged);
      if (isAnyMortgaged) return;

      if (tile.houses >= 5) return; // Already max (hotel)

      // Even build check
      const currentHouses = tile.houses;
      const canBuild = colorGroup.every(t => t.houses >= currentHouses);
      if (!canBuild) {
        socket.emit('monopoly-error', 'Must build houses evenly across color group.');
        return;
      }

      if (player.money >= tile.housePrice) {
        player.money -= tile.housePrice;
        tile.houses += 1;
        addSystemChatMessage(room, io, `🧱 ${player.name} built a house on ${tile.name} for $${tile.housePrice}.`);
        updateNetWorth(room, player.id);
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'sell-house': {
      const tileIndex = payload;
      const tile = room.monopolyBoard[tileIndex];
      if (!tile || tile.type !== 'property' || tile.owner !== player.id || tile.houses === 0) return;

      const colorGroup = room.monopolyBoard.filter(t => t.type === 'property' && t.color === tile.color);
      
      // Even sell check
      const currentHouses = tile.houses;
      const canSell = colorGroup.every(t => t.houses <= currentHouses);
      if (!canSell) {
        socket.emit('monopoly-error', 'Must sell houses evenly across color group.');
        return;
      }

      const returnMoney = Math.floor(tile.housePrice / 2);
      player.money += returnMoney;
      tile.houses -= 1;
      addSystemChatMessage(room, io, `🧱 ${player.name} sold a house on ${tile.name} for $${returnMoney}.`);
      
      updateNetWorth(room, player.id);

      // Check if debt resolved
      if (room.monopolyPhase === 'bankrupt_decision' && room.activeDebt && player.id === room.activeDebt.from) {
        if (player.money >= room.activeDebt.amountValue) {
          const debt = room.activeDebt;
          player.money -= debt.amountValue;
          if (debt.to !== 'bank') {
            const creditor = room.players.find(p => p.id === debt.to);
            if (creditor) creditor.money += debt.amountValue;
            addSystemChatMessage(room, io, `${player.name} paid $${debt.amountValue} debt to ${creditor.name}.`);
            updateNetWorth(room, creditor.id);
          } else {
            addSystemChatMessage(room, io, `${player.name} paid $${debt.amountValue} debt to the bank.`);
          }
          if (debt.payoutPlayers) {
            debt.payoutPlayers.forEach(payout => {
              const recipient = room.players.find(p => p.id === payout.id);
              if (recipient && !recipient.bankrupt) {
                recipient.money += payout.share;
                updateNetWorth(room, recipient.id);
              }
            });
          }
          room.activeDebt = null;
          updateNetWorth(room, player.id);
          
          if (player.doublesRolled) {
            player.doublesRolled = false;
            room.monopolyPhase = 'roll';
          } else {
            room.monopolyPhase = 'end_turn';
          }
        }
      }

      broadcastGameUpdate(room, io);
      break;
    }

    case 'mortgage-property': {
      const tileIndex = payload;
      const tile = room.monopolyBoard[tileIndex];
      if (!tile || tile.owner !== player.id || tile.mortgaged || !tile.mortgageValue) return;

      // Cannot mortgage if color group has houses
      if (tile.type === 'property') {
        const colorGroup = room.monopolyBoard.filter(t => t.type === 'property' && t.color === tile.color);
        const hasHouses = colorGroup.some(t => t.houses > 0);
        if (hasHouses) {
          socket.emit('monopoly-error', 'Must sell all houses in the color group before mortgaging.');
          return;
        }
      }

      tile.mortgaged = true;
      player.money += tile.mortgageValue;
      addSystemChatMessage(room, io, `🏦 ${player.name} mortgaged ${tile.name} for $${tile.mortgageValue}.`);
      updateNetWorth(room, player.id);

      // Check if debt resolved
      if (room.monopolyPhase === 'bankrupt_decision' && room.activeDebt && player.id === room.activeDebt.from) {
        if (player.money >= room.activeDebt.amountValue) {
          const debt = room.activeDebt;
          player.money -= debt.amountValue;
          if (debt.to !== 'bank') {
            const creditor = room.players.find(p => p.id === debt.to);
            if (creditor) creditor.money += debt.amountValue;
            addSystemChatMessage(room, io, `${player.name} paid $${debt.amountValue} debt to ${creditor.name}.`);
            updateNetWorth(room, creditor.id);
          } else {
            addSystemChatMessage(room, io, `${player.name} paid $${debt.amountValue} debt to the bank.`);
          }
          if (debt.payoutPlayers) {
            debt.payoutPlayers.forEach(payout => {
              const recipient = room.players.find(p => p.id === payout.id);
              if (recipient && !recipient.bankrupt) {
                recipient.money += payout.share;
                updateNetWorth(room, recipient.id);
              }
            });
          }
          room.activeDebt = null;
          updateNetWorth(room, player.id);

          if (player.doublesRolled) {
            player.doublesRolled = false;
            room.monopolyPhase = 'roll';
          } else {
            room.monopolyPhase = 'end_turn';
          }
        }
      }

      broadcastGameUpdate(room, io);
      break;
    }

    case 'unmortgage-property': {
      const tileIndex = payload;
      const tile = room.monopolyBoard[tileIndex];
      if (!tile || tile.owner !== player.id || !tile.mortgaged || !tile.mortgageValue) return;

      const unmortgageCost = Math.floor(tile.mortgageValue * 1.1); // +10% interest
      if (player.money >= unmortgageCost) {
        player.money -= unmortgageCost;
        tile.mortgaged = false;
        addSystemChatMessage(room, io, `🏦 ${player.name} unmortgaged ${tile.name} for $${unmortgageCost}.`);
        updateNetWorth(room, player.id);
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'declare-bankruptcy': {
      if (room.monopolyPhase !== 'bankrupt_decision') return;
      handleBankruptcyResolution(room, player, io);
      break;
    }

    case 'end-turn': {
      if (room.monopolyPhase !== 'end_turn') return;
      
      // Advance turn
      room.turnIndex = getNextActiveTurnIndex(room);
      room.monopolyPhase = 'roll';
      
      // Reset player rolls
      const nextPlayer = room.players[room.turnIndex];
      nextPlayer.rollCount = 0;
      nextPlayer.doublesRolled = false;

      addSystemChatMessage(room, io, `Turn passed to ${nextPlayer.name}.`);

      broadcastGameUpdate(room, io);
      break;
    }

    case 'auction-bid': {
      if (room.monopolyPhase !== 'auction' || !room.auctionState) return;
      const { bid } = payload || {};
      const activeBidderId = room.auctionState.bidders[room.auctionState.activeBidderIndex];
      const authorized = activeBidderId === socket.id || (room.players.find(p => p.id === activeBidderId)?.isBot && room.players.find(p => p.id === socket.id)?.isHost);
      if (!authorized) return;

      const bidder = room.players.find(p => p.id === activeBidderId);
      if (bidder && bid > room.auctionState.highestBid && bidder.money >= bid) {
        if (room.auctionState.bidders.length === 1) {
          const tile = room.monopolyBoard[room.auctionState.tileIndex];
          if (tile) {
            bidder.money -= bid;
            tile.owner = activeBidderId;
            addSystemChatMessage(room, io, `🏆 ${bidder.name} won the auction and bought ${tile.name} for $${bid}!`);
            updateNetWorth(room, activeBidderId);
            const originalPlayer = room.players[room.turnIndex];
            resumeAfterAuction(room, originalPlayer, io);
          }
        } else {
          room.auctionState.highestBid = bid;
          room.auctionState.highestBidder = activeBidderId;
          room.auctionState.activeBidderIndex = (room.auctionState.activeBidderIndex + 1) % room.auctionState.bidders.length;
          addSystemChatMessage(room, io, `💰 ${bidder.name} bid $${bid}.`);
        }
        broadcastGameUpdate(room, io);
      }
      break;
    }

    case 'auction-pass': {
      if (room.monopolyPhase !== 'auction' || !room.auctionState) return;
      const activeBidderId = room.auctionState.bidders[room.auctionState.activeBidderIndex];
      const authorized = activeBidderId === socket.id || (room.players.find(p => p.id === activeBidderId)?.isBot && room.players.find(p => p.id === socket.id)?.isHost);
      if (!authorized) return;

      const bidder = room.players.find(p => p.id === activeBidderId);
      if (bidder) {
        addSystemChatMessage(room, io, `❌ ${bidder.name} passed in the auction.`);
        room.auctionState.bidders = room.auctionState.bidders.filter(id => id !== activeBidderId);
        
        if (room.auctionState.bidders.length === 0) {
          // No winner
          const tile = room.monopolyBoard[room.auctionState.tileIndex];
          addSystemChatMessage(room, io, `🎲 Auction ended. No one bought ${tile.name}.`);
          const originalPlayer = room.players[room.turnIndex];
          resumeAfterAuction(room, originalPlayer, io);
        } else {
          if (room.auctionState.activeBidderIndex >= room.auctionState.bidders.length) {
            room.auctionState.activeBidderIndex = 0;
          }
          
          if (room.auctionState.bidders.length === 1 && room.auctionState.highestBidder !== null) {
            // One bidder left and there's a bid -> they win!
            const winnerId = room.auctionState.highestBidder;
            const winner = room.players.find(p => p.id === winnerId);
            const tile = room.monopolyBoard[room.auctionState.tileIndex];
            
            if (winner && tile) {
              winner.money -= room.auctionState.highestBid;
              tile.owner = winnerId;
              addSystemChatMessage(room, io, `🏆 ${winner.name} won the auction and bought ${tile.name} for $${room.auctionState.highestBid}!`);
              updateNetWorth(room, winnerId);
              
              const originalPlayer = room.players[room.turnIndex];
              resumeAfterAuction(room, originalPlayer, io);
            }
          }
        }
        broadcastGameUpdate(room, io);
      }
      break;
    }

    case 'trade-propose': {
      if (!['roll', 'end_turn', 'action'].includes(room.monopolyPhase)) return;
      const {
        receiverId,
        senderProperties,
        senderMoney,
        receiverProperties,
        receiverMoney,
        senderJailCards,
        receiverJailCards
      } = payload || {};

      const sender = room.players.find(p => p.id === socket.id);
      const receiver = room.players.find(p => p.id === receiverId);
      if (!sender || !receiver || sender.bankrupt || receiver.bankrupt) return;

      if (senderMoney > sender.money || receiverMoney > receiver.money) return;
      if (senderJailCards > sender.getOutOfJailCards || receiverJailCards > receiver.getOutOfJailCards) return;

      const checkPropertiesValid = (propIndices, ownerId) => {
        for (const idx of propIndices) {
          const tile = room.monopolyBoard[idx];
          if (!tile || tile.owner !== ownerId) return false;
          if (tile.type === 'property') {
            const colorGroup = room.monopolyBoard.filter(t => t.color === tile.color);
            if (colorGroup.some(t => t.houses > 0)) return false;
          }
        }
        return true;
      };

      if (!checkPropertiesValid(senderProperties, sender.id)) return;
      if (!checkPropertiesValid(receiverProperties, receiver.id)) return;

      room.activeTrade = {
        senderId: sender.id,
        receiverId: receiver.id,
        senderProperties,
        senderMoney,
        receiverProperties,
        receiverMoney,
        senderJailCards,
        receiverJailCards,
        status: 'pending'
      };

      addSystemChatMessage(room, io, `🤝 ${sender.name} proposed a trade to ${receiver.name}.`);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'trade-accept': {
      if (!room.activeTrade) return;
      
      const { senderId, receiverId, senderProperties, senderMoney, receiverProperties, receiverMoney, senderJailCards, receiverJailCards } = room.activeTrade;
      const authorized = receiverId === socket.id || (room.players.find(p => p.id === receiverId)?.isBot && room.players.find(p => p.id === socket.id)?.isHost);
      if (!authorized) return;

      const sender = room.players.find(p => p.id === senderId);
      const receiver = room.players.find(p => p.id === receiverId);
      if (!sender || !receiver || sender.bankrupt || receiver.bankrupt) {
        room.activeTrade = null;
        broadcastGameUpdate(room, io);
        return;
      }

      if (sender.money < senderMoney || receiver.money < receiverMoney) {
        room.activeTrade = null;
        addSystemChatMessage(room, io, `❌ Trade failed: players do not have enough money.`);
        broadcastGameUpdate(room, io);
        return;
      }
      if (sender.getOutOfJailCards < senderJailCards || receiver.getOutOfJailCards < receiverJailCards) {
        room.activeTrade = null;
        addSystemChatMessage(room, io, `❌ Trade failed: players do not have enough jail cards.`);
        broadcastGameUpdate(room, io);
        return;
      }

      const checkProps = (props, ownerId) => props.every(idx => room.monopolyBoard[idx] && room.monopolyBoard[idx].owner === ownerId);
      if (!checkProps(senderProperties, senderId) || !checkProps(receiverProperties, receiverId)) {
        room.activeTrade = null;
        addSystemChatMessage(room, io, `❌ Trade failed: property ownership changed.`);
        broadcastGameUpdate(room, io);
        return;
      }

      senderProperties.forEach(idx => { room.monopolyBoard[idx].owner = receiverId; });
      receiverProperties.forEach(idx => { room.monopolyBoard[idx].owner = senderId; });

      sender.money = sender.money - senderMoney + receiverMoney;
      receiver.money = receiver.money - receiverMoney + senderMoney;

      sender.getOutOfJailCards = sender.getOutOfJailCards - senderJailCards + receiverJailCards;
      receiver.getOutOfJailCards = receiver.getOutOfJailCards - receiverJailCards + senderJailCards;

      updateNetWorth(room, sender.id);
      updateNetWorth(room, receiver.id);

      addSystemChatMessage(room, io, `🤝 Trade accepted! Assets exchanged between ${sender.name} and ${receiver.name}.`);
      room.activeTrade = null;
      broadcastGameUpdate(room, io);
      break;
    }

    case 'trade-decline': {
      if (!room.activeTrade) return;
      const { senderId, receiverId } = room.activeTrade;
      const authorized = receiverId === socket.id || senderId === socket.id || (room.players.find(p => p.id === receiverId)?.isBot && room.players.find(p => p.id === socket.id)?.isHost);
      if (!authorized) return;

      const receiver = room.players.find(p => p.id === receiverId);
      addSystemChatMessage(room, io, `❌ Trade offer declined${receiver ? ` by ${receiver.name}` : ''}.`);
      room.activeTrade = null;
      broadcastGameUpdate(room, io);
      break;
    }

    case 'trade-counter': {
      if (!room.activeTrade) return;
      const { senderId, receiverId } = room.activeTrade;
      const authorized = receiverId === socket.id || (room.players.find(p => p.id === receiverId)?.isBot && room.players.find(p => p.id === socket.id)?.isHost);
      if (!authorized) return;

      room.activeTrade.status = 'countering';
      const receiver = room.players.find(p => p.id === receiverId);
      const sender = room.players.find(p => p.id === senderId);
      addSystemChatMessage(room, io, `🔄 ${receiver ? receiver.name : 'Opponent'} is preparing a counter offer to ${sender ? sender.name : 'player'}.`);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'trade-cancel': {
      if (!room.activeTrade) return;
      const { senderId } = room.activeTrade;
      if (senderId !== socket.id) return;

      addSystemChatMessage(room, io, `Trade offer canceled.`);
      room.activeTrade = null;
      broadcastGameUpdate(room, io);
      break;
    }
  }
}
