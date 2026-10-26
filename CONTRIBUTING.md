# Contribuer à ShutdownPro

Merci de vouloir contribuer ! Le projet est petit, les règles sont simples.

## Signaler un bug ou proposer une fonctionnalité

Ouvrez une issue en utilisant l'un des modèles (bug ou fonctionnalité). En français ou en anglais, comme vous préférez.

## Workflow de contribution

1. Forkez puis créez une branche depuis `master` (nom explicite de préférence).
2. Faites vos modifications.
3. Vérifiez que tout passe localement (voir ci-dessous).
4. Ouvrez une PR vers `master` en remplissant le modèle.

## Vérifications locales

Frontend (depuis la racine) :

```bash
npm install
npx tsc --noEmit
npm test
```

Backend (depuis `src-tauri`, nécessite les prérequis Tauri Windows) :

```bash
cargo fmt --check
cargo clippy --release --all-targets -- -D warnings
cargo test --lib
```

Ces vérifications sont identiques à ce que fait la CI : si ça passe chez vous, ça passera chez elle.

## Règles importantes

- **Ne faites jamais exécuter la vraie commande `shutdown` système par un test.** La logique métier est séparée en fonctions pures (`validate_schedule_args`, `immediate_action_args`, `command_error` côté Rust ; `formatDuration`, `resolveAbsoluteTarget` côté TS) précisément pour être testée sans effet de bord.
- L'application ne cible que **Windows** pour l'instant ; le code d'invocation système est sous `cfg(target_os = "windows")`.
- L'interface et les messages d'erreur sont en **français** — suivez le ton et la formulation existants.
- Suivez le style du code existant (formatage `rustfmt`, TypeScript strict).
- Mettez à jour `CHANGELOG.md` sous `[Unreleased]` pour tout changement notable.

## Convention de commit

Une phrase courte à l'impératif, en anglais ou en français, décrivant le changement (ex. « Add single-instance plugin to prevent duplicate tray icons »).
