import Link from 'next/link';

export const metadata = {
  title: '차림 · 대학 축제 주점을 위한 QR 주문 플랫폼',
  description:
    '주점 운영. QR 주문·토스 송금·실시간 주방 관리까지. 학생회·동아리를 위한 축제 주점 운영 도구.',
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        /* ── Layout scaffolding ──────────────────────────── */
        .lp body { background: var(--paper); overflow-x: hidden }
        .lp-body { background: var(--paper); overflow-x: hidden; }
        .container { width: min(1160px, 100% - 48px); margin-inline: auto }
        section { position: relative }
        .eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
          color: var(--text-2);
        }
        .eyebrow::before { content: ""; width: 22px; height: 1px; background: currentColor }
        .lp-h1, .lp-h2, .lp-h3 { margin: 0; letter-spacing: -0.035em; font-weight: 800; text-wrap: balance }
        .lp-h1 { font-size: clamp(40px, 5.6vw, 76px); line-height: 1.02 }
        .lp-h2 { font-size: clamp(30px, 3.6vw, 46px); line-height: 1.08 }
        .lp-h3 { font-size: 20px; line-height: 1.2; letter-spacing: -0.02em }
        .lp-p { margin: 0; text-wrap: pretty }

        /* ── Nav ─────────────────────────────────────────── */
        .lp-nav {
          position: sticky; top: 0; z-index: 40;
          background: color-mix(in oklab, var(--paper) 88%, transparent);
          backdrop-filter: saturate(1.2) blur(10px);
          border-bottom: 1px solid color-mix(in oklab, var(--border) 60%, transparent);
        }
        .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 68px }
        .lp-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text) }
        .lp-logo .mk {
          width: 34px; height: 34px; border-radius: 10px; background: var(--ink-900);
          display: grid; place-items: center; color: var(--neon); font-weight: 800; font-size: 15px;
          box-shadow: inset 0 -2px 0 rgba(0,0,0,.35);
        }
        .lp-logo .wm { font-weight: 800; font-size: 17px; letter-spacing: -0.02em }
        .lp-logo .wm small { display: block; font-size: 10px; color: var(--text-2); font-weight: 600; letter-spacing: .1em; text-transform: uppercase; margin-top: -2px }
        .nav-links { display: flex; align-items: center; gap: 22px }
        .nav-links a { color: var(--text-2); font-size: 14px; font-weight: 600; text-decoration: none }
        .nav-links a:hover { color: var(--text) }
        .nav-cta { display: flex; gap: 8px; align-items: center }
        @media (max-width: 820px) { .nav-links { display: none } }

        /* ── Hero ────────────────────────────────────────── */
        .hero { padding: 72px 0 40px; position: relative; overflow: hidden }
        .hero::before {
          content: ""; position: absolute; inset: -40% -20% auto auto; width: 820px; height: 820px;
          background: radial-gradient(closest-side, color-mix(in oklab, var(--neon) 55%, transparent), transparent 70%);
          filter: blur(10px); z-index: -1;
        }
        .hero-grid { display: grid; grid-template-columns: 1.05fr .95fr; gap: 56px; align-items: center }
        @media (max-width: 960px) { .hero-grid { grid-template-columns: 1fr; gap: 48px } }

        .hero .lp-h1 em {
          font-style: normal; background: var(--ink-900); color: var(--neon);
          padding: 0 .12em 0 .16em; border-radius: 10px;
          box-shadow: inset 0 -6px 0 rgba(0,0,0,.35);
        }
        .hero .sub { font-size: clamp(16px, 1.5vw, 19px); color: var(--text-2); margin-top: 24px; max-width: 540px; line-height: 1.55 }
        .hero-ctas { display: flex; gap: 10px; margin-top: 36px; flex-wrap: wrap }
        .btn-accent { box-shadow: inset 0 -3px 0 rgba(58,42,0,.22) }
        .btn-accent:hover { background: color-mix(in oklab, var(--neon) 92%, black) }
        .hero-trust { display: flex; gap: 28px; margin-top: 32px; padding-top: 22px; border-top: 1px solid var(--border); color: var(--text-2); font-size: 13px }
        .hero-trust strong { display: block; font-size: 22px; color: var(--text); font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em }
        @media (max-width: 520px) { .hero-trust { gap: 18px } }

        /* Mock stack in hero */
        .mock-stack { position: relative; aspect-ratio: 1/1.05; max-width: 520px; justify-self: center; width: 100% }
        .mock-tablet {
          position: absolute; inset: 6% 0 10% 4%;
          background: #0E1220; border-radius: 22px; padding: 10px;
          box-shadow: 0 30px 60px -20px rgba(14,18,32,.35), 0 12px 28px -12px rgba(14,18,32,.25);
          transform: rotate(-3deg);
        }
        .mock-tablet-screen {
          width: 100%; height: 100%; background: #F2F1EA; border-radius: 12px; overflow: hidden;
          display: grid; grid-template-columns: 60px 1fr;
        }
        .ts-side { background: #0E1220; padding: 10px 6px; display: flex; flex-direction: column; gap: 6px; align-items: center }
        .ts-side .sb { width: 28px; height: 8px; border-radius: 99px; background: #2a3150 }
        .ts-side .sb.on { background: var(--neon) }
        .ts-main { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px }
        .ts-h { font-size: 11px; font-weight: 800; letter-spacing: -0.02em; color: var(--text) }
        .ts-cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px }
        .ts-card { background: #fff; border: 1px solid #ECEEF3; border-radius: 8px; padding: 8px 6px; min-height: 52px; display: flex; flex-direction: column; gap: 4px }
        .ts-card .k { font-size: 7px; color: #8A91A5; font-weight: 700; letter-spacing: .08em; text-transform: uppercase }
        .ts-card .v { font-size: 14px; font-weight: 800; color: #0E1220; letter-spacing: -0.02em; font-variant-numeric: tabular-nums }
        .ts-card.warn { background: #FCEDEE; border-color: #F3BEC0 }
        .ts-card.warn .v { color: #a61d0c }
        .ts-grid { display: grid; grid-template-columns: repeat(5,1fr); gap: 5px }
        .ts-t { background: #fff; border: 1px solid #ECEEF3; border-radius: 6px; aspect-ratio: 1; display: grid; place-items: center; font-size: 9px; font-weight: 800; color: #0E1220 }
        .ts-t.a { background: #0E1220; color: #fff }
        .ts-t.w { background: #FCEDEE; border-color: #F3BEC0; color: #a61d0c }

        .mock-phone {
          position: absolute; right: -8px; bottom: 0; width: 44%;
          aspect-ratio: 9/19.5; background: #000; border-radius: 34px; padding: 7px;
          box-shadow: 0 30px 60px -18px rgba(14,18,32,.4), 0 12px 24px -10px rgba(14,18,32,.3);
          transform: rotate(6deg);
          z-index: 2;
        }
        .mock-phone::before {
          content: ""; position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
          width: 46px; height: 14px; background: #000; border-radius: 99px; z-index: 3;
        }
        .mock-phone-screen {
          width: 100%; height: 100%; background: var(--paper); border-radius: 28px; overflow: hidden;
          display: flex; flex-direction: column; padding: 32px 14px 14px; gap: 8px;
        }
        .mps-brand { display: flex; align-items: center; gap: 6px }
        .mps-brand .l { width: 20px; height: 20px; border-radius: 6px; background: #0E1220; color: var(--neon); display: grid; place-items: center; font-weight: 800; font-size: 9px }
        .mps-brand b { font-size: 11px; letter-spacing: -0.02em }
        .mps-table { background: #fff; border: 1px solid #ECEEF3; border-radius: 10px; padding: 10px; text-align: center }
        .mps-table .k { font-size: 8px; color: #8A91A5; letter-spacing: .1em; font-weight: 700; text-transform: uppercase }
        .mps-table .v { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; color: #0E1220 }
        .mps-item { background: #fff; border: 1px solid #ECEEF3; border-radius: 8px; padding: 7px 8px; display: flex; align-items: center; gap: 6px }
        .mps-item .th { width: 28px; height: 28px; border-radius: 6px; background: #FBE5C8; flex: none }
        .mps-item .th.b { background: #E8D4B4 }
        .mps-item .th.c { background: #E2EAF4 }
        .mps-item .nm { flex: 1; font-size: 10px; font-weight: 700; color: #0E1220 }
        .mps-item .nm small { display: block; font-size: 8px; color: #8A91A5; font-weight: 500; margin-top: 1px }
        .mps-item .p { font-size: 10px; font-weight: 800; font-variant-numeric: tabular-nums }
        .mps-cta { margin-top: auto; height: 36px; background: var(--neon); color: var(--neon-ink); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; box-shadow: inset 0 -2px 0 rgba(58,42,0,.22) }

        .hero-tag {
          position: absolute; background: #fff; border: 1px solid var(--border); border-radius: 12px;
          padding: 9px 13px; display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 700;
          box-shadow: var(--shadow-2); z-index: 3;
        }
        .hero-tag .dot { width: 8px; height: 8px; border-radius: 50% }
        .hero-tag.t1 { top: 4%; left: -4% }
        .hero-tag.t1 .dot { background: var(--mint) }
        .hero-tag.t2 { bottom: 14%; left: -2% }
        .hero-tag.t2 .dot { background: var(--coral); animation: lp-pulse 1.6s ease-out infinite }
        @keyframes lp-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,90,68,.45) }
          80% { box-shadow: 0 0 0 10px rgba(255,90,68,0) }
          100% { box-shadow: 0 0 0 0 rgba(255,90,68,0) }
        }

        /* ── Logo bar ────────────────────────────────────── */
        .logo-bar { padding: 28px 0 56px }
        .logo-bar-inner { display: flex; flex-wrap: wrap; gap: 32px 48px; align-items: center; justify-content: center; color: var(--text-3); font-weight: 700; font-size: 13px }
        .logo-bar-inner .ll { opacity: .85; letter-spacing: -0.01em }
        .logo-bar-label { text-align: center; font-size: 11px; color: var(--text-3); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 18px }

        /* ── Features (3 cards) ──────────────────────────── */
        .features { padding: 100px 0; background: var(--ink-900); color: #E6E8EF; border-radius: 40px 40px 0 0; margin-top: 40px }
        .features-head { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 32px; margin-bottom: 56px }
        @media (max-width: 820px) { .features-head { grid-template-columns: 1fr } }
        .features-head .lp-h2 { color: #fff; max-width: 560px }
        .features-head .lp-p { color: #B7BCCB; max-width: 360px; font-size: 15px }
        .features-head .eyebrow { color: #8A91A5 }

        .fgrid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px }
        @media (max-width: 860px) { .fgrid { grid-template-columns: 1fr } }
        .fcard {
          background: #161B30; border: 1px solid #222942; border-radius: 22px; padding: 28px;
          display: flex; flex-direction: column; gap: 18px; position: relative; overflow: hidden;
        }
        .fcard.hi { background: var(--neon); color: var(--neon-ink); border-color: var(--neon) }
        .fcard.hi .fnum { color: rgba(58,42,0,.5) }
        .fcard.hi .fbody { color: #5a3d00 }
        .fnum { font-size: 12px; font-weight: 800; color: #5A6178; letter-spacing: .14em }
        .fcard .lp-h3 { font-size: 24px; letter-spacing: -0.02em; color: inherit }
        .fbody { font-size: 14px; color: #B7BCCB; line-height: 1.6; flex: 1 }
        .fchips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px }
        .fchip { font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 99px; background: rgba(255,255,255,.08); color: #E6E8EF; border: 1px solid rgba(255,255,255,.1) }
        .fcard.hi .fchip { background: rgba(58,42,0,.1); color: var(--neon-ink); border-color: rgba(58,42,0,.2) }
        .fvis {
          height: 140px; background: #0E1220; border-radius: 14px; border: 1px solid #222942; margin-top: 6px;
          display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;
        }
        .fcard.hi .fvis { background: #fff; border-color: rgba(58,42,0,.15) }

        /* QR visual */
        .vis-qr {
          width: 92px; height: 92px; border-radius: 10px; position: relative;
          background:
            linear-gradient(#fff,#fff) 8px 8px/76px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 12px/56px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 16px/66px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 22px/20px 20px no-repeat,
            linear-gradient(#fff,#fff) 32px 22px/44px 2px no-repeat,
            linear-gradient(#fff,#fff) 32px 26px/34px 2px no-repeat,
            linear-gradient(#fff,#fff) 32px 30px/40px 2px no-repeat,
            linear-gradient(#fff,#fff) 32px 34px/28px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 52px/76px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 56px/60px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 60px/68px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 64px/44px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 68px/58px 2px no-repeat,
            linear-gradient(#fff,#fff) 8px 72px/40px 2px no-repeat,
            #0E1220;
          box-shadow: inset 0 0 0 8px #0E1220;
        }
        .vis-qr::before, .vis-qr::after { content: ""; position: absolute; width: 18px; height: 18px; border: 3px solid #fff; border-radius: 3px }
        .vis-qr::before { top: 8px; left: 8px }
        .vis-qr::after { top: 8px; right: 8px }
        .vis-qr .cr { position: absolute; bottom: 8px; left: 8px; width: 18px; height: 18px; border: 3px solid #fff; border-radius: 3px }

        /* Toss visual */
        .vis-toss { display: flex; align-items: center; gap: 14px }
        .vis-toss .tc {
          width: 64px; height: 64px; border-radius: 16px; background: #3182F6; color: #fff;
          display: grid; place-items: center; font-weight: 800; font-size: 22px; letter-spacing: -0.02em;
          box-shadow: 0 8px 20px -6px rgba(49,130,246,.45);
        }
        .vis-toss .arrow { color: var(--text-3); font-size: 24px; font-weight: 700 }
        .vis-toss .amt { font-size: 22px; font-weight: 800; color: var(--neon); letter-spacing: -0.03em; font-variant-numeric: tabular-nums }
        .vis-toss .amt small { display: block; font-size: 10px; color: rgba(58,42,0,.55); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px }

        /* KDS visual */
        .vis-kds { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; padding: 10px; width: 100%; height: 100% }
        .vis-kds .ki { background: #222942; border-radius: 8px; border-left: 3px solid var(--mint); padding: 6px 7px; font-size: 8px; color: #B7BCCB; display: flex; flex-direction: column; gap: 2px }
        .vis-kds .ki b { font-size: 10px; color: #fff; letter-spacing: -0.01em }
        .vis-kds .ki.warn { border-left-color: var(--coral); background: #2c1c28 }
        .vis-kds .ki.warn b { color: var(--coral) }

        /* ── How it works ───────────────────────────────── */
        .how { padding: 110px 0 }
        .how-head { text-align: center; margin-bottom: 64px }
        .how-head .lp-h2 { margin-top: 14px; margin-inline: auto; max-width: 720px }
        .how-head .lp-p { color: var(--text-2); max-width: 540px; margin: 18px auto 0; font-size: 15px }
        .steps { display: grid; grid-template-columns: repeat(4,1fr); gap: 18px; position: relative }
        @media (max-width: 960px) { .steps { grid-template-columns: repeat(2,1fr) } }
        @media (max-width: 520px) { .steps { grid-template-columns: 1fr } }
        .step {
          background: #fff; border: 1px solid var(--border); border-radius: 20px; padding: 24px;
          display: flex; flex-direction: column; gap: 14px; position: relative; min-height: 260px;
        }
        .step-n {
          width: 42px; height: 42px; border-radius: 12px; background: var(--neon); color: var(--neon-ink);
          display: grid; place-items: center; font-weight: 800; font-size: 17px; letter-spacing: -0.02em;
          box-shadow: inset 0 -3px 0 rgba(58,42,0,.2);
        }
        .step .lp-h3 { font-size: 17px; letter-spacing: -0.02em }
        .step .lp-p { font-size: 13px; color: var(--text-2); line-height: 1.55 }
        .step-vis {
          margin-top: auto; background: var(--surface-2); border-radius: 12px; padding: 14px;
          display: flex; align-items: center; justify-content: center; min-height: 86px;
          font-size: 12px; color: var(--text-2); font-weight: 600;
        }
        .sv-row { display: flex; align-items: center; gap: 8px }
        .sv-field { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 10px; font-weight: 700; color: var(--text-2); min-width: 80px; text-align: left }
        .sv-field strong { display: block; color: var(--text); font-size: 11px; margin-top: 1px }
        .sv-qr-mini {
          width: 44px; height: 44px;
          background:
            linear-gradient(#0E1220,#0E1220) 50%/6px 100% no-repeat,
            linear-gradient(#0E1220,#0E1220) 50%/100% 6px no-repeat, var(--surface-2);
          border: 2px solid #0E1220; border-radius: 6px; position: relative;
        }
        .sv-qr-mini::before, .sv-qr-mini::after { content: ""; position: absolute; width: 10px; height: 10px; border: 2px solid #0E1220; border-radius: 2px }
        .sv-qr-mini::before { top: 3px; left: 3px }
        .sv-qr-mini::after { top: 3px; right: 3px }
        .sv-ping {
          width: 10px; height: 10px; border-radius: 50%; background: var(--coral);
          box-shadow: 0 0 0 0 rgba(255,90,68,.5); animation: lp-pulse 1.6s ease-out infinite;
        }

        /* ── Scale / Scenarios ──────────────────────────── */
        .scale { padding: 100px 0; background: var(--surface-2); border-radius: 40px; margin: 0 24px }
        @media (max-width: 560px) { .scale { margin: 0 12px } }
        .scale-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center }
        @media (max-width: 820px) { .scale-inner { grid-template-columns: 1fr } }
        .scale .lp-h2 { max-width: 480px }
        .scale .lp-p { color: var(--text-2); margin-top: 18px; max-width: 480px; font-size: 15px }
        .scale-list { margin-top: 24px; display: grid; gap: 10px; padding: 0 }
        .scale-list li { list-style: none; display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: #fff; border: 1px solid var(--border); border-radius: 12px; font-size: 14px; font-weight: 600 }
        .scale-list li .ck { width: 22px; height: 22px; border-radius: 50%; background: var(--ink-900); color: var(--neon); display: grid; place-items: center; font-size: 13px; font-weight: 800; flex: none }

        .booths { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px }
        .booth {
          background: #fff; border: 1px solid var(--border); border-radius: 18px; padding: 18px;
          display: flex; flex-direction: column; gap: 10px; min-height: 148px;
        }
        .booth .bh { display: flex; justify-content: space-between; align-items: flex-start }
        .booth .bh .nm { font-size: 14px; font-weight: 800; letter-spacing: -0.02em }
        .booth .bh .nm small { display: block; font-size: 11px; color: var(--text-2); font-weight: 600; margin-top: 1px }
        .booth .rev { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em }
        .booth .rev small { display: block; font-size: 10px; font-weight: 700; color: var(--mint); text-align: right }
        .booth .bm { display: flex; gap: 6px; align-items: center; font-size: 11px; color: var(--text-2); font-weight: 600 }
        .booth .bm .mini { width: 6px; height: 6px; border-radius: 50%; background: var(--mint) }
        .booth .bm .mini.w { background: var(--coral) }
        .bbar { height: 4px; border-radius: 99px; background: var(--ink-100); overflow: hidden; margin-top: auto }
        .bbar i { display: block; height: 100%; background: var(--ink-900); border-radius: 99px }
        .booth.hi { background: var(--ink-900); color: #fff; border-color: var(--ink-900) }
        .booth.hi .bh .nm small, .booth.hi .bm { color: #B7BCCB }
        .booth.hi .bbar { background: #222942 }
        .booth.hi .bbar i { background: var(--neon) }

        /* ── FAQ / Contact ──────────────────────────────── */
        .faq { padding: 110px 0 }
        .faq-inner { display: grid; grid-template-columns: .85fr 1fr; gap: 56px }
        @media (max-width: 820px) { .faq-inner { grid-template-columns: 1fr; gap: 32px } }
        .faq .lp-h2 { max-width: 420px }
        .faq-intro .lp-p { color: var(--text-2); margin-top: 18px; font-size: 15px; max-width: 380px }
        .faq-contact { margin-top: 28px; padding: 20px; background: var(--ink-900); color: #fff; border-radius: 16px }
        .faq-contact h3 { color: #fff; margin-bottom: 6px; font-size: 16px; letter-spacing: -0.02em; font-weight: 800; margin-top: 0 }
        .faq-contact .lp-p { color: #B7BCCB; font-size: 13px }
        .faq-contact-rows { display: grid; gap: 10px; margin-top: 16px }
        .fcr { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #161B30; border-radius: 10px; font-size: 13px; font-weight: 700 }
        .fcr .ic { width: 28px; height: 28px; border-radius: 8px; background: var(--neon); color: var(--neon-ink); display: grid; place-items: center; font-weight: 800; flex: none }
        .fcr.kk .ic { background: #FEE500; color: #3C1E1E }
        .fcr small { display: block; font-size: 11px; color: #8A91A5; font-weight: 500; margin-top: 1px }
        .fcr a { color: inherit; text-decoration: none }
        .fcr a:hover { text-decoration: underline }

        .qa { display: grid; gap: 10px }
        .qa details {
          background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 0;
          transition: box-shadow .15s, border-color .15s;
        }
        .qa details[open] { border-color: var(--ink-900); box-shadow: var(--shadow-2) }
        .qa summary {
          list-style: none; cursor: pointer; padding: 18px 22px; font-size: 15px; font-weight: 700;
          display: flex; justify-content: space-between; align-items: center; letter-spacing: -0.01em;
        }
        .qa summary::-webkit-details-marker { display: none }
        .qa summary::after {
          content: "+"; font-size: 22px; font-weight: 500; color: var(--text-2);
          transition: transform .2s ease;
        }
        .qa details[open] summary::after { content: "−"; color: var(--text) }
        .qa .ans { padding: 0 22px 20px; color: var(--text-2); font-size: 14px; line-height: 1.65 }

        /* ── Final CTA ──────────────────────────────────── */
        .final-cta { padding: 48px 0 120px }
        .final-box {
          background: var(--neon); color: var(--neon-ink);
          border-radius: 32px; padding: 56px 48px; position: relative; overflow: hidden;
          display: grid; grid-template-columns: 1.3fr 1fr; gap: 40px; align-items: center;
        }
        @media (max-width: 780px) { .final-box { grid-template-columns: 1fr; padding: 40px 28px } }
        .final-box .lp-h2 { letter-spacing: -0.035em }
        .final-box .lp-p { margin-top: 12px; color: #5a3d00; max-width: 460px; font-size: 15px }
        .final-box .fb-cta { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap }
        .final-box .fb-cta .btn-primary { background: var(--ink-900); color: var(--neon); box-shadow: inset 0 -3px 0 rgba(0,0,0,.35) }
        .final-box .fb-cta .btn-ghost { background: transparent; border: 1.5px solid rgba(58,42,0,.3); color: var(--neon-ink) }
        .final-mock {
          background: var(--ink-900); border-radius: 18px; padding: 16px; color: #E6E8EF;
          transform: rotate(2deg); box-shadow: 0 20px 40px -12px rgba(58,42,0,.35);
        }
        .final-mock .fm-h { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #8A91A5; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 12px }
        .final-mock .fm-v { font-size: 36px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: #fff }
        .final-mock .fm-v small { display: block; font-size: 11px; color: var(--neon); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px }
        .final-mock .fm-bar { height: 60px; margin-top: 14px; display: flex; align-items: flex-end; gap: 4px }
        .final-mock .fm-bar i { flex: 1; background: #222942; border-radius: 3px; min-height: 4px }
        .final-mock .fm-bar i.hi { background: var(--neon) }

        /* ── Footer ─────────────────────────────────────── */
        .lp-footer { background: var(--ink-900); color: #B7BCCB; padding: 64px 0 40px }
        .ft-top { display: grid; grid-template-columns: 1.4fr .9fr .9fr .9fr; gap: 32px; padding-bottom: 40px; border-bottom: 1px solid #222942 }
        @media (max-width: 760px) { .ft-top { grid-template-columns: 1fr 1fr } }
        @media (max-width: 440px) { .ft-top { grid-template-columns: 1fr } }
        .ft-col h4 { font-size: 11px; color: #5A6178; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 14px; margin-top: 0 }
        .ft-col a { display: block; color: #B7BCCB; text-decoration: none; font-size: 14px; font-weight: 500; padding: 4px 0 }
        .ft-col a:hover { color: #fff }
        .ft-brand .lp-p { margin-top: 14px; font-size: 13px; color: #8A91A5; line-height: 1.6; max-width: 320px }
        .ft-brand .lp-logo .wm { color: #fff }
        .ft-bot { display: flex; justify-content: space-between; align-items: center; padding-top: 28px; font-size: 12px; color: #5A6178; flex-wrap: wrap; gap: 16px }
        .ft-bot a { color: #8A91A5; text-decoration: none; margin-left: 18px }
        .ft-bot a:hover { color: #fff }
      `}</style>

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="container nav-inner">
          <a className="lp-logo" href="/">
            <span className="mk">酒</span>
            <span className="wm">
              차림
              <small>for student festival</small>
            </span>
          </a>
          <div className="nav-links">
            <a href="#features">기능</a>
            <a href="#how">사용 흐름</a>
            <a href="#scale">운영 규모</a>
            <a href="#faq">문의</a>
          </div>
          <div className="nav-cta">
            <Link href="/signup" className="btn btn-primary btn-sm">시작하기</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">대학 축제 주점 운영 서비스</span>
            <h1 className="lp-h1" style={{ marginTop: 18, fontWeight: 800 }}>
              주점 운영,<br />
              이제 차림으로
            </h1>
            <p className="sub lp-p">
              대학교 주점 운영,{' '}
              간편하게. <b>차림</b> 하나로 끝내보세요
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-accent btn-lg" href="/signup">주점 시작하기 →</Link>
              <Link className="btn btn-ghost btn-lg" href="/login">관리자 로그인</Link>
            </div>
            <div className="hero-trust">
              <div><strong>5개</strong>주점까지 동시 운영</div>
              <div><strong>3분</strong>안에 첫 QR 설정</div>
            </div>
          </div>

          {/* Mock stack */}
          <div className="mock-stack">
            <div className="hero-tag t1"><span className="dot"></span>22:14 · 영업 중</div>
            <div className="hero-tag t2"><span className="dot"></span>3번 테이블 신규 주문</div>

            {/* Tablet: admin dashboard */}
            <div className="mock-tablet">
              <div className="mock-tablet-screen">
                <div className="ts-side">
                  <div className="sb on"></div>
                  <div className="sb"></div>
                  <div className="sb"></div>
                  <div className="sb"></div>
                  <div className="sb"></div>
                </div>
                <div className="ts-main">
                  <div className="ts-h">컴공 주점 · 오늘 현황</div>
                  <div className="ts-cards">
                    <div className="ts-card"><span className="k">주문</span><span className="v">132</span></div>
                    <div className="ts-card"><span className="k">입금 확인</span><span className="v">125</span></div>
                    <div className="ts-card warn"><span className="k">미확인</span><span className="v">7</span></div>
                    <div className="ts-card"><span className="k">매출</span><span className="v">1.8M</span></div>
                  </div>
                  <div className="ts-h" style={{ marginTop: 6 }}>테이블 현황</div>
                  <div className="ts-grid">
                    <div className="ts-t a">1</div><div className="ts-t">2</div><div className="ts-t a">3</div><div className="ts-t w">4</div><div className="ts-t">5</div>
                    <div className="ts-t a">6</div><div className="ts-t">7</div><div className="ts-t a">8</div><div className="ts-t">9</div><div className="ts-t">10</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone: guest menu */}
            <div className="mock-phone">
              <div className="mock-phone-screen">
                <div className="mps-brand"><span className="l">컴</span><b>컴공 주점</b></div>
                <div className="mps-table">
                  <div className="k">테이블</div>
                  <div className="v">3번</div>
                </div>
                <div className="mps-item">
                  <span className="th"></span>
                  <span className="nm">매콤 무뼈 닭발<small>불맛 · 마늘</small></span>
                  <span className="p">14,000</span>
                </div>
                <div className="mps-item">
                  <span className="th b"></span>
                  <span className="nm">컴공 해물파전<small>오징어 · 새우</small></span>
                  <span className="p">13,000</span>
                </div>
                <div className="mps-item">
                  <span className="th c"></span>
                  <span className="nm">생맥 500cc<small>카스</small></span>
                  <span className="p">4,500</span>
                </div>
                <div className="mps-cta">주문하기 · 31,500</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features" id="features">
        <div className="container">
          <div className="features-head">
            <div>
              <span className="eyebrow" style={{ color: '#8A91A5' }}>CORE FEATURES</span>
              <h2 className="lp-h2" style={{ marginTop: 14 }}>주점 하나에 필요한 전부,<br />3개 스텝으로 끝.</h2>
            </div>
            <p className="lp-p">주문·결제·주방을 하나로 묶어 <br />'운영'이 아니라 '축제'에 집중할 수 있도록 만들었어요.</p>
          </div>

          <div className="fgrid">
            {/* 1. QR */}
            <div className="fcard hi">
              <div className="fnum">01 · ORDER</div>
              <h3 className="lp-h3">QR 한 번이면<br />주문이 끝나요</h3>
              <div className="fvis">
                <div className="vis-qr"><span className="cr"></span></div>
              </div>
              <p className="fbody">테이블마다 붙은 QR을 찍으면 앱 설치 없이 바로 메뉴 화면으로.</p>
              <div className="fchips">
                <span className="fchip">설치 불필요</span>
                <span className="fchip">테이블별 QR</span>
                <span className="fchip">품절 실시간</span>
              </div>
            </div>

            {/* 2. Toss */}
            <div className="fcard">
              <div className="fnum">02 · PAYMENT</div>
              <h3 className="lp-h3">토스 송금으로<br />간편하게 입금</h3>
              <div className="fvis">
                <div className="vis-toss">
                  <div className="tc">T</div>
                  <span className="arrow">→</span>
                  <div className="amt" style={{ color: 'var(--neon)' }}>
                    <small style={{ color: 'var(--neon)' }}>주문 #042</small>
                    ₩ 24,000
                  </div>
                </div>
              </div>
              <p className="fbody">계좌를 한 번 등록하면, 손님들의 결제가 쉬워져요. Toss를 이용해 3초 만에 입금할 수 있어요.</p>
              <div className="fchips">
                <span className="fchip">송금 확인 필터</span>
                <span className="fchip">계좌이체도 가능</span>
              </div>
            </div>

            {/* 3. KDS */}
            <div className="fcard">
              <div className="fnum">03 · KITCHEN</div>
              <h3 className="lp-h3">주방 태블릿<br />실시간 티켓</h3>
              <div className="fvis">
                <div className="vis-kds">
                  <div className="ki"><b>3번 · #048</b>닭발 2 · 파전 1<span style={{ color: '#8A91A5' }}>방금</span></div>
                  <div className="ki"><b>7번 · #047</b>먹태 1 · 소주 2<span style={{ color: '#8A91A5' }}>3분</span></div>
                  <div className="ki warn"><b>2번 · #045</b>파전 1 · 생맥 3<span style={{ color: '#FF5A44' }}>8분 지연</span></div>
                </div>
              </div>
              <p className="fbody">주문 접수 → 조리 중 → 완성까지 탭 한 번으로 상태 전환. 오래된 주문은 카드 테두리가 붉게 변해 바로 눈에 들어와요.</p>
              <div className="fchips">
                <span className="fchip">태블릿 최적화</span>
                <span className="fchip">지연 알림</span>
                <span className="fchip">일괄 처리</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="how" id="how">
        <div className="container">
          <div className="how-head">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2 className="lp-h2">축제 전날 밤이 아니라,<br />지금 당장 준비 끝.</h2>
            <p className="lp-p">학생회 한 명이 노트북 하나로 30분이면 첫 주점 오픈. 당일엔 QR만 붙이면 돼요.</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-n">1</div>
              <h3 className="lp-h3">회원가입</h3>
              <p className="lp-p">학생회 이메일로 가입. 초대 링크로 운영진 여러 명을 한 번에 추가할 수 있어요.</p>
              <div className="step-vis">
                <div className="sv-row">
                  <div className="sv-field">이메일<strong>you@school.ac.kr</strong></div>
                  <span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>가입</span>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-n">2</div>
              <h3 className="lp-h3">주점 만들기</h3>
              <p className="lp-p">이름·한 줄 설명·계좌·토스 QR만 넣으면 끝. 메뉴와 가격을 직접 입력하면 바로 운영 시작.</p>
              <div className="step-vis">
                <div className="sv-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div className="sv-field">주점명<strong>컴퓨터학과 대동제</strong></div>
                  <div className="sv-field">입금 계좌<strong>카카오 3333-01-...</strong></div>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-n">3</div>
              <h3 className="lp-h3">QR 출력</h3>
              <p className="lp-p">테이블 수만큼 QR 자동 생성. 화면에서 바로 확인 가능.</p>
              <div className="step-vis">
                <div className="sv-row">
                  <div className="sv-qr-mini"></div>
                  <div className="sv-qr-mini" style={{ transform: 'rotate(-4deg)' }}></div>
                  <div className="sv-qr-mini" style={{ transform: 'rotate(5deg)' }}></div>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-n">4</div>
              <h3 className="lp-h3">주문·결제 확인</h3>
              <p className="lp-p">손님이 QR로 주문하면 주방에 바로 띄우고, 결제 확인은 관리자 대시보드에서 한 번에.</p>
              <div className="step-vis">
                <div className="sv-row">
                  <span className="sv-ping"></span>
                  <div className="sv-field">방금 들어옴<strong>3번 · ₩ 24,000</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scale ── */}
      <section className="scale" id="scale">
        <div className="container scale-inner">
          <div>
            <span className="eyebrow">MULTI-BOOTH</span>
            <h2 className="lp-h2" style={{ marginTop: 14 }}>
              1인 당 주점 최대&nbsp;
              <em style={{ background: 'var(--neon)', color: 'var(--neon-ink)', fontStyle: 'normal', padding: '0 .12em', borderRadius: 6 }}>5개</em>
              까지<br />동시에 운영해요.
            </h2>
            <p className="lp-p">
              다양한 주점을 관리하고 기록할 수 있습니다.{' '}
              매 년 새로이 달라지는 컨셉, <b>차림</b>에서 한번에
            </p>
            <ul className="scale-list">
              <li><span className="ck">✓</span>주점별 별도 계좌·토스 QR 설정</li>
              <li><span className="ck">✓</span>권한 분리 — 운영진·주방·서빙</li>
            </ul>
          </div>

          <div className="booths">
            <div className="booth hi">
              <div className="bh">
                <div className="nm">컴공 주점<small>1층 북관</small></div>
                <div className="rev">1.8M<small>+18%</small></div>
              </div>
              <div className="bm"><span className="mini"></span>영업 중 · 테이블 14</div>
              <div className="bbar"><i style={{ width: '74%' }}></i></div>
            </div>
            <div className="booth">
              <div className="bh">
                <div className="nm">디자인 라운지<small>2층 복도</small></div>
                <div className="rev">920K<small>+6%</small></div>
              </div>
              <div className="bm"><span className="mini"></span>영업 중 · 테이블 8</div>
              <div className="bbar"><i style={{ width: '52%' }}></i></div>
            </div>
            <div className="booth">
              <div className="bh">
                <div className="nm">경영 BAR<small>중앙광장</small></div>
                <div className="rev">1.3M<small>+11%</small></div>
              </div>
              <div className="bm"><span className="mini w"></span>미확인 3건 대기</div>
              <div className="bbar"><i style={{ width: '61%' }}></i></div>
            </div>
            <div className="booth">
              <div className="bh">
                <div className="nm">사학 주막<small>도서관 앞</small></div>
                <div className="rev">640K<small>+3%</small></div>
              </div>
              <div className="bm"><span className="mini"></span>영업 중 · 테이블 6</div>
              <div className="bbar"><i style={{ width: '38%' }}></i></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ / Contact ── */}
      <section className="faq" id="faq">
        <div className="container faq-inner">
          <div className="faq-intro">
            <span className="eyebrow">FAQ · 문의</span>
            <h2 className="lp-h2" style={{ marginTop: 14 }}>쓰다가 막히셨나요?<br />언제든 물어보세요.</h2>

            <div className="faq-contact">
              <h3>이렇게 연락해요</h3>
              <p className="lp-p">평일 10–22시</p>
              <div className="faq-contact-rows">
                <div className="fcr kk">
                  <span className="ic">@</span>
                  <div>
                    Instagram @gong.zip.hab
                    <small>ㅠ.ㅠ</small>
                  </div>
                </div>
                <div className="fcr">
                  <span className="ic">@</span>
                  <div>
                    <a href="mailto:yeoziphab@gmail.com">yeoziphab@gmail.com</a>
                    <small>상세 문의·대량 운영 상담</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="qa">
            <details open>
              <summary>사용은 무료인가요?</summary>
              <div className="ans">학생회·동아리 축제 용도는 완전 무료예요. 재미있게 즐겨주세요.</div>
            </details>
            <details>
              <summary>앱을 설치해야 하나요?</summary>
              <div className="ans">손님은 QR만 찍으면 돼요. 설치·회원가입 없이, 브라우저로 바로 주문 화면이 열려요.</div>
            </details>
            <details>
              <summary>토스 송금이 자동으로 매칭되나요?</summary>
              <div className="ans">주문마다 고유 송금 메시지(#042 등)가 표시됩니다. 관리자가 확인 후 수동으로 '입금 확인' 처리합니다.</div>
            </details>
            <details>
              <summary>주점을 여러 개 운영할 수 있나요?</summary>
              <div className="ans">한 계정에서 최대 5개까지 동시에 운영할 수 있어요. 주점마다 메뉴·계좌·권한을 따로 설정할 수 있어요.</div>
            </details>
            <details>
              <summary>데이터는 축제 끝나면 어떻게 되나요?</summary>
              <div className="ans">CSV로 다운로드할 수 있어요. 직접 삭제하거나 계정 탈퇴 시 데이터가 파기됩니다.</div>
            </details>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="final-cta">
        <div className="container">
          <div className="final-box">
            <div>
              <span className="eyebrow" style={{ color: '#5a3d00' }}>축제 2주 전? 아직 늦지 않았어요.</span>
              <h2 className="lp-h2" style={{ marginTop: 14 }}>올해 축제는,<br />무탈하게.</h2>
              <p className="lp-p">실수 없이 추억만 남는 차림을 써보세요.</p>
              <div className="fb-cta">
                <Link className="btn btn-primary btn-lg" href="/signup">주점 시작하기</Link>
              </div>
            </div>
            <div className="final-mock">
              <div className="fm-h"><span>오늘 매출</span><span>22:14</span></div>
              <div className="fm-v"><small>컴공 주점</small>₩ 1,842,500</div>
              <div className="fm-bar">
                <i style={{ height: '24%' }}></i><i style={{ height: '42%' }}></i><i style={{ height: '38%' }}></i>
                <i style={{ height: '58%' }}></i><i style={{ height: '72%' }}></i><i style={{ height: '66%' }}></i>
                <i className="hi" style={{ height: '88%' }}></i><i className="hi" style={{ height: '94%' }}></i>
                <i className="hi" style={{ height: '78%' }}></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="container">
          <div className="ft-top">
            <div className="ft-col ft-brand">
              <a className="lp-logo" href="/">
                <span className="wm" style={{ color: '#fff' }}>
                  차림
                  <small style={{ color: '#8A91A5' }}>for University</small>
                </span>
              </a>
              <p className="lp-p">대학생들의 주점 운영.</p>
            </div>
            <div className="ft-col">
              <h4>제품</h4>
              <a href="#features">기능 소개</a>
              <a href="#how">사용 흐름</a>
              <a href="#scale">운영 규모</a>
            </div>
            <div className="ft-col">
              <h4>학생회용</h4>
              <Link href="/signup">주점 시작하기</Link>
              <Link href="/login">관리자 로그인</Link>
            </div>
            <div className="ft-col">
              <h4>문의</h4>
              <a href="mailto:kucseai@gmail.com">kucseai@gmail.com</a>
              <a href="#">Instagram</a>
              <a href="#">GitHub</a>
            </div>
          </div>
          <div className="ft-bot">
            <div>© 2026 차림 · 학생 사이드 프로젝트</div>
          </div>
        </div>
      </footer>
    </>
  );
}
