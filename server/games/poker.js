// Texas Hold'em Poker Backend Engine
const POKER_RANK_ORDER = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
};

function getCombinations(array, k) {
  const result = [];
  function helper(start, combo) {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return result;
}

function evaluateFiveCardHand(cards) {
  if (cards.length !== 5) {
    throw new Error('Must evaluate exactly 5 cards');
  }

  const sorted = [...cards].sort((a, b) => POKER_RANK_ORDER[b.rank] - POKER_RANK_ORDER[a.rank]);
  const ranks = sorted.map(c => POKER_RANK_ORDER[c.rank]);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHighVal = -1;

  if (
    ranks[0] - ranks[1] === 1 &&
    ranks[1] - ranks[2] === 1 &&
    ranks[2] - ranks[3] === 1 &&
    ranks[3] - ranks[4] === 1
  ) {
    isStraight = true;
    straightHighVal = ranks[0];
  } else if (
    ranks[0] === 12 &&
    ranks[1] === 3 &&
    ranks[2] === 2 &&
    ranks[3] === 1 &&
    ranks[4] === 0
  ) {
    isStraight = true;
    straightHighVal = 3;
  }

  const counts = {};
  for (const r of ranks) {
    counts[r] = (counts[r] || 0) + 1;
  }

  const countPairs = Object.entries(counts).map(([rank, count]) => ({
    rank: parseInt(rank, 10),
    count,
  }));

  countPairs.sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (isFlush && isStraight) {
    if (straightHighVal === 12) {
      return {
        type: 'royalflush',
        score: [9, 12, 0, 0, 0, 0],
        handName: 'Royal Flush',
        bestFive: sorted,
      };
    }
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'straightflush',
      score: [8, straightHighVal, 0, 0, 0, 0],
      handName: `Straight Flush, ${rankNames[straightHighVal]}-high`,
      bestFive: sorted,
    };
  }

  if (countPairs[0].count === 4) {
    const quadRank = countPairs[0].rank;
    const kickerRank = countPairs[1].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'quads',
      score: [7, quadRank, kickerRank, 0, 0, 0],
      handName: `Four of a Kind, ${rankNames[quadRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === quadRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kickerRank),
      ],
    };
  }

  if (countPairs[0].count === 3 && countPairs[1].count === 2) {
    const tripRank = countPairs[0].rank;
    const pairRank = countPairs[1].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'fullhouse',
      score: [6, tripRank, pairRank, 0, 0, 0],
      handName: `Full House, ${rankNames[tripRank]}s full of ${rankNames[pairRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === tripRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pairRank),
      ],
    };
  }

  if (isFlush) {
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'flush',
      score: [5, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]],
      handName: `Flush, ${rankNames[ranks[0]]}-high`,
      bestFive: sorted,
    };
  }

  if (isStraight) {
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let straightFive = sorted;
    if (straightHighVal === 3 && ranks[0] === 12) {
      straightFive = [sorted[1], sorted[2], sorted[3], sorted[4], sorted[0]];
    }
    return {
      type: 'straight',
      score: [4, straightHighVal, 0, 0, 0, 0],
      handName: `Straight, ${rankNames[straightHighVal]}-high`,
      bestFive: straightFive,
    };
  }

  if (countPairs[0].count === 3) {
    const tripRank = countPairs[0].rank;
    const kicker1 = countPairs[1].rank;
    const kicker2 = countPairs[2].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'trips',
      score: [3, tripRank, kicker1, kicker2, 0, 0],
      handName: `Three of a Kind, ${rankNames[tripRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === tripRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kicker1),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kicker2),
      ],
    };
  }

  if (countPairs[0].count === 2 && countPairs[1].count === 2) {
    const pair1 = countPairs[0].rank;
    const pair2 = countPairs[1].rank;
    const kicker = countPairs[2].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'twopair',
      score: [2, pair1, pair2, kicker, 0, 0],
      handName: `Two Pair, ${rankNames[pair1]}s and ${rankNames[pair2]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pair1),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pair2),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === kicker),
      ],
    };
  }

  if (countPairs[0].count === 2) {
    const pairRank = countPairs[0].rank;
    const k1 = countPairs[1].rank;
    const k2 = countPairs[2].rank;
    const k3 = countPairs[3].rank;
    const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    return {
      type: 'pair',
      score: [1, pairRank, k1, k2, k3, 0],
      handName: `One Pair of ${rankNames[pairRank]}s`,
      bestFive: [
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === pairRank),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === k1),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === k2),
        ...sorted.filter(c => POKER_RANK_ORDER[c.rank] === k3),
      ],
    };
  }

  const rankNames = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  return {
    type: 'highcard',
    score: [0, ranks[0], ranks[1], ranks[2], ranks[3], ranks[4]],
    handName: `High Card, ${rankNames[ranks[0]]}`,
    bestFive: sorted,
  };
}

