# Changelog

Toutes les modifications notables de ce projet sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### Ajouté
- Plugin `tauri-plugin-single-instance` (premier plugin enregistré) :
  relancer l'exe ou laisser l'autostart se déclencher alors que l'app tourne
  ne crée plus une seconde icône tray, une seconde fenêtre et deux commandes
  `shutdown` concurrentes — la seconde instance réaffiche la fenêtre de la
  première puis se ferme. (Reprise ciblée du PR #4 fermé sans fusion.)
- Métadonnées d'éditeur « Libreflow » : `bundle.publisher` dans
  `tauri.conf.json` (remonte dans l'installeur NSIS et les propriétés
  Windows) et `authors` dans `Cargo.toml`.
- Job CI `release` : au push d'un tag `v*`, build de l'installeur NSIS
  (`npm run tauri build`), upload en artifact et création automatique d'une
  GitHub Release avec notes générées — après validation des jobs
  frontend/backend/audit.

### Modifié
- `withGlobalTauri` passé à `false` dans `tauri.conf.json` : le frontend
  n'utilise que des imports ES modules de `@tauri-apps/api`, l'API globale
  `window.__TAURI__` n'est plus exposée inutilement.
- Mise à jour des dépendances (plages semver compatibles uniquement) :
  npm — `@tauri-apps/api`/`cli` 2.12.1 → 2.12.4,
  `plugin-notification` 2.5.1 → 2.8.0 (aligné avec le crate Rust),
  `vite` 8.3.3 → 8.3.5 ; Rust — `tauri` 2.12.1 → 2.12.5,
  `tauri-build` 2.7.1 → 2.7.4, `tauri-plugin-notification` 2.5.1 → 2.8.0,
  `serde_json` 1.0.151 → 1.0.154, plus les transitives via `cargo update`.
  Les majors `vitest` 5 et `jsdom` 30 sont volontairement écartées.

### Retiré
- `src/assets/*.svg` (`tauri.svg`, `typescript.svg`, `vite.svg`) : assets
  de boilerplate jamais référencés par le HTML, le CSS ou le TS.

### Sécurité
- Retrait du plugin `opener` (crate Rust, package npm et permission
  `opener:default`) : il n'était jamais utilisé par le frontend —
  réduction de la surface d'attaque (moindre privilège).
- Dépendances npm : `undici` 7.30.0 → 7.30.1 (GHSA-4w7w-5xrc-9h26,
  GHSA-2m5v-pch6-74hx, GHSA-qrxm-fqhp-jwvm, GHSA-9fm3-97px-rjf6,
  GHSA-55wc-3pg8-jfw6, GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472,
  GHSA-xjj6-f33q-929c) et `vitest` 4.1.11 → 4.1.12 /
  `@vitest/mocker` (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp) —
  `npm audit --audit-level=moderate` repasse à 0 vulnérabilité.

### Modifié
- La commande `shutdown` est désormais invoquée via son chemin absolu
  (`%SystemRoot%\System32\shutdown.exe`) plutôt que résolue via le PATH :
  un PATH détourné ne peut plus substituer un autre binaire à l'outil système.
- Les messages stderr bruts de l'outil `shutdown` (en anglais système) sont
  désormais encadrés d'un libellé français (« La commande shutdown a
  échoué : … ») pour rester cohérents avec l'interface.
- Métadonnées `Cargo.toml` : description et auteur réels remplacent le
  boilerplate (« A Tauri App » / « you »).

### Corrigé
- Une action immédiate ("Maintenant") déclenchée depuis le menu du system
  tray qui échouait ne montrait ni la fenêtre principale ni de notification
  système — l'échec était totalement silencieux si la fenêtre était masquée.
  Corrigé des deux côtés (Rust affiche désormais la fenêtre sur échec, et le
  frontend envoie toujours une notification OS en cas d'erreur tray).
- `@tauri-apps/plugin-notification` et `@tauri-apps/plugin-opener` étaient
  déclarées en `devDependencies` alors que ce sont des dépendances runtime
  (importées et exécutées dans l'app buildée) — déplacées vers `dependencies`.

### Ajouté (précédemment)
- Tests unitaires Rust (`cargo test`) sur la validation des délais/actions et
  la construction des messages d'erreur — 13 tests, aucun n'invoque jamais la
  vraie commande `shutdown` système.
- Tests unitaires TypeScript (Vitest + jsdom) sur `formatDuration`,
  `resolveAbsoluteTarget` et `actionWording` — 13 tests.
- CI GitHub Actions (`.github/workflows/ci.yml`) : `cargo fmt --check`,
  `cargo clippy -D warnings`, `cargo test`, `tsc --noEmit`, `vitest`,
  `npm run build`, `npm audit`, `cargo audit`, sur push/PR vers `master`.
- `src-tauri/.cargo/audit.toml` : advisories RUSTSEC ignorées avec
  justification écrite (bindings GTK3 tirés transitivement par `tray-icon`
  pour son support Linux — code mort sur la cible Windows réelle du projet).
- `LICENSE` (MIT).

### Modifié (précédemment)
- Refactor de `src/main.ts` : les ~20 variables `let` de références DOM et
  les 6 variables d'état mutable sont regroupées dans deux objets (`els`,
  `state`) plutôt qu'éparpillées au niveau module — comportement inchangé.
- Mise à jour des dépendances npm : `@tauri-apps/plugin-notification` 2.3.3 →
  2.4.0, `@tauri-apps/plugin-opener` 2.5.4 → 2.5.5, `vite` 8.2.1 → 8.2.2,
  `typescript` 5.6.3 → 7.0.2 (nouveau compilateur natif ; build et tests
  vérifiés après mise à jour).

### Retiré
- `icons/icon.icns` (format d'icône macOS) : l'app ne cible que Windows.

## Historique (avant ce changelog)

- Polish du thème sombre/cyan : icône recolorée, thème natif de la fenêtre
  réglé sur `Dark`.
- Redesign de l'UI avec un thème sombre cyan permanent façon HUD.
- Ajout des options d'extinction/redémarrage programmées dans le menu du
  system tray.
- Durcissement du profil de build release (`lto`, `codegen-units = 1`,
  `strip`, `panic = "abort"`).
- Corrections de 12 points d'audit UI/UX.
- Mise à niveau de Vite vers 8.2.1 et window-vibrancy vers 0.8.0.
- Construction initiale de l'application et premier redesign de l'UI.
- Commit initial.
