// 2D Vector mathematics
export interface Vec2 {
  x: number;
  y: number;
}

export type ProjectileType = 'arrow' | 'boulder' | 'bomber' | 'spear' | 'slingshot';

export interface Projectile {
  id: string;
  type: ProjectileType;
  pos: Vec2;
  vel: Vec2;
  active: boolean;
  radius: number;
  bounces: number; // For slingshot
  rollTimer: number; // For boulder rolling (in seconds/frames)
  trail: Vec2[];
  angle: number;
  spin: number;
  hitCharacterIds: Set<string>; // Characters already hit by this projectile (prevents multi-hit)
  shooterTeam?: 'a' | 'b';
}

export interface TerrainMap {
  heights: number[];
  width: number;
}

export interface LimbHitbox {
  name: 'head' | 'body' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
  type: 'circle' | 'rect';
  offset: Vec2; // relative to character's base position (feet)
  radius?: number;
  width?: number;
  height?: number;
}

export interface CharacterBody {
  id: string; // matches playerId
  position: Vec2; // position of feet on terrain
  velocity: Vec2;
  hp: number;
  maxHp: number;
  characterType: string;
  grounded: boolean;
  isBot: boolean;
  team: 'a' | 'b';
  alive: boolean;
  limbs: LimbHitbox[];
  width: number;
  height: number;
  knockbackState: {
    duration: number; // frames left of knockback posture
    velX: number;
  } | null;
  avatar?: any;
}

export interface SimResult {
  hitTerrain: boolean;
  hitCharacterId: string | null;
  hitLimb: string | null;
  damage: number;
  explosionX?: number;
  explosionY?: number;
  explosionRadius?: number;
  bounced?: boolean;
}

// Generate the hitboxes relative to character base position (feet at (0,0), negative Y is up)
export function getCharacterLimbs(): LimbHitbox[] {
  return [
    { name: 'head', type: 'circle', offset: { x: 0, y: -48 }, radius: 9 },
    { name: 'body', type: 'rect', offset: { x: -8, y: -39 }, width: 16, height: 23 },
    { name: 'leftArm', type: 'rect', offset: { x: -14, y: -35 }, width: 6, height: 16 },
    { name: 'rightArm', type: 'rect', offset: { x: 8, y: -35 }, width: 6, height: 16 },
    { name: 'leftLeg', type: 'rect', offset: { x: -6, y: -16 }, width: 5, height: 16 },
    { name: 'rightLeg', type: 'rect', offset: { x: 1, y: -16 }, width: 5, height: 16 }
  ];
}

// Midpoint displacement algorithm for procedural terrain heights
export function generateTerrain(width: number, roughness: number = 0.5): TerrainMap {
  const size = 1024; // Must be power of 2
  const heights = new Array(size + 1).fill(0);
  
  // Set initial endpoints (canvas height is around 600, so y=400 is mid-bottom)
  heights[0] = 350 + Math.random() * 100;
  heights[size] = 350 + Math.random() * 100;
  
  let step = size;
  let displacement = roughness * 200;
  
  while (step > 1) {
    const half = step / 2;
    for (let i = 0; i < size; i += step) {
      const left = heights[i];
      const right = heights[i + step];
      const mid = (left + right) / 2 + (Math.random() - 0.5) * displacement;
      // Clamp to reasonable screen heights (220 to 520 px on a 600px canvas)
      heights[i + half] = Math.max(220, Math.min(520, mid));
    }
    step = half;
    displacement *= 0.5; // Reduce range each step
  }
  
  // Rescale/stretch the 1025 points to the actual canvas width
  const finalHeights: number[] = [];
  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const index = t * size;
    const i0 = Math.floor(index);
    const i1 = Math.min(size, i0 + 1);
    const frac = index - i0;
    const height = heights[i0] * (1 - frac) + heights[i1] * frac;
    finalHeights.push(Math.round(height));
  }
  
  return { heights: finalHeights, width };
}

