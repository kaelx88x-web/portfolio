<script lang="ts">
  export let value = 50;
  export let name = 'riskTolerance';
</script>

<label class="slider">
  <div><span>Risk Tolerance</span><strong>{Number(value).toFixed(0)}/100</strong></div>
  <input type="range" {name} min="0" max="100" step="1" bind:value />
</label>

<style>
  .slider { display: grid; gap: 8px; }
  div { display: flex; justify-content: space-between; gap: 10px; }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  strong { color: var(--text); font-size: 0.76rem; }
  input { width: 100%; accent-color: var(--primary); }
</style>
