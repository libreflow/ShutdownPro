# ShutdownPro

[![CI](https://github.com/libreflow/ShutdownPro/actions/workflows/ci.yml/badge.svg)](https://github.com/libreflow/ShutdownPro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Application de bureau (Windows) pour programmer l'extinction ou le redémarrage de l'ordinateur, avec icône dans la barre système, démarrage automatique et notifications.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) — modèles d'issues et de PR, vérifications locales et règles du projet.

## Fonctionnalités

- Programmer une extinction ou un redémarrage, dans un délai relatif (1 min → 2h, ou personnalisé jusqu'à 24h) ou à une heure fixe.
- Compte à rebours persistant, résistant à la fermeture/réouverture de l'app.
- Icône système tray avec menu (Afficher / Éteindre.../Redémarrer.../Annuler / Quitter) ; la fermeture de la fenêtre masque l'app au lieu de la quitter.
- Démarrage automatique avec Windows (activable/désactivable depuis l'app).
- Notifications système lors de la programmation, de l'annulation et des échecs (y compris ceux déclenchés depuis le tray, fenêtre masquée).
- Windows uniquement pour l'instant (la commande système `shutdown` n'est appelée que sous Windows).

### À savoir

- **Quitter l'application n'annule pas une extinction déjà programmée.** Celle-ci vit au niveau du système d'exploitation (`shutdown /s /t ...`), indépendamment du processus ShutdownPro. Utilisez "Annuler" (dans l'app ou le menu tray) pour l'arrêter réellement.
- **Prérequis système** : [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) doit être installé — présent par défaut sur Windows 10/11 à jour, mais pas garanti sur des installations très anciennes ou allégées.

## Développement

Prérequis : [Node.js](https://nodejs.org/) 24+, [Rust](https://www.rust-lang.org/) (stable), et les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/) pour Windows.

```bash
npm install
npm run tauri dev
```

## Tests

```bash
# Frontend (Vitest)
npm test

# Backend (Rust)
cd src-tauri && cargo test
```

Aucun test n'invoque jamais la vraie commande `shutdown` système : la logique de validation des délais/actions et la construction des messages d'erreur sont testées en isolation (voir `src-tauri/src/lib.rs`, module `tests`, et `src/main.test.ts`).

## Qualité de code

```bash
# TypeScript
npx tsc --noEmit

# Rust
cd src-tauri
cargo fmt --check
cargo clippy --release --all-targets -- -D warnings
cargo audit    # lit .cargo/audit.toml pour les advisories GTK3/Linux ignorées (code mort sur Windows)
```

Ces vérifications tournent automatiquement en CI sur chaque push/PR vers `master` (voir `.github/workflows/ci.yml`).

## Build

```bash
npm run tauri build
```

Produit un exécutable release (`src-tauri/target/release/tauri-app.exe`, sans console) et un installeur NSIS (`src-tauri/target/release/bundle/nsis/`). L'installeur n'est pas signé numériquement (pas de certificat de signature de code) : Windows SmartScreen peut afficher un avertissement au premier lancement chez un utilisateur tiers.

## Stack technique

- Frontend : TypeScript + Vite (sans framework), `@tauri-apps/api`.
- Backend : [Tauri 2](https://v2.tauri.app/) (Rust), plugins `single-instance`, `autostart`, `notification`.
- Tests : Vitest (frontend), `cargo test` intégré (backend).

## Licence

[MIT](LICENSE)
