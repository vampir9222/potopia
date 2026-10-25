// Plafond du solde d'un membre, loin de la limite d'une colonne integer (2^31 - 1) : plusieurs
// crédits au plafond par opération ne doivent jamais faire déborder la colonne.
export const MAX_BALANCE = 1_000_000_000;

export class InsufficientFundsError extends Error {
  constructor(
    readonly balance: number,
    readonly requested: number,
  ) {
    super(`Solde insuffisant : ${balance} disponible(s), ${requested} demandé(s).`);
    this.name = "InsufficientFundsError";
  }
}

/** Crédit refusé : le solde dépasserait MAX_BALANCE. */
export class BalanceLimitError extends Error {
  constructor(
    readonly balance: number,
    readonly requested: number,
  ) {
    super(
      `Plafond de solde atteint : ${balance} disponible(s), ${requested} demandé(s), ${MAX_BALANCE} au maximum.`,
    );
    this.name = "BalanceLimitError";
  }
}

/** Clé d'idempotence déjà utilisée pour une opération différente (autre membre ou montant). */
export class IdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`La clé d'idempotence « ${idempotencyKey} » a déjà servi pour une autre opération.`);
    this.name = "IdempotencyConflictError";
  }
}
