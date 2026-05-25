import { getBotMonopolyDecision, TileState, CardDefinition, LOCAL_CHANCE_CARDS, LOCAL_CHEST_CARDS } from './src/utils/monopolyLogic';

interface Player {
  id: string;
  name: string;
  isBot: boolean;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
  lastRoll: number[];
  rollCount: number;
  doublesRolled: boolean;
  netWorth: number;
  oddEvenCards?: number;
  angelCards?: number;
}

// Full-featured Monopoly State Machine Simulator for Fuzzing
class MonopolyFuzzer {
  players: Player[];
  board: TileState[];
  turnIndex: number;
  monopolyPhase: string;
  monopolyDice: number[];
  monopolyRollId: string | null;
  monopolyCurrentCard: CardDefinition | null;
  monopolyCardType: string | null;
  monopolyPendingRent: { fromId: string; toId: string; amount: number } | null;
  monopolyPendingForceAcquire: { byId: string; tileIndex: number; worth: number } | null;
  monopolyLandedBuildMaxHouses: number;
  monopolyActiveDebt: { from: string; to: string; amountValue: number } | null;
  rules: { ruleset: string; startingCash: number; turnLimit: number };
  chanceDeck: CardDefinition[];
  chestDeck: CardDefinition[];
  stepCount: number;
  logs: string[];

  constructor(ruleset: string = 'Default') {
    this.players = [
      { id: 'player_1', name: 'Player 1 (Bot)', isBot: true, money: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false, lastRoll: [1, 1], rollCount: 0, doublesRolled: false, netWorth: 1500, oddEvenCards: ruleset === 'Get Rich' ? 0 : undefined, angelCards: ruleset === 'Get Rich' ? 0 : undefined },
      { id: 'player_2', name: 'Player 2 (Bot)', isBot: true, money: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false, lastRoll: [1, 1], rollCount: 0, doublesRolled: false, netWorth: 1500, oddEvenCards: ruleset === 'Get Rich' ? 0 : undefined, angelCards: ruleset === 'Get Rich' ? 0 : undefined },
      { id: 'player_3', name: 'Player 3 (Bot)', isBot: true, money: 1500, position: 0, inJail: false, jailTurns: 0, getOutOfJailCards: 0, bankrupt: false, lastRoll: [1, 1], rollCount: 0, doublesRolled: false, netWorth: 1500, oddEvenCards: ruleset === 'Get Rich' ? 0 : undefined, angelCards: ruleset === 'Get Rich' ? 0 : undefined }
    ];

    // Recreate the standard monopoly board
    this.board = Array.from({ length: 40 }, (_, idx) => {
      let type: 'go' | 'property' | 'tax' | 'railroad' | 'utility' | 'chance' | 'chest' | 'jail' | 'parking' | 'gotojail' = 'property';
      let name = `Tile ${idx}`;
      let price = 100;
      let rent = [10, 20, 40, 80, 160, 200, 250];

      if (idx === 0) { type = 'go'; name = 'GO'; }
      else if (idx === 2 || idx === 17 || idx === 33) { type = 'chest'; name = 'Community Chest'; }
      else if (idx === 7 || idx === 22 || idx === 36) { type = 'chance'; name = 'Chance'; }
      else if (idx === 4 || idx === 38) { type = 'tax'; name = 'Tax'; price = idx === 4 ? 200 : 100; }
      else if (idx === 10) { type = 'jail'; name = 'Jail'; }
      else if (idx === 20) { type = 'parking'; name = 'Free Parking'; }
      else if (idx === 30) { type = 'gotojail'; name = 'Go To Jail'; }
      else if (idx === 12 || idx === 28) { type = 'utility'; name = idx === 12 ? 'Electric Company' : 'Water Works'; price = 150; }
      else if (idx === 5 || idx === 15 || idx === 25 || idx === 35) { type = 'railroad'; name = 'Railroad'; price = 200; rent = [25, 50, 100, 200]; }

      return {
        index: idx,
        name,
        type,
        price: (type === 'property' || type === 'utility' || type === 'railroad') ? price : undefined,
        rent: (type === 'property' || type === 'railroad' || type === 'utility') ? rent : undefined,
        housePrice: (type === 'property') ? 50 : undefined,
        owner: null,
        houses: 0,
        mortgaged: false,
      };
    });

    this.turnIndex = 0;
    this.monopolyPhase = 'roll';
    this.monopolyDice = [1, 1];
    this.monopolyRollId = null;
    this.monopolyCurrentCard = null;
    this.monopolyCardType = null;
    this.monopolyPendingRent = null;
    this.monopolyPendingForceAcquire = null;
    this.monopolyLandedBuildMaxHouses = 4;
    this.monopolyActiveDebt = null;
    this.rules = { ruleset, startingCash: 1500, turnLimit: 0 };
    
    // Filter cards based on ruleset
    const isGetRich = ruleset === 'Get Rich';
    this.chanceDeck = isGetRich ? [...LOCAL_CHANCE_CARDS] : LOCAL_CHANCE_CARDS.filter(c => c.action !== 'give_odd_even' && c.action !== 'give_angel');
    this.chestDeck = isGetRich ? [...LOCAL_CHEST_CARDS] : LOCAL_CHEST_CARDS.filter(c => c.action !== 'give_odd_even' && c.action !== 'give_angel');

    this.stepCount = 0;
    this.logs = [];
  }

