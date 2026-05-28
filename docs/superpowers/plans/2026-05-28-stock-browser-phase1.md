# Stock Browser Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/stocks` as a modern stock discovery hub with curated grid, trending strip, enhanced cards, market status badges, slide-in add drawer with options integration, and watchlist toggles.

**Architecture:** SvelteKit page with server load + actions, 10 new Svelte components in `src/lib/components/stocks/`, static metadata map in `src/lib/data/stock-metadata.ts`, two new API routes, and a seed script. No schema changes.

**Tech Stack:** SvelteKit, TypeScript, Prisma (MySQL), existing CSS variable design system (`--primary`, `--success`, `--danger`, `--warning`, `--card`, `--border`, `--text`, `--muted`, `--surface-1`)

---

## Task 1: Seed script — insert ~75 curated assets

**Files:**
- Create: `prisma/seed-stocks.ts`

- [ ] **Step 1: Create the seed script**

```typescript
// prisma/seed-stocks.ts
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

interface SeedAsset {
  symbol: string; name: string; assetType: string;
  exchange: string; currency: string; country: string; sector?: string;
}

const ASSETS: SeedAsset[] = [
  // US Stocks
  { symbol:'AAPL',  name:'Apple Inc.',              assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'MSFT',  name:'Microsoft Corp.',          assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'NVDA',  name:'Nvidia Corp.',             assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'AMZN',  name:'Amazon.com Inc.',          assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Consumer Cyclical' },
  { symbol:'GOOGL', name:'Alphabet Inc.',            assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'META',  name:'Meta Platforms Inc.',      assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'TSLA',  name:'Tesla Inc.',               assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Consumer Cyclical' },
  { symbol:'JPM',   name:'JPMorgan Chase & Co.',     assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Finance' },
  { symbol:'V',     name:'Visa Inc.',                assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Finance' },
  { symbol:'UNH',   name:'UnitedHealth Group',       assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Healthcare' },
  { symbol:'XOM',   name:'Exxon Mobil Corp.',        assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Energy' },
  { symbol:'JNJ',   name:'Johnson & Johnson',        assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Healthcare' },
  { symbol:'WMT',   name:'Walmart Inc.',             assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Consumer Defensive' },
  { symbol:'PG',    name:'Procter & Gamble Co.',     assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Consumer Defensive' },
  { symbol:'MA',    name:'Mastercard Inc.',          assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Finance' },
  { symbol:'HD',    name:'Home Depot Inc.',          assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Consumer Cyclical' },
  { symbol:'AVGO',  name:'Broadcom Inc.',            assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'LLY',   name:'Eli Lilly and Co.',        assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Healthcare' },
  { symbol:'ABBV',  name:'AbbVie Inc.',              assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Healthcare' },
  { symbol:'CVX',   name:'Chevron Corp.',            assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Energy' },
  { symbol:'KO',    name:'Coca-Cola Co.',            assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Consumer Defensive' },
  { symbol:'PEP',   name:'PepsiCo Inc.',             assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Consumer Defensive' },
  { symbol:'BAC',   name:'Bank of America Corp.',    assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Finance' },
  { symbol:'COST',  name:'Costco Wholesale Corp.',   assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Consumer Defensive' },
  { symbol:'MCD',   name:'McDonald\'s Corp.',        assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Consumer Cyclical' },
  { symbol:'ADBE',  name:'Adobe Inc.',               assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  { symbol:'CRM',   name:'Salesforce Inc.',          assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Technology' },
  { symbol:'NFLX',  name:'Netflix Inc.',             assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Communication' },
  { symbol:'TMO',   name:'Thermo Fisher Scientific', assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Healthcare' },
  { symbol:'CSCO',  name:'Cisco Systems Inc.',       assetType:'stock', exchange:'NASDAQ', currency:'USD', country:'US', sector:'Technology' },
  // US ETFs
  { symbol:'VOO',   name:'Vanguard S&P 500 ETF',         assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'QQQ',   name:'Invesco QQQ Trust',            assetType:'etf', exchange:'NASDAQ', currency:'USD', country:'US' },
  { symbol:'SPY',   name:'SPDR S&P 500 ETF Trust',       assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'VTI',   name:'Vanguard Total Stock Market ETF', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'IVV',   name:'iShares Core S&P 500 ETF',     assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'VEA',   name:'Vanguard FTSE Developed Markets ETF', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'VWO',   name:'Vanguard FTSE Emerging Markets ETF', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'ARKK',  name:'ARK Innovation ETF',           assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'GLD',   name:'SPDR Gold Shares',             assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'TLT',   name:'iShares 20+ Year Treasury Bond ETF', assetType:'etf', exchange:'NASDAQ', currency:'USD', country:'US' },
  { symbol:'HYG',   name:'iShares iBoxx High Yield Corporate Bond ETF', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'XLK',   name:'Technology Select Sector SPDR Fund', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'XLF',   name:'Financial Select Sector SPDR Fund', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'SCHD',  name:'Schwab US Dividend Equity ETF', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  { symbol:'JEPI',  name:'JPMorgan Equity Premium Income ETF', assetType:'etf', exchange:'NYSE', currency:'USD', country:'US' },
  // MY Market
  { symbol:'1155.KL', name:'Malayan Banking Berhad',    assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Finance' },
  { symbol:'1295.KL', name:'Public Bank Berhad',        assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Finance' },
  { symbol:'5347.KL', name:'Tenaga Nasional Berhad',    assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Utilities' },
  { symbol:'1023.KL', name:'CIMB Group Holdings Berhad', assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Finance' },
  { symbol:'5225.KL', name:'IHH Healthcare Berhad',     assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Healthcare' },
  { symbol:'5183.KL', name:'Petronas Chemicals Group',  assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Energy' },
  { symbol:'6888.KL', name:'Axiata Group Berhad',       assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Communication' },
  { symbol:'6012.KL', name:'Maxis Berhad',              assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Communication' },
  { symbol:'1082.KL', name:'Hong Leong Financial Group', assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Finance' },
  { symbol:'1066.KL', name:'RHB Bank Berhad',           assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Finance' },
  { symbol:'5681.KL', name:'Petronas Dagangan Berhad',  assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Energy' },
  { symbol:'7277.KL', name:'Dialog Group Berhad',       assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Energy' },
  { symbol:'0820EA.KL', name:'KLCI ETF',                assetType:'etf',   exchange:'KLSE', currency:'MYR', country:'MY' },
  { symbol:'0821EA.KL', name:'MyETF Dow Jones Islamic Market Malaysia Titans 25', assetType:'etf', exchange:'KLSE', currency:'MYR', country:'MY' },
  { symbol:'5819.KL', name:'Hong Leong Bank Berhad',    assetType:'stock', exchange:'KLSE', currency:'MYR', country:'MY', sector:'Finance' },
  // HK Market
  { symbol:'0700.HK', name:'Tencent Holdings Ltd',      assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Technology' },
  { symbol:'0005.HK', name:'HSBC Holdings plc',         assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Finance' },
  { symbol:'1299.HK', name:'AIA Group Ltd',             assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Finance' },
  { symbol:'3690.HK', name:'Meituan',                   assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Technology' },
  { symbol:'9988.HK', name:'Alibaba Group Holding Ltd', assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Technology' },
  { symbol:'1211.HK', name:'BYD Co. Ltd',               assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Consumer Cyclical' },
  { symbol:'0941.HK', name:'China Mobile Ltd',          assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Communication' },
  { symbol:'0883.HK', name:'CNOOC Ltd',                 assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Energy' },
  { symbol:'2318.HK', name:'Ping An Insurance Group',   assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Finance' },
  { symbol:'0939.HK', name:'China Construction Bank',   assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Finance' },
  { symbol:'1810.HK', name:'Xiaomi Corp.',              assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Technology' },
  { symbol:'0388.HK', name:'Hong Kong Exchanges & Clearing', assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Finance' },
  { symbol:'2800.HK', name:'Tracker Fund of Hong Kong', assetType:'etf',   exchange:'HKEX', currency:'HKD', country:'HK' },
  { symbol:'3033.HK', name:'CSOP Hang Seng Tech Index ETF', assetType:'etf', exchange:'HKEX', currency:'HKD', country:'HK' },
  { symbol:'9618.HK', name:'JD.com Inc.',               assetType:'stock', exchange:'HKEX', currency:'HKD', country:'HK', sector:'Consumer Cyclical' },
];

async function main() {
  console.log(`Seeding ${ASSETS.length} assets…`);
  let upserted = 0;
  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: a.symbol },
      create: a,
      update: { name: a.name, assetType: a.assetType, exchange: a.exchange, currency: a.currency, country: a.country, sector: a.sector ?? null },
    });
    upserted++;
  }
  console.log(`Done — upserted ${upserted} assets.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run seed script**

```bash
cd c:/Ampps/www/portfolio
npx tsx prisma/seed-stocks.ts
```

Expected output:
```
Seeding 75 assets…
Done — upserted 75 assets.
```

- [ ] **Step 3: Verify no duplicates by running again**

```bash
npx tsx prisma/seed-stocks.ts
```

Expected: Same output — `Done — upserted 75 assets.` (no errors, no duplicates)

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-stocks.ts
git commit -m "feat(stocks): add curated seed script — 75 US/MY/HK assets"
```

---

## Task 2: Static metadata map

**Files:**
- Create: `src/lib/data/stock-metadata.ts`

- [ ] **Step 1: Create the metadata file**

```typescript
// src/lib/data/stock-metadata.ts

export interface StockMeta {
  tags: string[];
  aiSummary: string;
  pe: number | null;
  marketCap: string | null;
  dividendYield: number | null;
  sparkTrend: 'up' | 'down' | 'flat';
  wheelFriendly: boolean;
}

