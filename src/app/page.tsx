'use client';

import { useEffect } from 'react';

const css = `
  .lp *, .lp *::before, .lp *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .lp {
    --bg: #0A0D12;
    --white: #FFFFFF;
    --secondary: #4A5568;
    --accent: #0066FF;
    --border: rgba(255, 255, 255, 0.08);
    --card-bg: #0E1219;

    background-color: var(--bg);
    color: var(--white);
    font-family: 'DM Sans', sans-serif;
    font-weight: 300;
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    scroll-behavior: smooth;
  }

  /* ─── NAV ─────────────────────────────────────────── */
  .lp nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 48px;
    background: rgba(10, 13, 18, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }

  .lp .nav-wordmark {
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.18em;
    color: var(--white);
    text-decoration: none;
  }

  .lp .nav-contact {
    font-size: 13px;
    font-weight: 300;
    letter-spacing: 0.08em;
    color: var(--secondary);
    text-decoration: none;
    transition: color 0.2s;
  }

  .lp .nav-contact:hover { color: var(--white); }

  /* ─── HERO ─────────────────────────────────────────── */
  .lp #hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    padding: 0 48px;
    overflow: hidden;
  }

  .lp .grid-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  .lp .hero-content {
    position: relative;
    z-index: 1;
    max-width: 760px;
  }

  .lp .hero-eyebrow {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.2em;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 32px;
  }

  .lp .hero-headline {
    font-size: clamp(36px, 5.5vw, 64px);
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--white);
    margin-bottom: 28px;
  }

  .lp .hero-sub {
    font-size: clamp(15px, 1.6vw, 18px);
    font-weight: 300;
    color: var(--secondary);
    line-height: 1.7;
    max-width: 520px;
  }

  /* ─── SECTION SHARED ───────────────────────────────── */
  .lp section {
    padding: 120px 48px;
    border-top: 1px solid var(--border);
  }

  .lp .section-label {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.2em;
    color: var(--secondary);
    text-transform: uppercase;
    margin-bottom: 64px;
  }

  /* ─── COVERAGE ──────────────────────────────────────── */
  .lp #coverage .coverage-grid {
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: 0;
    max-width: 900px;
  }

  .lp .coverage-divider { background: var(--border); }

  .lp .coverage-col { padding-right: 64px; }
  .lp .coverage-col:last-child { padding-right: 0; padding-left: 64px; }

  .lp .coverage-form {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.16em;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 16px;
  }

  .lp .coverage-title {
    font-size: 22px;
    font-weight: 500;
    color: var(--white);
    margin-bottom: 16px;
    letter-spacing: -0.01em;
  }

  .lp .coverage-desc {
    font-size: 15px;
    color: var(--secondary);
    line-height: 1.75;
  }

  .lp .coverage-footer {
    margin-top: 72px;
    padding-top: 32px;
    border-top: 1px solid var(--border);
    max-width: 900px;
  }

  .lp .coverage-footer p { font-size: 14px; color: var(--secondary); line-height: 1.75; }
  .lp .coverage-footer strong { color: var(--white); font-weight: 400; }

  /* ─── INTELLIGENCE ──────────────────────────────────── */
  .lp #intelligence .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    max-width: 1100px;
  }

  .lp .stat-card { background: var(--card-bg); padding: 40px 36px; }

  .lp .stat-number {
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 500;
    color: var(--white);
    letter-spacing: -0.03em;
    line-height: 1;
    margin-bottom: 14px;
  }

  .lp .stat-label { font-size: 13px; font-weight: 300; color: var(--secondary); line-height: 1.5; }

  /* ─── CONTACT ──────────────────────────────────────── */
  .lp #contact { padding: 120px 48px; border-top: 1px solid var(--border); }

  .lp .contact-inner { max-width: 480px; }

  .lp .contact-preamble { font-size: 15px; color: var(--secondary); margin-bottom: 48px; line-height: 1.75; }
  .lp .contact-name { font-size: 18px; font-weight: 500; color: var(--white); margin-bottom: 6px; letter-spacing: -0.01em; }
  .lp .contact-title { font-size: 13px; color: var(--secondary); margin-bottom: 28px; letter-spacing: 0.04em; }

  .lp .contact-links { display: flex; flex-direction: column; gap: 10px; }

  .lp .contact-link {
    font-size: 15px;
    font-weight: 300;
    color: var(--white);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    transition: color 0.2s;
  }

  .lp .contact-link::before {
    content: '';
    display: block;
    width: 20px;
    height: 1px;
    background: var(--accent);
    flex-shrink: 0;
  }

  .lp .contact-link:hover { color: var(--accent); }

  /* ─── FOOTER ───────────────────────────────────────── */
  .lp footer {
    padding: 32px 48px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .lp .footer-wordmark { font-size: 13px; font-weight: 500; letter-spacing: 0.18em; color: var(--secondary); }
  .lp .footer-note { font-size: 12px; color: var(--secondary); opacity: 0.5; }

  /* ─── MOBILE ───────────────────────────────────────── */
  @media (max-width: 768px) {
    .lp nav { padding: 20px 24px; }
    .lp #hero { padding: 0 24px; }
    .lp section { padding: 80px 24px; }
    .lp #contact { padding: 80px 24px; }
    .lp footer { padding: 28px 24px; flex-direction: column; align-items: flex-start; gap: 8px; }
    .lp #coverage .coverage-grid { grid-template-columns: 1fr; }
    .lp .coverage-divider { display: none; }
    .lp .coverage-col { padding-right: 0; padding-bottom: 48px; border-bottom: 1px solid var(--border); margin-bottom: 48px; }
    .lp .coverage-col:last-child { padding-left: 0; padding-bottom: 0; border-bottom: none; margin-bottom: 0; }
    .lp #intelligence .stat-grid { grid-template-columns: repeat(2, 1fr); }
    .lp .stat-card { padding: 28px 24px; }
  }

  @media (max-width: 480px) {
    .lp #intelligence .stat-grid { grid-template-columns: 1fr; }
  }
`;

