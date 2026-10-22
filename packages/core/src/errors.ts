/** Pas de session valide : à traduire en 401 (ou redirection vers /login). */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Connexion requise.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Session valide mais droits insuffisants (ou plus membre du serveur) : à traduire en 403. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Accès refusé.") {
    super(message);
    this.name = "ForbiddenError";
  }
}
