<script lang="ts">
  import {
    ArrowRight, Bot, Globe, Users, Link2, BarChart3,
    Zap, PieChart, Activity, Search, Sparkles
  } from 'lucide-svelte';

  const features = [
    { icon: Bot,       title: 'AI Portfolio Copilot',    copy: 'Ask plain-language questions about your holdings, risk, and P&L. Powered by Claude & GPT.',                         color: 'purple' },
    { icon: Globe,     title: 'Global Market Status',    copy: 'Live open/closed status for US, HK, Shanghai, and Shenzhen markets with major index prices.',                       color: 'blue'   },
    { icon: Users,     title: 'Insider Transactions',    copy: 'Track SEC Form 4 filings — see when executives buy or sell their own company shares.',                             color: 'green'  },
    { icon: Search,    title: 'Peer Research',           copy: 'Discover comparable companies in the same industry with market cap and profile data.',                             color: 'teal'   },
    { icon: Activity,  title: 'Capital Flow Analysis',   copy: 'Monitor super, big, mid, and small money flow in real time via Moomoo OpenD bridge.',                             color: 'orange' },
    { icon: BarChart3, title: 'Sector Analytics',        copy: 'Visualize exposure across sectors, screen stocks by plate, and spot concentration risk.',                         color: 'blue'   },
    { icon: PieChart,  title: 'Portfolio Tracking',      copy: 'Track holdings, unrealized P&L, allocation drift, and snapshots over time.',                                      color: 'purple' },
    { icon: Link2,     title: 'Broker Sync',             copy: 'Import positions and transactions directly from Moomoo via the OpenD bridge service.',                            color: 'green'  },
  ];

  const steps = [
    { n: '01', title: 'Connect your broker',    body: 'Run the Moomoo OpenD bridge. PortfolioAI pulls your live positions, cash flow, and order history automatically.' },
    { n: '02', title: 'Explore the markets',    body: 'Check global market status, insider activity, and peer companies. All powered by free data sources.' },
    { n: '03', title: 'Let AI do the analysis', body: 'Ask the AI Copilot anything about your portfolio. Get risk summaries, trim candidates, and plain-language insights.' },
  ];

  const markets = [
    { flag: '🇺🇸', name: 'United States', short: 'NYSE / NASDAQ', status: 'open',   time: '10:32 AM' },
    { flag: '🇭🇰', name: 'Hong Kong',     short: 'HKEX',         status: 'closed', time: '11:45 PM' },
    { flag: '🇨🇳', name: 'Shanghai',      short: 'SSE',          status: 'closed', time: '11:45 PM' },
    { flag: '🇨🇳', name: 'Shenzhen',      short: 'SZSE',         status: 'closed', time: '11:45 PM' },
  ];

  const insiders = [
    { name: 'Jensen Huang',  ticker: 'NVDA', type: 'P', value: '$42.1M', date: 'May 12' },
    { name: 'Tim Cook',      ticker: 'AAPL', type: 'S', value: '$89.4M', date: 'May 10' },
    { name: 'Satya Nadella', ticker: 'MSFT', type: 'P', value: '$18.2M', date: 'May 08' },
  ];
</script>

