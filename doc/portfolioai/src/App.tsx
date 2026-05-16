import { 
  TrendingUp, 
  PieChart, 
  LayoutDashboard, 
  Eye, 
  Zap, 
  Filter, 
  Calendar, 
  RotateCw, 
  Link2, 
  Settings, 
  LogOut,
  Bell,
  Search,
  User,
  ChevronRight,
  ChevronDown,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  BrainCircuit,
  Menu,
  X,
  Layout,
  Layers,
  CreditCard,
  CheckCircle2,
  HelpCircle,
  Mail,
  Github,
  Twitter,
  ArrowUpRight,
  Plus,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useLocation, 
  useNavigate,
  Navigate
} from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { cn } from './lib/utils';
import { fetchMultipleQuotes, StockData } from './services/stockService';
import TradingViewChart from './components/TradingViewChart';

// --- MOCK DATA ---

const PORTFOLIO_HISTORY = [
  { name: 'Jan', value: 45000 },
  { name: 'Feb', value: 52000 },
  { name: 'Mar', value: 48000 },
  { name: 'Apr', value: 61000 },
  { name: 'May', value: 59000 },
  { name: 'Jun', value: 72000 },
];

const ALLOCATION_DATA = [
  { name: 'Tech', value: 45, color: '#00f2fe' },
  { name: 'Finance', value: 25, color: '#10b981' },
  { name: 'Energy', value: 15, color: '#3b82f6' },
  { name: 'Health', value: 10, color: '#f59e0b' },
  { name: 'Others', value: 5, color: '#6366f1' },
];

const HOLDINGS = [
  { symbol: 'AAPL', name: 'Apple Inc.', shares: 45, avgCost: 175.20, price: 189.43, marketValue: 8524.35, gain: 8.1, rating: 85 },
  { symbol: 'MSFT', name: 'Microsoft', shares: 12, avgCost: 382.50, price: 415.10, marketValue: 4981.20, gain: 8.5, rating: 92 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', shares: 30, avgCost: 220.10, price: 175.60, marketValue: 5268.00, gain: -20.2, rating: 45 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', shares: 8, avgCost: 450.00, price: 875.28, marketValue: 7002.24, gain: 94.5, rating: 98 },
  { symbol: 'AMD', name: 'Advanced Micro Devices', shares: 50, avgCost: 145.00, price: 162.30, marketValue: 8115.00, gain: 11.9, rating: 78 },
];

const WATCHLIST = [
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 154.20, change: 1.2, aiVerdict: 'Bullish', marketCap: '1.92T', peRatio: '26.4' },
  { symbol: 'META', name: 'Meta Platforms', price: 512.43, change: -0.5, aiVerdict: 'Hold', marketCap: '1.31T', peRatio: '32.8' },
  { symbol: 'AMZN', name: 'Amazon.com', price: 185.12, change: 2.3, aiVerdict: 'Strong Buy', marketCap: '1.92T', peRatio: '61.2' },
];

// --- COMPONENTS ---

const StatCard = ({ title, value, subValue, trend, icon: Icon, colorClass = "text-brand-cyan" }: any) => (
  <div className="glass-card p-4 sm:p-6 h-full flex flex-col justify-between border-main/10 group hover:border-brand-cyan/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-cyan/10 transition-all duration-300 ease-out relative overflow-hidden">
    <div className="absolute top-0 right-0 p-8 bg-brand-cyan/5 rounded-bl-full translate-x-1/2 -translate-y-1/2 group-hover:bg-brand-cyan/10 transition-colors"></div>
    <div className="flex items-start justify-between mb-4 relative z-10">
      <div className="p-2 sm:p-3 rounded-xl bg-main/5 group-hover:bg-brand-cyan/10 transition-colors">
        <Icon size={22} className={cn("transition-colors", colorClass)} />
      </div>
      {trend !== undefined && (
        <span className={cn(
          "px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold flex items-center shadow-sm",
          trend > 0 ? "bg-emerald-500/10 text-emerald-400" : trend < 0 ? "bg-rose-500/10 text-rose-400" : "bg-main/5 text-muted"
        )}>
          {trend > 0 ? <TrendingUp size={12} className="mr-1" /> : trend < 0 ? <TrendingDown size={12} className="mr-1" /> : null}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="relative z-10">
      <p className="text-muted text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1.5">{title}</p>
      <div className="flex items-baseline gap-2">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-main">{value}</h3>
      </div>
      <p className="text-muted text-[10px] sm:text-xs mt-1 sm:mt-1.5 font-medium opacity-80">{subValue}</p>
    </div>
  </div>
);

const SidebarItem = ({ icon: Icon, label, to, active, onClick }: any) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
      active 
        ? "bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20" 
        : "text-muted hover:text-main hover:bg-white/5"
    )}
  >
    <Icon size={20} className={cn("transition-colors", active ? "text-brand-cyan" : "group-hover:text-main")} />
    <span className="font-medium text-sm">{label}</span>
  </Link>
);

