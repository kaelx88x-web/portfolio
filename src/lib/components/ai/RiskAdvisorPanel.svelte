<script lang="ts">
  import { Send } from 'lucide-svelte';
  import AiObservationCard from './AiObservationCard.svelte';
  import AiRiskWarningBanner from './AiRiskWarningBanner.svelte';
  import AiEducationalTip from './AiEducationalTip.svelte';
  export let response: any;
  export let type = 'risk';
</script>

<section class="panel">
  <AiRiskWarningBanner warnings={response?.warnings ?? []} mode={response?.account_mode} />
  <div class="summary">
    <h2>{response?.title}</h2>
    <p>{response?.summary}</p>
  </div>
  <form method="POST" action="?/ask" class="ask">
    <input type="hidden" name="type" value={type} />
    <textarea name="question" rows="3" placeholder="Ask a calm risk question..." required></textarea>
    <button class="button" type="submit"><Send size={15} /> Ask</button>
  </form>
  <div class="grid">
    <AiObservationCard title="Main Risk Drivers" items={response?.main_risk_drivers ?? []} />
    <AiObservationCard title="Safer Considerations" items={response?.safer_considerations ?? []} />
  </div>
  <AiEducationalTip note={response?.educational_note} />
</section>

<style>
  .panel { display: grid; gap: 12px; }
  .summary, .ask { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  p { margin: 8px 0 0; color: var(--muted); font-size: 0.78rem; line-height: 1.5; }
  .ask { display: grid; gap: 8px; }
  textarea { width: 100%; border: 1px solid var(--border); border-radius: 8px; background: rgba(6,12,24,.72); color: var(--text); padding: 10px; font: inherit; font-size: .8rem; resize: vertical; }
  button { justify-self: end; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
</style>
