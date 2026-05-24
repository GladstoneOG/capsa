// src/utils/monopolyLogic.ts

export interface TileState {
  index: number;
  name: string;
  type: 'go' | 'property' | 'tax' | 'railroad' | 'utility' | 'chance' | 'chest' | 'jail' | 'parking' | 'gotojail';
  color?: 'brown' | 'lightblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkblue';
  price?: number;
  rent?: number[];
  housePrice?: number;
  mortgageValue?: number;
  owner: string | null;
  houses: number;
  mortgaged: boolean;
  festivalTurns?: number;
}

export const LOCAL_BOARD_TILES: Omit<TileState, 'owner' | 'houses' | 'mortgaged'>[] = [
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
  { index: 12, name: 'Electric Company', type: 'utility', price: 150, rent: [4, 10], mortgageValue: 75 },
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

export interface CardDefinition {
  id: string;
  text: string;
  action: 'move' | 'give_money' | 'take_money' | 'jail_free' | 'goto_jail' | 'back_spaces' | 'nearest_railroad' | 'nearest_utility' | 'pay_each' | 'collect_each' | 'repairs' | 'give_odd_even' | 'give_angel';
  target?: number;
  amount?: number;
  houseCost?: number;
  hotelCost?: number;
}

export const LOCAL_CHANCE_CARDS: CardDefinition[] = [
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
  { id: 'ch_chairman', text: 'You have been elected Chairman of the Board. Pay each player $50.', action: 'pay_each', amount: 50 },
  // Get Rich exclusive cards
  { id: 'ch_odd_even', text: '🎯 Odd/Even Card! Use before rolling to force your dice result to be odd or even.', action: 'give_odd_even' },
  { id: 'ch_angel', text: '😇 Angel Card! Use to skip paying rent OR block a forced acquisition once.', action: 'give_angel' }
];

export const LOCAL_CHEST_CARDS: CardDefinition[] = [
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
  // Get Rich exclusive cards
  { id: 'cc_odd_even', text: '🎯 Odd/Even Card! Use before rolling to force your dice result to be odd or even.', action: 'give_odd_even' },
  { id: 'cc_angel', text: '😇 Angel Card! Use to skip paying rent OR block a forced acquisition once.', action: 'give_angel' }
];

export function getBotMonopolyDecision(
  botPlayer: any,
  board: TileState[],
  phase: string,
  _activeDebt: any,
  landedTile: TileState,
  auctionState?: any,
  landedBuildMaxHouses?: number,
  isGetRich?: boolean
): { action: string; payload?: any } {
  
  if (phase === 'jail_decision') {
    if (botPlayer.getOutOfJailCards > 0) {
      return { action: 'use-jail-card' };
    }
    if (botPlayer.money > 450) {
      return { action: 'pay-jail-fine' };
    }
    return { action: 'roll-jail-doubles' };
  }

  if (phase === 'roll') {
    if (botPlayer.inJail) {
      if (botPlayer.getOutOfJailCards > 0) {
        return { action: 'use-jail-card' };
      }
      if (botPlayer.money > 450) {
        return { action: 'pay-jail-fine' };
      }
      return { action: 'roll-jail-doubles' };
    }
    return { action: 'roll-dice' };
  }

  // Get Rich: Festival - choose cheapest property to boost
  if (phase === 'festival_selection') {
    const ownedProps = board.filter(t =>
      (t.type === 'property' || t.type === 'railroad' || t.type === 'utility') && t.owner === botPlayer.id
    );
    if (ownedProps.length > 0) {
      // Pick highest-rent property
      const best = ownedProps.reduce((a, b) => {
        const aRent = a.rent ? (a.rent[a.houses] || a.rent[0]) : 25;
        const bRent = b.rent ? (b.rent[b.houses] || b.rent[0]) : 25;
        return bRent > aRent ? b : a;
      });
      return { action: 'festival-select', payload: best.index };
    }
    return { action: 'festival-skip' };
  }

  // Get Rich: Airport - bot flies to the most expensive unowned property, or skips
  if (phase === 'airport_selection') {
    if (botPlayer.money >= 100) {
      const unowned = board.filter(t => t.owner === null && t.price && t.price <= botPlayer.money - 100);
      if (unowned.length > 0) {
        unowned.sort((a, b) => (b.price || 0) - (a.price || 0));
        return { action: 'airport-fly', payload: { targetIndex: unowned[0].index } };
      }
    }
    return { action: 'airport-skip' };
  }

  // Get Rich: Force acquire - bot always tries if possible
  if (phase === 'force_acquire_decision') {
    return { action: 'force-acquire' };
  }

  // Get Rich: Angel card for rent skip - bot uses it if it has money problems
  if (phase === 'use_angel_rent') {
    if ((botPlayer.angelCards || 0) > 0 && botPlayer.money < 300) {
      return { action: 'use-angel-rent' };
    }
    return { action: 'decline-angel-rent' };
  }

  // Get Rich: Angel card for blocking force acquisition - owner bot decides
  if (phase === 'use_angel_force') {
    // Use angel if we own the property and would lose it
    if ((botPlayer.angelCards || 0) > 0) {
      return { action: 'use-angel-force' };
    }
    return { action: 'decline-angel-force' };
  }

  // Get Rich: Landed build - bot builds if profitable
  if (phase === 'landed_build') {
    if (landedTile && landedTile.owner === botPlayer.id && landedTile.type === 'property') {
      const maxHouses = landedBuildMaxHouses !== undefined ? landedBuildMaxHouses : 4;
      const currentHouses = landedTile.houses;
      const canBuildCount = maxHouses - currentHouses;
      const housePrice = landedTile.housePrice || 50;
      const availableMoney = botPlayer.money - 200;
      const affordableCount = Math.floor(availableMoney / housePrice);
      const countToBuild = Math.min(canBuildCount, affordableCount);
      if (countToBuild > 0) {
        return { action: 'landed-build', payload: { tileIndex: landedTile.index, count: countToBuild } };
      }
    }
    return { action: 'landed-build-done' };
  }

  if (phase === 'action') {
    if (landedTile && landedTile.owner === null && landedTile.price) {
      // Keep safety margin of $150
      if (botPlayer.money - landedTile.price >= 150) {
        return { action: 'buy-property' };
      } else {
        return { action: 'pass-property' };
      }
    }
    return { action: 'pass-property' };
  }

  if (phase === 'auction' && auctionState) {
    const tile = board[auctionState.tileIndex];
    if (!tile) return { action: 'auction-pass' };
    
    // Base valuation is price
    let maxValuation = tile.price || 100;
    
    // Adjust maxValuation based on colors
    if (tile.type === 'property' && tile.color) {
      const colorGroup = board.filter(t => t.type === 'property' && t.color === tile.color);
      const ownedBySelf = colorGroup.filter(t => t.owner === botPlayer.id).length;
      const ownedByOthers = colorGroup.filter(t => t.owner !== null && t.owner !== botPlayer.id);
      
      if (ownedBySelf > 0) {
        // Completing or progressing monopoly
        maxValuation = Math.floor(maxValuation * (1.2 + ownedBySelf * 0.2));
      } else if (ownedByOthers.length > 0) {
        // Block other's monopoly
        const otherOwners = new Set(ownedByOthers.map(t => t.owner));
        if (otherOwners.size === 1) {
          maxValuation = Math.floor(maxValuation * 1.15);
        }
      }
    }
    
    const nextBid = Math.max(10, auctionState.highestBid + 10);
    // Never bid if it leaves less than $50 cash
    if (nextBid <= maxValuation && botPlayer.money - nextBid >= 50) {
      return { action: 'auction-bid', payload: { bid: nextBid } };
    }
    return { action: 'auction-pass' };
  }

  if (phase === 'card_drawn') {
    return { action: 'ok-card' };
  }

  if (phase === 'bankrupt_decision') {
    // Need to raise money!
    // Look for properties to sell houses or mortgage
    const ownedProperties = board.filter(t => t.owner === botPlayer.id);
    
    // 1. Sell houses first (look for properties with houses > 0)
    const withHouses = ownedProperties.filter(t => t.houses > 0);
    if (withHouses.length > 0) {
      // Sell house from the one with houses
      return { action: 'sell-house', payload: withHouses[0].index };
    }

    // 2. Mortgage properties (look for unmortgaged ones)
    const unmortgaged = ownedProperties.filter(t => !t.mortgaged);
    if (unmortgaged.length > 0) {
      return { action: 'mortgage-property', payload: unmortgaged[0].index };
    }

    // Nothing left to mortgage/sell, bankruptcy
    return { action: 'declare-bankruptcy' };
  }

  if (phase === 'end_turn') {
    if (isGetRich) {
      return { action: 'end-turn' };
    }
    // Try to build houses if we have monopolies and extra money
    const ownedProperties = board.filter(t => t.owner === botPlayer.id && t.type === 'property' && !t.mortgaged);
    
    // Group owned by color
    const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue'] as const;
    for (const color of colors) {
      // Check if we own monopoly in this color
      const totalInColor = board.filter(t => t.type === 'property' && t.color === color).length;
      const ownedInColor = ownedProperties.filter(t => t.color === color);
      
      const ownsMonopoly = totalInColor > 0 && totalInColor === ownedInColor.length;
      const anyMortgaged = board.filter(t => t.type === 'property' && t.color === color).some(t => t.mortgaged);
      
      if (ownsMonopoly && !anyMortgaged) {
        // Can build! Find the property with the minimum houses to build evenly
        ownedInColor.sort((a, b) => a.houses - b.houses);
        const target = ownedInColor[0];
        if (target && target.houses < 5 && botPlayer.money - (target.housePrice || 0) >= 200) {
          return { action: 'build-house', payload: target.index };
        }
      }
    }

    return { action: 'end-turn' };
  }

  return { action: 'end-turn' };
}

export function evaluateBotTrade(
  botPlayer: any,
  _otherPlayer: any,
  board: TileState[],
  offer: {
    senderProperties: number[];
    senderMoney: number;
    receiverProperties: number[];
    receiverMoney: number;
    senderJailCards: number;
    receiverJailCards: number;
  }
): boolean {
  // botPlayer is the receiver of the trade offer, otherPlayer is the sender
  
  // Calculate value of assets bot is giving away
  let givingValue = offer.receiverMoney;
  givingValue += offer.receiverJailCards * 50;
  for (const idx of offer.receiverProperties) {
    const tile = board[idx];
    if (tile) {
      givingValue += getBotPropertyValuation(botPlayer, tile, board, true);
    }
  }
  
  // Calculate value of assets bot is receiving
  let receivingValue = offer.senderMoney;
  receivingValue += offer.senderJailCards * 50;
  for (const idx of offer.senderProperties) {
    const tile = board[idx];
    if (tile) {
      receivingValue += getBotPropertyValuation(botPlayer, tile, board, false);
    }
  }
  
  // Bots cannot accept if they don't have enough money to give
  if (offer.receiverMoney > botPlayer.money) {
    return false;
  }

  // Calculate ratio of offered value to requested value
  const ratio = givingValue > 0 ? receivingValue / givingValue : 1.0;
  let rejectChance: number;

  if (ratio >= 1.0) {
    // Rejection chance decreases as the offer becomes more generous
    rejectChance = Math.max(0.0, 0.5 - (ratio - 1.0) * 0.85);
  } else {
    // Rejection chance increases as the offer gets worse
    rejectChance = Math.min(1.0, 0.5 + (1.0 - ratio) * 2.0);
    // Strict threshold: always reject if offer value is less than 75% of requested value
    if (ratio < 0.75) {
      rejectChance = 1.0;
    }
  }

  // Random roll to determine acceptance
  return Math.random() >= rejectChance;
}

function getBotPropertyValuation(botPlayer: any, tile: TileState, board: TileState[], isGiving: boolean): number {
  const value = tile.price || 100;
  if (tile.type !== 'property' || !tile.color) {
    return value;
  }
  
  const colorGroup = board.filter(t => t.type === 'property' && t.color === tile.color);
  const ownedBySelf = colorGroup.filter(t => t.owner === botPlayer.id).length;
  
  if (isGiving) {
    if (ownedBySelf === colorGroup.length) {
      return value * 2.0; // Monopoly is precious
    }
    if (ownedBySelf > 1) {
      return value * 1.5;
    }
    return value;
  } else {
    const ownedBySelfNew = ownedBySelf + 1;
    if (ownedBySelfNew === colorGroup.length) {
      return value * 2.2; // Completes monopoly!
    }
    if (ownedBySelfNew > 1) {
      return value * 1.6;
    }
    return value;
  }
}
