import React, { useEffect, useRef } from 'react';

interface FallingBackgroundProps {
  gameType: 'capsa' | 'uno' | 'monopoly' | 'snakes_ladders' | 'bowmasters';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rotationSpeed: number;
  scale: number;
  type: 'playing-card' | 'uno-card' | 'die' | 'bill' | 'snake' | 'ladder' | 'arrow' | 'spear' | 'bomb';
  faceUp: boolean;
  suit?: 'H' | 'D' | 'C' | 'S';
  rank?: string;
  unoColor?: string;
  unoVal?: string;
  dieVal?: number;
  dieColor?: string;
  billVal?: number;
  swaySpeed: number;
  swayOffset: number;
}

export const FallingBackground: React.FC<FallingBackgroundProps> = ({ gameType }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Particle[] = [];
    const particleCount = 35;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Rounded rectangle helper
    const drawRoundedRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
      c.beginPath();
      c.moveTo(x + radius, y);
      c.lineTo(x + width - radius, y);
      c.quadraticCurveTo(x + width, y, x + width, y + radius);
      c.lineTo(x + width, y + height - radius);
      c.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      c.lineTo(x + radius, y + height);
      c.quadraticCurveTo(x, y + height, x, y + height - radius);
      c.lineTo(x, y + radius);
      c.quadraticCurveTo(x, y, x + radius, y);
      c.closePath();
    };

    // Helper to generate a particle based on gameType
    const createParticle = (yPos: number): Particle => {
      const x = Math.random() * window.innerWidth;
      const y = yPos;
      const scale = Math.random() * 0.35 + 0.65; // size scale from 0.65 to 1.0
      const vy = Math.random() * 1.2 + 0.8; // speed of descent
      const vx = Math.random() * 0.4 - 0.2;
      const angle = Math.random() * Math.PI * 2;
      const rotationSpeed = Math.random() * 0.015 - 0.0075;
      const swaySpeed = Math.random() * 0.01 + 0.005;
      const swayOffset = Math.random() * Math.PI * 2;

      let type: Particle['type'] = 'playing-card';
      let faceUp = Math.random() > 0.4;
      let suit: Particle['suit'];
      let rank: Particle['rank'];
      let unoColor: Particle['unoColor'];
      let unoVal: Particle['unoVal'];
      let dieVal: Particle['dieVal'];
      let dieColor: Particle['dieColor'];
      let billVal: Particle['billVal'];

      if (gameType === 'bowmasters') {
        const randVal = Math.random();
        if (randVal < 0.4) {
          type = 'arrow';
        } else if (randVal < 0.7) {
          type = 'spear';
        } else {
          type = 'bomb';
        }
      } else if (gameType === 'capsa') {
        type = 'playing-card';
        suit = ['H', 'D', 'C', 'S'][Math.floor(Math.random() * 4)] as any;
        rank = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][
          Math.floor(Math.random() * 13)
        ];
      } else if (gameType === 'uno') {
        type = 'uno-card';
        unoColor = ['#ef4444', '#eab308', '#22c55e', '#3b82f6'][Math.floor(Math.random() * 4)];
        unoVal = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '⇄', '⊘', '+2'][
          Math.floor(Math.random() * 13)
        ];
      } else if (gameType === 'monopoly') {
        const isDie = Math.random() > 0.6;
        type = isDie ? 'die' : 'bill';
        if (isDie) {
          dieVal = Math.floor(Math.random() * 6) + 1;
          dieColor = Math.random() > 0.5 ? '#ffffff' : '#ef4444';
        } else {
          const vals = [10, 20, 50, 100, 500];
          billVal = vals[Math.floor(Math.random() * vals.length)];
        }
      } else {
        // snakes_ladders
        const rand = Math.random();
        if (rand < 0.4) {
          type = 'die';
          dieVal = Math.floor(Math.random() * 6) + 1;
          dieColor = ['#B7E4C7', '#FFE8D6', '#D8F3DC', '#F0E6EF'][Math.floor(Math.random() * 4)];
        } else if (rand < 0.7) {
          type = 'snake';
        } else {
          type = 'ladder';
        }
      }

      return {
        x,
        y,
        vx,
        vy,
        angle,
        rotationSpeed,
        scale,
        type,
        faceUp,
        suit,
        rank,
        unoColor,
        unoVal,
        dieVal,
        dieColor,
        billVal,
        swaySpeed,
        swayOffset,
      };
    };

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      // Stagger initial Y coordinates so they don't all fall in a line
      const initialY = Math.random() * (window.innerHeight + 160) - 80;
      particles.push(createParticle(initialY));
    }

    // DRAW FUNCTIONS
    const drawPlayingCard = (p: Particle) => {
      const w = 40 * p.scale;
      const h = 56 * p.scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Card shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      if (!p.faceUp) {
        // Back
        drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 5 * p.scale);
        ctx.fillStyle = '#b91c1c'; // rich red card back
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Inner border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * p.scale;
        drawRoundedRect(
          ctx,
          -w / 2 + 2.5 * p.scale,
          -h / 2 + 2.5 * p.scale,
          w - 5 * p.scale,
          h - 5 * p.scale,
          3.5 * p.scale
        );
        ctx.stroke();

        // Pattern in center
        ctx.save();
        drawRoundedRect(
          ctx,
          -w / 2 + 3.5 * p.scale,
          -h / 2 + 3.5 * p.scale,
          w - 7 * p.scale,
          h - 7 * p.scale,
          2.5 * p.scale
        );
        ctx.clip();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 0.8 * p.scale;
        const step = 5 * p.scale;
        for (let offset = -h; offset < w + h; offset += step) {
          ctx.beginPath();
          ctx.moveTo(-w / 2 + offset, -h / 2);
          ctx.lineTo(-w / 2 + offset - h, h / 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-w / 2 + offset, -h / 2);
          ctx.lineTo(-w / 2 + offset + h, h / 2);
          ctx.stroke();
        }

        // Central white accent oval
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 9 * p.scale, 5.5 * p.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#b91c1c';
        ctx.font = `bold ${7 * p.scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♠', 0, 0);
        ctx.restore();
      } else {
        // Face
        drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 5 * p.scale);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.shadowColor = 'transparent';

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.8 * p.scale;
        drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 5 * p.scale);
        ctx.stroke();

        const isRed = p.suit === 'H' || p.suit === 'D';
        const suitSymbol =
          p.suit === 'H' ? '♥' : p.suit === 'D' ? '♦' : p.suit === 'C' ? '♣' : '♠';
        const color = isRed ? '#ef4444' : '#1e293b';

        // Center symbol
        ctx.fillStyle = color;
        ctx.font = `${18 * p.scale}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(suitSymbol, 0, 0);

        // Corner text
        ctx.font = `bold ${7.5 * p.scale}px sans-serif`;

        // Top-left
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(p.rank || '', -w / 2 + 3.5 * p.scale, -h / 2 + 4 * p.scale);

        // Bottom-right
        ctx.save();
        ctx.rotate(Math.PI);
        ctx.fillText(p.rank || '', -w / 2 + 3.5 * p.scale, -h / 2 + 4 * p.scale);
        ctx.restore();
      }

      ctx.restore();
    };

    const drawUnoCard = (p: Particle) => {
      const w = 38 * p.scale;
      const h = 57 * p.scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Card shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;

      if (!p.faceUp) {
        // Back
        drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 5.5 * p.scale);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Inner white border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * p.scale;
        drawRoundedRect(
          ctx,
          -w / 2 + 2.5 * p.scale,
          -h / 2 + 2.5 * p.scale,
          w - 5 * p.scale,
          h - 5 * p.scale,
          3.5 * p.scale
        );
        ctx.stroke();

        // Red center oval
        ctx.save();
        ctx.rotate(-Math.PI / 8);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13 * p.scale, 7.5 * p.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // UNO Logo text
        ctx.font = `italic bold ${9.5 * p.scale}px "Outfit", sans-serif`;
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8 * p.scale;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('UNO', 0, 0);
        ctx.fillText('UNO', 0, 0);
        ctx.restore();
      } else {
        // Face
        const cardBg = p.unoColor || '#ef4444';
        drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 5.5 * p.scale);
        ctx.fillStyle = cardBg;
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Inner white border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2 * p.scale;
        drawRoundedRect(
          ctx,
          -w / 2 + 2.5 * p.scale,
          -h / 2 + 2.5 * p.scale,
          w - 5 * p.scale,
          h - 5 * p.scale,
          3.5 * p.scale
        );
        ctx.stroke();

        // White oval center
        ctx.save();
        ctx.rotate(-Math.PI / 8);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 13 * p.scale, 8 * p.scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Center card value in matching color
        ctx.fillStyle = cardBg;
        ctx.font = `bold ${14 * p.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.unoVal || '', 0, 0);

        // Corner values in white
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${6.5 * p.scale}px sans-serif`;

        // Top-left
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(p.unoVal || '', -w / 2 + 4.5 * p.scale, -h / 2 + 4.5 * p.scale);

        // Bottom-right
        ctx.save();
        ctx.rotate(Math.PI);
        ctx.fillText(p.unoVal || '', -w / 2 + 4.5 * p.scale, -h / 2 + 4.5 * p.scale);
        ctx.restore();
      }

      ctx.restore();
    };

    const drawDie = (p: Particle) => {
      const size = 24 * p.scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2.5;

      const bg = p.dieColor || '#ffffff';
      drawRoundedRect(ctx, -size / 2, -size / 2, size, size, 3.5 * p.scale);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = bg === '#ffffff' ? '#cbd5e1' : '#991b1b';
      ctx.lineWidth = 0.8 * p.scale;
      drawRoundedRect(ctx, -size / 2, -size / 2, size, size, 3.5 * p.scale);
      ctx.stroke();

      // Pips
      const val = p.dieVal || 1;
      const dotColor = bg === '#ffffff' ? '#0f172a' : '#ffffff';
      ctx.fillStyle = dotColor;

      const r = 1.8 * p.scale;
      const dist = 5.5 * p.scale;

      const drawDot = (dx: number, dy: number) => {
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
      };

      if (val === 1) {
        drawDot(0, 0);
      } else if (val === 2) {
        drawDot(-dist, -dist);
        drawDot(dist, dist);
      } else if (val === 3) {
        drawDot(-dist, -dist);
        drawDot(0, 0);
        drawDot(dist, dist);
      } else if (val === 4) {
        drawDot(-dist, -dist);
        drawDot(dist, -dist);
        drawDot(-dist, dist);
        drawDot(dist, dist);
      } else if (val === 5) {
        drawDot(-dist, -dist);
        drawDot(dist, -dist);
        drawDot(0, 0);
        drawDot(-dist, dist);
        drawDot(dist, dist);
      } else if (val === 6) {
        drawDot(-dist, -dist);
        drawDot(dist, -dist);
        drawDot(-dist, 0);
        drawDot(dist, 0);
        drawDot(-dist, dist);
        drawDot(dist, dist);
      }

      ctx.restore();
    };

    const drawBill = (p: Particle) => {
      const w = 50 * p.scale;
      const h = 27 * p.scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2.5;

      let billBg = '#a7f3d0'; // green $100
      let darkColor = '#065f46';
      let lightColor = '#ecfdf5';

      if (p.billVal === 500) {
        billBg = '#fed7aa'; // orange
        darkColor = '#9a3412';
        lightColor = '#fff7ed';
      } else if (p.billVal === 50) {
        billBg = '#fbcfe8'; // pink
        darkColor = '#9d174d';
        lightColor = '#fdf2f8';
      } else if (p.billVal === 20) {
        billBg = '#bfdbfe'; // blue
        darkColor = '#1e40af';
        lightColor = '#eff6ff';
      } else if (p.billVal === 10) {
        billBg = '#fef08a'; // yellow
        darkColor = '#854d0e';
        lightColor = '#fefce8';
      }

      // Bill base
      ctx.fillStyle = billBg;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.shadowColor = 'transparent';

      // Outer border
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 0.8 * p.scale;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      // Inner thin frame
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 0.4 * p.scale;
      ctx.strokeRect(
        -w / 2 + 1.8 * p.scale,
        -h / 2 + 1.8 * p.scale,
        w - 3.6 * p.scale,
        h - 3.6 * p.scale
      );

      // Center ellipse
      ctx.fillStyle = lightColor;
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = 0.6 * p.scale;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9 * p.scale, 6 * p.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // M value
      ctx.fillStyle = darkColor;
      ctx.font = `bold ${5 * p.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 0, 0);

      // Corners
      ctx.font = `bold ${3.5 * p.scale}px sans-serif`;
      const inset = 3.5 * p.scale;

      ctx.fillText(String(p.billVal), -w / 2 + inset, -h / 2 + inset);
      ctx.fillText(String(p.billVal), w / 2 - inset, -h / 2 + inset);
      ctx.fillText(String(p.billVal), -w / 2 + inset, h / 2 - inset);
      ctx.fillText(String(p.billVal), w / 2 - inset, h / 2 - inset);

      ctx.restore();
    };

    const drawSnake = (p: Particle) => {
      const length = 40 * p.scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Cute snake color - pastel coral/pink or light green
      ctx.strokeStyle = '#F8AD9D';
      ctx.lineWidth = 4 * p.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw wavy body
      ctx.beginPath();
      ctx.moveTo(-length / 2, 0);
      for (let i = -length / 2; i <= length / 2; i += 2) {
        const wave = Math.sin((i / length) * Math.PI * 4) * 6 * p.scale;
        ctx.lineTo(i, wave);
      }
      ctx.stroke();

      // Draw head at the end
      const headX = length / 2;
      const headY = Math.sin((headX / length) * Math.PI * 4) * 6 * p.scale;
      ctx.fillStyle = '#F8AD9D';
      ctx.beginPath();
      ctx.arc(headX, headY, 5 * p.scale, 0, Math.PI * 2);
      ctx.fill();

      // Cute eye
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(headX + 1 * p.scale, headY - 1 * p.scale, 1 * p.scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawLadder = (p: Particle) => {
      const w = 16 * p.scale;
      const h = 45 * p.scale;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Wood-like pastel color
      ctx.strokeStyle = '#DDB892';
      ctx.lineWidth = 3 * p.scale;
      ctx.lineCap = 'round';

      // Left rail
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.stroke();

      // Right rail
      ctx.beginPath();
      ctx.moveTo(w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.stroke();

      // Rungs
      const rungCount = 4;
      ctx.lineWidth = 2 * p.scale;
      for (let i = 0; i < rungCount; i++) {
        const ry = -h / 2 + (h / (rungCount - 1)) * i;
        ctx.beginPath();
        ctx.moveTo(-w / 2, ry);
        ctx.lineTo(w / 2, ry);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawArrow = (p: Particle) => {
      const len = 25 * p.scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5 * p.scale;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(-len / 2 - 4 * p.scale, -3 * p.scale);
      ctx.lineTo(-len / 2 - 1 * p.scale, 0);
      ctx.lineTo(-len / 2 - 4 * p.scale, 3 * p.scale);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len / 2 - 5 * p.scale, -3 * p.scale);
      ctx.lineTo(len / 2 - 2 * p.scale, 0);
      ctx.lineTo(len / 2 - 5 * p.scale, 3 * p.scale);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const drawSpear = (p: Particle) => {
      const len = 35 * p.scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2 * p.scale;
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len / 2 - 8 * p.scale, -3.5 * p.scale);
      ctx.lineTo(len / 2 - 8 * p.scale, 3.5 * p.scale);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const drawBomb = (p: Particle) => {
      const r = 7 * p.scale;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.fillRect(-2 * p.scale, -r - 1.5 * p.scale, 4 * p.scale, 2 * p.scale);

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1 * p.scale;
      ctx.beginPath();
      ctx.moveTo(0, -r - 1.5 * p.scale);
      ctx.quadraticCurveTo(3 * p.scale, -r - 4 * p.scale, 1.5 * p.scale, -r - 7 * p.scale);
      ctx.stroke();

      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(1.5 * p.scale, -r - 7 * p.scale, 1.5 * p.scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    // ANIMATION LOOP
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Physics update
        p.y += p.vy;
        p.angle += p.rotationSpeed;
        p.x += Math.sin(p.y * p.swaySpeed + p.swayOffset) * 0.35;

        // Reset if off-screen
        if (p.y > canvas.height + 80) {
          const reset = createParticle(-80);
          Object.assign(p, reset);
        }

        // Draw
        if (p.type === 'playing-card') {
          drawPlayingCard(p);
        } else if (p.type === 'uno-card') {
          drawUnoCard(p);
        } else if (p.type === 'die') {
          drawDie(p);
        } else if (p.type === 'bill') {
          drawBill(p);
        } else if (p.type === 'snake') {
          drawSnake(p);
        } else if (p.type === 'ladder') {
          drawLadder(p);
        } else if (p.type === 'arrow') {
          drawArrow(p);
        } else if (p.type === 'spear') {
          drawSpear(p);
        } else if (p.type === 'bomb') {
          drawBomb(p);
        }
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameType]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
