<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Sparkles } from 'lucide-svelte';
  import type { RiskLevel } from '$lib/services/behavioral-profile.service';

  export let recommended: RiskLevel = 'moderate';
  export let selected: RiskLevel    = recommended;
  export let confidence: number     = 0;

  const dispatch = createEventDispatcher<{ change: RiskLevel }>();

  type Card = { level: RiskLevel; icon: string; label: string; mode: string; desc: string };

  const cards: Card[] = [
    { level: 'conservative', icon: '🛡️', label: 'Conservative', mode: 'Stock only',      desc: 'Minimize volatility. Capital preservation priority.' },
    { level: 'moderate',     icon: '⚖️', label: 'Moderate',     mode: 'Hybrid strategy', desc: 'Balance growth and stability. AI-tuned allocation.'  },
    { level: 'aggressive',   icon: '🚀', label: 'Aggressive',   mode: 'Options enabled', desc: 'Maximum return focus. Higher risk accepted.'         },
  ];

  function select(level: RiskLevel) {
    selected = level;
    dispatch('change', level);
  }
</script>

<div class="strategy-cards" role="radiogroup" aria-label="Risk level selection">
  {#each cards as card}
    <button
      type="button"
      role="radio"
      aria-checked={selected === card.level}
      class="card"
      class:active={selected === card.level}
      class:is-ai={confidence > 0 && card.level === recommended}
      on:click={() => select(card.level)}
    >
      {#if confidence > 0 && card.level === recommended}
        <div class="ai-badge">
          <Sparkles size={9} />
          AI Pick - {confidence}%
        </div>
      {/if}
      <div class="icon">{card.icon}</div>
      <strong class="name">{card.label}</strong>
      <span class="mode-tag">{card.mode}</span>
      <span class="desc">{card.desc}</span>
    </button>
  {/each}
</div>

<style>
  .strategy-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 5px;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 18px 14px 12px;
    cursor: pointer;
    background: var(--bg);
    text-align: left;
    transition: border-color 0.12s, background 0.12s;
  }
  .card:hover        { border-color: rgba(var(--primary-rgb), 0.5); }
  .card.is-ai:not(.active) { border-color: rgba(var(--primary-rgb), 0.3); }
  .card.active {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.06);
  }

  .ai-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--primary);
    color: #fff;
    font-size: 0.6rem;
    font-weight: 800;
    padding: 2px 9px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .icon     { font-size: 1.5rem; margin-bottom: 2px; }
  .name     { font-size: 0.88rem; font-weight: 800; color: var(--text); }
  .card.active .name { color: var(--primary); }

  .mode-tag {
    align-self: flex-start;
    font-size: 0.62rem;
    font-weight: 700;
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 7px;
    margin-bottom: 2px;
  }
  .card.active .mode-tag {
    border-color: rgba(var(--primary-rgb), 0.3);
    color: var(--primary);
  }

  .desc { font-size: 0.67rem; color: var(--muted); line-height: 1.45; }

  @media (max-width: 900px) { .strategy-cards { grid-template-columns: 1fr; } }
</style>
