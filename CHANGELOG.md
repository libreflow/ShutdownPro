# Changelog

Toutes les modifications notables de ce projet sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### Ajouté
- Plugin `tauri-plugin-single-instance` : relancer l'exécutable (ou laisser
  l'autostart Windows se déclencher alors que l'app tourne déjà) ne crée plus
  une seconde icône tray, une seconde fenêtre et deux commandes `shutdown`
  concurrentes — la seconde instance réaffiche la fenêtre de la première puis
  se ferme.
- `.github/ISSUE_TEMPLATE/` : modèles de bug et de proposition de
  fonctionnalité, avec renvoi des questions vers les Discussions.
- `.github/PULL_REQUEST_TEMPLATE.md` : checklist de vérifications à remplir
  pour chaque PR.
- `.github/dependabot.yml` : mises à jour hebdomadaires automatiques pour npm,
  Cargo et les GitHub Actions.
- `CONTRIBUTING.md` : workflow de contribution, vérifications locales et
  règles du projet.

### Modifié
- `tauri-plugin-opener` retiré : le plugin était enregistré et déclaré dans
  les capabilities sans qu'aucun code ne l'utilise (surface d'attaque et
  dette inutiles). Retiré côté crate Rust, package npm et permissions.
- `withGlobalTauri` passé à `false` dans `tauri.conf.json` : l'API Tauri
  n'est plus exposée globalement sur `window.__TAURI__`, le frontend
  n'utilise que des imports ES.
- Métadonnées de bundle Tauri : `shortDescription`, `longDescription` et
  `copyright` ajoutées à `tauri.conf.json` (installeur NSIS et propriétés de
  l'exécutable correctement renseignés).
- Dépendances npm mises à jour pour corriger toutes les vulnérabilités
  signalées par `npm audit` (vitest 5.0.5, vite 8.3.5, undici 7.30.1,
  source-map-js 1.2.2) — audit désormais à 0.

### Corrigé
- Un clic réflexe sur « Annuler » quand aucune extinction n'était
  programmée n'émet plus de notification système : le message dans la
  fenêtre suffit.

### Retiré
- Assets SVG morts (`src/assets/vite.svg`, `tauri.svg`, `typescript.svg`),
  référencés nulle part.

### Ajouté (précédemment)
- Job CI `release` : au push d'un tag `v*`, build de l'installeur NSIS
  (`npm run tauri build`), upload en artifact et création automatique d'une
  GitHub Release avec notes générées — après validation des jobs
  frontend/backend/audit.

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
