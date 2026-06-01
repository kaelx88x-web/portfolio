import { expect, test, type Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasE2ECredentials() {
  return Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
}

async function signInByApi(page: Page) {
  const res = await page.request.post('/api/auth/sign-in/email', {
    data: { email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! },
  });
  expect(res.ok(), `sign-in API failed: ${await res.text()}`).toBe(true);
  await page.goto('/dashboard');
  // Wait for full JS hydration — SvelteKit event handlers attach after network idle
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
}

async function gotoAndWait(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

async function openAccountDropdown(page: Page) {
  await page.locator('.tb-account-btn').click();
  // Wait for menu to render
  await expect(page.locator('.tb-acc-menu')).toBeVisible({ timeout: 5000 });
}

async function mockBrokerBridge(page: Page, opts: { offline?: boolean } = {}) {
  if (opts.offline) {
    await page.route('**/api/broker/health/service', r =>
      r.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'moomoo-service is not running on port 8001' }) })
    );
    return;
  }
  await page.route('**/api/broker/health/service', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  );
  await page.route('**/api/broker/health/opend', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
  );
  await page.route('**/api/broker/accounts', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACCOUNTS) })
  );
  await page.route('**/api/broker/accounts/balance?**', r =>
    r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        acc_id: '4652657',
        balances: [
          { currency: 'USD', total_assets: 8229.48, cash: 6000.00, market_val: 2229.48 },
          { currency: 'HKD', total_assets: 1066520, cash: 900000, market_val: 166520 },
        ],
      }),
    })
  );
  await page.route('**/api/broker/accounts/select', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, accountId: 'acc-1' }) })
  );
}

const MOCK_ACCOUNTS = [
  {
    acc_id: '4652657',
    card_num: '4652657',
    trd_env: 'SIMULATE',
    sim_acc_type: 'STOCK_AND_OPTION',
    is_real: false,
    is_active: true,
    markets: ['US'],
    name: 'Paper (Stock & Options) (4652657)',
  },
  {
    acc_id: '286260078367356718',
    card_num: '8262',
    trd_env: 'REAL',
    sim_acc_type: '',
    is_real: true,
    is_active: true,
    markets: ['HK', 'US', 'SG', 'MY'],
    name: 'Live Account (286260078367356718)',
  },
];

