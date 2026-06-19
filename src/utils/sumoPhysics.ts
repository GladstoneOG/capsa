export interface Vec2 {
  x: number;
  y: number;
}

export interface SumoCharacter {
  id: string;
  name: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  mass: number;
  alive: boolean;
  isBot: boolean;
  avatar: any;
  team?: string;
  eliminatedRound?: number;
  // Visual effects
  squishX?: number;
  squishY?: number;
  squishRotation?: number;
  trail?: Vec2[];
}

export interface SumoBumper {
  pos: Vec2;
  radius: number;
  restitution: number;
  pulseTimer: number; // for bounce visual feedback
}

export interface SumoPhysicsResult {
  collisions: Array<{ p1Id: string; p2Id: string; intensity: number }>;
  bumperHits: Array<{ playerId: string; bumperIdx: number }>;
  eliminatedIds: string[];
}

// Generate equidistant spawn positions in a circle
export function getSumoSpawns(numPlayers: number, centerX = 400, centerY = 400, spawnRadius = 200): Vec2[] {
  const spawns: Vec2[] = [];
  for (let i = 0; i < numPlayers; i++) {
    // Distribute angles evenly, starting from the top (-Math.PI / 2)
    const angle = i * (2 * Math.PI / numPlayers) - Math.PI / 2;
    spawns.push({
      x: centerX + Math.cos(angle) * spawnRadius,
      y: centerY + Math.sin(angle) * spawnRadius
    });
  }
  return spawns;
}

// Perform a single step of the physics simulation (deterministic update)
export function simulatePhysicsStep(
  characters: SumoCharacter[],
  bumpers: SumoBumper[],
  arenaRadius: number,
  friction = 0.04,
  centerX = 400,
  centerY = 400
): SumoPhysicsResult {
  const result: SumoPhysicsResult = {
    collisions: [],
    bumperHits: [],
    eliminatedIds: []
  };

  const restitution = 0.85; // Bounciness between players
  const minSpeedCutoff = 0.05; // Stop completely if speed is very low

  // 1. Move players and apply friction
  for (const char of characters) {
    if (!char.alive) continue;

    // Apply friction/drag
    char.vel.x *= (1 - friction);
    char.vel.y *= (1 - friction);

    // Speed cutoff to prevent infinite slow slide
    const speedSq = char.vel.x * char.vel.x + char.vel.y * char.vel.y;
    if (speedSq < minSpeedCutoff * minSpeedCutoff) {
      char.vel.x = 0;
      char.vel.y = 0;
    }

    // Update position
    char.pos.x += char.vel.x;
    char.pos.y += char.vel.y;

    // Track trail
    if (!char.trail) char.trail = [];
    char.trail.push({ x: char.pos.x, y: char.pos.y });
    if (char.trail.length > 10) char.trail.shift();
  }

  // 2. Resolve Character-to-Character Collisions
  for (let i = 0; i < characters.length; i++) {
    const c1 = characters[i];
    if (!c1.alive) continue;

    for (let j = i + 1; j < characters.length; j++) {
      const c2 = characters[j];
      if (!c2.alive) continue;

      const dx = c2.pos.x - c1.pos.x;
      const dy = c2.pos.y - c1.pos.y;
      const distSq = dx * dx + dy * dy;
      const minDist = c1.radius + c2.radius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = minDist - dist;

        // Normal vector
        const nx = dx / dist;
        const ny = dy / dist;

        // 2a. Static Resolution (Displace to prevent overlap)
        const totalMass = c1.mass + c2.mass;
        const ratio1 = c2.mass / totalMass;
        const ratio2 = c1.mass / totalMass;

        c1.pos.x -= nx * overlap * ratio1;
        c1.pos.y -= ny * overlap * ratio1;
        c2.pos.x += nx * overlap * ratio2;
        c2.pos.y += ny * overlap * ratio2;

        // 2b. Dynamic Resolution (Elastic Collision)
        // Relative velocity
        const rvx = c2.vel.x - c1.vel.x;
        const rvy = c2.vel.y - c1.vel.y;

        // Relative velocity along normal
        const velAlongNormal = rvx * nx + rvy * ny;

        // Only resolve if moving towards each other
        if (velAlongNormal < 0) {
          const impulseScalar = -(1 + restitution) * velAlongNormal / ((1 / c1.mass) + (1 / c2.mass));

          c1.vel.x -= (impulseScalar / c1.mass) * nx;
          c1.vel.y -= (impulseScalar / c1.mass) * ny;
          c2.vel.x += (impulseScalar / c2.mass) * nx;
          c2.vel.y += (impulseScalar / c2.mass) * ny;

          // Track collision intensity for screen shake / sound
          result.collisions.push({
            p1Id: c1.id,
            p2Id: c2.id,
            intensity: impulseScalar
          });
        }
      }
    }
  }

  // 3. Resolve Bumper Collisions
  for (let bIdx = 0; bIdx < bumpers.length; bIdx++) {
    const bumper = bumpers[bIdx];
    
    // Animate bumper pulse
    if (bumper.pulseTimer > 0) {
      bumper.pulseTimer = Math.max(0, bumper.pulseTimer - 1);
    }

    for (const char of characters) {
      if (!char.alive) continue;

      const dx = char.pos.x - bumper.pos.x;
      const dy = char.pos.y - bumper.pos.y;
      const distSq = dx * dx + dy * dy;
      const minDist = char.radius + bumper.radius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const overlap = minDist - dist;

        // Normal pointing outwards from bumper to player
        const nx = dx / dist;
        const ny = dy / dist;

        // Static resolution: push player out of the bumper
        char.pos.x += nx * overlap;
        char.pos.y += ny * overlap;

        // Dynamic bounce: reverse player velocity and apply high force
        
        // If moving towards or even static, launch outwards
        const incomingSpeed = Math.sqrt(char.vel.x * char.vel.x + char.vel.y * char.vel.y);
        const launchSpeed = Math.max(incomingSpeed * bumper.restitution, 8); // Minimum launch kick

        char.vel.x = nx * launchSpeed;
        char.vel.y = ny * launchSpeed;

        bumper.pulseTimer = 15; // Set pulse feedback frames
        result.bumperHits.push({
          playerId: char.id,
          bumperIdx: bIdx
        });
      }
    }
  }

  // 4. Boundary checking (did anyone fall off the arena?)
  for (const char of characters) {
    if (!char.alive) continue;

    const dx = char.pos.x - centerX;
    const dy = char.pos.y - centerY;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    // Check if character is completely off the edge (center of player is outside)
    if (distFromCenter > arenaRadius) {
      char.alive = false;
      result.eliminatedIds.push(char.id);
    }
  }

  return result;
}
