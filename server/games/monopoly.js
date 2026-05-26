// server/games/monopoly.js
// Backend Monopoly Engine for capsa multiplayer/singleplayer

const BOARD_TILES = [
  { index: 0, name: 'GO', type: 'go' },
  { index: 1, name: 'Bandung', type: 'property', color: 'brown', price: 60, rent: [2, 4, 10, 30, 90, 160, 250], housePrice: 50, mortgageValue: 30 },
  { index: 2, name: 'Community Chest', type: 'chest' },
  { index: 3, name: 'Jakarta', type: 'property', color: 'brown', price: 60, rent: [4, 8, 20, 60, 180, 320, 450], housePrice: 50, mortgageValue: 30 },
  { index: 4, name: 'Income Tax', type: 'tax', price: 200 },
  { index: 5, name: 'Orient Express', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 6, name: 'Zaragoza', type: 'property', color: 'lightblue', price: 100, rent: [6, 12, 30, 90, 270, 400, 550], housePrice: 50, mortgageValue: 50 },
  { index: 7, name: 'Chance', type: 'chance' },
  { index: 8, name: 'Valencia', type: 'property', color: 'lightblue', price: 100, rent: [6, 12, 30, 90, 270, 400, 550], housePrice: 50, mortgageValue: 50 },
  { index: 9, name: 'Barcelona', type: 'property', color: 'lightblue', price: 120, rent: [8, 16, 40, 100, 300, 450, 600], housePrice: 50, mortgageValue: 60 },
  { index: 10, name: 'Jail / Just Visiting', type: 'jail' },
  { index: 11, name: 'Adelaide', type: 'property', color: 'pink', price: 140, rent: [10, 20, 50, 150, 450, 625, 750], housePrice: 100, mortgageValue: 70 },
  { index: 12, name: 'Bali', type: 'utility', price: 150, rent: [4, 10], mortgageValue: 75 }, // Bali tourist spot
  { index: 13, name: 'Melbourne', type: 'property', color: 'pink', price: 140, rent: [10, 20, 50, 150, 450, 625, 750], housePrice: 100, mortgageValue: 70 },
  { index: 14, name: 'Sydney', type: 'property', color: 'pink', price: 160, rent: [12, 24, 60, 180, 500, 700, 900], housePrice: 100, mortgageValue: 80 },
  { index: 15, name: 'Trans-Siberian Railway', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 16, name: 'Cologne', type: 'property', color: 'orange', price: 180, rent: [14, 28, 70, 200, 550, 750, 950], housePrice: 100, mortgageValue: 90 },
  { index: 17, name: 'Community Chest', type: 'chest' },
  { index: 18, name: 'Frankfurt', type: 'property', color: 'orange', price: 180, rent: [14, 28, 70, 200, 550, 750, 950], housePrice: 100, mortgageValue: 90 },
  { index: 19, name: 'Berlin', type: 'property', color: 'orange', price: 200, rent: [16, 32, 80, 220, 600, 800, 1000], housePrice: 100, mortgageValue: 100 },
  { index: 20, name: 'Free Parking', type: 'parking' },
  { index: 21, name: 'Chengdu', type: 'property', color: 'red', price: 220, rent: [18, 36, 90, 250, 700, 875, 1050], housePrice: 150, mortgageValue: 110 },
  { index: 22, name: 'Chance', type: 'chance' },
  { index: 23, name: 'Beijing', type: 'property', color: 'red', price: 220, rent: [18, 36, 90, 250, 700, 875, 1050], housePrice: 150, mortgageValue: 110 },
  { index: 24, name: 'Shanghai', type: 'property', color: 'red', price: 240, rent: [20, 40, 100, 300, 750, 925, 1100], housePrice: 150, mortgageValue: 120 },
  { index: 25, name: 'Eurostar', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 26, name: 'Naples', type: 'property', color: 'yellow', price: 260, rent: [22, 44, 110, 330, 800, 975, 1150], housePrice: 150, mortgageValue: 130 },
  { index: 27, name: 'Florence', type: 'property', color: 'yellow', price: 260, rent: [22, 44, 110, 330, 800, 975, 1150], housePrice: 150, mortgageValue: 130 },
  { index: 28, name: 'Hawaii', type: 'utility', price: 150, rent: [4, 10], mortgageValue: 75 }, // Hawaii tourist spot
  { index: 29, name: 'Rome', type: 'property', color: 'yellow', price: 280, rent: [24, 48, 120, 360, 850, 1025, 1200], housePrice: 150, mortgageValue: 140 },
  { index: 30, name: 'Go To Jail', type: 'gotojail' },
  { index: 31, name: 'Fukuoka', type: 'property', color: 'green', price: 300, rent: [26, 52, 130, 390, 900, 1100, 1275], housePrice: 200, mortgageValue: 150 },
  { index: 32, name: 'Osaka', type: 'property', color: 'green', price: 300, rent: [26, 52, 130, 390, 900, 1100, 1275], housePrice: 200, mortgageValue: 150 },
  { index: 33, name: 'Community Chest', type: 'chest' },
  { index: 34, name: 'Tokyo', type: 'property', color: 'green', price: 320, rent: [28, 56, 150, 450, 1000, 1200, 1400], housePrice: 200, mortgageValue: 160 },
  { index: 35, name: 'Shinkansen', type: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { index: 36, name: 'Chance', type: 'chance' },
  { index: 37, name: 'Los Angeles', type: 'property', color: 'darkblue', price: 350, rent: [35, 70, 175, 500, 1100, 1300, 1500], housePrice: 200, mortgageValue: 175 },
  { index: 38, name: 'Luxury Tax', type: 'tax', price: 100 },
  { index: 39, name: 'New York City', type: 'property', color: 'darkblue', price: 400, rent: [50, 100, 200, 600, 1400, 1700, 2000], housePrice: 200, mortgageValue: 200 }
];

const CHANCE_CARDS = [
  { id: 'ch_go', text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
  { id: 'ch_boardwalk', text: 'Advance to New York City', action: 'move', target: 39 },
  { id: 'ch_illinois', text: 'Advance to Shanghai', action: 'move', target: 24 },
  { id: 'ch_stcharles', text: 'Advance to Adelaide', action: 'move', target: 11 },
  { id: 'ch_railroad', text: 'Advance to nearest Transit Line (Railroad). If unowned, buy it. If owned, pay double rent.', action: 'nearest_railroad' },
  { id: 'ch_utility', text: 'Advance to nearest Tourist Spot (Bali or Hawaii). If unowned, buy it. If owned, throw dice and pay 10 times multiplier.', action: 'nearest_utility' },
  { id: 'ch_dividend', text: 'Bank pays you dividend of $50', action: 'give_money', amount: 50 },
  { id: 'ch_jail_free', text: 'Get Out of Jail Free card', action: 'jail_free' },
  { id: 'ch_back3', text: 'Go Back 3 Spaces', action: 'back_spaces', amount: 3 },
  { id: 'ch_goto_jail', text: 'Go directly to Jail. Do not pass GO, do not collect $200.', action: 'goto_jail' },
  { id: 'ch_repairs', text: 'Make general repairs on all your property. Pay $25 per house and $100 per hotel.', action: 'repairs', houseCost: 25, hotelCost: 100 },
  { id: 'ch_speeding', text: 'Speeding fine $15', action: 'take_money', amount: 15 },
  { id: 'ch_reading', text: 'Take a trip to Orient Express. If you pass GO, collect $200.', action: 'move', target: 5 },
  { id: 'ch_chairman', text: 'You have been elected Chairman of the Board. Pay each player $50.', action: 'pay_each', amount: 50 },
  { id: 'ch_odd_even', text: '🎯 Odd/Even Card! Use before rolling to force your dice result to be odd or even.', action: 'give_odd_even' },
  { id: 'ch_angel', text: '😇 Angel Card! Use to skip paying rent OR block a forced acquisition once.', action: 'give_angel' }
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
  { id: 'cc_inherit', text: 'You inherit $100.', action: 'give_money', amount: 100 },
  { id: 'cc_odd_even', text: '🎯 Odd/Even Card! Use before rolling to force your dice result to be odd or even.', action: 'give_odd_even' },
  { id: 'cc_angel', text: '😇 Angel Card! Use to skip paying rent OR block a forced acquisition once.', action: 'give_angel' }
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
  room.monopolyTurnCount = 0;

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
  const startMoney = room.rules && room.rules.startingCash ? Number(room.rules.startingCash) : 1500;
  room.players.forEach((p, idx) => {
    p.money = startMoney;
    p.position = 0;
    p.inJail = false;
    p.jailTurns = 0;
    p.getOutOfJailCards = 0;
    p.bankrupt = false;
    p.lastRoll = [1, 1];
    p.rollCount = 0; // standard double counter (reset on turn start)
    p.netWorth = startMoney;
    p.passed = false;
    p.lastPlay = null;
    p.status = null;
    // Get Rich consumable cards
    p.oddEvenCards = 0;
    p.angelCards = 0;
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

function checkTurnLimit(room, io) {
  const limit = room.rules && room.rules.turnLimit ? Number(room.rules.turnLimit) : 0;
  if (limit > 0 && (room.monopolyTurnCount || 0) >= limit) {
    room.gameState = 'gameover';
    
    // Find all non-bankrupt players
    const activePlayers = room.players.filter(p => !p.bankrupt);
    
    // Sort by netWorth descending
    activePlayers.sort((a, b) => b.netWorth - a.netWorth);
    
    const winner = activePlayers[0];
    
    addSystemChatMessage(room, io, `⏱️ Turn limit of ${limit} reached!`);
    addSystemChatMessage(room, io, `🏆 ${winner.name} wins with a net worth of $${winner.netWorth}! 🏆`);
    
    // Assign finish ranks to all players
    const sortedAll = [...room.players];
    sortedAll.sort((a, b) => {
      if (a.bankrupt && !b.bankrupt) return 1;
      if (!a.bankrupt && b.bankrupt) return -1;
      return b.netWorth - a.netWorth;
    });
    
    room.players.forEach(p => {
      const rank = sortedAll.findIndex(sa => sa.id === p.id) + 1;
      p.finishRank = rank;
      p.score = p.netWorth;
    });
    
    io.to(room.code).emit('round-over', getSanitizedRoomState(room, ''));
    return true;
  }
  return false;
}

function calculateRent(tile, board, diceSum, chanceDoubleMultiplier = false) {
  let base = 0;
  if (tile.type === 'property') {
    const isMonopoly = ownsMonopoly(board, tile.color, tile.owner);
    if (tile.houses === 0) {
      base = isMonopoly ? tile.rent[0] * 2 : tile.rent[0];
    } else {
      base = tile.rent[tile.houses];
    }
  } else if (tile.type === 'railroad') {
    const count = board.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
    const baseRent = tile.rent[Math.min(count - 1, 3)];
    base = chanceDoubleMultiplier ? baseRent * 2 : baseRent;
  } else if (tile.type === 'utility') {
    const count = board.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
    const mult = count === 2 ? 10 : 4;
    const finalMult = chanceDoubleMultiplier ? 10 : mult;
    base = diceSum * finalMult;
  }

  // Festival doubles rent for 3 turns
  if (tile.festivalTurns && tile.festivalTurns > 0) {
    base = base * 2;
  }

  return base;
}

function handleLandedAction(room, player, diceSum, io, chanceDoubleMultiplier = false) {
  const tile = room.monopolyBoard[player.position];
  const isGetRich = room.rules && room.rules.ruleset === 'Get Rich';
  
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
      if (isGetRich && tile.type === 'property' && tile.houses < 5) {
        // Get Rich: offer instant build on landing
        room.monopolyPhase = 'landed_build';
        room.landedBuildMaxHouses = tile.houses === 4 ? 5 : 4;
      } else {
        setEndTurnPhase(room, player, io);
      }
    } else if (tile.mortgaged) {
      // Mortgaged property: no rent
      addSystemChatMessage(room, io, `${player.name} landed on ${tile.name} (Mortgaged by owner). No rent paid.`);
      setEndTurnPhase(room, player, io);
    } else {
      // Rent payment
      const owner = room.players.find(p => p.id === tile.owner);
      const rentAmount = calculateRent(tile, room.monopolyBoard, diceSum, chanceDoubleMultiplier);
      
      addSystemChatMessage(room, io, `${player.name} landed on ${tile.name} and owes ${owner.name} $${rentAmount} rent.`);

      // Get Rich: Angel Card can skip rent
      if (isGetRich && player.angelCards > 0) {
        room.monopolyPhase = 'use_angel_rent';
        room.pendingRent = { fromId: player.id, toId: owner.id, amount: rentAmount };
        return;
      }
      
      triggerPayment(room, player, owner, rentAmount, io);

      // Get Rich: After paying rent, offer forced acquisition
      if (isGetRich && room.monopolyPhase !== 'bankrupt_decision') {
        const tileWorth = (tile.price || 0) + (tile.houses || 0) * (tile.housePrice || 0);
        // Cannot force-acquire hotels (houses === 5)
        if (tile.houses < 5 && player.money >= tileWorth) {
          if (owner.angelCards > 0) {
            room.monopolyPhase = 'use_angel_force';
            room.pendingForceAcquire = { byId: player.id, tileIndex: tile.index, worth: tileWorth };
          } else {
            room.monopolyPhase = 'force_acquire_decision';
            room.pendingForceAcquire = { byId: player.id, tileIndex: tile.index, worth: tileWorth };
          }
        }
      }
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
    if (isGetRich) {
      // Festival: choose a property to double its rent for 3 turns
      const ownedProps = room.monopolyBoard.filter(t =>
        (t.type === 'property' || t.type === 'railroad' || t.type === 'utility') && t.owner === player.id
      );
      if (ownedProps.length > 0) {
        addSystemChatMessage(room, io, `🎉 ${player.name} landed on Festival! Choose a property to double rent for 3 turns.`);
        room.monopolyPhase = 'festival_selection';
      } else {
        addSystemChatMessage(room, io, `🎉 ${player.name} landed on Festival! No properties to boost.`);
        setEndTurnPhase(room, player, io);
      }
    } else {
      addSystemChatMessage(room, io, `${player.name} relaxes at Free Parking!`);
      setEndTurnPhase(room, player, io);
    }
    return;
  }

  if (tile.type === 'gotojail') {
    if (isGetRich) {
      // Airport: pay $100 to fly anywhere
      if (player.money >= 100) {
        addSystemChatMessage(room, io, `✈️ ${player.name} landed on the Airport! Pay $100 to fly to any tile.`);
        room.monopolyPhase = 'airport_selection';
      } else {
        addSystemChatMessage(room, io, `✈️ ${player.name} landed on the Airport but can't afford the $100 fare.`);
        setEndTurnPhase(room, player, io);
      }
    } else {
      sendPlayerToJail(room, player, io);
    }
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
  const isGetRich = room.rules && room.rules.ruleset === 'Get Rich';
  let allCards = type === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  // In Default mode, filter out Get Rich exclusive cards
  if (!isGetRich) {
    allCards = allCards.filter(c => c.action !== 'give_odd_even' && c.action !== 'give_angel');
  }

  let card;
  if (room.nextForcedCard && room.nextForcedCard.type === type) {
    const forcedActionOrId = room.nextForcedCard.cardActionOrId;
    const matched = allCards.find(c => c.id === forcedActionOrId || c.action === forcedActionOrId);
    if (matched) {
      card = matched;
      addSystemChatMessage(room, io, `🔧 Dev Console: Forced next ${type} card.`);
    }
    delete room.nextForcedCard;
  }

  if (!card) {
    let deck = type === 'chance' ? room.chanceDeck : room.chestDeck;
    if (deck.length === 0) {
      deck = shuffle(allCards);
      if (type === 'chance') room.chanceDeck = deck;
      else room.chestDeck = deck;
    }
    card = deck.pop();
  }

  room.currentCard = card;
  room.cardType = type;
  room.monopolyPhase = 'card_drawn';

  addSystemChatMessage(room, io, `✉️ ${player.name} drew a ${type.toUpperCase()} card: "${card.text}"`);
}

function resolveCardAction(room, player, io, diceSum) {  // eslint-disable-line
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

    const tile = room.monopolyBoard[curr];
    if (tile.owner !== null && tile.owner !== player.id && !tile.mortgaged) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      room.dice = [d1, d2];
      room.rollId = Math.random().toString(36).substring(2, 9);
      addSystemChatMessage(room, io, `🎲 Rolled ${d1}+${d2}=${sum} for Utility multiplier rent.`);
      handleLandedAction(room, player, sum, io, true);
    } else {
      handleLandedAction(room, player, diceSum, io, true);
    }
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

  // Get Rich: Odd/Even card
  if (card.action === 'give_odd_even') {
    player.oddEvenCards = Math.min((player.oddEvenCards || 0) + 1, 1);
    addSystemChatMessage(room, io, `🎯 ${player.name} received an Odd/Even Card!`);
    setEndTurnPhase(room, player, io);
    return;
  }

  // Get Rich: Angel card
  if (card.action === 'give_angel') {
    player.angelCards = Math.min((player.angelCards || 0) + 1, 1);
    addSystemChatMessage(room, io, `😇 ${player.name} received an Angel Card!`);
    setEndTurnPhase(room, player, io);
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
    
    // Reset rollCount and doublesRolled for the next active player
    const nextPlayer = room.players[room.turnIndex];
    if (nextPlayer) {
      nextPlayer.rollCount = 0;
      nextPlayer.doublesRolled = false;
    }
  }

  // Broadcast the update to all clients so they sync and trigger bot logic/UI updates
  broadcastGameUpdate(room, io);
}

function handleDevCommand(room, payload, io) {
  const { commandStr } = payload;
  if (!commandStr) return;

  const parts = commandStr.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  addSystemChatMessage(room, io, `🔧 Dev Console executed: "${commandStr}"`);

  switch (cmd) {
    case 'setmoney': {
      if (args.length < 2) return;
      const targetSearch = args[0].toLowerCase();
      const amount = parseInt(args[1], 10);
      if (isNaN(amount)) return;

      const targetPlayer = room.players.find(p => p.id === args[0] || p.name.toLowerCase().includes(targetSearch));
      if (targetPlayer) {
        targetPlayer.money = amount;
        addSystemChatMessage(room, io, `🔧 Dev Console: Set ${targetPlayer.name}'s money to $${amount}.`);
        broadcastGameUpdate(room, io);
      }
      break;
    }
    case 'setroll': {
      if (args.length < 2) return;
      const d1 = parseInt(args[0], 10);
      const d2 = parseInt(args[1], 10);
      if (isNaN(d1) || isNaN(d2) || d1 < 1 || d1 > 6 || d2 < 1 || d2 > 6) return;

      room.nextForcedRoll = [d1, d2];
      addSystemChatMessage(room, io, `🔧 Dev Console: Next dice roll forced to [${d1}, ${d2}].`);
      break;
    }
    case 'setnextcard': {
      if (args.length < 2) return;
      const type = args[0].toLowerCase();
      const cardActionOrId = args[1].toLowerCase();
      if (type !== 'chance' && type !== 'chest') return;

      room.nextForcedCard = { type, cardActionOrId };
      addSystemChatMessage(room, io, `🔧 Dev Console: Next ${type} card forced to match "${cardActionOrId}".`);
      break;
    }
    case 'teleport': {
      if (args.length < 2) return;
      const targetSearch = args[0].toLowerCase();
      const tileIndex = parseInt(args[1], 10);
      if (isNaN(tileIndex) || tileIndex < 0 || tileIndex > 39) return;

      const targetPlayer = room.players.find(p => p.id === args[0] || p.name.toLowerCase().includes(targetSearch));
      if (targetPlayer) {
        targetPlayer.position = tileIndex;
        addSystemChatMessage(room, io, `🔧 Dev Console: Teleported ${targetPlayer.name} to ${room.monopolyBoard[tileIndex].name} (${tileIndex}).`);
        broadcastGameUpdate(room, io);
      }
      break;
    }
    case 'addcard': {
      if (args.length < 2) return;
      const targetSearch = args[0].toLowerCase();
      const cardType = args[1].toLowerCase();

      const targetPlayer = room.players.find(p => p.id === args[0] || p.name.toLowerCase().includes(targetSearch));
      if (targetPlayer) {
        if (cardType === 'angel') {
          targetPlayer.angelCards = (targetPlayer.angelCards || 0) + 1;
          addSystemChatMessage(room, io, `🔧 Dev Console: Gave 1 Angel card to ${targetPlayer.name}.`);
        } else if (cardType === 'odd_even') {
          targetPlayer.oddEvenCards = (targetPlayer.oddEvenCards || 0) + 1;
          addSystemChatMessage(room, io, `🔧 Dev Console: Gave 1 Odd/Even card to ${targetPlayer.name}.`);
        }
        broadcastGameUpdate(room, io);
      }
      break;
    }
    case 'bankrupt': {
      if (args.length < 1) return;
      const targetSearch = args[0].toLowerCase();

      const targetPlayer = room.players.find(p => p.id === args[0] || p.name.toLowerCase().includes(targetSearch));
      if (targetPlayer && !targetPlayer.bankrupt) {
        targetPlayer.bankrupt = true;
        room.monopolyBoard.forEach(t => {
          if (t.owner === targetPlayer.id) {
            t.owner = null;
            t.houses = 0;
          }
        });
        addSystemChatMessage(room, io, `☠️ Dev Console: Bankrupted ${targetPlayer.name}. All their properties are released.`);
        
        const activeOthers = room.players.filter(p => !p.bankrupt);
        if (activeOthers.length <= 1) {
          room.gameState = 'gameover';
        } else {
          const activePlayer = room.players[room.turnIndex];
          if (activePlayer.id === targetPlayer.id) {
            let nextTurn = room.turnIndex;
            for (let i = 0; i < room.players.length; i++) {
              nextTurn = (nextTurn + 1) % room.players.length;
              if (!room.players[nextTurn].bankrupt) break;
            }
            room.turnIndex = nextTurn;
            room.monopolyPhase = 'roll';
          }
        }
        broadcastGameUpdate(room, io);
      }
      break;
    }
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
    'trade-counter',
    'set-player-status',
    'dev-command'
  ].includes(action);

  if (action === 'dev-command') {
    const sender = room.players.find(p => p.id === socket.id);
    if (!sender || !sender.isHost) return;
    handleDevCommand(room, payload, io);
    return;
  }

  if (!bypassTurnAuth) {
    // Authorization: check if this player owns the turn
    const isAuthorized = player.id === socket.id || (player.isBot && room.players.find(p => p.id === socket.id)?.isHost);
    if (!isAuthorized) return;
  }

  switch (action) {
    case 'roll-dice': {
      if (room.monopolyPhase !== 'roll' || player.inJail) return;

      const isGetRich = room.rules && room.rules.ruleset === 'Get Rich';
      let d1, d2;

      if (isGetRich && payload && payload.power !== undefined) {
        // Power bar: map power% to dice sum range
        const power = payload.power; // 0-100
        let minSum, maxSum;
        if (power <= 33) { minSum = 2; maxSum = 4; }
        else if (power <= 66) { minSum = 5; maxSum = 8; }
        else { minSum = 9; maxSum = 12; }

        const oddEvenChoice = payload.oddEvenChoice || null;
        // Consume the Odd/Even card if used
        if (oddEvenChoice && player.oddEvenCards > 0) {
          player.oddEvenCards -= 1;
        }

        // Generate dice in valid range + parity
        let attempts = 0;
        do {
          d1 = Math.floor(Math.random() * 6) + 1;
          d2 = Math.floor(Math.random() * 6) + 1;
          const s = d1 + d2;
          const parityOk = !oddEvenChoice ||
            (oddEvenChoice === 'odd' && s % 2 === 1) ||
            (oddEvenChoice === 'even' && s % 2 === 0);
          const rangeOk = s >= minSum && s <= maxSum;
          if (rangeOk && parityOk) break;
          attempts++;
        } while (attempts < 200);
      } else {
        if (room.nextForcedRoll) {
          d1 = room.nextForcedRoll[0];
          d2 = room.nextForcedRoll[1];
          delete room.nextForcedRoll;
          addSystemChatMessage(room, io, `🔧 Dev Console: Applied forced roll [${d1}, ${d2}].`);
        } else {
          d1 = Math.floor(Math.random() * 6) + 1;
          d2 = Math.floor(Math.random() * 6) + 1;
        }
      }
      
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

        const isGetRich = room.rules && room.rules.ruleset === 'Get Rich';
        if (isGetRich && tile.type === 'property') {
          room.monopolyPhase = 'landed_build';
          room.landedBuildMaxHouses = 4;
        } else {
          // Resume doubles state if set
          if (player.doublesRolled) {
            player.doublesRolled = false;
            room.monopolyPhase = 'roll';
          } else {
            setEndTurnPhase(room, player, io);
          }
        }
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'pass-property': {
      if (room.monopolyPhase !== 'action') return;
      const tile = room.monopolyBoard[player.position];
      addSystemChatMessage(room, io, `${player.name} passed on buying ${tile.name}.`);
      const isGetRich = room.rules && room.rules.ruleset === 'Get Rich';
      if (isGetRich) {
        resumeAfterAuction(room, player, io);
      } else {
        startPropertyAuction(room, player.position, io);
      }
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

      let d1, d2;
      if (room.nextForcedRoll) {
        d1 = room.nextForcedRoll[0];
        d2 = room.nextForcedRoll[1];
        delete room.nextForcedRoll;
        addSystemChatMessage(room, io, `🔧 Dev Console: Applied forced jail roll [${d1}, ${d2}].`);
      } else {
        d1 = Math.floor(Math.random() * 6) + 1;
        d2 = Math.floor(Math.random() * 6) + 1;
      }
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

      // Cannot mortgage if color group has houses (under Get Rich, only check this tile's houses)
      if (tile.type === 'property') {
        const isGetRich = room.rules && room.rules.ruleset === 'Get Rich';
        if (isGetRich) {
          if (tile.houses > 0) {
            socket.emit('monopoly-error', 'Must sell all houses on this property before mortgaging.');
            return;
          }
        } else {
          const colorGroup = room.monopolyBoard.filter(t => t.type === 'property' && t.color === tile.color);
          const hasHouses = colorGroup.some(t => t.houses > 0);
          if (hasHouses) {
            socket.emit('monopoly-error', 'Must sell all houses in the color group before mortgaging.');
            return;
          }
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

    case 'set-player-status': {
      const sendingPlayer = room.players.find(p => p.id === socket.id);
      if (sendingPlayer) {
        sendingPlayer.status = payload; // 'managing' | 'trading' | null
        broadcastGameUpdate(room, io);
      }
      break;
    }

    case 'end-turn': {
      if (room.monopolyPhase !== 'end_turn') return;
      
      const currentPlayer = room.players[room.turnIndex];
      if (currentPlayer) {
        currentPlayer.status = null;
      }

      // Decrement festivalTurns on all tiles owned by the ending player
      room.monopolyBoard.forEach(tile => {
        if (tile.owner === currentPlayer.id && tile.festivalTurns && tile.festivalTurns > 0) {
          tile.festivalTurns -= 1;
        }
      });

      // Increment turn count
      room.monopolyTurnCount = (room.monopolyTurnCount || 0) + 1;

      // Check turn limit
      const limitReached = checkTurnLimit(room, io);
      if (limitReached) {
        broadcastGameUpdate(room, io);
        return;
      }

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

    case 'festival-select': {
      if (room.monopolyPhase !== 'festival_selection') return;
      const tileIndex = payload;
      const fTile = room.monopolyBoard[tileIndex];
      if (!fTile || fTile.owner !== player.id) return;
      fTile.festivalTurns = 3;
      addSystemChatMessage(room, io, `🎉 ${player.name} boosted ${fTile.name}! Rent doubled for 3 turns.`);
      setEndTurnPhase(room, player, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'festival-skip': {
      if (room.monopolyPhase !== 'festival_selection') return;
      setEndTurnPhase(room, player, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'airport-fly': {
      if (room.monopolyPhase !== 'airport_selection') return;
      const { targetIndex } = payload || {};
      if (targetIndex === undefined || targetIndex < 0 || targetIndex >= 40) return;
      if (player.money < 100) return;
      player.money -= 100;
      const oldPos = player.position;
      player.position = targetIndex;
      if (player.position < oldPos) {
        player.money += 200;
        addSystemChatMessage(room, io, `${player.name} passed GO while flying and collected $200!`);
      }
      addSystemChatMessage(room, io, `✈️ ${player.name} paid $100 and flew to ${room.monopolyBoard[targetIndex].name}.`);
      updateNetWorth(room, player.id);
      const diceSum2 = player.lastRoll[0] + player.lastRoll[1];
      handleLandedAction(room, player, diceSum2, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'airport-skip': {
      if (room.monopolyPhase !== 'airport_selection') return;
      addSystemChatMessage(room, io, `${player.name} skipped the Airport.`);
      setEndTurnPhase(room, player, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'force-acquire': {
      if (room.monopolyPhase !== 'force_acquire_decision' || !room.pendingForceAcquire) return;
      const fa = room.pendingForceAcquire;
      if (fa.byId !== player.id) return;
      const faTile = room.monopolyBoard[fa.tileIndex];
      if (!faTile) return;
      const prevOwner = room.players.find(p => p.id === faTile.owner);
      if (!prevOwner) return;
      if (player.money < fa.worth) return;
      player.money -= fa.worth;
      prevOwner.money += fa.worth;
      faTile.owner = player.id;
      addSystemChatMessage(room, io, `💼 ${player.name} force-acquired ${faTile.name} from ${prevOwner.name} for $${fa.worth}!`);
      updateNetWorth(room, player.id);
      updateNetWorth(room, prevOwner.id);
      room.pendingForceAcquire = null;
      // Set lastActionDetail so client can show "Acquired!" label
      room.lastActionDetail = { type: 'force-acquire', tileIndex: fa.tileIndex };
      if (faTile.houses === 4) {
        room.monopolyPhase = 'landed_build';
        room.landedBuildMaxHouses = 5;
      } else {
        setEndTurnPhase(room, player, io);
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'decline-force-acquire': {
      if (!['force_acquire_decision', 'use_angel_force'].includes(room.monopolyPhase)) return;
      room.pendingForceAcquire = null;
      setEndTurnPhase(room, player, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'use-angel-rent': {
      // Angel card owner decides to skip rent
      if (room.monopolyPhase !== 'use_angel_rent' || !room.pendingRent) return;
      const angelPlayer = room.players.find(p => p.id === room.pendingRent.fromId);
      if (!angelPlayer || angelPlayer.id !== player.id) return;
      if (angelPlayer.angelCards > 0) {
        angelPlayer.angelCards -= 1;
        addSystemChatMessage(room, io, `😇 ${angelPlayer.name} used an Angel Card to skip rent!`);
      }
      room.pendingRent = null;
      setEndTurnPhase(room, player, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'decline-angel-rent': {
      // Player chose not to use Angel card, pay rent normally
      if (room.monopolyPhase !== 'use_angel_rent' || !room.pendingRent) return;
      const dr = room.pendingRent;
      const drDebtor = room.players.find(p => p.id === dr.fromId);
      const drCreditor = room.players.find(p => p.id === dr.toId);
      room.pendingRent = null;
      if (drDebtor && drCreditor) {
        triggerPayment(room, drDebtor, drCreditor, dr.amount, io);
        // Get Rich: Check forced acquisition opportunity after rent
        if (room.monopolyPhase !== 'bankrupt_decision') {
          const drTile = room.monopolyBoard[drDebtor.position];
          if (drTile && drTile.houses < 5) {
            const tileWorth = (drTile.price || 0) + (drTile.houses || 0) * (drTile.housePrice || 0);
            if (drDebtor.money >= tileWorth) {
              if (drCreditor.angelCards > 0) {
                room.monopolyPhase = 'use_angel_force';
                room.pendingForceAcquire = { byId: drDebtor.id, tileIndex: drTile.index, worth: tileWorth };
              } else {
                room.monopolyPhase = 'force_acquire_decision';
                room.pendingForceAcquire = { byId: drDebtor.id, tileIndex: drTile.index, worth: tileWorth };
              }
            }
          }
        }
      }
      broadcastGameUpdate(room, io);
      break;
    }

    case 'use-angel-force': {
      // Property owner uses Angel Card to block force acquisition
      if (room.monopolyPhase !== 'use_angel_force' || !room.pendingForceAcquire) return;
      const fa2 = room.pendingForceAcquire;
      const faTile2 = room.monopolyBoard[fa2.tileIndex];
      if (!faTile2) return;
      const tileOwner2 = room.players.find(p => p.id === faTile2.owner);
      // Auth: the tile owner or the host for bots
      const isAuthOwner = tileOwner2 && (tileOwner2.id === socket.id || (tileOwner2.isBot && room.players.find(p => p.id === socket.id)?.isHost));
      if (!isAuthOwner) return;
      if (tileOwner2.angelCards > 0) {
        tileOwner2.angelCards -= 1;
        addSystemChatMessage(room, io, `😇 ${tileOwner2.name} used an Angel Card to block the force acquisition!`);
      }
      room.pendingForceAcquire = null;
      setEndTurnPhase(room, player, io);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'decline-angel-force': {
      // Property owner chose NOT to use Angel card to block
      if (room.monopolyPhase !== 'use_angel_force' || !room.pendingForceAcquire) return;
      // Transition to force_acquire_decision for the landing player
      room.monopolyPhase = 'force_acquire_decision';
      broadcastGameUpdate(room, io);
      break;
    }

    case 'landed-build': {
      if (room.monopolyPhase !== 'landed_build') return;
      let lbIndex;
      let count = 1;
      if (payload && typeof payload === 'object') {
        lbIndex = payload.tileIndex;
        count = payload.count;
      } else {
        lbIndex = payload;
      }
      const lbTile = room.monopolyBoard[lbIndex];
      if (!lbTile || lbTile.type !== 'property' || lbTile.owner !== player.id || lbTile.mortgaged) return;
      
      const maxHouses = room.landedBuildMaxHouses !== undefined ? room.landedBuildMaxHouses : 4;
      if (lbTile.houses + count > maxHouses) return;
      if (player.money < lbTile.housePrice * count) return;
      
      player.money -= lbTile.housePrice * count;
      lbTile.houses += count;
      const buildName = (lbTile.houses === 5) ? 'Hotel!' : `${lbTile.houses} house(s)`;
      addSystemChatMessage(room, io, `🏗️ ${player.name} instantly built on ${lbTile.name} (${buildName}).`);
      updateNetWorth(room, player.id);
      broadcastGameUpdate(room, io);
      break;
    }

    case 'landed-build-done': {
      if (room.monopolyPhase !== 'landed_build') return;
      setEndTurnPhase(room, player, io);
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

      // Notify the proposer that their trade offer was declined
      const proposerSocket = io.sockets.sockets.get(senderId);
      if (proposerSocket) {
        proposerSocket.emit('monopoly-trade-rejected', { receiverName: receiver ? receiver.name : 'Opponent' });
      }

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
