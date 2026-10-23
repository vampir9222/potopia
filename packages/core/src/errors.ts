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

/** Config d'avatar refusée (élément inconnu, incompatible, non débloqué…) : à traduire en 400. */
export class AvatarConfigError extends Error {
  readonly status = 400;
  constructor(readonly issues: string[]) {
    super(issues[0] ?? "Avatar invalide.");
    this.name = "AvatarConfigError";
  }
}
