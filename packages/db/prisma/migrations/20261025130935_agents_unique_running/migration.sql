-- Une seule partie en cours par paire de joueurs, quel que soit celui qui a invité l'autre.
-- Index partiel sur une expression : impossible à décrire dans le schéma Prisma, donc écrit à la
-- main (le code attrape l'erreur d'unicité P2002 et renvoie la partie déjà en cours).
-- Cette migration échouerait si deux parties en cours existaient déjà pour une même paire :
-- en finir une (abandon) avant de l'appliquer.
CREATE UNIQUE INDEX "games_running_pair_key"
  ON "agents"."games" (LEAST("user_a", "user_b"), GREATEST("user_a", "user_b"))
  WHERE "status" = 'PLAYING';
