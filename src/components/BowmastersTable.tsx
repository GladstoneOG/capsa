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

  // Selected preset (visuals)
  const [colorTheme, setColorTheme] = useState({
    skyGradient: ['#7dd3fc', '#0284c7'],
    terrainGradient: ['#4ade80', '#22c55e', '#15803d'],
    sunColor: '#facc15'
  });

  // Keep track of characters bodies locally for simulation
  const characterBodiesRef = useRef<CharacterBody[]>([]);

  // Choose a color theme randomly based on roomCode
  useEffect(() => {
    const hash = roomCode.charCodeAt(0) || 0;
    const themes = [
      {
        skyGradient: ['#87CEEB', '#4682B4'], // Alpine Meadows
        terrainGradient: ['#55a630', '#2b9348', '#007f5f'],
        sunColor: '#facc15'
      },
      {
        skyGradient: ['#fda085', '#f6d365'], // Crimson Canyons
        terrainGradient: ['#e67e22', '#d35400', '#873600'],
        sunColor: '#ff7675'
      },
      {
        skyGradient: ['#3a7bd5', '#3a6073'], // Nordic Tundra
        terrainGradient: ['#f4f6f7', '#bdc3c7', '#7f8c8d'],
        sunColor: '#ecf0f1'
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
    const maxOffsetX = 600 * (1 - 1 / cameraZoom);
    const maxOffsetY = 300 * (1 - 1 / cameraZoom);

    setCameraOffsetX(prev => Math.max(-maxOffsetX, Math.min(maxOffsetX, prev)));
    setCameraOffsetY(prev => Math.max(-maxOffsetY, Math.min(maxOffsetY, prev)));
  }, [cameraZoom]);

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
      return {
        id: p.id,
        position: { x: p.positionX || 200, y: p.positionY || terrain[Math.floor(p.positionX || 200)] },
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
          spin: 0
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

      // 2. Draw Sky Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, logicalH);
      skyGrad.addColorStop(0, colorTheme.skyGradient[0]);
      skyGrad.addColorStop(1, colorTheme.skyGradient[1]);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Draw Sun
      ctx.fillStyle = colorTheme.sunColor;
      ctx.beginPath();
      ctx.arc(600, 120, 35, 0, Math.PI * 2);
      ctx.fill();

      // Apply camera zoom & offset for the game world elements
      ctx.save();
      ctx.translate(logicalW / 2, logicalH / 2);
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-logicalW / 2 + cameraOffsetX, -logicalH / 2 + cameraOffsetY);

      // 3. Draw Terrain Heights
      if (terrain.length > 0) {
        // Sync local heights with props unless deformed
        if (localHeights.length !== terrain.length) {
          localHeights = [...terrain];
        }

        ctx.fillStyle = colorTheme.terrainGradient[1]; // Earth
        ctx.beginPath();
        ctx.moveTo(0, logicalH);
        for (let x = 0; x < logicalW; x++) {
          ctx.lineTo(x, localHeights[x]);
        }
        ctx.lineTo(logicalW, logicalH);
        ctx.closePath();
        ctx.fill();

        // Draw Grass top border
        ctx.strokeStyle = colorTheme.terrainGradient[0];
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, localHeights[0]);
        for (let x = 1; x < logicalW; x++) {
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
        for (let x = 0; x < logicalW; x++) {
          ctx.lineTo(x, localHeights[x]);
        }
        ctx.lineTo(logicalW, logicalH);
        ctx.closePath();
        ctx.fill();
      }

      // 4. Draw Characters (Rigged Puppet Renderer)
      characterBodiesRef.current.forEach(char => {
        resolveCharacterPhysics(char, { heights: localHeights, width: logicalW });

        if (!char.alive && char.position.y > logicalH + 100) {
          // Off screen dead players, skip
          return;
        }

        ctx.save();
        ctx.translate(char.position.x, char.position.y);

        // Flip character sprite horizontally if they are on the right side of the screen
        const shouldFlip = char.position.x > 600;
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

        // Simple rigged puppet parts (Offsets relative to base/feet at 0,0)
        // Draw Legs
        ctx.strokeStyle = '#2c3e50';
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
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw Head
        const breathSway = char.alive ? Math.sin(Date.now() * 0.003) * 0.8 : 0;
        const hy = -47 + breathSway;
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, hy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5;
        ctx.stroke();

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
        const isActiveShooter = turnOrder[turnIndex] === char.id && phase === 'playing';
        
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
          const isActiveShooter = turnOrder[turnIndex] === char.id && phase === 'playing';
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
      const proj = activeProjRef.current;
      if (proj && proj.active) {
        // Run physics steps in visual simulation
        const isBoulderRolling = proj.type === 'boulder' && proj.rollTimer > 0;
        
        let stepResult;
        if (isBoulderRolling) {
          stepResult = rollBoulderStep(proj, { heights: localHeights, width: logicalW }, characterBodiesRef.current, 1);
        } else {
          stepResult = simulateProjectileStep(proj, { heights: localHeights, width: logicalW }, characterBodiesRef.current, wind);
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
              { heights: localHeights, width: logicalW },
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
              if (char.alive && (char.position.x < 0 || char.position.x >= logicalW || char.position.y > 590)) {
                fellOffMapIdsReport.push(char.id);
              }
            });

            // Report results after a short delay so visual effects/damage numbers can show
            setTimeout(() => {
              onBowmastersAction('resolve-shot', {
                hits: accumulatedHitsRef.current,
                fellOffMapIds: fellOffMapIdsReport,
                terrainDeform: terrainDeformRef.current
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
      const activeShooterId = turnOrder[turnIndex];
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
          
          if (tx < 0 || tx >= logicalW || ty > 600) break;
          
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

    // Unproject screen coordinates to world logical coordinates
    const worldX = (screenX - 600) / cameraZoom + 600 - cameraOffsetX;
    const worldY = (screenY - 300) / cameraZoom + 300 - cameraOffsetY;

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

      // Pan camera with limits
      const maxOffsetX = 600 * (1 - 1 / cameraZoom);
      const maxOffsetY = 300 * (1 - 1 / cameraZoom);
      setCameraOffsetX(prev => Math.max(-maxOffsetX, Math.min(maxOffsetX, prev + (dx * scaleX) / cameraZoom)));
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

      const worldX = (screenX - 600) / cameraZoom + 600 - cameraOffsetX;
      const worldY = (screenY - 300) / cameraZoom + 300 - cameraOffsetY;

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

        const maxOffsetX = 600 * (1 - 1 / cameraZoom);
        const maxOffsetY = 300 * (1 - 1 / cameraZoom);
        setCameraOffsetX(prev => Math.max(-maxOffsetX, Math.min(maxOffsetX, prev + (dx * scaleX) / cameraZoom)));
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
      
      {/* 2D Scrolling Parallax background decoration from Monopoly */}
      <div className="bowmasters-sky-wrapper">
        <div className="scrolling-clouds-ribbon">
          <div className="clouds-panel">
            <span style={{ top: '35%', left: '10%', position: 'absolute', fontSize: '3rem', opacity: 0.6 }}>☁️</span>
            <span style={{ top: '15%', left: '40%', position: 'absolute', fontSize: '2.5rem', opacity: 0.5 }}>☁️</span>
            <span style={{ top: '45%', left: '70%', position: 'absolute', fontSize: '3.2rem', opacity: 0.7 }}>☁️</span>
          </div>
          <div className="clouds-panel">
            <span style={{ top: '35%', left: '10%', position: 'absolute', fontSize: '3rem', opacity: 0.6 }}>☁️</span>
            <span style={{ top: '15%', left: '40%', position: 'absolute', fontSize: '2.5rem', opacity: 0.5 }}>☁️</span>
            <span style={{ top: '45%', left: '70%', position: 'absolute', fontSize: '3.2rem', opacity: 0.7 }}>☁️</span>
          </div>
        </div>

        <div className="scrolling-hills-ribbon">
          <div className="hills-panel">
            {/* Background rolling green hill SVG */}
            <svg style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0 }} viewBox="0 0 1000 120" preserveAspectRatio="none">
              <path d="M0 120 Q 250 50, 500 80 T 1000 70 L 1000 120 Z" fill={colorTheme.terrainGradient[2]} opacity="0.3" />
            </svg>
          </div>
          <div className="hills-panel">
            <svg style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0 }} viewBox="0 0 1000 120" preserveAspectRatio="none">
              <path d="M0 120 Q 250 50, 500 80 T 1000 70 L 1000 120 Z" fill={colorTheme.terrainGradient[2]} opacity="0.3" />
            </svg>
          </div>
        </div>

        <div className="scrolling-trees-ribbon">
          <div className="trees-panel">
            <span className="sway-tree t1" style={{ bottom: '10px', left: '15%', position: 'absolute' }}>🌳</span>
            <span className="sway-tree t2" style={{ bottom: '5px', left: '50%', position: 'absolute' }}>🌲</span>
            <span className="sway-tree t3" style={{ bottom: '8px', left: '80%', position: 'absolute' }}>🌳</span>
          </div>
          <div className="trees-panel">
            <span className="sway-tree t1" style={{ bottom: '10px', left: '15%', position: 'absolute' }}>🌳</span>
            <span className="sway-tree t2" style={{ bottom: '5px', left: '50%', position: 'absolute' }}>🌲</span>
            <span className="sway-tree t3" style={{ bottom: '8px', left: '80%', position: 'absolute' }}>🌳</span>
          </div>
        </div>
      </div>

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
