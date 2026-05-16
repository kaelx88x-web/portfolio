<script lang="ts">
  export let provider = 'local';
  export let model = '';
</script>

<span class="provider-badge" title={model || provider}>{provider}</span>

<style>
  .provider-badge {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    max-width: 160px;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid #2c3e56;
    background: #102033;
    color: #a7d8ff;
    font-size: 0.68rem;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }
</style>