const DEFAULT_META: StockMeta = {
  tags: [], aiSummary: '', pe: null, marketCap: null,
  dividendYield: null, sparkTrend: 'flat', wheelFriendly: false,
};

export const STOCK_META: Record<string, StockMeta> = {
  AAPL:  { tags:['Growth','Beginner Friendly'],      aiSummary:'Premium consumer tech with strong ecosystem lock-in',    pe:28.4,  marketCap:'$2.9T',  dividendYield:0.52, sparkTrend:'up',   wheelFriendly:true  },
  MSFT:  { tags:['AI','Growth','Dividend'],           aiSummary:'Cloud and AI leader with recurring revenue model',       pe:34.2,  marketCap:'$3.1T',  dividendYield:0.72, sparkTrend:'up',   wheelFriendly:true  },
  NVDA:  { tags:['AI','Growth','High Risk'],          aiSummary:'Dominant AI chip maker with data center momentum',       pe:42.1,  marketCap:'$2.2T',  dividendYield:0.03, sparkTrend:'up',   wheelFriendly:true  },
  AMZN:  { tags:['Growth','AI'],                     aiSummary:'Cloud and e-commerce giant with AWS growth driver',      pe:38.5,  marketCap:'$2.0T',  dividendYield:null, sparkTrend:'up',   wheelFriendly:true  },
  GOOGL: { tags:['AI','Growth'],                     aiSummary:'Advertising and cloud giant with AI integration',        pe:22.8,  marketCap:'$1.9T',  dividendYield:null, sparkTrend:'up',   wheelFriendly:true  },
  META:  { tags:['AI','Growth'],                     aiSummary:'Social media and metaverse platform with AI ad tech',    pe:26.3,  marketCap:'$1.3T',  dividendYield:0.40, sparkTrend:'up',   wheelFriendly:true  },
  TSLA:  { tags:['Growth','High Risk'],              aiSummary:'EV pioneer with energy and robotics optionality',        pe:55.2,  marketCap:'$580B',  dividendYield:null, sparkTrend:'flat', wheelFriendly:true  },
  JPM:   { tags:['Dividend','Finance'],              aiSummary:'Largest US bank with diversified revenue streams',       pe:12.4,  marketCap:'$720B',  dividendYield:2.10, sparkTrend:'up',   wheelFriendly:true  },
  V:     { tags:['Growth','Dividend'],               aiSummary:'Global payments network with high margins',              pe:31.2,  marketCap:'$570B',  dividendYield:0.78, sparkTrend:'up',   wheelFriendly:true  },
  UNH:   { tags:['Defensive','Dividend'],            aiSummary:'Largest US health insurer with stable earnings',         pe:20.1,  marketCap:'$480B',  dividendYield:1.50, sparkTrend:'up',   wheelFriendly:true  },
  XOM:   { tags:['Dividend','Energy'],               aiSummary:'Integrated oil major with strong free cash flow',        pe:14.2,  marketCap:'$440B',  dividendYield:3.50, sparkTrend:'flat', wheelFriendly:true  },
  JNJ:   { tags:['Defensive','Dividend'],            aiSummary:'Healthcare conglomerate with dividend king status',       pe:15.8,  marketCap:'$380B',  dividendYield:3.10, sparkTrend:'flat', wheelFriendly:true  },
  WMT:   { tags:['Defensive','Dividend','Beginner Friendly'], aiSummary:'Retail giant with grocery and e-commerce growth', pe:32.4, marketCap:'$760B', dividendYield:1.10, sparkTrend:'up', wheelFriendly:true },
  PG:    { tags:['Defensive','Dividend'],            aiSummary:'Consumer staples leader with pricing power',             pe:25.6,  marketCap:'$390B',  dividendYield:2.40, sparkTrend:'up',   wheelFriendly:true  },
  MA:    { tags:['Growth','Dividend'],               aiSummary:'Global payments duopoly with high return on equity',     pe:34.8,  marketCap:'$450B',  dividendYield:0.58, sparkTrend:'up',   wheelFriendly:true  },
  HD:    { tags:['Dividend','Consumer'],             aiSummary:'Home improvement leader with professional market growth', pe:23.1, marketCap:'$355B',  dividendYield:2.60, sparkTrend:'flat', wheelFriendly:true  },
  AVGO:  { tags:['AI','Dividend','Growth'],          aiSummary:'Semiconductor and infrastructure software powerhouse',   pe:24.5,  marketCap:'$730B',  dividendYield:1.30, sparkTrend:'up',   wheelFriendly:true  },
  LLY:   { tags:['Growth','Healthcare'],             aiSummary:'GLP-1 drug pipeline driving outsized growth',            pe:48.2,  marketCap:'$680B',  dividendYield:0.72, sparkTrend:'up',   wheelFriendly:true  },
  ABBV:  { tags:['Dividend','Healthcare'],           aiSummary:'Pharma giant transitioning beyond Humira patent cliff',  pe:18.4,  marketCap:'$310B',  dividendYield:3.50, sparkTrend:'flat', wheelFriendly:true  },
  CVX:   { tags:['Dividend','Energy'],               aiSummary:'Major integrated oil with strong balance sheet',         pe:15.1,  marketCap:'$270B',  dividendYield:4.10, sparkTrend:'flat', wheelFriendly:true  },
  KO:    { tags:['Defensive','Dividend','Beginner Friendly'], aiSummary:'Beverage icon with global brand moat',           pe:22.4, marketCap:'$265B',  dividendYield:3.10, sparkTrend:'up',   wheelFriendly:true  },
  PEP:   { tags:['Defensive','Dividend'],            aiSummary:'Food and beverage giant with snack diversification',     pe:21.8,  marketCap:'$200B',  dividendYield:3.30, sparkTrend:'flat', wheelFriendly:true  },
  BAC:   { tags:['Dividend','Finance'],              aiSummary:'Major US bank sensitive to interest rate cycle',         pe:11.2,  marketCap:'$295B',  dividendYield:2.50, sparkTrend:'up',   wheelFriendly:true  },
  COST:  { tags:['Growth','Defensive'],              aiSummary:'Membership warehouse model with loyal customer base',    pe:50.1,  marketCap:'$380B',  dividendYield:0.55, sparkTrend:'up',   wheelFriendly:true  },
  MCD:   { tags:['Dividend','Defensive'],            aiSummary:'Fast food franchisor with global real estate assets',    pe:22.6,  marketCap:'$215B',  dividendYield:2.40, sparkTrend:'flat', wheelFriendly:true  },
  ADBE:  { tags:['Growth','AI'],                     aiSummary:'Creative software suite expanding into AI generation',   pe:28.4,  marketCap:'$210B',  dividendYield:null, sparkTrend:'flat', wheelFriendly:true  },
  CRM:   { tags:['AI','Growth'],                     aiSummary:'CRM leader integrating AI agents into enterprise sales', pe:30.2,  marketCap:'$260B',  dividendYield:null, sparkTrend:'up',   wheelFriendly:true  },
  NFLX:  { tags:['Growth','Streaming'],              aiSummary:'Streaming leader with ad tier and content moat',         pe:44.5,  marketCap:'$380B',  dividendYield:null, sparkTrend:'up',   wheelFriendly:true  },
  TMO:   { tags:['Growth','Healthcare'],             aiSummary:'Life science tools and services with recurring revenue',  pe:29.8,  marketCap:'$200B',  dividendYield:0.30, sparkTrend:'flat', wheelFriendly:false },
  CSCO:  { tags:['Dividend','Technology'],           aiSummary:'Networking hardware transitioning to software subscriptions', pe:15.4, marketCap:'$195B', dividendYield:3.30, sparkTrend:'flat', wheelFriendly:true },
  // ETFs
  VOO:   { tags:['ETF','Beginner Friendly','Diversified'], aiSummary:'Broad S&P 500 exposure at 0.03% expense ratio',   pe:22.1,  marketCap:null,     dividendYield:1.38, sparkTrend:'up',   wheelFriendly:false },
  QQQ:   { tags:['ETF','Growth','Technology'],       aiSummary:'NASDAQ-100 tech-focused index with strong momentum',    pe:30.4,  marketCap:null,     dividendYield:0.58, sparkTrend:'up',   wheelFriendly:true  },
  SPY:   { tags:['ETF','Beginner Friendly','Diversified'], aiSummary:'Most liquid S&P 500 ETF — ideal for options',     pe:22.1,  marketCap:null,     dividendYield:1.30, sparkTrend:'up',   wheelFriendly:true  },
  VTI:   { tags:['ETF','Beginner Friendly','Diversified'], aiSummary:'Total US market exposure across all cap sizes',   pe:21.8,  marketCap:null,     dividendYield:1.45, sparkTrend:'up',   wheelFriendly:false },
  IVV:   { tags:['ETF','Diversified'],               aiSummary:'iShares S&P 500 with tight bid-ask spreads',            pe:22.1,  marketCap:null,     dividendYield:1.32, sparkTrend:'up',   wheelFriendly:false },
  VEA:   { tags:['ETF','Diversified','International'], aiSummary:'Developed market international equity exposure',      pe:14.2,  marketCap:null,     dividendYield:3.20, sparkTrend:'flat', wheelFriendly:false },
  VWO:   { tags:['ETF','International','High Risk'], aiSummary:'Emerging market equity with higher growth potential',   pe:12.8,  marketCap:null,     dividendYield:3.50, sparkTrend:'flat', wheelFriendly:false },
  ARKK:  { tags:['ETF','High Risk','Growth'],        aiSummary:'Disruptive innovation fund with high volatility',       pe:null,  marketCap:null,     dividendYield:null, sparkTrend:'flat', wheelFriendly:false },
  GLD:   { tags:['ETF','Defensive'],                 aiSummary:'Physical gold exposure for inflation hedging',          pe:null,  marketCap:null,     dividendYield:null, sparkTrend:'flat', wheelFriendly:false },
  TLT:   { tags:['ETF','Income','Defensive'],        aiSummary:'Long-duration Treasury bonds for rate play',            pe:null,  marketCap:null,     dividendYield:4.20, sparkTrend:'down', wheelFriendly:false },
  HYG:   { tags:['ETF','Income','High Risk'],        aiSummary:'High yield corporate bonds with elevated credit risk',  pe:null,  marketCap:null,     dividendYield:5.10, sparkTrend:'flat', wheelFriendly:false },
  XLK:   { tags:['ETF','Technology','Growth'],       aiSummary:'Tech sector concentration with AAPL/MSFT dominance',   pe:29.8,  marketCap:null,     dividendYield:0.68, sparkTrend:'up',   wheelFriendly:false },
  XLF:   { tags:['ETF','Finance','Dividend'],        aiSummary:'Financial sector play on rising interest rates',        pe:14.2,  marketCap:null,     dividendYield:1.90, sparkTrend:'up',   wheelFriendly:false },
  SCHD:  { tags:['ETF','Dividend','Income'],         aiSummary:'High quality dividend growth stocks at low cost',       pe:17.4,  marketCap:null,     dividendYield:3.50, sparkTrend:'up',   wheelFriendly:false },
  JEPI:  { tags:['ETF','Income','Dividend'],         aiSummary:'Covered call income strategy with monthly distributions', pe:null, marketCap:null,    dividendYield:7.20, sparkTrend:'flat', wheelFriendly:false },
  // MY stocks — simplified
  '1155.KL': { tags:['Dividend','Finance'],   aiSummary:'Malaysia\'s largest bank by assets with strong dividend history', pe:12.8, marketCap:'RM95B', dividendYield:5.80, sparkTrend:'up',   wheelFriendly:false },
  '1295.KL': { tags:['Dividend','Finance'],   aiSummary:'Conservative banking leader with high loan quality',            pe:13.2, marketCap:'RM88B',  dividendYield:4.20, sparkTrend:'up',   wheelFriendly:false },
  '5347.KL': { tags:['Dividend','Utilities'], aiSummary:'National utility with regulated earnings and RE transition',    pe:16.4, marketCap:'RM75B',  dividendYield:4.50, sparkTrend:'flat', wheelFriendly:false },
  '1023.KL': { tags:['Dividend','Finance'],   aiSummary:'ASEAN-focused bank with digital banking growth',               pe:11.8, marketCap:'RM68B',  dividendYield:5.20, sparkTrend:'up',   wheelFriendly:false },
  '5225.KL': { tags:['Growth','Healthcare'],  aiSummary:'Largest private hospital operator in Asia',                    pe:38.2, marketCap:'RM52B',  dividendYield:1.10, sparkTrend:'up',   wheelFriendly:false },
  '5183.KL': { tags:['Dividend','Energy'],    aiSummary:'Petrochemical giant with upstream PETRONAS linkage',           pe:14.6, marketCap:'RM44B',  dividendYield:6.20, sparkTrend:'flat', wheelFriendly:false },
  '6888.KL': { tags:['Technology','Growth'],  aiSummary:'Telco group with data centre and digital asset exposure',      pe:22.4, marketCap:'RM32B',  dividendYield:3.80, sparkTrend:'flat', wheelFriendly:false },
  '6012.KL': { tags:['Dividend','Technology'], aiSummary:'Domestic telco with stable cashflow and 5G rollout',         pe:18.8, marketCap:'RM28B',  dividendYield:4.90, sparkTrend:'flat', wheelFriendly:false },
  '1082.KL': { tags:['Dividend','Finance'],   aiSummary:'Financial conglomerate with insurance and banking arms',       pe:13.4, marketCap:'RM22B',  dividendYield:3.40, sparkTrend:'up',   wheelFriendly:false },
  '1066.KL': { tags:['Dividend','Finance'],   aiSummary:'Mid-tier bank with improving ROE trajectory',                 pe:11.2, marketCap:'RM24B',  dividendYield:5.10, sparkTrend:'up',   wheelFriendly:false },
  '5681.KL': { tags:['Dividend','Energy'],    aiSummary:'Fuel retail and lubricant distributor under PETRONAS',        pe:16.8, marketCap:'RM20B',  dividendYield:5.60, sparkTrend:'flat', wheelFriendly:false },
  '7277.KL': { tags:['Growth','Energy'],      aiSummary:'Oil and gas services with LNG and tank terminal exposure',    pe:22.6, marketCap:'RM16B',  dividendYield:2.20, sparkTrend:'flat', wheelFriendly:false },
  '0820EA.KL': { tags:['ETF','Diversified','Beginner Friendly'], aiSummary:'Tracks FTSE Bursa Malaysia KLCI index', pe:null, marketCap:null, dividendYield:3.20, sparkTrend:'flat', wheelFriendly:false },
  '0821EA.KL': { tags:['ETF','Diversified'],  aiSummary:'Islamic index ETF covering top Malaysian equities',           pe:null, marketCap:null,     dividendYield:2.80, sparkTrend:'flat', wheelFriendly:false },
  '5819.KL': { tags:['Dividend','Finance'],   aiSummary:'Consumer banking leader with digital transformation focus',   pe:12.6, marketCap:'RM32B',  dividendYield:4.10, sparkTrend:'up',   wheelFriendly:false },
  // HK stocks — simplified
  '0700.HK': { tags:['Growth','Technology'],  aiSummary:'China tech giant spanning gaming, cloud and fintech',         pe:22.4, marketCap:'HK$3.6T', dividendYield:0.90, sparkTrend:'up',  wheelFriendly:false },
  '0005.HK': { tags:['Dividend','Finance'],   aiSummary:'Global bank with Asia Pacific revenue concentration',         pe:8.4,  marketCap:'HK$1.4T', dividendYield:6.80, sparkTrend:'up',  wheelFriendly:false },
  '1299.HK': { tags:['Dividend','Finance'],   aiSummary:'Pan-Asian insurance leader with long-term savings focus',     pe:18.2, marketCap:'HK$780B', dividendYield:2.30, sparkTrend:'up',  wheelFriendly:false },
  '3690.HK': { tags:['Growth','Technology'],  aiSummary:'Chinese food delivery and local services super-app',         pe:18.6, marketCap:'HK$540B', dividendYield:null, sparkTrend:'up',  wheelFriendly:false },
  '9988.HK': { tags:['Growth','Technology'],  aiSummary:'Chinese e-commerce and cloud computing conglomerate',        pe:14.2, marketCap:'HK$1.2T', dividendYield:null, sparkTrend:'up',  wheelFriendly:false },
  '1211.HK': { tags:['Growth','EV'],          aiSummary:'World\'s largest EV maker with energy storage diversification', pe:22.8, marketCap:'HK$680B', dividendYield:null, sparkTrend:'up', wheelFriendly:false },
  '0941.HK': { tags:['Dividend','Technology'], aiSummary:'China\'s largest telco with 5G and cloud infrastructure',  pe:10.2, marketCap:'HK$1.8T', dividendYield:6.40, sparkTrend:'flat', wheelFriendly:false },
  '0883.HK': { tags:['Dividend','Energy'],    aiSummary:'Offshore oil and gas producer with high dividend payout',    pe:8.6,  marketCap:'HK$580B', dividendYield:8.20, sparkTrend:'flat', wheelFriendly:false },
  '2318.HK': { tags:['Dividend','Finance'],   aiSummary:'Chinese insurance giant with investment portfolio scale',    pe:9.8,  marketCap:'HK$640B', dividendYield:5.40, sparkTrend:'flat', wheelFriendly:false },
  '0939.HK': { tags:['Dividend','Finance'],   aiSummary:'State-owned bank with policy lending and dividend stability', pe:5.4, marketCap:'HK$1.4T', dividendYield:7.80, sparkTrend:'flat', wheelFriendly:false },
  '1810.HK': { tags:['Growth','Technology'],  aiSummary:'Budget smartphone giant expanding into EVs and IoT',        pe:24.6, marketCap:'HK$320B', dividendYield:null, sparkTrend:'up',  wheelFriendly:false },
  '0388.HK': { tags:['Dividend','Finance'],   aiSummary:'Stock exchange operator benefiting from market volume growth', pe:28.4, marketCap:'HK$310B', dividendYield:3.20, sparkTrend:'up', wheelFriendly:false },
  '2800.HK': { tags:['ETF','Diversified','Beginner Friendly'], aiSummary:'Tracks Hang Seng Index — HK blue chips', pe:null, marketCap:null, dividendYield:3.40, sparkTrend:'flat', wheelFriendly:false },
  '3033.HK': { tags:['ETF','Technology','Growth'], aiSummary:'Hang Seng Tech Index — HK and China tech leaders',     pe:null, marketCap:null,     dividendYield:1.20, sparkTrend:'up',  wheelFriendly:false },
  '9618.HK': { tags:['Growth','Technology'],  aiSummary:'Chinese e-commerce and logistics with margin recovery',     pe:12.8, marketCap:'HK$380B', dividendYield:null, sparkTrend:'up',  wheelFriendly:false },
};