<div class="lp">

  <!-- NAV -->
  <nav class="nav">
    <div class="nav-inner">
      <a href="/" class="nav-logo">
        <span class="logo-mark">◈</span>
        <span class="logo-name">PortfolioAI</span>
      </a>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#ai">AI Tools</a>
        <a href="#options">Options</a>
        <a href="#compare">Compare</a>
        <a href="#how">How it works</a>
        <a href="/dashboard">Demo</a>
      </div>
      <a href="/dashboard" class="btn-primary btn-sm">
        Launch App <ArrowRight size={13} />
      </a>
    </div>
  </nav>

  <!-- MARKET PULSE -->
  <div class="pulse-bar">
    <div class="pulse-inner">
      <span class="pulse-label">LIVE MARKET PULSE</span>
      <span class="pulse-sep">·</span>
      <span class="pulse-item"><span class="pulse-ticker">SPY</span> <span class="pulse-up">+0.82%</span></span>
      <span class="pulse-sep">·</span>
      <span class="pulse-item"><span class="pulse-ticker">QQQ</span> <span class="pulse-up">+1.14%</span></span>
      <span class="pulse-sep">·</span>
      <span class="pulse-item"><span class="pulse-ticker">VIX</span> <span class="pulse-neutral">18.2</span></span>
      <span class="pulse-sep">·</span>
      <span class="pulse-item"><span class="pulse-ticker">Fear &amp; Greed</span> <span class="pulse-neutral">Neutral</span></span>
      <span class="pulse-sep">·</span>
      <span class="pulse-item">REGIME: <span class="pulse-regime">RISK-ON</span></span>
    </div>
  </div>

  <!-- HERO -->
  <section class="hero">
    <div class="container">
      <div class="hero-grid">

        <!-- copy -->
        <div class="hero-copy">
          <div class="badge">
            <Sparkles size={13} />
            AI-native investing workspace
          </div>
          <h1>
            Your portfolio.<br />
            <span class="grad">Smarter decisions.</span>
          </h1>
          <p class="hero-sub">
            Real-time market intelligence, insider transaction alerts, AI portfolio analysis,
            and broker sync — in one clean dashboard.
          </p>
          <div class="hero-btns">
            <a href="/dashboard" class="btn-primary btn-lg">Open Dashboard <ArrowRight size={16} /></a>
            <a href="#features" class="btn-outline btn-lg">See features</a>
          </div>
          <div class="powered">
            <span>Powered by</span>
            <span class="pw-tag">Moomoo OpenD</span>
            <span class="pw-sep">·</span>
            <span class="pw-tag">Finnhub</span>
            <span class="pw-sep">·</span>
            <span class="pw-tag">Claude AI</span>
          </div>
        </div>

        <!-- preview panels -->
        <div class="hero-preview">

          <!-- markets panel -->
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">Global Markets</span>
              <span class="live-pill"><span class="live-dot"></span>Live</span>
            </div>
            <div class="mkt-list">
              {#each markets as m}
                <div class="mkt-row">
                  <span class="mkt-flag">{m.flag}</span>
                  <div class="mkt-info">
                    <span class="mkt-name">{m.name}</span>
                    <span class="mkt-short">{m.short}</span>
                  </div>
                  <div class="mkt-right">
                    <span class="sdot sdot-{m.status}"></span>
                    <span class="mkt-time">{m.time}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- insider panel -->
          <div class="panel">
            <div class="panel-head">
              <span class="panel-title">Insider Transactions</span>
              <span class="tag-pill">SEC Form 4</span>
            </div>
            <div class="tx-list">
              {#each insiders as tx}
                <div class="tx-row">
                  <div class="tx-left">
                    <span class="tx-name">{tx.name}</span>
                    <span class="tx-ticker">{tx.ticker}</span>
                  </div>
                  <div class="tx-right">
                    <span class="tx-badge {tx.type === 'P' ? 'buy' : 'sell'}">{tx.type === 'P' ? 'Purchase' : 'Sale'}</span>
                    <span class="tx-val">{tx.value}</span>
                    <span class="tx-date">{tx.date}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- stats row -->
          <div class="stats-row">
            <div class="stat-box">
              <span class="stat-lbl">Portfolio Value</span>
              <span class="stat-val">$128,420</span>
              <span class="stat-chg up">+12.8% YTD</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">AI Risk Score</span>
              <span class="stat-val">64 / 100</span>
              <span class="stat-chg warn">Moderate</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Div Income</span>
              <span class="stat-val">$842/mo</span>
              <span class="stat-chg up">+8.4% YoY</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section id="features" class="section">
    <div class="container">
      <div class="sec-head">
        <h2>Everything you need to invest with clarity</h2>
        <p>From live market data to AI-powered analysis — all in one workspace.</p>
      </div>
      <div class="feat-grid">
        {#each features as f}
          <div class="feat-card c-{f.color}">
            <div class="feat-ico ico-{f.color}">
              <svelte:component this={f.icon} size={18} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.copy}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section id="how" class="section section-alt">
    <div class="container">
      <div class="sec-head">
        <h2>Simple setup. Powerful results.</h2>
        <p>Get from zero to full portfolio intelligence in minutes.</p>
      </div>
      <div class="steps-grid">
        {#each steps as s}
          <div class="step-card">
            <div class="step-n">{s.n}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="section">
    <div class="container">
      <div class="cta-box">
        <div class="cta-glow"></div>
        <div class="cta-ico"><Zap size={26} /></div>
        <h2>Ready to see your portfolio differently?</h2>
        <p>Open the dashboard and start exploring your data with AI.</p>
        <a href="/dashboard" class="btn-primary btn-lg">Open Dashboard <ArrowRight size={17} /></a>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="footer">
    <div class="container">
      <div class="footer-logo">
        <span class="logo-mark">◈</span>
        <span class="logo-name">PortfolioAI</span>
      </div>
      <p class="footer-copy">AI-assisted investing workspace for research and portfolio planning.</p>
      <p class="footer-legal">© 2026 PortfolioAI. Data provided for informational purposes only. Not financial advice.</p>
    </div>
  </footer>

</div>

<style>
  /* ─────────────────────────────────────────
     Container & base
  ───────────────────────────────────────── */
  .lp {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
  }

  .container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* ─────────────────────────────────────────
     Nav
  ───────────────────────────────────────── */
  .nav {
    position: sticky; top: 0; z-index: 50;
    border-bottom: 1px solid var(--overlay-border);
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
  }

  .nav-inner {
    max-width: 1180px; margin: 0 auto;
    padding: 0 20px; height: 58px;
    display: flex; align-items: center; gap: 28px;
  }

  .nav-logo {
    display: flex; align-items: center; gap: 7px;
    text-decoration: none; font-weight: 700; font-size: 0.92rem;
    color: var(--text); flex-shrink: 0;
  }
  .logo-mark { font-size: 1.05rem; color: var(--primary); font-weight: 900; }
  .nav-links {
    display: flex; gap: 22px; flex: 1;
  }
  .nav-links a {
    font-size: 0.82rem; font-weight: 500; color: var(--muted);
    text-decoration: none; transition: color 0.15s;
  }
  .nav-links a:hover { color: var(--text); }

  /* ─────────────────────────────────────────
     Market Pulse bar
  ───────────────────────────────────────── */
  .pulse-bar {
    background: rgba(var(--success-rgb), 0.06);
    border-bottom: 1px solid rgba(var(--success-rgb), 0.15);
    overflow: hidden;
  }
  .pulse-inner {
    max-width: 1180px; margin: 0 auto;
    padding: 7px 20px;
    display: flex; align-items: center; gap: 8px; flex-wrap: nowrap;
    overflow-x: auto; scrollbar-width: none;
    font-size: 0.68rem; font-weight: 600;
    white-space: nowrap;
  }
  .pulse-inner::-webkit-scrollbar { display: none; }
  .pulse-label {
    color: var(--muted); font-weight: 700; letter-spacing: 0.05em; font-size: 0.62rem;
  }
  .pulse-sep { color: var(--border); }
  .pulse-item { color: var(--muted); }
  .pulse-ticker { color: var(--text); font-weight: 700; margin-right: 3px; }
  .pulse-up { color: var(--success); }
  .pulse-neutral { color: var(--muted); }
  .pulse-regime {
    color: var(--success); font-weight: 800; letter-spacing: 0.04em;
  }

  /* ─────────────────────────────────────────
     Buttons
  ───────────────────────────────────────── */
  .btn-primary {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px;
    background: var(--primary); color: #fff;
    font-size: 0.84rem; font-weight: 700;
    text-decoration: none; border: none; cursor: pointer;
    transition: opacity 0.15s; flex-shrink: 0;
  }
  .btn-primary:hover { opacity: 0.85; }
  .btn-sm  { padding: 6px 14px; font-size: 0.78rem; border-radius: 7px; }
  .btn-lg  { padding: 11px 22px; font-size: 0.9rem; border-radius: 10px; }

  .btn-outline {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 18px; border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--surface-1); color: var(--text);
    font-size: 0.84rem; font-weight: 600;
    text-decoration: none; transition: border-color 0.15s;
  }
  .btn-outline:hover { border-color: rgba(var(--primary-rgb), 0.5); }

  /* ─────────────────────────────────────────
     Hero
  ───────────────────────────────────────── */
  .hero {
    padding: 72px 0 64px;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 52px;
    align-items: center;
  }

  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 20px;
    border: 1px solid rgba(var(--primary-rgb), 0.25);
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--primary); font-size: 0.73rem; font-weight: 600;
    margin-bottom: 22px;
  }

  h1 {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800; line-height: 1.12;
    color: var(--text); margin: 0 0 18px;
  }

  .grad {
    background: linear-gradient(135deg, var(--primary), var(--success));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    /* fallback for browsers that don't support background-clip */
    color: var(--primary);
  }

  .hero-sub {
    font-size: 0.97rem; line-height: 1.7;
    color: var(--muted); margin: 0 0 28px; max-width: 460px;
  }

  .hero-btns {
    display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px;
  }

  .powered {
    display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    font-size: 0.7rem; color: var(--muted);
  }
  .pw-tag {
    padding: 2px 8px; border-radius: 4px;
    background: var(--surface-1); border: 1px solid var(--border);
    color: var(--muted); font-weight: 500;
  }
  .pw-sep { opacity: 0.35; }

  /* ─────────────────────────────────────────
     Hero preview
  ───────────────────────────────────────── */
  .hero-preview { display: flex; flex-direction: column; gap: 10px; }

  .panel {
    background: var(--card);
    border: 1px solid var(--overlay-border);
    border-radius: 14px; padding: 14px 16px;
  }

  .panel-head {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .panel-title { font-size: 0.74rem; font-weight: 700; color: var(--text); }

  .live-pill {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.63rem; font-weight: 600; color: var(--success);
  }
  .live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--success);
    animation: blink 2s infinite;
  }
  @keyframes blink {
    0%,100% { box-shadow: 0 0 0 2px rgba(var(--success-rgb),0.25); }
    50%      { box-shadow: 0 0 0 5px rgba(var(--success-rgb),0.0); }
  }

  .tag-pill {
    font-size: 0.6rem; font-weight: 700; padding: 2px 7px; border-radius: 4px;
    background: rgba(var(--primary-rgb), 0.10); color: var(--primary);
  }

  /* market rows */
  .mkt-list { display: flex; flex-direction: column; gap: 6px; }
  .mkt-row {
    display: flex; align-items: center; gap: 9px;
    padding: 6px 9px; border-radius: 8px;
    background: var(--surface-1);
  }
  .mkt-flag { font-size: 0.95rem; line-height: 1; }
  .mkt-info { flex: 1; min-width: 0; }
  .mkt-name  { display: block; font-size: 0.73rem; font-weight: 600; color: var(--text); }
  .mkt-short { font-size: 0.6rem; color: var(--muted); }
  .mkt-right { display: flex; align-items: center; gap: 5px; }
  .sdot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--border); flex-shrink: 0;
  }
  .sdot-open {
    background: var(--success);
    box-shadow: 0 0 0 3px rgba(var(--success-rgb), 0.2);
    animation: blink 2s infinite;
  }
  .mkt-time { font-size: 0.65rem; color: var(--muted); font-variant-numeric: tabular-nums; }

  /* insider rows */
  .tx-list { display: flex; flex-direction: column; gap: 6px; }
  .tx-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 9px; border-radius: 8px;
    background: var(--surface-1);
  }
  .tx-left { display: flex; flex-direction: column; gap: 1px; }
  .tx-name   { font-size: 0.72rem; font-weight: 600; color: var(--text); }
  .tx-ticker { font-size: 0.6rem; color: var(--muted); }
  .tx-right  { display: flex; align-items: center; gap: 7px; }
  .tx-badge {
    font-size: 0.6rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  }
  .tx-badge.buy  { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
  .tx-badge.sell { background: rgba(var(--danger-rgb),  0.12); color: var(--danger);  }
  .tx-val  { font-size: 0.7rem; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .tx-date { font-size: 0.6rem; color: var(--muted); }

  /* stats row */
  .stats-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  }
  .stat-box {
    background: var(--card); border: 1px solid var(--overlay-border);
    border-radius: 11px; padding: 11px 13px;
    display: flex; flex-direction: column; gap: 3px;
  }
  .stat-lbl { font-size: 0.6rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .stat-val  { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .stat-chg  { font-size: 0.63rem; font-weight: 600; }
  .stat-chg.up   { color: var(--success); }
  .stat-chg.warn { color: var(--warning); }

  /* ─────────────────────────────────────────
     Sections
  ───────────────────────────────────────── */
  .section { padding: 72px 0; }
  .section-alt {
    background: var(--surface-1);
    border-top: 1px solid var(--overlay-border);
    border-bottom: 1px solid var(--overlay-border);
  }

  .sec-head { max-width: 560px; margin-bottom: 40px; }
  .sec-head h2 { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 800; color: var(--text); margin: 0 0 10px; }
  .sec-head p  { font-size: 0.92rem; color: var(--muted); line-height: 1.6; margin: 0; }

  /* ─────────────────────────────────────────
     Features
  ───────────────────────────────────────── */
  .feat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }

  .feat-card {
    background: var(--card);
    border: 1px solid var(--overlay-border);
    border-radius: 13px; padding: 20px;
    display: flex; flex-direction: column; gap: 9px;
    transition: border-color 0.2s, transform 0.2s;
    cursor: default;
  }
  .feat-card:hover { transform: translateY(-2px); }
  .feat-card.c-purple:hover { border-color: rgba(var(--primary-rgb), 0.35); }
  .feat-card.c-green:hover  { border-color: rgba(var(--success-rgb), 0.35); }
  .feat-card.c-blue:hover   { border-color: rgba(99,179,237,0.3); }
  .feat-card.c-teal:hover   { border-color: rgba(var(--success-rgb), 0.25); }
  .feat-card.c-orange:hover { border-color: rgba(var(--warning-rgb), 0.3); }

  .feat-ico {
    width: 36px; height: 36px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ico-purple { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
  .ico-green  { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
  .ico-blue   { background: rgba(99,179,237,0.12);          color: #63b3ed; }
  .ico-teal   { background: rgba(var(--success-rgb), 0.10); color: #38b2ac; }
  .ico-orange { background: rgba(var(--warning-rgb), 0.12); color: var(--warning); }

  .feat-card h3 { font-size: 0.86rem; font-weight: 700; color: var(--text); margin: 0; }
  .feat-card p  { font-size: 0.76rem; color: var(--muted); line-height: 1.6; margin: 0; }

  /* ─────────────────────────────────────────
     Steps
  ───────────────────────────────────────── */
  .steps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
  .step-card {
    background: var(--card);
    border: 1px solid var(--overlay-border);
    border-radius: 13px; padding: 26px;
  }
  .step-n {
    font-size: 1.7rem; font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, var(--primary), var(--success));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    color: var(--primary); /* fallback */
    margin-bottom: 14px;
  }
  .step-card h3 { font-size: 0.98rem; font-weight: 700; color: var(--text); margin: 0 0 8px; }
  .step-card p  { font-size: 0.8rem; color: var(--muted); line-height: 1.65; margin: 0; }

  /* ─────────────────────────────────────────
     CTA box
  ───────────────────────────────────────── */
  .cta-box {
    max-width: 640px; margin: 0 auto;
    background: rgba(var(--primary-rgb), 0.06);
    border: 1px solid rgba(var(--primary-rgb), 0.2);
    border-radius: 18px; padding: 52px 40px;
    text-align: center; position: relative; overflow: hidden;
  }
  .cta-glow {
    position: absolute; top: -60px; left: 50%; transform: translateX(-50%);
    width: 280px; height: 180px;
    background: radial-gradient(ellipse, rgba(var(--primary-rgb), 0.15) 0%, transparent 70%);
    pointer-events: none;
  }
  .cta-ico {
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px; border-radius: 12px;
    background: rgba(var(--primary-rgb), 0.12); color: var(--primary);
    margin-bottom: 16px;
  }
  .cta-box h2 { font-size: clamp(1.3rem, 3vw, 1.75rem); font-weight: 800; color: var(--text); margin: 0 0 10px; }
  .cta-box p  { font-size: 0.88rem; color: var(--muted); margin: 0 0 26px; }

  /* ─────────────────────────────────────────
     Footer
  ───────────────────────────────────────── */
  .footer {
    border-top: 1px solid var(--overlay-border);
    padding: 36px 0;
    background: var(--surface-1);
    text-align: center;
  }
  .footer-logo {
    display: inline-flex; align-items: center; gap: 7px;
    font-weight: 700; font-size: 0.88rem; color: var(--text);
    margin-bottom: 8px;
  }
  .footer-copy  { font-size: 0.78rem; color: var(--muted); margin: 0 0 5px; }
  .footer-legal { font-size: 0.7rem; color: var(--muted); opacity: 0.5; margin: 0; }

  /* ─────────────────────────────────────────
     Responsive
  ───────────────────────────────────────── */
  @media (max-width: 860px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: 36px;
    }
    .hero { padding: 52px 0 48px; }
    .nav-links { display: none; }
    .stats-row { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 600px) {
    .container { padding: 0 16px; }
    .section { padding: 52px 0; }
    .hero { padding: 40px 0 36px; }
    .cta-box { padding: 36px 22px; }
    .stats-row { grid-template-columns: 1fr; }
    .feat-grid { grid-template-columns: 1fr; }
    .steps-grid { grid-template-columns: 1fr; }
    .hero-btns { flex-direction: column; }
    .btn-lg { width: 100%; justify-content: center; }
  }

  @media (max-width: 380px) {
    h1 { font-size: 1.75rem; }
  }
</style>
