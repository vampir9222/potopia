import { catalog } from "@app/avatar-assets";
import { credits } from "@app/avatar-assets/credits";
import { CATEGORY_LABELS } from "@app/avatar/ui";
import { Card } from "@app/ui";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getCurrentMember } from "@/lib/session";

export const metadata: Metadata = { title: "Crédits" };

const linkClass = "text-accent hover:underline break-all";

/** Crédits des graphismes : chaque élément d'avatar importé, avec ses auteurs et licences. */
export default async function CreditsPage() {
  await getCurrentMember();
  const repo = catalog.source.repo;
  const licenses = [
    ...new Set(credits.flatMap((c) => c.entries.flatMap((e) => e.licenses))),
  ].sort();

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb />
      <Card title="Crédits des graphismes">
        <div className="text-muted flex flex-col gap-3 text-sm">
          <p>
            Les avatars sont composés à partir des sprites du projet{" "}
            <a href={repo} className={linkClass} target="_blank" rel="noreferrer">
              Universal LPC Spritesheet Character Generator
            </a>{" "}
            (Liberated Pixel Cup), importés au commit{" "}
            <a
              href={`${repo}/tree/${catalog.source.ref}`}
              className={linkClass}
              target="_blank"
              rel="noreferrer"
            >
              <code>{catalog.source.ref.slice(0, 7)}</code>
            </a>
            . Seules les images et leurs données sont reprises, pas le code du générateur.
          </p>
          <p>
            Merci à tous les artistes ci-dessous. Licences rencontrées : {licenses.join(", ")}.
            Chaque élément est utilisé selon l&apos;une des licences indiquées pour lui.
          </p>
        </div>
      </Card>

      <Card title={`${credits.length} éléments`}>
        <ul className="divide-border flex flex-col divide-y">
          {credits.map((credit) => (
            <li key={credit.itemId} className="flex flex-col gap-1.5 py-3 text-sm">
              <p className="text-text">
                <span className="font-semibold">{credit.name}</span>{" "}
                <span className="text-muted text-xs">
                  {CATEGORY_LABELS[credit.category]} · {credit.itemId}
                </span>
              </p>
              {credit.entries.map((entry) => (
                <div key={entry.file} className="text-muted flex flex-col gap-0.5 pl-3 text-xs">
                  <p>
                    <span className="text-text">
                      {entry.authors.join(", ") || "Auteur inconnu"}
                    </span>
                    {" · "}
                    {entry.licenses.join(", ")}
                    {entry.file && <span> · {entry.file}</span>}
                  </p>
                  {entry.notes && <p>{entry.notes}</p>}
                  {entry.urls.length > 0 && (
                    <p className="flex flex-wrap gap-x-3">
                      {entry.urls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          className={linkClass}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {url.replace(/^https?:\/\//, "")}
                        </a>
                      ))}
                    </p>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
