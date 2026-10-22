/** Image refusée : clé inconnue, déjà utilisée, émise pour un autre membre, ou objet non conforme. */
export class InvalidImageError extends Error {
  readonly status = 400;
  constructor(message = "Image invalide : renvoie-la depuis le formulaire.") {
    super(message);
    this.name = "InvalidImageError";
  }
}