export const SECTOR_META: Partial<Record<string, Pick<StockMeta, 'tags' | 'aiSummary'>>> = {
  Technology:        { tags: ['Growth'],             aiSummary: 'Technology sector exposure' },
  Healthcare:        { tags: ['Defensive'],          aiSummary: 'Defensive healthcare exposure' },
  Finance:           { tags: ['Dividend'],           aiSummary: 'Financial sector income payer' },
  Energy:            { tags: ['Dividend'],           aiSummary: 'Commodity-driven energy stock' },
  'Consumer Defensive': { tags: ['Defensive','Dividend'], aiSummary: 'Defensive consumer staples' },
  'Consumer Cyclical':  { tags: ['Growth'],          aiSummary: 'Consumer discretionary exposure' },
  Utilities:         { tags: ['Defensive','Dividend'], aiSummary: 'Regulated utility with stable yield' },
  Communication:     { tags: ['Growth'],             aiSummary: 'Communications and media exposure' },
};

export function getStockMeta(symbol: string, sector?: string | null): StockMeta {
  if (STOCK_META[symbol]) return STOCK_META[symbol];
  const sectorFallback = SECTOR_META[sector ?? ''];
  return {
    ...DEFAULT_META,
    tags: sectorFallback?.tags ?? [],
    aiSummary: sectorFallback?.aiSummary ?? '',
  };
}

