<script lang="ts">
  import { tick } from 'svelte';
  import { SendHorizonal, StopCircle, Sparkles } from 'lucide-svelte';
  import AiMessageBubble from './AiMessageBubble.svelte';

  type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; };
  type Conversation = { id: string; messages: ChatMessage[]; };

  export let conversation: Conversation | null = null;
  export let period    = 'MAX';
  export let benchmark = 'SPY';

  // Local message state — starts from server-loaded conversation
  let messages: ChatMessage[] = conversation?.messages ?? [];
  let conversationId: string | null = conversation?.id ?? null;

  let question  = '';
  let loading   = false;
  let error     = '';
  let abortCtrl: AbortController | null = null;

  let bodyEl: HTMLElement;
  let inputEl: HTMLTextAreaElement;

  export function sendQuestion(q: string) {
    question = q;
    send();
  }

  async function scrollBottom() {
    await tick();
    if (bodyEl) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function autoResize() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  }

  async function send() {
    const q = question.trim();
    if (!q || loading) return;

    error    = '';
    question = '';
    if (inputEl) { inputEl.style.height = 'auto'; }

    // Optimistic user message
    const userId = crypto.randomUUID();
    messages = [...messages, { id: userId, role: 'user', content: q }];
    await scrollBottom();

    loading   = true;
    abortCtrl = new AbortController();

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ conversationId, question: q, period, benchmark }),
        signal:  abortCtrl.signal,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        error = data.error ?? `Request failed (${res.status})`;
        // Remove optimistic message on error
        messages = messages.filter(m => m.id !== userId);
      } else {
        conversationId = data.conversationId ?? conversationId;
        messages = [
          ...messages,
          { id: crypto.randomUUID(), role: 'assistant', content: data.answer },
        ];
        await scrollBottom();
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        error = 'Connection error — please try again.';
        messages = messages.filter(m => m.id !== userId);
      }
    } finally {
      loading   = false;
      abortCtrl = null;
      await tick();
      inputEl?.focus();
    }
  }

  function cancel() {
    abortCtrl?.abort();
    loading = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="chat-shell card">

  <!-- Header -->
  <div class="chat-header">
    <div class="chat-header-left">
      <div class="ai-mark"><Sparkles size={13} /></div>
      <div>
        <div class="chat-title">AI Copilot</div>
        <div class="chat-sub">Context: {period} · Benchmark: {benchmark}</div>
      </div>
    </div>
    {#if loading}
      <div class="thinking-badge">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        Thinking…
      </div>
    {/if}
  </div>

  <!-- Messages -->
  <div class="chat-body custom-scrollbar" bind:this={bodyEl}>
    {#if messages.length === 0}
      <div class="chat-empty">
        <div class="empty-icon"><Sparkles size={22} /></div>
        <div class="empty-title">Ask your AI Copilot</div>
        <div class="empty-sub">
          Questions about risk, allocation, performance, or benchmark comparison.
        </div>
      </div>
    {:else}
      {#each messages.filter(m => m.role === 'user' || m.role === 'assistant') as msg (msg.id)}
        <AiMessageBubble role={msg.role} content={msg.content} />
      {/each}

      {#if loading}
        <!-- Typing indicator -->
        <div class="typing-row">
          <div class="avatar-ai-sm"><Sparkles size={12} /></div>
          <div class="typing-bubble">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Error -->
  {#if error}
    <div class="error-bar">{error}</div>
  {/if}

  <!-- Input -->
  <div class="chat-input-area">
    <textarea
      class="chat-field"
      bind:this={inputEl}
      bind:value={question}
      on:keydown={onKeydown}
      on:input={autoResize}
      rows="1"
      placeholder="Ask about risk, allocation, performance…  (Enter to send, Shift+Enter for newline)"
      disabled={loading}
    ></textarea>

    {#if loading}
      <button class="send-btn cancel-btn" on:click={cancel} title="Cancel">
        <StopCircle size={16} />
      </button>
    {:else}
      <button
        class="send-btn"
        on:click={send}
        disabled={!question.trim()}
        title="Send"
      >
        <SendHorizonal size={16} />
      </button>
    {/if}
  </div>

</div>

<style>
  .chat-shell {
    display: flex; flex-direction: column;
    height: 100%; min-height: 36rem;
    overflow: hidden;
  }

  /* Header */
  .chat-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    flex-shrink: 0; gap: 12px;
  }
  .chat-header-left { display: flex; align-items: center; gap: 10px; }
  .ai-mark {
    width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(var(--primary-rgb), 0.12); color: var(--primary);
  }
  .chat-title { font-size: 0.84rem; font-weight: 700; color: var(--text); }
  .chat-sub   { font-size: 0.62rem; color: var(--muted); margin-top: 1px; }

  .thinking-badge {
    display: flex; align-items: center; gap: 5px;
    font-size: 0.68rem; font-weight: 600; color: var(--primary);
    background: rgba(var(--primary-rgb), 0.08);
    border: 1px solid rgba(var(--primary-rgb), 0.2);
    padding: 4px 10px; border-radius: 20px;
  }

  /* Body */
  .chat-body {
    flex: 1; overflow-y: auto;
    padding: 16px; display: flex; flex-direction: column; gap: 14px;
    background: var(--ai-bg);
    min-height: 0;
  }

  /* Empty state */
  .chat-empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 10px; padding: 40px 20px; text-align: center;
  }
  .empty-icon {
    width: 48px; height: 48px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(var(--primary-rgb), 0.1); color: var(--primary);
  }
  .empty-title { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .empty-sub   { font-size: 0.78rem; color: var(--muted); max-width: 300px; line-height: 1.5; }

  /* Typing indicator */
  .typing-row {
    display: flex; align-items: flex-end; gap: 8px;
  }
  .avatar-ai-sm {
    width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(var(--primary-rgb), 0.12); color: var(--primary);
  }
  .typing-bubble {
    display: flex; align-items: center; gap: 4px;
    padding: 10px 14px; border-radius: 12px 12px 12px 3px;
    background: var(--card); border: 1px solid var(--border);
  }

  /* Dots animation (shared: thinking badge + typing bubble) */
  .dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--primary); opacity: 0.6;
    animation: bounce 1.2s infinite ease-in-out;
    display: inline-block;
  }
  .dot:nth-child(1) { animation-delay: 0s;    }
  .dot:nth-child(2) { animation-delay: 0.2s;  }
  .dot:nth-child(3) { animation-delay: 0.4s;  }
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%           { transform: scale(1);   opacity: 1;   }
  }

  /* Error */
  .error-bar {
    padding: 9px 16px; flex-shrink: 0;
    background: rgba(var(--danger-rgb), 0.08);
    border-top: 1px solid rgba(var(--danger-rgb), 0.2);
    color: var(--danger); font-size: 0.78rem;
  }

  /* Input */
  .chat-input-area {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 10px 12px; border-top: 1px solid var(--border);
    background: var(--card); flex-shrink: 0;
  }
  .chat-field {
    flex: 1; resize: none; overflow: hidden;
    min-height: 40px; max-height: 140px;
    background: var(--ai-bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 12px;
    font-size: 0.82rem; color: var(--text); outline: none;
    transition: border-color 0.15s; line-height: 1.5;
    font-family: inherit;
  }
  .chat-field:focus { border-color: rgba(var(--primary-rgb), 0.5); }
  .chat-field::placeholder { color: var(--muted); }
  .chat-field:disabled { opacity: 0.6; }

  .send-btn {
    flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: var(--primary); color: #fff;
    border: none; cursor: pointer; transition: opacity 0.15s;
  }
  .send-btn:hover:not(:disabled) { opacity: 0.85; }
  .send-btn:disabled { opacity: 0.4; cursor: default; }
  .cancel-btn { background: var(--danger); }
</style>