function evaluateSevenCardHand(cards) {
  if (cards.length < 5) {
    throw new Error('Need at least 5 cards to evaluate');
  }

  if (cards.length === 5) {
    return evaluateFiveCardHand(cards);
  }

  const combos = getCombinations(cards, 5);
  let bestHand = null;

  for (const combo of combos) {
    const res = evaluateFiveCardHand(combo);
    if (!bestHand || compareScores(res.score, bestHand.score) > 0) {
      bestHand = res;
    }
  }

  return bestHand;
}

function compareScores(a, b) {
  for (let i = 0; i < 6; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

function createDeck() {
  const suits = ['D', 'C', 'H', 'S'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
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

function getPublicPlayerState(player) {
  const { sessionId, ...publicPlayer } = player;
  return publicPlayer;
}

export function getSanitizedRoomState(room, socketId) {
  // Reveal all hole cards at showdown/roundover/gameover
  const revealCards = room.phase === 'showdown' || room.gameState === 'roundover' || room.gameState === 'gameover';
  return {
    ...room,
    players: room.players.map(p => {
      const publicPlayer = getPublicPlayerState(p);
      return {
        ...publicPlayer,
        // Hide other players' cards unless we are in the showdown phase
        cards: (p.id === socketId || revealCards) ? p.cards : Array(p.cards ? p.cards.length : 0).fill(null),
        actualCardCount: p.cards ? p.cards.length : 0,
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

  // Trigger bot coordinator sync to the host
  const host = room.players.find(p => p.isHost && !p.isBot);
  if (host) {
    const hostSocket = io.sockets.sockets.get(host.id);
    if (hostSocket) {
      // Send the unsanitized state to host so it can act as the bot coordinator
      hostSocket.emit('bot-coordinator-sync', room);
    }
  }
}

// Helper: Get next player index who is not eliminated
function getNextActivePlayerIndex(currentIndex, players) {
  let idx = currentIndex;
  for (let i = 0; i < players.length; i++) {
    idx = (idx + 1) % players.length;
    if (!players[idx].isEliminated) {
      return idx;
    }
  }
  return currentIndex;
}

// Helper: Get count of players still in the hand (not folded, not eliminated)
function getHandActivePlayerCount(players) {
  return players.filter(p => !p.isEliminated && !p.folded).length;
}

// Helper: Get count of players who can still make betting decisions (not folded, not all-in, not eliminated)
function getBettablePlayerCount(players) {
  return players.filter(p => !p.isEliminated && !p.folded && !p.allIn).length;
}

// Helper: Find next player who can act
function getNextBettorIndex(currentIndex, players) {
  let idx = currentIndex;
  for (let i = 0; i < players.length; i++) {
    idx = (idx + 1) % players.length;
    if (!players[idx].isEliminated && !players[idx].folded && !players[idx].allIn) {
      return idx;
    }
  }
  return currentIndex;
}

export function startRound(room, io) {
  // Initialize chips and states if starting new game
  room.gameState = 'playing';
  room.pot = 0;
  room.mainPot = 0;
  room.communityCards = [];
  room.winners = [];
  room.showdownResults = null;
  room.handLog = [];
  
  // Initialize player chips on start
  room.players.forEach(p => {
    if (p.chips === undefined || p.chips <= 0) {
      p.chips = room.rules?.startingChips || 1000;
    }
    p.isEliminated = p.chips <= 0;
    p.cards = [];
    p.folded = false;
    p.allIn = false;
    p.currentBet = 0;
    p.totalBet = 0;
    p.lastAction = null;
    p.roundPoints = 0;
  });

  const activeCount = room.players.filter(p => !p.isEliminated).length;
  if (activeCount < 2) {
    room.gameState = 'gameover';
    const finalWinner = room.players.find(p => !p.isEliminated);
    room.gameWinner = finalWinner ? finalWinner.id : null;
    io.to(room.code).emit('round-over', getPublicRoomState(room));
    return;
  }

  // Rotate dealer button
  if (room.dealerIndex === undefined) {
    // Choose first non-eliminated player
    room.dealerIndex = room.players.findIndex(p => !p.isEliminated);
  } else {
    room.dealerIndex = getNextActivePlayerIndex(room.dealerIndex, room.players);
  }

  // Set blinds
  const sbAmount = room.rules?.smallBlind || 5;
  const bbAmount = room.rules?.bigBlind || 10;

  // Determine SB and BB positions
  let sbIndex, bbIndex;
  const activePlayersIndices = [];
  room.players.forEach((p, i) => {
    if (!p.isEliminated) activePlayersIndices.push(i);
  });

  if (activePlayersIndices.length === 2) {
    // Heads-up: Dealer is SB, other player is BB
    sbIndex = room.dealerIndex;
    bbIndex = getNextActivePlayerIndex(room.dealerIndex, room.players);
  } else {
    // Multi-player: SB is next after Dealer, BB is next after SB
    sbIndex = getNextActivePlayerIndex(room.dealerIndex, room.players);
    bbIndex = getNextActivePlayerIndex(sbIndex, room.players);
  }

  // Post SB
  const sbPosted = Math.min(sbAmount, room.players[sbIndex].chips);
  room.players[sbIndex].chips -= sbPosted;
  room.players[sbIndex].currentBet = sbPosted;
  room.players[sbIndex].totalBet = sbPosted;
  room.players[sbIndex].lastAction = 'SB';
  if (room.players[sbIndex].chips === 0) {
    room.players[sbIndex].allIn = true;
    room.players[sbIndex].lastAction = 'all-in';
  }

  // Post BB
  const bbPosted = Math.min(bbAmount, room.players[bbIndex].chips);
  room.players[bbIndex].chips -= bbPosted;
  room.players[bbIndex].currentBet = bbPosted;
  room.players[bbIndex].totalBet = bbPosted;
  room.players[bbIndex].lastAction = 'BB';
  if (room.players[bbIndex].chips === 0) {
    room.players[bbIndex].allIn = true;
    room.players[bbIndex].lastAction = 'all-in';
  }

  // Setup deck & deal cards
  const deck = shuffle(createDeck());
  room.players.forEach(p => {
    if (!p.isEliminated) {
      p.cards = [deck.pop(), deck.pop()];
    }
  });
  room.deck = deck;

  room.phase = 'preflop';
  room.currentBet = Math.max(sbPosted, bbPosted);
  room.minRaise = bbAmount;

  // Pre-flop action starts left of Big Blind (UTG)
  if (activePlayersIndices.length === 2) {
    // Heads-up: SB (Dealer) acts first pre-flop
    room.currentPlayerIndex = room.dealerIndex;
  } else {
    room.currentPlayerIndex = getNextActivePlayerIndex(bbIndex, room.players);
  }
  
  // Set last raiser to BB to allow option to check/raise
  room.lastRaiserIndex = bbIndex;
  room.firstActionOfRound = true;

  // If the starting player is already all-in, advance turn
  if (room.players[room.currentPlayerIndex].allIn) {
    moveToNextTurn(room, io);
  } else {
    broadcastGameUpdate(room, io);
  }
}

function collectBetsToPot(room) {
  room.players.forEach(p => {
    room.pot += p.currentBet;
    p.currentBet = 0;
  });
  room.currentBet = 0;
  room.minRaise = room.rules?.bigBlind || 10;
}

function startNextBettingRound(room, io) {
  collectBetsToPot(room);

  // Check if we only have 1 active player left (others folded)
  if (getHandActivePlayerCount(room.players) <= 1) {
    endHand(room, io);
    return;
  }

  // If fewer than 2 players can bet (everyone else is all-in), deal remaining community cards and go to showdown
  if (getBettablePlayerCount(room.players) < 2) {
    dealRemainingCommunityCards(room);
    room.phase = 'showdown';
    resolveShowdown(room, io);
    return;
  }

  // Proceed to next street
  if (room.phase === 'preflop') {
    room.phase = 'flop';
    // Deal 3 community cards (flop)
    room.communityCards.push(room.deck.pop(), room.deck.pop(), room.deck.pop());
  } else if (room.phase === 'flop') {
    room.phase = 'turn';
    // Deal 1 community card (turn)
    room.communityCards.push(room.deck.pop());
  } else if (room.phase === 'turn') {
    room.phase = 'river';
    // Deal 1 community card (river)
    room.communityCards.push(room.deck.pop());
  } else if (room.phase === 'river') {
    room.phase = 'showdown';
    resolveShowdown(room, io);
    return;
  }

  // Reset lastAction for active players
  room.players.forEach(p => {
    if (!p.folded && !p.allIn && !p.isEliminated) {
      p.lastAction = null;
    }
  });

  // Post-flop action starts with first active player left of Dealer button
  room.currentPlayerIndex = getNextActivePlayerIndex(room.dealerIndex, room.players);
  if (room.players[room.currentPlayerIndex].folded || room.players[room.currentPlayerIndex].allIn) {
    room.currentPlayerIndex = getNextBettorIndex(room.currentPlayerIndex, room.players);
  }

  // Since it's a new street, last raiser is reset to null (checking is allowed)
  room.lastRaiserIndex = null;
  room.firstActionOfRound = true;

  broadcastGameUpdate(room, io);
}

function dealRemainingCommunityCards(room) {
  const cardsNeeded = 5 - room.communityCards.length;
  for (let i = 0; i < cardsNeeded; i++) {
    room.communityCards.push(room.deck.pop());
  }
}

function moveToNextTurn(room, io) {
  // Check if hand is won by folding
  if (getHandActivePlayerCount(room.players) <= 1) {
    collectBetsToPot(room);
    endHand(room, io);
    return;
  }

  // Find next bettor
  const nextIdx = getNextBettorIndex(room.currentPlayerIndex, room.players);

  // Check if betting round is complete:
  // 1. We have gone around at least once (not firstActionOfRound)
  // 2. The next player to act has already matched the currentBet or is all-in
  const nextPlayer = room.players[nextIdx];
  const allMatched = room.players.every(p => {
    if (p.isEliminated || p.folded) return true;
    if (p.allIn) return true;
    return p.currentBet === room.currentBet;
  });

  // Special pre-flop case: if action reaches Big Blind and no one raised (currentBet === Big Blind) and it's Big Blind's turn
  const isPreflopBBOption = room.phase === 'preflop' && room.currentBet === (room.rules?.bigBlind || 10) && nextIdx === room.lastRaiserIndex && room.firstActionOfRound;

  if (allMatched && !room.firstActionOfRound && (!isPreflopBBOption || room.players[nextIdx].lastAction !== 'BB')) {
    // Betting round finished!
    startNextBettingRound(room, io);
  } else {
    room.currentPlayerIndex = nextIdx;
    room.firstActionOfRound = false;
    broadcastGameUpdate(room, io);
  }
}

export function handleAction(room, socket, action, payload, io) {
  const playerIndex = room.players.findIndex(p => p.id === socket.id);
  if (playerIndex === -1 || playerIndex !== room.currentPlayerIndex) {
    return; // Not player's turn
  }

  const player = room.players[playerIndex];
  let logMsg = '';

  if (action === 'fold') {
    player.folded = true;
    player.lastAction = 'fold';
    logMsg = `${player.name} folds`;
  } else if (action === 'check') {
    // Can only check if no bet in front or player already matched it
    if (player.currentBet < room.currentBet) {
      return; // Invalid action
    }
    player.lastAction = 'check';
    logMsg = `${player.name} checks`;
  } else if (action === 'call') {
    const callAmount = room.currentBet - player.currentBet;
    if (callAmount <= 0) {
      return; // Can check instead
    }
    const actualCall = Math.min(callAmount, player.chips);
    player.chips -= actualCall;
    player.currentBet += actualCall;
    player.totalBet += actualCall;
    player.lastAction = 'call';
    
    if (player.chips === 0) {
      player.allIn = true;
      player.lastAction = 'all-in';
      logMsg = `${player.name} calls all-in ($${actualCall})`;
    } else {
      logMsg = `${player.name} calls $${actualCall}`;
    }
  } else if (action === 'raise' || action === 'all-in') {
    const raiseTo = parseInt(payload.amount, 10);
    if (isNaN(raiseTo)) return;

    // Minimum raise check
    const minRequiredRaise = room.currentBet + room.minRaise;
    const isAllIn = raiseTo >= player.chips + player.currentBet;
    
    if (!isAllIn && raiseTo < minRequiredRaise) {
      return; // Under-raise
    }

    const addedAmount = Math.min(raiseTo - player.currentBet, player.chips);
    
    // Update minRaise size
    const raiseIncrement = (player.currentBet + addedAmount) - room.currentBet;
    if (raiseIncrement > 0) {
      room.minRaise = raiseIncrement;
    }

    player.chips -= addedAmount;
    player.currentBet += addedAmount;
    player.totalBet += addedAmount;
    room.currentBet = player.currentBet;
    room.lastRaiserIndex = playerIndex;

    if (player.chips === 0) {
      player.allIn = true;
      player.lastAction = 'all-in';
      logMsg = `${player.name} raises all-in to $${player.currentBet}`;
    } else {
      player.lastAction = 'raise';
      logMsg = `${player.name} raises to $${player.currentBet}`;
    }
  } else {
    return; // Unknown action
  }

  if (logMsg) {
    room.handLog.push(logMsg);
  }

  moveToNextTurn(room, io);
}

function resolveShowdown(room, io) {
  const activePlayers = room.players.filter(p => !p.folded && !p.isEliminated);
  
  // 1. Evaluate hand strength for each player
  const evaluatedPlayers = activePlayers.map(p => {
    const combinedCards = [...p.cards, ...room.communityCards];
    const handResult = evaluateSevenCardHand(combinedCards);
    return {
      playerId: p.id,
      name: p.name,
      handResult,
      totalBet: p.totalBet,
    };
  });

  // 2. Award pot using side-pot breakdown
  // Let's find all contributors (active or folded) who put money in the pot
  const contributors = room.players.filter(p => p.totalBet > 0);
  
  // Sort contributors by total bet ascending to build pots step-by-step
  const sortedContributors = [...contributors].sort((a, b) => a.totalBet - b.totalBet);
  
  const distributions = {}; // playerId -> chips won
  room.players.forEach(p => { distributions[p.id] = 0; });

  let accumulatedBetSubtracted = 0;

  // Track each side pot details for UI
  const sidePotsDetailed = [];

  sortedContributors.forEach((contrib, idx) => {
    const betLevel = contrib.totalBet - accumulatedBetSubtracted;
    if (betLevel <= 0) return;

    // Create a pot at this bet level
    let potSize = 0;
    const eligibleForThisPot = [];

    room.players.forEach(p => {
      if (p.totalBet >= contrib.totalBet) {
        potSize += betLevel;
        // Eligible to win this pot if they didn't fold and are still in
        if (!p.folded && !p.isEliminated) {
          eligibleForThisPot.push(p.id);
        }
      }
    });

    if (eligibleForThisPot.length > 0 && potSize > 0) {
      // Find the winner(s) among eligible players
      let bestScore = null;
      let winnersThisPot = [];

      eligibleForThisPot.forEach(pid => {
        const evalPlayer = evaluatedPlayers.find(ep => ep.playerId === pid);
        if (!evalPlayer) return;

        if (!bestScore || compareScores(evalPlayer.handResult.score, bestScore) > 0) {
          bestScore = evalPlayer.handResult.score;
          winnersThisPot = [pid];
        } else if (compareScores(evalPlayer.handResult.score, bestScore) === 0) {
          winnersThisPot.push(pid);
        }
      });

      // Divide pot among winners (handle fractional chips by rounding down, remainder goes to first winner)
      const share = Math.floor(potSize / winnersThisPot.length);
      const remainder = potSize % winnersThisPot.length;

      winnersThisPot.forEach((winId, wIdx) => {
        distributions[winId] += share + (wIdx === 0 ? remainder : 0);
      });

      sidePotsDetailed.push({
        potSize,
        eligible: eligibleForThisPot.map(pid => room.players.find(p => p.id === pid).name),
        winners: winnersThisPot.map(pid => room.players.find(p => p.id === pid).name),
      });
    } else if (potSize > 0) {
      // No one left unfolded? Give pot back to contributors (fallback edge case)
      const returnShare = Math.floor(potSize / room.players.filter(p => p.totalBet >= contrib.totalBet).length);
      room.players.forEach(p => {
        if (p.totalBet >= contrib.totalBet) {
          distributions[p.id] += returnShare;
        }
      });
    }

    accumulatedBetSubtracted = contrib.totalBet;
  });

  // Apply winnings
  room.players.forEach(p => {
    p.chips += distributions[p.id];
    if (distributions[p.id] > 0) {
      p.roundPoints += distributions[p.id];
    }
  });

  // Prepare showdown results for client
  room.showdownResults = {
    playerHands: evaluatedPlayers.map(ep => ({
      playerId: ep.playerId,
      handName: ep.handResult.handName,
      bestFive: ep.handResult.bestFive,
      holeCards: room.players.find(p => p.id === ep.playerId).cards,
    })),
    winners: Object.keys(distributions).filter(pid => distributions[pid] > 0).map(pid => ({
      playerId: pid,
      name: room.players.find(p => p.id === pid).name,
      amount: distributions[pid],
    })),
    sidePotsDetailed,
  };

  room.gameState = 'roundover';
  broadcastGameUpdate(room, io);
}

function endHand(room, io) {
  // If only 1 player remains unfolded, they win the pot
  const activePlayers = room.players.filter(p => !p.folded && !p.isEliminated);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += room.pot;
    winner.roundPoints = room.pot;
    room.winners = [winner.id];
    room.showdownResults = {
      playerHands: [],
      winners: [{ playerId: winner.id, name: winner.name, amount: room.pot }],
    };
    room.pot = 0;
  }

  room.gameState = 'roundover';
  broadcastGameUpdate(room, io);
}

// Dummy export needed for server.js botPlay hook
export function botPlayPoker(room, io) {
  // Real bot behavior will be orchestrated by the host client.
  // This is a backup server-side handler in case host fails, or to satisfy engine interface.
}

// Stripped room state without sessionId
function getPublicRoomState(room) {
  return {
    ...room,
    players: room.players.map(getPublicPlayerState),
  };
}
