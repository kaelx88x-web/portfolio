import { describe, it, expect } from 'vitest';

function buildSyncUrl(base: string, preferReal: boolean, accId?: string): string {
  return `${base}/sync?prefer_real=${preferReal ? 'true' : 'false'}${accId ? `&acc_id=${encodeURIComponent(accId)}` : ''}`;
}

describe('buildSyncUrl', () => {
  it('omits acc_id when not provided', () => {
    expect(buildSyncUrl('http://localhost:8001', true)).toBe('http://localhost:8001/sync?prefer_real=true');
  });
  it('appends acc_id when provided', () => {
    expect(buildSyncUrl('http://localhost:8001', true, '4652657')).toBe('http://localhost:8001/sync?prefer_real=true&acc_id=4652657');
  });
  it('URL-encodes acc_id', () => {
    expect(buildSyncUrl('http://localhost:8001', false, '465 2657')).toBe('http://localhost:8001/sync?prefer_real=false&acc_id=465%202657');
  });
});
