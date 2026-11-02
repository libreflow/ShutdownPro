# Contribuer à ShutdownPro

Merci de vouloir contribuer ! Ce document décrit le workflow attendu pour que vos contributions soient intégrées rapidement.

## Prérequis

- [Node.js](https://nodejs.org/) 24+
- [Rust](https://www.rust-lang.org/) stable (avec `rustfmt` et `clippy`)
- Les [prérequis Tauri v2](https://v2.tauri.app/start/prerequisites/) pour Windows

## Workflow

1. Forkez le dépôt, puis créez une branche descriptive :
   ```bash
   git checkout -b feat/mon-amelioration
   ```
2. Faites vos changements en restant **focalisés** : une PR = un sujet. Évitez de mélanger refactoring et fonctionnalité.
3. Assurez-vous que tous les checks passent localement (voir ci-dessous).
4. Ouvrez une Pull Request vers `master` en remplissant le template.

## Checks obligatoires (exécutés par la CI)

```bash
# Frontend
npx tsc --noEmit
npm test
npm run build

# Backend
cd src-tauri
cargo fmt --check
cargo clippy --release --all-targets -- -D warnings
cargo test --lib
```

Une PR ne sera mergée que si la CI est verte. `clippy` est en `-D warnings` : zéro warning toléré.

## Conventions du projet

- **Langue** : le code, les messages d'erreur et les libellés UI sont en **français** ; les identifiants de code (variables, fonctions) restent en anglais. Suivez le style existant.
- **Commentaires** : le projet documente largement ses choix (voir `src-tauri/src/lib.rs`). Un commentaire est attendu pour tout choix non-évident, notamment en matière de sécurité.
- **Tests** : la logique pure doit être séparée des effets de bord pour être testable sans toucher au système (voir `validate_schedule_args`). Toute nouvelle logique métier doit venir avec ses tests.
- **Sécurité** : toute invocation de processus externe doit suivre le motif de `run_shutdown_command` (chemin absolu depuis `SystemRoot`, pas de résolution PATH, `CREATE_NO_WINDOW`). Les capabilities Tauri doivent rester minimales ; ne les élargissez pas sans justification.
- **Commits** : messages en anglais ou français, impératif, décrivant le changement (ex. `Add single-instance plugin`).
- **Dépendances** : n'ajoutez une dépendance que si elle est indispensable ; préférez le stdlib Rust et le web platform.

## Signaler un bug ou proposer une fonctionnalité

Ouvrez une [issue](https://github.com/libreflow/ShutdownPro/issues) en suivant les templates fournis (`.github/ISSUE_TEMPLATE/`). Pour les vulnérabilités, suivez la [politique de sécurité](SECURITY.md) — **jamais d'issue publique**.

## Ce que nous ne pouvons pas accepter

- Elargissement des permissions Tauri ou de la CSP sans discussion préalable dans une issue.
- Code spécifique à un autre OS que Windows sans issue d'accord préalable (le backend est volontairement Windows-only pour l'instant).
- Changements de version ou de release process sans accord des mainteneurs.