const AppShell = ({ children, theme, setTheme }: { children: ReactNode, theme: string, setTheme: (t: any) => void }) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Open sidebar by default on desktop
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register') {
    return <>{children}</>;
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: PieChart, label: 'Portfolio', to: '/portfolio' },
    { icon: Eye, label: 'Watchlist', to: '/watchlist' },
    { icon: BrainCircuit, label: 'AI Analysis', to: '/ai-analysis' },
    { icon: Filter, label: 'Stock Screener', to: '/screener' },
    { icon: Calendar, label: 'Dividend Planner', to: '/dividends' },
    { icon: RotateCw, label: 'Options Tracker', to: '/options' },
    { icon: Link2, label: 'Broker Sync', to: '/broker-sync' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-bg-navy">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 w-64 flex flex-col transition-all duration-300 z-50 glass lg:static lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-emerald flex items-center justify-center">
                <Zap size={18} className="text-bg-navy fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight text-main">PortfolioAI</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-muted hover:text-main lg:hidden"
            >
              <X size={20} />
            </button>
          </div>
          
          <nav className="space-y-1">
            {navItems.map((item) => (
              <SidebarItem 
                key={item.to}
                {...item}
                active={location.pathname === item.to}
                onClick={() => {
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
              />
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-cyan/20 to-brand-emerald/10 border border-brand-cyan/20">
            <p className="text-xs font-semibold text-brand-cyan uppercase tracking-wider mb-2">Pro Plan</p>
            <p className="text-sm text-muted mb-3">Get advanced AI insights and real-time syncing.</p>
            <button className="w-full py-2 bg-brand-cyan text-bg-navy text-xs font-bold rounded-lg hover:opacity-90 transition-all">
              UPGRADE
            </button>
          </div>
          <button className="flex items-center gap-3 px-4 py-3 text-muted hover:text-main transition-all w-full">
            <LogOut size={20} />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 glass">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-muted hover:text-main rounded-lg hover:bg-main/5 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="relative group max-w-md hidden sm:block">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-brand-cyan transition-colors" />
              <input 
                type="text" 
                placeholder="Search symbols..." 
                className="bg-surface-navy-light/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm w-32 md:w-64 focus:md:w-80 focus:outline-none focus:ring-1 focus:ring-brand-cyan/50 transition-all placeholder:text-muted/50"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-muted hover:text-main rounded-xl hover:bg-main/5 transition-all"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="p-2 text-muted hover:text-main rounded-xl hover:bg-main/5 relative">
              <Bell size={20} />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-bg-navy"></span>
            </button>
            <div className="h-8 w-px bg-main/10 hidden xs:block"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-main group-hover:text-brand-cyan transition-colors">Alex Rivera</p>
                <p className="text-xs text-muted">Pro Member</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-navy-light flex items-center justify-center border border-white/10 group-hover:border-brand-cyan/30 transition-all">
                <User size={20} className="text-muted" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Container */}
        <div className="p-4 sm:p-8 pb-16">
          {children}
        </div>
      </main>
    </div>
  );
};

// --- PAGES ---

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-bg-navy overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex items-center justify-between glass">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-emerald flex items-center justify-center">
            <Zap size={18} className="text-bg-navy fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-main">PortfolioAI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          <a href="#features" className="hover:text-brand-cyan transition-colors">Features</a>
          <a href="#demo" className="hover:text-brand-cyan transition-colors">Demo</a>
          <a href="#pricing" className="hover:text-brand-cyan transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-brand-cyan transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-muted hover:text-main transition-colors">Log in</Link>
          <Link to="/register" className="btn-primary py-2 px-5 text-sm">Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-brand-cyan/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-brand-emerald/10 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-xs font-bold uppercase tracking-widest mb-6">
              Empowering Smart Investors
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-main mb-8 leading-[1.1]">
              AI Portfolio Assistant for <br />
              <span className="bg-gradient-to-r from-brand-cyan to-brand-emerald bg-clip-text text-transparent">Smarter Stock Investing</span>
            </h1>
            <p className="text-lg md:text-xl text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
              Automated broker sync, deep risk analysis, intelligent dividend planning, and real-time AI insights for your entire financial world.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register" className="btn-primary py-4 px-8 text-base w-full sm:w-auto">Start Free Journey</Link>
              <Link to="/dashboard" className="btn-secondary py-4 px-8 text-base w-full sm:w-auto">View Live Demo</Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-20 relative p-2 glass-card rounded-3xl"
          >
             <div className="rounded-2xl overflow-hidden aspect-[16/9] bg-surface-navy-light relative shadow-2xl">
               {/* Dashboard Sneak Peak */}
               <div className="absolute inset-0 bg-gradient-to-br from-surface-navy to-bg-navy p-6 flex flex-col gap-6">
                 <div className="flex gap-4">
                    <div className="flex-1 h-32 rounded-2xl bg-white/5 border border-white/5 p-4 flex flex-col justify-end">
                      <p className="text-xs text-muted font-bold mb-1">Portfolio Value</p>
                      <h4 className="text-xl font-bold text-brand-cyan">$128,453</h4>
                    </div>
                    <div className="flex-1 h-32 rounded-2xl bg-white/5 border border-white/5 p-4 flex flex-col justify-end">
                      <p className="text-xs text-muted font-bold mb-1">Risk Score</p>
                      <h4 className="text-xl font-bold text-emerald-400">Moderate</h4>
                    </div>
                    <div className="flex-1 h-32 rounded-2xl bg-white/5 border border-white/5 p-4 flex flex-col justify-end">
                      <p className="text-xs text-muted font-bold mb-1">AI Score</p>
                      <h4 className="text-xl font-bold text-main">92/100</h4>
                    </div>
                 </div>
                 <div className="flex-1 rounded-2xl bg-white/5 border border-white/5 p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-brand-cyan/20"></div>
                        <div className="w-24 h-3 bg-white/10 rounded-full"></div>
                      </div>
                      <div className="w-16 h-3 bg-white/10 rounded-full"></div>
                    </div>
                    <div className="flex-1 border-t border-white/5 pt-4">
                      <div className="w-full h-32 rounded-xl bg-white/5 flex items-end p-4 gap-2">
                        {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                          <div key={i} className="flex-1 bg-brand-cyan/30 rounded-t" style={{ height: `${h}%` }}></div>
                        ))}
                      </div>
                    </div>
                 </div>
               </div>
               <div className="absolute inset-0 bg-bg-navy/20 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="p-4 rounded-2xl glass text-center border border-white/20">
                     <p className="text-sm font-bold text-main mb-1">Interactive Dashboard</p>
                     <p className="text-xs text-muted">Experience the interface used by 50k+ investors.</p>
                  </div>
               </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-main mb-4">Investment Arsenal</h2>
          <p className="text-muted">Tools designed for professional precision and retail simplicity.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: BrainCircuit, title: "AI Analysis", desc: "Our GenAI models analyze your positions to identify risks and sector overlaps before they hurt." },
            { icon: Link2, title: "Broker Sync", desc: "connect Moomoo, Webull, Alpaca and 10+ brokers for automatic real-time transaction tracking." },
            { icon: Calendar, title: "Dividend Planner", desc: "Project your annual income with an interactive calendar and tax-optimized reinvestment planning." },
            { icon: RotateCw, title: "Options Wheel", desc: "Track cash-secured puts and covered calls with assignment monitoring and premium tracking." },
            { icon: ShieldCheck, title: "Risk Safeguard", desc: "Get real-time alerts when your portfolio beta or concentration risk exceeds your comfort zone." },
            { icon: Zap, title: "Instant Sync", desc: "Your moves across brokers are synced instantly into a unified, glass-morphic command center." },
          ].map((f, i) => (
            <div key={i} className="glass-card p-8 group hover:border-brand-cyan/30 transition-all cursor-default">
              <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 flex items-center justify-center text-brand-cyan mb-6 group-hover:scale-110 transition-transform">
                <f.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-main mb-3">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 px-6 bg-surface-navy border-y border-white/5 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-main mb-8">Ready to invest smarter?</h2>
        <Link to="/register" className="btn-primary py-4 px-10 text-lg">Create Your Portfolio AI</Link>
        <div className="mt-8 flex items-center justify-center gap-8 text-muted text-sm">
          <div className="flex items-center gap-1"><CheckCircle2 size={16} className="text-brand-emerald" /> No Credit Card Required</div>
          <div className="flex items-center gap-1"><CheckCircle2 size={16} className="text-brand-emerald" /> Bank-Grade Security</div>
        </div>
      </section>

      <footer className="py-12 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
        <div className="max-w-xs">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-emerald flex items-center justify-center">
              <Zap size={18} className="text-bg-navy fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-main">PortfolioAI</span>
          </div>
          <p className="text-sm text-muted mb-6">The operating system for the modern stock investor. Built for scale, designed for clarity.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="p-2 glass rounded-lg text-muted hover:text-brand-cyan"><Twitter size={20} /></a>
            <a href="#" className="p-2 glass rounded-lg text-muted hover:text-brand-cyan"><Github size={20} /></a>
            <a href="#" className="p-2 glass rounded-lg text-muted hover:text-brand-cyan"><Mail size={20} /></a>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 sm:gap-20">
          <div>
            <h4 className="text-main font-bold mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-muted">
              <li><Link to="/dashboard" className="hover:text-brand-cyan">Dashboard</Link></li>
              <li><Link to="/portfolio" className="hover:text-brand-cyan">Portfolio</Link></li>
              <li><Link to="/ai-analysis" className="hover:text-brand-cyan">AI Insights</Link></li>
              <li><Link to="/screener" className="hover:text-brand-cyan">Screener</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-main font-bold mb-6">Support</h4>
            <ul className="space-y-4 text-sm text-muted">
              <li><a href="#" className="hover:text-brand-cyan">Help Center</a></li>
              <li><a href="#" className="hover:text-brand-cyan">API Docs</a></li>
              <li><a href="#" className="hover:text-brand-cyan">Broker Status</a></li>
              <li><a href="#" className="hover:text-brand-cyan">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-main font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-sm text-muted">
              <li><a href="#" className="hover:text-brand-cyan">Privacy</a></li>
              <li><a href="#" className="hover:text-brand-cyan">Terms</a></li>
              <li><a href="#" className="hover:text-brand-cyan">Security</a></li>
              <li><a href="#" className="hover:text-brand-cyan">Cookies</a></li>
            </ul>
          </div>
        </div>
      </footer>
      <div className="py-8 px-6 text-center border-t border-white/5 text-xs text-slate-600">
        © 2026 PortfolioAI Inc. All prices shown are for demonstration purposes. AI insights are not financial advice.
      </div>
    </div>
  );
};