/** Generates a deterministic 7-point sparkline from the symbol string */
export function mockSparkline(symbol: string, trend: 'up' | 'down' | 'flat'): number[] {
  let seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const points = Array.from({ length: 7 }, () => 100 + (rand() - 0.5) * 10);
  if (trend === 'up')   points[6] = Math.max(...points) * 1.02;
  if (trend === 'down') points[6] = Math.min(...points) * 0.98;
  return points;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data/stock-metadata.ts
git commit -m "feat(stocks): add static stock metadata map with tags, PE, AI summaries"
```

---

## Task 3: Nav update

**Files:**
- Modify: `src/lib/config/nav.ts`

- [ ] **Step 1: Add Stocks to Portfolio section**

In `src/lib/config/nav.ts`, find the `portfolio` section and update it:

```typescript
  {
    id: 'portfolio',
    icon: '💼',
    label: 'Portfolio',
    matchPaths: ['/holdings', '/transactions', '/accounts', '/watchlist', '/snapshots', '/stocks'],
    children: [
      { label: 'Holdings',     href: '/holdings',     icon: '📋' },
      { label: 'Transactions', href: '/transactions', icon: '💱' },
      { label: 'Stocks',       href: '/stocks',       icon: '🏪' },
      { label: 'Watchlist',    href: '/watchlist',    icon: '👁️' },
      { label: 'Accounts',     href: '/accounts',     icon: '🏦' },
      { label: 'Snapshots',    href: '/snapshots',    icon: '📸' },
    ],
  },
```

- [ ] **Step 2: Verify nav compiles**

```bash
cd c:/Ampps/www/portfolio
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing errors unrelated to nav.ts)

- [ ] **Step 3: Commit**

```bash
git add src/lib/config/nav.ts
git commit -m "feat(stocks): add Stocks nav link under Portfolio section"
```

---

## Task 4: Yahoo Finance search API + ensure API

**Files:**
- Create: `src/routes/api/stocks/search/+server.ts`
- Create: `src/routes/api/stocks/ensure/+server.ts`

- [ ] **Step 1: Create search API**

```typescript
// src/routes/api/stocks/search/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const cache = new Map<string, { results: SearchResult[]; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ results: [] });

  const cached = cache.get(q);
  if (cached && cached.expiresAt > Date.now()) return json({ results: cached.results });

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioAI/1.0)' } }
    );
    if (!res.ok) return json({ results: [] });
    const data = await res.json();
    const results: SearchResult[] = (data.quotes ?? [])
      .filter((item: any) => item.symbol && (item.longname || item.shortname))
      .slice(0, 8)
      .map((item: any) => ({
        symbol:   item.symbol,
        name:     item.longname ?? item.shortname ?? item.symbol,
        exchange: item.exchange ?? '',
        type:     (item.quoteType ?? 'EQUITY').toLowerCase(),
      }));
    cache.set(q, { results, expiresAt: Date.now() + CACHE_TTL });
    return json({ results });
  } catch {
    return json({ results: [] });
  }
};
```

- [ ] **Step 2: Create ensure API**

```typescript
// src/routes/api/stocks/ensure/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

function inferCurrency(symbol: string): string {
  if (symbol.endsWith('.KL')) return 'MYR';
  if (symbol.endsWith('.HK')) return 'HKD';
  return 'USD';
}

function inferCountry(symbol: string): string {
  if (symbol.endsWith('.KL')) return 'MY';
  if (symbol.endsWith('.HK')) return 'HK';
  return 'US';
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const body = await request.json();
  const { symbol, name, exchange, type } = body as {
    symbol: string; name: string; exchange: string; type: string;
  };
  if (!symbol || !name) throw error(400, 'symbol and name are required');

  const assetType = ['etf', 'mutualfund'].includes(type) ? 'etf' : 'stock';
  const asset = await prisma.asset.upsert({
    where: { symbol },
    create: {
      symbol,
      name,
      assetType,
      exchange,
      currency: inferCurrency(symbol),
      country:  inferCountry(symbol),
    },
    update: {},
  });
  return json({ assetId: asset.id, symbol: asset.symbol });
};
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/stocks/search/+server.ts src/routes/api/stocks/ensure/+server.ts
git commit -m "feat(stocks): add Yahoo search proxy API and asset ensure endpoint"
```

---

## Task 5: Leaf components — InvestmentTag, SkeletonCard, MiniSparkline

**Files:**
- Create: `src/lib/components/stocks/InvestmentTag.svelte`
- Create: `src/lib/components/stocks/SkeletonCard.svelte`
- Create: `src/lib/components/stocks/MiniSparkline.svelte`

- [ ] **Step 1: Create InvestmentTag**

```svelte
<!-- src/lib/components/stocks/InvestmentTag.svelte -->
<script lang="ts">
  export let tag: string;

  const TAG_STYLES: Record<string, { bg: string; color: string }> = {
    'Dividend':          { bg: 'rgba(45,212,160,0.12)',  color: 'var(--success)' },
    'Growth':            { bg: 'rgba(108,143,255,0.12)', color: 'var(--primary)' },
    'AI':                { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
    'ETF':               { bg: 'rgba(108,143,255,0.08)', color: 'var(--muted)' },
    'Beginner Friendly': { bg: 'rgba(45,212,160,0.08)',  color: 'var(--success)' },
    'High Risk':         { bg: 'rgba(249,107,126,0.12)', color: 'var(--danger)' },
    'Defensive':         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    'Diversified':       { bg: 'rgba(122,143,176,0.12)', color: 'var(--muted)' },
    'Income':            { bg: 'rgba(45,212,160,0.12)',  color: 'var(--success)' },
    'Energy':            { bg: 'rgba(251,191,36,0.12)',  color: 'var(--warning)' },
    'Finance':           { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    'Healthcare':        { bg: 'rgba(45,212,160,0.10)',  color: 'var(--success)' },
    'Technology':        { bg: 'rgba(108,143,255,0.12)', color: 'var(--primary)' },
    'Utilities':         { bg: 'rgba(251,191,36,0.10)',  color: 'var(--warning)' },
    'International':     { bg: 'rgba(122,143,176,0.12)', color: 'var(--muted)' },
    'Streaming':         { bg: 'rgba(249,107,126,0.10)', color: 'var(--danger)' },
    'Consumer':          { bg: 'rgba(122,143,176,0.10)', color: 'var(--muted)' },
    'EV':                { bg: 'rgba(45,212,160,0.12)',  color: 'var(--success)' },
  };

  $: style = TAG_STYLES[tag] ?? { bg: 'rgba(122,143,176,0.1)', color: 'var(--muted)' };
</script>

<span class="tag" style="background:{style.bg};color:{style.color}">{tag}</span>

<style>
  .tag {
    display: inline-block;
    font-size: 0.62rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
    letter-spacing: 0.02em;
  }
</style>
```

- [ ] **Step 2: Create SkeletonCard**

```svelte
<!-- src/lib/components/stocks/SkeletonCard.svelte -->
<div class="skel-card">
  <div class="skel-row">
    <div class="skel" style="width:48px;height:14px"></div>
    <div class="skel" style="width:60px;height:24px;border-radius:4px"></div>
  </div>
  <div class="skel" style="width:80%;height:10px;margin-top:8px"></div>
  <div class="skel" style="width:60%;height:10px;margin-top:4px"></div>
  <div class="skel" style="width:100%;height:32px;margin-top:12px;border-radius:6px"></div>
</div>

<style>
  .skel-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    min-height: 160px;
  }
  .skel-row { display: flex; justify-content: space-between; align-items: flex-start; }
  .skel {
    background: linear-gradient(90deg,
      var(--border) 25%,
      rgba(255,255,255,0.06) 50%,
      var(--border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
```

- [ ] **Step 3: Create MiniSparkline**

```svelte
<!-- src/lib/components/stocks/MiniSparkline.svelte -->
<script lang="ts">
  import { mockSparkline } from '$lib/data/stock-metadata';

  export let symbol: string;
  export let trend: 'up' | 'down' | 'flat' = 'flat';

  const W = 64;
  const H = 28;

  $: points = mockSparkline(symbol, trend);
  $: {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const xs = points.map((_, i) => (i / (points.length - 1)) * W);
    const ys = points.map(p => H - ((p - min) / range) * H);
    polylinePoints = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  }

  let polylinePoints = '';
  $: color = trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--muted)';
</script>

<svg width={W} height={H} viewBox="0 0 {W} {H}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <polyline points={polylinePoints} stroke={color} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/stocks/InvestmentTag.svelte src/lib/components/stocks/SkeletonCard.svelte src/lib/components/stocks/MiniSparkline.svelte
git commit -m "feat(stocks): add InvestmentTag, SkeletonCard, MiniSparkline components"
```

---

## Task 6: MarketStatusBadge component

**Files:**
- Create: `src/lib/components/stocks/MarketStatusBadge.svelte`

