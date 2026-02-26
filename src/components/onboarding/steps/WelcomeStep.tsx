export default function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <div>
        <h1 className="font-serif text-3xl text-parchment">Turn bookmarks into knowledge</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          Xpedia organizes your X bookmarks into a structured corpus — sorted by topic,
          synthesized by AI, ready to export as context for any LLM.
        </p>
      </div>
      <button
        onClick={onNext}
        className="w-full bg-gold text-void font-mono text-sm tracking-widest uppercase px-4 py-3 hover:bg-gold/90 transition-colors"
      >
        Get started →
      </button>
    </div>
  );
}