// ─── 1. Login ─────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('shows correct form elements and links', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();
  });

  test('input fields have required attribute', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('Email address')).toHaveAttribute('required');
    await expect(page.getByPlaceholder('Password')).toHaveAttribute('required');
  });

  test('stays on login page with wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('definitely-wrong@example.com');
    await page.getByPlaceholder('Password').fill('wrongpassword999');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/login');
  });

  test('redirects to app after successful login', async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('Email address').fill(process.env.E2E_EMAIL!);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: 'Login' }).click();
    // Redirects to dashboard or onboarding — must NOT stay on /login
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15000 });
    expect(page.url()).not.toContain('/login');
  });

  test('anonymous user accessing dashboard is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── 2. Connect Broker / Onboarding ──────────────────────────────────────────

test.describe('Connect broker onboarding', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
    await mockBrokerBridge(page);
  });

  test('reconnect mode starts at step 2 with all 3 steps visible', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    // Step labels are "Choose Broker", "Connection", "Select Account"
    await expect(page.locator('.ob-step-label').filter({ hasText: 'Choose Broker' })).toBeVisible();
    await expect(page.locator('.ob-step-label').filter({ hasText: 'Connection' })).toBeVisible();
    await expect(page.locator('.ob-step-label').filter({ hasText: 'Select Account' })).toBeVisible();
    // Step 1 is marked done (✓)
    await expect(page.locator('.ob-step-item.done').first()).toBeVisible();
  });

  test('step 2: connection checks idle state shows Start Check button', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await expect(page.getByText('moomoo-service running')).toBeVisible();
    await expect(page.getByText('OpenD connected')).toBeVisible();
    await expect(page.getByText('Fetching accounts')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Check' })).toBeVisible();
  });

  test('step 2: all checks pass and advances to account selection', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    // Section label for step 3
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });
  });

  test('step 2: offline service shows retry button and developer hint', async ({ page }) => {
    await mockBrokerBridge(page, { offline: true });
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('moomoo-service is not running on port 8001')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Retry Connection' })).toBeVisible();
    // Developer details collapsed
    await page.getByText('Developer details').click();
    await expect(page.getByText(/python main\.py/i)).toBeVisible();
  });

  test('step 3: accounts show PAPER and LIVE badges', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });

    await expect(page.locator('.acc-type-badge.paper')).toBeVisible();
    await expect(page.locator('.acc-type-badge.live')).toBeVisible();
  });

  test('step 3: account row shows last 4 digits of card number', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });

    // card_num '4652657' → last 4 = '2657'; card_num '8262' → last 4 = '8262'
    await expect(page.locator('.acc-id-chip').filter({ hasText: '2657' })).toBeVisible();
    await expect(page.locator('.acc-id-chip').filter({ hasText: '8262' })).toBeVisible();
  });

  test('step 3: clicking account expands multi-currency balance', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });

    await page.locator('.account-row').filter({ hasText: 'Paper (Stock & Options)' }).click();

    await expect(page.getByText('USD')).toBeVisible({ timeout: 4000 });
    await expect(page.getByText('HKD')).toBeVisible();
    await expect(page.locator('.bal-label').filter({ hasText: 'Total Assets' }).first()).toBeVisible();
  });

  test('step 3: Start Trading disabled until account selected', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });

    const btn = page.getByRole('button', { name: /start trading/i });
    await expect(btn).toBeDisabled();

    await page.locator('.account-row').filter({ hasText: 'Paper (Stock & Options)' }).click();
    await expect(btn).toBeEnabled();
  });

  test('step 3: selecting paper account POSTs acc_id and trd_env SIMULATE', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });

    const selectReq = page.waitForRequest(
      r => r.url().includes('/api/broker/accounts/select') && r.method() === 'POST'
    );
    await page.locator('.account-row').filter({ hasText: 'Paper (Stock & Options)' }).click();
    await page.getByRole('button', { name: /start trading/i }).click();

    const req = await selectReq;
    expect(req.postDataJSON()).toMatchObject({ acc_id: '4652657', trd_env: 'SIMULATE' });
  });

  test('step 3: selecting live account POSTs trd_env REAL', async ({ page }) => {
    await gotoAndWait(page, '/onboarding/connect-broker?reconnect=1');
    await page.getByRole('button', { name: 'Start Check' }).click();
    await expect(page.getByText('Choose your trading account')).toBeVisible({ timeout: 8000 });

    const selectReq = page.waitForRequest(
      r => r.url().includes('/api/broker/accounts/select') && r.method() === 'POST'
    );
    await page.locator('.account-row').filter({ hasText: 'Live Account' }).click();
    await page.getByRole('button', { name: /start trading/i }).click();

    const req = await selectReq;
    expect(req.postDataJSON()).toMatchObject({ acc_id: '286260078367356718', trd_env: 'REAL' });
  });
});

// ─── 3. Account Switching (Topbar) ───────────────────────────────────────────

