// src/components/ThemeSynthesisPanel.tsx
'use client';

import type { Theme, ThemeDigest } from '@/types/database';

interface Props {
  themeId: string;
  theme: Theme;
  digests: ThemeDigest[];
  newTweetCount: number;
}

export default function ThemeSynthesisPanel({ themeId, theme, digests, newTweetCount }: Props) {
  void themeId; void theme; void digests; void newTweetCount;
  return (
    <div className="border border-seam p-5">
      <p className="font-mono text-xs text-shadow">Synthesis panel loading...</p>
    </div>
  );
}
