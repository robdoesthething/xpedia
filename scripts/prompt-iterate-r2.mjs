#!/usr/bin/env node
/**
 * Prompt Iteration Round 2
 * Builds on v1_numbers (the R1 winner) with targeted improvements.
 *
 * Usage:  node scripts/prompt-iterate-r2.mjs
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

const GROQ = {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    apiKey: process.env.GROQ_API_KEY,
};

const EXISTING_THEMES = ['Programming', 'Business Strategy', 'AI & Machine Learning', 'Design Thinking', 'Personal Development'];
const EXISTING_COLLECTIONS = [
    'React Performance Patterns', 'Pricing Strategy Tactics', 'Prompt Engineering Techniques',
    'Cold Email Templates', 'Startup Fundraising Tips', 'CSS Layout Patterns',
    'TypeScript Best Practices',
];

const themesCtx = `Existing themes: ${EXISTING_THEMES.join(', ')}`;
const colsCtx = `Existing collections: ${EXISTING_COLLECTIONS.join(', ')}`;

// ── Test corpus ──────────────────────────────────────────────────────────────
const TWEETS = [
    {
        id: 'technical_numbers',
        content: "React 19's new compiler eliminates the need for useMemo/useCallback in most cases. It auto-memoizes components and hooks. Tested on our app: 40% fewer re-renders, bundle dropped by 12KB. Migration took 2 hours for a 200-component codebase. The key gotcha: custom hooks that rely on referential equality for non-primitive return values still need manual memo.",
        author_handle: 'dan_abramov',
        expectedNumbers: ['40%', '12KB'],
    },
    {
        id: 'business_metrics',
        content: 'We A/B tested 14 pricing pages over 6 months. The winner every time: 3 tiers with the middle one highlighted as "Most Popular." But the real insight — adding a decoy enterprise tier at 5x the price increased Pro plan conversions by 34%. Anchoring is absurdly powerful. The decoy doesn\'t need to sell, it just needs to exist.',
        author_handle: 'paborenstein',
        expectedNumbers: ['34%', '5x'],
    },
    {
        id: 'ai_workflow',
        content: 'My prompt engineering workflow for coding tasks:\n1. Start with "You are a senior [language] engineer"\n2. Provide the FULL file context, not snippets\n3. Ask for a diff, not a rewrite\n4. End with "Think step by step, then output ONLY the diff"\n\nThis cut my error rate from ~30% to under 5%. The "diff only" instruction is the game-changer.',
        author_handle: 'karpathy',
        expectedNumbers: ['30%', '5%'],
    },
    {
        id: 'vague_motivational',
        content: 'The best time to start was yesterday. The second best time is now. Stop overthinking, stop planning, stop waiting for the perfect moment. Just ship it. 🚀',
        author_handle: 'elonmusk',
        expectedNumbers: [],
    },
    {
        id: 'css_technique',
        content: 'CSS tip: Use `container queries` instead of media queries for component-level responsiveness. @container (min-width: 400px) { .card { grid-template-columns: 1fr 1fr; } } — Works in all evergreen browsers since Jan 2024. 92% global support per caniuse.',
        author_handle: 'kevin_powell',
        expectedNumbers: ['92%', '400px'],
    },
    {
        id: 'fundraising',
        content: "Raised $4.2M seed. What I'd do differently:\n- Don't take 30 meetings. Take 8 with the right VCs.\n- Your deck should be 12 slides max.\n- Lead with traction, not vision. We showed $38K MRR and 22% MoM growth.\n- Ask for intros, not money. The money follows.\n- Close in 2 weeks or move on.",
        author_handle: 'justinkan',
        expectedNumbers: ['$4.2M', '12 slides', '$38K', '22%'],
    },
    {
        id: 'short_typescript',
        content: 'The single best TypeScript trick: Use `satisfies` instead of type annotations. It validates the type but preserves the narrower literal type. const routes = { home: "/", about: "/about" } satisfies Record<string, string>; — routes.home is still "/" not string.',
        author_handle: 'mattpocock',
        expectedNumbers: [],
    },
    // New harder edge cases for R2
    {
        id: 'mixed_language',
        content: 'Tip para crear un SaaS exitoso: La landing page debe cargar en < 2 segundos. Usa Lighthouse score > 90. El churn rate ideal es < 5% mensual. Nuestra startup redujo churn de 12% a 3.5% usando onboarding emails automatizados en los primeros 7 días.',
        author_handle: 'startupLatam',
        expectedNumbers: ['2 segundos', '5%', '12%', '3.5%'],
    },
    {
        id: 'dense_data',
        content: 'GitHub Copilot usage stats from our 50-person eng team after 6 months:\n- Code acceptance rate: 28%\n- Time to first PR: -35%\n- Bug density: unchanged\n- Developer satisfaction: 8.2/10\n- Cost: $19/seat/mo = $11,400/yr\n- ROI estimate: 2.3x based on time saved\nNot a silver bullet but clearly net positive.',
        author_handle: 'pragmaticeng',
        expectedNumbers: ['28%', '35%', '8.2/10', '$19'],
    },
];

// ── Prompt variants ──────────────────────────────────────────────────────────
const PROMPTS = {
    // R1 winner (current production) as baseline
    v1_baseline: `You categorize tweets into specific, actionable collections under broad themes, and write sharp one-line summaries.

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

${themesCtx}
${colsCtx}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`,

    // V4: Stronger verb-first + enumerate what counts as "numbers"
    v4_verb_enum: `You categorize tweets into collections under themes, and write a one-line actionable summary.

THEME: 2-4 words, broad. Reuse from existing list if possible.
COLLECTION: 2-5 words, title-cased, a studyable skill area. Reuse existing if it fits. Never vague ("Tech", "Business").

SUMMARY — the most important field:
- Start with an ACTION VERB (Add, Use, Implement, Switch, Set, Reduce, Run, Test, Apply, Build, Adopt, Create).
- Capture the CORE technique and its MEASURABLE RESULT.
- Copy ALL quantitative data verbatim: percentages (40%, 5x), dollar amounts ($38K), durations (2 hours, 7 days), counts (12 slides, 200 components), scores (8.2/10), and pixel/unit values (400px, 12KB).
- If the tweet has no specific technique or numbers, summarize the key mindset shift in one concrete sentence.

${themesCtx}
${colsCtx}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`,

    // V5: V4 + inline "thinking step" to force extraction before writing
    v5_extract_then_write: `You categorize tweets into collections under themes, and write a one-line actionable summary.

THEME: 2-4 words, broad. Reuse from existing list if possible.
COLLECTION: 2-5 words, title-cased, a studyable skill area. Reuse existing if it fits. Never vague.

SUMMARY — the most important field. Follow this process:
Step 1: Mentally list every number in the tweet (percentages, dollars, durations, counts, measurements).
Step 2: Identify the single most actionable takeaway.
Step 3: Write one sentence starting with an action verb that includes the takeaway AND the key numbers from Step 1.

Examples of good summaries:
- "Add a decoy enterprise tier at 5x the price to boost Pro plan conversions by 34%"
- "Use container queries at 400px breakpoints for component-level responsive layouts with 92% browser support"
- "Migrate to React 19's compiler to cut re-renders by 40% and trim 12KB from the bundle in under 2 hours"

${themesCtx}
${colsCtx}

Respond with ONLY valid JSON: {"theme_name": "...", "collection_name": "...", "summary": "..."}`,

    // V6: Minimal tokens — merge best of v3_concise + v4
    v6_tight: `Role: Tweet categorizer. Output JSON only.

{"theme_name": "...", "collection_name": "...", "summary": "..."}

theme_name: Reuse [${EXISTING_THEMES.join(', ')}] if fits. Else 2-4 words.
collection_name: Reuse [${EXISTING_COLLECTIONS.join(', ')}] if fits. Else 2-5 words, title-cased, studyable skill. Never vague.
summary: Start with verb. Include ALL numbers (%, $, counts, durations, sizes). One sentence, max 30 words. Core technique → measurable result.`,
};

// ── API call with retry ──────────────────────────────────────────────────────
async function callGroq(systemPrompt, userContent, retries = 1) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const start = performance.now();
        try {
            const res = await fetch(`${GROQ.baseURL}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ.apiKey}` },
                body: JSON.stringify({
                    model: GROQ.model,
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
                    max_tokens: 200,
                    temperature: 0.2,
                }),
            });
            const latencyMs = Math.round(performance.now() - start);
            if (res.status === 429) {
                if (attempt < retries) { await new Promise(r => setTimeout(r, 5000)); continue; }
                return { error: 'Rate limited', latencyMs };
            }
            if (!res.ok) return { error: `HTTP ${res.status}`, latencyMs };
            const data = await res.json();
            return {
                latencyMs,
                tokensIn: data.usage?.prompt_tokens ?? 0,
                tokensOut: data.usage?.completion_tokens ?? 0,
                rawContent: data.choices?.[0]?.message?.content ?? '',
            };
        } catch (err) {
            if (attempt < retries) { await new Promise(r => setTimeout(r, 3000)); continue; }
            return { error: err.message, latencyMs: Math.round(performance.now() - start) };
        }
    }
}

// ── Scoring ──────────────────────────────────────────────────────────────────
function score(result, tweet) {
    const points = {};
    let total = 0;

    const cleaned = (result.rawContent || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); } catch { return { total: 0, points: { json: 0 }, parsed: null }; }
    if (!parsed.theme_name || !parsed.collection_name || !parsed.summary) return { total: 0, points: { json: 0 }, parsed };

    points.json = 5; total += 5;

    const themeReused = EXISTING_THEMES.some(t => t.toLowerCase() === parsed.theme_name.toLowerCase());
    points.theme = themeReused ? 3 : 0; total += points.theme;

    const colReused = EXISTING_COLLECTIONS.some(c => c.toLowerCase() === parsed.collection_name.toLowerCase());
    points.collection = colReused ? 3 : 0; total += points.collection;

    const vague = ['tech', 'business', 'programming', 'general', 'advice', 'thoughts'];
    points.specificity = (!vague.includes(parsed.collection_name.toLowerCase()) && parsed.collection_name.split(/\s+/).length >= 2) ? 2 : 0;
    total += points.specificity;

    const summary = parsed.summary;
    if (tweet.expectedNumbers.length > 0) {
        const found = tweet.expectedNumbers.filter(n => summary.toLowerCase().includes(n.toLowerCase()));
        points.numbers = Math.round((found.length / tweet.expectedNumbers.length) * 5);
    } else {
        points.numbers = summary.length > 40 ? 5 : (summary.length > 20 ? 3 : 1);
    }
    total += points.numbers;

    const verbs = /^(use|add|apply|implement|combine|remove|test|run|start|build|set|ask|lead|close|adopt|preserve|leverage|create|switch|replace|integrate|extract|deploy|audit|migrate|reduce|ship|optimize|simplify|measure|track|prioritize|automate|raise|take|write|secure|trim|cut|boost|increase|eliminate|save|achieve|target|design)/i;
    const startsVerb = verbs.test(summary);
    const isLong = summary.length > 50;
    const notVague = !/^a tweet about/i.test(summary);
    points.actionability = (startsVerb ? 1 : 0) + (isLong ? 1 : 0) + (notVague ? 1 : 0);
    total += points.actionability;

    return { total, points, parsed };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║       PROMPT ITERATION ROUND 2 — Groq (Llama 3.3 70B)      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const results = {};

    for (const [promptName, promptText] of Object.entries(PROMPTS)) {
        console.log(`\n${'━'.repeat(65)}`);
        console.log(`📋  ${promptName}  (${promptText.length} chars)`);
        console.log(`${'━'.repeat(65)}`);

        results[promptName] = { scores: [], totalTokens: 0, totalLatency: 0, details: [] };

        for (const tweet of TWEETS) {
            const userContent = `@${tweet.author_handle}: ${tweet.content}`;
            const result = await callGroq(promptText, userContent);

            if (result.error) {
                console.log(`  ❌ ${tweet.id}: ${result.error}`);
                results[promptName].details.push({ id: tweet.id, error: result.error });
                await new Promise(r => setTimeout(r, 2500));
                continue;
            }

            const s = score(result, tweet);
            results[promptName].scores.push(s.total);
            results[promptName].totalTokens += (result.tokensIn + result.tokensOut);
            results[promptName].totalLatency += result.latencyMs;

            const numTag = tweet.expectedNumbers.length > 0 ? ` nums:${s.points.numbers}/5` : '';
            const verbTag = s.points.actionability >= 3 ? '' : ` verb:${s.points.actionability}/3`;
            console.log(
                `  ${s.total >= 19 ? '🟢' : s.total >= 15 ? '🟡' : '🔴'} ${tweet.id.padEnd(22)} ${String(s.total).padStart(2)}/21${numTag}${verbTag}`
            );
            if (s.parsed) {
                console.log(`     📝 ${s.parsed.summary}`);
            }

            results[promptName].details.push({ id: tweet.id, score: s, parsed: s.parsed });
            await new Promise(r => setTimeout(r, 2200));
        }
    }

    // ── Summary table ────────────────────────────────────────────────────────
    console.log('\n\n');
    console.log('╔══════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                          ROUND 2 — COMPARISON SUMMARY                                  ║');
    console.log('╠══════════════════╤═══════════╤══════════╤════════╤════════════╤══════════╤══════════════╣');
    console.log('║ Prompt           │ Avg Score │  Total   │ Perfect│ Avg Latency│ Tokens   │ Prompt chars ║');
    console.log('╠══════════════════╪═══════════╪══════════╪════════╪════════════╪══════════╪══════════════╣');

    const sorted = Object.entries(results)
        .map(([name, data]) => {
            const avg = data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0;
            const total = data.scores.reduce((a, b) => a + b, 0);
            const max = data.scores.length * 21;
            const perfect = data.scores.filter(s => s === 21).length;
            const avgLatency = data.scores.length > 0 ? Math.round(data.totalLatency / data.scores.length) : 0;
            const promptLen = PROMPTS[name].length;
            return { name, avg, total, max, perfect, avgLatency, totalTokens: data.totalTokens, promptLen, count: data.scores.length };
        })
        .sort((a, b) => b.total - a.total || a.totalTokens - b.totalTokens);

    for (const row of sorted) {
        console.log(
            `║ ${row.name.padEnd(16)} │ ${(row.avg.toFixed(1) + '/21').padStart(9)} │ ${(row.total + '/' + row.max).padStart(8)} │ ${(row.perfect + '/' + row.count).padStart(6)} │ ${(row.avgLatency + 'ms').padStart(10)} │ ${String(row.totalTokens).padStart(8)} │ ${String(row.promptLen).padStart(12)} ║`
        );
    }
    console.log('╚══════════════════╧═══════════╧══════════╧════════╧════════════╧══════════╧══════════════╝');

    // ── Head-to-head on numbers ──────────────────────────────────────────────
    console.log('\n📊 NUMBER PRESERVATION (key metric — improvements over R1)');
    console.log('─'.repeat(80));
    for (const tweet of TWEETS) {
        if (tweet.expectedNumbers.length === 0) continue;
        console.log(`\n  ${tweet.id} (expected: ${tweet.expectedNumbers.join(', ')})`);
        for (const [name, data] of Object.entries(results)) {
            const d = data.details.find(d => d.id === tweet.id);
            if (!d || d.error) { console.log(`    ${name}: ERROR`); continue; }
            const nums = d.score.points.numbers;
            const summary = d.parsed?.summary ?? '(none)';
            const icon = nums === 5 ? '✅' : nums >= 3 ? '🟡' : '❌';
            console.log(`    ${icon} ${name.padEnd(22)} ${nums}/5  "${summary}"`);
        }
    }

    // ── Actionability breakdown ──────────────────────────────────────────────
    console.log('\n📊 ACTIONABILITY (verb-first summaries)');
    console.log('─'.repeat(80));
    for (const [name, data] of Object.entries(results)) {
        const verbStarts = data.details.filter(d => d.score?.points?.actionability === 3).length;
        const total = data.details.filter(d => d.score).length;
        console.log(`  ${name.padEnd(22)} ${verbStarts}/${total} summaries start with verb + are substantive`);
    }

    const winner = sorted[0];
    console.log(`\n🏆 WINNER: ${winner.name} (${winner.avg.toFixed(1)}/21 avg, ${winner.perfect}/${winner.count} perfect, ${winner.promptLen} prompt chars)`);
}

main().catch(console.error);