- [ ] **Step 1: Create MarketStatusBadge**

```svelte
<!-- src/lib/components/stocks/MarketStatusBadge.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  interface Exchange {
    label: string; tz: string;
    openH: number; openM: number;
    closeH: number; closeM: number;
    lunchStart?: { h: number; m: number };
    lunchEnd?:   { h: number; m: number };
  }

  type Status = 'open' | 'lunch' | 'closed';

  const EXCHANGES: Exchange[] = [
    { label: 'US',  tz: 'America/New_York',   openH: 9,  openM: 30, closeH: 16, closeM: 0 },
    { label: 'HK',  tz: 'Asia/Hong_Kong',     openH: 9,  openM: 30, closeH: 16, closeM: 0,
      lunchStart: { h: 12, m: 0 }, lunchEnd: { h: 13, m: 0 } },
    { label: 'MY',  tz: 'Asia/Kuala_Lumpur',  openH: 9,  openM: 0,  closeH: 17, closeM: 0,
      lunchStart: { h: 12, m: 30 }, lunchEnd: { h: 14, m: 30 } },
  ];

  function getStatus(ex: Exchange): Status {
    const now = new Date();
    const str = now.toLocaleString('en-US', {
      timeZone: ex.tz, hour12: false,
      weekday: 'short', hour: '2-digit', minute: '2-digit',
    });
    // Format: "Mon, 09:30"
    const [weekday, time] = str.split(', ');
    const [hStr, mStr] = time.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (['Sat', 'Sun'].includes(weekday)) return 'closed';
    const mins  = h * 60 + m;
    const open  = ex.openH  * 60 + ex.openM;
    const close = ex.closeH * 60 + ex.closeM;
    if (mins < open || mins >= close) return 'closed';
    if (ex.lunchStart && ex.lunchEnd) {
      const ls = ex.lunchStart.h * 60 + ex.lunchStart.m;
      const le = ex.lunchEnd.h   * 60 + ex.lunchEnd.m;
      if (mins >= ls && mins < le) return 'lunch';
    }
    return 'open';
  }

  let statuses: { label: string; status: Status }[] = [];
  let interval: ReturnType<typeof setInterval>;

  function refresh() {
    statuses = EXCHANGES.map(ex => ({ label: ex.label, status: getStatus(ex) }));
  }

  onMount(() => {
    if (!browser) return;
    refresh();
    interval = setInterval(refresh, 60_000);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  const STATUS_LABEL: Record<Status, string> = {
    open:   'Open',
    lunch:  'Lunch',
    closed: 'Closed',
  };
  const DOT_COLOR: Record<Status, string> = {
    open:   'var(--success)',
    lunch:  'var(--warning)',
    closed: 'var(--muted)',
  };
</script>

{#if statuses.length > 0}
  <div class="market-badges">
    {#each statuses as s}
      <span class="badge">
        <span class="dot" style="background:{DOT_COLOR[s.status]}"></span>
        {s.label} {STATUS_LABEL[s.status]}
      </span>
    {/each}
  </div>
{/if}

<style>
  .market-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--muted);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 10px;
  }
  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/stocks/MarketStatusBadge.svelte
git commit -m "feat(stocks): add MarketStatusBadge with timezone-aware open/closed/lunch status"
```

---

## Task 7: WatchlistToggle component

**Files:**
- Create: `src/lib/components/stocks/WatchlistToggle.svelte`

- [ ] **Step 1: Create WatchlistToggle**

```svelte
<!-- src/lib/components/stocks/WatchlistToggle.svelte -->
<script lang="ts">
  export let assetId: string;
  export let watchlisted: boolean;

  let pulsing = false;
  let error = false;

  async function toggle() {
    const previous = watchlisted;
    watchlisted = !watchlisted;
    pulsing = true;
    setTimeout(() => pulsing = false, 200);

    const body = new FormData();
    body.set('assetId', assetId);

    try {
      const res = await fetch('?/toggleWatchlist', { method: 'POST', body });
      if (!res.ok) {
        watchlisted = previous;
        error = true;
        setTimeout(() => error = false, 2000);
      }
    } catch {
      watchlisted = previous;
      error = true;
      setTimeout(() => error = false, 2000);
    }
  }
</script>

<button
  class="wl-btn"
  class:active={watchlisted}
  class:pulse={pulsing}
  on:click|stopPropagation={toggle}
  title={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
  aria-label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
>
  {watchlisted ? '★' : '☆'}
</button>

{#if error}
  <span class="wl-error">Failed</span>
{/if}

<style>
  .wl-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--muted);
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s, transform 0.15s;
    line-height: 1;
  }
  .wl-btn.active { color: var(--warning); }
  .wl-btn:hover  { color: var(--warning); }
  .wl-btn.pulse  { transform: scale(1.35); }
  .wl-error {
    font-size: 0.62rem;
    color: var(--danger);
    position: absolute;
    top: 100%;
    right: 0;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/stocks/WatchlistToggle.svelte
git commit -m "feat(stocks): add WatchlistToggle with optimistic UI and error revert"
```

---

## Task 8: StockCard component

**Files:**
- Create: `src/lib/components/stocks/StockCard.svelte`

- [ ] **Step 1: Create StockCard**

```svelte
<!-- src/lib/components/stocks/StockCard.svelte -->
<script lang="ts">
  import type { Asset } from '@prisma/client';
  import type { StockMeta } from '$lib/data/stock-metadata';
  import MiniSparkline from './MiniSparkline.svelte';
  import InvestmentTag from './InvestmentTag.svelte';
  import WatchlistToggle from './WatchlistToggle.svelte';

  export let asset: Asset;
  export let meta: StockMeta;
  export let owned: { qty: number; avgCost: number } | undefined = undefined;
  export let watchlisted: boolean;
  export let onAdd: () => void;
  export let onWatchlist: ((val: boolean) => void) | undefined = undefined;

  $: price = asset.latestPrice;
  $: ownedGain = owned && price > 0 ? (price - owned.avgCost) * owned.qty : 0;
  $: ownedPct  = owned && owned.avgCost > 0 ? ((price - owned.avgCost) / owned.avgCost) * 100 : 0;
  $: displayTags = meta.tags.slice(0, 2);

  function fmt(n: number | null, currency = '') {
    if (n === null) return '—';
    return currency
      ? n.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toFixed(2);
  }
</script>

<div class="stock-card">
  <div class="card-top">
    <div class="card-symbol-row">
      <span class="symbol">{asset.symbol}</span>
      <div class="card-actions">
        <WatchlistToggle assetId={asset.id} bind:watchlisted on:toggle={(e) => onWatchlist?.(e.detail)} />
      </div>
    </div>
    <MiniSparkline symbol={asset.symbol} trend={meta.sparkTrend} />
  </div>

  <div class="card-name">{asset.name}</div>
  <div class="card-meta">
    {#if asset.exchange}<span>{asset.exchange}</span>{/if}
    {#if asset.sector}<span>· {asset.sector}</span>{/if}
  </div>

  <div class="card-price-row">
    <span class="price">
      {price > 0 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
      {#if asset.currency && asset.currency !== 'USD'}<span class="currency">{asset.currency}</span>{/if}
    </span>
    {#if owned && owned.qty > 0}
      <span class="owned-badge" class:gain={ownedGain >= 0} class:loss={ownedGain < 0}>
        {owned.qty.toFixed(owned.qty % 1 === 0 ? 0 : 2)} sh
        {ownedPct >= 0 ? '+' : ''}{ownedPct.toFixed(1)}%
      </span>
    {/if}
  </div>

  <div class="card-stats">
    {#if meta.pe !== null}<span>P/E {meta.pe}</span>{/if}
    {#if meta.marketCap}<span>Mkt {meta.marketCap}</span>{/if}
    {#if meta.dividendYield !== null}<span>Div {meta.dividendYield}%</span>{/if}
  </div>

  {#if displayTags.length > 0}
    <div class="card-tags">
      {#each displayTags as tag}
        <InvestmentTag {tag} />
      {/each}
    </div>
  {/if}

  {#if meta.aiSummary}
    <div class="card-ai-summary">"{meta.aiSummary}"</div>
  {/if}

  <button class="add-btn" on:click={onAdd}>+ Add to Portfolio</button>
</div>

<style>
  .stock-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s;
    position: relative;
  }
  .stock-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    border-color: rgba(108,143,255,0.3);
  }
  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .card-symbol-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .symbol {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 0.02em;
  }
  .card-actions { display: flex; align-items: center; }
  .card-name {
    font-size: 0.75rem;
    color: var(--text);
    font-weight: 500;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .card-meta {
    font-size: 0.68rem;
    color: var(--muted);
    display: flex;
    gap: 4px;
  }
  .card-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
  }
  .price {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text);
  }
  .currency { font-size: 0.65rem; color: var(--muted); margin-left: 2px; }
  .owned-badge {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .owned-badge.gain { background: rgba(45,212,160,0.12); color: var(--success); }
  .owned-badge.loss { background: rgba(249,107,126,0.12); color: var(--danger); }
  .card-stats {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .card-stats span {
    font-size: 0.65rem;
    color: var(--muted);
  }
  .card-tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .card-ai-summary {
    font-size: 0.65rem;
    color: var(--muted);
    font-style: italic;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .add-btn {
    margin-top: 4px;
    width: 100%;
    padding: 8px;
    background: rgba(108,143,255,0.1);
    border: 1px solid rgba(108,143,255,0.25);
    border-radius: 8px;
    color: var(--primary);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .add-btn:hover {
    background: rgba(108,143,255,0.18);
    border-color: var(--primary);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/stocks/StockCard.svelte
git commit -m "feat(stocks): add enhanced StockCard with sparkline, stats, tags, ownership badge"
```

---

## Task 9: TrendingStrip component

