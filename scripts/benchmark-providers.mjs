#!/usr/bin/env node
/**
 * Provider Quality Benchmark
 * Calls every configured AI provider with the same 3 sample tweets,
 * comparing latency, token usage, JSON compliance, and output quality.
 *
 * Usage:  node scripts/benchmark-providers.mjs
 * Requires: .env.local in project root with API keys set.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) process.env[key] = value;
}

// ── Provider definitions (mirrors ai-providers.ts) ───────────────────────────
const PROVIDERS = [
    {
        name: 'Google AI Studio',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash',
        apiKeyEnvVar: 'GOOGLE_AI_API_KEY',
        costPer1MIn: 0,       // free tier
        costPer1MOut: 0,
    },
    {
        name: 'Groq',
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'llama-3.3-70b-versatile',
        apiKeyEnvVar: 'GROQ_API_KEY',
        costPer1MIn: 0,
        costPer1MOut: 0,
    },
    {
        name: 'Cerebras',
        baseURL: 'https://api.cerebras.ai/v1',
        model: 'qwen-3-235b-a22b-instruct-2507',
        apiKeyEnvVar: 'CEREBRAS_API_KEY',
        costPer1MIn: 0,
        costPer1MOut: 0,
    },
    {
        name: 'SambaNova',
        baseURL: 'https://api.sambanova.ai/v1',
        model: 'Meta-Llama-3.3-70B-Instruct',
        apiKeyEnvVar: 'SAMBANOVA_API_KEY',
        costPer1MIn: 0,
        costPer1MOut: 0,
    },
    {
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY',
        costPer1MIn: 0.14,    // DeepSeek V3 pricing (cache miss)
        costPer1MOut: 0.28,
    },
];

// ── Test tweets — diverse content types ──────────────────────────────────────
const SAMPLE_TWEETS = [
    {
        id: 'technical',
        content:
            "React 19's new compiler eliminates the need for useMemo/useCallback in most cases. It auto-memoizes components and hooks. Tested on our app: 40% fewer re-renders, bundle dropped by 12KB. Migration took 2 hours for a 200-component codebase. The key gotcha: custom hooks that rely on referential equality for non-primitive return values still need manual memo.",
        author_handle: 'dan_abramov',
    },
    {
        id: 'business',
        content:
            'We A/B tested 14 pricing pages over 6 months. The winner every time: 3 tiers with the middle one highlighted as "Most Popular." But the real insight — adding a decoy enterprise tier at 5x the price increased Pro plan conversions by 34%. Anchoring is absurdly powerful. The decoy doesn\'t need to sell, it just needs to exist.',
        author_handle: 'paborenstein',
    },
    {
        id: 'ai_tools',
        content:
            'My prompt engineering workflow for coding tasks:\n1. Start with "You are a senior [language] engineer"\n2. Provide the FULL file context, not snippets\n3. Ask for a diff, not a rewrite\n4. End with "Think step by step, then output ONLY the diff"\n\nThis cut my error rate from ~30% to under 5%. The "diff only" instruction is the game-changer — it forces the model to be precise instead of hallucinating surrounding code.',
        author_handle: 'karpathy',
    },
];

const EXISTING_THEMES = ['Programming', 'Business Strategy', 'AI & Machine Learning'];
const EXISTING_COLLECTIONS = [
    'React Performance Patterns',
    'Pricing Strategy Tactics',
    'Prompt Engineering Techniques',
    'Cold Email Templates',
];

// ── System prompt (identical to ai-router.ts categorize) ─────────────────────
const SYSTEM_PROMPT = `You categorize tweets into specific, actionable collections under broad themes, and write sharp one-line summaries.

Rules:
- Assign a broad 2-4 word THEME (e.g. "Programming", "Business Strategy", "AI & Machine Learning", "Design Thinking", "Personal Development").
  Prefer reusing an existing theme name when a good match exists.
- Assign a SPECIFIC, ACTIONABLE collection within that theme — not vague categories.
  GOOD: "Pricing Strategy Tactics", "React Performance Patterns", "Cold Email Templates", "Fundraising Pitch Tips"
  BAD: "Tech", "Business", "Programming", "Interesting Thoughts", "General Advice"
- Collection names should be 2-5 words, title-cased, describing a skill or knowledge area someone would actively study.
- Prefer assigning to an existing collection if the tweet fits.
- The summary must capture the SPECIFIC actionable insight, not just restate the topic.
  GOOD: "Use tiered pricing anchored to a decoy option to increase average deal size by 20-30%"
  BAD: "A tweet about pricing strategies"

Existing themes: ${EXISTING_THEMES.join(', ')}
Existing collections: ${EXISTING_COLLECTIONS.join(', ')}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`;

// ── Call a single provider ───────────────────────────────────────────────────
async function callProvider(provider, tweetContent) {
    const apiKey = process.env[provider.apiKeyEnvVar];
    if (!apiKey) return { error: `No API key (${provider.apiKeyEnvVar} not set)` };

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: tweetContent },
    ];

    const start = performance.now();
    try {
        const res = await fetch(`${provider.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: provider.model,
                messages,
                max_tokens: 200,
                temperature: 0.2,
            }),
        });

        const latencyMs = Math.round(performance.now() - start);

        if (!res.ok) {
            const text = await res.text().catch(() => 'unknown');
            return { error: `HTTP ${res.status}: ${text.slice(0, 200)}`, latencyMs };
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? '';
        const tokensIn = data.usage?.prompt_tokens ?? 0;
        const tokensOut = data.usage?.completion_tokens ?? 0;

        // Try to parse JSON
        const cleaned = content
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        let parsed = null;
        let jsonValid = false;
        try {
            parsed = JSON.parse(cleaned);
            jsonValid = !!(parsed.theme_name && parsed.collection_name && parsed.summary);
        } catch {
            jsonValid = false;
        }

        return {
            latencyMs,
            tokensIn,
            tokensOut,
            rawContent: content,
            parsed,
            jsonValid,
            costUSD:
                (tokensIn / 1_000_000) * provider.costPer1MIn +
                (tokensOut / 1_000_000) * provider.costPer1MOut,
        };
    } catch (err) {
        const latencyMs = Math.round(performance.now() - start);
        return { error: err.message, latencyMs };
    }
}

// ── Quality scoring heuristics ───────────────────────────────────────────────
function scoreResult(result, tweetId) {
    if (!result.jsonValid) return { total: 0, breakdown: 'INVALID JSON' };

    let score = 0;
    const notes = [];

    // 1. JSON compliance (5 pts)
    score += 5;
    notes.push('+5 valid JSON');

    // 2. Reuses existing theme? (3 pts)
    const theme = result.parsed.theme_name;
    if (EXISTING_THEMES.some((t) => t.toLowerCase() === theme.toLowerCase())) {
        score += 3;
        notes.push('+3 reused theme');
    } else {
        notes.push('+0 new theme');
    }

    // 3. Reuses existing collection when appropriate? (3 pts)
    const col = result.parsed.collection_name;
    const matchesExisting = EXISTING_COLLECTIONS.some(
        (c) => c.toLowerCase() === col.toLowerCase()
    );
    // For our test tweets, all 3 SHOULD match existing collections
    if (matchesExisting) {
        score += 3;
        notes.push('+3 reused collection');
    } else {
        notes.push('+0 new collection');
    }

    // 4. Collection specificity — penalize vague names (2 pts)
    const vague = ['tech', 'business', 'programming', 'general', 'advice', 'thoughts'];
    const isVague = vague.some((v) => col.toLowerCase() === v);
    if (!isVague && col.split(/\s+/).length >= 2) {
        score += 2;
        notes.push('+2 specific collection');
    } else {
        notes.push('+0 vague collection');
    }

    // 5. Summary quality — not just restating the topic (5 pts)
    const summary = result.parsed.summary;
    const hasNumbers = /\d/.test(summary);
    const isLongEnough = summary.length > 60;
    const notVagueSummary = !/^a tweet about/i.test(summary);
    if (notVagueSummary && isLongEnough && hasNumbers) {
        score += 5;
        notes.push('+5 actionable summary w/ specifics');
    } else if (notVagueSummary && isLongEnough) {
        score += 3;
        notes.push('+3 decent summary');
    } else if (notVagueSummary) {
        score += 1;
        notes.push('+1 basic summary');
    } else {
        notes.push('+0 poor summary');
    }

    return { total: score, breakdown: notes.join(', ') };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          AI PROVIDER BENCHMARK — Categorization            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log();

    const allResults = {};
    const summaryRows = [];

    for (const provider of PROVIDERS) {
        const apiKey = process.env[provider.apiKeyEnvVar];
        if (!apiKey) {
            console.log(`⏭  Skipping ${provider.name} — no API key\n`);
            continue;
        }

        console.log(`\n${'━'.repeat(62)}`);
        console.log(`🤖  ${provider.name}  (${provider.model})`);
        console.log(`${'━'.repeat(62)}`);

        let totalScore = 0;
        let totalLatency = 0;
        let totalTokensIn = 0;
        let totalTokensOut = 0;
        let totalCost = 0;
        let successes = 0;

        for (const tweet of SAMPLE_TWEETS) {
            const userContent = `@${tweet.author_handle}: ${tweet.content}`;
            console.log(`\n  📝 Tweet: "${tweet.id}"`);

            const result = await callProvider(provider, userContent);

            if (result.error) {
                console.log(`     ❌ ERROR: ${result.error}`);
                continue;
            }

            const quality = scoreResult(result, tweet.id);

            console.log(`     ⏱  Latency: ${result.latencyMs}ms`);
            console.log(`     📊 Tokens: ${result.tokensIn} in / ${result.tokensOut} out`);
            console.log(`     ✅ JSON valid: ${result.jsonValid}`);
            if (result.parsed) {
                console.log(`     🏷  Theme: "${result.parsed.theme_name}"`);
                console.log(`     📁 Collection: "${result.parsed.collection_name}"`);
                console.log(`     📝 Summary: "${result.parsed.summary}"`);
            }
            console.log(`     🎯 Quality: ${quality.total}/18 (${quality.breakdown})`);

            totalScore += quality.total;
            totalLatency += result.latencyMs;
            totalTokensIn += result.tokensIn;
            totalTokensOut += result.tokensOut;
            totalCost += result.costUSD;
            successes++;
        }

        if (successes > 0) {
            summaryRows.push({
                name: provider.name,
                model: provider.model,
                avgScore: (totalScore / successes).toFixed(1),
                totalScore,
                maxScore: successes * 18,
                avgLatency: Math.round(totalLatency / successes),
                totalTokensIn,
                totalTokensOut,
                totalCost: totalCost.toFixed(6),
                successes,
                costTier: provider.costPer1MIn > 0 ? 'PAID' : 'FREE',
            });
        }
    }

    // ── Summary table ────────────────────────────────────────────────────────
    console.log('\n\n');
    console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                 BENCHMARK SUMMARY                                              ║');
    console.log('╠══════════════════════════╤═══════════╤══════════╤════════════╤═════════════╤══════════╤══════════╣');
    console.log('║ Provider                 │ Avg Score │ Avg ms   │ Tokens In  │ Tokens Out  │ Cost $   │ Tier     ║');
    console.log('╠══════════════════════════╪═══════════╪══════════╪════════════╪═════════════╪══════════╪══════════╣');

    // Sort by score descending
    summaryRows.sort((a, b) => b.totalScore - a.totalScore);

    for (const row of summaryRows) {
        console.log(
            `║ ${row.name.padEnd(24)} │ ${(row.avgScore + '/18').padStart(9)} │ ${String(row.avgLatency + 'ms').padStart(8)} │ ${String(row.totalTokensIn).padStart(10)} │ ${String(row.totalTokensOut).padStart(11)} │ ${('$' + row.totalCost).padStart(8)} │ ${row.costTier.padStart(8)} ║`
        );
    }

    console.log('╚══════════════════════════╧═══════════╧══════════╧════════════╧═════════════╧══════════╧══════════╝');

    // ── Recommendation ─────────────────────────────────────────────────────
    console.log('\n📋 RECOMMENDED PRIORITY ORDER (quality × cost):');
    const ranked = summaryRows
        .map((r) => ({
            ...r,
            // Free providers get a big bonus; among free, sort by quality
            rank: r.costTier === 'FREE' ? r.totalScore + 100 : r.totalScore,
        }))
        .sort((a, b) => b.rank - a.rank);

    ranked.forEach((r, i) => {
        const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i] ?? `${i + 1}.`;
        console.log(`   ${medal}  ${r.name} — score ${r.avgScore}/18, ${r.avgLatency}ms avg, ${r.costTier}`);
    });
}

main().catch(console.error);
