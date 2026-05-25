// src/lib/config/nav.ts

export interface NavSubPage {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface NavSection {
  id: string;
  icon: string;
  label: string;
  href?: string;         // direct-link sections (Dashboard, Settings) — no fly-out
  color?: string;        // accent colour override (AI section: '#3fb950')
  matchPrefix?: string;  // pathname.startsWith(matchPrefix) → this section is active
  matchPaths?: string[]; // exact pathname matches → this section is active
  children?: NavSubPage[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    icon: '📊',
    label: 'Dashboard',
    href: '/dashboard',
    matchPaths: ['/dashboard', '/'],
  },
  {
    id: 'portfolio',
    icon: '💼',
    label: 'Portfolio',
    matchPaths: ['/holdings', '/transactions', '/accounts', '/watchlist', '/snapshots'],
    children: [
      { label: 'Holdings',     href: '/holdings',     icon: '📋' },
      { label: 'Transactions', href: '/transactions', icon: '💱' },
      { label: 'Watchlist',    href: '/watchlist',    icon: '👁️' },
      { label: 'Accounts',     href: '/accounts',     icon: '🏦' },
      { label: 'Snapshots',    href: '/snapshots',    icon: '📸' },
    ],
  },
  {
    id: 'analytics',
    icon: '📈',
    label: 'Analytics',
    matchPrefix: '/analytics',
    children: [
      { label: 'Overview',        href: '/analytics',                 icon: '📊' },
      { label: 'Benchmark',       href: '/analytics/benchmark',       icon: '🏁' },
      { label: 'Risk',            href: '/analytics/risk',            icon: '⚠️' },
      { label: 'Performance',     href: '/analytics/performance',     icon: '📈' },
      { label: 'Diversification', href: '/analytics/diversification', icon: '🥧' },
      { label: 'Exposure',        href: '/analytics/exposure',        icon: '🎯' },
    ],
  },
  {
    id: 'ai',
    icon: '✦',
    label: 'AI Suite',
    color: '#3fb950',
    matchPrefix: '/ai',
    children: [
      { label: 'Copilot',             href: '/ai/copilot',             icon: '💬' },
      { label: 'Risk Advisor',        href: '/ai/risk-advisor',        icon: '🛡️' },
      { label: 'Portfolio Assistant', href: '/ai/portfolio-assistant', icon: '🧠' },
      { label: 'Memory',              href: '/ai/memory',              icon: '🗂️', badge: 'New' },
      { label: 'Insights',            href: '/ai/insights',            icon: '💡' },
    ],
  },
  {
    id: 'optimize',
    icon: '⚡',
    label: 'Optimize',
    matchPrefix: '/optimization',
    children: [
      { label: 'Rebalance',   href: '/optimization/rebalance',   icon: '⚖️' },
      { label: 'Scenarios',   href: '/optimization/scenarios',   icon: '🎭' },
      { label: 'Simulation',  href: '/optimization/simulation',  icon: '🔮' },
      { label: 'Stress Test', href: '/optimization/stress-test', icon: '💥' },
    ],
  },
  {
    id: 'income',
    icon: '📅',
    label: 'Income',
    matchPaths: ['/cashflow', '/dividend-planner'],
    children: [
      { label: 'Cashflow',  href: '/cashflow',          icon: '💰' },
      { label: 'Dividends', href: '/dividend-planner',  icon: '📅' },
    ],
  },
  {
    id: 'trades',
    icon: '📋',
    label: 'Trades',
    matchPrefix: '/trades',
    matchPaths: ['/orders', '/paper-trading'],
    children: [
      { label: 'Overview',      href: '/trades',        icon: '📋' },
      { label: 'Orders',        href: '/orders',        icon: '📝' },
      { label: 'Paper Trading', href: '/paper-trading', icon: '🧪' },
    ],
  },
  {
    id: 'broker',
    icon: '🔗',
    label: 'Broker',
    matchPaths: ['/broker', '/fund-balance', '/import'],
    children: [
      { label: 'Connections',  href: '/broker',       icon: '🔗' },
      { label: 'Fund Balance', href: '/fund-balance', icon: '💳' },
      { label: 'Import',       href: '/import',       icon: '📥' },
    ],
  },
  {
    id: 'settings',
    icon: '⚙️',
    label: 'Settings',
    href: '/settings',
    matchPrefix: '/settings',
  },
];

/**
 * Returns the section id whose route matches the given pathname.
 * matchPaths checked first (exact), then matchPrefix (startsWith).
 */
export function getActiveSectionId(pathname: string): string | null {
  for (const section of NAV_SECTIONS) {
    if (section.matchPaths?.includes(pathname)) return section.id;
    if (section.matchPrefix &&
        (pathname === section.matchPrefix || pathname.startsWith(section.matchPrefix + '/')))
      return section.id;
    if (section.href && pathname === section.href) return section.id;
  }
  return null;
}
