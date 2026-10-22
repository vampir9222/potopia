/** Essai refusé : message affiché tel quel au joueur, `status` pour la réponse HTTP. */
export class TroisError extends Error {
  constructor(
    readonly status: 400 | 409 | 422,
    message: string,
  ) {
    super(message);
    this.name = "TroisError";
  }
}
