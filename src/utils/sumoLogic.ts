import { simulatePhysicsStep } from './sumoPhysics';
import type { SumoCharacter, SumoBumper, SumoObstacle } from './sumoPhysics';

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

// Helper function to check if a candidate move is safe (lookahead simulation)
function isMoveSafe(
  bot: SumoCharacter,
  angle: number,
  power: number,
  bumpers: SumoBumper[],
  obstacles: SumoObstacle[],
  arenaRadius: number,
  centerX: number,
  centerY: number
): boolean {
  // Create a deep copy of the bot character for simulation
  const testBot: SumoCharacter = {
    ...bot,
    pos: { x: bot.pos.x, y: bot.pos.y },
    vel: {
      x: Math.cos((angle * Math.PI) / 180) * (power * 0.14),
      y: Math.sin((angle * Math.PI) / 180) * (power * 0.14)
    },
    alive: true,
    hasGrace: bot.hasGrace
  };

  // Create deep copies of bumpers and obstacles so their states don't leak
  const testBumpers = bumpers.map(b => ({
    ...b,
    pos: { ...b.pos }
  }));
  const testObstacles = obstacles.map(o => ({
    ...o,
    pos: { ...o.pos }
  }));

  // Simulate up to 45 steps (approx 0.75 seconds of movement)
  const steps = 45;
  for (let i = 0; i < steps; i++) {
    simulatePhysicsStep(
      [testBot],
      testBumpers,
      arenaRadius,
      0.035, // Ground friction
      centerX,
      centerY,
      testObstacles
    );

    if (!testBot.alive) {
      return false; // Fell off or died!
    }

    // Speed cutoff to stop early if bot has stopped moving
    const speed = Math.sqrt(testBot.vel.x * testBot.vel.x + testBot.vel.y * testBot.vel.y);
    if (speed < 0.15) {
      break;
    }
  }

  return true;
}

// Calculate the bot's move using prediction and boundary checking
export function calculateSumoBotMove(
  bot: SumoCharacter,
  allCharacters: SumoCharacter[],
  bumpers: SumoBumper[],
  currentRadius: number,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  centerX = 400,
  centerY = 400,
  obstacles: SumoObstacle[] = []
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

      // Scale power between 35 and 100
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

  // Run safety check and find safe adjustment if needed for medium/hard difficulty
  if (difficulty !== 'easy') {
    const isBaseSafe = isMoveSafe(
      bot,
      angleDeg,
      chosenPower,
      bumpers,
      obstacles,
      currentRadius,
      centerX,
      centerY
    );

    if (!isBaseSafe) {
      let foundSafe = false;

      // 1. Try reducing power first (aiming too hard might cause bounce off)
      const powerFactors = [0.7, 0.4];
      for (const factor of powerFactors) {
        const testPower = Math.max(20, Math.round(chosenPower * factor));
        if (isMoveSafe(bot, angleDeg, testPower, bumpers, obstacles, currentRadius, centerX, centerY)) {
          chosenPower = testPower;
          foundSafe = true;
          break;
        }
      }

      // 2. Try adjusting angle (look for safe paths near the target direction)
      if (!foundSafe) {
        const angleOffsets = [15, -15, 30, -30, 45, -45, 60, -60, 75, -75, 90, -90];
        for (const offset of angleOffsets) {
          const testAngle = (angleDeg + offset + 360) % 360;
          // Try with base power and also reduced power
          for (const powerFactor of [1.0, 0.7, 0.4]) {
            const testPower = Math.max(20, Math.round(chosenPower * powerFactor));
            if (isMoveSafe(bot, testAngle, testPower, bumpers, obstacles, currentRadius, centerX, centerY)) {
              angleDeg = testAngle;
              chosenPower = testPower;
              foundSafe = true;
              break;
            }
          }
          if (foundSafe) break;
        }
      }

      // 3. Fallback: Search all 24 directions to find ANY safe move that points generally towards safety
      if (!foundSafe) {
        let bestAngle = angleDeg;
        let bestPower = 30; // low power fallback
        let closestAngleDiff = Infinity;

        // Try 24 directions with different powers
        for (let a = 0; a < 360; a += 15) {
          for (const p of [60, 40, 20]) {
            if (isMoveSafe(bot, a, p, bumpers, obstacles, currentRadius, centerX, centerY)) {
              // Calculate difference from our original target angle
              const diff1 = Math.abs(a - angleDeg);
              const diff2 = 360 - diff1;
              const diff = Math.min(diff1, diff2);

              if (diff < closestAngleDiff) {
                closestAngleDiff = diff;
                bestAngle = a;
                bestPower = p;
                foundSafe = true;
              }
            }
          }
        }

        if (foundSafe) {
          angleDeg = bestAngle;
          chosenPower = bestPower;
        }
      }
    }
  }

  return { angle: angleDeg, power: chosenPower };
}
