import React, { useEffect, useRef } from 'react';

interface DottedWavesAnimationProps {
  className?: string;
  dotColor?: string;
}

export const DottedWavesAnimation: React.FC<DottedWavesAnimationProps> = ({ 
  className = "w-full h-64 md:h-80",
  dotColor = "99, 102, 241" // Indigo-500 RGB
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const cols = 45;
    const rows = 28;
    const spacing = 18;

    const resizeCanvas = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      time += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + 20;
      const fov = 300;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x3d = (c - cols / 2) * spacing;
          const z3d = (r - rows / 2) * spacing;
          
          // Double sine wave equation for smooth dotted wave motion
          const wave1 = Math.sin(c * 0.2 + time) * 22;
          const wave2 = Math.cos(r * 0.25 + time * 0.7) * 18;
          const wave3 = Math.sin((c + r) * 0.15 + time * 1.2) * 10;
          const y3d = wave1 + wave2 + wave3;

          // Perspective transformation
          const zDistance = z3d + 350;
          if (zDistance <= 0) continue;

          const scale = fov / zDistance;
          const screenX = centerX + x3d * scale;
          const screenY = centerY + (y3d + 60) * scale;

          // Render dot if within canvas boundaries
          if (screenX >= 0 && screenX <= canvas.width && screenY >= 0 && screenY <= canvas.height) {
            const dotRadius = Math.max(0.8, 2.8 * scale);
            const alpha = Math.min(1, Math.max(0.15, (scale - 0.4) * 1.4));

            ctx.beginPath();
            ctx.arc(screenX, screenY, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${dotColor}, ${alpha})`;
            ctx.fill();

            // Highlight crests with glowing halos
            if (y3d > 18) {
              ctx.beginPath();
              ctx.arc(screenX, screenY, dotRadius * 1.8, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(${dotColor}, ${alpha * 0.3})`;
              ctx.fill();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [dotColor]);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-950/90 border border-indigo-500/20 shadow-2xl ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
    </div>
  );
};