// Helper to deform terrain (e.g. explosive craters)
export function deformTerrain(terrain: TerrainMap, centerX: number, radius: number, depth: number): TerrainMap {
  const newHeights = [...terrain.heights];
  const startX = Math.max(0, Math.floor(centerX - radius));
  const endX = Math.min(terrain.width - 1, Math.ceil(centerX + radius));
  
  for (let x = startX; x <= endX; x++) {
    const dx = x - centerX;
    // Semispherical crater formula
    if (Math.abs(dx) < radius) {
      const craterDepth = Math.sqrt(radius * radius - dx * dx) * (depth / radius);
      // Depress the terrain (y increases downwards)
      newHeights[x] = Math.min(550, newHeights[x] + craterDepth);
    }
  }
  
  return { heights: newHeights, width: terrain.width };
}

// Compute terrain slope normal at a given x position
export function getTerrainNormal(terrain: TerrainMap, x: number): Vec2 {
  const clampedX = Math.max(1, Math.min(terrain.width - 2, Math.floor(x)));
  const yL = terrain.heights[clampedX - 1];
  const yR = terrain.heights[clampedX + 1];
  
  // Tangent is (2, yR - yL)
  const dy = yR - yL;
  const dx = 2;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  // Normal pointing UP (away from surface) in canvas coords (Y-down): (dy, -dx)
  return {
    x: dy / len,
    y: -dx / len
  };
}

// Circle to Circle intersection helper
function intersectCircleCircle(c1: Vec2, r1: number, c2: Vec2, r2: number): boolean {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const distSq = dx * dx + dy * dy;
  const rSum = r1 + r2;
  return distSq <= rSum * rSum;
}

// Circle to AABB Rectangle intersection helper
function intersectCircleRect(circle: Vec2, r: number, rectMin: Vec2, rectMax: Vec2): boolean {
  const closestX = Math.max(rectMin.x, Math.min(circle.x, rectMax.x));
  const closestY = Math.max(rectMin.y, Math.min(circle.y, rectMax.y));
  
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distSq = dx * dx + dy * dy;
  return distSq <= r * r;
}

