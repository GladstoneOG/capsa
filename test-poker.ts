import { evaluateFiveCardHand, evaluateSevenCardHand, compareScores } from './src/utils/pokerLogic';
import { Card } from './src/utils/gameLogic';

function runTests() {
  console.log('--- STARTING TEXAS HOLDEM POKER TESTS ---');

  // Test 1: Royal Flush
  const royalFlush: Card[] = [
    { id: 'A_S', rank: 'A', suit: 'S' },
    { id: 'K_S', rank: 'K', suit: 'S' },
    { id: 'Q_S', rank: 'Q', suit: 'S' },
    { id: 'J_S', rank: 'J', suit: 'S' },
    { id: '10_S', rank: '10', suit: 'S' },
  ];
  const rfResult = evaluateFiveCardHand(royalFlush);
  console.assert(rfResult.type === 'royalflush', 'Test 1 Failed: Should be Royal Flush');
  console.log('Test 1 Passed: Royal Flush evaluated correctly.');

  // Test 2: Straight Flush
  const straightFlush: Card[] = [
    { id: '9_H', rank: '9', suit: 'H' },
    { id: '8_H', rank: '8', suit: 'H' },
    { id: '7_H', rank: '7', suit: 'H' },
    { id: '6_H', rank: '6', suit: 'H' },
    { id: '5_H', rank: '5', suit: 'H' },
  ];
  const sfResult = evaluateFiveCardHand(straightFlush);
  console.assert(sfResult.type === 'straightflush' && sfResult.score[1] === 7, 'Test 2 Failed: Should be 9-high Straight Flush');
  console.log('Test 2 Passed: Straight Flush evaluated correctly.');

  // Test 3: Four of a Kind
  const quads: Card[] = [
    { id: 'K_S', rank: 'K', suit: 'S' },
    { id: 'K_H', rank: 'K', suit: 'H' },
    { id: 'K_D', rank: 'K', suit: 'D' },
    { id: 'K_C', rank: 'K', suit: 'C' },
    { id: 'A_S', rank: 'A', suit: 'S' },
  ];
  const quadsResult = evaluateFiveCardHand(quads);
  console.assert(quadsResult.type === 'quads' && quadsResult.score[1] === 11 && quadsResult.score[2] === 12, 'Test 3 Failed: Quads');
  console.log('Test 3 Passed: Four of a Kind evaluated correctly.');

  // Test 4: Full House
  const fullHouse: Card[] = [
    { id: '10_S', rank: '10', suit: 'S' },
    { id: '10_H', rank: '10', suit: 'H' },
    { id: '10_D', rank: '10', suit: 'D' },
    { id: '2_S', rank: '2', suit: 'S' },
    { id: '2_D', rank: '2', suit: 'D' },
  ];
  const fhResult = evaluateFiveCardHand(fullHouse);
  console.assert(fhResult.type === 'fullhouse' && fhResult.score[1] === 8 && fhResult.score[2] === 0, 'Test 4 Failed: Full House');
  console.log('Test 4 Passed: Full House evaluated correctly.');

  // Test 5: Wheel Straight (A-2-3-4-5)
  const wheelStraight: Card[] = [
    { id: 'A_S', rank: 'A', suit: 'S' },
    { id: '2_H', rank: '2', suit: 'H' },
    { id: '3_D', rank: '3', suit: 'D' },
    { id: '4_C', rank: '4', suit: 'C' },
    { id: '5_S', rank: '5', suit: 'S' },
  ];
  const wsResult = evaluateFiveCardHand(wheelStraight);
  console.assert(wsResult.type === 'straight' && wsResult.score[1] === 3, 'Test 5 Failed: Wheel Straight should be 5-high (value 3)');
  console.log('Test 5 Passed: Wheel Straight (A-2-3-4-5) evaluated correctly.');

  // Test 6: 7-Card Hand Evaluation
  const sevenCards: Card[] = [
    { id: 'A_S', rank: 'A', suit: 'S' },
    { id: 'K_S', rank: 'K', suit: 'S' },
    { id: 'Q_S', rank: 'Q', suit: 'S' },
    { id: '2_H', rank: '2', suit: 'H' },
    { id: '3_D', rank: '3', suit: 'D' },
    { id: 'J_S', rank: 'J', suit: 'S' },
    { id: '10_S', rank: '10', suit: 'S' },
  ];
  const bestSeven = evaluateSevenCardHand(sevenCards);
  console.assert(bestSeven.type === 'royalflush', 'Test 6 Failed: Best hand should be Royal Flush');
  console.log('Test 6 Passed: Best 5 selected from 7 cards correctly.');

  // Test 7: Hand comparison (Two Pair vs Trips)
  const twoPair: Card[] = [
    { id: 'A_S', rank: 'A', suit: 'S' },
    { id: 'A_H', rank: 'A', suit: 'H' },
    { id: 'K_S', rank: 'K', suit: 'S' },
    { id: 'K_D', rank: 'K', suit: 'D' },
    { id: '2_C', rank: '2', suit: 'C' },
  ];
  const trips: Card[] = [
    { id: '3_S', rank: '3', suit: 'S' },
    { id: '3_H', rank: '3', suit: 'H' },
    { id: '3_D', rank: '3', suit: 'D' },
    { id: 'A_C', rank: 'A', suit: 'C' },
    { id: 'K_C', rank: 'K', suit: 'C' },
  ];
  const tpEval = evaluateFiveCardHand(twoPair);
  const tripsEval = evaluateFiveCardHand(trips);
  console.assert(compareScores(tripsEval.score, tpEval.score) > 0, 'Test 7 Failed: Trips should beat Two Pair');
  console.log('Test 7 Passed: Hand comparison logic works.');

  console.log('--- ALL POKER TESTS PASSED SUCCESSFULLY ---');
}

runTests();
