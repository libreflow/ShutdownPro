# Politique de sécurité

## Versions prises en charge

ShutdownPro est en version 0.1.x. Seule la dernière version publiée reçoit des correctifs de sécurité.

## Signaler une vulnérabilité

**N'ouvrez pas d'issue publique pour une vulnérabilité de sécurité.**

Contactez-nous par email à **libreflow.app@gmail.com** en décrivant :

- le composant concerné (frontend, backend Rust, bundling/installeur) ;
- les étapes de reproduction ou le scénario d'attaque ;
- l'impact estimé ;
- si applicable, un PoC ou un patch proposé.

Nous nous engageons à accuser réception sous **7 jours** et à tenir informé de l'avancement. Les signalements valides seront corrigés en priorité et crédités dans les notes de release sauf demande contraire. Merci de laisser un délai raisonnable (90 jours) avant toute divulgation publique.

## Périmètre

### Inclus
- Code du backend Rust (`src-tauri/`), notamment l'invocation de la commande système `shutdown`.
- Frontend (`src/`) et configuration de sécurité Tauri (`tauri.conf.json`, capabilities).
- Chaîne de build et installeur NSIS (CI GitHub Actions comprise).
- Dépendances npm et crates Rust.

### Exclus
- Les vulnérabilités dans les versions non publiées (branches de développement) ;
- les problèmes nécessitant un accès physique/administrateur déjà compromis (un attaquant admin peut de toute façon éteindre la machine) ;
- le manque de signature de code (limitation connue, traitée séparément).

## Signalements publics acceptés

Les bugs ordinaires (non-sécurité) peuvent être signalés via les [issues GitHub](https://github.com/libreflow/ShutdownPro/issues).
