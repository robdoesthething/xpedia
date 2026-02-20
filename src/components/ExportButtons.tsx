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
        className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button
        onClick={handleDownload}
        className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
      >
        Export .md
      </button>
    </div>
  );
}
