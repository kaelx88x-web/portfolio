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
    const weekday = now.toLocaleDateString('en-US', {
      timeZone: ex.tz,
      weekday: 'short',
    });
    const time = now.toLocaleTimeString('en-US', {
      timeZone: ex.tz,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    // time format: "09:30"
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