// Core physics step for a single projectile tick
export function simulateProjectileStep(
  proj: Projectile,
  terrain: TerrainMap,
  characters: CharacterBody[],
  wind: number,
  gravity: number = 0.15
): SimResult {
  const result: SimResult = {
    hitTerrain: false,
    hitCharacterId: null,
    hitLimb: null,
    damage: 0
  };

  if (!proj.active) return result;

  // Save trail
  proj.trail.push({ x: proj.pos.x, y: proj.pos.y });
  if (proj.trail.length > 20) proj.trail.shift();

  // Apply gravity and wind
  proj.vel.y += gravity;
  
  // Slingshot bounces are lighter, arrow flies straight, etc.
  const windInfluence = proj.type === 'arrow' ? 0.015 : proj.type === 'spear' ? 0.01 : 0.025;
  proj.vel.x += wind * windInfluence;

  // Move
  proj.pos.x += proj.vel.x;
  proj.pos.y += proj.vel.y;

  // Update angle based on velocity
  if (proj.type !== 'boulder') {
    proj.angle = Math.atan2(proj.vel.y, proj.vel.x);
  } else {
    // Spin boulder
    proj.spin += proj.vel.x * 0.05;
  }

  // Check boundary out of bounds
  if (proj.pos.x < 0 || proj.pos.x >= terrain.width || proj.pos.y > 650) {
    proj.active = false;
    return result;
  }

  // 1. Check Character Collisions (Only against alive, opposite team if multiplayer, or all for testing)
  for (const char of characters) {
    if (!char.alive) continue;
    // Skip teammates (phase through teammates)
    if (proj.shooterTeam && char.team === proj.shooterTeam) continue;
    // Skip characters already hit by this projectile (prevents piercing multi-hit)
    if (proj.hitCharacterIds.has(char.id)) continue;
    
    // Check hit limbs
    for (const limb of char.limbs) {
      const limbPos: Vec2 = {
        x: char.position.x + limb.offset.x,
        y: char.position.y + limb.offset.y
      };

      let hit = false;
      if (limb.type === 'circle') {
        hit = intersectCircleCircle(proj.pos, proj.radius, limbPos, limb.radius || 5);
      } else if (limb.type === 'rect') {
        const minX = limbPos.x;
        const maxX = limbPos.x + (limb.width || 10);
        const minY = limbPos.y;
        const maxY = limbPos.y + (limb.height || 10);
        hit = intersectCircleRect(proj.pos, proj.radius, { x: minX, y: minY }, { x: maxX, y: maxY });
      }

      if (hit) {
        result.hitCharacterId = char.id;
        result.hitLimb = limb.name;
        
        // Calculate raw damage based on projectile type
        let baseDamage = 20;
        let headshotMult = 1.0;

        if (proj.type === 'arrow') {
          baseDamage = 35 + Math.random() * 15;
          headshotMult = 2.5;
        } else if (proj.type === 'boulder') {
          baseDamage = 18 + Math.random() * 7;
          headshotMult = 1.3;
        } else if (proj.type === 'bomber') {
          baseDamage = 22 + Math.random() * 8;
          headshotMult = 1.5;
        } else if (proj.type === 'spear') {
          baseDamage = 28 + Math.random() * 12;
          headshotMult = 2.0;
        } else if (proj.type === 'slingshot') {
          baseDamage = 13 + Math.random() * 5;
          headshotMult = 1.8;
        }

        if (limb.name === 'head') {
          result.damage = Math.round(baseDamage * headshotMult);
        } else {
          result.damage = Math.round(baseDamage);
        }

        // Apply knockback
        const kbVelX = proj.vel.x * 0.25;
        char.knockbackState = {
          duration: 25,
          velX: kbVelX
        };
        char.velocity.x = kbVelX;

        // Spears pierce through players! Others stop.
        proj.hitCharacterIds.add(char.id);
        if (proj.type !== 'spear') {
          proj.active = false;
        }
        
        // If bomber, trigger explosion
        if (proj.type === 'bomber') {
          result.explosionX = proj.pos.x;
          result.explosionY = proj.pos.y;
          result.explosionRadius = 80;
        }

        return result;
      }
    }
  }

  // 2. Check Terrain Collision
  const xIdx = Math.floor(proj.pos.x);
  if (xIdx >= 0 && xIdx < terrain.width) {
    const terrY = terrain.heights[xIdx];
    if (proj.pos.y >= terrY) {
      result.hitTerrain = true;
      proj.pos.y = terrY; // Snap to ground

      if (proj.type === 'slingshot' && proj.bounces < 3) {
        // Slingshot bounces!
        const normal = getTerrainNormal(terrain, proj.pos.x);
        
        // Reflect velocity: v = v - 2 * (v . n) * n
        const dot = proj.vel.x * normal.x + proj.vel.y * normal.y;
        proj.vel.x = (proj.vel.x - 2 * dot * normal.x) * 0.7;
        proj.vel.y = (proj.vel.y - 2 * dot * normal.y) * 0.7;
        
        // Add a slight upwards bump to prevent re-colliding immediately
        proj.pos.y -= 2;
        proj.bounces++;
        result.bounced = true;
        result.hitTerrain = false; // Override so we don't kill the projectile
      } else if (proj.type === 'bomber') {
        // Explode
        proj.active = false;
        result.explosionX = proj.pos.x;
        result.explosionY = proj.pos.y;
        result.explosionRadius = 80;
        result.damage = Math.round(22 + Math.random() * 8); // base damage for blast calculation
      } else if (proj.type === 'boulder') {
        // Boulder rolls! Transition to roll phase instead of dying immediately
        proj.rollTimer = 90; // Roll for 90 ticks (~1.5s)
        proj.vel.y = 0;
        // Projectile normal reflection but mostly horizontal momentum
        const normal = getTerrainNormal(terrain, proj.pos.x);
        const dot = proj.vel.x * normal.x + proj.vel.y * normal.y;
        proj.vel.x = (proj.vel.x - dot * normal.x) * 0.9; // Project along tangent
      } else {
        // Arrow, spear, etc. die on terrain
        proj.active = false;
      }
    }
  }

  return result;
}

