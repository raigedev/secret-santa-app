"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

// ─── Shhh Santa Logo Icon (reusable) ───
function SantaIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`hat-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e74c3c"/>
          <stop offset="100%" stopColor="#c0392b"/>
        </linearGradient>
      </defs>
      <circle cx="80" cy="82" r="50" fill="#fde8e8"/>
      <ellipse cx="80" cy="108" rx="38" ry="24" fill="#fff"/>
      <ellipse cx="80" cy="102" rx="32" ry="16" fill="#fff"/>
      <ellipse cx="66" cy="86" rx="12" ry="6" fill="#fff"/>
      <ellipse cx="94" cy="86" rx="12" ry="6" fill="#fff"/>
      <circle cx="80" cy="76" r="5" fill="#e8a8a8"/>
      <circle cx="78" cy="74" r="2" fill="#f0baba" opacity=".6"/>
      <ellipse cx="64" cy="66" rx="5" ry="6" fill="#fff"/>
      <ellipse cx="64" cy="67" rx="4" ry="5" fill="#2c1810"/>
      <circle cx="62" cy="65" r="1.8" fill="#fff"/>
      <path d="M56 58 Q64 52 72 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M90 66 Q96 60 102 66" fill="none" stroke="#2c1810" strokeWidth="3" strokeLinecap="round"/>
      <path d="M88 58 Q96 52 106 58" fill="none" stroke="#c4a090" strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="52" cy="78" rx="6" ry="4.5" fill="#f0a0a0" opacity=".25"/>
      <ellipse cx="108" cy="78" rx="6" ry="4.5" fill="#f0a0a0" opacity=".25"/>
      <rect x="76" y="84" width="9" height="24" rx="4.5" fill="#f8d0d0" stroke="#e8b8b8" strokeWidth=".6"/>
      <ellipse cx="80.5" cy="85" rx="3.5" ry="2.5" fill="#fce4e4"/>
      <path d={`M32 58 C32 58 50 14 82 10 C114 6 128 58 128 58`} fill={`url(#hat-${size})`}/>
      <rect x="26" y="54" width="108" height="10" rx="5" fill="#fff"/>
      <circle cx="86" cy="10" r="8" fill="#fff"/>
    </svg>
  );
}

// ─── Full Logo with Text ───
function SantaLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#c0392b,#e74c3c)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(192,57,43,.2)" }}>
        <SantaIcon size={28} />
      </div>
      <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20, color: dark ? "#fff" : "#c0392b", lineHeight: 1.1 }}>
        My Secret<br />
        <span style={{ color: dark ? "#fff" : "#1a1a1a", fontSize: 20 }}>Santa</span>
      </div>
    </div>
  );
}

