<?php

$dbPath = __DIR__ . '/../prisma/dev.db';
$pdo = new PDO('sqlite:' . $dbPath);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('PRAGMA foreign_keys = ON');

$statements = [
    'CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "baseCurrency" TEXT NOT NULL DEFAULT "USD",
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")',

    'CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "brokerName" TEXT NOT NULL,
        "accountType" TEXT NOT NULL,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Account_id_userId_key" ON "Account"("id", "userId")',
    'CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId")',

    'CREATE TABLE IF NOT EXISTS "Asset" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "symbol" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "assetType" TEXT NOT NULL,
        "exchange" TEXT,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "sector" TEXT,
        "country" TEXT,
        "latestPrice" REAL NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Asset_symbol_key" ON "Asset"("symbol")',

    'CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "assetId" TEXT,
        "type" TEXT NOT NULL,
        "tradeDate" DATETIME NOT NULL,
        "quantity" REAL NOT NULL DEFAULT 0,
        "price" REAL NOT NULL DEFAULT 0,
        "fee" REAL NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_id_userId_key" ON "Transaction"("id", "userId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_userId_tradeDate_idx" ON "Transaction"("userId", "tradeDate")',
    'CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON "Transaction"("accountId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_assetId_idx" ON "Transaction"("assetId")',

    'CREATE TABLE IF NOT EXISTS "HoldingSnapshot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "assetId" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        "quantity" REAL NOT NULL,
        "averageCost" REAL NOT NULL,
        "marketPrice" REAL NOT NULL,
        "marketValue" REAL NOT NULL,
        "unrealizedPnl" REAL NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "HoldingSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "HoldingSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "HoldingSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "HoldingSnapshot_userId_accountId_assetId_date_key" ON "HoldingSnapshot"("userId", "accountId", "assetId", "date")',
    'CREATE INDEX IF NOT EXISTS "HoldingSnapshot_userId_date_idx" ON "HoldingSnapshot"("userId", "date")',

    'CREATE TABLE IF NOT EXISTS "Watchlist" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "Watchlist_id_userId_key" ON "Watchlist"("id", "userId")',
    'CREATE INDEX IF NOT EXISTS "Watchlist_userId_idx" ON "Watchlist"("userId")',

    'CREATE TABLE IF NOT EXISTS "WatchlistItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "watchlistId" TEXT NOT NULL,
        "assetId" TEXT NOT NULL,
        "notes" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        CONSTRAINT "WatchlistItem_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "WatchlistItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "WatchlistItem_watchlistId_assetId_key" ON "WatchlistItem"("watchlistId", "assetId")',

    'CREATE TABLE IF NOT EXISTS "PortfolioSnapshot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "snapshotDate" DATETIME NOT NULL,
        "totalValue" REAL NOT NULL,
        "cashBalance" REAL NOT NULL DEFAULT 0,
        "holdingsCount" INTEGER NOT NULL DEFAULT 0,
        "holdingsJson" TEXT NOT NULL,
        "allocationJson" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioSnapshot_userId_snapshotDate_key" ON "PortfolioSnapshot"("userId", "snapshotDate")',
    'CREATE INDEX IF NOT EXISTS "PortfolioSnapshot_userId_snapshotDate_idx" ON "PortfolioSnapshot"("userId", "snapshotDate")',

    'CREATE TABLE IF NOT EXISTS "analytics_cache" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "cache_key" TEXT NOT NULL,
        "cache_type" TEXT NOT NULL,
        "payload_json" TEXT NOT NULL,
        "generated_at" DATETIME NOT NULL,
        "expires_at" DATETIME NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "analytics_cache_cache_key_key" ON "analytics_cache"("cache_key")',
    'CREATE INDEX IF NOT EXISTS "analytics_cache_user_id_cache_type_expires_at_idx" ON "analytics_cache"("user_id", "cache_type", "expires_at")',

    'CREATE TABLE IF NOT EXISTS "benchmark_prices" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "symbol" TEXT NOT NULL,
        "date" DATETIME NOT NULL,
        "open" REAL NOT NULL,
        "high" REAL NOT NULL,
        "low" REAL NOT NULL,
        "close" REAL NOT NULL,
        "adj_close" REAL NOT NULL,
        "volume" REAL NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "benchmark_prices_symbol_date_key" ON "benchmark_prices"("symbol", "date")',
    'CREATE INDEX IF NOT EXISTS "benchmark_prices_symbol_date_idx" ON "benchmark_prices"("symbol", "date")',

    'CREATE TABLE IF NOT EXISTS "benchmark_performance_metrics" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "benchmark_symbol" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "portfolio_return" REAL NOT NULL,
        "benchmark_return" REAL NOT NULL,
        "relative_return" REAL NOT NULL,
        "alpha" REAL NOT NULL,
        "beta" REAL NOT NULL,
        "sharpe_ratio" REAL NOT NULL,
        "sortino_ratio" REAL NOT NULL,
        "tracking_error" REAL NOT NULL,
        "information_ratio" REAL NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "benchmark_performance_metrics_user_benchmark_snapshot_key" ON "benchmark_performance_metrics"("user_id", "benchmark_symbol", "snapshot_date")',
    'CREATE INDEX IF NOT EXISTS "benchmark_performance_metrics_user_benchmark_snapshot_idx" ON "benchmark_performance_metrics"("user_id", "benchmark_symbol", "snapshot_date")',

    'CREATE TABLE IF NOT EXISTS "rolling_performance_metrics" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "benchmark_symbol" TEXT NOT NULL,
        "period" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "portfolio_return" REAL NOT NULL,
        "benchmark_return" REAL NOT NULL,
        "relative_strength" REAL NOT NULL,
        "volatility_difference" REAL NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "rolling_performance_metrics_user_benchmark_period_snapshot_key" ON "rolling_performance_metrics"("user_id", "benchmark_symbol", "period", "snapshot_date")',
    'CREATE INDEX IF NOT EXISTS "rolling_performance_metrics_user_benchmark_period_snapshot_idx" ON "rolling_performance_metrics"("user_id", "benchmark_symbol", "period", "snapshot_date")',

    'CREATE TABLE IF NOT EXISTS "performance_attribution_reports" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "benchmark_symbol" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "sector_contribution_json" TEXT NOT NULL,
        "asset_contribution_json" TEXT NOT NULL,
        "risk_contribution_json" TEXT NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "performance_attribution_reports_user_benchmark_snapshot_key" ON "performance_attribution_reports"("user_id", "benchmark_symbol", "snapshot_date")',
    'CREATE INDEX IF NOT EXISTS "performance_attribution_reports_user_benchmark_snapshot_idx" ON "performance_attribution_reports"("user_id", "benchmark_symbol", "snapshot_date")',

    'CREATE TABLE IF NOT EXISTS "portfolio_daily_returns" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "portfolio_value" REAL NOT NULL,
        "daily_return" REAL NOT NULL,
        "cumulative_return" REAL NOT NULL,
        "benchmark_return" REAL NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_daily_returns_user_snapshot_key" ON "portfolio_daily_returns"("user_id", "snapshot_date")',
    'CREATE INDEX IF NOT EXISTS "portfolio_daily_returns_user_snapshot_idx" ON "portfolio_daily_returns"("user_id", "snapshot_date")',

    'CREATE TABLE IF NOT EXISTS "portfolio_metrics" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "trading_account_id" TEXT,
        "snapshot_date" DATETIME NOT NULL,
        "total_value" REAL NOT NULL,
        "cash_value" REAL NOT NULL,
        "market_value" REAL NOT NULL,
        "cost_basis" REAL NOT NULL,
        "unrealized_pnl" REAL NOT NULL,
        "realized_pnl" REAL NOT NULL,
        "dividend_income" REAL NOT NULL DEFAULT 0,
        "fees_paid" REAL NOT NULL DEFAULT 0,
        "total_return" REAL NOT NULL,
        "total_return_percent" REAL NOT NULL,
        "daily_return" REAL NOT NULL DEFAULT 0,
        "monthly_return" REAL NOT NULL DEFAULT 0,
        "ytd_return" REAL NOT NULL DEFAULT 0,
        "currency" TEXT NOT NULL DEFAULT "USD",
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_metrics_user_account_snapshot_key" ON "portfolio_metrics"("user_id", "trading_account_id", "snapshot_date")',
    'CREATE INDEX IF NOT EXISTS "portfolio_metrics_user_id_snapshot_date_idx" ON "portfolio_metrics"("user_id", "snapshot_date")',

    'CREATE TABLE IF NOT EXISTS "portfolio_metric_allocations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "portfolio_metric_id" TEXT NOT NULL,
        "allocation_type" TEXT NOT NULL,
        "allocation_key" TEXT NOT NULL,
        "market_value" REAL NOT NULL,
        "allocation_percent" REAL NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL,
        CONSTRAINT "portfolio_metric_allocations_metric_fkey" FOREIGN KEY ("portfolio_metric_id") REFERENCES "portfolio_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_metric_allocations_metric_type_key" ON "portfolio_metric_allocations"("portfolio_metric_id", "allocation_type", "allocation_key")',

    'CREATE TABLE IF NOT EXISTS "portfolio_return_history" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "trading_account_id" TEXT,
        "date" DATETIME NOT NULL,
        "portfolio_value" REAL NOT NULL,
        "cash_value" REAL NOT NULL,
        "market_value" REAL NOT NULL,
        "net_deposit" REAL NOT NULL,
        "daily_return" REAL NOT NULL DEFAULT 0,
        "cumulative_return" REAL NOT NULL DEFAULT 0,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_return_history_user_account_date_key" ON "portfolio_return_history"("user_id", "trading_account_id", "date")',

    'CREATE TABLE IF NOT EXISTS "portfolio_risk_metrics" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "trading_account_id" TEXT,
        "snapshot_date" DATETIME NOT NULL,
        "volatility" REAL NOT NULL,
        "max_drawdown" REAL NOT NULL,
        "concentration_score" REAL NOT NULL,
        "diversification_score" REAL NOT NULL,
        "risk_score" REAL NOT NULL,
        "risk_level" TEXT NOT NULL,
        "portfolio_health" TEXT NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_risk_metrics_user_account_snapshot_key" ON "portfolio_risk_metrics"("user_id", "trading_account_id", "snapshot_date")',

    'CREATE TABLE IF NOT EXISTS "portfolio_exposures" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "exposure_type" TEXT NOT NULL,
        "exposure_key" TEXT NOT NULL,
        "market_value" REAL NOT NULL,
        "allocation_percent" REAL NOT NULL,
        "risk_contribution" REAL NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_exposures_user_snapshot_type_key" ON "portfolio_exposures"("user_id", "snapshot_date", "exposure_type", "exposure_key")',

    'CREATE TABLE IF NOT EXISTS "portfolio_correlations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "asset_a" TEXT NOT NULL,
        "asset_b" TEXT NOT NULL,
        "correlation_value" REAL NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_correlations_user_snapshot_pair_key" ON "portfolio_correlations"("user_id", "snapshot_date", "asset_a", "asset_b")',

    'CREATE TABLE IF NOT EXISTS "portfolio_health_reports" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "user_id" TEXT NOT NULL,
        "snapshot_date" DATETIME NOT NULL,
        "health_score" REAL NOT NULL,
        "risk_level" TEXT NOT NULL,
        "strengths_json" TEXT NOT NULL,
        "weaknesses_json" TEXT NOT NULL,
        "recommendations_json" TEXT NOT NULL,
        "metadata" TEXT NOT NULL,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME NOT NULL
    )',
    'CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_health_reports_user_snapshot_key" ON "portfolio_health_reports"("user_id", "snapshot_date")'
];

foreach ($statements as $statement) {
    $pdo->exec($statement);
}

echo "SQLite database initialized at {$dbPath}\n";
