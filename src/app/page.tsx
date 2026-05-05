import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 px-6 text-center">
        <p className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-amber-300">
          DungeonMaster AI
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-tight md:text-6xl">
          Aventura RPG text-based cu 2 agenti AI
        </h1>
        <p className="max-w-2xl text-zinc-300">
          Porneste personajul, vorbeste cu NPC-uri, treci skill checks si lasa Dungeon Master
          Agent sa orchestreze consecintele in timp real.
        </p>
        <div className="flex gap-3">
          <Link
            href="/character"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground"
          >
            Creeaza personaj
          </Link>
          <Link
            href="/game"
            className="inline-flex h-11 items-center justify-center rounded-md bg-muted px-8 text-sm font-medium text-foreground"
          >
            Intra in joc
          </Link>
        </div>
      </section>
    </main>
  );
}
