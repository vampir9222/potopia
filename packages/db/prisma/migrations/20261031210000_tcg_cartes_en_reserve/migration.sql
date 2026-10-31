-- Toutes les cartes passent dans la réserve (hors set, sans numéro), à la demande de l'admin : les
-- cartes seront ensuite rangées une à une dans le set voulu. Les sets restent, vides.
-- Modifie des données existantes : `set_id` et `number` deviennent NULL (la contrainte
-- `cards_set_number_check` exige les deux à NULL ensemble).
UPDATE "tcg"."cards" SET "set_id" = NULL, "number" = NULL, "updated_at" = NOW() WHERE "set_id" IS NOT NULL;
