/**
 * « ゴゴゴゴ » (JoJo) autour de la grille : dernier essai pour trouver le mot. Les symboles surgissent
 * de chaque côté, puis ondulent en boucle, chacun à son rythme.
 */
const SPOTS = [
  { side: "left", top: "-4%", height: 88, delay: 0, rotate: -10 },
  { side: "left", top: "48%", height: 64, delay: 0.35, rotate: 6 },
  { side: "right", top: "8%", height: 72, delay: 0.2, rotate: 12 },
  { side: "right", top: "58%", height: 94, delay: 0.5, rotate: -5 },
] as const;

// Proportions de l'image (public/jojo/menacing.png).
const RATIO = 89 / 160;

export function Menacing() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className="trois-menacing absolute block bg-[url(/jojo/menacing.png)] bg-contain bg-no-repeat"
          style={{
            // à moitié sur le bord de la grille : ça déborde, c'est voulu
            [s.side]: -s.height * RATIO * 0.8,
            top: s.top,
            width: s.height * RATIO,
            height: s.height,
            rotate: `${s.rotate}deg`,
            animationDelay: `${s.delay}s, ${s.delay + 0.45}s`,
          }}
        />
      ))}
    </div>
  );
}
