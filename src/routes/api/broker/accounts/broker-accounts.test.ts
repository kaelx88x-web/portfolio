import { describe, it, expect } from 'vitest';
import { mapBridgeAccount } from './+server.js';

describe('mapBridgeAccount', () => {
  it('maps REAL account', () => {
    const result = mapBridgeAccount({ acc_id: '1234', trd_env: 'REAL', acc_status: 'ACTIVE', trdmarket_auth: ['US'] });
    expect(result.is_real).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.name).toBe('Live Account (1234)');
  });
  it('maps SIMULATE account', () => {
    const result = mapBridgeAccount({ acc_id: '5678', trd_env: 'SIMULATE', acc_status: 'ACTIVE', trdmarket_auth: [] });
    expect(result.is_real).toBe(false);
    expect(result.name).toBe('Simulate Account (5678)');
  });
});
