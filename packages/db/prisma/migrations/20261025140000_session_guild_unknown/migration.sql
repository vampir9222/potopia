-- Sessions : depuis quand Discord ne répond plus pour la session (panne, rate-limit).
-- Ajout seul : colonne facultative, aucune donnée existante touchée.
ALTER TABLE "core"."sessions" ADD COLUMN "guild_unknown_since" TIMESTAMP(3);