  log(msg: string) {
    this.logs.push(`[Step ${this.stepCount}] ${msg}`);
  }

  drawCard(type: string) {
    const deck = type === 'chance' ? this.chanceDeck : this.chestDeck;
    if (deck.length === 0) {
      const all = type === 'chance' ? LOCAL_CHANCE_CARDS : LOCAL_CHEST_CARDS;
      const filtered = this.rules.ruleset === 'Get Rich' ? all : all.filter(c => c.action !== 'give_odd_even' && c.action !== 'give_angel');
      deck.push(...filtered);
    }
    const card = deck.pop()!;
    this.monopolyCurrentCard = card;
    this.monopolyCardType = type;
    this.monopolyPhase = 'card_drawn';
    this.log(`Drew card: "${card.text}"`);
  }

  setEndTurnPhaseSingle(p: Player, playersList: Player[]) {
    if (p.inJail) {
      let nextTurn = this.turnIndex;
      const n = playersList.length;
      for (let i = 0; i < n; i++) {
        nextTurn = (nextTurn + 1) % n;
        if (!playersList[nextTurn].bankrupt) break;
      }
      this.turnIndex = nextTurn;
      this.monopolyPhase = 'roll';
      playersList.forEach((pl, idx) => {
        if (idx === this.turnIndex || idx === nextTurn) {
          pl.rollCount = 0;
          pl.doublesRolled = false;
        }
      });
    } else if (p.doublesRolled && !p.bankrupt) {
      this.players = playersList.map(pl => pl.id === p.id ? { ...pl, doublesRolled: false } : pl);
      this.monopolyPhase = 'roll';
      this.log(`Doubles! ${p.name} gets to roll again.`);
    } else {
      this.monopolyPhase = 'end_turn';
    }
  }

  triggerPaymentSingle(playersList: Player[], boardList: TileState[], debtor: Player, recipient: Player | null, amount: number) {
    if (debtor.money >= amount) {
      const nextPlayers = playersList.map(p => {
        if (p.id === debtor.id) return { ...p, money: p.money - amount };
        if (recipient && p.id === recipient.id) return { ...p, money: p.money + amount };
        return p;
      });
      if (recipient) {
        this.log(`${debtor.name} paid $${amount} rent to ${recipient.name}.`);
      } else {
        this.log(`${debtor.name} paid $${amount} tax to the bank.`);
      }
      const freshDebtor = nextPlayers.find(p => p.id === debtor.id)!;
      this.setEndTurnPhaseSingle(freshDebtor, nextPlayers);
      this.players = nextPlayers;
    } else {
      this.monopolyActiveDebt = {
        from: debtor.id,
        to: recipient ? recipient.id : 'bank',
        amountValue: amount
      };
      this.monopolyPhase = 'bankrupt_decision';
      this.log(`🚨 Debt! ${debtor.name} needs to raise $${amount - debtor.money}.`);
    }
  }

