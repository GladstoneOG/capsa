import React, { useEffect, useRef, useState } from 'react';
import type { Vec2, Projectile, CharacterBody } from '../utils/bowmastersPhysics';
import { simulateProjectileStep, rollBoulderStep, resolveCharacterPhysics, getCharacterLimbs, deformTerrain } from '../utils/bowmastersPhysics';
import { CHARACTER_PRESETS } from '../utils/bowmastersLogic';
import type { CharacterConfig } from '../utils/bowmastersLogic';
import { sfx } from '../utils/audio';

interface BowmastersTableProps {
  playerId: string;
  players: any[]; // Player states from lobby/room
  turnOrder: string[];
  turnIndex: number;
  terrain: number[]; // Terrain heightmap
  wind: number;
  lastShot: any | null;
  phase: string; // 'character_select' | 'playing' | 'animating' | 'game_over'
  gameState: string;
  roomCode: string;
  isHost: boolean;
  isSinglePlayer: boolean;
  rules: any;
  onBowmastersAction: (action: string, payload: any) => void;
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
  type: 'spark' | 'smoke' | 'fuse';
}

interface DamageNumber {
  pos: Vec2;
  text: string;
  color: string;
  alpha: number;
  life: number;
}

export const BowmastersTable: React.FC<BowmastersTableProps> = ({
  playerId,
  players,
  turnOrder,
  turnIndex,
  terrain,
  wind,
  lastShot,
  phase,
  roomCode,
  isHost,
  onBowmastersAction,
  onLeaveRoom,
  onRestartGame
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Aim drag state
  const [isAiming, setIsAiming] = useState(false);
  const [dragStart, setDragStart] = useState<Vec2 | null>(null);
  const [aimAngle, setAimAngle] = useState(0);
  const [aimPower, setAimPower] = useState(0);

  // Camera zoom & offset states
  const [cameraZoom, setCameraZoom] = useState(1.0);
  const [cameraOffsetX, setCameraOffsetX] = useState(0);
  const [cameraOffsetY, setCameraOffsetY] = useState(0);

  // Camera animation refs
  const cameraOffsetXRef = useRef(0);
  const cameraOffsetYRef = useRef(0);
  const isManualPanRef = useRef(false);

  // Reset manual panning when turn changes
  useEffect(() => {
    isManualPanRef.current = false;
  }, [turnIndex]);

  // Aim cancellation state
  const [isAimCancelled, setIsAimCancelled] = useState(false);

  // Drag interaction states
  const [dragMode, setDragMode] = useState<'none' | 'aim' | 'pan'>('none');
  const [lastMousePos, setLastMousePos] = useState<Vec2 | null>(null);

  // Touch pinch zoom states
  const [pinchStartDist, setPinchStartDist] = useState<number | null>(null);
  const [pinchStartZoom, setPinchStartZoom] = useState<number>(1.0);

  // Particles & Floating texts
  const particlesRef = useRef<Particle[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  
  // Screen shake
  const shakeIntensityRef = useRef(0);
  const shakeTimerRef = useRef(0);

  // Active projectile tracking
  const activeProjRef = useRef<Projectile | null>(null);

  // Physics sync throttle to prevent multiple resolve emissions
  const resolveEmittedRef = useRef(false);
  // Accumulated hits during the shot simulation
  const accumulatedHitsRef = useRef<any[]>([]);
  // Authoritative terrain deformation details to report
  const terrainDeformRef = useRef<any>(null);

  // Selected preset (visuals) - Premium Blue and Twilight theme defaults
  const [colorTheme, setColorTheme] = useState({
    skyGradient: ['#1A365D', '#2B6CB0'], // Midnight Lapis Blue
    terrainGradient: ['#55a630', '#2b9348', '#007f5f'],
    sunColor: '#facc15'
  });

  // Keep track of characters bodies locally for simulation
  const characterBodiesRef = useRef<CharacterBody[]>([]);

  // Choose a color theme randomly based on roomCode
  useEffect(() => {
    const hash = roomCode.charCodeAt(0) || 0;
    const themes = [
      {
        skyGradient: ['#1A365D', '#2B6CB0'], // Lapis Skyline Day
        terrainGradient: ['#55a630', '#2b9348', '#007f5f'],
        sunColor: '#facc15'
      },
      {
        skyGradient: ['#0B132B', '#1C2541'], // Dark Cyber Space
        terrainGradient: ['#22c55e', '#15803d', '#14532d'],
        sunColor: '#ffd700'
      },
      {
        skyGradient: ['#0F172A', '#1D4ED8'], // Deep Twilight Horizon
        terrainGradient: ['#f4f6f7', '#bdc3c7', '#7f8c8d'],
        sunColor: '#facc15'
      }
    ];
    setColorTheme(themes[hash % themes.length]);
  }, [roomCode]);

  // Keep camera zoom and offsets in bounds (min zoom 1.0, and offset within terrain bounds)
  useEffect(() => {
    if (cameraZoom < 1.0) {
      setCameraZoom(1.0);
      return;
    }
    const worldW = terrain.length || 1200;
    const maxOffsetX = 600 * (1 - 1 / cameraZoom);
    const minOffsetX = 600 * (1 + 1 / cameraZoom) - worldW;
    const maxOffsetY = 300 * (1 - 1 / cameraZoom);

    setCameraOffsetX(prev => Math.max(minOffsetX, Math.min(maxOffsetX, prev)));
    setCameraOffsetY(prev => Math.max(-maxOffsetY, Math.min(maxOffsetY, prev)));
  }, [cameraZoom, terrain]);

  // Manually bind wheel event to prevent browser window scrolling while zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomIntensity = 0.05;
      setCameraZoom(prev => {
        const factor = e.deltaY < 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
        return Math.max(1.0, Math.min(2.5, prev * factor));
      });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [canvasRef.current]);

  // Synchronize local physics bodies when players list or terrain changes
  useEffect(() => {
    if (terrain.length === 0) return;
    
    characterBodiesRef.current = players.map(p => {
      const existing = characterBodiesRef.current.find(b => b.id === p.id);
      // During animation (knockback in progress), preserve the local physics position
      // so mid-animation server broadcasts don't reset characters to pre-knockback positions.
      // Once the phase transitions back to 'playing' (after resolve-shot), server positions
      // are used which contain the correct post-knockback coordinates.
      const preserveLocalPosition = existing && phase === 'animating';
      return {
        id: p.id,
        position: preserveLocalPosition
          ? { ...existing.position }
          : { x: p.positionX || 200, y: p.positionY || terrain[Math.floor(p.positionX || 200)] },
        velocity: existing?.velocity || { x: 0, y: 0 },
        hp: p.hp !== undefined ? p.hp : 100,
        maxHp: p.maxHp || 100,
        characterType: p.characterType || 'archer',
        grounded: p.alive,
        isBot: p.isBot || false,
        team: p.team || 'a',
        alive: p.alive !== false,
        limbs: getCharacterLimbs(),
        width: 24,
        height: 50,
        knockbackState: existing?.knockbackState || null,
        avatar: p.avatar
      };
    });
  }, [players, terrain]);

  // Listen to incoming lastShot triggers from server or local controls
  useEffect(() => {
    if (lastShot && terrain.length > 0) {
      const activePlayer = characterBodiesRef.current.find(b => b.id === lastShot.playerId);
      if (activePlayer) {
        // Spawn projectile
        const rad = (lastShot.angle * Math.PI) / 180;
        const speed = lastShot.power * 0.12;
        const projRadius = lastShot.characterType === 'boulder' ? 10 : lastShot.characterType === 'bomber' ? 7 : 4;
        const spawnDist = 25 + projRadius;

        activeProjRef.current = {
          id: Math.random().toString(),
          type: lastShot.characterType,
          pos: { 
            x: activePlayer.position.x + Math.cos(rad) * spawnDist, 
            y: activePlayer.position.y - 40 - Math.sin(rad) * spawnDist 
          },
          vel: { x: Math.cos(rad) * speed, y: -Math.sin(rad) * speed },
          active: true,
          radius: projRadius,
          bounces: 0,
          rollTimer: 0,
          trail: [],
          angle: rad,
          spin: 0,
          hitCharacterIds: new Set([activePlayer.id]), // Prevent hitting self; tracks all hit characters
          shooterTeam: activePlayer.team
        };

        accumulatedHitsRef.current = [];
        terrainDeformRef.current = null;
        resolveEmittedRef.current = false;
        
        // Play procedural sound based on projectile
        if (lastShot.characterType === 'arrow') sfx.playBowShot();
        else if (lastShot.characterType === 'spear') sfx.playSpearThrow();
        else if (lastShot.characterType === 'slingshot') sfx.playSlingshot();
        else if (lastShot.characterType === 'bomber') sfx.playWhoosh(); // fuse trail sound
        else sfx.playRockThud();
      }
    } else {
      activeProjRef.current = null;
    }
  }, [lastShot, terrain]);

  // Spawns impact particles
  const spawnImpactParticles = (x: number, y: number, color: string, count: number = 15, isExplosion: boolean = false) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isExplosion ? 6 : 3) + 1;
      particlesRef.current.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        color,
        radius: Math.random() * (isExplosion ? 6 : 2) + 1,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 30 + 15,
        type: isExplosion ? 'smoke' : 'spark'
      });
    }
  };

  // Spark particles for fuses
  const spawnFuseSpark = (x: number, y: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 1.5;
    particlesRef.current.push({
      pos: { x, y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      color: '#f97316',
      radius: Math.random() * 1.5 + 0.5,
      alpha: 1,
      life: 0,
      maxLife: 12,
      type: 'fuse'
    });
  };

  // Main Canvas render loop + local physics simulation step
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;

    // Local heightmap reference for craters
    let localHeights = [...terrain];

    const render = () => {
      // 1. Setup Scaling (Independent Logical resolution 1200x600)
      const logicalW = 1200;
      const logicalH = 600;
      const worldW = terrain.length || 1200;
      
      const width = canvas.width = containerRef.current?.clientWidth || window.innerWidth;
      const height = canvas.height = containerRef.current?.clientHeight || 600;

      ctx.save();
      // Apply screen shake
      if (shakeTimerRef.current > 0) {
        shakeTimerRef.current--;
        const shakeX = (Math.random() - 0.5) * shakeIntensityRef.current;
        const shakeY = (Math.random() - 0.5) * shakeIntensityRef.current;
        ctx.translate(shakeX, shakeY);
        // decay shake intensity
        shakeIntensityRef.current *= 0.9;
      }

      ctx.scale(width / logicalW, height / logicalH);

      // 2. Draw Sky Background (always dynamic blue based on colorTheme)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, logicalH);
      skyGrad.addColorStop(0, colorTheme.skyGradient[0]);
      skyGrad.addColorStop(1, colorTheme.skyGradient[1]);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Draw Sun/Moon
      ctx.fillStyle = colorTheme.sunColor;
      ctx.beginPath();
      ctx.arc(600, 120, 35, 0, Math.PI * 2);
      ctx.fill();

      // --- Far Background: City silhouettes (moves at 0.15x parallax) ---
      ctx.save();
      ctx.translate(600, 300);
      ctx.scale(1 + (cameraZoom - 1) * 0.15, 1 + (cameraZoom - 1) * 0.15);
      ctx.translate(-600 + cameraOffsetXRef.current * 0.15, -300 + cameraOffsetYRef.current * 0.15);
      
      ctx.fillStyle = 'rgba(26, 54, 93, 0.14)';
      ctx.beginPath();
      const buildingsFar = [
        { x: -300, w: 90, h: 220 }, { x: -210, w: 70, h: 180 }, { x: -140, w: 100, h: 260 },
        { x: -40, w: 80, h: 200 }, { x: 40, w: 60, h: 240 }, { x: 100, w: 110, h: 170 },
        { x: 210, w: 70, h: 290 }, { x: 280, w: 90, h: 210 }, { x: 370, w: 120, h: 150 },
        { x: 490, w: 80, h: 270 }, { x: 570, w: 70, h: 230 }, { x: 640, w: 100, h: 190 },
        { x: 740, w: 60, h: 250 }, { x: 800, w: 110, h: 180 }, { x: 910, w: 80, h: 280 },
        { x: 990, w: 70, h: 210 }, { x: 1060, w: 90, h: 160 }, { x: 1150, w: 100, h: 260 },
        { x: 1250, w: 80, h: 200 }, { x: 1330, w: 60, h: 240 }, { x: 1390, w: 110, h: 175 },
        { x: 1500, w: 80, h: 295 }, { x: 1580, w: 90, h: 215 }, { x: 1670, w: 120, h: 155 },
        { x: 1790, w: 80, h: 275 }, { x: 1870, w: 70, h: 235 }, { x: 1940, w: 100, h: 195 },
        { x: 2040, w: 65, h: 255 }, { x: 2105, w: 115, h: 185 }, { x: 2220, w: 85, h: 285 },
        { x: 2300, w: 100, h: 210 }
      ];
      buildingsFar.forEach(b => {
        ctx.rect(b.x, 600 - b.h, b.w, b.h);
        if (b.h > 240) {
          ctx.moveTo(b.x + b.w / 2, 600 - b.h);
          ctx.lineTo(b.x + b.w / 2, 600 - b.h - 15);
        }
      });
      ctx.fill();
      ctx.restore();

      // --- Near Background: Closer city silhouettes (moves at 0.3x parallax) ---
      ctx.save();
      ctx.translate(600, 300);
      ctx.scale(1 + (cameraZoom - 1) * 0.3, 1 + (cameraZoom - 1) * 0.3);
      ctx.translate(-600 + cameraOffsetXRef.current * 0.3, -300 + cameraOffsetYRef.current * 0.3);
      
      ctx.fillStyle = 'rgba(21, 47, 86, 0.25)';
      ctx.beginPath();
      const buildingsNear = [
        { x: -260, w: 100, h: 140 }, { x: -160, w: 80, h: 190 }, { x: -80, w: 90, h: 150 },
        { x: 10, w: 70, h: 170 }, { x: 80, w: 110, h: 130 }, { x: 190, w: 90, h: 185 },
        { x: 280, w: 60, h: 120 }, { x: 340, w: 100, h: 210 }, { x: 440, w: 80, h: 145 },
        { x: 520, w: 90, h: 175 }, { x: 610, w: 70, h: 135 }, { x: 680, w: 110, h: 195 },
        { x: 790, w: 60, h: 125 }, { x: 850, w: 100, h: 215 }, { x: 950, w: 80, h: 150 },
        { x: 1030, w: 90, h: 180 }, { x: 1120, w: 70, h: 140 }, { x: 1190, w: 110, h: 200 },
        { x: 1300, w: 60, h: 130 }, { x: 1360, w: 100, h: 220 }, { x: 1460, w: 80, h: 155 },
        { x: 1540, w: 90, h: 185 }, { x: 1630, w: 70, h: 145 }, { x: 1700, w: 110, h: 205 },
        { x: 1810, w: 60, h: 135 }, { x: 1870, w: 100, h: 225 }, { x: 1970, w: 80, h: 160 },
        { x: 2050, w: 90, h: 190 }, { x: 2140, w: 70, h: 150 }, { x: 2210, w: 110, h: 210 },
        { x: 2320, w: 80, h: 140 }
      ];
      buildingsNear.forEach(b => {
        ctx.rect(b.x, 600 - b.h, b.w, b.h);
      });
      ctx.fill();
      ctx.restore();

      // --- Midground: rolling hills and trees (moves at 0.5x parallax) ---
      ctx.save();
      ctx.translate(600, 300);
      ctx.scale(1 + (cameraZoom - 1) * 0.5, 1 + (cameraZoom - 1) * 0.5);
      ctx.translate(-600 + cameraOffsetXRef.current * 0.5, -300 + cameraOffsetYRef.current * 0.5);
      
      // Draw hills
      ctx.fillStyle = 'rgba(21, 100, 61, 0.25)'; // Blend forest green with blue
      ctx.beginPath();
      ctx.moveTo(-300, 600);
      ctx.quadraticCurveTo(150, 370, 500, 440);
      ctx.quadraticCurveTo(850, 510, 1200, 420);
      ctx.quadraticCurveTo(1550, 330, 1900, 450);
      ctx.quadraticCurveTo(2250, 570, 2600, 480);
      ctx.lineTo(2600, 600);
      ctx.closePath();
      ctx.fill();

      // Draw tree silhouettes on midground hills
      const treePositions = [
        { x: -180, y: 450, r: 15 }, { x: -140, y: 442, r: 18 },
        { x: 20, y: 420, r: 16 }, { x: 60, y: 410, r: 20 }, { x: 100, y: 415, r: 14 },
        { x: 450, y: 432, r: 15 }, { x: 490, y: 438, r: 18 }, { x: 530, y: 445, r: 13 },
        { x: 810, y: 488, r: 17 }, { x: 850, y: 480, r: 22 }, { x: 890, y: 485, r: 15 },
        { x: 1140, y: 428, r: 16 }, { x: 1180, y: 420, r: 20 }, { x: 1220, y: 425, r: 14 },
        { x: 1500, y: 362, r: 18 }, { x: 1540, y: 355, r: 24 }, { x: 1580, y: 368, r: 16 },
        { x: 1840, y: 436, r: 15 }, { x: 1880, y: 442, r: 19 }, { x: 1920, y: 448, r: 14 },
        { x: 2200, y: 510, r: 18 }, { x: 2240, y: 502, r: 22 }, { x: 2280, y: 508, r: 15 }
      ];
      
      treePositions.forEach(t => {
        // Trunk
        ctx.fillStyle = 'rgba(100, 65, 40, 0.3)';
        ctx.fillRect(t.x - 3, t.y, 6, 25);
        // Foliage
        ctx.fillStyle = 'rgba(21, 120, 61, 0.38)';
        ctx.beginPath();
        ctx.arc(t.x, t.y - t.r * 0.6, t.r, 0, Math.PI * 2);
        ctx.arc(t.x - t.r * 0.5, t.y - t.r * 1.1, t.r * 0.8, 0, Math.PI * 2);
        ctx.arc(t.x + t.r * 0.5, t.y - t.r * 1.1, t.r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Smooth Camera tracking logic
      const proj = activeProjRef.current;
      const activeShooterId = turnOrder[turnIndex];
      const activeChar = characterBodiesRef.current.find(b => b.id === activeShooterId);

      let targetX = cameraOffsetX;
      let targetY = cameraOffsetY;

      if (proj && proj.active) {
        // Follow the active projectile
        isManualPanRef.current = false;
        targetX = 600 - proj.pos.x;
        targetY = 300 - proj.pos.y;
      } else if (!isManualPanRef.current && activeChar && activeChar.alive) {
        // Center on active player
        targetX = 600 - activeChar.position.x;
        targetY = 300 - (activeChar.position.y - 30);
      }

      // Constrain target offsets to world boundaries
      const maxOffsetX = 600 * (1 - 1 / cameraZoom);
      const minOffsetX = 600 * (1 + 1 / cameraZoom) - worldW;
      const maxOffsetY = 300 * (1 - 1 / cameraZoom);

      const clampedTargetX = Math.max(minOffsetX, Math.min(maxOffsetX, targetX));
      const clampedTargetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, targetY));

      // 60fps linear interpolation for camera offsets
      cameraOffsetXRef.current += (clampedTargetX - cameraOffsetXRef.current) * 0.08;
      cameraOffsetYRef.current += (clampedTargetY - cameraOffsetYRef.current) * 0.08;

      // Apply camera zoom & offset for the main game world
      ctx.save();
      ctx.translate(logicalW / 2, logicalH / 2);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-logicalW / 2 + cameraOffsetXRef.current, -logicalH / 2 + cameraOffsetYRef.current);

      // 3. Draw Terrain Heights
      if (terrain.length > 0) {
        // Sync local heights with props unless deformed
        if (localHeights.length !== terrain.length) {
          localHeights = [...terrain];
        }

        ctx.fillStyle = colorTheme.terrainGradient[1]; // Earth
        ctx.beginPath();
        ctx.moveTo(0, logicalH);
        for (let x = 0; x < worldW; x++) {
          ctx.lineTo(x, localHeights[x]);
        }
        ctx.lineTo(worldW, logicalH);
        ctx.closePath();
        ctx.fill();

        // Draw Grass top border
        ctx.strokeStyle = colorTheme.terrainGradient[0];
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, localHeights[0]);
        for (let x = 1; x < worldW; x++) {
          ctx.lineTo(x, localHeights[x]);
        }
        ctx.stroke();

        // Under earth shading
        const earthGrad = ctx.createLinearGradient(0, 300, 0, logicalH);
        earthGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        earthGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        ctx.fillStyle = earthGrad;
        ctx.beginPath();
        ctx.moveTo(0, logicalH);
        for (let x = 0; x < worldW; x++) {
          ctx.lineTo(x, localHeights[x]);
        }
        ctx.lineTo(worldW, logicalH);
        ctx.closePath();
        ctx.fill();
      }

      // 4. Draw Characters (Rigged Puppet Renderer)
      characterBodiesRef.current.forEach(char => {
        resolveCharacterPhysics(char, { heights: localHeights, width: worldW });

        if (!char.alive && char.position.y > logicalH + 100) {
          // Off screen dead players, skip
          return;
        }

        // Active shooter idle bobbing animation
        const isActiveShooter = turnOrder[turnIndex] === char.id && phase === 'playing';
        const activeBob = (isActiveShooter && char.alive) ? Math.sin(Date.now() * 0.005) * 1.5 : 0;

        ctx.save();
        ctx.translate(char.position.x, char.position.y + activeBob);

        // Flip character sprite horizontally if they are team b
        const shouldFlip = char.team === 'b';
        if (shouldFlip) {
          ctx.scale(-1, 1);
        }

        const avatar = char.avatar || {
          skinColor: '#F5CBA7',
          hairStyle: 'short',
          hairColor: '#1A1A1A',
          expression: 'smile',
          clothesColor: char.team === 'a' ? '#3498db' : '#e74c3c'
        };

        const skinColor = avatar.skinColor || '#F5CBA7';
        const clothingColor = avatar.clothesColor || (char.team === 'a' ? '#3498db' : '#e74c3c');
        const hairColor = avatar.hairColor || '#1A1A1A';
        const hairStyle = avatar.hairStyle || 'short';
        const expression = avatar.expression || 'smile';

        // Apply a premium drop shadow to torso/legs/head
        ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;

        // Simple rigged puppet parts (Offsets relative to base/feet at 0,0)
        // Draw Legs
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        if (char.alive) {
          // Idle legs
          // Left Leg
          ctx.beginPath();
          ctx.moveTo(-4, -16);
          ctx.lineTo(-4, 0);
          ctx.stroke();
          // Right Leg
          ctx.beginPath();
          ctx.moveTo(4, -16);
          ctx.lineTo(4, 0);
          ctx.stroke();
        } else {
          // Dead legs (splayed outwards)
          ctx.beginPath();
          ctx.moveTo(-4, -12);
          ctx.lineTo(-12, 0);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(4, -12);
          ctx.lineTo(12, 0);
          ctx.stroke();
        }

        // Draw Body/Torso
        ctx.fillStyle = clothingColor;
        ctx.beginPath();
        ctx.roundRect(-7, -38, 14, 22, 4);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Draw Head
        const breathSway = char.alive ? Math.sin(Date.now() * 0.003) * 0.8 : 0;
        const hy = -47 + breathSway;
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, hy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Reset shadow for fine expressions and details so they remain sharp
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Draw customized face expression / dead face
        const hs = 8 / 22; // Scale factor from SVG (radius 22) to Canvas (radius 8)
        if (!char.alive) {
          // Draw dead eyes (X X)
          ctx.strokeStyle = '#2c3e50';
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          // Left Eye X
          ctx.beginPath();
          ctx.moveTo(-4.5, hy - 2); ctx.lineTo(-2.5, hy);
          ctx.moveTo(-2.5, hy - 2); ctx.lineTo(-4.5, hy);
          // Right Eye X
          ctx.moveTo(1.5, hy - 2); ctx.lineTo(3.5, hy);
          ctx.moveTo(3.5, hy - 2); ctx.lineTo(1.5, hy);
          ctx.stroke();

          // Dead mouth
          ctx.beginPath();
          ctx.moveTo(-2.5, hy + 3);
          ctx.lineTo(2.5, hy + 2);
          ctx.stroke();
        } else {
          // Draw expression elements
          ctx.strokeStyle = '#2c3e50';
          ctx.fillStyle = '#2c3e50';
          ctx.lineWidth = 2.5 * hs;
          ctx.lineCap = 'round';

          if (expression === 'smile') {
            // Left Eye
            ctx.beginPath();
            ctx.arc(-2.9, hy - 1.1, 0.9, 0, Math.PI * 2);
            ctx.fill();
            // Right Eye
            ctx.beginPath();
            ctx.arc(2.9, hy - 1.1, 0.9, 0, Math.PI * 2);
            ctx.fill();
            // Smile
            ctx.beginPath();
            ctx.moveTo(-2.55, hy + 2.18);
            ctx.quadraticCurveTo(0, hy + 4.73, 2.55, hy + 2.18);
            ctx.stroke();
          } else if (expression === 'excited') {
            // Left Eye
            ctx.beginPath();
            ctx.arc(-2.9, hy - 1.45, 0.9, 0, Math.PI * 2);
            ctx.fill();
            // Right Eye
            ctx.beginPath();
            ctx.arc(2.9, hy - 1.45, 0.9, 0, Math.PI * 2);
            ctx.fill();
            // Laughing mouth
            ctx.fillStyle = '#881337';
            ctx.lineWidth = 1.5 * hs;
            ctx.beginPath();
            ctx.moveTo(-2.9, hy + 1.45);
            ctx.quadraticCurveTo(0, hy + 5.09, 2.9, hy + 1.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Tongue
            ctx.fillStyle = '#FDA4AF';
            ctx.beginPath();
            ctx.moveTo(-1.82, hy + 2.18);
            ctx.quadraticCurveTo(0, hy + 4, 1.82, hy + 2.18);
            ctx.closePath();
            ctx.fill();
          } else if (expression === 'cool') {
            // Sunglasses
            ctx.fillStyle = '#0F172A';
            ctx.beginPath();
            ctx.moveTo(-6.18, hy - 2.18);
            ctx.lineTo(6.18, hy - 2.18);
            ctx.lineTo(5.45, hy + 0.36);
            ctx.bezierCurveTo(4.73, hy + 1.45, 1.09, hy + 1.45, 0.36, hy + 0.36);
            ctx.lineTo(-0.36, hy + 0.36);
            ctx.bezierCurveTo(-1.09, hy + 1.45, -4.73, hy + 1.45, -5.45, hy + 0.36);
            ctx.closePath();
            ctx.fill();
            // Sunglasses arms
            ctx.strokeStyle = '#0F172A';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-6.18, hy - 2.18);
            ctx.lineTo(-8.73, hy - 1.09);
            ctx.moveTo(6.18, hy - 2.18);
            ctx.lineTo(8.73, hy - 1.09);
            ctx.stroke();
            // Sheen line
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-5.09, hy - 1.45);
            ctx.lineTo(-2.55, hy);
            ctx.stroke();
            // Smirk
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-1.82, hy + 2.91);
            ctx.quadraticCurveTo(-0.73, hy + 2.18, 1.45, hy + 3.27);
            ctx.stroke();
          } else if (expression === 'wink') {
            // Left Eye
            ctx.beginPath();
            ctx.arc(-2.9, hy - 1.1, 0.9, 0, Math.PI * 2);
            ctx.fill();
            // Wink Eye (Right)
            ctx.beginPath();
            ctx.moveTo(1.45, hy - 1.09);
            ctx.quadraticCurveTo(2.91, hy - 2.18, 4.36, hy - 1.09);
            ctx.stroke();
            // Cheeky smile
            ctx.beginPath();
            ctx.moveTo(-2.18, hy + 1.82);
            ctx.quadraticCurveTo(0.36, hy + 4.36, 2.18, hy + 1.82);
            ctx.stroke();
          } else if (expression === 'nervous') {
            // Left Eye
            ctx.beginPath();
            ctx.arc(-2.9, hy - 1.1, 0.72, 0, Math.PI * 2);
            ctx.fill();
            // Right Eye
            ctx.beginPath();
            ctx.arc(2.9, hy - 1.1, 0.72, 0, Math.PI * 2);
            ctx.fill();
            // Worried mouth
            ctx.beginPath();
            ctx.moveTo(-2.18, hy + 2.91);
            ctx.lineTo(2.18, hy + 2.18);
            ctx.stroke();
            // Sweat drop
            ctx.fillStyle = '#60A5FA';
            ctx.beginPath();
            ctx.moveTo(7.27, hy - 4.73);
            ctx.bezierCurveTo(7.27, hy - 3.64, 6.55, hy - 2.91, 6.18, hy - 2.91);
            ctx.bezierCurveTo(5.82, hy - 2.91, 5.45, hy - 3.64, 6.18, hy - 4.73);
            ctx.closePath();
            ctx.fill();
          }
        }

        // Draw Hair styles
        if (hairStyle === 'short') {
          ctx.fillStyle = hairColor;
          ctx.beginPath();
          ctx.moveTo(-8, hy - 2.55);
          ctx.bezierCurveTo(-8, hy - 9.09, -3.64, hy - 10.55, 0, hy - 10.55);
          ctx.bezierCurveTo(3.64, hy - 10.55, 8, hy - 9.09, 8, hy - 2.55);
          ctx.bezierCurveTo(6.55, hy - 4.73, 3.64, hy - 6.91, 0, hy - 6.91);
          ctx.bezierCurveTo(-3.64, hy - 6.91, -6.55, hy - 4.73, -8, hy - 2.55);
          ctx.closePath();
          ctx.fill();
        } else if (hairStyle === 'spiky') {
          ctx.fillStyle = hairColor;
          ctx.beginPath();
          ctx.moveTo(-8, hy - 3.27);
          ctx.lineTo(-6.91, hy - 7.64);
          ctx.lineTo(-4.73, hy - 6.18);
          ctx.lineTo(-2.91, hy - 10.55);
          ctx.lineTo(-1.09, hy - 7.64);
          ctx.lineTo(1.09, hy - 11.27);
          ctx.lineTo(3.27, hy - 7.64);
          ctx.lineTo(5.09, hy - 10.18);
          ctx.lineTo(6.91, hy - 6.55);
          ctx.lineTo(8.36, hy - 8.36);
          ctx.lineTo(8, hy - 3.27);
          ctx.closePath();
          ctx.fill();
        } else if (hairStyle === 'long') {
          ctx.fillStyle = hairColor;
          // Back hair
          ctx.beginPath();
          ctx.moveTo(-8, hy);
          ctx.bezierCurveTo(-8, hy - 5.45, -5.45, hy - 9.09, 0, hy - 9.09);
          ctx.bezierCurveTo(5.45, hy - 9.09, 8, hy - 5.45, 8, hy);
          ctx.bezierCurveTo(8, hy + 5.45, 9.45, hy + 8.36, 9.45, hy + 10.91);
          ctx.bezierCurveTo(9.45, hy + 12, 8, hy + 12.73, 7.27, hy + 10.91);
          ctx.bezierCurveTo(6.55, hy + 9.09, 7.27, hy + 3.64, 7.27, hy);
          ctx.bezierCurveTo(7.27, hy - 7.27, -7.27, hy - 7.27, -7.27, hy);
          ctx.bezierCurveTo(-7.27, hy + 3.64, -6.55, hy + 9.09, -7.27, hy + 10.91);
          ctx.bezierCurveTo(-8, hy + 12.73, -9.45, hy + 12, -9.45, hy + 10.91);
          ctx.bezierCurveTo(-9.45, hy + 8.36, -8, hy + 5.45, -8, hy);
          ctx.closePath();
          ctx.fill();

          // Bangs
          ctx.beginPath();
          ctx.moveTo(-8, hy - 3.27);
          ctx.bezierCurveTo(-7.27, hy - 6.18, -4.36, hy - 6.91, 0, hy - 6.91);
          ctx.bezierCurveTo(4.36, hy - 6.91, 7.27, hy - 6.18, 8, hy - 3.27);
          ctx.bezierCurveTo(6.55, hy - 4.73, 3.64, hy - 5.45, 0, hy - 5.45);
          ctx.bezierCurveTo(-3.64, hy - 5.45, -6.55, hy - 4.73, -8, hy - 3.27);
          ctx.closePath();
          ctx.fill();
        } else if (hairStyle === 'bob') {
          ctx.fillStyle = hairColor;
          ctx.beginPath();
          ctx.moveTo(-8.36, hy);
          ctx.bezierCurveTo(-8.73, hy - 5.45, -6.55, hy - 9.09, 0, hy - 9.09);
          ctx.bezierCurveTo(6.55, hy - 9.09, 8.73, hy - 5.45, 8.36, hy);
          ctx.bezierCurveTo(8.36, hy + 1.82, 7.64, hy + 3.64, 8.73, hy + 4.73);
          ctx.bezierCurveTo(8.36, hy + 5.45, 7.27, hy + 4.73, 7.27, hy + 2.55);
          ctx.bezierCurveTo(7.27, hy - 6.91, -7.27, hy - 6.91, -7.27, hy + 2.55);
          ctx.bezierCurveTo(-7.27, hy + 4.73, -8.36, hy + 5.45, -8.73, hy + 4.73);
          ctx.bezierCurveTo(-7.64, hy + 3.64, -8.36, hy + 1.82, -8.36, hy);
          ctx.closePath();
          ctx.fill();
        } else if (hairStyle === 'cap') {
          // Hat base
          ctx.fillStyle = clothingColor;
          ctx.beginPath();
          ctx.moveTo(-8, hy - 2.55);
          ctx.bezierCurveTo(-8, hy - 8.36, -3.64, hy - 9.09, 0, hy - 9.09);
          ctx.bezierCurveTo(3.64, hy - 9.09, 8, hy - 8.36, 8, hy - 2.55);
          ctx.closePath();
          ctx.fill();

          // Visor
          ctx.fillStyle = '#1E293B';
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(-9.45, hy - 2.55);
          ctx.quadraticCurveTo(0, hy - 5.45, 9.45, hy - 2.55);
          ctx.quadraticCurveTo(5.45, hy - 0.73, -9.45, hy - 2.55);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Badge
          ctx.fillStyle = '#E5C158';
          ctx.beginPath();
          ctx.arc(0, hy - 5.82, 1.27, 0, Math.PI * 2);
          ctx.fill();
        } else if (hairStyle === 'bald') {
          // Glare on bald head
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.beginPath();
          ctx.moveTo(-6.18, hy - 5.45);
          ctx.bezierCurveTo(-5.45, hy - 6.55, -2.91, hy - 7.27, -1.82, hy - 7.27);
          ctx.bezierCurveTo(-3.27, hy - 6.55, -5.45, hy - 4.73, -5.45, hy - 3.64);
          ctx.closePath();
          ctx.fill();
        }

        // Draw Arms
        ctx.strokeStyle = skinColor;
        ctx.lineWidth = 3.5;

        if (isActiveShooter && isAiming && char.id === playerId) {
          // Draw aiming arm rotating towards angle
          ctx.save();
          ctx.translate(0, -32);
          // Calculate angle relative to flip
          let armAngle = aimAngle;
          if (shouldFlip) {
            armAngle = Math.PI - aimAngle;
          }
          ctx.rotate(-armAngle);
          
          // Draw arm extending towards weapon
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(15, 0);
          ctx.stroke();

          // Draw weapon held in hand
          ctx.strokeStyle = '#855c33'; // Wood weapon body
          ctx.lineWidth = 2;
          if (char.characterType === 'archer') {
            // Bow arc
            ctx.beginPath();
            ctx.arc(15, 0, 12, -Math.PI / 2, Math.PI / 2);
            ctx.stroke();
            // Bow string
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(15, -12);
            ctx.lineTo(15, 12);
            ctx.stroke();
          } else if (char.characterType === 'spear') {
            // Javelin shaft
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(5, 0);
            ctx.lineTo(25, 0);
            ctx.stroke();
            // Tip
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.moveTo(25, 0);
            ctx.lineTo(21, -3);
            ctx.lineTo(21, 3);
            ctx.closePath();
            ctx.fill();
          } else if (char.characterType === 'bomber') {
            // Holding a black bomb
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(15, 0, 5, 0, Math.PI * 2);
            ctx.fill();
          } else if (char.characterType === 'slingshot') {
            // Y-fork slingshot
            ctx.beginPath();
            ctx.moveTo(12, -4);
            ctx.lineTo(15, 0);
            ctx.lineTo(12, 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(10, 0);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          // Passive arm posture
          if (char.alive) {
            // Left arm dangling
            ctx.beginPath();
            ctx.moveTo(-7, -34);
            ctx.lineTo(-11, -22);
            ctx.stroke();
            // Right arm dangling
            ctx.beginPath();
            ctx.moveTo(7, -34);
            ctx.lineTo(11, -22);
            ctx.stroke();
          } else {
            // Dead arms limp
            ctx.beginPath();
            ctx.moveTo(-7, -34);
            ctx.lineTo(-15, -30);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(7, -34);
            ctx.lineTo(15, -30);
            ctx.stroke();
          }
        }

        ctx.restore();

        // Draw overhead name tag, HP bar, and active turn indicator arrow (not horizontally flipped)
        const pState = players.find(p => p.id === char.id);
        if (pState && pState.alive) {
          ctx.save();
          ctx.translate(char.position.x, char.position.y);

          const uiBaseY = -47; // Base height above feet

          // 1. Draw Bouncing Turn Arrow if this character is the active shooter
          if (isActiveShooter) {
            const arrowBob = Math.sin(Date.now() * 0.007) * 4;
            const arrowY = uiBaseY - 36 + arrowBob;

            ctx.fillStyle = '#f1c40f'; // Vibrant gold
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            ctx.moveTo(0, arrowY); // Tip pointing down
            ctx.lineTo(-6, arrowY - 9); // Left top
            ctx.lineTo(-3, arrowY - 9);
            ctx.lineTo(-3, arrowY - 15); // Left upper top
            ctx.lineTo(3, arrowY - 15); // Right upper top
            ctx.lineTo(3, arrowY - 9);
            ctx.lineTo(6, arrowY - 9); // Right top
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          // 2. Draw Name Tag Box
          ctx.font = 'bold 9px Inter, sans-serif';
          const nameText = (char.id === playerId ? '⭐ ' : '') + pState.name;
          const textWidth = ctx.measureText(nameText).width;
          const boxW = textWidth + 8;
          const boxH = 14;
          const boxX = -boxW / 2;
          const boxY = uiBaseY - 30;

          // Box Background
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 3);
          ctx.fill();

          // Box Border (Team colored)
          ctx.strokeStyle = char.team === 'a' ? '#3498db' : '#e74c3c';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Name Text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(nameText, 0, boxY + boxH / 2 + 0.5);

          // 3. Draw HP Bar
          const barW = 44;
          const barH = 4;
          const barX = -barW / 2;
          const barY = uiBaseY - 13;

          // HP Bar Background
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, barH, 2);
          ctx.fill();

          // HP Bar Fill
          const hpRatio = Math.max(0, Math.min(1, char.hp / (char.maxHp || 100)));
          if (hpRatio > 0) {
            ctx.fillStyle = char.hp < 30 ? '#ef4444' : char.hp < 60 ? '#eab308' : '#22c55e';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * hpRatio, barH, 2);
            ctx.fill();
          }

          ctx.restore();
        }
      });

      // 5. Draw Projectile & Trajectory physics ticks
      if (proj && proj.active) {
        // Run physics steps in visual simulation
        const isBoulderRolling = proj.type === 'boulder' && proj.rollTimer > 0;
        
        let stepResult;
        if (isBoulderRolling) {
          stepResult = rollBoulderStep(proj, { heights: localHeights, width: worldW }, characterBodiesRef.current, 1);
        } else {
          stepResult = simulateProjectileStep(proj, { heights: localHeights, width: worldW }, characterBodiesRef.current, wind);
        }

        // Draw fading trajectory trail
        if (proj.trail.length > 1) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
          for (let i = 1; i < proj.trail.length; i++) {
            ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]); // Reset
        }

        // Render the projectile graphics based on type
        ctx.save();
        ctx.translate(proj.pos.x, proj.pos.y);
        ctx.rotate(proj.angle);

        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';

        if (proj.type === 'arrow') {
          // Draw Robin Arrow
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(10, 0);
          ctx.stroke();

          // Fletching red feathers
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath();
          ctx.moveTo(-10, 0);
          ctx.lineTo(-13, -3);
          ctx.lineTo(-11, 0);
          ctx.lineTo(-13, 3);
          ctx.closePath();
          ctx.fill();

          // Tip
          ctx.fillStyle = '#7f8c8d';
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(6, -2.5);
          ctx.lineTo(7, 0);
          ctx.lineTo(6, 2.5);
          ctx.closePath();
          ctx.fill();
        } else if (proj.type === 'boulder') {
          // Draw rolling boulder rock
          ctx.rotate(proj.spin); // Apply spin rotation
          ctx.fillStyle = '#7f8c8d';
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#5d6d7e';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Crates texture
          ctx.fillStyle = '#5d6d7e';
          ctx.beginPath();
          ctx.arc(-3, -2, 2.5, 0, Math.PI * 2);
          ctx.arc(3, 4, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (proj.type === 'bomber') {
          // Draw Bomb
          ctx.fillStyle = '#2c3e50';
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1a252f';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Brass Cap
          ctx.fillStyle = '#95a5a6';
          ctx.fillRect(-2, -proj.radius - 2, 4, 3);

          // Sparking fuse emitting sparks
          const fuseTipX = 3;
          const fuseTipY = -proj.radius - 6;
          ctx.strokeStyle = '#d35400';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, -proj.radius - 2);
          ctx.quadraticCurveTo(4, -proj.radius - 4, fuseTipX, fuseTipY);
          ctx.stroke();

          spawnFuseSpark(proj.pos.x + fuseTipX, proj.pos.y + fuseTipY);
        } else if (proj.type === 'spear') {
          // Draw golden javelin spear
          ctx.strokeStyle = '#d35400';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(-15, 0);
          ctx.lineTo(15, 0);
          ctx.stroke();

          ctx.fillStyle = '#f1c40f'; // Gold tip
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(9, -3);
          ctx.lineTo(9, 3);
          ctx.closePath();
          ctx.fill();
        } else if (proj.type === 'slingshot') {
          // Draw bouncing clay pellet
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#27ae60';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        ctx.restore();

        // 6. Handle Visual Collision Results Autoratively by Host
        if (stepResult.hitTerrain || stepResult.hitCharacterId || stepResult.explosionX) {
          // Create feedback animations locally
          if (stepResult.explosionX) {
            // Bomber Explosion
            sfx.playExplosion();
            spawnImpactParticles(stepResult.explosionX, stepResult.explosionY!, '#f39c12', 30, true);
            spawnImpactParticles(stepResult.explosionX, stepResult.explosionY!, '#e74c3c', 20, true);
            spawnImpactParticles(stepResult.explosionX, stepResult.explosionY!, '#7f8c8d', 25, true); // smoke

            // Deform heightmap locally instantly for immediate visual feedback
            localHeights = deformTerrain(
              { heights: localHeights, width: worldW },
              stepResult.explosionX,
              stepResult.explosionRadius!,
              35
            ).heights;

            // Trigger Screen Shake
            shakeIntensityRef.current = 14;
            shakeTimerRef.current = 20;

            // Store terrain deformation details
            terrainDeformRef.current = {
              centerX: stepResult.explosionX,
              radius: stepResult.explosionRadius!,
              depth: 35
            };
          } else {
            // Generic impact
            if (proj.type === 'boulder') {
              sfx.playRockThud();
              spawnImpactParticles(proj.pos.x, proj.pos.y, '#7f8c8d', 10);
            } else if (stepResult.hitCharacterId) {
              sfx.playHit();
              spawnImpactParticles(proj.pos.x, proj.pos.y, '#e74c3c', 12); // Splatter
            } else {
              sfx.playRockThud();
              spawnImpactParticles(proj.pos.x, proj.pos.y, colorTheme.terrainGradient[0], 8);
            }
          }

          // Calculate and collect hits on this frame
          const frameHits: any[] = [];
          if (stepResult.explosionX) {
            // Bomber blast hits multiple nearby players
            const blastRad = stepResult.explosionRadius!;
            characterBodiesRef.current.forEach(char => {
              if (!char.alive) return;
              if (proj.shooterTeam && char.team === proj.shooterTeam) return;
              const dx = char.position.x - stepResult.explosionX!;
              const dy = (char.position.y - 25) - stepResult.explosionY!; // Middle of torso
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < blastRad) {
                // Falloff damage calculation
                const falloff = 1 - (dist / blastRad);
                const dmg = Math.round(stepResult.damage * falloff);
                if (dmg > 0) {
                  frameHits.push({ targetId: char.id, damage: dmg, limb: 'body' });
                }
              }
            });
          } else if (stepResult.hitCharacterId) {
            frameHits.push({
              targetId: stepResult.hitCharacterId,
              damage: stepResult.damage,
              limb: stepResult.hitLimb
            });
          }

          // Accumulate hits (avoid duplicates and keep maximum damage)
          frameHits.forEach(hit => {
            const existingIndex = accumulatedHitsRef.current.findIndex(h => h.targetId === hit.targetId);
            if (existingIndex === -1) {
              accumulatedHitsRef.current.push(hit);
              // Deduct HP locally instantly for immediate visual feedback
              const hitChar = characterBodiesRef.current.find(b => b.id === hit.targetId);
              if (hitChar) {
                hitChar.hp = Math.max(0, hitChar.hp - hit.damage);
              }
            } else {
              const prevDmg = accumulatedHitsRef.current[existingIndex].damage;
              if (hit.damage > prevDmg) {
                const diff = hit.damage - prevDmg;
                accumulatedHitsRef.current[existingIndex] = hit;
                // Deduct only the additional damage locally
                const hitChar = characterBodiesRef.current.find(b => b.id === hit.targetId);
                if (hitChar) {
                  hitChar.hp = Math.max(0, hitChar.hp - diff);
                }
              }
            }
          });

          // Generate floating text for players who took damage on this frame
          frameHits.forEach(hit => {
            const hitChar = characterBodiesRef.current.find(b => b.id === hit.targetId);
            const text = hit.limb === 'head' 
              ? `🎯 HEADSHOT! -${hit.damage} HP` 
              : `-${hit.damage} HP`;
            damageNumbersRef.current.push({
              pos: { x: hitChar?.position.x || proj.pos.x, y: (hitChar?.position.y || proj.pos.y) - 50 },
              text,
              color: hit.limb === 'head' ? '#ff9f43' : '#ff4d4d',
              alpha: 1,
              life: 0
            });
          });
        }

        // 7. When the projectile becomes inactive, the host coordinates the authoritative resolve action once
        if (!proj.active) {
          if (isHost && !resolveEmittedRef.current) {
            resolveEmittedRef.current = true;
            
            const fellOffMapIdsReport: string[] = [];
            // Check if anyone fell below screen/map boundary
            characterBodiesRef.current.forEach(char => {
              if (char.alive && (char.position.x < 0 || char.position.x >= worldW || char.position.y > 590)) {
                fellOffMapIdsReport.push(char.id);
              }
            });

            // Report results after a short delay so visual effects/damage numbers can show
            setTimeout(() => {
              // Collect final positions of all alive characters so knockback movement persists
              const movedPositions: { id: string; x: number; y: number }[] = [];
              characterBodiesRef.current.forEach(char => {
                if (char.alive) {
                  movedPositions.push({
                    id: char.id,
                    x: Math.round(char.position.x),
                    y: Math.round(char.position.y)
                  });
                }
              });

              onBowmastersAction('resolve-shot', {
                hits: accumulatedHitsRef.current,
                fellOffMapIds: fellOffMapIdsReport,
                terrainDeform: terrainDeformRef.current,
                movedPositions
              });
            }, 800);
          }
        }
      }

      // 7. Update & Draw Particles (Visual effects)
      particlesRef.current.forEach((p, idx) => {
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;
        p.life++;
        
        // Decay
        if (p.type === 'smoke') {
          p.radius += 0.1;
          p.alpha = 1 - (p.life / p.maxLife);
        } else {
          p.alpha = 1 - (p.life / p.maxLife);
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0; // Reset

        if (p.life >= p.maxLife) {
          particlesRef.current.splice(idx, 1);
        }
      });

      // 8. Update & Draw Floating Damage numbers
      damageNumbersRef.current.forEach((num, idx) => {
        num.pos.y -= 0.6; // float up
        num.life++;
        num.alpha = 1 - (num.life / 60);

        ctx.fillStyle = num.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        ctx.globalAlpha = Math.max(0, num.alpha);
        ctx.strokeText(num.text, num.pos.x, num.pos.y);
        ctx.fillText(num.text, num.pos.x, num.pos.y);
        ctx.globalAlpha = 1.0; // Reset

        if (num.life >= 60) {
          damageNumbersRef.current.splice(idx, 1);
        }
      });

      // 9. Draw Slingshot Trajectory Prediction Dots
      const activePlayerBody = characterBodiesRef.current.find(b => b.id === activeShooterId);
      const isMyTurn = activeShooterId === playerId && phase === 'playing';

      if (isAiming && isMyTurn && activePlayerBody && !isAimCancelled) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        const rad = aimAngle;
        const speed = aimPower * 0.12;
        const projType = activePlayerBody.characterType;
        const projRadius = projType === 'boulder' ? 10 : projType === 'bomber' ? 7 : 4;
        const spawnDist = 25 + projRadius;

        const startX = activePlayerBody.position.x + Math.cos(rad) * spawnDist;
        const startY = activePlayerBody.position.y - 40 - Math.sin(rad) * spawnDist;

        let tx = startX;
        let ty = startY;
        let tvx = Math.cos(rad) * speed;
        let tvy = -Math.sin(rad) * speed;

        // Draw dotted prediction arc (first 15 steps only)
        for (let i = 0; i < 15; i++) {
          tvy += 0.15; // Gravity
          tx += tvx;
          ty += tvy;
          
          if (tx < 0 || tx >= worldW || ty > 600) break;
          
          ctx.beginPath();
          ctx.arc(tx, ty, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore(); // Restore camera translation/zoom
      ctx.restore(); // Restore logical scale/screen shake
      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [terrain, turnIndex, turnOrder, phase, aimAngle, aimPower, isAiming, isAimCancelled, colorTheme, cameraZoom, cameraOffsetX, cameraOffsetY]);

  // Handle drag starts to aim slingshot style or pan the camera
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      e.preventDefault();
      if (dragMode === 'aim' || isAiming) {
        setIsAiming(false);
        setDragMode('none');
        setDragStart(null);
        setIsAimCancelled(false);
      }
      return;
    }

    const activeShooterId = turnOrder[turnIndex];
    const isMyTurn = activeShooterId === playerId && phase === 'playing';

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = ((e.clientX - rect.left) / rect.width) * 1200;
    const screenY = ((e.clientY - rect.top) / rect.height) * 600;

    // Unproject screen coordinates to world logical coordinates using refs
    const worldX = (screenX - 600) / cameraZoom + 600 - cameraOffsetXRef.current;
    const worldY = (screenY - 300) / cameraZoom + 300 - cameraOffsetYRef.current;

    let clickedNearPlayer = false;
    if (isMyTurn) {
      const myBody = characterBodiesRef.current.find(b => b.id === playerId);
      if (myBody) {
        const dx = worldX - myBody.position.x;
        const dy = worldY - (myBody.position.y - 25); // torso center
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          clickedNearPlayer = true;
        }
      }
    }

    if (clickedNearPlayer) {
      setDragMode('aim');
      setIsAiming(true);
      setDragStart({ x: screenX, y: screenY });
      setIsAimCancelled(true);
    } else {
      setDragMode('pan');
      isManualPanRef.current = true;
      setCameraOffsetX(cameraOffsetXRef.current);
      setCameraOffsetY(cameraOffsetYRef.current);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (dragMode === 'aim' && dragStart) {
      const screenX = ((e.clientX - rect.left) / rect.width) * 1200;
      const screenY = ((e.clientY - rect.top) / rect.height) * 600;

      // Inverted pull back (slingshot aim)
      const dx = dragStart.x - screenX;
      const dy = screenY - dragStart.y;

      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const power = Math.max(10, Math.min(100, Math.round(distance * 0.45)));

      setAimAngle(angle);
      setAimPower(power);
      setIsAimCancelled(distance < 20);
    } else if (dragMode === 'pan' && lastMousePos) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;

      const scaleX = 1200 / rect.width;
      const scaleY = 600 / rect.height;

      // Pan camera with dynamic world limits
      const worldW = terrain.length || 1200;
      const maxOffsetX = 600 * (1 - 1 / cameraZoom);
      const minOffsetX = 600 * (1 + 1 / cameraZoom) - worldW;
      const maxOffsetY = 300 * (1 - 1 / cameraZoom);
      setCameraOffsetX(prev => Math.max(minOffsetX, Math.min(maxOffsetX, prev + (dx * scaleX) / cameraZoom)));
      setCameraOffsetY(prev => Math.max(-maxOffsetY, Math.min(maxOffsetY, prev + (dy * scaleY) / cameraZoom)));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (dragMode === 'aim') {
      setIsAiming(false);
      if (!isAimCancelled) {
        let angleDeg = (aimAngle * 180) / Math.PI;
        angleDeg = (angleDeg + 360) % 360;

        onBowmastersAction('fire', {
          angle: angleDeg,
          power: aimPower
        });
      }
      setDragStart(null);
      setIsAimCancelled(false);
    }
    setDragMode('none');
    setLastMousePos(null);
  };

  // Touch handlers for mobile devices (includes pinch-to-zoom and pan/aim)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const activeShooterId = turnOrder[turnIndex];
    const isMyTurn = activeShooterId === playerId && phase === 'playing';

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const screenX = ((touch.clientX - rect.left) / rect.width) * 1200;
      const screenY = ((touch.clientY - rect.top) / rect.height) * 600;

      const worldX = (screenX - 600) / cameraZoom + 600 - cameraOffsetXRef.current;
      const worldY = (screenY - 300) / cameraZoom + 300 - cameraOffsetYRef.current;

      let clickedNearPlayer = false;
      if (isMyTurn) {
        const myBody = characterBodiesRef.current.find(b => b.id === playerId);
        if (myBody) {
          const dx = worldX - myBody.position.x;
          const dy = worldY - (myBody.position.y - 25);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            clickedNearPlayer = true;
          }
        }
      }

      if (clickedNearPlayer) {
        setDragMode('aim');
        setIsAiming(true);
        setDragStart({ x: screenX, y: screenY });
        setIsAimCancelled(true);
      } else {
        setDragMode('pan');
        isManualPanRef.current = true;
        setCameraOffsetX(cameraOffsetXRef.current);
        setCameraOffsetY(cameraOffsetYRef.current);
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
      }
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      setPinchStartDist(dist);
      setPinchStartZoom(cameraZoom);
      setDragMode('none');
      setIsAiming(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1 && dragMode !== 'none') {
      const touch = e.touches[0];
      if (dragMode === 'aim' && dragStart) {
        const screenX = ((touch.clientX - rect.left) / rect.width) * 1200;
        const screenY = ((touch.clientY - rect.top) / rect.height) * 600;

        const dx = dragStart.x - screenX;
        const dy = screenY - dragStart.y;

        const angle = Math.atan2(dy, dx);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const power = Math.max(10, Math.min(100, Math.round(distance * 0.45)));

        setAimAngle(angle);
        setAimPower(power);
        setIsAimCancelled(distance < 20);
      } else if (dragMode === 'pan' && lastMousePos) {
        const dx = touch.clientX - lastMousePos.x;
        const dy = touch.clientY - lastMousePos.y;

        const scaleX = 1200 / rect.width;
        const scaleY = 600 / rect.height;

        // Pan camera with dynamic world limits
        const worldW = terrain.length || 1200;
        const maxOffsetX = 600 * (1 - 1 / cameraZoom);
        const minOffsetX = 600 * (1 + 1 / cameraZoom) - worldW;
        const maxOffsetY = 300 * (1 - 1 / cameraZoom);
        setCameraOffsetX(prev => Math.max(minOffsetX, Math.min(maxOffsetX, prev + (dx * scaleX) / cameraZoom)));
        setCameraOffsetY(prev => Math.max(-maxOffsetY, Math.min(maxOffsetY, prev + (dy * scaleY) / cameraZoom)));
        setLastMousePos({ x: touch.clientX, y: touch.clientY });
      }
    } else if (e.touches.length === 2 && pinchStartDist !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const scale = dist / pinchStartDist;
      setCameraZoom(Math.max(1.0, Math.min(2.5, pinchStartZoom * scale)));
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
    setPinchStartDist(null);
  };

  const activeShooter = players.find(p => p.id === turnOrder[turnIndex]);
  const isMyTurn = turnOrder[turnIndex] === playerId && phase === 'playing';

  return (
    <div className="bowmasters-table-container" ref={containerRef}>
      
      {/* Background is now rendered on canvas with premium parallax city/hills layers */}

      {/* Main Canvas rendering viewport */}
      {terrain.length > 0 && (
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            zIndex: 5,
            cursor: isMyTurn ? 'crosshair' : 'default'
          }}
        />
      )}


      {/* HUD Layer */}
      {phase !== 'character_select' && (
        <div className="bowmasters-hud">
          <div className="hud-top-bar">
            {/* Wind Info */}
            <div className="hud-wind-indicator">
              <span className="wind-label">Wind</span>
              <span
                className="wind-arrow"
                style={{
                  transform: `rotate(${wind >= 0 ? 0 : 180}deg)`,
                  color: Math.abs(wind) > 2 ? '#e74c3c' : Math.abs(wind) > 1 ? '#f1c40f' : '#2ecc71'
                }}
              >
                ➡️
              </span>
              <span className="wind-value">{Math.abs(wind)}</span>
            </div>

            {/* Turn Banner */}
            {activeShooter && (
              <div className="hud-turn-banner">
                <span className="hud-turn-title">
                  {isMyTurn ? 'Your Turn' : `${activeShooter.name}'s Turn`}
                </span>
                <span className="hud-turn-name">
                  {activeShooter.name} ({activeShooter.characterType?.toUpperCase()})
                </span>
              </div>
            )}

            {/* Team Panels */}
            <div className="hud-team-panels">
              {/* Team A (Blue) */}
              <div className="team-panel team-a">
                <div className="team-panel-title">Team A</div>
                {players.filter(p => p.team === 'a').map(p => (
                  <div key={p.id} className="team-member-row" style={{ opacity: p.alive ? 1 : 0.45 }}>
                    <span className="team-member-name">{p.name}</span>
                    <span className="team-member-hp" style={{ color: p.hp < 35 ? '#e74c3c' : '#fff' }}>
                      {p.hp} HP
                    </span>
                  </div>
                ))}
              </div>

              {/* Team B (Red) */}
              <div className="team-panel team-b">
                <div className="team-panel-title">Team B</div>
                {players.filter(p => p.team === 'b').map(p => (
                  <div key={p.id} className="team-member-row" style={{ opacity: p.alive ? 1 : 0.45 }}>
                    <span className="team-member-name">{p.name}</span>
                    <span className="team-member-hp" style={{ color: p.hp < 35 ? '#e74c3c' : '#fff' }}>
                      {p.hp} HP
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Aim Power Indicator Bar */}
          {isAiming && isMyTurn && (
            <div className="hud-aim-indicator">
              <div className="aim-bar-stats">
                <div className="aim-stat-box">
                  <span className="aim-stat-lbl">Angle</span>
                  <span className="aim-stat-val">
                    {Math.round((aimAngle * 180) / Math.PI)}°
                  </span>
                </div>
                <div className="aim-stat-box">
                  <span className="aim-stat-lbl">Power</span>
                  <span className="aim-stat-val">
                    {isAimCancelled ? 'CANCELLED' : `${aimPower}%`}
                  </span>
                </div>
              </div>
              <div className="aim-power-track">
                <div className="aim-power-fill" style={{ width: isAimCancelled ? '0%' : `${aimPower}%`, backgroundColor: isAimCancelled ? '#7f8c8d' : undefined }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pre-game Character Select Screen Overlay */}
      {phase === 'character_select' && (
        <div className="char-select-overlay">
          <h2 className="char-select-title">Choose Your Character</h2>
          <p className="char-select-subtitle">Each archetype holds a balanced damage/angle modifier</p>
          
          <div className="char-cards-container">
            {Object.values(CHARACTER_PRESETS).map((preset: CharacterConfig) => {
              const myPlayer = players.find(p => p.id === playerId);
              const isSelected = myPlayer?.characterType === preset.type;

              // Change boulder's emoji locally if it's the rock
              let emoji = preset.type === 'boulder' ? '☄️' : preset.type === 'archer' ? '🏹' : preset.type === 'bomber' ? '💣' : preset.type === 'spear' ? '🗡' : '🎯';

              return (
                <div
                  key={preset.type}
                  className={`char-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onBowmastersAction('select-character', { characterType: preset.type })}
                >
                  <div className="char-card-icon-wrapper" style={{ boxShadow: `0 0 12px ${preset.color}25` }}>
                    <span className="char-card-icon">{emoji}</span>
                  </div>
                  <h3 className="char-card-name">{preset.name}</h3>
                  <span className="char-card-difficulty" style={{ borderColor: preset.color, color: preset.color }}>
                    {preset.difficulty}
                  </span>
                  <p className="char-card-desc">{preset.description}</p>
                  <button className="char-select-btn">
                    {isSelected ? 'Selected' : 'Choose'}
                  </button>
                </div>
              );
            })}
          </div>

          {players.find(p => p.id === playerId)?.characterSelected && (
            <div className="char-select-waiting">
              <span>⏳ Waiting for other players to choose...</span>
            </div>
          )}
        </div>
      )}

      {/* Game Over Screen Overlay */}
      {phase === 'game_over' && (
        <div className="game-over-overlay">
          <div className="game-over-panel">
            {/* Evaluate winner */}
            {(() => {
              const teamAAlive = players.some(p => p.team === 'a' && p.alive);
              const winningTeamName = teamAAlive ? 'Team A' : 'Team B';
              const isWinA = teamAAlive;

              return (
                <>
                  <h2 className={`game-over-title ${isWinA ? 'winner-a' : 'winner-b'}`}>
                    Victory!
                  </h2>
                  <p className="game-over-subtitle">
                    {winningTeamName} has dominated the battlefield!
                  </p>
                  
                  {isHost && (
                    <button className="restart-btn" onClick={onRestartGame}>
                      Rematch
                    </button>
                  )}
                  {!isHost && (
                    <p style={{ color: '#cbd5e1', fontStyle: 'italic' }}>
                      Waiting for host to start a rematch...
                    </p>
                  )}
                </>
              );
            })()}

            <button
              className="char-select-btn"
              onClick={onLeaveRoom}
              style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', width: 'auto', padding: '0.5rem 2rem' }}
            >
              Exit to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