const Dashboard = ({ theme }: { theme: string }) => {
  const [quotes, setQuotes] = useState<Record<string, StockData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuotes = async () => {
      const symbols = HOLDINGS.map(h => h.symbol);
      const data = await fetchMultipleQuotes(symbols);
      setQuotes(data);
      setLoading(false);
    };
    loadQuotes();
    
    // Refresh every 60 seconds
    const interval = setInterval(loadQuotes, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalPortfolioValue = useMemo(() => {
    return HOLDINGS.reduce((acc, h) => {
      const price = quotes[h.symbol]?.price || h.price;
      return acc + (price * h.shares);
    }, 0);
  }, [quotes]);

  const todayPL = useMemo(() => {
    return HOLDINGS.reduce((acc, h) => {
      const change = quotes[h.symbol]?.change || 0;
      return acc + (change * h.shares);
    }, 0);
  }, [quotes]);

  const todayPLPercent = (todayPL / (totalPortfolioValue - todayPL)) * 100;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-main mb-2">Welcome back, Alex</h1>
          <p className="text-muted text-sm sm:text-base">Your portfolio is {todayPL >= 0 ? 'up' : 'down'} <span className={cn("font-semibold", todayPL >= 0 ? "text-emerald-400" : "text-rose-400")}>{todayPL >= 0 ? '+' : ''}{todayPLPercent.toFixed(2)}%</span> since the last sync.</p>
        </div>
        <div className="flex items-center gap-3">
           <button className="btn-secondary py-2 text-xs sm:text-sm flex-1 sm:flex-none">Download Report</button>
           <button className="btn-primary py-2 px-6 text-xs sm:text-sm font-bold flex-1 sm:flex-none">Quick Sync</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
        <StatCard 
          title="Total Value" 
          value={`$${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
          trend={parseFloat(todayPLPercent.toFixed(1))} 
          subValue={`${todayPL >= 0 ? '+' : ''}$${Math.abs(todayPL).toLocaleString()} Today`} 
          icon={DollarSign} 
        />
        <StatCard title="Today P/L" value={`${todayPL >= 0 ? '+' : '-'}$${Math.abs(Math.round(todayPL))}`} trend={parseFloat(todayPLPercent.toFixed(1))} subValue="Live Data" icon={TrendingUp} colorClass={todayPL >= 0 ? "text-emerald-400" : "text-rose-400"} />
        <StatCard title="Unrealized P/L" value="+$24,192" trend={18.8} subValue="All time gain" icon={TrendingUp} colorClass="text-emerald-400" />
        <StatCard title="Monthly Div" value="$425.00" trend={0.5} subValue="Next payout Jun 12" icon={Calendar} colorClass="text-indigo-400" />
        <StatCard title="Risk Score" value="Moderate" subValue="Score: 42/100" icon={ShieldCheck} colorClass="text-amber-400" trend={0} />
        <StatCard title="AI Confidence" value="92%" subValue="Investment Health" icon={BrainCircuit} colorClass="text-brand-cyan" trend={5.2} />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Market Analysis (TradingView) */}
        <div className="lg:col-span-2 glass-card p-0 overflow-hidden min-h-[400px] sm:min-h-[500px]">
          <TradingViewChart theme={theme === 'dark' ? 'dark' : 'light'} />
        </div>

        {/* Allocation/Watchlist Column */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6 sm:gap-8 lg:space-y-8">
          <div className="glass-card p-6">
             <h3 className="font-bold text-main mb-6 flex items-center gap-2">
              <PieChart size={18} className="text-brand-emerald" /> Allocation
            </h3>
            <div className="h-44 sm:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={ALLOCATION_DATA}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ALLOCATION_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              {ALLOCATION_DATA.slice(0, 4).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[10px] text-muted font-bold truncate">{item.name}</span>
                  <span className="text-[10px] text-main font-bold ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-brand-cyan/5 border border-main/10 flex flex-col justify-center">
            <h3 className="text-main font-bold mb-4 flex items-center gap-2">
              <BrainCircuit size={18} className="text-brand-cyan" /> AI Strategy
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-main/5 border border-main/5">
                <p className="text-[10px] font-bold text-brand-cyan mb-1 uppercase tracking-wider">Rebalance</p>
                <p className="text-xs text-muted leading-relaxed">Tech exposure is at 45%. Trimming NVDA suggested to hedge downside.</p>
              </div>
              <div className="p-3 rounded-xl bg-main/5 border border-main/5">
                <p className="text-[10px] font-bold text-brand-emerald mb-1 uppercase tracking-wider">Opportunity</p>
                <p className="text-xs text-muted leading-relaxed">JPM shows 12% upside momentum based on latest macro data.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings Preview Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-main/10 flex items-center justify-between">
          <h3 className="font-bold text-main text-sm sm:text-base">Top Performance</h3>
          <Link to="/portfolio" className="text-brand-cyan text-xs sm:text-sm font-bold flex items-center gap-1 hover:underline">
             View Portfolio <ChevronRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-main/5 text-muted text-[10px] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Symbol</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4 text-right">Market Value</th>
                <th className="px-6 py-4 text-right">Gain/Loss</th>
                <th className="px-6 py-4 text-center">AI Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {HOLDINGS.slice(0, 5).map((h, i) => {
                const quote = quotes[h.symbol];
                const currentPrice = quote?.price || h.price;
                const marketValue = currentPrice * h.shares;
                const totalGain = ((currentPrice - h.avgCost) / h.avgCost) * 100;
                
                return (
                  <tr key={i} className="hover:bg-main/5 transition-colors cursor-pointer group">
                    <td className="px-6 py-4 font-bold text-main group-hover:text-brand-cyan transition-colors">{h.symbol}</td>
                    <td className="px-6 py-4 text-muted text-xs truncate max-w-[120px]">{h.name}</td>
                    <td className="px-6 py-4 text-main font-medium text-sm">
                      ${currentPrice.toFixed(2)}
                      {quote && (
                        <span className={cn("ml-2 text-[10px]", quote.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {quote.change >= 0 ? '+' : ''}{quote.percentChange.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-main font-bold text-sm">${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={cn("px-6 py-4 text-right text-xs font-bold", totalGain > 0 ? "text-emerald-400" : "text-rose-400")}>
                      {totalGain > 0 ? '+' : ''}{totalGain.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                         <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className={cn("h-full", h.rating > 80 ? "bg-emerald-400" : h.rating > 60 ? "bg-brand-cyan" : "bg-amber-400")} style={{ width: `${h.rating}%` }}></div>
                         </div>
                         <span className="text-[10px] font-bold text-main">{h.rating}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PortfolioPage = () => {
  const [quotes, setQuotes] = useState<Record<string, StockData>>({});

  useEffect(() => {
    const loadQuotes = async () => {
      const symbols = HOLDINGS.map(h => h.symbol);
      const data = await fetchMultipleQuotes(symbols);
      setQuotes(data);
    };
    loadQuotes();
    
    // Refresh every 60 seconds
    const interval = setInterval(loadQuotes, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-main">Full Holdings</h1>
            <p className="text-muted">Total of 24 positions across 3 brokers.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary py-2 flex items-center gap-2"><Filter size={18} /> Filter</button>
            <button className="btn-primary py-2 px-6 flex items-center gap-2 font-bold"><BrainCircuit size={18} /> Analyze with AI</button>
          </div>
       </div>
  
       <div className="glass-card p-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-muted text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-5">Symbol</th>
                  <th className="px-6 py-5">Company</th>
                  <th className="px-6 py-5 text-right">Shares</th>
                  <th className="px-6 py-5 text-right">Avg Cost</th>
                  <th className="px-6 py-5 text-right">Price</th>
                  <th className="px-6 py-5 text-right">Market Value</th>
                  <th className="px-6 py-5 text-right">Gain/Loss</th>
                  <th className="px-6 py-5 text-center">AI Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {HOLDINGS.map((h, i) => {
                  const quote = quotes[h.symbol];
                  const currentPrice = quote?.price || h.price;
                  const marketValue = currentPrice * h.shares;
                  const totalGain = ((currentPrice - h.avgCost) / h.avgCost) * 100;
                  const totalGainValue = marketValue - (h.avgCost * h.shares);

                  return (
                    <tr key={i} className="hover:bg-white/5 transition-all cursor-pointer">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg bg-surface-navy-light flex items-center justify-center font-bold text-xs text-brand-cyan">{h.symbol[0]}</div>
                           <span className="font-bold text-white">{h.symbol}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-muted text-sm">{h.name}</td>
                      <td className="px-6 py-5 text-right text-white font-medium">{h.shares}</td>
                      <td className="px-6 py-5 text-right text-muted">${h.avgCost.toFixed(2)}</td>
                      <td className="px-6 py-5 text-right text-white font-medium">
                        ${currentPrice.toFixed(2)}
                        {quote && (
                          <span className={cn("block text-[10px]", quote.change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {quote.change >= 0 ? '+' : ''}{quote.percentChange.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right text-white font-bold">${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={cn("px-6 py-5 text-right text-sm font-bold", totalGain > 0 ? "text-emerald-400" : "text-rose-400")}>
                        <div className="flex flex-col items-end">
                          <span>{totalGain > 0 ? '+' : ''}{totalGain.toFixed(2)}%</span>
                          <span className="text-[10px] opacity-70">${totalGainValue >= 0 ? '+' : ''}{totalGainValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-2">
                           <div className="w-20 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className={cn("h-full", h.rating > 80 ? "bg-emerald-400" : h.rating > 60 ? "bg-brand-cyan" : "bg-amber-400")} style={{ width: `${h.rating}%` }}></div>
                           </div>
                           <span className={cn("text-xs font-bold", h.rating > 80 ? "text-emerald-400" : h.rating > 60 ? "text-brand-cyan" : "text-amber-400")}>{h.rating}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              <tr className="hover:bg-white/5 transition-all cursor-pointer group">
                <td colSpan={8} className="px-6 py-8 text-center">
                  <button className="text-muted hover:text-brand-cyan font-bold flex items-center gap-2 mx-auto transition-colors">
                    <Plus size={20} /> Add Manual Position
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
     </div>
    </div>
  );
};

const AIAnalysisPage = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hello! I'm your AI Investment Assistant. I've analyzed your portfolio. Would you like to check your risk profile or find new opportunities?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleSend = (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;
    
    if (!text) {
      setMessages(prev => [...prev, { role: 'user', text: messageText }]);
      setInput('');
    }
    
    setIsTyping(true);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', text: "Analyzing your data... Based on current market volatility and your overweight Tech exposure, my recommendation is to diversify into Energy or Consumer Staples sectors to lower your overall Beta. I've also identified a potential rebalancing opportunity in your 'Clean Energy' bucket." }]);
    }, 2000);
  };

  const handleRegenerate = () => {
    if (messages.length < 2) return;
    
    // Remove last assistant message
    const newMessages = [...messages];
    if (newMessages[newMessages.length - 1].role === 'assistant') {
      newMessages.pop();
    }
    
    // Use a compatible way to find the last user message
    const lastUserMessage = [...newMessages].reverse().find(m => m.role === 'user');
    setMessages(newMessages);
    
    if (lastUserMessage) {
      handleSend(lastUserMessage.text);
    } else {
      // Default to initial state if no user message found
      handleSend("Give me a new analysis");
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex gap-8">
      {/* Sidebar Suggestions */}
      <div className="w-80 space-y-6 hidden xl:block">
        <div className="glass-card p-6">
          <h3 className="text-main font-bold mb-4 flex items-center gap-2"><Zap size={18} className="text-brand-cyan" /> Suggest Questions</h3>
          <div className="space-y-3">
            {[
              "Analyze my portfolio risk",
              "Which stock should I trim?",
              "Find undervalued stocks",
              "Estimate monthly dividend",
              "Compare my performance to SPY"
            ].map((q, i) => (
              <button 
                key={i} 
                onClick={() => setInput(q)}
                className="w-full text-left p-3 rounded-xl bg-main/5 border border-main/10 text-sm text-muted hover:bg-brand-cyan/10 hover:text-brand-cyan transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        
        <div className="glass-card p-6">
            <h3 className="text-main font-bold mb-4">Investment Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Diversification</span>
                <span className="text-sm font-bold text-rose-400">Poor</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Risk-Adjusted Return</span>
                <span className="text-sm font-bold text-emerald-400">Excellent</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Sector Exposure</span>
                <span className="text-sm font-bold text-amber-400">Concentrated</span>
              </div>
            </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-main/10 flex items-center gap-4 bg-main/5">
           <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BrainCircuit size={20} />
           </div>
           <div>
              <h3 className="font-bold text-main text-sm">PortfolioAI Copilot</h3>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active • Real-time Data</p>
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}
              >
                 <div className={cn(
                   "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
                   m.role === 'user' 
                    ? "bg-brand-cyan text-bg-navy font-medium rounded-tr-none shadow-lg shadow-brand-cyan/20" 
                    : "bg-surface-navy-light text-main border border-main/10 rounded-tl-none"
                 )}>
                   {m.text}
                   {m.role === 'assistant' && i > 0 && (
                     <div className="mt-4 pt-4 border-t border-white/10 flex gap-4">
                        <div className="flex-1 text-center py-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                          <p className="text-[10px] font-bold text-slate-500">CONFIDENCE</p>
                          <p className="text-xs font-bold text-emerald-400">High (94%)</p>
                        </div>
                        <div className="flex-1 text-center py-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                          <p className="text-[10px] font-bold text-slate-500">RISK IMPACT</p>
                          <p className="text-xs font-bold text-amber-400">Moderate</p>
                        </div>
                     </div>
                   )}
                 </div>
                 {m.role === 'assistant' && i === messages.length - 1 && i > 0 && !isTyping && (
                  <button 
                    onClick={handleRegenerate}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-muted hover:text-brand-cyan transition-colors bg-main/5 px-2 py-1 rounded-md"
                  >
                    <RotateCw size={10} /> REGENERATE
                  </button>
                 )}
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-surface-navy-light border border-main/10 rounded-2xl rounded-tl-none p-4 flex gap-1.5 items-center">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }} 
                    className="w-1.5 h-1.5 rounded-full bg-brand-cyan/50" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} 
                    className="w-1.5 h-1.5 rounded-full bg-brand-cyan/50" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} 
                    className="w-1.5 h-1.5 rounded-full bg-brand-cyan/50" 
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-white/5">
           <div className="relative">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Message PortfolioAI Copilot..."
                className="w-full bg-surface-navy-light border border-white/10 rounded-2xl py-4 pl-6 pr-32 focus:outline-none focus:ring-1 focus:ring-brand-cyan/50 text-white transition-all shadow-inner"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                 <button className="p-2 text-muted hover:text-main transition-colors"><Link2 size={20} /></button>
                 <button 
                  onClick={handleSend}
                  className="bg-brand-cyan text-bg-navy p-2 rounded-xl hover:opacity-90 transition-all"
                 >
                    <ArrowUpRight size={20} />
                 </button>
              </div>
           </div>
           <p className="text-center text-[10px] text-muted mt-4 tracking-tight">AI insights can contain errors. Cross-reference with official broker statements.</p>
        </div>
      </div>
    </div>
  );
};

const BrokerSyncPage = () => {
  return (
    <div className="space-y-8">
       <div>
          <h1 className="text-3xl font-bold text-main">Broker Connections</h1>
          <p className="text-muted">Connect and sync your external portfolios automatically.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[
            { name: "Moomoo", status: "Connected", lastSync: "2m ago", assets: "$45,210.43", icon: "M" },
            { name: "Webull", status: "Connected", lastSync: "1h ago", assets: "$12,401.20", icon: "W" },
            { name: "Alpaca", status: "Disconnected", lastSync: "Never", assets: "$0.00", icon: "A" },
            { name: "Interactive Brokers", status: "Disconnected", lastSync: "Never", assets: "$0.00", icon: "IB" },
          ].map((b, i) => (
            <div key={i} className="glass-card p-6 flex flex-col">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-12 h-12 rounded-2xl bg-main/5 flex items-center justify-center text-xl font-bold text-main border border-main/10">{b.icon}</div>
                 <div className={cn(
                   "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                   b.status === "Connected" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-muted/10 text-muted border border-main/10"
                 )}>
                   {b.status}
                 </div>
              </div>
              <h3 className="font-bold text-main mb-1">{b.name}</h3>
              <p className="text-xs text-muted mb-6">Last sync: {b.lastSync}</p>
              
              <div className="mt-auto pt-6 border-t border-white/5">
                 <div className="flex justify-between items-end">
                    <div>
                       <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Sync Assets</p>
                       <p className="text-lg font-bold text-main">{b.assets}</p>
                    </div>
                    {b.status === "Connected" ? (
                      <button className="text-muted hover:text-main p-2 rounded-lg hover:bg-white/5 transition-all"><RotateCw size={18} /></button>
                    ) : (
                      <button className="btn-primary py-1.5 px-4 text-xs">Connect</button>
                    )}
                 </div>
              </div>
            </div>
          ))}
          <div className="glass-card p-6 border-dashed border-white/10 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-white/5 transition-all">
             <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted mb-4 group-hover:text-brand-cyan transition-colors">
                <Plus size={24} />
             </div>
             <h3 className="font-bold text-main mb-1">Add Another Broker</h3>
             <p className="text-xs text-muted">Connect with 10,000+ institutions via Plaid or manual CSV.</p>
          </div>
       </div>

       <div className="glass-card p-8 bg-gradient-to-br from-bg-navy to-surface-navy">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-brand-cyan border border-brand-cyan/20">
                <ShieldCheck size={32} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-main mb-2">We value your security</h3>
                <p className="text-muted text-sm max-w-xl">PortfolioAI uses bank-grade 256-bit AES encryption. We only have read-access to your data via secure OAuth flows. We can never execute trades or withdraw funds.</p>
             </div>
          </div>
       </div>
    </div>
  );
};

const ComparisonDashboard = ({ symbols, quotes, onClose, theme }: { symbols: string[], quotes: Record<string, StockData>, onClose: () => void, theme: string }) => {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-main/10 flex items-center justify-between bg-brand-cyan/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-cyan/20 flex items-center justify-center text-brand-cyan">
             <Layout size={20} />
          </div>
          <div>
            <h3 className="font-bold text-main">Multi-Asset Comparison</h3>
            <p className="text-[10px] text-muted uppercase tracking-widest">Side-by-side Technical Analysis</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted hover:text-main"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {symbols.map(symbol => {
            const quote = quotes[symbol];
            const data = WATCHLIST.find(w => w.symbol === symbol);
            return (
              <div key={symbol} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-main text-lg">{symbol}</span>
                    <span className="text-xs text-muted">{data?.name}</span>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                    (quote?.percentChange || 0) > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  )}>
                    {(quote?.percentChange || 0) > 0 ? '+' : ''}{(quote?.percentChange || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="h-[300px] rounded-xl overflow-hidden border border-white/5">
                  <TradingViewChart 
                    theme={theme === 'dark' ? 'dark' : 'light'} 
                    symbol={symbol.includes(":") ? symbol : `NASDAQ:${symbol}`} 
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                   <div className="bg-white/5 p-2 rounded-lg">
                      <p className="text-[8px] text-muted uppercase">Price</p>
                      <p className="text-sm font-bold text-main">${(quote?.price || 0).toFixed(2)}</p>
                   </div>
                   <div className="bg-white/5 p-2 rounded-lg">
                      <p className="text-[8px] text-muted uppercase">Mkt Cap</p>
                      <p className="text-sm font-bold text-main">{(data as any)?.marketCap || 'N/A'}</p>
                   </div>
                   <div className="bg-white/5 p-2 rounded-lg">
                      <p className="text-[8px] text-muted uppercase">P/E</p>
                      <p className="text-sm font-bold text-main">{(data as any)?.peRatio || 'N/A'}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const WatchlistPage = ({ theme }: { theme: string }) => {
  const [quotes, setQuotes] = useState<Record<string, StockData>>({});
  const [selectedSymbol, setSelectedSymbol] = useState<string>(WATCHLIST[0]?.symbol || "AAPL");
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [isCompareMode, setIsCompareMode] = useState(false);

  useEffect(() => {
    const loadQuotes = async () => {
      const symbols = WATCHLIST.map(w => w.symbol);
      const data = await fetchMultipleQuotes(symbols);
      setQuotes(data);
    };
    loadQuotes();
    
    const interval = setInterval(loadQuotes, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
       <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-main">Watchlist</h1>
          <button className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Symbol</button>
       </div>

        {/* Detailed Chart / Comparison Section */}
        {isCompareMode ? (
          <ComparisonDashboard 
            symbols={compareSymbols} 
            quotes={quotes} 
            onClose={() => setIsCompareMode(false)} 
            theme={theme}
          />
        ) : (
          <div className="glass-card overflow-hidden flex flex-col">
            <div className="p-4 border-b border-main/10 flex items-center justify-between bg-main/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-cyan/10 flex items-center justify-center text-brand-cyan">
                      <TrendingUp size={20} />
                  </div>
                  <div>
                      <h3 className="font-bold text-main">{selectedSymbol} Technical Chart</h3>
                      <p className="text-[10px] text-muted uppercase tracking-widest">Real-time TradingView Data</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                      Live
                  </div>
                </div>
            </div>
            <div className="h-[500px]">
                <TradingViewChart theme={theme === 'dark' ? 'dark' : 'light'} symbol={selectedSymbol.includes(":") ? selectedSymbol : `NASDAQ:${selectedSymbol}`} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WATCHLIST.map((w, i) => {
            const quote = quotes[w.symbol];
            const price = quote?.price || w.price;
            const change = quote?.percentChange || w.change;
            const isExpanded = expandedSymbol === w.symbol;
            const isComparing = compareSymbols.includes(w.symbol);
            
            return (
              <div 
                key={i} 
                onClick={() => {
                   setSelectedSymbol(w.symbol);
                   setExpandedSymbol(isExpanded ? null : w.symbol);
                }}
                className={cn(
                   "glass-card p-6 group transition-all cursor-pointer relative overflow-hidden",
                   selectedSymbol === w.symbol ? "border-brand-cyan shadow-lg shadow-brand-cyan/10" : "hover:border-brand-cyan/20",
                   isComparing && "bg-brand-cyan/5 border-brand-cyan/30"
                )}
              >
                {/* Compare Checkbox */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setCompareSymbols(prev => 
                      prev.includes(w.symbol) 
                        ? prev.filter(s => s !== w.symbol) 
                        : [...prev, w.symbol]
                    );
                  }}
                  className={cn(
                    "absolute top-3 right-3 w-5 h-5 rounded border flex items-center justify-center transition-all z-10",
                    isComparing ? "bg-brand-cyan border-brand-cyan" : "bg-white/5 border-white/20 hover:border-brand-cyan/50"
                  )}
                >
                  {isComparing && <ShieldCheck size={12} className="text-navy" />}
                </div>

                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h3 className="font-bold text-xl text-main group-hover:text-brand-cyan transition-colors">{w.symbol}</h3>
                      <p className="text-sm text-muted">{w.name}</p>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                     <div className={cn("px-3 py-1.5 rounded-xl font-bold text-sm", change > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400")}>
                        {change > 0 ? '+' : ''}{change.toFixed(2)}%
                     </div>
                     <ChevronDown size={14} className={cn("text-muted transition-transform duration-300", isExpanded && "rotate-180 text-brand-cyan")} />
                   </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4 pb-6 mt-2 border-t border-white/5 pt-4">
                         <div>
                           <p className="text-[10px] font-bold text-muted uppercase">Market Cap</p>
                           <p className="text-sm font-bold text-main">{(w as any).marketCap}</p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] font-bold text-muted uppercase">P/E Ratio</p>
                           <p className="text-sm font-bold text-main">{(w as any).peRatio}</p>
                         </div>
                         <div>
                           <p className="text-[10px] font-bold text-muted uppercase">52W High</p>
                           <p className="text-sm font-bold text-main">${(price * 1.15).toFixed(2)}</p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] font-bold text-muted uppercase">Beta</p>
                           <p className="text-sm font-bold text-main">1.24</p>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div>
                       <p className="text-[10px] font-bold text-muted uppercase">Current Price</p>
                       <p className="text-lg font-bold text-main">${price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-muted uppercase">AI Verdict</p>
                       <p className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border",
                          w.aiVerdict === 'Strong Buy' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 
                          w.aiVerdict === 'Bullish' ? 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20' : 
                          w.aiVerdict === 'Hold' ? 'text-muted bg-white/5 border-white/10' :
                          'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        )}>
                          {w.aiVerdict}
                        </p>
                    </div>
                </div>
              </div>
            );
          })}
       </div>

       {/* Comparison Selection Bar */}
       <AnimatePresence>
         {compareSymbols.length > 0 && !isCompareMode && (
           <motion.div
             initial={{ y: 100 }}
             animate={{ y: 0 }}
             exit={{ y: 100 }}
             className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-2xl bg-surface-navy-light/95 backdrop-blur-xl border border-brand-cyan/30 rounded-2xl shadow-2xl p-4 flex items-center justify-between"
           >
             <div className="flex items-center gap-4">
               <div className="flex -space-x-2">
                 {compareSymbols.slice(0, 3).map(s => (
                   <div key={s} className="w-8 h-8 rounded-full bg-brand-cyan flex items-center justify-center text-[10px] font-bold text-navy border-2 border-surface-navy">
                     {s.slice(0, 2)}
                   </div>
                 ))}
                 {compareSymbols.length > 3 && (
                   <div className="w-8 h-8 rounded-full bg-surface-navy border-2 border-white/10 flex items-center justify-center text-[10px] font-bold text-main">
                     +{compareSymbols.length - 3}
                   </div>
                 )}
               </div>
               <p className="text-sm font-bold text-main">
                 {compareSymbols.length} {compareSymbols.length === 1 ? 'asset' : 'assets'} selected for comparison
               </p>
             </div>
             <div className="flex items-center gap-2">
               <button 
                 onClick={() => setCompareSymbols([])}
                 className="px-4 py-2 text-sm font-bold text-muted hover:text-main transition-colors"
               >
                 Clear
               </button>
               <button 
                 onClick={() => setIsCompareMode(true)}
                 disabled={compareSymbols.length < 2}
                 className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Zap size={16} /> Compare Now
               </button>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
};

const DividendPlanner = () => (
  <div className="space-y-8">
     <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-main">Dividend Planner</h1>
          <p className="text-muted">Project your passive income and optimize reinvestments.</p>
        </div>
        <div className="flex gap-4">
           <div className="glass-card px-6 py-2 flex flex-col items-center">
              <span className="text-[10px] font-bold text-muted uppercase">Annual Yield</span>
              <span className="text-xl font-bold text-main">3.82%</span>
           </div>
           <div className="glass-card px-6 py-2 flex flex-col items-center border-brand-emerald/20">
              <span className="text-[10px] font-bold text-brand-emerald uppercase">Annual Payout</span>
              <span className="text-xl font-bold text-brand-emerald">$5,102.40</span>
           </div>
        </div>
     </div>

     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-6">
           <h3 className="text-main font-bold mb-6">Income Projection</h3>
           <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { month: 'Jan', income: 420 },
                  { month: 'Feb', income: 380 },
                  { month: 'Mar', income: 512 },
                  { month: 'Apr', income: 290 },
                  { month: 'May', income: 410 },
                  { month: 'Jun', income: 650 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="month" stroke="#ffffff30" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px' }} />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
        
        <div className="glass-card p-6">
           <h3 className="text-main font-bold mb-6">Upcoming Payouts</h3>
           <div className="space-y-4">
              {[
                { symbol: 'AAPL', date: 'Jun 12', amount: '$11.25', yield: '0.5%' },
                { symbol: 'MSFT', date: 'Jun 18', amount: '$42.10', yield: '0.8%' },
                { symbol: 'O', date: 'Jul 01', amount: '$125.40', yield: '5.4%' },
                { symbol: 'V', date: 'Jul 15', amount: '$24.15', yield: '0.7%' },
              ].map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-main/5 border border-main/10">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-navy-light flex items-center justify-center font-bold text-[10px] text-main">{d.symbol}</div>
                      <div>
                        <p className="text-sm font-bold text-main">{d.symbol}</p>
                        <p className="text-[10px] text-muted">{d.date}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-bold text-main">{d.amount}</p>
                      <p className="text-[10px] text-emerald-400">{d.yield}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
     </div>

  </div>
);

const FilterDropdown = ({ label, value, options, onSelect, isOpen, onToggle }: any) => {
  return (
    <div className="relative">
      <div 
        onClick={onToggle}
        className={cn(
          "px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-all",
          isOpen && "bg-white/10 border-brand-cyan/30"
        )}
      >
        <div className="flex flex-col items-start pr-1">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</span>
          <span className="text-sm font-bold text-main">{value}</span>
        </div>
        <ChevronDown size={14} className={cn("text-muted transition-transform duration-200", isOpen && "rotate-180 text-brand-cyan")} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-48 bg-surface-navy-light border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden"
          >
            <div className="py-2">
              {options.map((opt: string) => (
                <div
                  key={opt}
                  onClick={() => {
                    onSelect(opt);
                    onToggle();
                  }}
                  className={cn(
                    "px-4 py-2.5 text-sm cursor-pointer hover:bg-brand-cyan/10 hover:text-brand-cyan transition-colors",
                    value === opt ? "text-brand-cyan bg-brand-cyan/5 font-bold" : "text-main"
                  )}
                >
                  {opt}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StockScreener = () => {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    "Market Cap": "Large Cap",
    "Sector": "All Sectors",
    "Div Yield": "> 2%",
    "AI Score": "High (80+)",
    "P/E Ratio": "< 25"
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const filterConfigs = [
    { label: "Market Cap", options: ["All", "Mega Cap", "Large Cap", "Mid Cap", "Small Cap"] },
    { label: "Sector", options: ["All Sectors", "Technology", "Healthcare", "Financials", "Energy", "Consumer Staples"] },
    { label: "Div Yield", options: ["Any", "> 1%", "> 2%", "> 3%", "> 5%"] },
    { label: "AI Score", options: ["Bullish (70+)", "High (80+)", "Elite (90+)", "Value Pick"] },
    { label: "P/E Ratio", options: ["Any", "< 15", "< 20", "< 25", "< 50"] }
  ];

  const handleSelect = (label: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [label]: value }));
  };

  const handleToggle = (label: string) => {
    setOpenDropdown(openDropdown === label ? null : label);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
         <div>
           <h1 className="text-3xl font-bold text-main">Stock Screener</h1>
           <p className="text-muted">Filter through 15,000+ assets using AI-powered momentum and value metrics.</p>
         </div>
         <button className="btn-primary flex items-center gap-2" onClick={() => setOpenDropdown(null)}><Zap size={18} /> Run AI Scan</button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4 relative">
        {filterConfigs.map((f) => (
          <FilterDropdown
            key={f.label}
            label={f.label}
            value={activeFilters[f.label]}
            options={f.options}
            isOpen={openDropdown === f.label}
            onToggle={() => handleToggle(f.label)}
            onSelect={(val: string) => handleSelect(f.label, val)}
          />
        ))}
        <button 
          onClick={() => {
            setActiveFilters({
              "Market Cap": "Large Cap",
              "Sector": "All Sectors",
              "Div Yield": "> 2%",
              "AI Score": "High (80+)",
              "P/E Ratio": "< 25"
            });
            setOpenDropdown(null);
          }}
          className="ml-auto text-brand-cyan text-sm font-bold hover:underline"
        >
          Clear Filters
        </button>
      </div>

      <div className="glass-card overflow-hidden" onClick={() => setOpenDropdown(null)}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white/5 text-muted text-[10px] uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Market Cap</th>
                <th className="px-6 py-4">P/E</th>
                <th className="px-6 py-4">DIV Yield</th>
                <th className="px-6 py-4">AI Momentum</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { s: 'NVDA', name: 'Nvidia', price: '$875.28', cap: '$2.1T', pe: '72.4', div: '0.02%', momentum: 98, trend: 'Strong Buy' },
                { s: 'MSFT', name: 'Microsoft', price: '$415.10', cap: '$3.1T', pe: '36.8', div: '0.72%', momentum: 92, trend: 'Buy' },
                { s: 'JPM', name: 'JP Morgan', price: '$198.45', cap: '$570B', pe: '11.4', div: '2.42%', momentum: 84, trend: 'Value' },
                { s: 'AVGO', name: 'Broadcom', price: '$1,345.10', cap: '$620B', pe: '48.2', div: '1.54%', momentum: 88, trend: 'Strong Buy' },
              ].map((r, i) => (
                <tr key={i} className="hover:bg-white/5">
                   <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-surface-navy-light flex items-center justify-center font-bold text-brand-cyan">{r.s[0]}</div>
                         <div>
                            <p className="font-bold text-main">{r.s}</p>
                            <p className="text-xs text-muted">{r.name}</p>
                         </div>
                      </div>
                   </td>
                   <td className="px-6 py-5 text-main font-medium">{r.price}</td>
                   <td className="px-6 py-5 text-muted">{r.cap}</td>
                   <td className="px-6 py-5 text-muted">{r.pe}</td>
                   <td className="px-6 py-5 text-emerald-400 font-medium">{r.div}</td>
                   <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                         <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-brand-cyan" style={{ width: `${r.momentum}%` }}></div>
                         </div>
                         <span className="text-xs font-bold text-main">{r.momentum}</span>
                      </div>
                   </td>
                   <td className="px-6 py-5 text-center">
                      <button className="text-muted hover:text-brand-cyan transition-colors"><Plus size={20} /></button>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
     </div>
  </div>
  );
};

const OptionsTracker = () => (
   <div className="space-y-8">
      <div className="flex justify-between items-center">
         <div>
            <h1 className="text-3xl font-bold text-main">Options Wheel Tracker</h1>
            <p className="text-muted">Monitor your cash-secured puts and covered calls income.</p>
         </div>
         <button className="btn-primary flex items-center gap-2"><Plus size={18} /> Log New Trade</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         {[
           { label: "Active Premiums", val: "$2,450", icon: DollarSign, color: "text-emerald-400" },
           { label: "Active Contracts", val: "12", icon: CreditCard, color: "text-brand-cyan" },
           { label: "At Risk", val: "2", icon: ShieldCheck, color: "text-rose-400" },
           { label: "Wheel Income (YTD)", val: "$15,201", icon: TrendingUp, color: "text-emerald-400" },
         ].map((s, i) => (
           <div key={i} className="glass-card p-6">
              <div className={cn("p-2 rounded-lg bg-white/5 w-fit mb-4", s.color)}><s.icon size={20} /></div>
              <p className="text-xs font-bold text-muted uppercase">{s.label}</p>
              <h4 className="text-xl font-bold text-main">{s.val}</h4>
           </div>
         ))}
      </div>

      <div className="glass-card overflow-hidden">
         <div className="p-6 border-b border-white/5">
            <h3 className="font-bold text-main">Active Contracts</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-white/5 text-muted text-[10px] uppercase font-bold">
                  <tr>
                     <th className="px-6 py-4">Symbol / Strategy</th>
                     <th className="px-6 py-4">Strike</th>
                     <th className="px-6 py-4 text-right">Premium</th>
                     <th className="px-6 py-4 text-right">Break Even</th>
                     <th className="px-6 py-4">Expiry</th>
                     <th className="px-6 py-4 text-center">Status</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {[
                    { s: 'TSLA JUN 21 160P', type: 'CSP', strike: '$160.00', premium: '$450', be: '155.50', exp: '12d left', status: 'O.T.M' },
                    { s: 'AMD JUN 14 170C', type: 'CC', strike: '$170.00', premium: '$120', be: '171.20', exp: '5d left', status: 'I.T.M' },
                    { s: 'NVDA JUN 28 850P', type: 'CSP', strike: '$850.00', premium: '$1,200', be: '838.00', exp: '19d left', status: 'O.T.M' },
                  ].map((c, i) => (
                    <tr key={i} className="hover:bg-white/5">
                       <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-main uppercase">{c.s}</span>
                            <span className="text-[10px] font-bold text-muted">{c.type}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-main font-medium">{c.strike}</td>
                       <td className="px-6 py-4 text-right text-emerald-400 font-bold">{c.premium}</td>
                       <td className="px-6 py-4 text-right text-muted">{c.be}</td>
                       <td className="px-6 py-4 text-main font-medium">{c.exp}</td>
                       <td className="px-6 py-4">
                          <div className={cn("mx-auto w-fit px-2 py-1 rounded-lg text-[10px] font-bold", c.status === 'O.T.M' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400')}>
                             {c.status}
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   </div>
);

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="h-[60vh] flex flex-col items-center justify-center text-center">
    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-brand-cyan mb-6 border border-white/5">
      <Zap size={40} className="animate-pulse" />
    </div>
    <h1 className="text-4xl font-bold text-main mb-2">{title}</h1>
    <p className="text-muted max-w-md">This module is part of the PortfolioAI Enterprise Suite and is currently being populated with real-time data from your connected sources.</p>
  </div>
);

const LoginPage = () => (
   <div className="min-h-screen bg-bg-navy flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-cyan/10 via-transparent to-brand-emerald/10 pointer-events-none"></div>
      <div className="max-w-md w-full glass-card p-10 relative z-10">
         <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-emerald flex items-center justify-center mx-auto mb-6">
              <Zap size={24} className="text-bg-navy fill-current" />
            </div>
            <h1 className="text-2xl font-bold text-main mb-2">Welcome Back</h1>
            <p className="text-muted text-sm">Enter your credentials to access your insights.</p>
         </div>
         <div className="space-y-6">
            <div className="space-y-2">
               <label className="text-xs font-bold text-muted uppercase">Email Address</label>
               <input type="email" placeholder="name@example.com" className="w-full bg-surface-navy-light border border-white/10 rounded-xl py-3 px-4 text-main focus:outline-none focus:ring-1 focus:ring-brand-cyan/50" />
            </div>
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <label className="text-xs font-bold text-muted uppercase">Password</label>
                 <a href="#" className="text-xs text-brand-cyan hover:underline">Forgot?</a>
               </div>
               <input type="password" placeholder="••••••••" className="w-full bg-surface-navy-light border border-white/10 rounded-xl py-3 px-4 text-main focus:outline-none focus:ring-1 focus:ring-brand-cyan/50" />
            </div>
            <Link to="/dashboard" className="btn-primary w-full py-4 text-center">Log In</Link>
            <div className="relative py-2">
               <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
               <div className="relative flex justify-center text-xs uppercase"><span className="bg-bg-navy px-2 text-muted">Or continue with</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <button className="btn-secondary py-3 flex items-center justify-center gap-2 text-sm"><Twitter size={18} /> Twitter</button>
               <button className="btn-secondary py-3 flex items-center justify-center gap-2 text-sm"><Github size={18} /> Github</button>
            </div>
         </div>
         <p className="text-center mt-8 text-sm text-muted">Don't have an account? <Link to="/register" className="text-brand-cyan font-bold hover:underline">Register</Link></p>
      </div>
   </div>
);


// --- MAIN APP COMPONENT ---

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  return (
    <Router>
      <AppShell theme={theme} setTheme={setTheme}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} /> {/* Mirroring for simplicity */}
          <Route path="/dashboard" element={<Dashboard theme={theme} />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/watchlist" element={<WatchlistPage theme={theme} />} />
          <Route path="/ai-analysis" element={<AIAnalysisPage />} />
          <Route path="/broker-sync" element={<BrokerSyncPage />} />
          <Route path="/screener" element={<StockScreener />} />
          <Route path="/dividends" element={<DividendPlanner />} />
          <Route path="/options" element={<OptionsTracker />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </Router>
  );
}
