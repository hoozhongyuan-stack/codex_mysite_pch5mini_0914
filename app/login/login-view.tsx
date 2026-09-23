'use client';
import { useEffect, useRef } from 'react';
import { Sparkles, ArrowUpRight, ShieldCheck } from 'lucide-react';
export default function LoginView() {
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
  return (
    <main className="particle-login">
      <canvas ref={ref} aria-hidden="true" />
      <div className="login-intro">
        <div className="brand">
          <span className="brand-icon">
            <Sparkles />
          </span>
          爱神 AiTion
        </div>
        <p className="eyebrow">CONTENT × COMMERCE</p>
        <h1>
          让思想生长，
          <br />
          让内容被发现。
        </h1>
        <p>你的品牌内容，从这里连接更广阔的世界。</p>
      </div>
      <section className="login-panel">
        <span className="pill">中文管理后台</span>
        <h2>欢迎回来</h2>
        <p>使用已获授权的账号，进入内容工作空间。</p>
        <a
          href="/signin-with-chatgpt?return_to=%2F"
          target="_top"
          className="btn primary"
        >
          使用 ChatGPT 管理员账号登录 <ArrowUpRight size={17} />
        </a>
        <a className="btn" href="/">
          已登录？进入后台
        </a>
        <div className="login-hint">
          <ShieldCheck size={18} />
          仅站点管理员及已授权子账号可访问。
        </div>
        <a className="muted" href="/zh">
          浏览前台网站 ↗
        </a>
        <div className="login-policies">
          <a href="/zh/policies/terms">注册协议</a>
          <a href="/zh/policies/privacy">隐私协议</a>
          <a href="/zh/policies/cookies">Cookie 政策</a>
        </div>
      </section>
    </main>
  );
}