  resolveLandedSpaceSingle(player: Player, boardList: TileState[], diceSum: number) {
    const tile = boardList[player.position];
    
    if (tile.type === 'go' || tile.type === 'jail' || tile.type === 'parking') {
      this.setEndTurnPhaseSingle(player, this.players);
      return;
    }

    if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
      if (tile.owner === null) {
        this.monopolyPhase = 'action';
      } else if (tile.owner === player.id) {
        if (this.rules.ruleset === 'Get Rich' && tile.type === 'property' && tile.houses < 5) {
          this.monopolyPhase = 'landed_build';
          this.monopolyLandedBuildMaxHouses = tile.houses === 4 ? 5 : 4;
        } else {
          this.setEndTurnPhaseSingle(player, this.players);
        }
      } else if (tile.mortgaged) {
        this.log(`Landed on mortgaged ${tile.name}. No rent paid.`);
        this.setEndTurnPhaseSingle(player, this.players);
      } else {
        const owner = this.players.find(p => p.id === tile.owner)!;
        let rent = tile.rent ? (tile.rent[tile.houses] || tile.rent[0]) : 10;
        
        if (tile.type === 'utility') {
          const uCount = boardList.filter(t => t.type === 'utility' && t.owner === tile.owner).length;
          rent = diceSum * (uCount === 2 ? 10 : 4);
        } else if (tile.type === 'railroad') {
          const rrCount = boardList.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
          rent = 25 * Math.pow(2, rrCount - 1);
        }

        // Get Rich skipping/forcing
        if (this.rules.ruleset === 'Get Rich' && (player as any).angelCards > 0) {
          this.monopolyPendingRent = { fromId: player.id, toId: owner.id, amount: rent };
          this.monopolyPhase = 'use_angel_rent';
          return;
        }

        const moneyAfterRent = player.money - rent;
        if (moneyAfterRent >= 0) {
          const nextPlayers = this.players.map(p => {
            if (p.id === player.id) return { ...p, money: moneyAfterRent };
            if (p.id === owner.id) return { ...p, money: p.money + rent };
            return p;
          });
          
          const tileWorth = (tile.price || 0) + (tile.houses || 0) * (tile.housePrice || 0);
          if (this.rules.ruleset === 'Get Rich' && tile.houses < 5 && moneyAfterRent >= tileWorth) {
            this.monopolyPendingForceAcquire = { byId: player.id, tileIndex: tile.index, worth: tileWorth };
            this.monopolyPhase = (owner as any).angelCards > 0 ? 'use_angel_force' : 'force_acquire_decision';
            this.players = nextPlayers;
          } else {
            const freshP = nextPlayers.find(p => p.id === player.id)!;
            this.setEndTurnPhaseSingle(freshP, nextPlayers);
            this.players = nextPlayers;
          }
        } else {
          this.triggerPaymentSingle(this.players, boardList, player, owner, rent);
        }
      }
      return;
    }

    if (tile.type === 'tax') {
      this.triggerPaymentSingle(this.players, boardList, player, null, tile.price || 100);
      return;
    }

    if (tile.type === 'gotojail') {
      if (this.rules.ruleset === 'Get Rich') {
        if (player.money >= 100) {
          this.monopolyPhase = 'airport_selection';
        } else {
          this.setEndTurnPhaseSingle(player, this.players);
        }
      } else {
        player.position = 10;
        player.inJail = true;
        this.setEndTurnPhaseSingle(player, this.players);
      }
      return;
    }

