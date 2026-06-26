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
  hasGrace?: boolean;
  lastHitBy?: string;
}

export interface SumoBumper {
  pos: Vec2;
  radius: number;
  restitution: number;
  pulseTimer: number; // for bounce visual feedback
  type?: 'circle' | 'triangle' | 'square' | 'line';
  size?: number;
  angle?: number;
}

export interface SumoObstacle {
  pos: Vec2;
  radius: number;
  type: 'speed_boost' | 'slime';
  angle: number;
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

function closestPointOnSegment(pt: Vec2, p1: Vec2, p2: Vec2): Vec2 {
  const ab = { x: p2.x - p1.x, y: p2.y - p1.y };
  const ap = { x: pt.x - p1.x, y: pt.y - p1.y };
  const abLenSq = ab.x * ab.x + ab.y * ab.y;
  if (abLenSq < 0.001) return { ...p1 };
  let t = (ap.x * ab.x + ap.y * ab.y) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: p1.x + t * ab.x, y: p1.y + t * ab.y };
}

// Perform a single step of the physics simulation (deterministic update)
export function simulatePhysicsStep(
  characters: SumoCharacter[],
  bumpers: SumoBumper[],
  arenaRadius: number,
  friction = 0.04,
  centerX = 400,
  centerY = 400,
  obstacles: SumoObstacle[] = []
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

          // Track last hit for scoring kills
          c1.lastHitBy = c2.id;
          c2.lastHitBy = c1.id;
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
      
      // Broad phase check using bounding radius
      const maxDistance = char.radius + bumper.radius;

      if (distSq < maxDistance * maxDistance) {
        let collided = false;
        let nx = 0;
        let ny = 0;
        let overlap = 0;

        const bType = bumper.type || 'circle';
        const bAngle = bumper.angle || 0;
        const bSize = bumper.size || bumper.radius * 2;

        if (bType === 'circle') {
          const dist = Math.sqrt(distSq) || 0.001;
          const minDist = char.radius + bumper.radius;
          if (dist < minDist) {
            collided = true;
            nx = dx / dist;
            ny = dy / dist;
            overlap = minDist - dist;
          }
        } 
        else if (bType === 'line') {
          const halfL = bSize / 2;
          const cosA = Math.cos(bAngle);
          const sinA = Math.sin(bAngle);
          const p1 = { x: bumper.pos.x - cosA * halfL, y: bumper.pos.y - sinA * halfL };
          const p2 = { x: bumper.pos.x + cosA * halfL, y: bumper.pos.y + sinA * halfL };

          const cp = closestPointOnSegment(char.pos, p1, p2);
          const cdx = char.pos.x - cp.x;
          const cdy = char.pos.y - cp.y;
          const cdistSq = cdx * cdx + cdy * cdy;
          const minDist = char.radius + 4; // line thickness padding

          if (cdistSq < minDist * minDist) {
            collided = true;
            const cdist = Math.sqrt(cdistSq) || 0.001;
            nx = cdx / cdist;
            ny = cdy / cdist;
            overlap = minDist - cdist;
          }
        } 
        else if (bType === 'square') {
          const halfS = bSize / 2;
          const cosA = Math.cos(bAngle);
          const sinA = Math.sin(bAngle);

          // Local coordinates
          const ldx = char.pos.x - bumper.pos.x;
          const ldy = char.pos.y - bumper.pos.y;
          const localX = ldx * cosA + ldy * sinA;
          const localY = -ldx * sinA + ldy * cosA;

          const clampedX = Math.max(-halfS, Math.min(halfS, localX));
          const clampedY = Math.max(-halfS, Math.min(halfS, localY));

          const localDistX = localX - clampedX;
          const localDistY = localY - clampedY;
          const localDist = Math.sqrt(localDistX * localDistX + localDistY * localDistY);

          if (localDist < char.radius) {
            collided = true;
            let lnx = 0;
            let lny = 0;
            if (localDist > 0.001) {
              lnx = localDistX / localDist;
              lny = localDistY / localDist;
              overlap = char.radius - localDist;
            } else {
              // Circle center is inside square, push out to closest edge
              const distX = halfS - Math.abs(localX);
              const distY = halfS - Math.abs(localY);
              if (distX < distY) {
                lnx = localX >= 0 ? 1 : -1;
                lny = 0;
                overlap = char.radius + distX;
              } else {
                lnx = 0;
                lny = localY >= 0 ? 1 : -1;
                overlap = char.radius + distY;
              }
            }
            // Rotate local normal back to world
            nx = lnx * cosA - lny * sinA;
            ny = lnx * sinA + lny * cosA;
          }
        } 
        else if (bType === 'triangle') {
          const r = bSize;
          const vAngle0 = bAngle - Math.PI / 2;
          const vAngle1 = bAngle + 5 * Math.PI / 6;
          const vAngle2 = bAngle + Math.PI / 6;

          const v0 = { x: bumper.pos.x + Math.cos(vAngle0) * r, y: bumper.pos.y + Math.sin(vAngle0) * r };
          const v1 = { x: bumper.pos.x + Math.cos(vAngle1) * r, y: bumper.pos.y + Math.sin(vAngle1) * r };
          const v2 = { x: bumper.pos.x + Math.cos(vAngle2) * r, y: bumper.pos.y + Math.sin(vAngle2) * r };

          const cp0 = closestPointOnSegment(char.pos, v0, v1);
          const cp1 = closestPointOnSegment(char.pos, v1, v2);
          const cp2 = closestPointOnSegment(char.pos, v2, v0);

          const d0Sq = (char.pos.x - cp0.x)**2 + (char.pos.y - cp0.y)**2;
          const d1Sq = (char.pos.x - cp1.x)**2 + (char.pos.y - cp1.y)**2;
          const d2Sq = (char.pos.x - cp2.x)**2 + (char.pos.y - cp2.y)**2;

          let cp = cp0;
          let minDistSq = d0Sq;
          if (d1Sq < minDistSq) { cp = cp1; minDistSq = d1Sq; }
          if (d2Sq < minDistSq) { cp = cp2; minDistSq = d2Sq; }

          const dist = Math.sqrt(minDistSq) || 0.001;

          // Check if inside
          const det1 = (v1.x - v0.x) * (char.pos.y - v0.y) - (v1.y - v0.y) * (char.pos.x - v0.x);
          const det2 = (v2.x - v1.x) * (char.pos.y - v1.y) - (v2.y - v1.y) * (char.pos.x - v1.x);
          const det3 = (v0.x - v2.x) * (char.pos.y - v2.y) - (v0.y - v2.y) * (char.pos.x - v2.x);
          const inside = (det1 >= 0 && det2 >= 0 && det3 >= 0) || (det1 <= 0 && det2 <= 0 && det3 <= 0);

          if (inside || dist < char.radius) {
            collided = true;
            if (inside) {
              const dx_dir = cp.x - char.pos.x;
              const dy_dir = cp.y - char.pos.y;
              const d_len = Math.sqrt(dx_dir * dx_dir + dy_dir * dy_dir) || 0.001;
              nx = dx_dir / d_len;
              ny = dy_dir / d_len;
              overlap = char.radius + dist;
            } else {
              const dx_dir = char.pos.x - cp.x;
              const dy_dir = char.pos.y - cp.y;
              const d_len = Math.sqrt(dx_dir * dx_dir + dy_dir * dy_dir) || 0.001;
              nx = dx_dir / d_len;
              ny = dy_dir / d_len;
              overlap = char.radius - dist;
            }
          }
        }

        if (collided) {
          // Static resolution: push player out of the bumper
          char.pos.x += nx * overlap;
          char.pos.y += ny * overlap;

          // Dynamic bounce: reverse player velocity and apply high force
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
  }

  // 3.5 Process Temporary Obstacles (Speed boosts, slimes)
  if (obstacles && obstacles.length > 0) {
    for (const obs of obstacles) {
      for (const char of characters) {
        if (!char.alive) continue;

        const dx = char.pos.x - obs.pos.x;
        const dy = char.pos.y - obs.pos.y;
        const distSq = dx * dx + dy * dy;
        const overlapLimit = char.radius + obs.radius;

        if (distSq < overlapLimit * overlapLimit) {
          if (obs.type === 'speed_boost') {
            const pushForce = 0.55;
            char.vel.x += Math.cos(obs.angle) * pushForce;
            char.vel.y += Math.sin(obs.angle) * pushForce;
          } else if (obs.type === 'slime') {
            char.vel.x *= 0.8;
            char.vel.y *= 0.8;
          }
        }
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
      if (char.hasGrace) {
        // If they have stopped moving, eliminate them
        if (char.vel.x === 0 && char.vel.y === 0) {
          char.alive = false;
          result.eliminatedIds.push(char.id);
        }
      } else {
        char.alive = false;
        result.eliminatedIds.push(char.id);
      }
    } else {
      // They are inside the arena, so grace is no longer active
      char.hasGrace = false;
    }
  }

  return result;
}
