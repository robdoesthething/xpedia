#!/usr/bin/env node
/**
 * Prompt Iteration A/B Tester
 * Tests multiple prompt variants against the same tweet corpus on Groq,
 * scoring quality to find the best-performing prompt.
 *
 * Usage:  node scripts/prompt-iterate.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq)]) process.env[t.slice(0, eq)] = t.slice(eq + 1);
}

// ── Groq config ──────────────────────────────────────────────────────────────
const GROQ = {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    apiKey: process.env.GROQ_API_KEY,
};

// ── Common context ───────────────────────────────────────────────────────────
const EXISTING_THEMES = ['Programming', 'Business Strategy', 'AI & Machine Learning', 'Design Thinking', 'Personal Development'];
const EXISTING_COLLECTIONS = [
    'React Performance Patterns',
    'Pricing Strategy Tactics',
    'Prompt Engineering Techniques',
    'Cold Email Templates',
    'Startup Fundraising Tips',
    'CSS Layout Patterns',
    'TypeScript Best Practices',
];

const themesContext = `Existing themes: ${EXISTING_THEMES.join(', ')}`;
const collectionsContext = `Existing collections: ${EXISTING_COLLECTIONS.join(', ')}`;

// ── Test corpus — diverse + edge cases ───────────────────────────────────────
const TWEETS = [
    {
        id: 'technical_with_numbers',
        content: "React 19's new compiler eliminates the need for useMemo/useCallback in most cases. It auto-memoizes components and hooks. Tested on our app: 40% fewer re-renders, bundle dropped by 12KB. Migration took 2 hours for a 200-component codebase. The key gotcha: custom hooks that rely on referential equality for non-primitive return values still need manual memo.",
        author_handle: 'dan_abramov',
        // Expected: should preserve 40%, 12KB, 2 hours, 200-component numbers
        expectedNumbers: ['40%', '12KB'],
    },
    {
        id: 'business_with_metrics',
        content: 'We A/B tested 14 pricing pages over 6 months. The winner every time: 3 tiers with the middle one highlighted as "Most Popular." But the real insight — adding a decoy enterprise tier at 5x the price increased Pro plan conversions by 34%. Anchoring is absurdly powerful. The decoy doesn\'t need to sell, it just needs to exist.',
        author_handle: 'paborenstein',
        expectedNumbers: ['34%', '5x'],
    },
    {
        id: 'ai_workflow_with_steps',
        content: 'My prompt engineering workflow for coding tasks:\n1. Start with "You are a senior [language] engineer"\n2. Provide the FULL file context, not snippets\n3. Ask for a diff, not a rewrite\n4. End with "Think step by step, then output ONLY the diff"\n\nThis cut my error rate from ~30% to under 5%. The "diff only" instruction is the game-changer — it forces the model to be precise instead of hallucinating surrounding code.',
        author_handle: 'karpathy',
        expectedNumbers: ['30%', '5%'],
    },
    {
        id: 'vague_motivational',
        content: 'The best time to start was yesterday. The second best time is now. Stop overthinking, stop planning, stop waiting for the perfect moment. Just ship it. 🚀',
        author_handle: 'elonmusk',
        // Edge case: vague content, should NOT get a specific technical collection
        expectedNumbers: [],
    },
    {
        id: 'css_technique',
        content: 'CSS tip: Use `container queries` instead of media queries for component-level responsiveness. @container (min-width: 400px) { .card { grid-template-columns: 1fr 1fr; } } — Works in all evergreen browsers since Jan 2024. 92% global support per caniuse.',
        author_handle: 'kevin_powell',
        expectedNumbers: ['92%', '400px'],
    },
    {
        id: 'fundraising_advice',
        content: "Raised $4.2M seed. What I'd do differently:\n- Don't take 30 meetings. Take 8 with the right VCs.\n- Your deck should be 12 slides max.\n- Lead with traction, not vision. We showed $38K MRR and 22% MoM growth.\n- Ask for intros, not money. The money follows.\n- Close in 2 weeks or move on.",
        author_handle: 'justinkan',
        expectedNumbers: ['$4.2M', '12 slides', '$38K', '22%'],
    },
    {
        id: 'short_insight',
        content: 'The single best TypeScript trick: Use `satisfies` instead of type annotations. It validates the type but preserves the narrower literal type. const routes = { home: "/", about: "/about" } satisfies Record<string, string>; — routes.home is still "/" not string.',
        author_handle: 'mattpocock',
        expectedNumbers: [],
    },
];

// ── Prompt variants ──────────────────────────────────────────────────────────
const PROMPTS = {
    // V0: Current production prompt (baseline)
    v0_baseline: `You categorize tweets into specific, actionable collections under broad themes, and write sharp one-line summaries.

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

${themesContext}
${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`,

    // V1: Stronger number preservation + summary structure
    v1_numbers: `You categorize tweets into specific, actionable collections under broad themes, and write sharp one-line summaries.

THEME rules:
- 2-4 words, broad category. Prefer an existing theme name when a good match exists.

COLLECTION rules:
- 2-5 words, title-cased, specific enough that someone would actively study it.
- GOOD: "React Performance Patterns", "Pricing Strategy Tactics", "Cold Email Templates"
- BAD: "Tech", "Business", "Programming", "General Advice"
- Prefer an existing collection if the tweet fits.

SUMMARY rules — this is the most important field:
- One sentence capturing the CORE actionable insight.
- ALWAYS preserve exact numbers, percentages, dollar amounts, and metrics from the tweet.
- Format: "[Action verb] [specific technique] to [measurable outcome]"
- GOOD: "Add a decoy enterprise tier at 5x the price to boost Pro plan conversions by 34%"
- BAD: "A tweet about pricing strategies"
- BAD: "Use decoy pricing to increase conversions" (missing the specific numbers!)

${themesContext}
${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`,

    // V2: Few-shot examples + stricter format
    v2_fewshot: `Categorize tweets into collections under themes. Write a one-line summary.

Rules:
- theme_name: 2-4 words, broad. Reuse existing themes.
- collection_name: 2-5 words, title-cased, specific skill/knowledge area. Reuse existing collections.
- summary: One sentence. MUST include exact numbers/metrics from the tweet. Action-oriented.

Examples:
Tweet: "We tested removing the signup wall and conversions went up 23%. Free users convert at 8% within 30 days."
→ {"theme_name": "Business Strategy", "collection_name": "Conversion Optimization Tactics", "summary": "Remove signup walls to boost conversions by 23% — free users convert at 8% within 30 days"}

Tweet: "TypeScript 5.4: satisfies + infer = you can now extract literal types from config objects without losing type safety"
→ {"theme_name": "Programming", "collection_name": "TypeScript Best Practices", "summary": "Combine satisfies with infer in TS 5.4 to extract literal types from config objects while keeping full type safety"}

${themesContext}
${collectionsContext}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`,

    // V3: Concise role + CoT instruction
    v3_concise: `Role: Tweet categorizer. You read a tweet and output JSON.

Output exactly: {"theme_name": "...", "collection_name": "...", "summary": "..."}

- theme_name: Reuse from [${EXISTING_THEMES.join(', ')}] if possible. Otherwise 2-4 words.
- collection_name: Reuse from [${EXISTING_COLLECTIONS.join(', ')}] if possible. Otherwise 2-5 words, title-cased, describing a studyable skill area. Never vague ("Tech", "Business").
- summary: One actionable sentence. Preserve ALL numbers, percentages, dollar amounts, timeframes from the tweet. Start with a verb.

Think about which collection best fits, then write the JSON.`,
};

// ── API call ─────────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userContent) {
    const start = performance.now();
    const res = await fetch(`${GROQ.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ.apiKey}`,
        },
        body: JSON.stringify({
            model: GROQ.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
            max_tokens: 200,
            temperature: 0.2,
        }),
    });

    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
        const text = await res.text().catch(() => 'unknown');
        return { error: `HTTP ${res.status}: ${text.slice(0, 150)}`, latencyMs };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    return {
        latencyMs,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        rawContent: content,
    };
}

// ── Scoring ──────────────────────────────────────────────────────────────────
function score(result, tweet) {
    const points = {};
    let total = 0;

    // Parse JSON
    const cleaned = (result.rawContent || '')
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { return { total: 0, points: { json: 0 }, parsed: null }; }

    if (!parsed.theme_name || !parsed.collection_name || !parsed.summary) {
        return { total: 0, points: { json: 0 }, parsed };
    }

    // 1. Valid JSON with all fields (5 pts)
    points.json = 5; total += 5;

    // 2. Theme reuse (3 pts)
    const themeReused = EXISTING_THEMES.some(t => t.toLowerCase() === parsed.theme_name.toLowerCase());
    points.theme_reuse = themeReused ? 3 : 0;
    total += points.theme_reuse;

    // 3. Collection reuse when appropriate (3 pts)
    const colReused = EXISTING_COLLECTIONS.some(c => c.toLowerCase() === parsed.collection_name.toLowerCase());
    points.collection_reuse = colReused ? 3 : 0;
    total += points.collection_reuse;

    // 4. Collection specificity (2 pts)
    const vague = ['tech', 'business', 'programming', 'general', 'advice', 'thoughts', 'interesting', 'misc'];
    const isVague = vague.some(v => parsed.collection_name.toLowerCase() === v);
    points.collection_specific = (!isVague && parsed.collection_name.split(/\s+/).length >= 2) ? 2 : 0;
    total += points.collection_specific;

    // 5. Summary preserves key numbers (5 pts)
    const summary = parsed.summary;
    if (tweet.expectedNumbers.length > 0) {
        const found = tweet.expectedNumbers.filter(n => summary.includes(n));
        const ratio = found.length / tweet.expectedNumbers.length;
        points.numbers = Math.round(ratio * 5);
    } else {
        // No expected numbers — give full marks if summary is substantive
        points.numbers = summary.length > 40 ? 5 : (summary.length > 20 ? 3 : 1);
    }
    total += points.numbers;

    // 6. Summary actionability — starts with verb, has specifics (3 pts)
    const startsWithVerb = /^(use|add|apply|implement|combine|remove|test|run|start|build|set|ask|lead|close|adopt|preserve|leverage|create|switch|replace|integrate|extract|deploy|audit)/i.test(summary);
    const isLongEnough = summary.length > 50;
    const notVague = !/^a tweet about/i.test(summary);
    points.actionability = (startsWithVerb ? 1 : 0) + (isLongEnough ? 1 : 0) + (notVague ? 1 : 0);
    total += points.actionability;

    return { total, points, parsed };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║         PROMPT ITERATION A/B TEST — Groq (Llama 3.3)        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const results = {};

    for (const [promptName, promptText] of Object.entries(PROMPTS)) {
        console.log(`\n${'━'.repeat(65)}`);
        console.log(`📋  Prompt: ${promptName}`);
        console.log(`${'━'.repeat(65)}`);

        results[promptName] = { scores: [], totalTokens: 0, totalLatency: 0, details: [] };

        for (const tweet of TWEETS) {
            const userContent = `@${tweet.author_handle}: ${tweet.content}`;
            const result = await callGroq(promptText, userContent);

            if (result.error) {
                console.log(`  ❌ ${tweet.id}: ${result.error}`);
                results[promptName].details.push({ id: tweet.id, error: result.error });
                continue;
            }

            const s = score(result, tweet);
            results[promptName].scores.push(s.total);
            results[promptName].totalTokens += (result.tokensIn + result.tokensOut);
            results[promptName].totalLatency += result.latencyMs;

            const numInfo = tweet.expectedNumbers.length > 0
                ? ` nums:${s.points.numbers}/5`
                : '';
            console.log(
                `  ${s.total >= 18 ? '🟢' : s.total >= 14 ? '🟡' : '🔴'} ${tweet.id.padEnd(28)} ${String(s.total).padStart(2)}/21  `
                + `${result.latencyMs}ms${numInfo}`
            );
            if (s.parsed) {
                console.log(`     📁 ${s.parsed.collection_name}`);
                console.log(`     📝 ${s.parsed.summary}`);
            }

            results[promptName].details.push({ id: tweet.id, score: s, latencyMs: result.latencyMs, parsed: s.parsed });

            // Rate limit: Groq allows 30 RPM, ~2s between calls is safe
            await new Promise(r => setTimeout(r, 2200));
        }
    }

    // ── Summary comparison ───────────────────────────────────────────────────
    console.log('\n\n');
    console.log('╔═══════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                            PROMPT COMPARISON SUMMARY                                 ║');
    console.log('╠══════════════════════╤════════════╤════════════╤══════════════╤════════════╤══════════╣');
    console.log('║ Prompt               │ Avg Score  │ Total Score│ Avg Latency  │ Tokens     │ Perfect  ║');
    console.log('╠══════════════════════╪════════════╪════════════╪══════════════╪════════════╪══════════╣');

    const sorted = Object.entries(results)
        .map(([name, data]) => {
            const avg = data.scores.length > 0
                ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
                : 0;
            const total = data.scores.reduce((a, b) => a + b, 0);
            const max = data.scores.length * 21;
            const perfect = data.scores.filter(s => s === 21).length;
            const avgLatency = data.scores.length > 0
                ? Math.round(data.totalLatency / data.scores.length)
                : 0;
            return { name, avg, total, max, perfect, avgLatency, totalTokens: data.totalTokens, count: data.scores.length };
        })
        .sort((a, b) => b.total - a.total);

    for (const row of sorted) {
        console.log(
            `║ ${row.name.padEnd(20)} │ ${(row.avg.toFixed(1) + '/21').padStart(10)} │ ${(row.total + '/' + row.max).padStart(10)} │ ${(row.avgLatency + 'ms').padStart(12)} │ ${String(row.totalTokens).padStart(10)} │ ${(row.perfect + '/' + row.count).padStart(8)} ║`
        );
    }

    console.log('╚══════════════════════╧════════════╧════════════╧══════════════╧════════════╧══════════╝');

    // ── Per-tweet breakdown ────────────────────────────────────────────────
    console.log('\n📊 HEAD-TO-HEAD: Number Preservation (key metric)');
    console.log('─'.repeat(70));
    for (const tweet of TWEETS) {
        if (tweet.expectedNumbers.length === 0) continue;
        console.log(`\n  ${tweet.id} (expected: ${tweet.expectedNumbers.join(', ')})`);
        for (const [name, data] of Object.entries(results)) {
            const detail = data.details.find(d => d.id === tweet.id);
            if (!detail || detail.error) {
                console.log(`    ${name}: ERROR`);
                continue;
            }
            const nums = detail.score.points.numbers;
            const summary = detail.parsed?.summary ?? '(none)';
            console.log(`    ${nums === 5 ? '✅' : '❌'} ${name.padEnd(16)} nums:${nums}/5  "${summary}"`);
        }
    }

    // ── Winner ─────────────────────────────────────────────────────────────
    console.log(`\n🏆 WINNER: ${sorted[0].name} (${sorted[0].avg.toFixed(1)}/21 avg, ${sorted[0].perfect}/${sorted[0].count} perfect)`);
}

main().catch(console.error);
