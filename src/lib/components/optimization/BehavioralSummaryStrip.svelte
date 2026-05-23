<!-- src/lib/components/optimization/BehavioralSummaryStrip.svelte -->
<script lang="ts">
  export let statedProfile: string;   // e.g. 'balanced'
  export let actualProfile: string;   // e.g. 'aggressive'
  export let confidencePct: number;   // 0–100
  export let dataPoints: number;

  const profileColor: Record<string, string> = {
    aggressive:   'danger',
    balanced:     'primary',
    conservative: 'success',
  };

  $: statedColor  = profileColor[statedProfile]  ?? 'primary';
  $: actualColor  = profileColor[actualProfile]  ?? 'primary';
  $: mismatch     = statedProfile !== actualProfile;
</script>

<div class="strip">
  <!-- Stated profile -->
  <div class="card">
    <span class="label">Profil dinyatakan</span>
    <span class="chip {statedColor}">{statedProfile}</span>
    <span class="sub">Manual selection</span>
  </div>

  <!-- Actual profile -->
  <div class="card" class:alert={mismatch}>
    <span class="label">Profil sebenar</span>
    <span class="chip {actualColor}">{actualProfile}</span>
    <span class="sub">{mismatch ? 'Berbeza dari stated' : 'Sama dengan stated'}</span>
  </div>

  <!-- Confidence -->
  <div class="card">
    <span class="label">Confidence</span>
    <strong class="value">{confidencePct}%</strong>
    <div class="bar-wrap">
      <div class="bar-fill" style="width: {confidencePct}%"></div>
    </div>
  </div>

  <!-- Data points -->
  <div class="card">
    <span class="label">Data points</span>
    <strong class="value">{dataPoints}</strong>
    <span class="sub">runs + transaksi</span>
  </div>
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 14px 16px;
    display: grid;
    gap: 5px;
  }
  .card.alert { border-color: rgba(var(--warning-rgb), 0.4); }
  .label { color: var(--muted); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .value { color: var(--text); font-size: 1.3rem; font-weight: 800; }
  .sub   { color: var(--muted); font-size: 0.65rem; }

  .chip {
    display: inline-block;
    align-self: start;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: capitalize;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .chip.danger  { background: rgba(var(--danger-rgb),  0.15); color: var(--danger);  border: 1px solid rgba(var(--danger-rgb),  0.3); }
  .chip.primary { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); border: 1px solid rgba(var(--primary-rgb), 0.3); }
  .chip.success { background: rgba(var(--success-rgb), 0.12); color: var(--success); border: 1px solid rgba(var(--success-rgb), 0.3); }

  .bar-wrap { height: 6px; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--success); border-radius: 999px; transition: width 0.4s ease; }
</style>
