export class InsufficientFundsError extends Error {
  constructor(
    readonly balance: number,
    readonly requested: number,
  ) {
    super(`Solde insuffisant : ${balance} disponible(s), ${requested} demandé(s).`);
    this.name = "InsufficientFundsError";
  }
}

/** Clé d'idempotence déjà utilisée pour une opération différente (autre membre ou montant). */
export class IdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`La clé d'idempotence « ${idempotencyKey} » a déjà servi pour une autre opération.`);
    this.name = "IdempotencyConflictError";
  }
}
