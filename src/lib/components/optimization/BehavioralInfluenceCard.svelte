<script lang="ts">
  import { Brain, Sparkles, ArrowRight } from 'lucide-svelte';
  import type { BehavioralProfile } from '$lib/services/behavioral-profile.service';

  export let profile: BehavioralProfile;
  export let explanation: string | null = null;

  const profileColor: Record<string, string> = {
    aggressive:   'danger',
    balanced:     'primary',
    conservative: 'success',
  };
  const profileMy: Record<string, string> = {
    aggressive:   'Agresif',
    balanced:     'Sederhana',
    conservative: 'Konservatif',
  };

  $: actualColor   = profileColor[profile.actualProfile]  ?? 'primary';
  $: statedColor   = profileColor[profile.statedProfile]  ?? 'primary';
  $: mismatch      = profile.actualProfile !== profile.statedProfile;
  $: totalWeight   = profile.weights.aggressive + profile.weights.balanced + profile.weights.conservative;
  $: aggPct        = (profile.weights.aggressive / totalWeight) * 100;
  $: balPct        = (profile.weights.balanced   / totalWeight) * 100;
  $: conPct        = (profile.weights.conservative / totalWeight) * 100;
</script>

<div class="card">
  <!-- Header -->
  <div class="card-head">
    <div class="head-left">
      <Brain size={14} class="brain-icon" />
      <span class="label">Behavioral Influence</span>
      {#if explanation}
        <Sparkles size={11} class="ai-icon" />
        <span class="ai-tag">AI</span>
      {/if}
    </div>
    <a class="view-link" href="/optimization/behavioral">
      Lihat profil penuh <ArrowRight size={11} />
    </a>
  </div>

  <!-- Profile chips -->
  <div class="profiles">
    <div class="profile-item">
      <span class="p-label">Profil sebenar</span>
      <span class="chip chip-{actualColor}">{profileMy[profile.actualProfile] ?? profile.actualProfile}</span>
    </div>
    {#if mismatch}
      <div class="divider">≠</div>
      <div class="profile-item">
        <span class="p-label">Profil dinyatakan</span>
        <span class="chip chip-{statedColor}">{profileMy[profile.statedProfile] ?? profile.statedProfile}</span>
      </div>
    {/if}
    <div class="confidence">
      <span class="p-label">Confidence</span>
      <span class="conf-val">{profile.confidencePct}%</span>
    </div>
  </div>

  <!-- AI explanation -->
  {#if explanation}
    <p class="explanation">{explanation}</p>
  {/if}

  <!-- Scenario weight bar -->
  <div class="weight-section">
    <span class="weight-label">Pemberat scenario dicadangkan</span>
    <div class="weight-bar">
      <div class="seg seg-danger"  style="width: {aggPct}%" title="Aggressive {profile.weights.aggressive}%"></div>
      <div class="seg seg-primary" style="width: {balPct}%" title="Balanced {profile.weights.balanced}%"></div>
      <div class="seg seg-success" style="width: {conPct}%" title="Conservative {profile.weights.conservative}%"></div>
    </div>
    <div class="weight-legend">
      <span class="leg danger"><span class="dot"></span> Aggressive {profile.weights.aggressive}%</span>
      <span class="leg primary"><span class="dot"></span> Balanced {profile.weights.balanced}%</span>
      <span class="leg success"><span class="dot"></span> Conservative {profile.weights.conservative}%</span>
    </div>
  </div>
</div>

<style>
  .card {
    border: 1px solid rgba(var(--primary-rgb), 0.2);
    border-radius: 10px;
    background: rgba(var(--primary-rgb), 0.03);
    padding: 14px 16px;
    display: grid;
    gap: 12px;
    margin-bottom: 14px;
  }

  /* Head */
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .head-left { display: flex; align-items: center; gap: 6px; }
  :global(.brain-icon) { color: var(--primary); flex-shrink: 0; }
  :global(.ai-icon)    { color: var(--primary); opacity: 0.7; }
  .label  { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text); }
  .ai-tag { font-size: 0.58rem; font-weight: 800; color: var(--primary); background: rgba(var(--primary-rgb),.12); border: 1px solid rgba(var(--primary-rgb),.25); padding: 1px 6px; border-radius: 4px; }
  .view-link { display: inline-flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 700; color: var(--muted); text-decoration: none; transition: color 0.12s; }
  .view-link:hover { color: var(--primary); }

  /* Profiles */
  .profiles { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .profile-item { display: grid; gap: 3px; }
  .p-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; color: var(--muted); }
  .divider  { color: var(--muted); font-size: 0.9rem; font-weight: 300; align-self: center; margin-top: 12px; }

  .chip {
    display: inline-block; font-size: 0.72rem; font-weight: 700;
    text-transform: capitalize; padding: 3px 10px; border-radius: 999px;
  }
  .chip-danger  { background: rgba(var(--danger-rgb), .13); color: var(--danger);  border: 1px solid rgba(var(--danger-rgb), .3); }
  .chip-primary { background: rgba(var(--primary-rgb),.12); color: var(--primary); border: 1px solid rgba(var(--primary-rgb),.3); }
  .chip-success { background: rgba(var(--success-rgb),.12); color: var(--success); border: 1px solid rgba(var(--success-rgb),.3); }

  .confidence   { display: grid; gap: 3px; }
  .conf-val     { font-size: 0.88rem; font-weight: 800; color: var(--text); }

  /* Explanation */
  .explanation {
    margin: 0;
    font-size: 0.76rem;
    color: var(--muted);
    line-height: 1.6;
    border-left: 2px solid rgba(var(--primary-rgb), 0.3);
    padding-left: 10px;
  }

  /* Weight bar */
  .weight-section { display: grid; gap: 7px; }
  .weight-label   { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; color: var(--muted); }
  .weight-bar     { height: 8px; border-radius: 999px; overflow: hidden; display: flex; background: var(--border); }
  .seg            { height: 100%; transition: width 0.4s ease; }
  .seg-danger     { background: var(--danger); }
  .seg-primary    { background: var(--primary); }
  .seg-success    { background: var(--success); }

  .weight-legend { display: flex; gap: 14px; flex-wrap: wrap; }
  .leg { display: inline-flex; align-items: center; gap: 5px; font-size: 0.65rem; font-weight: 700; }
  .leg.danger  { color: var(--danger);  }
  .leg.primary { color: var(--primary); }
  .leg.success { color: var(--success); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
</style>
