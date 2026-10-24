/** Coup refusé : message affiché tel quel au joueur, `status` pour la réponse HTTP. */
export class AgentsError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "AgentsError";
  }
}
