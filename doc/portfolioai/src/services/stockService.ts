export interface StockData {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export async function fetchStockQuote(symbol: string, retries = 2): Promise<StockData | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(`/api/stock/${symbol}`);
      if (!response.ok) {
        if (i < retries) {
          console.warn(`Retry ${i + 1} for ${symbol} - Server returned ${response.status}: ${response.statusText}`);
          await new Promise(resolve => setTimeout(resolve, 500 * (i + 1))); // Exponential backoff
          continue;
        }
        throw new Error(`Server error (${response.status}): ${response.statusText}`);
      }
      
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error(`Invalid JSON for ${symbol}:`, text.slice(0, 50));
        throw new Error(`Invalid JSON response for ${symbol}`);
      }
    } catch (error: any) {
      if (i < retries) {
        console.warn(`Retry ${i + 1} for ${symbol} due to error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
        continue;
      }
      console.error(`Error fetching quote for ${symbol} after ${retries} retries:`, error.message);
      return null;
    }
  }
  return null;
}

export async function fetchMultipleQuotes(symbols: string[]): Promise<Record<string, StockData>> {
  const results: Record<string, StockData> = {};
  
  // Batch requests to avoid overwhelming the server/network
  const batchSize = 5;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (symbol) => {
        const data = await fetchStockQuote(symbol);
        if (data) {
          results[symbol] = data;
        }
      })
    );
    // Tiny delay between batches if needed
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