    if (tile.type === 'chance' || tile.type === 'chest') {
      this.drawCard(tile.type);
      return;
    }
  }

  resolveCardActionSingle(player: Player, card: CardDefinition) {
    this.monopolyCurrentCard = null;
    this.monopolyCardType = null;

    const updatedPlayers = this.players.map(p => p.id === player.id ? { ...p } : p);
    const updatedPlayer = updatedPlayers.find(p => p.id === player.id)!;

    if (card.action === 'move') {
      const oldPos = updatedPlayer.position;
      updatedPlayer.position = card.target!;
      if (card.target! < oldPos) {
        updatedPlayer.money += 200;
      }
      this.resolveLandedSpaceSingle(updatedPlayer, this.board, 7);
      return;
    }

    if (card.action === 'give_money') {
      updatedPlayer.money += card.amount!;
      this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      this.players = updatedPlayers;
      return;
    }

    if (card.action === 'take_money') {
      this.triggerPaymentSingle(updatedPlayers, this.board, updatedPlayer, null, card.amount!);
      return;
    }

    if (card.action === 'jail_free') {
      updatedPlayer.getOutOfJailCards += 1;
      this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      this.players = updatedPlayers;
      return;
    }

    if (card.action === 'goto_jail') {
      updatedPlayer.position = 10;
      updatedPlayer.inJail = true;
      this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      this.players = updatedPlayers;
      return;
    }

    if (card.action === 'back_spaces') {
      updatedPlayer.position = (updatedPlayer.position - card.amount! + 40) % 40;
      this.resolveLandedSpaceSingle(updatedPlayer, this.board, 7);
      return;
    }

    if (card.action === 'nearest_railroad') {
      const pos = updatedPlayer.position;
      const rrPositions = [5, 15, 25, 35];
      let nextRR = rrPositions.find(p => p > pos) ?? 5;
      if (nextRR < pos) updatedPlayer.money += 200;
      updatedPlayer.position = nextRR;

      const tile = this.board[nextRR];
      if (tile.owner === null) {
        this.monopolyPhase = 'action';
        this.players = updatedPlayers;
      } else if (tile.owner === updatedPlayer.id) {
        this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
        this.players = updatedPlayers;
      } else {
        const owner = updatedPlayers.find(p => p.id === tile.owner)!;
        const rrCount = this.board.filter(t => t.type === 'railroad' && t.owner === tile.owner).length;
        const rent = 25 * Math.pow(2, rrCount - 1) * 2;
        this.triggerPaymentSingle(updatedPlayers, this.board, updatedPlayer, owner, rent);
      }
      return;
    }

    if (card.action === 'nearest_utility') {
      const pos = updatedPlayer.position;
      const utilPositions = [12, 28];
      let nextUtil = utilPositions.find(p => p > pos) ?? 12;
      if (nextUtil < pos) updatedPlayer.money += 200;
      updatedPlayer.position = nextUtil;

      const tile = this.board[nextUtil];
      if (tile.owner === null) {
        this.monopolyPhase = 'action';
        this.players = updatedPlayers;
      } else if (tile.owner === updatedPlayer.id) {
        this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
        this.players = updatedPlayers;
      } else {
        const owner = updatedPlayers.find(p => p.id === tile.owner)!;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const sum = d1 + d2;
        const rent = sum * 10;
        this.monopolyDice = [d1, d2];
        this.monopolyRollId = Math.random().toString(36).substring(2, 9);
        this.triggerPaymentSingle(updatedPlayers, this.board, updatedPlayer, owner, rent);
      }
      return;
    }

    if (card.action === 'pay_each') {
      const othersCount = this.players.filter(p => !p.bankrupt && p.id !== player.id).length;
      const cost = othersCount * card.amount!;
      this.triggerPaymentSingle(updatedPlayers, this.board, updatedPlayer, null, cost);
      return;
    }

    if (card.action === 'collect_each') {
      const others = this.players.filter(p => !p.bankrupt && p.id !== player.id);
      let collected = 0;
      const nextPlayers = this.players.map(p => {
        if (p.id === player.id) return p;
        if (!p.bankrupt) {
          const pay = Math.min(p.money, card.amount!);
          collected += pay;
          return { ...p, money: p.money - pay };
        }
        return p;
      });
      const freshP = nextPlayers.find(p => p.id === player.id)!;
      freshP.money += collected;
      this.setEndTurnPhaseSingle(freshP, nextPlayers);
      this.players = nextPlayers;
      return;
    }

    if (card.action === 'repairs') {
      let cost = 0;
      this.board.forEach(t => {
        if (t.owner === player.id && !t.mortgaged) {
          cost += t.houses === 5 ? card.hotelCost! : t.houses * card.houseCost!;
        }
      });
      this.triggerPaymentSingle(updatedPlayers, this.board, updatedPlayer, null, cost);
      return;
    }

    if (card.action === 'give_odd_even') {
      (updatedPlayer as any).oddEvenCards = Math.min(((updatedPlayer as any).oddEvenCards || 0) + 1, 1);
      this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      this.players = updatedPlayers;
      return;
    }

    if (card.action === 'give_angel') {
      (updatedPlayer as any).angelCards = Math.min(((updatedPlayer as any).angelCards || 0) + 1, 1);
      this.setEndTurnPhaseSingle(updatedPlayer, updatedPlayers);
      this.players = updatedPlayers;
      return;
    }
  }

  handleMonopolyActionSingle(action: string, payload?: any) {
    const currentPlayer = this.players[this.turnIndex];
    this.log(`Handling action: "${action}" (Phase: ${this.monopolyPhase})`);

    if (action === 'roll-dice') {
      if (this.monopolyPhase !== 'roll') return;
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const sum = d1 + d2;
      const isDoubles = d1 === d2;

      currentPlayer.lastRoll = [d1, d2];
      currentPlayer.rollCount = isDoubles ? currentPlayer.rollCount + 1 : 0;
      currentPlayer.doublesRolled = isDoubles && currentPlayer.rollCount < 3;

      if (currentPlayer.rollCount === 3) {
        currentPlayer.inJail = true;
        currentPlayer.position = 10;
        currentPlayer.rollCount = 0;
        currentPlayer.doublesRolled = false;
        this.setEndTurnPhaseSingle(currentPlayer, this.players);
        return;
      }

      const oldPos = currentPlayer.position;
      currentPlayer.position = (oldPos + sum) % 40;
      if (currentPlayer.position < oldPos) {
        currentPlayer.money += 200;
      }
      this.resolveLandedSpaceSingle(currentPlayer, this.board, sum);
    } 
    
    else if (action === 'ok-card') {
      if (this.monopolyPhase !== 'card_drawn' || !this.monopolyCurrentCard) return;
      this.resolveCardActionSingle(currentPlayer, this.monopolyCurrentCard);
    } 
    
    else if (action === 'buy-property') {
      if (this.monopolyPhase !== 'action') return;
      const tile = this.board[currentPlayer.position];
      currentPlayer.money -= tile.price!;
      tile.owner = currentPlayer.id;
      this.log(`${currentPlayer.name} bought ${tile.name}.`);
      
      if (this.rules.ruleset === 'Get Rich' && tile.type === 'property') {
        this.monopolyPhase = 'landed_build';
        this.monopolyLandedBuildMaxHouses = 4;
      } else {
        this.setEndTurnPhaseSingle(currentPlayer, this.players);
      }
    } 
    
    else if (action === 'pass-property') {
      if (this.monopolyPhase !== 'action') return;
      this.setEndTurnPhaseSingle(currentPlayer, this.players);
    } 
    
    else if (action === 'end-turn') {
      let nextTurn = this.turnIndex;
      const n = this.players.length;
      for (let i = 0; i < n; i++) {
        nextTurn = (nextTurn + 1) % n;
        if (!this.players[nextTurn].bankrupt) break;
      }
      this.turnIndex = nextTurn;
      this.monopolyPhase = 'roll';
      this.players = this.players.map((p, idx) => idx === nextTurn ? { ...p, rollCount: 0, doublesRolled: false } : p);
    } 
    
    else if (action === 'use-angel-rent') {
      const pr = this.monopolyPendingRent!;
      (currentPlayer as any).angelCards = Math.max(0, ((currentPlayer as any).angelCards || 1) - 1);
      this.monopolyPendingRent = null;
      this.setEndTurnPhaseSingle(currentPlayer, this.players);
    } 
    
    else if (action === 'decline-angel-rent') {
      const pr = this.monopolyPendingRent!;
      this.monopolyPendingRent = null;
      const debtor = this.players.find(p => p.id === pr.fromId)!;
      const creditor = this.players.find(p => p.id === pr.toId)!;
      
      const moneyAfterRent = debtor.money - pr.amount;
      if (moneyAfterRent >= 0) {
        debtor.money = moneyAfterRent;
        creditor.money += pr.amount;
        const tile = this.board[debtor.position];
        const tileWorth = (tile.price || 0) + (tile.houses || 0) * (tile.housePrice || 0);
        if (tile.houses < 5 && moneyAfterRent >= tileWorth) {
          this.monopolyPendingForceAcquire = { byId: debtor.id, tileIndex: tile.index, worth: tileWorth };
          this.monopolyPhase = (creditor as any).angelCards > 0 ? 'use_angel_force' : 'force_acquire_decision';
        } else {
          this.setEndTurnPhaseSingle(debtor, this.players);
        }
      } else {
        this.triggerPaymentSingle(this.players, this.board, debtor, creditor, pr.amount);
      }
    } 
    
    else if (action === 'use-angel-force') {
      const pfa = this.monopolyPendingForceAcquire!;
      const tile = this.board[pfa.tileIndex];
      const owner = this.players.find(p => p.id === tile.owner)!;
      (owner as any).angelCards = Math.max(0, ((owner as any).angelCards || 1) - 1);
      this.monopolyPendingForceAcquire = null;
      this.setEndTurnPhaseSingle(currentPlayer, this.players);
    } 
    
    else if (action === 'decline-angel-force') {
      this.monopolyPhase = 'force_acquire_decision';
    } 
    
    else if (action === 'force-acquire') {
      const pfa = this.monopolyPendingForceAcquire!;
      const tile = this.board[pfa.tileIndex];
      const prevOwner = this.players.find(p => p.id === tile.owner)!;
      
      currentPlayer.money -= pfa.worth;
      prevOwner.money += pfa.worth;
      tile.owner = currentPlayer.id;
      
      this.monopolyPendingForceAcquire = null;
      if (tile.houses === 4) {
        this.monopolyPhase = 'landed_build';
        this.monopolyLandedBuildMaxHouses = 5;
      } else {
        this.setEndTurnPhaseSingle(currentPlayer, this.players);
      }
    } 
    
    else if (action === 'decline-force-acquire') {
      this.monopolyPendingForceAcquire = null;
      this.setEndTurnPhaseSingle(currentPlayer, this.players);
    } 
    
    else if (action === 'landed-build') {
      const tile = this.board[payload.tileIndex];
      const cost = payload.count * (tile.housePrice || 50);
      currentPlayer.money -= cost;
      tile.houses += payload.count;
      this.monopolyPhase = 'end_turn';
    } 
    
    else if (action === 'landed-build-done') {
      this.setEndTurnPhaseSingle(currentPlayer, this.players);
    } 
    
    else if (action === 'airport-fly') {
      currentPlayer.money -= 100;
      currentPlayer.position = payload.targetIndex;
      this.resolveLandedSpaceSingle(currentPlayer, this.board, 7);
    } 
    
    else if (action === 'airport-skip') {
      this.setEndTurnPhaseSingle(currentPlayer, this.players);
    } 
    
    else if (action === 'declare-bankruptcy') {
      currentPlayer.bankrupt = true;
      this.board.forEach(t => {
        if (t.owner === currentPlayer.id) {
          t.owner = null;
          t.houses = 0;
        }
      });
      this.monopolyActiveDebt = null;
      
      let nextTurn = this.turnIndex;
      const n = this.players.length;
      for (let i = 0; i < n; i++) {
        nextTurn = (nextTurn + 1) % n;
        if (!this.players[nextTurn].bankrupt) break;
      }
      this.turnIndex = nextTurn;
      this.monopolyPhase = 'roll';
    }
  }

  // Run a single simulation step
  fuzzStep() {
    this.stepCount++;
    const activeBot = this.players[this.turnIndex];
    if (this.players.filter(p => !p.bankrupt).length <= 1) {
      return 'game-over';
    }

    const landedTile = this.board[activeBot.position];
    
    // Choose bot decision
    const decision = getBotMonopolyDecision(
      activeBot,
      this.board,
      this.monopolyPhase,
      this.monopolyActiveDebt,
      landedTile,
      null, // auctionState
      this.monopolyLandedBuildMaxHouses,
      this.rules.ruleset === 'Get Rich'
    );

    if (!decision) {
      throw new Error(`Bot returned undefined decision in phase: ${this.monopolyPhase}`);
    }

    const oldPhase = this.monopolyPhase;
    const oldTurn = this.turnIndex;
    
    this.handleMonopolyActionSingle(decision.action, decision.payload);
    
    // Safety check: Did the state actually change? If phase and turn did not change, and it's not a multi-step action, we might be stuck!
    if (this.monopolyPhase === oldPhase && this.turnIndex === oldTurn && decision.action === 'end-turn') {
      throw new Error(`State did not change after end-turn action! (Phase remains: ${this.monopolyPhase})`);
    }

    return 'continue';
  }
}

const runFuzzing = (ruleset: string) => {
  console.log(`\n--- Fuzzing State Machine under ruleset: "${ruleset}" ---`);
  const fuzzer = new MonopolyFuzzer(ruleset);
  
  try {
    let result = 'continue';
    const maxSteps = 2000;
    while (result === 'continue' && fuzzer.stepCount < maxSteps) {
      result = fuzzer.fuzzStep();
    }
    console.log(`[PASS] Successfully completed ${fuzzer.stepCount} steps of random fuzzed state transitions without deadlock!`);
  } catch (err: any) {
    console.error(`[FAIL] DEADLOCK or ERROR detected at step ${fuzzer.stepCount}:`);
    console.error(err.message);
    console.log('\n--- Fuzzer Logs ---');
    console.log(fuzzer.logs.slice(-20).join('\n'));
    process.exit(1);
  }
};

const runAllFuzzers = () => {
  console.log('=== STARTING MONOPOLY FUZZER TEST ===');
  runFuzzing('Default');
  runFuzzing('Get Rich');
  console.log('\n=== FUZZER COMPLETED SUCCESSFULLY: NO BOT DEADLOCKS DETECTED! ===');
};

runAllFuzzers();
