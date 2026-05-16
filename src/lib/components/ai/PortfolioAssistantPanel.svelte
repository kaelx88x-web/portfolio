<script lang="ts">
  import { Send } from 'lucide-svelte';
  import AiEducationalTip from './AiEducationalTip.svelte';
  import AiObservationCard from './AiObservationCard.svelte';
  import AiRiskNotice from './AiRiskNotice.svelte';

  export let response: any;
  export let askAction = '?/ask';
  export let type = 'portfolio';
</script>

<section class="assistant-panel">
  <div class="response">
    <h2>{response?.title}</h2>
    <p>{response?.summary}</p>
  </div>

  <form method="POST" action={askAction} class="ask-form">
    <input type="hidden" name="type" value={type} />
    <textarea name="question" rows="3" placeholder="Ask the assistant to explain this in simpler terms..." required></textarea>
    <button class="button" type="submit"><Send size={15} /> Ask</button>
  </form>

  <div class="grid">
    <AiObservationCard title="What The Data Suggests" items={response?.key_observations ?? []} />
    <AiRiskNotice risks={response?.risk_considerations ?? []} mode={response?.account_mode} />
  </div>
  <AiEducationalTip note={response?.educational_note} />
</section>

<style>
  .assistant-panel {
    display: grid;
    gap: 12px;
  }

  .response {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
  }

  p {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .ask-form {
    display: grid;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px;
  }

  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(6, 12, 24, 0.72);
    color: var(--text);
    padding: 10px;
    font: inherit;
    font-size: 0.8rem;
    resize: vertical;
  }

  button {
    justify-self: end;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
