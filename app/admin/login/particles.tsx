'use client';
import { useRef, useEffect } from 'react';
export default function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0,
      height = 0,
      frame = 0,
      last = 0;
    const points = Array.from({ length: 65 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00014,
      vy: (Math.random() - 0.5) * 0.00014,
    }));
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    function draw(t: number) {
      if (!ctx || !canvas) return;
      if (t - last > 32 && !document.hidden) {
        last = t;
        ctx.clearRect(0, 0, width, height);
        points.forEach((p, i) => {
          if (!reduced) {
            p.x = (p.x + p.vx + 1) % 1;
            p.y = (p.y + p.vy + 1) % 1;
          }
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = '#b5a1fa';
          ctx.fill();
          for (const q of points.slice(i + 1)) {
            const d = Math.hypot((p.x - q.x) * width, (p.y - q.y) * height);
            if (d < 130) {
              ctx.beginPath();
              ctx.moveTo(p.x * width, p.y * height);
              ctx.lineTo(q.x * width, q.y * height);
              ctx.strokeStyle = `rgba(157,128,231,${(1 - d / 130) * 0.25})`;
              ctx.stroke();
            }
          }
        });
      }
      if (!reduced) frame = requestAnimationFrame(draw);
    }
    draw(100);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas className="staff-particles" ref={ref} aria-hidden="true" />;
}
