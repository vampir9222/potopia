# @app/avatar-assets

Sprites des avatars, importés du projet
[Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)
(Liberated Pixel Cup) par `pnpm assets:import`. Ne pas modifier à la main : relancer l'import.

- `sprites/` : PNG de base (frames de 64 px, une ligne par direction : haut, gauche, bas, droite),
  rangés comme dans `spritesheets/` du repo LPC.
- `data/catalog.json` : éléments retenus (catégorie, morphologies, calques et zPos, frames par
  animation, emplacements de couleur), lu par l'éditeur et le compositeur.
- `data/palettes.json` : palettes de recoloration par matériau.
- `data/credits.json` : auteurs, licences et liens de chaque élément (page `/credits`).

## Licences

Ces images ne sont pas sous la licence du code de la plateforme : chacune garde la sienne (CC0,
CC-BY, CC-BY-SA, OGA-BY, GPL…), indiquée élément par élément dans `data/credits.json` et sur la
page `/credits`, avec ses auteurs. Seules les données du générateur sont reprises, pas son code.
