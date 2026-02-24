#!/usr/bin/env node
/**
 * Multi-prompt A/B testing — tests extractContent, generateSummary,
 * generateConclusions, and generateInsights prompt variants.
 *
 * Usage:  node scripts/prompt-iterate-r3.mjs
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

// ── Test corpus: 8 diverse tweets forming a "Pricing Strategy Tactics" collection ──
const COLLECTION_NAME = 'Pricing Strategy Tactics';
const TWEETS = [
    { author_handle: 'paborenstein', content: 'We A/B tested 14 pricing pages over 6 months. The winner every time: 3 tiers with the middle one highlighted as "Most Popular." But the real insight — adding a decoy enterprise tier at 5x the price increased Pro plan conversions by 34%. Anchoring is absurdly powerful.' },
    { author_handle: 'patio11', content: 'Charge more. Seriously. Most SaaS founders underprice by 3-5x. If nobody ever complains about your pricing, you are leaving money on the table. Raise prices 20% tomorrow and measure churn for 30 days.' },
    { author_handle: 'lennysan', content: 'The best pricing pages I\'ve studied all do these 3 things:\n1. Social proof right next to the CTA ("Join 10,000+ teams")\n2. Annual plans shown first (saves you 20%)\n3. Feature comparison table that makes the mid-tier obvious winner\nTemplate: notion.so/pricing-template...' },
    { author_handle: 'julian', content: 'My pricing framework for any digital product:\n1. Cost of alternatives × 0.6 = floor\n2. Value created × 0.1 = ceiling\n3. Start at ceiling, offer discounts strategically\n4. Never compete on price against VC-funded competitors\nThis tripled our ARPU from $29 to $89/mo.' },
    { author_handle: 'robwalling', content: 'Just did our annual pricing audit. Key finding: our $49/mo plan was outselling $99/mo by 4:1 but the $99 users had 70% lower churn. We killed the $49 plan. Revenue up 23% in 60 days. Sometimes less choice = more revenue.' },
    { author_handle: 'dhh', content: 'Usage-based pricing is a trap for most SaaS. Customers hate unpredictable bills. We switched Basecamp to flat-rate in 2012 and never looked back. Simple pricing = lower support burden + higher trust.' },
    { author_handle: 'shl', content: 'Gumroad pricing lesson: when we removed the free plan entirely, paid conversions went UP 15%. Free tiers attract people who will never pay. They just consume support resources. Free trials > free plans, every time.' },
    { author_handle: 'agazdecki', content: 'Acquiring a SaaS? Check pricing power first. If they haven\'t raised prices in 2+ years, there\'s easy upside. Post-acquisition, I raise prices day 1. Average result: 12% revenue bump with <2% churn increase.' },
];

// ── Prompt variants ──────────────────────────────────────────────────────────

// === 1. EXTRACT CONTENT ===
const EXTRACT_PROMPTS = {
    v0_current: `You are a content extraction engine. Read the tweet and pull out ONLY the most specific, reusable content.

Rules:
- If it contains a ready-to-use prompt → copy it word for word
- If it has a named framework with steps → list the exact steps
- If it has specific numbers, benchmarks, or formulas → include them precisely
- If it contains a script, template, or checklist → quote it exactly
- If the tweet is purely motivational or vague with no concrete takeaway → output exactly: "No specific content."
- DO NOT add commentary, paraphrase, or introduce the content. Output ONLY the extracted material.
- Max 200 words.`,

    v1_structured: `Extract the concrete, reusable material from this tweet. Output ONLY the extracted content — no commentary.

EXTRACTION PRIORITY (in order):
1. NUMBERS: Copy all metrics verbatim (percentages, dollar amounts, timeframes, ratios)
2. FRAMEWORKS: List each step of any named process or framework
3. TEMPLATES: Quote any prompts, scripts, checklists, or formulas word-for-word
4. TECHNIQUES: Describe specific techniques with their measurable outcomes

FORMAT: Present extracted items as a flat list, one per line. Start each with the category tag:
[NUM] 34% conversion increase from decoy pricing
[STEP] 1. Cost of alternatives × 0.6 = floor
[TEMPLATE] "Break down [topic] like I'm 12..."
[TECHNIQUE] Anchor with enterprise tier at 5x to boost mid-tier

If the tweet is purely motivational with no concrete content → output exactly: "No specific content."
Max 200 words.`,
};

// === 2. SUMMARY ===
const SUMMARY_PROMPTS = {
    v0_current: `You extract and preserve the most valuable knowledge from curated tweet collections.

Write a reference summary for the "${COLLECTION_NAME}" collection. Rules:
- Read every tweet carefully. If a tweet contains a reusable prompt, script, template, formula, or step-by-step process — quote it VERBATIM inside a blockquote (>). Do not paraphrase things that are more valuable in their original words.
- Surface specific techniques, exact numbers, named frameworks, and concrete examples — not vague descriptions of them.
- NEVER attribute to @handles or write "as shared by" / "as suggested by". Write the content as a reference document, not a list of who said what.
- Note points of consensus and any notable contrarian takes.
- Do NOT write in vague generalities. A reader should be able to act on this immediately.
- Length: as long as needed to capture everything valuable — do not truncate to seem concise.`,

    v1_sections: `Write a reference document for the "${COLLECTION_NAME}" collection. This should read like a practical wiki page, not a summary of tweets.

STRUCTURE (use these exact markdown headers):
## Core Principles
The 2-3 fundamental rules that all sources agree on.

## Proven Tactics
Specific, numbered techniques with their measured results. Include exact numbers.

## Frameworks & Templates
Quote any step-by-step frameworks, formulas, or templates VERBATIM in blockquotes (>).

## Contrarian Takes
Ideas that go against the consensus — flag these explicitly.

## Key Numbers
A bullet list of every specific metric, benchmark, or data point mentioned.

RULES:
- NEVER use @handles or attribute ideas to people. This is a reference doc, not a who-said-what list.
- Quote frameworks and templates word-for-word in blockquotes. Do not paraphrase specific processes.
- Include ALL numbers: percentages, dollar amounts, timeframes, ratios.
- If multiple sources agree, say so ("consensus across sources" or "multiple practitioners confirmed").
- Write for someone who wants to ACT on this today.`,
};

// === 3. CONCLUSIONS ===
const CONCLUSIONS_PROMPTS = {
    v0_current: `You distill curated tweets into specific, immediately-actionable steps.

Given tweets in the "${COLLECTION_NAME}" collection, produce 3-7 conclusions. Rules:
- Each must be a specific action someone can take THIS WEEK — not vague advice.
- Write out the substance directly. If a tweet contains a prompt, script, template, or framework, include it in full — do NOT summarize it away or say "there's a framework for X".
- NEVER attribute to @handles or write "as shared by" / "as suggested by" / "according to". The reader needs the content itself, not the source.
- Include concrete specifics: exact prompts (quoted), named steps, numbers, tool names.
  GOOD: "Simplify any complex topic with this prompt: 'Break down [topic] like I'm 12, then gradually increase complexity' — run it in 3 escalating passes"
  BAD: "Use the prompt suggested by @handle to simplify topics"
  GOOD: "Audit your pricing page with: 'List every friction point on this page that would make a skeptic leave'"
  BAD: "Try AI tools for pricing as recommended by @handle"

Return ONLY a JSON array of strings: ["conclusion 1", "conclusion 2", ...]`,

    v1_actions: `Distill these tweets into 5-7 actions someone can take THIS WEEK to improve their pricing.

RULES:
- Each action starts with an imperative verb (Raise, Add, Remove, Set, Test, Switch, Audit, Kill).
- Every action includes at least one specific number, formula, or framework from the tweets.
- Include complete frameworks — never say "use the framework" without listing its steps.
- NEVER reference @handles, sources, or authors. Output the substance, not attribution.
- Order from highest-impact to lowest-impact.

FORMAT: Each action should follow this pattern:
"[Verb] [specific action] — [expected measurable result]. [Any supporting detail or framework steps]."

Example:
"Add a decoy enterprise tier at 5x your mid-tier price — expect ~34% conversion lift on the mid-tier. The decoy doesn't need to sell; it anchors perception."

Return ONLY a JSON array of strings: ["action 1", "action 2", ...]`,
};

// === 4. INSIGHTS (theme-level) ===
const INSIGHTS_PROMPTS = {
    v0_current: `You synthesise a theme-level knowledge brief from curated tweets across multiple collections.

Produce 5-10 actionable insights. Rules:
- Each insight must be something a reader can act on THIS WEEK.
- Write out the substance directly. If a tweet contains a prompt, script, template, or framework, include it in full — do NOT just say "there's a prompt for X".
- NEVER attribute to @handles or write "as shared by" / "as suggested by". Give the content itself, not the source.
- Include concrete specifics: exact prompts (quoted), tool names, numbers, named steps.
- Cross-reference ideas that appear in multiple tweets — consensus is more valuable.
- Flag any notable contrarian or surprising findings.

Return ONLY a JSON array of strings: ["insight 1", "insight 2", ...]`,

    v1_tiered: `Synthesise a knowledge brief from curated tweets. Produce 5-8 insights in THREE tiers:

TIER 1 — CONSENSUS (things multiple sources agree on):
These are the strongest signals. Start each with "✅ ".

TIER 2 — STANDOUT TACTICS (unique techniques with proven results):
Specific techniques from individual sources with measured outcomes. Start each with "⚡ ".

TIER 3 — CONTRARIAN (ideas that challenge conventional wisdom):
Flag these explicitly. Start each with "⚠️ ".

RULES:
- Every insight includes specific numbers, frameworks, or quoted techniques.
- NEVER reference @handles or sources. Output the substance only.
- Order by impact within each tier.
- Include frameworks in full — never say "there's a framework" without listing its steps.

Return ONLY a JSON array of strings: ["✅ insight...", "⚡ insight...", "⚠️ insight...", ...]`,
};

// ── API call ─────────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userContent, maxTokens = 800) {
    const start = performance.now();
    const res = await fetch(`${GROQ.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ.apiKey}` },
        body: JSON.stringify({
            model: GROQ.model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
            max_tokens: maxTokens,
            temperature: 0.2,
        }),
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) return { error: `HTTP ${res.status}`, latencyMs };
    const data = await res.json();
    return {
        latencyMs,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        rawContent: data.choices?.[0]?.message?.content ?? '',
    };
}

// ── Scoring helpers ──────────────────────────────────────────────────────────

// Known numbers from our corpus
const CORPUS_NUMBERS = ['34%', '5x', '3-5x', '20%', '10,000', '$29', '$89', '4:1', '70%', '23%', '60 days', '15%', '12%', '2%', '$49', '$99'];

function countNumberPreservation(text) {
    return CORPUS_NUMBERS.filter(n => text.toLowerCase().includes(n.toLowerCase())).length;
}

function hasAttribution(text) {
    return /@\w|as shared by|as suggested by|according to|as noted by|as mentioned by/.test(text);
}

function countFrameworkSteps(text) {
    // Count numbered steps (1. 2. 3.) or bullet steps
    return (text.match(/^\s*\d+\./gm) || []).length + (text.match(/^\s*[-•]/gm) || []).length;
}

function hasBlockquotes(text) {
    return /^>/m.test(text);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║       PROMPT ITERATION R3 — Multi-Prompt A/B Testing        ║');
    console.log('║       Groq (Llama 3.3 70B) · Collection: Pricing Strategy   ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const tweetBlock = TWEETS.map((t, i) => `${i + 1}. @${t.author_handle}: ${t.content}`).join('\n');

    // ── 1. EXTRACT CONTENT ─────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(70));
    console.log('1️⃣  EXTRACT CONTENT (single-tweet test on hardest tweet)');
    console.log('═'.repeat(70));

    const hardTweet = TWEETS[3]; // julian's pricing framework — has numbered steps + numbers
    const extractInput = `@${hardTweet.author_handle}: ${hardTweet.content}`;

    for (const [name, prompt] of Object.entries(EXTRACT_PROMPTS)) {
        console.log(`\n📋 ${name} (${prompt.length} chars)`);
        const result = await callGroq(prompt, extractInput, 300);
        if (result.error) { console.log(`  ❌ ${result.error}`); continue; }

        const text = result.rawContent;
        const nums = countNumberPreservation(text);
        const steps = countFrameworkSteps(text);
        const hasAttr = hasAttribution(text);

        console.log(`  📊 numbers: ${nums} | framework steps: ${steps} | no attribution: ${!hasAttr ? '✅' : '❌'}`);
        console.log(`  📝 ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`);
        console.log(`  ⏱️  ${result.latencyMs}ms | ${result.tokensIn + result.tokensOut} tokens`);
        await new Promise(r => setTimeout(r, 2500));
    }

    // ── 2. SUMMARY ─────────────────────────────────────────────────────────
    console.log('\n\n' + '═'.repeat(70));
    console.log('2️⃣  SUMMARY (full collection of 8 tweets)');
    console.log('═'.repeat(70));

    for (const [name, prompt] of Object.entries(SUMMARY_PROMPTS)) {
        console.log(`\n📋 ${name} (${prompt.length} chars)`);
        const result = await callGroq(prompt, tweetBlock, 1200);
        if (result.error) { console.log(`  ❌ ${result.error}`); continue; }

        const text = result.rawContent;
        const nums = countNumberPreservation(text);
        const steps = countFrameworkSteps(text);
        const hasAttr = hasAttribution(text);
        const hasBq = hasBlockquotes(text);
        const wordCount = text.split(/\s+/).length;

        console.log(`  📊 numbers: ${nums}/${CORPUS_NUMBERS.length} | steps: ${steps} | blockquotes: ${hasBq ? '✅' : '❌'} | no attribution: ${!hasAttr ? '✅' : '❌'} | words: ${wordCount}`);
        console.log(`  ⏱️  ${result.latencyMs}ms | ${result.tokensIn + result.tokensOut} tokens`);
        console.log('  ── Preview ──');
        console.log(`  ${text.slice(0, 400)}...`);
        await new Promise(r => setTimeout(r, 3000));
    }

    // ── 3. CONCLUSIONS ─────────────────────────────────────────────────────
    console.log('\n\n' + '═'.repeat(70));
    console.log('3️⃣  CONCLUSIONS (full collection of 8 tweets)');
    console.log('═'.repeat(70));

    for (const [name, prompt] of Object.entries(CONCLUSIONS_PROMPTS)) {
        console.log(`\n📋 ${name} (${prompt.length} chars)`);
        const result = await callGroq(prompt, tweetBlock, 800);
        if (result.error) { console.log(`  ❌ ${result.error}`); continue; }

        const cleaned = result.rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        let items = [];
        try { items = JSON.parse(cleaned); } catch { console.log(`  ❌ Invalid JSON`); continue; }

        if (!Array.isArray(items)) { console.log(`  ❌ Not an array`); continue; }

        const allText = items.join(' ');
        const nums = countNumberPreservation(allText);
        const hasAttr = hasAttribution(allText);
        const verbs = /^(raise|add|remove|set|test|switch|audit|kill|implement|use|apply|run|start|build|create|simplify|charge|offer|eliminate|consider|evaluate|adopt|boost|increase|cut|try|check|deploy)/i;
        const verbStarts = items.filter(i => verbs.test(i)).length;

        console.log(`  📊 items: ${items.length} | numbers: ${nums} | verb-first: ${verbStarts}/${items.length} | no attribution: ${!hasAttr ? '✅' : '❌'}`);
        console.log(`  ⏱️  ${result.latencyMs}ms | ${result.tokensIn + result.tokensOut} tokens`);
        items.forEach((item, i) => console.log(`  ${i + 1}. ${item.slice(0, 120)}${item.length > 120 ? '...' : ''}`));
        await new Promise(r => setTimeout(r, 3000));
    }

    // ── 4. INSIGHTS ────────────────────────────────────────────────────────
    console.log('\n\n' + '═'.repeat(70));
    console.log('4️⃣  INSIGHTS (theme-level synthesis)');
    console.log('═'.repeat(70));

    for (const [name, prompt] of Object.entries(INSIGHTS_PROMPTS)) {
        console.log(`\n📋 ${name} (${prompt.length} chars)`);
        const result = await callGroq(prompt, tweetBlock, 1000);
        if (result.error) { console.log(`  ❌ ${result.error}`); continue; }

        const cleaned = result.rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        let items = [];
        try { items = JSON.parse(cleaned); } catch { console.log(`  ❌ Invalid JSON`); continue; }

        if (!Array.isArray(items)) { console.log(`  ❌ Not an array`); continue; }

        const allText = items.join(' ');
        const nums = countNumberPreservation(allText);
        const hasAttr = hasAttribution(allText);
        const hasTiers = items.some(i => /^[✅⚡⚠️]/.test(i));

        console.log(`  📊 items: ${items.length} | numbers: ${nums} | tiered: ${hasTiers ? '✅' : '—'} | no attribution: ${!hasAttr ? '✅' : '❌'}`);
        console.log(`  ⏱️  ${result.latencyMs}ms | ${result.tokensIn + result.tokensOut} tokens`);
        items.forEach((item, i) => console.log(`  ${i + 1}. ${item.slice(0, 140)}${item.length > 140 ? '...' : ''}`));
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n\n🏁 Done! Review output above to pick winners.\n');
}

main().catch(console.error);
