/**
 * Bouton « M'envoyer une notification de test » de la cloche : partout en local (dev), en
 * production pour les admins seulement.
 */
export const canSendTestNotification = (role: string): boolean =>
  process.env.NODE_ENV !== "production" || role === "admin";
