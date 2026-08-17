# ShutdownPro

Application de bureau (Windows) pour programmer l'extinction ou le redémarrage de l'ordinateur, avec icône dans la barre système, démarrage automatique et notifications.

## Fonctionnalités

- Programmer une extinction ou un redémarrage, dans un délai relatif (1 min → 2h, ou personnalisé jusqu'à 24h) ou à une heure fixe.
- Compte à rebours persistant, résistant à la fermeture/réouverture de l'app.
- Icône système tray avec menu (Afficher / Annuler / Quitter) ; la fermeture de la fenêtre masque l'app au lieu de la quitter.
- Démarrage automatique avec Windows (activable/désactivable depuis l'app).
- Notifications système lors de la programmation et de l'annulation.
- Windows uniquement pour l'instant (la commande système `shutdown` n'est appelée que sous Windows).

## Développement

Prérequis : [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/), et les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/) pour votre plateforme.

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Stack technique

- Frontend : TypeScript + Vite (sans framework), `@tauri-apps/api`.
- Backend : [Tauri 2](https://v2.tauri.app/) (Rust), plugins `opener`, `autostart`, `notification`.
