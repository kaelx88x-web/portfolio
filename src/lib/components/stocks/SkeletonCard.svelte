<div class="skel-card">
  <div class="skel-row">
    <div class="skel" style="width:48px;height:14px"></div>
    <div class="skel" style="width:60px;height:24px;border-radius:4px"></div>
  </div>
  <div class="skel" style="width:80%;height:10px;margin-top:8px"></div>
  <div class="skel" style="width:60%;height:10px;margin-top:4px"></div>
  <div class="skel" style="width:100%;height:32px;margin-top:12px;border-radius:6px"></div>
</div>

<style>
  .skel-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px;
    min-height: 160px;
  }
  .skel-row { display: flex; justify-content: space-between; align-items: flex-start; }
  .skel {
    background: linear-gradient(90deg,
      var(--border) 25%,
      rgba(255,255,255,0.06) 50%,
      var(--border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