export default function Landing() {
  const router = useRouter();
  const snowRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sw = snowRef.current;
    if (sw && sw.children.length === 0) {
      for (let i = 0; i < 35; i++) {
        const s = document.createElement("div");
        const sz = 2 + Math.random() * 3;
        s.style.cssText = `position:absolute;background:#fff;border-radius:50%;width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;animation:fall ${6 + Math.random() * 12}s linear infinite;animation-delay:${Math.random() * 8}s;opacity:${0.2 + Math.random() * 0.3};`;
        sw.appendChild(s);
      }
    }
    return () => { if (sw) sw.innerHTML = ""; };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) (e.target as HTMLElement).style.animationPlayState = "running";
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".fade-up").forEach((el) => {
      (el as HTMLElement).style.animationPlayState = "paused";
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Fredoka:wght@400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        :root{--red:#c0392b;--red-light:#e74c3c;--red-dark:#922b21;--green:#1a6b2a;--green-light:#22c55e;--gold:#f59e0b;--gold-light:#fbbf24;--cream:#fdfbf7;--navy:#0f1f3d;}
        html{scroll-behavior:smooth;}
        body{font-family:'Nunito',sans-serif;color:#1f2937;overflow-x:hidden;background:var(--cream);}

        @keyframes fall{0%{transform:translateY(-10px) translateX(0) rotate(0);opacity:.7;}50%{transform:translateY(50vh) translateX(20px) rotate(180deg);}100%{transform:translateY(105vh) translateX(-10px) rotate(360deg);opacity:.1;}}
        @keyframes float{0%,100%{transform:translateY(0) rotate(0);}50%{transform:translateY(-20px) rotate(10deg);}}
        @keyframes fadeUp{to{opacity:1;transform:translateY(0);}}

        .snow-wrap{position:fixed;inset:0;pointer-events:none;z-index:999;overflow:hidden;}

        nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:14px 0;transition:all .3s;}
        nav.scrolled{background:rgba(255,255,255,.92);backdrop-filter:blur(16px);box-shadow:0 2px 20px rgba(0,0,0,.06);padding:10px 0;}
        .nav-inner{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;}
        .nav-links{display:flex;align-items:center;gap:28px;}
        .nav-links a{font-size:14px;font-weight:700;color:#4b5563;text-decoration:none;transition:color .2s;cursor:pointer;}
        .nav-links a:hover{color:var(--red);}
        .nav-cta{background:var(--red) !important;color:#fff !important;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:700;box-shadow:0 4px 16px rgba(192,57,43,.25);transition:all .2s;}
        .nav-cta:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(192,57,43,.35);}

        .hero{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(170deg,#fdfbf7 0%,#fef3e2 25%,#fce7d0 50%,#f9d4b8 75%,#f0c5a0 100%);position:relative;overflow:hidden;padding:120px 24px 80px;}
        .hero::before{content:'';position:absolute;top:-120px;right:-80px;width:500px;height:500px;background:radial-gradient(circle,rgba(192,57,43,.06) 0%,transparent 70%);border-radius:50%;}
        .hero::after{content:'';position:absolute;bottom:-100px;left:-60px;width:400px;height:400px;background:radial-gradient(circle,rgba(26,107,42,.06) 0%,transparent 70%);border-radius:50%;}
        .ornament{position:absolute;animation:float 6s ease-in-out infinite;opacity:.12;}
        .o1{top:15%;left:8%;font-size:32px;animation-delay:0s;}
        .o2{top:25%;right:12%;font-size:24px;animation-delay:1.2s;}
        .o3{bottom:20%;left:15%;font-size:28px;animation-delay:2.4s;}
        .o4{top:40%;right:6%;font-size:36px;animation-delay:3.6s;}
        .o5{bottom:30%;right:20%;font-size:20px;animation-delay:.8s;}
        .o6{top:60%;left:5%;font-size:26px;animation-delay:2s;}
        .hero-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:60px;position:relative;z-index:1;}
        .hero-text{flex:1;}
        .hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(192,57,43,.08);color:var(--red);padding:6px 16px;border-radius:20px;font-size:12px;font-weight:800;margin-bottom:20px;border:1px solid rgba(192,57,43,.1);}
        .hero-title{font-family:'Playfair Display',serif;font-size:56px;font-weight:900;line-height:1.1;color:#1a1a1a;margin-bottom:20px;}
        .hero-title span{background:linear-gradient(135deg,var(--red),var(--red-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .hero-desc{font-size:18px;color:#6b7280;line-height:1.7;margin-bottom:32px;max-width:480px;}
        .hero-buttons{display:flex;gap:14px;flex-wrap:wrap;}
        .btn-primary{background:linear-gradient(135deg,var(--red),var(--red-light));color:#fff;padding:16px 36px;border-radius:14px;font-size:16px;font-weight:800;border:none;cursor:pointer;font-family:inherit;box-shadow:0 6px 24px rgba(192,57,43,.3);transition:all .25s;display:inline-flex;align-items:center;gap:8px;}
        .btn-primary:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(192,57,43,.4);}
        .btn-secondary{background:rgba(26,107,42,.06);color:var(--green);padding:16px 36px;border-radius:14px;font-size:16px;font-weight:800;border:2px solid rgba(26,107,42,.12);cursor:pointer;font-family:inherit;transition:all .25s;text-decoration:none;display:inline-flex;align-items:center;gap:8px;}
        .btn-secondary:hover{background:rgba(26,107,42,.1);transform:translateY(-2px);}
        .hero-stats{display:flex;gap:32px;margin-top:36px;}
        .hero-stat-num{font-family:'Fredoka',sans-serif;font-size:28px;font-weight:700;color:var(--red);}
        .hero-stat-label{font-size:12px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}

        .hero-visual{flex:1;display:flex;align-items:center;justify-content:center;position:relative;}
        .hero-card-stack{position:relative;width:360px;height:400px;}
        .hero-float-card{position:absolute;border-radius:20px;box-shadow:0 12px 40px rgba(0,0,0,.08);transition:all .4s;overflow:hidden;}
        .hero-float-card:hover{transform:translateY(-8px) rotate(0deg) !important;}
        .hc1{top:0;left:20px;width:300px;background:linear-gradient(135deg,var(--red),var(--red-light));padding:24px;color:#fff;transform:rotate(-3deg);z-index:3;}
        .hc1-title{font-family:'Fredoka',sans-serif;font-size:20px;font-weight:700;margin-bottom:8px;}
        .hc1-desc{font-size:13px;opacity:.85;margin-bottom:16px;}
        .hc1-members{display:flex;}
        .hc1-avatar{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:14px;margin-left:-6px;border:2px solid rgba(255,255,255,.4);}
        .hc1-avatar:first-child{margin-left:0;}
        .hc2{top:120px;right:0;width:260px;background:linear-gradient(135deg,var(--gold-light),var(--gold));padding:20px;color:#fff;transform:rotate(4deg);z-index:2;}
        .hc2-label{font-size:11px;opacity:.8;font-weight:700;}
        .hc2-name{font-family:'Fredoka',sans-serif;font-size:22px;font-weight:700;margin-top:4px;}
        .hc2-secret{font-size:11px;opacity:.7;margin-top:6px;}
        .hc3{bottom:0;left:10px;width:280px;background:#fff;padding:20px;transform:rotate(-2deg);z-index:1;}
        .hc3-header{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
        .hc3-icon{width:36px;height:36px;border-radius:10px;background:rgba(34,197,94,.1);display:flex;align-items:center;justify-content:center;font-size:16px;}
        .hc3-title{font-size:14px;font-weight:800;color:#1f2937;}
        .hc3-sub{font-size:11px;color:#9ca3af;}
        .hc3-item{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#374151;padding:6px 0;border-bottom:1px solid #f3f4f6;}
        .hc3-item:last-child{border:none;}

        .how-section{padding:100px 24px;background:linear-gradient(180deg,#fff,var(--cream));}
        .section-label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.15em;color:var(--red);text-align:center;margin-bottom:8px;}
        .section-title{font-family:'Playfair Display',serif;font-size:40px;font-weight:900;text-align:center;color:#1a1a1a;margin-bottom:12px;}
        .section-desc{font-size:16px;color:#6b7280;text-align:center;max-width:520px;margin:0 auto 60px;line-height:1.6;}
        .steps{max-width:900px;margin:0 auto;display:flex;gap:32px;}
        .step{flex:1;text-align:center;padding:32px 24px;background:#fff;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.04);transition:all .3s;position:relative;}
        .step:hover{transform:translateY(-6px);box-shadow:0 12px 40px rgba(0,0,0,.08);}
        .step-num{position:absolute;top:-16px;left:50%;transform:translateX(-50%);width:36px;height:36px;border-radius:50%;font-family:'Fredoka',sans-serif;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff;}
        .step-num-1{background:var(--red);}
        .step-num-2{background:var(--green);}
        .step-num-3{background:var(--gold);}
        .step-icon{font-size:48px;margin:16px 0 16px;}
        .step-title{font-family:'Fredoka',sans-serif;font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:8px;}
        .step-desc{font-size:14px;color:#6b7280;line-height:1.6;}
        .step-arrow{display:flex;align-items:center;justify-content:center;font-size:24px;color:#d1d5db;flex-shrink:0;margin-top:40px;}

        .features-section{padding:100px 24px;background:linear-gradient(180deg,var(--cream),#f0e8dc);}
        .features-grid{max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .feature-card{padding:28px 24px;border-radius:18px;background:#fff;border:1px solid rgba(0,0,0,.04);box-shadow:0 2px 16px rgba(0,0,0,.03);transition:all .3s;}
        .feature-card:hover{transform:translateY(-4px);box-shadow:0 8px 32px rgba(0,0,0,.08);}
        .feature-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:16px;}
        .fi-red{background:rgba(192,57,43,.08);}.fi-green{background:rgba(26,107,42,.08);}.fi-gold{background:rgba(245,158,11,.08);}.fi-blue{background:rgba(37,99,235,.08);}.fi-purple{background:rgba(124,58,237,.08);}.fi-pink{background:rgba(219,39,119,.08);}
        .feature-title{font-family:'Fredoka',sans-serif;font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:6px;}
        .feature-desc{font-size:13px;color:#6b7280;line-height:1.6;}

        .testimonials-section{padding:100px 24px;background:linear-gradient(180deg,#f0e8dc,var(--cream));}
        .testimonials-grid{max-width:900px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .testimonial{background:#fff;border-radius:18px;padding:28px 24px;box-shadow:0 2px 16px rgba(0,0,0,.03);border:1px solid rgba(0,0,0,.04);}
        .testimonial-stars{font-size:14px;letter-spacing:2px;margin-bottom:12px;}
        .testimonial-text{font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px;font-style:italic;}
        .testimonial-author{display:flex;align-items:center;gap:10px;}
        .testimonial-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;}
        .ta-red{background:linear-gradient(135deg,var(--red),var(--red-light));}.ta-green{background:linear-gradient(135deg,var(--green),var(--green-light));}.ta-gold{background:linear-gradient(135deg,var(--gold),var(--gold-light));}
        .testimonial-name{font-size:13px;font-weight:800;color:#1f2937;}
        .testimonial-role{font-size:11px;color:#9ca3af;}

        .cta-section{padding:100px 24px;background:linear-gradient(135deg,var(--red-dark),var(--red),var(--red-light));text-align:center;position:relative;overflow:hidden;}
        .cta-section::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='3' cy='3' r='.5' fill='rgba(255,255,255,0.04)'/%3E%3C/svg%3E");}
        .cta-inner{position:relative;z-index:1;}
        .cta-title{font-family:'Playfair Display',serif;font-size:42px;font-weight:900;color:#fff;margin-bottom:12px;text-shadow:0 2px 8px rgba(0,0,0,.15);}
        .cta-desc{font-size:18px;color:rgba(255,255,255,.8);max-width:460px;margin:0 auto 36px;line-height:1.6;}
        .btn-cta{background:#fff;color:var(--red);padding:18px 44px;border-radius:14px;font-size:18px;font-weight:800;border:none;cursor:pointer;font-family:inherit;box-shadow:0 6px 24px rgba(0,0,0,.15);transition:all .25s;display:inline-flex;align-items:center;gap:8px;}
        .btn-cta:hover{transform:translateY(-3px);box-shadow:0 10px 40px rgba(0,0,0,.2);}
        .cta-note{font-size:13px;color:rgba(255,255,255,.5);margin-top:16px;}

        .app-section{padding:80px 24px;background:var(--navy);text-align:center;position:relative;overflow:hidden;}
        .app-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at top,rgba(255,255,255,.03),transparent 60%);}
        .app-inner{position:relative;z-index:1;max-width:600px;margin:0 auto;}
        .app-title{font-family:'Playfair Display',serif;font-size:30px;font-weight:900;color:#fff;margin-bottom:8px;}
        .app-title span{color:var(--gold-light);}
        .app-desc{font-size:15px;color:rgba(255,255,255,.5);margin-bottom:32px;line-height:1.6;}
        .app-badges{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
        .app-badge{display:inline-flex;align-items:center;gap:12px;background:#000;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:12px 28px;color:#fff;text-decoration:none;transition:all .25s;cursor:pointer;}
        .app-badge:hover{background:#1a1a1a;transform:translateY(-2px);border-color:rgba(255,255,255,.4);}
        .app-badge-text{text-align:left;}
        .app-badge-small{font-size:10px;color:rgba(255,255,255,.5);font-weight:600;display:block;}
        .app-badge-big{font-size:16px;font-weight:800;display:block;margin-top:1px;}
        .app-coming{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:rgba(255,255,255,.3);background:rgba(255,255,255,.04);padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.06);}

        footer{padding:60px 24px 40px;background:var(--navy);color:rgba(255,255,255,.6);font-size:13px;border-top:1px solid rgba(255,255,255,.06);}
        .footer-inner{max-width:1000px;margin:0 auto;display:flex;justify-content:space-between;align-items:flex-start;gap:40px;flex-wrap:wrap;}
        .footer-brand{max-width:280px;}
        .footer-brand-desc{font-size:13px;line-height:1.6;color:rgba(255,255,255,.4);margin-top:12px;}
        .footer-col h4{font-size:13px;font-weight:800;color:#fff;margin-bottom:12px;text-transform:uppercase;letter-spacing:.08em;}
        .footer-col a{display:block;font-size:13px;color:rgba(255,255,255,.4);text-decoration:none;padding:4px 0;transition:color .2s;cursor:pointer;}
        .footer-col a:hover{color:#fff;}
        .footer-bottom{max-width:1000px;margin:32px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,.06);text-align:center;font-size:12px;color:rgba(255,255,255,.25);}

        .fade-up{opacity:0;transform:translateY(24px);animation:fadeUp .7s ease forwards;}
        .d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.3s}
        .d4{animation-delay:.4s}.d5{animation-delay:.5s}

        @media(max-width:768px){
          .hero-inner{flex-direction:column;text-align:center;}
          .hero-title{font-size:38px;}
          .hero-desc{margin:0 auto 24px;}
          .hero-buttons{justify-content:center;}
          .hero-stats{justify-content:center;}
          .hero-visual{display:none;}
          .steps{flex-direction:column;}
          .step-arrow{display:none;}
          .features-grid{grid-template-columns:1fr;}
          .testimonials-grid{grid-template-columns:1fr;}
          .nav-links a:not(.nav-cta){display:none;}
          .footer-inner{flex-direction:column;align-items:center;text-align:center;}
          .section-title{font-size:30px;}
          .cta-title{font-size:30px;}
          .app-title{font-size:24px;}
        }
      `}</style>

      <div ref={snowRef} className="snow-wrap" />

      {/* Nav */}
      <nav ref={navRef}>
        <div className="nav-inner">
          <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <SantaLogo />
          </div>
          <div className="nav-links">
            <a href="#how">How it Works</a>
            <a href="#features">Features</a>
            <a href="#testimonials">Reviews</a>
            <a className="nav-cta" onClick={() => router.push("/login")}>Get Started — It&apos;s Free</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="ornament o1">🎄</div>
        <div className="ornament o2">⭐</div>
        <div className="ornament o3">🎁</div>
        <div className="ornament o4">❄️</div>
        <div className="ornament o5">🔔</div>
        <div className="ornament o6">🎅</div>

        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-badge fade-up d1">🎅 Free Secret Santa Organizer — Used Worldwide</div>
            <h1 className="hero-title fade-up d2">
              Make Gift Giving<br /><span>Magical Again</span>
            </h1>
            <p className="hero-desc fade-up d3">
              Draw names online, share wishlists, and chat anonymously with your Secret Santa match. Perfect for office parties, family gatherings, and friend group exchanges.
            </p>
            <div className="hero-buttons fade-up d4">
              <button className="btn-primary" onClick={() => router.push("/login")}>Start Drawing Names 🎲</button>
              <a className="btn-secondary" href="#how">See How it Works</a>
            </div>
            <div className="hero-stats fade-up d5">
              <div><div className="hero-stat-num">100%</div><div className="hero-stat-label">Free Forever</div></div>
              <div><div className="hero-stat-num">3 min</div><div className="hero-stat-label">Setup Time</div></div>
              <div><div className="hero-stat-num">🔒</div><div className="hero-stat-label">Fully Private</div></div>
            </div>
          </div>

          <div className="hero-visual fade-up d5">
            <div className="hero-card-stack">
              <div className="hero-float-card hc1">
                <div className="hc1-title">🎄 Office Holiday Party</div>
                <div className="hc1-desc">Budget: $25 · Dec 20</div>
                <div className="hc1-members">
                  <div className="hc1-avatar">R</div>
                  <div className="hc1-avatar">K</div>
                  <div className="hc1-avatar">J</div>
                  <div className="hc1-avatar">A</div>
                  <div className="hc1-avatar">+3</div>
                </div>
              </div>
              <div className="hero-float-card hc2">
                <div className="hc2-label">🎁 You are giving a gift to:</div>
                <div className="hc2-name">🎄 kate 🎄</div>
                <div className="hc2-secret">Only you can see this!</div>
              </div>
              <div className="hero-float-card hc3">
                <div className="hc3-header">
                  <div className="hc3-icon">📝</div>
                  <div><div className="hc3-title">kate&apos;s Wishlist</div><div className="hc3-sub">3 items</div></div>
                </div>
                <div className="hc3-item"><span>⭐</span> AirPods Pro</div>
                <div className="hc3-item"><span>🎁</span> Scented candles</div>
                <div className="hc3-item"><span>🎁</span> Starbucks tumbler</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-section" id="how">
        <div className="section-label fade-up">How It Works</div>
        <div className="section-title fade-up d1">Three Steps to Christmas Magic</div>
        <div className="section-desc fade-up d2">No slips of paper, no awkward drawing from a hat. Just create, invite, and let the magic happen.</div>
        <div className="steps">
          <div className="step fade-up d3">
            <div className="step-num step-num-1">1</div>
            <div className="step-icon">📋</div>
            <div className="step-title">Create a Group</div>
            <div className="step-desc">Set a group name, budget, and event date. Add your friends, family, or coworkers by email.</div>
          </div>
          <div className="step-arrow fade-up d3">→</div>
          <div className="step fade-up d4">
            <div className="step-num step-num-2">2</div>
            <div className="step-icon">🎲</div>
            <div className="step-title">Draw Names</div>
            <div className="step-desc">One click to randomly assign givers. No one draws themselves. Everyone gets their secret match instantly.</div>
          </div>
          <div className="step-arrow fade-up d4">→</div>
          <div className="step fade-up d5">
            <div className="step-num step-num-3">3</div>
            <div className="step-icon">🎁</div>
            <div className="step-title">Exchange Gifts</div>
            <div className="step-desc">Check your match&apos;s wishlist, chat anonymously, and surprise them at the party. Pure holiday joy!</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features">
        <div className="section-label fade-up">Features</div>
        <div className="section-title fade-up d1">Everything You Need for the Perfect Exchange</div>
        <div className="section-desc fade-up d2">Every feature designed to make your gift exchange effortless and fun.</div>
        <div className="features-grid">
          <div className="feature-card fade-up d3"><div className="feature-icon fi-red">🎲</div><div className="feature-title">Fair Random Draw</div><div className="feature-desc">Our algorithm ensures no one draws themselves and no two people get each other. Guaranteed fair every time.</div></div>
          <div className="feature-card fade-up d3"><div className="feature-icon fi-green">📝</div><div className="feature-title">Wishlists</div><div className="feature-desc">Add gift ideas with links and notes. Your Secret Santa sees exactly what you want — no more guessing.</div></div>
          <div className="feature-card fade-up d4"><div className="feature-icon fi-gold">💬</div><div className="feature-title">Anonymous Chat</div><div className="feature-desc">Chat with your match without revealing your identity. Ask about sizes, preferences, and drop hints.</div></div>
          <div className="feature-card fade-up d4"><div className="feature-icon fi-blue">🔒</div><div className="feature-title">Privacy First</div><div className="feature-desc">End-to-end privacy. No one sees who drew who. Your Secret Santa identity stays hidden until the reveal.</div></div>
          <div className="feature-card fade-up d5"><div className="feature-icon fi-purple">⚡</div><div className="feature-title">Real-Time Updates</div><div className="feature-desc">See instant updates when members accept, wishlists change, or new messages arrive. No refreshing needed.</div></div>
          <div className="feature-card fade-up d5"><div className="feature-icon fi-pink">👥</div><div className="feature-title">Multiple Groups</div><div className="feature-desc">Manage office party, family Christmas, and friend group exchanges all in one dashboard. No limits.</div></div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section" id="testimonials">
        <div className="section-label fade-up">What People Say</div>
        <div className="section-title fade-up d1">Loved by Gift Givers Everywhere</div>
        <div className="section-desc fade-up d2">Join people around the world making their gift exchanges magical.</div>
        <div className="testimonials-grid">
          <div className="testimonial fade-up d3">
            <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
            <div className="testimonial-text">&quot;We used My Secret Santa for our office party and it was so smooth! The anonymous chat was hilarious — my Secret Santa kept asking if I like cats. I got a cat mug. 10/10.&quot;</div>
            <div className="testimonial-author"><div className="testimonial-avatar ta-red">E</div><div><div className="testimonial-name">Emma T.</div><div className="testimonial-role">Office Manager</div></div></div>
          </div>
          <div className="testimonial fade-up d4">
            <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
            <div className="testimonial-text">&quot;Our family is spread across different cities. My Secret Santa let us do the exchange online — everyone added their wishlists, no one knew who drew who. Christmas morning was pure joy.&quot;</div>
            <div className="testimonial-author"><div className="testimonial-avatar ta-green">D</div><div><div className="testimonial-name">David L.</div><div className="testimonial-role">Family Organizer</div></div></div>
          </div>
          <div className="testimonial fade-up d5">
            <div className="testimonial-stars">⭐⭐⭐⭐⭐</div>
            <div className="testimonial-text">&quot;Drawing names from a hat is so outdated. My Secret Santa is super fast to set up, and the wishlist feature saved me from buying another generic gift card. Highly recommend!&quot;</div>
            <div className="testimonial-author"><div className="testimonial-avatar ta-gold">S</div><div><div className="testimonial-name">Sarah K.</div><div className="testimonial-role">College Student</div></div></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <div className="fade-up" style={{ marginBottom: 16 }}>
            <div style={{ display: "inline-flex", background: "rgba(255,255,255,.1)", borderRadius: 20, padding: 12 }}>
              <SantaIcon size={60} />
            </div>
          </div>
          <div className="cta-title fade-up d1">Ready to Start Your<br />Secret Santa?</div>
          <div className="cta-desc fade-up d2">Create your group in under 3 minutes. It&apos;s completely free — no catches, no ads, no limits.</div>
          <button className="btn-cta fade-up d3" onClick={() => router.push("/login")}>🎅 Start Drawing Names — It&apos;s Free</button>
          <div className="cta-note fade-up d4">No credit card needed. No sign-up required to join a group.</div>
        </div>
      </section>

      {/* App Download */}
      <section className="app-section">
        <div className="app-inner">
          <div className="fade-up" style={{ marginBottom: 16 }}>
            <div style={{ display: "inline-flex", width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg,#c0392b,#e74c3c)", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(192,57,43,.3)" }}>
              <SantaIcon size={52} />
            </div>
          </div>
          <div className="app-title fade-up d1">The <span>My Secret Santa</span> App<br />for iPhone and Android.</div>
          <div className="app-desc fade-up d2">Take your Secret Santa on the go. Get instant notifications, chat in real-time, and manage your wishlists from anywhere.</div>
          <div className="app-badges fade-up d3">
            <a className="app-badge" href="#" onClick={(e) => e.preventDefault()}>
              <svg width="24" height="28" viewBox="0 0 24 28" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M19.665 14.748c-.03-3.12 2.544-4.62 2.66-4.692-1.45-2.118-3.706-2.408-4.51-2.44-1.918-.196-3.744 1.13-4.718 1.13-.974 0-2.48-1.1-4.076-1.072-2.098.03-4.032 1.22-5.112 3.1-2.18 3.78-.558 9.378 1.566 12.442 1.038 1.502 2.276 3.19 3.902 3.13 1.564-.064 2.156-1.012 4.048-1.012 1.892 0 2.422 1.012 4.076.98 1.684-.03 2.754-1.53 3.786-3.038 1.194-1.742 1.686-3.428 1.716-3.516-.038-.016-3.292-1.264-3.338-5.012zM16.547 5.368c.862-1.046 1.444-2.498 1.286-3.948-1.242.05-2.748.828-3.64 1.872-.8.926-1.5 2.404-1.312 3.824 1.386.108 2.802-.706 3.666-1.748z"/></svg>
              <div className="app-badge-text"><span className="app-badge-small">Download on the</span><span className="app-badge-big">App Store</span></div>
            </a>
            <a className="app-badge" href="#" onClick={(e) => e.preventDefault()}>
              <svg width="24" height="26" viewBox="0 0 505 584" xmlns="http://www.w3.org/2000/svg"><path fill="#EA4335" d="M18.5 28.5L259 292 18.5 555.5c-12-12.7-18-30-18-52V80.5c0-22 6-39.3 18-52z"/><path fill="#FBBC04" d="M287 320l72.5 72.5L46 570.5c-9.3 5.3-19 8-28.5 8L259 292l28 28z"/><path fill="#34A853" d="M359.5 392.5L455 339c20.7-12 31-27 31-47s-10.3-35-31-47l-95.5-53.5L287 264l72.5 128.5z"/><path fill="#4285F4" d="M46 13.5l313 178.5L287 264 17.5 28.5c9.3-10 20-15 28.5-15z"/></svg>
              <div className="app-badge-text"><span className="app-badge-small">GET IT ON</span><span className="app-badge-big">Google Play</span></div>
            </a>
          </div>
          <div className="app-coming fade-up d4">🚀 Coming Soon — Join the waitlist!</div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <SantaLogo dark />
            <div className="footer-brand-desc">The easiest way to organize Secret Santa gift exchanges online. Made with ❤️ for gift givers everywhere.</div>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#how">How it Works</a>
            <a href="#features">Features</a>
            <a href="#testimonials">Reviews</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="#">Secret Santa Rules</a>
            <a href="#">Gift Exchange Guide</a>
            <a href="#">White Elephant Ideas</a>
          </div>
          <div className="footer-col">
            <h4>Connect</h4>
            <a href="#">Facebook</a>
            <a href="#">Instagram</a>
            <a href="#">Contact Us</a>
          </div>
        </div>
        <div className="footer-bottom">© 2026 My Secret Santa. All rights reserved. 🎄 Merry Christmas!</div>
      </footer>
    </>
  );
}