import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1
        className="font-display text-3xl md:text-5xl text-torch mb-4"
        style={{
          textShadow:
            "0 0 20px rgba(255,157,0,0.6), 0 0 40px rgba(255,157,0,0.3), 4px 4px 0 rgba(0,0,0,0.8)",
        }}
      >
        DungeonMaster AI
      </h1>
      <p className="font-display text-[10px] tracking-wider text-gold mb-8 uppercase">
        Type your destiny. Roll the dice.
      </p>
      <p className="text-text-dim text-lg max-w-xl mb-10 leading-relaxed">
        Aventura RPG text-based, condusă de doi agenți Claude. Tu arunci zarurile.
        Tu hotărăști drumul.
      </p>
      <div className="flex flex-col md:flex-row gap-4">
        <Link
          href="/character"
          className="inline-flex items-center justify-center h-12 px-8 border-4 border-torch bg-torch text-bg font-display uppercase tracking-wider text-xs shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          Start Adventure
        </Link>
        <Link
          href="/game"
          className="inline-flex items-center justify-center h-12 px-8 border-4 border-text-dim bg-bg text-text-dim font-display uppercase tracking-wider text-xs shadow-[4px_4px_0_rgba(0,0,0,0.8)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_rgba(0,0,0,0.8)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          Continuă
        </Link>
      </div>
    </main>
  );
}
