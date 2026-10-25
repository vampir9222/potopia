/** Image refusée : clé inconnue, déjà utilisée, émise pour un autre membre, ou objet non conforme. */
export class InvalidImageError extends Error {
  readonly status = 400;
  constructor(message = "Image invalide : renvoie-la depuis le formulaire.") {
    super(message);
    this.name = "InvalidImageError";
  }
}

/** Trop de demandes d'envoi d'image sur une heure : à traduire en 429. */
export class UploadRateLimitError extends Error {
  readonly status = 429;
  constructor(message = "Trop d'images envoyées en une heure : réessaie un peu plus tard.") {
    super(message);
    this.name = "UploadRateLimitError";
  }
}
