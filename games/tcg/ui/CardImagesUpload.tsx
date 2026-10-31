"use client";

import { Button, Input, Label } from "@app/ui";
import { useState } from "react";

type Row = { file: string; status: string; ok: boolean | null };

type Props = {
  /** Cartes du set, pour retrouver une carte par son numéro. */
  cards: { id: string; number: number; name: string }[];
  /** URL d'envoi présignée (server action de l'app). */
  request: (
    contentType: string,
    size: number,
  ) => Promise<{ key: string; url: string } | { error: string }>;
  /** Pose l'image envoyée sur la carte (server action de l'app). */
  confirm: (cardId: string, key: string) => Promise<{ error: string } | null>;
};

/** Numéro de carte lu dans un nom de fichier : « 12.jpg », « 012.png », « 12 - Kazoo.webp ». */
function numberOf(fileName: string): number | null {
  const match = /^0*(\d+)/.exec(fileName);
  return match ? Number(match[1]) : null;
}

/**
 * Envoi d'illustrations en masse : chaque fichier va sur la carte dont il porte le numéro, un par
 * un (URL présignée, envoi direct au stockage, puis confirmation). Les fichiers sans carte
 * correspondante sont signalés et ignorés.
 */
export function CardImagesUpload({ cards, request, confirm }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const byNumber = new Map(cards.map((c) => [c.number, c]));

  function update(i: number, row: Row) {
    setRows((r) => r.map((old, j) => (j === i ? row : old)));
  }

  async function send() {
    setBusy(true);
    setRows(files.map((f) => ({ file: f.name, status: "En attente", ok: null })));
    for (const [i, file] of files.entries()) {
      const number = numberOf(file.name);
      const card = number === null ? undefined : byNumber.get(number);
      if (!card) {
        update(i, { file: file.name, status: "Aucune carte avec ce numéro", ok: false });
        continue;
      }
      const label = `n°${card.number} · ${card.name}`;
      update(i, { file: file.name, status: `Envoi vers ${label}…`, ok: null });
      const target = await request(file.type, file.size);
      if ("error" in target) {
        update(i, { file: file.name, status: target.error, ok: false });
        continue;
      }
      const put = await fetch(target.url, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      }).catch(() => null);
      const failed = put?.ok ? await confirm(card.id, target.key) : { error: "L'envoi a échoué." };
      update(
        i,
        failed
          ? { file: file.name, status: failed.error, ok: false }
          : { file: file.name, status: label, ok: true },
      );
    }
    setBusy(false);
  }

  const done = rows.filter((r) => r.ok).length;
  return (
    <div className="flex flex-col gap-4">
      <Label hint="Nomme chaque fichier par le numéro de sa carte : 12.jpg, 045.png… JPEG, PNG ou WebP, 5 Mo maximum.">
        Illustrations
        <Input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="py-1.5"
          onChange={(e) => setFiles([...(e.target.files ?? [])])}
          disabled={busy}
        />
      </Label>
      <div className="flex items-center gap-3">
        <Button onClick={() => void send()} disabled={busy || files.length === 0}>
          {busy ? "Envoi…" : `Envoyer ${files.length} image${files.length > 1 ? "s" : ""}`}
        </Button>
        {rows.length > 0 && !busy && (
          <p role="status" className="text-muted text-sm">
            {done} illustration{done > 1 ? "s" : ""} posée{done > 1 ? "s" : ""} sur {rows.length}.
          </p>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((r) => (
            <li key={r.file} className={r.ok === false ? "text-danger" : "text-muted"}>
              {r.ok ? "✓" : r.ok === false ? "✗" : "…"} {r.file} : {r.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
