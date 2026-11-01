"use client";

import {
  Card,
  cx,
  setMaoMaoDisabled,
  setToBeContinuedDisabled,
  useMaoMaoDisabled,
  useToBeContinuedDisabled,
} from "@app/ui";

/** Interrupteur : allumé à droite, couleur d'accent ; éteint à gauche, gris. */
function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-accent" : "bg-border",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

/**
 * Paramètres du membre, gardés sur cet appareil : l'arrêt sur image « To Be Continued » quand on
 * perd une partie, et le regard de Mao Mao après 3 essais ratés de suite à TROIS.
 */
export function SettingsView() {
  const tbcDisabled = useToBeContinuedDisabled();
  const maoDisabled = useMaoMaoDisabled();
  return (
    <Card title="Paramètres">
      <ul className="flex flex-col">
        <li className="flex items-center justify-between gap-4 py-2">
          <div>
            <p className="text-text text-sm font-medium">« To Be Continued » quand on perd</p>
            <p className="text-muted text-xs">
              Arrêt sur image façon JoJo, avec Roundabout, après une partie perdue.
            </p>
          </div>
          <Switch
            label="« To Be Continued » quand on perd"
            on={!tbcDisabled}
            onChange={(on) => setToBeContinuedDisabled(!on)}
          />
        </li>
        <li className="flex items-center justify-between gap-4 py-2">
          <div>
            <p className="text-text text-sm font-medium">Mao Mao à TROIS</p>
            <p className="text-muted text-xs">
              Son regard de jugement (Les Carnets de l&apos;apothicaire) au 3e essai raté de suite,
              et son sourire narquois quand tu trouves enfin le mot.
            </p>
          </div>
          <Switch
            label="Mao Mao à TROIS"
            on={!maoDisabled}
            onChange={(on) => setMaoMaoDisabled(!on)}
          />
        </li>
      </ul>
      <p className="text-muted mt-3 text-xs">Ces réglages sont gardés sur cet appareil.</p>
    </Card>
  );
}