**Files:**
- Create: `src/lib/components/stocks/TrendingStrip.svelte`

- [ ] **Step 1: Create TrendingStrip**

```svelte
<!-- src/lib/components/stocks/TrendingStrip.svelte -->
<script lang="ts">
  import type { Asset } from '@prisma/client';

  export let assets: Asset[];

  interface TrendingCategory {
    id: string; emoji: string; label: string; symbols: string[];
  }

  const CATEGORIES: TrendingCategory[] = [
    { id: 'trending',  emoji: '🔥', label: 'Trending',      symbols: ['NVDA','TSLA','META','AAPL','MSFT'] },
    { id: 'dividend',  emoji: '💰', label: 'High Dividend',  symbols: ['JEPI','SCHD','1155.KL','1295.KL','VOO'] },
    { id: 'volume',    emoji: '⚡', label: 'High Volume',    symbols: ['SPY','QQQ','AMZN','0700.HK','AAPL'] },
    { id: 'ai',        emoji: '🚀', label: 'AI Stocks',      symbols: ['NVDA','MSFT','GOOGL','META','CRM'] },
    { id: 'defensive', emoji: '🛡', label: 'Defensive',      symbols: ['JNJ','KO','PG','WMT','ABBV'] },
    { id: 'mostAdded', emoji: '📈', label: 'Most Added',     symbols: ['VOO','AAPL','VTI','QQQ','MSFT'] },
    { id: 'aiPicks',   emoji: '🧠', label: 'AI Picks',       symbols: ['NVDA','AVGO','CRM','MSFT','GOOGL'] },
  ];

  let activeId: string | null = null;

  $: assetMap = new Map(assets.map(a => [a.symbol, a]));

  function getCategoryAssets(symbols: string[]): Asset[] {
    return symbols.flatMap(s => assetMap.get(s) ? [assetMap.get(s)!] : []);
  }

  function toggle(id: string) {
    activeId = activeId === id ? null : id;
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ add: Asset }>();
</script>

<div class="trending-wrapper">
  <div class="strip" role="list">
    {#each CATEGORIES as cat}
      <button
        class="pill"
        class:active={activeId === cat.id}
        on:click={() => toggle(cat.id)}
        role="listitem"
      >
        <span class="emoji">{cat.emoji}</span>
        <span class="pill-label">{cat.label}</span>
      </button>
    {/each}
  </div>

  {#if activeId}
    {@const active = CATEGORIES.find(c => c.id === activeId)!}
    {@const items = getCategoryAssets(active.symbols)}
    <div class="expanded-panel">
      {#if items.length === 0}
        <span class="empty">Seed the database first — run <code>npx tsx prisma/seed-stocks.ts</code></span>
      {:else}
        {#each items as asset}
          <div class="mini-row">
            <div class="mini-info">
              <span class="mini-symbol">{asset.symbol}</span>
              <span class="mini-name">{asset.name}</span>
            </div>
            <div class="mini-right">
              {#if asset.latestPrice > 0}
                <span class="mini-price">{asset.latestPrice.toFixed(2)}</span>
              {:else}
                <span class="mini-price muted">—</span>
              {/if}
              <button class="mini-add" on:click={() => dispatch('add', asset)}>+ Add</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .trending-wrapper { margin-bottom: 20px; }
  .strip {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
  }
  .strip::-webkit-scrollbar { display: none; }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    min-height: 34px;
    scroll-snap-align: start;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .pill:hover, .pill.active {
    border-color: var(--primary);
    background: rgba(108,143,255,0.1);
    color: var(--primary);
  }
  .emoji { font-size: 0.85rem; }
  .expanded-panel {
    margin-top: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .mini-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .mini-row:last-child { border-bottom: none; }
  .mini-row:hover { background: rgba(255,255,255,0.02); }
  .mini-info { display: flex; align-items: center; gap: 10px; }
  .mini-symbol { font-size: 0.78rem; font-weight: 700; color: var(--text); min-width: 72px; }
  .mini-name   { font-size: 0.72rem; color: var(--muted); }
  .mini-right  { display: flex; align-items: center; gap: 10px; }
  .mini-price  { font-size: 0.78rem; font-weight: 600; color: var(--text); min-width: 50px; text-align: right; }
  .mini-price.muted { color: var(--muted); }
  .mini-add {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid rgba(108,143,255,0.3);
    background: rgba(108,143,255,0.08);
    color: var(--primary);
    cursor: pointer;
    transition: background 0.12s;
  }
  .mini-add:hover { background: rgba(108,143,255,0.18); }
  .empty { display: block; padding: 12px 14px; font-size: 0.72rem; color: var(--muted); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/stocks/TrendingStrip.svelte
git commit -m "feat(stocks): add TrendingStrip with expandable category panels"
```

---

## Task 10: AddDrawer component

**Files:**
- Create: `src/lib/components/stocks/AddDrawer.svelte`

- [ ] **Step 1: Create AddDrawer**

```svelte
<!-- src/lib/components/stocks/AddDrawer.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { Asset } from '@prisma/client';
  import { getStockMeta } from '$lib/data/stock-metadata';

  export let open = false;
  export let selectedAsset: Asset | null = null;

  let activeTab: 'shares' | 'options' = 'shares';
  let txType: 'BUY' | 'SELL' = 'BUY';
  let quantity = '';
  let price = '';
  let tradeDate = new Date().toISOString().slice(0, 10);
  let fee = '';
  let submitting = false;
  let successMsg = '';
  let errorMsg = '';

  $: if (selectedAsset) {
    price = selectedAsset.latestPrice > 0 ? selectedAsset.latestPrice.toFixed(2) : '';
    activeTab = 'shares';
    txType = 'BUY';
    quantity = '';
    fee = '';
    successMsg = '';
    errorMsg = '';
  }

  $: meta = selectedAsset ? getStockMeta(selectedAsset.symbol, selectedAsset.sector) : null;

  function close() {
    open = false;
    selectedAsset = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && selectedAsset}
  <!-- Backdrop -->
  <div class="backdrop" on:click={close} aria-hidden="true"></div>

  <!-- Drawer panel -->
  <div class="drawer" class:open role="dialog" aria-modal="true" aria-label="Add {selectedAsset.symbol} to portfolio">
    <!-- Header -->
    <div class="drawer-header">
      <div class="asset-info">
        <span class="asset-symbol">{selectedAsset.symbol}</span>
        <span class="asset-name">{selectedAsset.name}</span>
        {#if selectedAsset.exchange}<span class="asset-exchange">{selectedAsset.exchange}</span>{/if}
        {#if selectedAsset.latestPrice > 0}
          <span class="asset-price">${selectedAsset.latestPrice.toFixed(2)}</span>
        {/if}
      </div>
      <button class="close-btn" on:click={close} aria-label="Close">✕</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" class:active={activeTab === 'shares'} on:click={() => activeTab = 'shares'}>
        📈 Buy Shares
      </button>
      <button class="tab" class:active={activeTab === 'options'} on:click={() => activeTab = 'options'}>
        ⚙ Trade Options
      </button>
    </div>

    <!-- Buy Shares tab -->
    {#if activeTab === 'shares'}
      <div class="drawer-body">
        {#if successMsg}
          <div class="success-msg">✓ {successMsg}</div>
        {/if}
        {#if errorMsg}
          <div class="error-msg">⚠ {errorMsg}</div>
        {/if}

        <form
          method="POST"
          action="?/add"
          use:enhance={() => {
            submitting = true;
            errorMsg = '';
            return async ({ result, update }) => {
              submitting = false;
              if (result.type === 'success' && result.data?.added) {
                successMsg = `Added ${selectedAsset?.symbol}!`;
                quantity = '';
                setTimeout(() => successMsg = '', 2000);
              } else if (result.type === 'failure') {
                errorMsg = (result.data?.error as string) ?? 'Failed to add transaction';
              }
              await update({ reset: false });
            };
          }}
        >
          <input type="hidden" name="assetId" value={selectedAsset.id} />
          <input type="hidden" name="symbol"  value={selectedAsset.symbol} />

          <!-- Type toggle -->
          <div class="field-group">
            <label class="field-label">Type</label>
            <div class="type-toggle">
              <button type="button" class="type-btn" class:active={txType === 'BUY'} on:click={() => txType = 'BUY'}>BUY</button>
              <button type="button" class="type-btn sell" class:active={txType === 'SELL'} on:click={() => txType = 'SELL'}>SELL</button>
            </div>
            <input type="hidden" name="type" value={txType} />
          </div>

          <div class="field-group">
            <label class="field-label" for="qty">Quantity</label>
            <input id="qty" class="field-input" name="quantity" type="number" step="0.000001" min="0.000001"
              placeholder="e.g. 10" bind:value={quantity} required />
          </div>

          <div class="field-group">
            <label class="field-label" for="px">Price per share</label>
            <input id="px" class="field-input" name="price" type="number" step="0.0001" min="0.0001"
              placeholder="e.g. 189.30" bind:value={price} required />
          </div>

          <div class="field-group">
            <label class="field-label" for="dt">Trade date</label>
            <input id="dt" class="field-input" name="tradeDate" type="date" bind:value={tradeDate} required />
          </div>

          <div class="field-group">
            <label class="field-label" for="fee">Fee <span class="optional">(optional)</span></label>
            <input id="fee" class="field-input" name="fee" type="number" step="0.01" min="0"
              placeholder="0.00" bind:value={fee} />
          </div>

          <button class="submit-btn" type="submit" disabled={submitting || !quantity || !price}>
            {submitting ? 'Adding…' : `Add ${txType} Transaction`}
          </button>
        </form>
      </div>
    {/if}

    <!-- Trade Options tab -->
    {#if activeTab === 'options'}
      <div class="drawer-body">
        <p class="options-desc">Open the Wheel Strategy tool with <strong>{selectedAsset.symbol}</strong> pre-selected.</p>

        <a
          href="/optimization/options/wheel?symbol={selectedAsset.symbol}"
          class="wheel-btn"
          on:click={close}
        >
          Open Wheel Strategy →
        </a>

        <div class="wheel-readiness">
          <div class="readiness-title">Wheel Readiness</div>
          {#if meta?.wheelFriendly}
            <div class="readiness-row good">✅ Wheel Friendly</div>
            <div class="readiness-row good">Weekly options available</div>
            <div class="readiness-row good">High liquidity</div>
          {:else}
            <div class="readiness-row warn">⚠ Low option liquidity</div>
            <div class="readiness-row muted">May have wide bid-ask spreads</div>
          {/if}
          <div class="readiness-future">Live IV data — Phase 2</div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 40;
    animation: fadeIn 0.2s ease;
  }
  .drawer {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: 380px;
    background: var(--card);
    border-left: 1px solid var(--border);
    z-index: 50;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
    overflow-y: auto;
  }
  .drawer.open { transform: translateX(0); }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .drawer-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }
  .asset-info { display: flex; flex-direction: column; gap: 2px; }
  .asset-symbol { font-size: 1rem; font-weight: 700; color: var(--text); }
  .asset-name   { font-size: 0.75rem; color: var(--muted); }
  .asset-exchange { font-size: 0.68rem; color: var(--muted); }
  .asset-price  { font-size: 0.8rem; font-weight: 600; color: var(--success); }
  .close-btn {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 0.9rem; padding: 2px 6px;
    border-radius: 4px; flex-shrink: 0;
    transition: color 0.1s;
  }
  .close-btn:hover { color: var(--text); }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }
  .tab {
    flex: 1;
    padding: 10px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab.active { color: var(--primary); border-bottom-color: var(--primary); }

  .drawer-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: 1; }

  .field-group { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: 0.68rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .optional { font-weight: 400; text-transform: none; }
  .field-input {
    background: var(--bg, #080d18);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 10px;
    color: var(--text);
    font-size: 0.82rem;
    width: 100%;
    transition: border-color 0.15s;
  }
  .field-input:focus { outline: none; border-color: var(--primary); }

  .type-toggle { display: flex; gap: 0; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); width: fit-content; }
  .type-btn {
    padding: 6px 16px;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .type-btn.active { background: rgba(108,143,255,0.15); color: var(--primary); }
  .type-btn.sell.active { background: rgba(249,107,126,0.15); color: var(--danger); }

  .submit-btn {
    padding: 10px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: auto;
    transition: opacity 0.15s;
  }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .success-msg {
    background: rgba(45,212,160,0.1);
    border: 1px solid rgba(45,212,160,0.3);
    border-radius: 6px;
    color: var(--success);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 8px 12px;
    animation: fadeIn 0.15s ease;
  }
  .error-msg {
    background: rgba(249,107,126,0.1);
    border: 1px solid rgba(249,107,126,0.3);
    border-radius: 6px;
    color: var(--danger);
    font-size: 0.78rem;
    padding: 8px 12px;
  }

  .options-desc { font-size: 0.78rem; color: var(--muted); line-height: 1.5; }
  .wheel-btn {
    display: block;
    padding: 10px;
    background: rgba(108,143,255,0.1);
    border: 1px solid rgba(108,143,255,0.3);
    border-radius: 8px;
    color: var(--primary);
    font-size: 0.82rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    transition: background 0.15s;
  }
  .wheel-btn:hover { background: rgba(108,143,255,0.18); }

  .wheel-readiness {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .readiness-title { font-size: 0.72rem; font-weight: 700; color: var(--text); margin-bottom: 2px; }
  .readiness-row { font-size: 0.72rem; }
  .readiness-row.good  { color: var(--success); }
  .readiness-row.warn  { color: var(--warning); }
  .readiness-row.muted { color: var(--muted); }
  .readiness-future {
    font-size: 0.65rem;
    color: var(--muted);
    font-style: italic;
    border-top: 1px solid var(--border);
    padding-top: 6px;
    margin-top: 2px;
  }

  @media (max-width: 767px) {
    .drawer { width: 100%; left: 0; border-left: none; border-top: 1px solid var(--border); }
    .submit-btn { position: sticky; bottom: 0; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/stocks/AddDrawer.svelte
git commit -m "feat(stocks): add slide-in AddDrawer with Buy Shares and Trade Options tabs"
```

