import type { Vec2 } from './bowmastersPhysics';

export interface CharacterConfig {
  type: string;
  name: string;
  projectileType: 'arrow' | 'boulder' | 'bomber' | 'spear' | 'slingshot';
  maxHp: number;
  damageRange: [number, number];
  headshotMultiplier: number;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Tricky';
  color: string;
}

export const CHARACTER_PRESETS: Record<string, CharacterConfig> = {
  archer: {
    type: 'archer',
    name: 'Robin Archer',
    projectileType: 'arrow',
    maxHp: 100,
    damageRange: [35, 50],
    headshotMultiplier: 2.5,
    description: 'Fires high-speed precision arrows. Rewarding but hard to aim.',
    difficulty: 'Hard',
    color: '#3498db'
  },
  boulder: {
    type: 'boulder',
    name: 'Stone Thrower',
    projectileType: 'boulder',
    maxHp: 100,
    damageRange: [18, 25],
    headshotMultiplier: 1.3,
    description: 'Launches heavy boulders that roll along the ground on landing.',
    difficulty: 'Easy',
    color: '#95a5a6'
  },
  bomber: {
    type: 'bomber',
    name: 'Crazy Bomber',
    projectileType: 'bomber',
    maxHp: 100,
    damageRange: [22, 30],
    headshotMultiplier: 1.5,
    description: 'Throws explosive bombs that crater the terrain and deal blast damage.',
    difficulty: 'Medium',
    color: '#e74c3c'
  },
  spear: {
    type: 'spear',
    name: 'Leonidas Spear',
    projectileType: 'spear',
    maxHp: 100,
    damageRange: [28, 40],
    headshotMultiplier: 2.0,
    description: 'Throws piercing javelins that pass through multiple targets.',
    difficulty: 'Medium',
    color: '#f1c40f'
  },
  slingshot: {
    type: 'slingshot',
    name: 'David Slingshot',
    projectileType: 'slingshot',
    maxHp: 100,
    damageRange: [12, 18],
    headshotMultiplier: 1.8,
    description: 'Shoots bouncing clay pellets that reflect off the ground.',
    difficulty: 'Tricky',
    color: '#2ecc71'
  }
};

// Generates a random wind value between -3.0 and +3.0
export function generateWind(): number {
  const value = (Math.random() * 6 - 3);
  // Keep 1 decimal place
  return Math.round(value * 10) / 10;
}

// Bot AI Solver: Finds the best angle and power to hit a target
export function calculateBotShot(
  botPos: Vec2,
  targetPos: Vec2,
  wind: number,
  terrainHeights: number[],
  difficulty: 'easy' | 'medium' | 'hard',
  projType: 'arrow' | 'boulder' | 'bomber' | 'spear' | 'slingshot'
): { angle: number; power: number } {
  const gravity = 0.15;
  const windInfluence = projType === 'arrow' ? 0.015 : projType === 'spear' ? 0.01 : 0.025;
  const terrainWidth = terrainHeights.length;
  
  // Decide target X
  // Hard bots aim for head, easy/medium aim for body
  const targetX = targetPos.x;

  // Determine direction: bot to target
  const isTargetToRight = targetX > botPos.x;
  
  // Staged angles (in degrees) to search
  // Typically, PvP shoots at high arcs: 30° to 75°
  const candidateAnglesDeg = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75];
  
  let bestAngleRad = 0;
  let bestPower = 50;
  let minDistance = Infinity;

  // Simulate trajectory for a given angle and power
  const runSim = (angleRad: number, power: number): { hitX: number; hitY: number } => {
    let px = botPos.x;
    let py = botPos.y - 40; // Launch from body/shoulder height
    let vx = Math.cos(angleRad) * (power * 0.12);
    let vy = -Math.sin(angleRad) * (power * 0.12); // Negative Y is up

    // 300 steps limit
    for (let step = 0; step < 300; step++) {
      vy += gravity;
      vx += wind * windInfluence;
      px += vx;
      py += vy;

      if (px < 0 || px >= terrainWidth || py > 650) {
        break;
      }

      const tx = Math.floor(px);
      const ty = terrainHeights[tx];
      if (py >= ty) {
        return { hitX: px, hitY: ty };
      }
    }
    return { hitX: px, hitY: py };
  };

  // Search angles
  for (const deg of candidateAnglesDeg) {
    // Convert to absolute radian relative to bot orientation
    // If shooting right, angle is standard (e.g. 45°). If left, angle is 180° - 45°
    const relativeAngleRad = (deg * Math.PI) / 180;
    const absoluteAngleRad = isTargetToRight ? relativeAngleRad : Math.PI - relativeAngleRad;

    // Binary search power to find the closest shot at this angle
    let lowPower = 20;
    let highPower = 100;
    let bestLocalPower = 50;
    let localMinDist = Infinity;

    for (let iter = 0; iter < 6; iter++) {
      const midPower = (lowPower + highPower) / 2;
      const sim = runSim(absoluteAngleRad, midPower);

      // Distance to target
      const dist = Math.abs(sim.hitX - targetX);
      if (dist < localMinDist) {
        localMinDist = dist;
        bestLocalPower = midPower;
      }

      // Adjust binary search bounds
      // If target is to the right, landing short (sim.hitX < targetX) means we need more power
      if (isTargetToRight) {
        if (sim.hitX < targetX) {
          lowPower = midPower;
        } else {
          highPower = midPower;
        }
      } else {
        // Target is left, landing short (sim.hitX > targetX) means we need more power
        if (sim.hitX > targetX) {
          lowPower = midPower;
        } else {
          highPower = midPower;
        }
      }
    }

    if (localMinDist < minDistance) {
      minDistance = localMinDist;
      bestAngleRad = absoluteAngleRad;
      bestPower = bestLocalPower;
    }
  }

  // Convert radian back to drag angle / parameters
  // The client drag aiming defines the firing angle by translating standard fire angle to radians
  // Let's return the firing angle in degrees (0 to 360) and power (10 to 100)
  let angleDeg = (bestAngleRad * 180) / Math.PI;
  let power = Math.max(10, Math.min(100, bestPower));

  // Add noise based on bot difficulty
  if (difficulty === 'easy') {
    // High inaccuracy
    angleDeg += (Math.random() - 0.5) * 35;
    power += (Math.random() - 0.5) * 30;
  } else if (difficulty === 'medium') {
    // Moderate inaccuracy
    angleDeg += (Math.random() - 0.5) * 15;
    power += (Math.random() - 0.5) * 12;
  } else if (difficulty === 'hard') {
    // Highly precise, minor error
    angleDeg += (Math.random() - 0.5) * 4;
    power += (Math.random() - 0.5) * 3;
  }

  // Clamps
  angleDeg = (angleDeg + 360) % 360;
  power = Math.max(15, Math.min(100, power));

  return { angle: angleDeg, power };
}
