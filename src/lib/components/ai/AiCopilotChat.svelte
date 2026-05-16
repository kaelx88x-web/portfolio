<script lang="ts">
  import { SendHorizonal } from 'lucide-svelte';
  import AiMessageBubble from './AiMessageBubble.svelte';

  type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; };
  type Conversation = { id: string; messages: ChatMessage[]; };

  export let conversation: Conversation | null = null;
  export let period = 'MAX';
  export let benchmark = 'SPY';

  $: messages = conversation?.messages ?? [];
</script>

<div class="chat-shell card">
  <!-- Header -->
  <div class="chat-header">
    <div class="chat-title">AI Copilot Chat</div>
    <div class="chat-sub">Using {period} context vs {benchmark}</div>
  </div>

  <!-- Message area -->
  <div class="chat-body">
    {#each messages as message}
      <AiMessageBubble role={message.role} content={message.content} />
    {/each}
    {#if messages.length === 0}
      <div class="chat-empty">Ask a portfolio question to start a saved Copilot conversation.</div>
    {/if}
  </div>

  <!-- Input bar -->
  <form method="POST" action="?/ask" class="chat-input">
    {#if conversation?.id}
      <input type="hidden" name="conversationId" value={conversation.id} />
    {/if}
    <textarea
      class="chat-field"
      name="question"
      rows="1"
      placeholder="Ask about risk, allocation, performance, or benchmark comparison…"
    ></textarea>
    <button class="chat-send button" type="submit" title="Send">
      <SendHorizonal size={16} />
      Ask
    </button>
  </form>
</div>

<style>
  .chat-shell  { display: flex; flex-direction: column; min-height: 34rem; overflow: hidden; }

  .chat-header { padding: 14px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .chat-title  { font-size: 0.85rem; font-weight: 700; color: var(--text); }
  .chat-sub    { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }

  .chat-body   { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;
                 background: var(--ai-bg); }
  .chat-empty  { text-align: center; font-size: 0.78rem; color: var(--muted); padding: 32px 16px;
                 background: var(--card); border: 1px solid var(--border); border-radius: 8px; }

  .chat-input  { padding: 12px 14px; border-top: 1px solid var(--border); display: flex; gap: 8px; flex-shrink: 0; background: var(--card); }
  .chat-field  { flex: 1; min-height: 40px; resize: none; background: var(--ai-bg); border: 1px solid var(--border);
                 border-radius: 8px; padding: 9px 12px; font-size: 0.8rem; color: var(--text); outline: none;
                 transition: border-color 0.15s; }
  .chat-field:focus { border-color: rgba(var(--primary-rgb),0.5); }
  .chat-field::placeholder { color: var(--muted); }
  .chat-send   { height: 40px; padding: 0 14px; font-size: 0.78rem; flex-shrink: 0; }
</style>