---

## Task 11: Page server — load + actions

**Files:**
- Create: `src/routes/stocks/+page.server.ts`

- [ ] **Step 1: Create page server**

```typescript
// src/routes/stocks/+page.server.ts
import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;

  const [assets, transactions, watchlistItems] = await Promise.all([
    prisma.asset.findMany({
      orderBy: [{ country: 'asc' }, { symbol: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ['BUY', 'SELL'] } },
      select: { assetId: true, type: true, quantity: true, price: true },
    }),
    prisma.watchlistItem.findMany({
      where: { watchlist: { userId: user.id } },
      select: { assetId: true },
    }),
  ]);

  // Compute owned qty + avg cost per assetId
  const ownedMap: Record<string, { qty: number; avgCost: number }> = {};
  for (const tx of transactions) {
    if (!tx.assetId) continue;
    const existing = ownedMap[tx.assetId] ?? { qty: 0, avgCost: 0 };
    if (tx.type === 'BUY') {
      const totalCost = existing.avgCost * existing.qty + tx.price * tx.quantity;
      const totalQty  = existing.qty + tx.quantity;
      ownedMap[tx.assetId] = { qty: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 };
    } else {
      ownedMap[tx.assetId] = {
        qty:     Math.max(0, existing.qty - tx.quantity),
        avgCost: existing.avgCost,
      };
    }
  }

  const watchlistSet = watchlistItems.map(w => w.assetId);

  return { assets, ownedMap, watchlistSet };
};

export const actions: Actions = {
  add: async ({ request, locals }) => {
    const user = locals.user!;
    const data = await request.formData();

    const assetId  = data.get('assetId') as string | null;
    const symbol   = data.get('symbol')  as string | null;
    const type     = (data.get('type')   as string | null)?.toUpperCase();
    const qtyRaw   = data.get('quantity') as string | null;
    const priceRaw = data.get('price')    as string | null;
    const dateRaw  = data.get('tradeDate') as string | null;
    const feeRaw   = data.get('fee')       as string | null;

    if (!assetId)            return fail(400, { error: 'Asset is required' });
    if (!type || !['BUY','SELL'].includes(type)) return fail(400, { error: 'Type must be BUY or SELL' });
    if (!qtyRaw || parseFloat(qtyRaw) <= 0)      return fail(400, { error: 'Quantity must be greater than 0' });
    if (!priceRaw || parseFloat(priceRaw) <= 0)  return fail(400, { error: 'Price must be greater than 0' });
    if (!dateRaw)            return fail(400, { error: 'Trade date is required' });

    const account = await prisma.account.findFirst({ where: { userId: user.id } });
    if (!account) return fail(400, { error: 'No portfolio account found. Create one first.' });

    await prisma.transaction.create({
      data: {
        userId:    user.id,
        accountId: account.id,
        assetId,
        type:      type.toLowerCase(),
        quantity:  parseFloat(qtyRaw),
        price:     parseFloat(priceRaw),
        tradeDate: new Date(dateRaw),
        fee:       feeRaw ? parseFloat(feeRaw) : 0,
        currency:  'USD',
      },
    });

    return { added: true, symbol: symbol ?? '' };
  },

  toggleWatchlist: async ({ request, locals }) => {
    const user = locals.user!;
    const data = await request.formData();
    const assetId = data.get('assetId') as string | null;
    if (!assetId) return fail(400, { error: 'assetId required' });

    // Ensure watchlist exists
    let wl = await prisma.watchlist.findFirst({ where: { userId: user.id } });
    if (!wl) {
      wl = await prisma.watchlist.create({
        data: { userId: user.id, name: 'Watchlist' },
      });
    }

    const existing = await prisma.watchlistItem.findFirst({
      where: { watchlistId: wl.id, assetId },
    });

    if (existing) {
      await prisma.watchlistItem.delete({ where: { id: existing.id } });
      return { watchlisted: false };
    } else {
      await prisma.watchlistItem.create({ data: { watchlistId: wl.id, assetId } });
      return { watchlisted: true };
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/stocks/+page.server.ts
git commit -m "feat(stocks): add page server with load, add transaction, and toggleWatchlist actions"
```

---

## Task 12: Main page — assemble everything

**Files:**
- Create: `src/routes/stocks/+page.svelte`

- [ ] **Step 1: Create the page**

