<script lang="ts">
  import { goto } from '$app/navigation';

  export let brief = '';
  export let loading = false;

  const suggestions = [
    'Why is my portfolio risky?',
    'What sectors am I overweight?',
    'How does my portfolio compare to SPY?',
  ];

  function askQuestion(q: string) {
    const params = new URLSearchParams({ q });
    goto(`/ai/copilot?${params}`);
  }
</script>

<div class="banner">
  <!-- Left: AI Brief -->
  <div class="banner-brief">
    <div class="banner-title">✦ AI BRIEF</div>
    {#if loading}
      <div class="skeleton-line" style="width:90%"></div>
      <div class="skeleton-line" style="width:70%;margin-top:6px"></div>
      <div class="skeleton-line" style="width:80%;margin-top:6px"></div>
    {:else if brief}
      <p class="banner-text">{brief}</p>
    {:else}
      <p class="banner-empty">
        No AI brief yet. <a href="/ai/copilot" class="banner-link">Generate one →</a>
      </p>
    {/if}
  </div>

  <!-- Divider -->
  <div class="banner-sep"></div>

  <!-- Right: Suggested questions -->
  <div class="banner-chips">
    <div class="banner-chips-label">SUGGESTED QUESTIONS</div>
    {#each suggestions as q}
      <button class="chip" on:click={() => askQuestion(q)}>{q}</button>
    {/each}
  </div>
</div>

<style>
  .banner {
    display: grid; grid-template-columns: 1fr auto 1fr;
    border-radius: 10px;
    border: 1px solid var(--ai-border);
    background: var(--ai-bg);
    overflow: hidden;
    margin-bottom: 20px;
  }
  .banner-brief { padding: 16px 20px; }
  .banner-title { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--primary); margin-bottom: 8px; }
  .banner-text  { font-size: 0.8rem; color: var(--muted); line-height: 1.6; margin: 0; }
  .banner-empty { font-size: 0.8rem; color: var(--muted); margin: 0; }
  .banner-link  { color: var(--primary); }
  .banner-sep   { width: 1px; background: var(--ai-border); }
  .banner-chips { padding: 16px 20px; display: flex; flex-direction: column; gap: 6px; }
  .banner-chips-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .chip {
    text-align: left; padding: 7px 10px; border-radius: 6px;
    background: rgba(var(--primary-rgb),0.08); border: 1px solid rgba(var(--primary-rgb),0.2);
    font-size: 0.72rem; color: var(--primary); cursor: pointer;
    transition: background 0.15s;
  }
  .chip:hover { background: rgba(var(--primary-rgb),0.16); }
  .skeleton-line { height: 8px; border-radius: 4px; background: var(--border); animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  @media (max-width: 640px) {
    .banner { grid-template-columns: 1fr; }
    .banner-sep { width: auto; height: 1px; }
  }
</style>
