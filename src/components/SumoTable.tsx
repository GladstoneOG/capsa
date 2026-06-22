import React, { useEffect, useRef, useState } from 'react';
import type { Vec2, SumoCharacter, SumoBumper, SumoObstacle } from '../utils/sumoPhysics';
import { simulatePhysicsStep } from '../utils/sumoPhysics';
import { sfx } from '../utils/audio';
import { AvatarSVG } from './AvatarCreator';

interface SumoTableProps {
  playerId: string;
  players: any[]; // Players list from lobby/room
  roomCode: string;
  isHost: boolean;
  isSinglePlayer: boolean;
  rules: any;
  gameState: string;
  sumoPhase: string;       // 'aiming' | 'animating' | 'gameover'
  sumoArenaRadius: number;
  sumoBumpers: SumoBumper[];
  sumoObstacles: SumoObstacle[];
  sumoMoves: Record<string, { angle: number; power: number; locked?: boolean }>;
  sumoTurnTimer: number;
  sumoRoundCount: number;
  onSumoAction: (action: string, payload: any) => void;
  onLeaveRoom: () => void;
  onRestartGame: () => void;
}

interface Particle {
  pos: Vec2;
  vel: Vec2;
  color: string;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'clash' | 'dust' | 'splash';
}

export const SumoTable: React.FC<SumoTableProps> = ({
  playerId,
  players,
  isHost,
  isSinglePlayer,
  sumoPhase,
  sumoArenaRadius,
  sumoBumpers,
  sumoObstacles,
  sumoMoves,
  sumoTurnTimer,
  sumoRoundCount,
  onSumoAction,
  onLeaveRoom,
  onRestartGame
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Local aiming state
  const [isAiming, setIsAiming] = useState(false);
  const [dragStart, setDragStart] = useState<Vec2 | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Vec2 | null>(null);
  const [aimAngle, setAimAngle] = useState(0);
  const [aimPower, setAimPower] = useState(0);
  const [hasLockedIn, setHasLockedIn] = useState(false);

  const latestAimingStateRef = useRef({ isAiming, dragStart, aimAngle, aimPower, onSumoAction });
  latestAimingStateRef.current = { isAiming, dragStart, aimAngle, aimPower, onSumoAction };

  // Particles & screen shake
  const particlesRef = useRef<Particle[]>([]);
  const shakeIntensityRef = useRef(0);
  const shakeTimerRef = useRef(0);

  // Local physics copy of players for the animation loop
  const localCharactersRef = useRef<SumoCharacter[]>([]);
  const localBumpersRef = useRef<SumoBumper[]>([]);
  const localObstaclesRef = useRef<SumoObstacle[]>([]);
  const [isAnimatingLocal, setIsAnimatingLocal] = useState(false);

  const resolveEmittedRef = useRef(false);

  // Water background waves variables
  const waveOffsetRef = useRef(0);

  const [visualPhase, setVisualPhase] = useState(sumoPhase);

  // Synchronize visualPhase with sumoPhase when appropriate
  useEffect(() => {
    if (sumoPhase === 'animating') {
      setVisualPhase('animating');
    } else {
      if (!isAnimatingLocal) {
        setVisualPhase(sumoPhase);
      }
    }
  }, [sumoPhase, isAnimatingLocal]);

  // Synchronize local physics bodies when turn or players list changes
  useEffect(() => {
    if (visualPhase === 'aiming') {
      resolveEmittedRef.current = false;
      const myMove = sumoMoves[playerId];
      setHasLockedIn(!!myMove?.locked);

      if (!isAiming) {
        if (myMove) {
          setAimAngle(myMove.angle);
          setAimPower(myMove.power);
        } else {
          setAimAngle(0);
          setAimPower(0);
        }
      }

      localCharactersRef.current = players.map(p => ({
        id: p.id,
        name: p.name,
        pos: { x: p.positionX || 400, y: p.positionY || 400 },
        vel: { x: p.velocityX || 0, y: p.velocityY || 0 },
        radius: p.radius || 18,
        mass: p.mass || 1,
        alive: p.alive !== false,
        isBot: p.isBot || false,
        avatar: p.avatar,
        team: p.team
      }));

      localBumpersRef.current = sumoBumpers.map(b => ({
        ...b,
        pos: { ...b.pos }
      }));

      localObstaclesRef.current = (sumoObstacles || []).map(o => ({
        ...o,
        pos: { ...o.pos }
      }));
    }
  }, [players, visualPhase, sumoBumpers, sumoObstacles, sumoMoves, playerId, isAiming]);

  // Listen to window pointer events when aiming to prevent premature release when hovering outside canvas/other elements
  useEffect(() => {
    if (!isAiming) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const state = latestAimingStateRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !state.dragStart) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 800;
      const y = ((e.clientY - rect.top) / rect.height) * 800;

      setDragCurrent({ x, y });

      const dx = x - state.dragStart.x;
      const dy = y - state.dragStart.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);

      const angleRad = Math.atan2(-dy, -dx);
      const angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
      setAimAngle(angleDeg);

      const maxDragLength = 145;
      const power = Math.min(100, Math.round((dragDist / maxDragLength) * 100));
      setAimPower(power);

      if (Math.random() < 0.15) {
        sfx.playSumoDrag();
      }
    };

    const handleWindowPointerUp = () => {
      const state = latestAimingStateRef.current;
      setIsAiming(false);
      setDragStart(null);
      setDragCurrent(null);
      
      const currentPower = latestAimingStateRef.current.aimPower;
      const currentAngle = latestAimingStateRef.current.aimAngle;
      if (currentPower > 0) {
        state.onSumoAction('submit-move', { angle: currentAngle, power: currentPower, locked: false });
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [isAiming]);

  // Handle launch and simulation loop when phase shifts to animating
  useEffect(() => {
    if (visualPhase === 'animating' && !isAnimatingLocal) {
      setIsAnimatingLocal(true);
      
      // Initialize local characters with fresh copies
      const chars = players.map(p => {
        const posX = p.positionX || 400;
        const posY = p.positionY || 400;
        const dx = posX - 400;
        const dy = posY - 400;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        return {
          id: p.id,
          name: p.name,
          pos: { x: posX, y: posY },
          vel: { x: p.velocityX || 0, y: p.velocityY || 0 },
          radius: p.radius || 18,
          mass: p.mass || 1,
          alive: p.alive !== false,
          isBot: p.isBot || false,
          avatar: p.avatar,
          team: p.team,
          hasGrace: distFromCenter > sumoArenaRadius
        };
      });

      // Apply launch velocity to characters based on submitted moves
      chars.forEach(char => {
        if (!char.alive) return;
        const move = sumoMoves[char.id];
        if (move && (move.power > 0)) {
          const rad = (move.angle * Math.PI) / 180;
          const launchSpeed = move.power * 0.14; // Convert power (0-100) to actual velocity
          char.vel.x = Math.cos(rad) * launchSpeed;
          char.vel.y = Math.sin(rad) * launchSpeed;
        }
      });

      localCharactersRef.current = chars;
      sfx.playSumoLaunch();

      // Trigger animation frame loop
      let animFrameId: number;
      let frameCount = 0;
      const maxFrames = 240; // Max 240 physics steps
      const turnEliminations: string[] = [];

      let lastTime: number | null = null;
      let accumulator = 0;
      const stepTime = 1000 / 60; // 16.67ms per physics step

      const stepSim = (timestamp: number) => {
        if (visualPhase !== 'animating') {
          setIsAnimatingLocal(false);
          return;
        }

        if (lastTime === null) {
          lastTime = timestamp;
        }
        let dt = timestamp - lastTime;
        if (dt > 100) dt = 100; // Cap dt to avoid spiral of death
        lastTime = timestamp;

        accumulator += dt;

        let reachedEnd = false;

        while (accumulator >= stepTime) {
          accumulator -= stepTime;
          frameCount++;

          // 1. Run physics step
          const result = simulatePhysicsStep(
            localCharactersRef.current,
            localBumpersRef.current,
            sumoArenaRadius,
            0.035, // Ground friction
            400,
            400,
            localObstaclesRef.current
          );

          // 2. Play sound effects and apply visual feedback
          if (result.collisions.length > 0) {
            sfx.playSumoClash();
            // Spawn collision sparks
            result.collisions.forEach(col => {
              const c1 = localCharactersRef.current.find(c => c.id === col.p1Id);
              const c2 = localCharactersRef.current.find(c => c.id === col.p2Id);
              if (c1 && c2) {
                const spawnX = (c1.pos.x + c2.pos.x) / 2;
                const spawnY = (c1.pos.y + c2.pos.y) / 2;
                spawnParticles(spawnX, spawnY, 'clash', col.intensity * 2);
                
                // Trigger squish
                const angle = Math.atan2(c2.pos.y - c1.pos.y, c2.pos.x - c1.pos.x);
                c1.squishX = 0.7; c1.squishY = 1.3; c1.squishRotation = angle;
                c2.squishX = 0.7; c2.squishY = 1.3; c2.squishRotation = angle + Math.PI;
              }
            });
            shakeIntensityRef.current = Math.min(15, result.collisions[0].intensity * 1.5);
            shakeTimerRef.current = 10;
          }

          if (result.bumperHits.length > 0) {
            sfx.playSumoClash();
            result.bumperHits.forEach(hit => {
              const char = localCharactersRef.current.find(c => c.id === hit.playerId);
              const bump = localBumpersRef.current[hit.bumperIdx];
              if (char && bump) {
                spawnParticles(char.pos.x, char.pos.y, 'clash', 15);
              }
            });
            shakeIntensityRef.current = 14;
            shakeTimerRef.current = 12;
          }

          if (result.eliminatedIds.length > 0) {
            sfx.playSumoSplash();
            result.eliminatedIds.forEach(id => {
              const char = localCharactersRef.current.find(c => c.id === id);
              if (char) {
                spawnParticles(char.pos.x, char.pos.y, 'splash', 25);
              }
              if (!turnEliminations.includes(id)) {
                turnEliminations.push(id);
              }
            });
          }

          // 3. Check if movement finished
          const totalSpeed = localCharactersRef.current.reduce((sum, c) => {
            if (!c.alive) return sum;
            return sum + Math.sqrt(c.vel.x * c.vel.x + c.vel.y * c.vel.y);
          }, 0);

          const motionStopped = totalSpeed < 0.15;

          if (motionStopped || frameCount >= maxFrames) {
            reachedEnd = true;
            break;
          }
        }

        // Apply decay to squish effects (run once per frame)
        localCharactersRef.current.forEach(c => {
          if (c.squishX !== undefined && c.squishY !== undefined) {
            c.squishX += (1 - c.squishX) * 0.15;
            c.squishY += (1 - c.squishY) * 0.15;
            if (Math.abs(1 - c.squishX) < 0.01) {
              c.squishX = undefined;
              c.squishY = undefined;
              c.squishRotation = undefined;
            }
          }
        });

        if (reachedEnd) {
          if (!resolveEmittedRef.current) {
            resolveEmittedRef.current = true;
            setIsAnimatingLocal(false);

            // Report authoritative final positions if host/singleplayer
            if (isHost || isSinglePlayer) {
              const playerStates = localCharactersRef.current.map(c => ({
                id: c.id,
                x: c.pos.x,
                y: c.pos.y,
                vx: 0,
                vy: 0,
                alive: c.alive
              }));

              onSumoAction('resolve-turn', { playerStates, eliminations: turnEliminations });
            }
          }
          return;
        }

        animFrameId = requestAnimationFrame(stepSim);
      };

      animFrameId = requestAnimationFrame(stepSim);
      return () => cancelAnimationFrame(animFrameId);
    }
  }, [visualPhase]);

  // Handle drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let drawFrameId: number;

    const render = () => {
      // 1. Setup screen shake offset
      let shakeX = 0;
      let shakeY = 0;
      if (shakeTimerRef.current > 0) {
        shakeX = (Math.random() - 0.5) * shakeIntensityRef.current;
        shakeY = (Math.random() - 0.5) * shakeIntensityRef.current;
        shakeTimerRef.current--;
      }

      ctx.clearRect(0, 0, 800, 800);
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 2. Draw animated water void background
      waveOffsetRef.current += 0.02;
      drawWaterBackground(ctx, waveOffsetRef.current);

      // 3. Draw Arena Platform with deep 3D drop shadow
      drawArenaPlatform(ctx, sumoArenaRadius);

      // 3.5 Draw Obstacles
      drawObstacles(ctx, localObstaclesRef.current);

      // 4. Draw Bumpers
      drawBumpers(ctx, localBumpersRef.current);

      // 5. Draw Particles
      drawAndUpdateParticles(ctx);

      // 6. Draw Player characters
      drawCharacters(ctx);

      // 7. Draw Aiming drag indicator
      drawAimControls(ctx);

      ctx.restore();
      drawFrameId = requestAnimationFrame(render);
    };

    drawFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(drawFrameId);
  }, [playerId, visualPhase, isAiming, dragStart, dragCurrent, aimAngle, aimPower, sumoArenaRadius]);

  // Aim Drag Handlers (Angry birds inverse drag math using Pointer Events)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (visualPhase !== 'aiming' || hasLockedIn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 800;
    const y = ((e.clientY - rect.top) / rect.height) * 800;

    // Verify if clicked near player character
    const localChar = players.find(p => p.id === playerId);
    if (!localChar || !localChar.alive) return;

    const dx = x - localChar.positionX;
    const dy = y - localChar.positionY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 40) { // Large click margin
      setIsAiming(true);
      setDragStart({ x: localChar.positionX, y: localChar.positionY });
      setDragCurrent({ x, y });
    }
  };

  const lockInMove = () => {
    if (hasLockedIn) return;
    setHasLockedIn(true);
    sfx.playDeal();
    onSumoAction('submit-move', { angle: aimAngle, power: aimPower, locked: true });
  };

  // Particles generator
  const spawnParticles = (x: number, y: number, type: 'clash' | 'dust' | 'splash', count: number) => {
    const particles = particlesRef.current;
    const colors = type === 'clash' 
      ? ['#ff7a00', '#ffd200', '#ffffff', '#ff3600']
      : type === 'splash' 
      ? ['#60a5fa', '#3b82f6', '#1d4ed8', '#eff6ff']
      : ['#94a3b8', '#cbd5e1', '#e2e8f0', '#cbd5e1'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: Math.random() * (type === 'splash' ? 5 : 3.5) + 1.5,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 25 + 15,
        type
      });
    }
  };

  // Drawing Utilities

  const drawWaterBackground = (ctx: CanvasRenderingContext2D, offset: number) => {
    // Sea background gradient - dark brown Dojo/clay arena style
    const grad = ctx.createRadialGradient(400, 400, 50, 400, 400, 550);
    grad.addColorStop(0, '#4a2c11');
    grad.addColorStop(1, '#1e0f05');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 800);

    // Draw scrolling sea waves - sand or wood grain ripples
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.12)';
    ctx.lineWidth = 2.5;
    for (let r = 320; r < 750; r += 70) {
      ctx.beginPath();
      for (let theta = 0; theta < Math.PI * 2; theta += 0.05) {
        // Wave deformation formula
        const dr = Math.sin(theta * 8 + offset * 3) * 6 + Math.cos(theta * 4 - offset) * 4;
        const x = 400 + Math.cos(theta) * (r + dr);
        const y = 400 + Math.sin(theta) * (r + dr);
        if (theta === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  };

  const drawArenaPlatform = (ctx: CanvasRenderingContext2D, radius: number) => {
    const centerX = 400;
    const centerY = 400;

    // Platform bottom rim shadow depth
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 24;
    ctx.shadowOffsetX = 4;
    ctx.fillStyle = '#1e293b'; // Slate dark underside
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3D Rim thickness wall
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(centerX, centerY + 8, radius, 0, Math.PI * 2);
    ctx.fill();

    // Platform Surface
    const ringGrad = ctx.createRadialGradient(centerX, centerY, 50, centerX, centerY, radius);
    ringGrad.addColorStop(0, '#ebd2b0'); // Tatami wood board style
    ringGrad.addColorStop(0.85, '#dcbba2');
    ringGrad.addColorStop(0.96, '#c69580');
    ringGrad.addColorStop(1, '#ff4b00'); // Thick red outer bounding zone
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Red outer border stroke
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner circular ring detailing
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  };

  const drawObstacles = (ctx: CanvasRenderingContext2D, obstacles: SumoObstacle[]) => {
    obstacles.forEach(obs => {
      ctx.save();
      ctx.translate(obs.pos.x, obs.pos.y);

      if (obs.type === 'slime') {
        // Draw organic green slime puddle
        ctx.fillStyle = 'rgba(34, 197, 94, 0.45)'; // Semi-transparent slime green
        ctx.strokeStyle = 'rgba(22, 163, 74, 0.7)';
        ctx.lineWidth = 3;

        // Draw an organic blobby shape
        ctx.beginPath();
        const numPoints = 8;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i * Math.PI * 2) / numPoints;
          // Vary the radius to make it blobby and wavey
          const blobRadius = obs.radius + Math.sin(angle * 3 + waveOffsetRef.current * 2) * 4;
          const px = Math.cos(angle) * blobRadius;
          const py = Math.sin(angle) * blobRadius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw some little bubbles inside the slime
        ctx.fillStyle = 'rgba(240, 253, 244, 0.6)';
        for (let j = 0; j < 3; j++) {
          const bubbleAngle = j * 2 + waveOffsetRef.current * 0.5;
          const bubbleDist = obs.radius * 0.4;
          const bx = Math.cos(bubbleAngle) * bubbleDist;
          const by = Math.sin(bubbleAngle) * bubbleDist;
          ctx.beginPath();
          ctx.arc(bx, by, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } 
      else if (obs.type === 'speed_boost') {
        // Draw speed boost chevron pad
        ctx.rotate(obs.angle);

        // Circular background glow
        const glowGrad = ctx.createRadialGradient(0, 0, obs.radius * 0.2, 0, 0, obs.radius);
        glowGrad.addColorStop(0, 'rgba(249, 115, 22, 0.5)'); // orange glow
        glowGrad.addColorStop(1, 'rgba(249, 115, 22, 0.0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw scrolling chevrons/arrows
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Animated offset for arrow movements
        const arrowOffset = (waveOffsetRef.current * 25) % 18;

        for (let d = -16; d <= 16; d += 14) {
          const xPos = d + arrowOffset - 8;
          // Check if arrow is within bounds
          if (Math.abs(xPos) < obs.radius - 6) {
            ctx.beginPath();
            ctx.moveTo(xPos - 4, -8);
            ctx.lineTo(xPos + 2, 0);
            ctx.lineTo(xPos - 4, 8);
            ctx.stroke();
          }
        }

        // Draw glowing outer dashed rim
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, obs.radius * 0.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  };

  const drawBumpers = (ctx: CanvasRenderingContext2D, bumpers: SumoBumper[]) => {
    bumpers.forEach(bump => {
      const bType = bump.type || 'circle';
      const bAngle = bump.angle || 0;
      const bSize = bump.size || bump.radius * 2;
      const pulseSize = bSize + (bump.pulseTimer > 0 ? Math.sin(bump.pulseTimer * 0.3) * 6 : 0);
      const pulseRadius = bump.radius + (bump.pulseTimer > 0 ? Math.sin(bump.pulseTimer * 0.3) * 3 : 0);

      ctx.save();
      ctx.translate(bump.pos.x, bump.pos.y);

      // Bottom Shadow (all shapes get a corresponding shadow)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.save();
      ctx.translate(0, 4); // shadow offset
      ctx.rotate(bAngle);
      
      ctx.beginPath();
      if (bType === 'circle') {
        ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      } else if (bType === 'line') {
        ctx.rect(-pulseSize / 2, -4, pulseSize, 8);
      } else if (bType === 'square') {
        ctx.rect(-pulseSize / 2, -pulseSize / 2, pulseSize, pulseSize);
      } else if (bType === 'triangle') {
        // Draw equilateral triangle shadow
        const r = pulseSize;
        const vAngle0 = -Math.PI / 2;
        const vAngle1 = 5 * Math.PI / 6;
        const vAngle2 = Math.PI / 6;
        ctx.moveTo(Math.cos(vAngle0) * r, Math.sin(vAngle0) * r);
        ctx.lineTo(Math.cos(vAngle1) * r, Math.sin(vAngle1) * r);
        ctx.lineTo(Math.cos(vAngle2) * r, Math.sin(vAngle2) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Bumper body with gradient and outline
      ctx.rotate(bAngle);
      ctx.beginPath();
      if (bType === 'circle') {
        ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      } else if (bType === 'line') {
        ctx.rect(-pulseSize / 2, -4, pulseSize, 8);
      } else if (bType === 'square') {
        ctx.rect(-pulseSize / 2, -pulseSize / 2, pulseSize, pulseSize);
      } else if (bType === 'triangle') {
        const r = pulseSize;
        const vAngle0 = -Math.PI / 2;
        const vAngle1 = 5 * Math.PI / 6;
        const vAngle2 = Math.PI / 6;
        ctx.moveTo(Math.cos(vAngle0) * r, Math.sin(vAngle0) * r);
        ctx.lineTo(Math.cos(vAngle1) * r, Math.sin(vAngle1) * r);
        ctx.lineTo(Math.cos(vAngle2) * r, Math.sin(vAngle2) * r);
      }
      ctx.closePath();

      // Fill with radial or linear gradient depending on shape
      let grad;
      if (bType === 'circle') {
        grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, pulseRadius);
      } else {
        grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, pulseSize / 2);
      }
      grad.addColorStop(0, '#38bdf8'); // Glowing electric cyan
      grad.addColorStop(0.65, '#0284c7');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
      ctx.fill();

      // Glowing outer rim stroke
      ctx.strokeStyle = bump.pulseTimer > 0 ? '#ffffff' : '#0ea5e9';
      ctx.lineWidth = bump.pulseTimer > 0 ? 4 : 2;
      ctx.stroke();

      // Highlight/reflection dot/line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      if (bType === 'circle') {
        ctx.arc(-pulseRadius * 0.35, -pulseRadius * 0.35, pulseRadius * 0.2, 0, Math.PI * 2);
      } else if (bType === 'line') {
        ctx.rect(-pulseSize / 2 + 4, -2, pulseSize - 8, 2);
      } else if (bType === 'square') {
        ctx.rect(-pulseSize / 2 + 4, -pulseSize / 2 + 4, pulseSize * 0.3, 4);
      } else if (bType === 'triangle') {
        ctx.arc(0, -pulseSize * 0.3, 3, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.restore();
    });
  };

  const drawAndUpdateParticles = (ctx: CanvasRenderingContext2D) => {
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;

      // Update positions
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.vel.y += p.type === 'splash' ? 0.05 : 0; // splash gravity

      // Fade alpha
      p.alpha = 1 - (p.life / p.maxLife);

      // Render
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
      }
    }
  };

  const drawCharacters = (ctx: CanvasRenderingContext2D) => {
    const activeList = visualPhase === 'animating' ? localCharactersRef.current : players;

    activeList.forEach(p => {
      if (!p.alive) return;

      const px = p.positionX ?? p.pos?.x ?? 400;
      const py = p.positionY ?? p.pos?.y ?? 400;
      const radius = p.radius ?? 18;

      // Draw local movement dust trail if fast
      if (visualPhase === 'animating' && p.vel) {
        const speed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);
        if (speed > 1.8 && Math.random() < 0.4) {
          // Add dust particles behind character
          particlesRef.current.push({
            pos: { x: px - p.vel.x * 2, y: py - p.vel.y * 2 },
            vel: { x: (Math.random() - 0.5) * 0.8, y: (Math.random() - 0.5) * 0.8 },
            color: 'rgba(226, 232, 240, 0.45)',
            radius: Math.random() * 3 + 1.5,
            alpha: 1.0,
            life: 0,
            maxLife: 15,
            type: 'dust'
          });
        }
      }

      ctx.save();
      ctx.translate(px, py);

      // Apply squish-and-stretch matrix transforms on collision
      if (p.squishX && p.squishY && p.squishRotation) {
        ctx.rotate(p.squishRotation);
        ctx.scale(p.squishX, p.squishY);
        ctx.rotate(-p.squishRotation);
      }

      // 3D Rim drop shadow under players
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 4, radius, 0, Math.PI * 2);
      ctx.fill();

      // Setup Avatar styles
      const avatar = p.avatar || {
        skinColor: '#F5CBA7',
        hairStyle: 'short',
        hairColor: '#1A1A1A',
        expression: 'smile',
        clothesColor: '#4f46e5'
      };

      const skinColor = avatar.skinColor || '#F5CBA7';
      const clothingColor = avatar.clothesColor || '#4f46e5';
      const hairColor = avatar.hairColor || '#1A1A1A';
      const hairStyle = avatar.hairStyle || 'short';
      const expression = avatar.expression || 'smile';

      // 1. Draw Body Torso (sumo mawashi sash belt detail)
      ctx.fillStyle = clothingColor;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Mawashi belt stroke overlay
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Sumo Belt knot band (drawn across the center)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-radius + 2, -3, (radius - 2) * 2, 6);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(-radius + 2, -3, (radius - 2) * 2, 6);

      // 2. Draw Head Circle
      ctx.fillStyle = skinColor;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -2, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3. Draw Expression details
      ctx.strokeStyle = '#0f172a';
      ctx.fillStyle = '#0f172a';
      ctx.lineWidth = 1.2;

      // Eyes
      ctx.beginPath();
      if (expression === 'excited') {
        // curved lines
        ctx.arc(-3.5, -3, 1, Math.PI, 0, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(3.5, -3, 1, Math.PI, 0, false);
        ctx.stroke();
      } else if (expression === 'cool') {
        // flat sunglasses line
        ctx.fillRect(-6, -4, 4, 2);
        ctx.fillRect(2, -4, 4, 2);
        ctx.stroke();
      } else {
        // dot eyes
        ctx.arc(-3.5, -2.5, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3.5, -2.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth
      ctx.beginPath();
      if (expression === 'smile' || expression === 'cool') {
        ctx.arc(0, -1, 2.5, 0, Math.PI, false);
        ctx.stroke();
      } else if (expression === 'excited') {
        ctx.fillStyle = '#ef4444';
        ctx.arc(0, -1, 3.5, 0, Math.PI, false);
        ctx.fill();
        ctx.stroke();
      } else {
        // flat mouth
        ctx.moveTo(-2.5, 0.5);
        ctx.lineTo(2.5, 0.5);
        ctx.stroke();
      }

      // 4. Draw Hair Styles
      ctx.fillStyle = hairColor;
      if (hairStyle === 'spiky') {
        ctx.beginPath();
        ctx.moveTo(-7, -8);
        ctx.lineTo(-4, -13);
        ctx.lineTo(-2, -9);
        ctx.lineTo(0, -15);
        ctx.lineTo(2, -9);
        ctx.lineTo(4, -13);
        ctx.lineTo(7, -8);
        ctx.closePath();
        ctx.fill();
      } else if (hairStyle === 'bob' || hairStyle === 'short') {
        ctx.beginPath();
        ctx.arc(0, -3.5, radius * 0.56, Math.PI, 0, false);
        ctx.fill();
      } else if (hairStyle === 'dreads') {
        ctx.fillRect(-7, -7, 3, 4);
        ctx.fillRect(4, -7, 3, 4);
        ctx.beginPath();
        ctx.arc(0, -4, radius * 0.56, Math.PI, 0, false);
        ctx.fill();
      }

      ctx.restore();

      // Draw Name tags above character
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      
      // Draw border tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fillRect(px - 45, py - radius - 19, 90, 14);
      ctx.fillStyle = p.id === playerId ? '#ff7a00' : '#f8fafc';
      ctx.fillText(p.name, px, py - radius - 8);

      // Indicator for locked state
      if (visualPhase === 'aiming' && sumoMoves[p.id]?.locked) {
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('LOCKED IN', px, py - radius - 21);
      }
    });
  };

  const drawAimControls = (ctx: CanvasRenderingContext2D) => {
    if (visualPhase !== 'aiming') return;

    const localChar = players.find(p => p.id === playerId);
    if (!localChar || !localChar.alive) return;

    const startX = localChar.positionX;
    const startY = localChar.positionY;

    let arrowAngleRad = 0;
    let arrowPower = 0;
    let arrowLen = 0;
    let isDrawingLine = false;

    if (isAiming && dragStart && dragCurrent) {
      const dx = dragCurrent.x - dragStart.x;
      const dy = dragCurrent.y - dragStart.y;
      const dragDist = Math.sqrt(dx * dx + dy * dy);

      arrowAngleRad = Math.atan2(-dy, -dx);
      arrowPower = aimPower;
      arrowLen = Math.min(100, dragDist * 0.7);
      isDrawingLine = true;
    } else if (aimPower > 0) {
      arrowAngleRad = (aimAngle * Math.PI) / 180;
      arrowPower = aimPower;
      arrowLen = aimPower * 0.7;
      isDrawingLine = true;
    }

    if (isDrawingLine && arrowLen > 10) {
      const ax = startX + Math.cos(arrowAngleRad) * (arrowPower * 1.45);
      const ay = startY + Math.sin(arrowAngleRad) * (arrowPower * 1.45);

      // 1. Draw inverse trajectory guide dotted line
      ctx.strokeStyle = 'rgba(255, 122, 0, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // 2. Draw glowing aiming vector arrow
      const tipX = startX + Math.cos(arrowAngleRad) * arrowLen;
      const tipY = startY + Math.sin(arrowAngleRad) * arrowLen;

      // Outer glow
      ctx.strokeStyle = 'rgba(255, 75, 0, 0.8)';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Inner pointer
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Draw arrowhead
      const headlen = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - headlen * Math.cos(arrowAngleRad - Math.PI / 6), tipY - headlen * Math.sin(arrowAngleRad - Math.PI / 6));
      ctx.lineTo(tipX - headlen * Math.cos(arrowAngleRad + Math.PI / 6), tipY - headlen * Math.sin(arrowAngleRad + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  };

  return (
    <div className="sumo-table-container">
      {/* HUD Bar */}
      <div className="sumo-hud-container">
        {visualPhase === 'aiming' && (
          <>
            <div className="sumo-phase-text">Aiming Phase</div>
            <div className="sumo-timer">{sumoTurnTimer}s</div>
          </>
        )}
        {visualPhase === 'animating' && (
          <div className="sumo-phase-text" style={{ color: '#0ea5e9' }}>Executing Moves...</div>
        )}
        {visualPhase === 'gameover' && (
          <div className="sumo-phase-text" style={{ color: '#ef4444' }}>Match Ended</div>
        )}
        <div className="sumo-turn-counter">Round {sumoRoundCount + 1}</div>
      </div>

      {/* Players Sidebar status HUD */}
      <div className="sumo-players-sidebar">
        {players.map(p => (
          <div key={p.id} className={`sumo-player-card ${p.alive ? '' : 'eliminated'} ${p.id === playerId ? 'active-turn' : ''}`}>
            <div className="sumo-player-avatar-circle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <AvatarSVG 
                config={p.avatar || {
                  skinColor: '#F5CBA7',
                  clothesColor: '#4f46e5',
                  hairColor: '#1A1A1A',
                  hairStyle: 'short',
                  expression: 'smile'
                }} 
                size={28} 
              />
            </div>
            <div className="sumo-player-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                <div className="sumo-player-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>{p.name}</div>
                <div className="sumo-player-score" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9', background: 'rgba(255, 122, 0, 0.2)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(255, 122, 0, 0.4)', flexShrink: 0 }}>
                  {p.score || 0} pts
                </div>
              </div>
              <div className="sumo-player-status">
                {!p.alive ? (
                  <span className="sumo-status-dead">ELIMINATED</span>
                ) : sumoMoves[p.id] ? (
                  <span className="sumo-status-locked">LOCKED IN</span>
                ) : (
                  <span className="sumo-status-aiming">AIMING</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Canvas view */}
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={800}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: '1 / 1',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
            cursor: visualPhase === 'aiming' && !hasLockedIn ? 'crosshair' : 'default',
            touchAction: 'none'
          }}
          onPointerDown={handlePointerDown}
        />
      </div>

      {/* Locking controls overlay */}
      {visualPhase === 'aiming' && (
        <div className="sumo-controls-overlay">
          {isAiming && (
            <div className="sumo-drag-hint" style={{ color: '#ff7a00', fontSize: '1rem', fontWeight: 'bold' }}>
              Angle: {Math.round(aimAngle)}° | Power: {aimPower}%
            </div>
          )}
          {!isAiming && !hasLockedIn && (
            <div className="sumo-drag-hint">Drag your character backward and release to aim</div>
          )}
          {hasLockedIn ? (
            <div className="sumo-drag-hint" style={{ color: '#10b981', fontWeight: 'bold' }}>
              Waiting for other players...
            </div>
          ) : (
            <button 
              className="sumo-lock-btn"
              disabled={aimPower === 0}
              onClick={lockInMove}
            >
              Lock In Move
            </button>
          )}
        </div>
      )}

      {/* Leave table controls */}
      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.75rem', zIndex: 10 }}>
        {visualPhase === 'gameover' && (isHost || isSinglePlayer) && (
          <button 
            className="sumo-lock-btn"
            style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
            onClick={onRestartGame}
          >
            Play Again
          </button>
        )}
        <button 
          className="sumo-lock-btn"
          style={{
            background: '#1e293b',
            boxShadow: 'none',
            padding: '0.5rem 1.5rem',
            fontSize: '0.9rem',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
          onClick={onLeaveRoom}
        >
          Exit Game
        </button>
      </div>
    </div>
  );
};