test.describe('Topbar account switcher', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);

    // Mock accounts list for dropdown (controls what's shown)
    // No mock for /select — real endpoint needed so DB updates and badge reflects change
    await page.route('**/api/broker/accounts', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ACCOUNTS) })
    );

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.tb-account-btn')).toBeVisible({ timeout: 10000 });
  });

  test('topbar shows a LIVE or PAPER mode badge', async ({ page }) => {
    const badge = page.locator('.tb-acc-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(['LIVE', 'PAPER']).toContain(text?.trim());
  });

  test('opening dropdown shows accounts and Manage Connection option', async ({ page }) => {
    await openAccountDropdown(page);

    await expect(page.locator('.tb-acc-menu-section').filter({ hasText: 'BROKER ACCOUNTS' })).toBeVisible();
    await expect(page.locator('.tb-acc-opt-label').filter({ hasText: 'Paper (Stock & Options) (4652657)' })).toBeVisible();
    await expect(page.locator('.tb-acc-opt-label').filter({ hasText: 'Live Account (286260078367356718)' })).toBeVisible();
    await expect(page.locator('.tb-acc-opt-label').filter({ hasText: 'Manage Broker Connection' })).toBeVisible();
  });

  test('dropdown shows last 6 digits chip for each account', async ({ page }) => {
    await openAccountDropdown(page);
    // Paper: acc_id '4652657' → last 6 = '652657'
    // Live:  acc_id '286260078367356718' → last 6 = '356718'
    await expect(page.locator('.tb-acc-id-chip').filter({ hasText: '652657' })).toBeVisible();
    await expect(page.locator('.tb-acc-id-chip').filter({ hasText: '356718' })).toBeVisible();
  });

  test('selecting paper account changes badge to PAPER and shows amber banner', async ({ page }) => {
    await openAccountDropdown(page);
    await page.locator('.tb-acc-opt-label').filter({ hasText: 'Paper (Stock & Options)' }).click();

    await expect(page.locator('.tb-acc-badge.sandbox')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.tb-acc-badge.sandbox')).toHaveText('PAPER');
    await expect(page.locator('.paper-banner')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.paper-banner')).toContainText(/no real money/i);
  });

  test('switching live → paper → live restores LIVE badge and removes banner', async ({ page }) => {
    // Switch to paper first
    await openAccountDropdown(page);
    await page.locator('.tb-acc-opt-label').filter({ hasText: 'Paper (Stock & Options)' }).click();
    await expect(page.locator('.tb-acc-badge.sandbox')).toBeVisible({ timeout: 6000 });

    // Switch back to live
    await openAccountDropdown(page);
    await page.locator('.tb-acc-opt-label').filter({ hasText: 'Live Account' }).click();

    await expect(page.locator('.tb-acc-badge.live')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('.tb-acc-badge.live')).toHaveText('LIVE');
    await expect(page.locator('.paper-banner')).not.toBeVisible({ timeout: 3000 });
  });

  test('switching account POSTs correct acc_id and trd_env', async ({ page }) => {
    await openAccountDropdown(page);

    const selectReq = page.waitForRequest(
      r => r.url().includes('/api/broker/accounts/select') && r.method() === 'POST'
    );
    await page.locator('.tb-acc-opt-label').filter({ hasText: 'Paper (Stock & Options)' }).click();

    const req = await selectReq;
    expect(req.postDataJSON()).toMatchObject({ acc_id: '4652657', trd_env: 'SIMULATE' });
  });

  test('dropdown closes after selecting an account', async ({ page }) => {
    await openAccountDropdown(page);
    await expect(page.locator('.tb-acc-menu')).toBeVisible();

    await page.locator('.tb-acc-opt-label').filter({ hasText: 'Paper (Stock & Options)' }).click();
    await expect(page.locator('.tb-acc-menu')).not.toBeVisible({ timeout: 4000 });
  });

  test('clicking backdrop closes dropdown without switching', async ({ page }) => {
    await openAccountDropdown(page);
    await expect(page.locator('.tb-acc-menu')).toBeVisible();

    await page.locator('.tb-acc-backdrop').click();
    await expect(page.locator('.tb-acc-menu')).not.toBeVisible({ timeout: 3000 });
  });

  test('Manage Broker Connection option navigates to onboarding', async ({ page }) => {
    await openAccountDropdown(page);
    await page.locator('.tb-acc-opt-label').filter({ hasText: 'Manage Broker Connection' }).click();
    await expect(page).toHaveURL(/connect-broker/, { timeout: 5000 });
  });
});
