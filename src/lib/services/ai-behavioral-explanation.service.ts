/**
 * AI-generated Malay explanation of the user's behavioral investor profile.
 * Tries Claude → Gemini → OpenAI → falls back to a template string.
 */
import { env } from '$env/dynamic/private';
import type { BehavioralProfile } from '$lib/services/behavioral-profile.service';

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getBehavioralExplanation(profile: BehavioralProfile): Promise<string> {
  const { system, user } = buildPrompt(profile);

  if (env.ANTHROPIC_API_KEY && env.AI_PROVIDER_CLAUDE_ENABLED === 'true') {
    const result = await callClaude(system, user);
    if (result) return result;
  }
  if (env.GEMINI_API_KEY && env.AI_PROVIDER_GEMINI_ENABLED === 'true') {
    const result = await callGemini(system, user);
    if (result) return result;
  }
  if (env.OPENAI_API_KEY && env.AI_PROVIDER_OPENAI_ENABLED !== 'false') {
    const result = await callOpenAI(system, user);
    if (result) return result;
  }
  if (env.AI_PROVIDER_OLLAMA_ENABLED === 'true' && env.AI_OLLAMA_URL) {
    const result = await callOllama(system, user);
    if (result) return result;
  }

  return buildFallback(profile);
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(p: BehavioralProfile): { system: string; user: string } {
  const dimSummary = p.dimensions
    .map(d => `${d.label}: ${d.score}% (${d.color})`)
    .join(', ');

  const evidenceSummary = p.evidence
    .map(e => e.text + (e.boldPart ?? ''))
    .join(' | ');

  const system = `Kamu adalah penasihat portfolio yang berbahasa Melayu.
Tugas kamu: Tulis 2–3 ayat ringkas dalam Bahasa Melayu (boleh campur sedikit Inggeris untuk istilah teknikal)
yang menerangkan profil pelabur pengguna berdasarkan data tingkah laku mereka,
dan bagaimana ia mempengaruhi cadangan rebalance mereka.
Guna nada yang mesra dan mudah faham. Jangan sebut nombor teknikal secara berlebihan.
Balas dengan teks ayat sahaja — tiada JSON, tiada markdown, tiada heading.`;

  const user = `Data profil pelabur:
- Profil dinyatakan: ${p.statedProfile}
- Profil sebenar (dari tingkah laku): ${p.actualProfile}
- Confidence: ${p.confidencePct}% (${p.dataPoints} data points)
- Dimensi: ${dimSummary}
- Bukti: ${evidenceSummary || 'tiada data transaksi lagi'}
- Pemberat scenario cadangan: Aggressive ${p.weights.aggressive}%, Balanced ${p.weights.balanced}%, Conservative ${p.weights.conservative}%
- Cash floor dicadangkan: ${p.weights.cashFloorPct}%
- Rebalance trigger: ${p.weights.rebalanceTrigger}

Terangkan kenapa profil ini terhasil dan bagaimana ia mempengaruhi strategi rebalance pengguna.`;

  return { system, user };
}

// ─── Claude ───────────────────────────────────────────────────────────────────

async function callClaude(system: string, user: string): Promise<string | null> {
  const apiKey = env.ANTHROPIC_API_KEY;
  const model  = env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 300, temperature: 0.5, system, messages: [{ role: 'user', content: user }] })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.content?.[0]?.text ?? '').trim() || null;
  } catch { return null; }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(system: string, user: string): Promise<string | null> {
  const model = env.AI_GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim() || null;
  } catch { return null; }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(system: string, user: string): Promise<string | null> {
  const apiKey = env.OPENAI_API_KEY;
  const model  = env.AI_OPENAI_MODEL ?? 'gpt-4o-mini';
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.5, max_tokens: 300 })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.choices?.[0]?.message?.content ?? '').trim() || null;
  } catch { return null; }
}

// ─── Ollama (local) ───────────────────────────────────────────────────────────

async function callOllama(system: string, user: string): Promise<string | null> {
  const url   = `${env.AI_OLLAMA_URL}/api/chat`;
  const model = env.AI_OLLAMA_MODEL ?? 'llama3.2:3b';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        stream: false,
        options: { temperature: 0.5, num_predict: 300 }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.message?.content ?? '').trim() || null;
  } catch { return null; }
}

// ─── Fallback (no AI) ─────────────────────────────────────────────────────────

function buildFallback(p: BehavioralProfile): string {
  const profileMy: Record<string, string> = {
    aggressive:   'agresif',
    balanced:     'sederhana',
    conservative: 'konservatif',
  };
  const actual = profileMy[p.actualProfile] ?? p.actualProfile;
  const stated = profileMy[p.statedProfile] ?? p.statedProfile;
  const match  = p.actualProfile === p.statedProfile;

  const matchLine = match
    ? `Profil tingkah laku kamu selari dengan pilihan kamu — ${actual}.`
    : `Walaupun kamu menyatakan profil ${stated}, tingkah laku sebenar kamu menunjukkan corak ${actual}.`;

  const weightLine = p.actualProfile === 'aggressive'
    ? `Cadangan rebalance diberi berat lebih kepada scenario aggressive (${p.weights.aggressive}%) untuk selari dengan cara kamu melabur.`
    : p.actualProfile === 'conservative'
    ? `Cadangan rebalance mengutamakan scenario conservative (${p.weights.conservative}%) bagi mengurangkan risiko mengikut corak kamu.`
    : `Pemberat scenario diagihkan secara seimbang mengikut corak pelaburan kamu.`;

  return `${matchLine} ${weightLine} Semak cadangan di bawah dan buat keputusan berdasarkan situasi semasa kamu.`;
}
