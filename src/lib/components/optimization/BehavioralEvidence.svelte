<!-- src/lib/components/optimization/BehavioralEvidence.svelte -->
<script lang="ts">
  import type { BehavioralEvidenceLine } from '$lib/services/behavioral-profile.service';
  export let evidence: BehavioralEvidenceLine[];
</script>

<div class="panel">
  <div class="panel-head">Bukti dari Data</div>
  {#if evidence.length === 0}
    <p class="empty">Run optimization dan tambah transaksi untuk jana analisis.</p>
  {:else}
    <ul class="list">
      {#each evidence as line}
        <li>
          {line.text}{#if line.boldPart}<strong>{line.boldPart}</strong>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .panel {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 14px;
  }
  .panel-head {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }
  li {
    display: flex;
    gap: 8px;
    color: var(--muted);
    font-size: 0.74rem;
    line-height: 1.5;
  }
  li::before {
    content: '●';
    color: var(--primary);
    flex-shrink: 0;
    margin-top: 1px;
  }
  strong { color: var(--text); font-weight: 700; }
  .empty { margin: 0; color: var(--muted); font-size: 0.74rem; }
</style>
