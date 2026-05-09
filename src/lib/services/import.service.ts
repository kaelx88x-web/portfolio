import { prisma } from '$lib/server/db';
import { findOrCreateAsset } from '$lib/services/asset.service';
import { createTransaction } from '$lib/services/transaction.service';

export type CsvTransactionRow = {
  account: string;
  symbol: string;
  type: string;
  tradeDate: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  notes: string;
  errors: string[];
};

const expectedHeaders = ['account', 'symbol', 'type', 'trade_date', 'quantity', 'price', 'fee', 'currency', 'notes'];

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  return rows;
}

export function previewCsvTransactions(content: string): CsvTransactionRow[] {
  const rows = parseCsv(content);
  const [headerRow, ...bodyRows] = rows;
  if (!headerRow) return [];

  const normalizedHeaders = headerRow.map((header) => header.toLowerCase().trim());
  const headerIndex = new Map(normalizedHeaders.map((header, index) => [header, index]));

  return bodyRows.map((row) => {
    const read = (header: string) => row[headerIndex.get(header) ?? -1] ?? '';
    const quantity = Number(read('quantity') || 0);
    const price = Number(read('price') || 0);
    const fee = Number(read('fee') || 0);
    const type = read('type').toLowerCase();
    const tradeDate = read('trade_date');
    const errors: string[] = [];

    for (const header of expectedHeaders.slice(0, 7)) {
      if (!headerIndex.has(header)) errors.push(`Missing header: ${header}`);
    }

    if (!read('account')) errors.push('Account is required');
    if (!type) errors.push('Type is required');
    if (['buy', 'sell', 'dividend'].includes(type) && !read('symbol')) errors.push('Symbol is required');
    if (Number.isNaN(new Date(tradeDate).getTime())) errors.push('Trade date is invalid');
    if (!Number.isFinite(quantity)) errors.push('Quantity is invalid');
    if (!Number.isFinite(price)) errors.push('Price is invalid');
    if (!Number.isFinite(fee)) errors.push('Fee is invalid');

    return {
      account: read('account'),
      symbol: read('symbol').toUpperCase(),
      type,
      tradeDate,
      quantity,
      price,
      fee,
      currency: read('currency') || 'USD',
      notes: read('notes'),
      errors
    };
  });
}

export async function importCsvTransactions(userId: string, rows: CsvTransactionRow[]) {
  const validRows = rows.filter((row) => row.errors.length === 0);

  for (const row of validRows) {
    const account = await prisma.account.upsert({
      where: { id: `import-${userId}-${row.account.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` },
      update: {},
      create: {
        id: `import-${userId}-${row.account.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        userId,
        name: row.account,
        brokerName: 'Imported',
        accountType: 'brokerage',
        currency: row.currency
      }
    });
    const asset = row.symbol
      ? await findOrCreateAsset(row.symbol, { currency: row.currency, latestPrice: row.price })
      : null;

    await createTransaction({
      userId,
      accountId: account.id,
      assetId: asset?.id ?? null,
      type: row.type,
      tradeDate: new Date(row.tradeDate),
      quantity: row.quantity,
      price: row.price,
      fee: row.fee,
      currency: row.currency,
      notes: row.notes || null
    });
  }

  return { imported: validRows.length, skipped: rows.length - validRows.length };
}
