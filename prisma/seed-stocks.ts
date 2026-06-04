import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

interface SeedAsset {
  symbol: string; name: string; assetType: string;
  exchange: string; currency: string; country: string; sector?: string;
  /** Optional seed price. Used as a fallback when no live quote is available
   *  (e.g. China A-shares, which need CN MarketStocks quote permission). */
  latestPrice?: number;
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
  { symbol:'MCD',   name:"McDonald's Corp.",         assetType:'stock', exchange:'NYSE',   currency:'USD', country:'US', sector:'Consumer Cyclical' },
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
  // China Market (A-shares) — Shanghai (SH.) / Shenzhen (SZ.) moomoo codes.
  // Live prices need CN MarketStocks quote permission in moomoo; latestPrice is
  // a seed fallback so cards render until that permission is enabled.
  { symbol:'SH.600519', name:'Kweichow Moutai Co.',       assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Consumer Defensive', latestPrice:1485.00 },
  { symbol:'SZ.000858', name:'Wuliangye Yibin Co.',       assetType:'stock', exchange:'SZSE', currency:'CNY', country:'CN', sector:'Consumer Defensive', latestPrice:142.50 },
  { symbol:'SH.601398', name:'ICBC',                      assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Finance', latestPrice:6.45 },
  { symbol:'SH.601318', name:'Ping An Insurance',         assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Finance', latestPrice:54.80 },
  { symbol:'SH.600036', name:'China Merchants Bank',      assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Finance', latestPrice:38.20 },
  { symbol:'SZ.000333', name:'Midea Group Co.',           assetType:'stock', exchange:'SZSE', currency:'CNY', country:'CN', sector:'Consumer Cyclical', latestPrice:74.60 },
  { symbol:'SZ.300750', name:'Contemporary Amperex (CATL)', assetType:'stock', exchange:'SZSE', currency:'CNY', country:'CN', sector:'Technology', latestPrice:252.30 },
  { symbol:'SH.601857', name:'PetroChina Co.',            assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Energy', latestPrice:8.95 },
  { symbol:'SH.600276', name:'Jiangsu Hengrui Pharma',    assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Healthcare', latestPrice:49.10 },
  { symbol:'SH.688981', name:'SMIC',                      assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Technology', latestPrice:88.40 },
  { symbol:'SZ.000001', name:'Ping An Bank Co.',          assetType:'stock', exchange:'SZSE', currency:'CNY', country:'CN', sector:'Finance', latestPrice:11.85 },
  { symbol:'SH.600900', name:'China Yangtze Power',       assetType:'stock', exchange:'SSE',  currency:'CNY', country:'CN', sector:'Utilities', latestPrice:28.05 },
  { symbol:'SH.601888', name:'China Tourism Group Duty Free', assetType:'stock', exchange:'SSE', currency:'CNY', country:'CN', sector:'Consumer Cyclical', latestPrice:69.40 },
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