// Simulate rolling boulder along terrain slope
export function rollBoulderStep(
  proj: Projectile,
  terrain: TerrainMap,
  characters: CharacterBody[],
  dt: number = 1
): SimResult {
  const result: SimResult = {
    hitTerrain: true,
    hitCharacterId: null,
    hitLimb: null,
    damage: 0
  };

  if (!proj.active || proj.rollTimer <= 0) {
    proj.active = false;
    return result;
  }

  proj.rollTimer -= dt;
  
  // Calculate slope angle
  const x = proj.pos.x;
  const xIdx = Math.floor(x);
  if (xIdx < 2 || xIdx >= terrain.width - 2) {
    proj.active = false;
    return result;
  }

  const normal = getTerrainNormal(terrain, x);
  // Tangent direction along surface (pointing generally right): (-normal.y, normal.x)
  const tangentX = -normal.y;
  const tangentY = normal.x;

  // Apply gravity along slope: gravity pulls down (y increases downwards in canvas)
  // Project gravity (0, 0.15) onto tangent: dot((0, 0.15), tangent) = 0.15 * tangentY
  const slopeAccel = 0.15 * tangentY;
  proj.vel.x += slopeAccel * tangentX;
  
  // Friction
  proj.vel.x *= 0.96;
  
  // Move along terrain surface
  proj.pos.x += proj.vel.x;
  
  const nextXIdx = Math.floor(proj.pos.x);
  if (nextXIdx < 0 || nextXIdx >= terrain.width) {
    proj.active = false;
    return result;
  }
  
  proj.pos.y = terrain.heights[nextXIdx];
  proj.spin += proj.vel.x * 0.15; // Spin faster

  for (const char of characters) {
    if (!char.alive) continue;
    // Skip teammates (phase through teammates)
    if (proj.shooterTeam && char.team === proj.shooterTeam) continue;
    
    // Simplistic bounding check for rolling boulder (lower limbs only or general feet position check)
    const dist = Math.abs(char.position.x - proj.pos.x);
    if (dist < 15) {
      result.hitCharacterId = char.id;
      result.hitLimb = 'leftLeg'; // Arbitrary leg hit
      result.damage = Math.round(8 + Math.random() * 5); // lower contact damage

      // Apply light knockback
      const kbVelX = proj.vel.x * 0.4;
      char.knockbackState = {
        duration: 15,
        velX: kbVelX
      };
      char.velocity.x = kbVelX;

      // Stop boulder
      proj.active = false;
      return result;
    }
  }

  if (proj.rollTimer <= 0 || Math.abs(proj.vel.x) < 0.1) {
    proj.active = false;
  }

  return result;
}

// Resolve gravity slide for characters standing on terrain
export function resolveCharacterPhysics(
  char: CharacterBody,
  terrain: TerrainMap,
  dt: number = 1
): void {
  if (!char.alive) {
    // Dead ragdoll fall
    char.velocity.y += 0.2; // Dead gravity
    char.position.y += char.velocity.y;
    char.position.x += char.velocity.x;
    char.velocity.x *= 0.95;

    const xIdx = Math.floor(char.position.x);
    if (xIdx >= 0 && xIdx < terrain.width) {
      if (char.position.y >= terrain.heights[xIdx]) {
        char.position.y = terrain.heights[xIdx];
        char.velocity.y = 0;
        char.velocity.x = 0;
      }
    }
    return;
  }

  // Knockback decay
  if (char.knockbackState) {
    char.knockbackState.duration -= dt;
    char.position.x += char.knockbackState.velX;
    
    // Friction
    char.knockbackState.velX *= 0.9;
    
    if (char.knockbackState.duration <= 0) {
      char.knockbackState = null;
      char.velocity.x = 0;
    }
  }

  // Keep player grounded to terrain heights
  const xIdx = Math.floor(char.position.x);
  if (xIdx >= 0 && xIdx < terrain.width) {
    char.position.y = terrain.heights[xIdx];
    char.grounded = true;
  } else {
    // Fell off the map
    char.hp = 0;
    char.alive = false;
  }
}
