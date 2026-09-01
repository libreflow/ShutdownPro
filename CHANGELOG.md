# Changelog

Toutes les modifications notables de ce projet sont documentées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### Corrigé
- Une action immédiate ("Maintenant") déclenchée depuis le menu du system
  tray qui échouait ne montrait ni la fenêtre principale ni de notification
  système — l'échec était totalement silencieux si la fenêtre était masquée.
  Corrigé des deux côtés (Rust affiche désormais la fenêtre sur échec, et le
  frontend envoie toujours une notification OS en cas d'erreur tray).
- `@tauri-apps/plugin-notification` et `@tauri-apps/plugin-opener` étaient
  déclarées en `devDependencies` alors que ce sont des dépendances runtime
  (importées et exécutées dans l'app buildée) — déplacées vers `dependencies`.

### Ajouté
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

### Modifié
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