```svelte
<!-- src/routes/stocks/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  import type { Asset } from '@prisma/client';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import MarketStatusBadge from '$lib/components/stocks/MarketStatusBadge.svelte';
  import TrendingStrip from '$lib/components/stocks/TrendingStrip.svelte';
  import StockCard from '$lib/components/stocks/StockCard.svelte';
  import SkeletonCard from '$lib/components/stocks/SkeletonCard.svelte';
  import AddDrawer from '$lib/components/stocks/AddDrawer.svelte';
  import { getStockMeta } from '$lib/data/stock-metadata';

  export let data: PageData;

  type Tab = 'all' | 'us-stocks' | 'us-etfs' | 'my' | 'hk';
  const TABS: { id: Tab; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'us-stocks', label: 'US Stocks' },
    { id: 'us-etfs',  label: 'US ETFs' },
    { id: 'my',       label: 'MY Market' },
    { id: 'hk',       label: 'HK Market' },
  ];

  let activeTab: Tab = 'all';
  let query = '';
  let searchResults: { symbol: string; name: string; exchange: string; type: string }[] = [];
  let searching = false;
  let searchTimer: ReturnType<typeof setTimeout>;

  let drawerOpen = false;
  let selectedAsset: Asset | null = null;

  // Local reactive copies for optimistic watchlist toggle
  let watchlistSet = new Set(data.watchlistSet);

  $: filteredAssets = data.assets.filter(a => {
    if (activeTab === 'all')       return true;
    if (activeTab === 'us-stocks') return a.country === 'US' && a.assetType === 'stock';
    if (activeTab === 'us-etfs')   return a.country === 'US' && a.assetType === 'etf';
    if (activeTab === 'my')        return a.country === 'MY';
    if (activeTab === 'hk')        return a.country === 'HK';
    return true;
  });

  // Debounced search
  $: {
    clearTimeout(searchTimer);
    if (query.length >= 2) {
      searchTimer = setTimeout(doSearch, 400);
    } else {
      searchResults = [];
      searching = false;
    }
  }

  async function doSearch() {
    searching = true;
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      searchResults = body.results ?? [];
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function openDrawer(asset: Asset) {
    selectedAsset = asset;
    drawerOpen = true;
  }

  async function openDrawerFromSearch(r: { symbol: string; name: string; exchange: string; type: string }) {
    // Ensure asset exists in DB first
    try {
      const res = await fetch('/api/stocks/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      });
      const body = await res.json();
      if (!body.assetId) return;

      // Find asset in data.assets or create a minimal one for the drawer
      const existing = data.assets.find(a => a.symbol === r.symbol);
      if (existing) {
        openDrawer(existing);
      } else {
        // Create minimal Asset-like object — page will refresh on submit
        openDrawer({
          id: body.assetId, symbol: r.symbol, name: r.name,
          assetType: r.type, exchange: r.exchange,
          currency: r.symbol.endsWith('.KL') ? 'MYR' : r.symbol.endsWith('.HK') ? 'HKD' : 'USD',
          country:  r.symbol.endsWith('.KL') ? 'MY'  : r.symbol.endsWith('.HK') ? 'HK'  : 'US',
          sector: null, latestPrice: 0,
          createdAt: new Date(), updatedAt: new Date(),
        } as Asset);
      }
    } catch {
      // Silently fail — user can still navigate to /transactions
    }
  }
</script>

<PageHeader
  title="Stocks"
  subtitle="Discover and add securities to your portfolio"
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Stocks' }]}
/>

<MarketStatusBadge />

<TrendingStrip assets={data.assets} on:add={(e) => openDrawer(e.detail)} />

<!-- Search -->
<div class="search-bar">
  <span class="search-icon">🔍</span>
  <input
    class="search-input"
    type="text"
    placeholder="Search any symbol or company name…"
    bind:value={query}
    autocomplete="off"
    spellcheck="false"
  />
  {#if query}
    <button class="search-clear" on:click={() => query = ''} aria-label="Clear search">✕</button>
  {/if}
</div>

<!-- Search results -->
{#if query.length >= 2}
  <div class="search-results" class:visible={true}>
    {#if searching}
      <div class="search-loading">
        {#each Array(3) as _}
          <div class="skel-row-item">
            <div class="skel" style="width:60px;height:12px"></div>
            <div class="skel" style="width:40px;height:20px;border-radius:4px"></div>
          </div>
        {/each}
      </div>
    {:else if searchResults.length === 0}
      <div class="search-empty">No results for "<strong>{query}</strong>"</div>
    {:else}
      {#each searchResults as r}
        <div class="search-row">
          <div class="search-row-info">
            <span class="search-symbol">{r.symbol}</span>
            <span class="search-name">{r.name}</span>
            {#if r.exchange}<span class="search-exchange">{r.exchange}</span>{/if}
          </div>
          <button class="search-add-btn" on:click={() => openDrawerFromSearch(r)}>+ Add</button>
        </div>
      {/each}
    {/if}
  </div>
{:else}
  <!-- Tabs -->
  <div class="tabs" role="tablist">
    {#each TABS as t}
      <button
        class="tab-btn"
        class:active={activeTab === t.id}
        role="tab"
        aria-selected={activeTab === t.id}
        on:click={() => activeTab = t.id}
      >
        {t.label}
        <span class="tab-count">
          {t.id === 'all' ? data.assets.length
            : t.id === 'us-stocks' ? data.assets.filter(a => a.country === 'US' && a.assetType === 'stock').length
            : t.id === 'us-etfs'   ? data.assets.filter(a => a.country === 'US' && a.assetType === 'etf').length
            : t.id === 'my'        ? data.assets.filter(a => a.country === 'MY').length
            :                        data.assets.filter(a => a.country === 'HK').length}
        </span>
      </button>
    {/each}
  </div>

  <!-- Card grid -->
  {#if filteredAssets.length === 0}
    <div class="empty-state">
      No assets found. Run <code>npx tsx prisma/seed-stocks.ts</code> to populate the browser.
    </div>
  {:else}
    <div class="stock-grid">
      {#each filteredAssets as asset, i (asset.id)}
        <div style="animation-delay:{Math.min(i * 30, 300)}ms" class="card-wrapper">
          <StockCard
            {asset}
            meta={getStockMeta(asset.symbol, asset.sector)}
            owned={data.ownedMap[asset.id]}
            watchlisted={watchlistSet.has(asset.id)}
            onAdd={() => openDrawer(asset)}
          />
        </div>
      {/each}
    </div>
  {/if}
{/if}

<!-- Add drawer -->
<AddDrawer bind:open={drawerOpen} bind:selectedAsset />

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
    transition: border-color 0.15s;
  }
  .search-bar:focus-within { border-color: var(--primary); }
  .search-icon { font-size: 1rem; flex-shrink: 0; }
  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 0.88rem;
    min-width: 0;
  }
  .search-input::placeholder { color: var(--muted); }
  .search-input { font-size: 1rem; } /* ≥16px prevents iOS zoom */
  .search-clear {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 0.75rem; padding: 2px;
    transition: color 0.1s;
  }
  .search-clear:hover { color: var(--text); }

  .search-results {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 16px;
    overflow: hidden;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .search-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .search-row:last-child { border-bottom: none; }
  .search-row:hover { background: rgba(255,255,255,0.02); }
  .search-row-info { display: flex; align-items: center; gap: 10px; }
  .search-symbol   { font-size: 0.82rem; font-weight: 700; color: var(--text); min-width: 80px; }
  .search-name     { font-size: 0.75rem; color: var(--muted); }
  .search-exchange { font-size: 0.68rem; color: var(--muted); }
  .search-add-btn {
    font-size: 0.72rem; font-weight: 600;
    padding: 4px 12px; border-radius: 6px;
    border: 1px solid rgba(108,143,255,0.3);
    background: rgba(108,143,255,0.08);
    color: var(--primary); cursor: pointer;
    transition: background 0.12s;
  }
  .search-add-btn:hover { background: rgba(108,143,255,0.18); }
  .search-empty { padding: 16px 14px; font-size: 0.78rem; color: var(--muted); }
  .search-loading { padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; }
  .skel-row-item  { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
  .skel {
    background: linear-gradient(90deg, var(--border) 25%, rgba(255,255,255,0.06) 50%, var(--border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: none;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .tab-btn.active {
    background: rgba(108,143,255,0.12);
    border-color: var(--primary);
    color: var(--primary);
  }
  .tab-count {
    font-size: 0.62rem;
    background: rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 1px 5px;
  }

  .stock-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .card-wrapper {
    animation: cardIn 0.25s ease both;
  }
  @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--muted);
    font-size: 0.82rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  @media (max-width: 1023px) {
    .stock-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 767px) {
    .stock-grid { grid-template-columns: 1fr; }
    .tabs { overflow-x: auto; flex-wrap: nowrap; }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/stocks/+page.svelte
git commit -m "feat(stocks): add main stocks browse page with search, tabs, grid, and drawer"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run type check**

```bash
cd c:/Ampps/www/portfolio
npx tsc --noEmit 2>&1 | grep -v node_modules | head -40
```

Expected: No errors in the new files. Fix any that appear.

- [ ] **Step 2: Start dev server and verify the page loads**

```bash
npm run dev
```

Open `http://localhost:5173/stocks` — expect:
- MarketStatusBadge shows US/HK/MY status
- TrendingStrip shows 7 category pills
- Cards grid shows 0 cards (until seed runs) or full grid if seed already ran
- Search bar present

- [ ] **Step 3: Run seed if not done yet**

```bash
npx tsx prisma/seed-stocks.ts
```

Reload `/stocks` — expect ~75 cards across tabs.

- [ ] **Step 4: Test add flow**

1. Click "+ Add" on any card
2. Drawer slides in from right with asset name + price pre-filled
3. Enter quantity `10`, confirm price is set
4. Click "Add BUY Transaction"
5. See ✓ "Added AAPL!" message
6. Drawer stays open

- [ ] **Step 5: Test options tab**

1. Open drawer on any US stock
2. Click "Trade Options" tab
3. Click "Open Wheel Strategy →" — should navigate to `/optimization/options/wheel?symbol=AAPL`

- [ ] **Step 6: Test watchlist toggle**

1. Click ☆ on a card — star turns gold (★) immediately
2. Refresh page — star should still be gold

- [ ] **Step 7: Test search**

1. Type "apple" in search bar
2. Wait 400ms — results appear from Yahoo Finance
3. Click "+ Add" on AAPL result — drawer opens

- [ ] **Step 8: Test trending strip**

1. Click "🔥 Trending" pill
2. Panel expands below with NVDA, TSLA, META, AAPL, MSFT mini-rows
3. Click "+ Add" in expanded panel — drawer opens for that stock

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(stocks): Phase 1 complete — stock browser with trending, enhanced cards, drawer, watchlist"
```
