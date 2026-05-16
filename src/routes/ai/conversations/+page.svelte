<script lang="ts">
  import { date } from '$lib/format';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader
    title="AI Conversations"
    subtitle="Saved Copilot chat history."
    breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Conversations' }]}
  />
  <a class="button" href="/ai/copilot">New Chat</a>
</div>

{#if data.conversations.length === 0}
  <EmptyState
    icon="◌"
    title="No conversations yet"
    description="Open Copilot and ask a portfolio question to start a saved conversation."
    ctaLabel="Open Copilot"
    ctaHref="/ai/copilot"
  />
{:else}
  <div class="card table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Conversation</th>
          <th>Status</th>
          <th>Messages</th>
          <th>Last Updated</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.conversations as conv}
          <tr>
            <td>
              <div class="conv-title">{conv.title}</div>
              <div class="conv-id">{conv.id}</div>
            </td>
            <td>
              <span class="status-badge" class:status-active={conv.status === 'active'}>{conv.status}</span>
            </td>
            <td>{conv.messageCount}</td>
            <td style="color:#7a8fb0">{date(conv.updatedAt)}</td>
            <td style="text-align:right">
              <a class="open-link" href={`/ai/copilot?conversation=${conv.id}`}>Open →</a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .page-top  { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }

  .table-wrap { padding: 0; overflow: hidden; }

  .conv-title  { font-size: 0.82rem; font-weight: 600; color: #dce8ff; }
  .conv-id     { font-size: 0.62rem; color: #4a5a78; font-family: monospace; margin-top: 2px; }

  .status-badge { font-size: 0.65rem; font-weight: 600; text-transform: capitalize; padding: 2px 8px;
                  border-radius: 20px; background: rgba(26,32,56,0.8); border: 1px solid #1a2038; color: #7a8fb0; }
  .status-active { background: rgba(45,212,160,0.1); border-color: rgba(45,212,160,0.3); color: #2dd4a0; }

  .open-link   { font-size: 0.75rem; font-weight: 600; color: #6c8fff; text-decoration: none; }
  .open-link:hover { text-decoration: underline; }
</style>
