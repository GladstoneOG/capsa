import type { SumoCharacter, SumoBumper } from './sumoPhysics';

export interface SumoRules {
  turnDuration: number; // 5, 10, or 15 seconds
  arenaRadius: number;  // starts at 300px
  shrinkingArena: boolean;
  bumpersCount: number;
}

export const DEFAULT_SUMO_RULES: SumoRules = {
  turnDuration: 10,
  arenaRadius: 300,
  shrinkingArena: true,
  bumpersCount: 2
};

// Calculate the bot's move using prediction and boundary checking
export function calculateSumoBotMove(
  bot: SumoCharacter,
  allCharacters: SumoCharacter[],
  _bumpers: SumoBumper[],
  currentRadius: number,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  centerX = 400,
  centerY = 400
): { angle: number; power: number } {
  // 1. Check if the bot is close to the edge (danger zone)
  const dx = bot.pos.x - centerX;
  const dy = bot.pos.y - centerY;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);

  // If inside the outer 30% of the arena, prioritize getting back to the center
  const isNearEdge = distFromCenter > currentRadius * 0.65;

  let chosenAngleRad = 0;
  let chosenPower = 80;

  if (isNearEdge) {
    // DEFENSIVE: Aim directly at the center to save itself
    chosenAngleRad = Math.atan2(centerY - bot.pos.y, centerX - bot.pos.x);
    // Apply high power to recover quickly
    chosenPower = difficulty === 'easy' ? 70 : difficulty === 'medium' ? 85 : 100;
  } else {
    // OFFENSIVE: Target other alive players
    const opponents = allCharacters.filter(c => c.id !== bot.id && c.alive && c.team !== bot.team);
    
    if (opponents.length > 0) {
      // Find the closest opponent
      let closestOpponent = opponents[0];
      let minDistance = Infinity;

      for (const opp of opponents) {
        const ox = opp.pos.x - bot.pos.x;
        const oy = opp.pos.y - bot.pos.y;
        const odist = Math.sqrt(ox * ox + oy * oy);
        if (odist < minDistance) {
          minDistance = odist;
          closestOpponent = opp;
        }
      }

      // Prediction frames based on difficulty
      let predictionFrames = 0;
      if (difficulty === 'medium') {
        predictionFrames = 5;
      } else if (difficulty === 'hard') {
        predictionFrames = 12;
      }

      // Predict target position
      const predictedX = closestOpponent.pos.x + closestOpponent.vel.x * predictionFrames;
      const predictedY = closestOpponent.pos.y + closestOpponent.vel.y * predictionFrames;

      // Aim at predicted position
      chosenAngleRad = Math.atan2(predictedY - bot.pos.y, predictedX - bot.pos.x);

      // Scale power based on distance: push harder if they are far, lighter if very close
      // to avoid flying off ourselves due to rebound momentum
      const distance = Math.sqrt(
        (predictedX - bot.pos.x) * (predictedX - bot.pos.x) + 
        (predictedY - bot.pos.y) * (predictedY - bot.pos.y)
      );

      // Scale power between 40 and 100
      chosenPower = Math.max(35, Math.min(100, distance * 0.25));
    } else {
      // No targets left: wander/stay near center
      chosenAngleRad = Math.atan2(centerY - bot.pos.y, centerX - bot.pos.x);
      chosenPower = 30;
    }
  }

  // Convert radians to degrees (0 to 360)
  let angleDeg = (chosenAngleRad * 180) / Math.PI;

  // Add noise based on difficulty
  if (difficulty === 'easy') {
    angleDeg += (Math.random() - 0.5) * 40;
    chosenPower += (Math.random() - 0.5) * 35;
  } else if (difficulty === 'medium') {
    angleDeg += (Math.random() - 0.5) * 15;
    chosenPower += (Math.random() - 0.5) * 15;
  } else if (difficulty === 'hard') {
    angleDeg += (Math.random() - 0.5) * 5;
    chosenPower += (Math.random() - 0.5) * 5;
  }

  // Clamps
  angleDeg = (angleDeg + 360) % 360;
  chosenPower = Math.max(20, Math.min(100, chosenPower));

  return { angle: angleDeg, power: chosenPower };
}
