/** Lit une variable d'environnement obligatoire. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} n'est pas définie.`);
  return value;
}
