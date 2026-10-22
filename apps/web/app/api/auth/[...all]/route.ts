import { getAuth } from "@app/core";

// Routes de Better Auth (connexion Discord, callback, session). Pas de requireMember ici :
// c'est l'auth elle-même. getAuth() est appelé à la requête pour ne pas lire l'env au build.

export function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
