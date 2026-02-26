export default function ExtensionStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl text-parchment">Install the Chrome extension</h2>
        <p className="mt-2 text-sm text-mist">It captures your bookmarks directly from X — no API key needed.</p>
      </div>
      <ol className="space-y-3 text-sm text-mist list-decimal list-inside">
        <li>Install the Xpedia Chrome extension from the Chrome Web Store</li>
        <li>Pin it to your toolbar</li>
        <li>Open <span className="text-parchment font-mono text-xs">x.com/i/bookmarks</span> and click the extension to start capturing</li>
      </ol>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onNext}
          className="flex-1 border border-seam text-mist font-mono text-xs tracking-widest uppercase px-4 py-3 hover:text-parchment hover:border-parchment/30 transition-colors"
        >
          Skip for now
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-gold text-void font-mono text-xs tracking-widest uppercase px-4 py-3 hover:bg-gold/90 transition-colors"
        >
          I&apos;ve installed it →
        </button>
      </div>
    </div>
  );
}
