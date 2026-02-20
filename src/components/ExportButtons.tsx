'use client';

import { useState } from 'react';

export default function ExportButtons({ markdown, filename }: { markdown: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCopy}
        className="font-mono text-xs tracking-widest text-mist uppercase hover:text-parchment transition-colors px-3 py-1.5"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button
        onClick={handleDownload}
        className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors"
      >
        Export .md
      </button>
    </div>
  );
}
