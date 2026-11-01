import { GotyError } from "@app/goty";
import { forbidden, notFound } from "next/navigation";

export function gotyPageError(error: unknown): never {
  if (error instanceof GotyError && error.status === 403) forbidden();
  if (error instanceof GotyError && error.status === 404) notFound();
  throw error;
}
