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
  '1155.KL': { tags:['Dividend','Finance'],   aiSummary:"Malaysia's largest bank by assets with strong dividend history", pe:12.8, marketCap:'RM95B', dividendYield:5.80, sparkTrend:'up',   wheelFriendly:false },
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
  '1211.HK': { tags:['Growth','EV'],          aiSummary:"World's largest EV maker with energy storage diversification", pe:22.8, marketCap:'HK$680B', dividendYield:null, sparkTrend:'up', wheelFriendly:false },
  '0941.HK': { tags:['Dividend','Technology'], aiSummary:"China's largest telco with 5G and cloud infrastructure",  pe:10.2, marketCap:'HK$1.8T', dividendYield:6.40, sparkTrend:'flat', wheelFriendly:false },
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
