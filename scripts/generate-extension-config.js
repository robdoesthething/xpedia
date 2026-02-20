#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Generates src/chrome-extension/lib/config.ts from environment variables.
 * Reads from .env.local if present. Run automatically before build:extension.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   NEXT_PUBLIC_APP_URL  (optional, defaults to http://localhost:3000)
 */

const fs = require('fs');
const path = require('path');

// Load .env.local if present
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiBase = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[generate-extension-config] Missing required env vars: ' +
    'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
  process.exit(1);
}

const output = `/**
 * GENERATED FILE — do not edit manually.
 * Run \`npm run build:extension\` to regenerate from .env.local.
 */

export const SUPABASE_URL = '${supabaseUrl}';
export const SUPABASE_ANON_KEY = '${supabaseAnonKey}';
export const API_BASE = '${apiBase}';
`;

const outPath = path.resolve(__dirname, '..', 'src', 'chrome-extension', 'lib', 'config.ts');
fs.writeFileSync(outPath, output, 'utf8');
console.log('[generate-extension-config] Wrote', outPath);
