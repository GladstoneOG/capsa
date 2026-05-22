import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle' | 'triangle';
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
}

const COLORS = [
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald/green
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f43f5e', // rose
];

export const Confetti: React.FC<ConfettiProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const createParticle = (x: number, y: number, angleDeg: number): Particle => {
      const angleRad = (angleDeg + (Math.random() * 40 - 20)) * (Math.PI / 180);
      const speed = Math.random() * 12 + 10;
      return {
        x,
        y,
        size: Math.random() * 8 + 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: ['rect', 'circle', 'triangle'][Math.floor(Math.random() * 3)] as any,
        vx: Math.cos(angleRad) * speed,
        vy: Math.sin(angleRad) * speed,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        opacity: 1,
      };
    };

    // Initial burst from bottom corners
    const spawnInitialBurst = () => {
      const count = 120;
      const w = canvas.width;
      const h = canvas.height;

      // Bottom left cannon (launching up-right)
      for (let i = 0; i < count / 2; i++) {
        particles.push(createParticle(0, h, -45));
      }

      // Bottom right cannon (launching up-left)
      for (let i = 0; i < count / 2; i++) {
        particles.push(createParticle(w, h, -135));
      }
    };

    // Falling shower from the top
    const spawnInterval = setInterval(() => {
      if (particles.length < 180) {
        const w = canvas.width;
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: Math.random() * w,
            y: -10,
            size: Math.random() * 8 + 5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            shape: ['rect', 'circle', 'triangle'][Math.floor(Math.random() * 3)] as any,
            vx: Math.random() * 4 - 2,
            vy: Math.random() * 3 + 2, // falling
            rotation: Math.random() * 360,
            rotationSpeed: Math.random() * 6 - 3,
            opacity: 1,
          });
        }
      }
    }, 100);

    spawnInitialBurst();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Physics logic
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.vx *= 0.98; // friction
        p.vy *= 0.98;
        p.rotation += p.rotationSpeed;

        // horizontal sway
        p.x += Math.sin(p.y / 30) * 0.5;

        // fade out near bottom
        if (p.y > canvas.height * 0.7) {
          p.opacity -= 0.015;
        }

        if (p.opacity <= 0) return;

        // Render particle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        } else if (p.shape === 'circle') {
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'triangle') {
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      });

      // Filter dead/off-screen particles
      particles = particles.filter(
        (p) =>
          p.opacity > 0 &&
          p.y < canvas.height + 20 &&
          p.x > -20 &&
          p.x < canvas.width + 20
      );

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(spawnInterval);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

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
        zIndex: 99999,
      }}
    />
  );
};
