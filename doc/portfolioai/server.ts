import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Routes
  app.get("/api/stock/:symbol", async (req, res) => {
    const { symbol } = req.params;
    console.log(`[Server] Received request for symbol: ${symbol}`);
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      // Demo mode: Return mock data based on symbol to avoid UI errors
      console.log(`FINNHUB_API_KEY is not configured. Returning mock data for ${symbol}`);
      
      const mockData: Record<string, any> = {
        AAPL: { c: 175.45, d: 1.25, dp: 0.72, h: 176.20, l: 174.10, o: 174.50, pc: 174.20 },
        NVDA: { c: 875.20, d: 15.30, dp: 1.78, h: 880.00, l: 860.00, o: 865.00, pc: 859.90 },
        TSLA: { c: 170.10, d: -2.40, dp: -1.39, h: 175.00, l: 168.50, o: 174.00, pc: 172.50 },
        MSFT: { c: 415.60, d: 3.20, dp: 0.78, h: 418.00, l: 412.00, o: 413.00, pc: 412.40 },
        AMD: { c: 160.50, d: 1.10, dp: 0.69, h: 162.00, l: 158.00, o: 159.00, pc: 159.40 },
        GOOGL: { c: 155.30, d: 0.80, dp: 0.52, h: 156.00, l: 154.00, o: 154.50, pc: 154.50 },
        META: { c: 485.40, d: 5.20, dp: 1.08, h: 488.00, l: 480.00, o: 482.00, pc: 480.20 },
        AMZN: { c: 180.20, d: 1.50, dp: 0.84, h: 181.50, l: 178.50, o: 179.00, pc: 178.70 },
      };

      const data = mockData[symbol] || {
        c: 100 + Math.random() * 50,
        d: (Math.random() - 0.5) * 5,
        dp: (Math.random() - 0.5) * 2,
        h: 150,
        l: 90,
        o: 100,
        pc: 100
      };

      return res.json({
        symbol,
        price: data.c,
        change: data.d,
        percentChange: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        timestamp: Date.now(),
        isDemo: true
      });
    }

    try {
      const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Finnhub returned status ${response.status}`);
      }

      const data = await response.json();
      
      // Finnhub returns 0 for price if symbol is invalid or no data
      if (!data.c && data.pc === 0) {
        throw new Error(`No data returned for ${symbol}`);
      }
      
      console.log(`[Server] Successfully fetched data for ${symbol}`);
      res.json({
        symbol,
        price: data.c,
        change: data.d,
        percentChange: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error(`[Server] Error fetching stock data for ${symbol}:`, error.message);
      
      // Fallback to mock data even if API key exists but request fails
      console.log(`[Server] Falling back to mock data for ${symbol}`);
      
      const mockData: Record<string, any> = {
        AAPL: { c: 175.45, d: 1.25, dp: 0.72, h: 176.20, l: 174.10, o: 174.50, pc: 174.20 },
        NVDA: { c: 875.20, d: 15.30, dp: 1.78, h: 880.00, l: 860.00, o: 865.00, pc: 859.90 },
        TSLA: { c: 170.10, d: -2.40, dp: -1.39, h: 175.00, l: 168.50, o: 174.00, pc: 172.50 },
        MSFT: { c: 415.60, d: 3.20, dp: 0.78, h: 418.00, l: 412.00, o: 413.00, pc: 412.40 },
        AMD: { c: 160.50, d: 1.10, dp: 0.69, h: 162.00, l: 158.00, o: 159.00, pc: 159.40 },
        GOOGL: { c: 155.30, d: 0.80, dp: 0.52, h: 156.00, l: 154.00, o: 154.50, pc: 154.50 },
        META: { c: 485.40, d: 5.20, dp: 1.08, h: 488.00, l: 480.00, o: 482.00, pc: 480.20 },
        AMZN: { c: 180.20, d: 1.50, dp: 0.84, h: 181.50, l: 178.50, o: 179.00, pc: 178.70 },
      };

      const data = mockData[symbol] || {
        c: 100 + Math.random() * 50,
        d: (Math.random() - 0.5) * 5,
        dp: (Math.random() - 0.5) * 2,
        h: 150,
        l: 90,
        o: 100,
        pc: 100
      };

      res.json({
        symbol,
        price: data.c,
        change: data.d,
        percentChange: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        timestamp: Date.now(),
        isFallback: true
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