export default function Home() {
  useEffect(() => {
    const canvas = document.getElementById('gridCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let width = 0, height = 0, cols = 0, rows = 0;
    const CELL = 48;
    const BASE_ALPHA = 0.035;

    function resize() {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
    }

    let pulses: { col: number; row: number; phase: number; speed: number }[] = [];

    function initPulses() {
      pulses = [];
      const count = Math.floor(cols * rows * 0.018);
      for (let i = 0; i < count; i++) {
        pulses.push({
          col: Math.floor(Math.random() * cols),
          row: Math.floor(Math.random() * rows),
          phase: Math.random() * Math.PI * 2,
          speed: 0.004 + Math.random() * 0.008,
        });
      }
    }

    let animFrame = 0;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = `rgba(255,255,255,${BASE_ALPHA})`;
      ctx.lineWidth = 1;

      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * CELL, 0);
        ctx.lineTo(c * CELL, height);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * CELL);
        ctx.lineTo(width, r * CELL);
        ctx.stroke();
      }
      for (const p of pulses) {
        p.phase += p.speed;
        const alpha = (Math.sin(p.phase) * 0.5 + 0.5) * 0.06;
        ctx.fillStyle = `rgba(0,102,255,${alpha})`;
        ctx.fillRect(p.col * CELL + 1, p.row * CELL + 1, CELL - 1, CELL - 1);
      }
      animFrame = requestAnimationFrame(draw);
    }

    function handleResize() { resize(); initPulses(); }
    window.addEventListener('resize', handleResize);
    resize();
    initPulses();
    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <nav>
        <a href="#hero" className="nav-wordmark">HABGEN</a>
        <a href="#contact" className="nav-contact">Contact</a>
      </nav>

      <section id="hero">
        <canvas className="grid-canvas" id="gridCanvas" />
        <div className="hero-content">
          <div className="hero-eyebrow">Specialty Insurance MGA</div>
          <h1 className="hero-headline">We don&apos;t underwrite<br />properties.<br />We underwrite data.</h1>
          <p className="hero-sub">Specialty property and GL coverage for multifamily — built on 25 years of habitational risk intelligence.</p>
        </div>
      </section>

      <section id="coverage">
        <div className="section-label">What We Write</div>
        <div className="coverage-grid">
          <div className="coverage-col">
            <div className="coverage-form">HG CP 00 10</div>
            <div className="coverage-title">Property</div>
            <p className="coverage-desc">
              Commercial property coverage purpose-built for multifamily habitational risks. Our forms address the exposure profile unique to apartment communities — from building systems to loss of rents — underwritten with a precision that standard markets cannot match.
            </p>
          </div>
          <div className="coverage-divider" />
          <div className="coverage-col">
            <div className="coverage-form">HG GL 00 01</div>
            <div className="coverage-title">General Liability</div>
            <p className="coverage-desc">
              General liability coverage calibrated against 250 universities of GL data and decades of habitational claims history. We understand premises liability, fair housing exposure, and the operational realities of multifamily ownership and management.
            </p>
          </div>
        </div>
        <div className="coverage-footer">
          <p>
            <strong>Geographic appetite:</strong> All US states plus DC, excluding Hawaii and Alaska. &nbsp;&nbsp;
            <strong>Capacity backed by:</strong> Accelerant Insurance.
          </p>
        </div>
      </section>

      <section id="intelligence">
        <div className="section-label">How We Underwrite</div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-number">47</div>
            <div className="stat-label">Risk variables analyzed per property</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">250</div>
            <div className="stat-label">Universities in our GL claims database</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">25</div>
            <div className="stat-label">Years of habitational underwriting experience</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">48 + DC</div>
            <div className="stat-label">States in our active writing territory</div>
          </div>
        </div>
      </section>

      <section id="contact">
        <div className="section-label">Contact</div>
        <div className="contact-inner">
          <p className="contact-preamble">To submit a risk or discuss an account, reach out directly.</p>
          <div className="contact-name">Ari Rosenblum</div>
          <div className="contact-title">CEO &amp; Founder</div>
          <div className="contact-links">
            <a href="mailto:ari@habgen.com" className="contact-link">ari@habgen.com</a>
            <a href="tel:+19176216259" className="contact-link">(917) 621-6259</a>
          </div>
        </div>
      </section>

      <footer>
        <span className="footer-wordmark">HABGEN</span>
        <span className="footer-note">Specialty MGA · Habitational</span>
      </footer>
    </div>
  );
}
