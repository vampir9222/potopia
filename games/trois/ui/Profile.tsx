"use client";

import type { Me } from "./App";

export type Stats = {
  played: number;
  wordsFound: number;
  perfectDays: number;
  streak: number;
  maxStreak: number;
  dist: number[];
};

export function Profile({ me, stats }: { me: Me; stats: Stats }) {
  const max = Math.max(1, ...stats.dist);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-center gap-3">
        {me.image && <img src={me.image} alt="" width={40} height={40} className="rounded-full" />}
        <p className="text-2xl font-bold">{me.name}</p>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {(
          [
            [stats.played, "Jours joués"],
            [stats.perfectDays, "3 sur 3"],
            [stats.streak, "Série"],
            [stats.maxStreak, "Record"],
          ] as const
        ).map(([v, l]) => (
          <div key={l} className="rounded-xl bg-zinc-900 p-2">
            <p className="text-2xl font-bold">{v}</p>
            <p className="text-[11px] leading-tight text-zinc-400">{l}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 font-bold">Mots trouvés en… ({stats.wordsFound} au total)</h2>
        <div className="flex flex-col gap-1">
          {stats.dist.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-zinc-400">{i + 1}</span>
              <div
                className="bg-good rounded px-2 py-0.5 text-right font-semibold text-zinc-900"
                style={{ width: `${Math.max(8, (n / max) * 100)}%` }}
              >
                {n}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-zinc-400">
        Ta progression suit ton compte Discord : tu retrouves ta partie sur tous tes appareils.
      </p>
    </div>
  );
}
