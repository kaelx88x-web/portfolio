<script lang="ts">
  import { GraduationCap } from 'lucide-svelte';

  export let note = '';
</script>

<article class="tip">
  <GraduationCap size={16} />
  <p>{note || 'Educational context will appear after the assistant generates an explanation.'}</p>
</article>

<style>
  .tip {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 9px;
    border: 1px solid rgba(var(--primary-rgb), 0.28);
    border-radius: 8px;
    background: rgba(var(--primary-rgb), 0.08);
    color: var(--primary);
    padding: 12px;
  }

  p {
    margin: 0;
    color: var(--text);
    font-size: 0.76rem;
    line-height: 1.5;
  }
</style>
