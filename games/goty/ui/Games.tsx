"use client";
import { Modal } from "@app/ui";
import { Download, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CatalogGame } from "../src/catalog";
import type { ImportMapping } from "../src/import-preview";
import { IMPORT_FIELDS } from "../src/import-preview";
import type { previewGameImport } from "../src/imports";
import type { MemberSnapshot } from "../src/snapshot";
import { api } from "./api";
import { Cover, Trailer, type Game } from "./common";
import { ConfirmAction } from "./ConfirmAction";
import type { Mutation } from "./useSnapshot";

type Preview = Awaited<ReturnType<typeof previewGameImport>>;
type Props = { view: MemberSnapshot; userId: string; busy: boolean; mutate: Mutation };
function GameEditor({
  game,
  busy,
  onSave,
}: {
  game?: Game;
  busy: boolean;
  onSave: (body: object) => Promise<boolean>;
}) {
  const [catalog, setCatalog] = useState<CatalogGame[]>([]);
  const [selected, setSelected] = useState<CatalogGame | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState(game?.title ?? "");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState(game?.title ?? "");
  const [platform, setPlatform] = useState(game?.platform ?? "");
  const ticket = useRef(0);
  useEffect(
    () => () => {
      ticket.current++;
    },
    [],
  );
  async function search() {
    const current = ++ticket.current;
    setSearching(true);
    setMessage("");
    try {
      const result = await api<{ available: boolean; games: CatalogGame[] }>(
        `catalog?q=${encodeURIComponent(query)}`,
      );
      if (ticket.current !== current) return;
      setCatalog(result.games);
      if (!result.available)
        setMessage("Le catalogue n’est pas configuré. Tu peux saisir le jeu manuellement.");
      else if (!result.games.length)
        setMessage("Aucun résultat. La saisie manuelle reste disponible.");
    } catch (error) {
      if (ticket.current === current)
        setMessage(error instanceof Error ? error.message : "Catalogue indisponible.");
    } finally {
      if (ticket.current === current) setSearching(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSave({
      title,
      platform,
      period: String(form.get("period") ?? ""),
      completed: form.has("completed"),
      platinum: form.has("platinum"),
      igdbId: selected?.igdbId ?? game?.igdbId ?? null,
      cover: selected?.cover ?? game?.cover ?? null,
      trailerYoutubeId: selected?.trailerYoutubeId ?? game?.trailerYoutubeId ?? null,
    });
  }
  return (
    <div className="goty">
      <div className="goty-search">
        <input
          aria-label="Rechercher dans IGDB"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Un titre dans le catalogue…"
        />
        <button
          className="goty-button secondary"
          disabled={query.trim().length < 2 || searching}
          onClick={() => void search()}
        >
          <Search size={16} />
          {searching ? "Recherche…" : "Rechercher"}
        </button>
      </div>
      <p className="goty-muted">
        Catalogue et jaquettes :{" "}
        <a href="https://www.igdb.com/" target="_blank" rel="noopener noreferrer">
          IGDB
        </a>
        .
      </p>
      {message && (
        <p role="status" className="goty-muted">
          {message}
        </p>
      )}
      {catalog.length > 0 && (
        <div className="goty-catalog">
          {catalog.map((entry) => (
            <button
              key={entry.igdbId}
              className={selected?.igdbId === entry.igdbId ? "selected" : ""}
              onClick={() => {
                setSelected(entry);
                setTitle(entry.title);
                setPlatform(entry.platforms[0] ?? "");
              }}
            >
              <Cover game={entry} />
              <span>
                {entry.title}
                <small>{entry.platforms.join(" · ")}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => void submit(e)} className="goty-form">
        <fieldset disabled={busy}>
          <label>
            Titre du jeu
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
          </label>
          <div className="goty-two">
            <label>
              Support / plateforme
              <input
                maxLength={100}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              />
            </label>
            <label>
              Période de jeu
              <input
                name="period"
                maxLength={100}
                defaultValue={game?.period ?? ""}
                placeholder="Printemps, juillet…"
              />
            </label>
          </div>
          <div className="goty-row">
            <label className="goty-check">
              <input type="checkbox" name="completed" defaultChecked={game?.completed} />
              Terminé
            </label>
            <label className="goty-check">
              <input type="checkbox" name="platinum" defaultChecked={game?.platinum} />
              Platine
            </label>
          </div>
          <button className="goty-button" type="submit">
            {busy ? "Enregistrement…" : "Enregistrer le jeu"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}

function Importer({
  editionId,
  busy,
  onSave,
}: {
  editionId: string;
  busy: boolean;
  onSave: (games: Preview["games"]) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function read(next: File, columns?: ImportMapping) {
    const sequence = ++request.current;
    setReading(true);
    setError("");
    setPreview(null);
    try {
      if (next.size > 5 * 1024 * 1024) throw new Error("Le fichier dépasse 5 Mo.");
      const format = next.name.toLowerCase().endsWith(".xlsx")
        ? "xlsx"
        : next.name.toLowerCase().endsWith(".csv")
          ? "csv"
          : null;
      if (!format) throw new Error("Choisis un fichier CSV ou XLSX.");
      const response = await fetch(
        `/api/goty/editions/${editionId}/import-preview?format=${format}${columns ? `&mapping=${encodeURIComponent(JSON.stringify(columns))}` : ""}`,
        { method: "POST", credentials: "same-origin", cache: "no-store", body: next },
      );
      const result = await response.json();
      if (sequence !== request.current) return;
      if (!response.ok) throw new Error(result.error?.message ?? "Lecture impossible.");
      setPreview(result as Preview);
      setMapping(result.mapping);
    } catch (caught) {
      if (sequence === request.current)
        setError(caught instanceof Error ? caught.message : "Lecture impossible.");
    } finally {
      if (sequence === request.current) setReading(false);
    }
  }
  return (
    <div className="goty goty-form">
      <p className="goty-muted">
        Importe ta liste de jeux, puis compose ton palmarès. CSV UTF-8 ou première feuille XLSX, 5
        Mo et 1 000 jeux maximum. Les doublons seront conservés.
      </p>
      <label>
        1. Choisir le fichier
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next) {
              setFile(next);
              void read(next);
            }
          }}
        />
      </label>
      {reading && <p role="status">Lecture du fichier…</p>}
      {error && (
        <p role="alert" className="goty-error">
          {error}
        </p>
      )}
      {preview && (
        <>
          <h3>2. Associer les colonnes</h3>
          <div className="goty-two">
            {IMPORT_FIELDS.map((field) => (
              <label key={field.key}>
                {field.label}
                {field.key === "title" && " *"}
                <select
                  value={mapping[field.key] ?? -1}
                  onChange={(e) => {
                    setMapping({ ...mapping, [field.key]: Number(e.target.value) });
                    setPreview({ ...preview, valid: false });
                  }}
                >
                  <option value={-1}>Ignorer</option>
                  {preview.headers.map((header, index) => (
                    <option key={index} value={index}>
                      {header || `Colonne ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            className="goty-button secondary"
            disabled={!file || reading || busy}
            onClick={() => {
              if (file) void read(file, mapping);
            }}
          >
            Actualiser l’aperçu
          </button>
          <h3>3. Vérifier l’aperçu · {preview.games.length} jeux</h3>
          <div className="goty-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Support</th>
                  <th>Terminé</th>
                </tr>
              </thead>
              <tbody>
                {preview.games.slice(0, 20).map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.title}</td>
                    <td>{entry.platform || "—"}</td>
                    <td>{entry.completed ? "Oui" : "Non"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.games.length > 20 && (
            <p className="goty-muted">Les 20 premières lignes sont affichées.</p>
          )}
          {preview.errors.length > 0 && (
            <ul className="goty-error">
              {preview.errors.slice(0, 30).map((entry, index) => (
                <li key={index}>
                  Ligne {entry.row} · {entry.field} : {entry.message}
                </li>
              ))}
            </ul>
          )}
          <button
            className="goty-button"
            disabled={!preview.valid || reading || busy}
            onClick={() => void onSave(preview.games)}
          >
            <Download size={16} />
            Confirmer l’import de {preview.games.length} jeux
          </button>
        </>
      )}
    </div>
  );
}

export function Games({ view, userId, busy, mutate }: Props) {
  const [owner, setOwner] = useState(userId);
  const [editor, setEditor] = useState<Game | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const canEdit =
    view.permissions.participate && ["categories", "preparation"].includes(view.edition.phase);
  const filtered = view.games.filter((game) => !owner || game.userId === owner);
  return (
    <>
      <div className="goty-section-heading">
        <div>
          <h2>Les jeux de l’année</h2>
          <p className="goty-muted">Nos aventures, bien avant les révélations.</p>
        </div>
        {canEdit && (
          <div className="goty-row">
            <button className="goty-button secondary" onClick={() => setImporting(true)}>
              <Upload size={16} />
              Importer
            </button>
            <button className="goty-button" onClick={() => setEditor("new")}>
              <Plus size={16} />
              Ajouter un jeu
            </button>
          </div>
        )}
      </div>
      <label className="goty-filter">
        Liste du participant
        <select value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Tout le groupe</option>
          {view.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.id === userId ? "Ma liste" : member.name}
            </option>
          ))}
        </select>
      </label>
      {!canEdit && (
        <p className="goty-muted">
          {view.edition.phase === "live"
            ? "La soirée a commencé : les listes sont figées."
            : view.edition.phase === "closed"
              ? "Cette édition est archivée en lecture seule."
              : "Tu consultes les listes de cette édition."}
        </p>
      )}
      {filtered.length === 0 ? (
        <div className="goty-empty">
          Pas encore de jeux dans cette liste.
          {canEdit && " Ajoute un premier titre ou importe ton fichier."}
        </div>
      ) : (
        <div className="goty-game-grid">
          {filtered.map((game) => (
            <article key={game.id} className="goty-game">
              <Cover game={game} />
              <div>
                <small className="goty-muted">
                  {view.members.find((m) => m.id === game.userId)?.name}
                </small>
                <h3>{game.title}</h3>
                <p className="goty-muted">
                  {game.platform || "Support non renseigné"}
                  {game.period && ` · ${game.period}`}
                </p>
                <div className="goty-row">
                  <span className="goty-pill">{game.completed ? "Terminé" : "Dans ma liste"}</span>
                  {game.platinum && <span className="goty-pill">Platine</span>}
                </div>
                <Trailer game={game} />
                {canEdit && game.userId === userId && (
                  <div className="goty-row">
                    <button
                      className="goty-text-button"
                      disabled={busy}
                      onClick={() => setEditor(game)}
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>
                    <ConfirmAction
                      title="Retirer un jeu"
                      message={`Supprimer « ${game.title} » de ta liste ? Ses choix et les pronostics associés seront retirés.`}
                      className="goty-text-button danger"
                      disabled={busy}
                      onConfirm={() => mutate(`games/${game.id}`, "DELETE")}
                    >
                      <Trash2 size={14} />
                      Retirer
                    </ConfirmAction>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={editor !== null}
        onClose={() => {
          if (!busy) setEditor(null);
        }}
        title={editor === "new" ? "Ajouter un jeu" : "Modifier un jeu"}
      >
        {editor && (
          <GameEditor
            key={editor === "new" ? "new" : editor.id}
            game={editor === "new" ? undefined : editor}
            busy={busy}
            onSave={async (body) => {
              const saved = await mutate(
                editor === "new" ? "games" : `games/${editor.id}`,
                editor === "new" ? "POST" : "PATCH",
                editor === "new" ? { games: [body] } : body,
              );
              if (saved) setEditor(null);
              return saved;
            }}
          />
        )}
      </Modal>
      <Modal
        open={importing}
        onClose={() => {
          if (!busy) setImporting(false);
        }}
        title="Importer mes jeux"
      >
        {importing && (
          <Importer
            editionId={view.edition.id}
            busy={busy || !canEdit}
            onSave={async (games) => {
              const saved = await mutate("games", "POST", { games });
              if (saved) setImporting(false);
              return saved;
            }}
          />
        )}
      </Modal>
    </>
  );
}
