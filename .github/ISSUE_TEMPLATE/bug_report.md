name: Rapport de bug
about: Quelque chose ne fonctionne pas comme prévu
title: "[bug] "
labels: bug
body:
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Décrivez le problème de façon concise et factuelle.
    validations:
      required: true
  - type: textarea
    id: reproduction
    attributes:
      label: Étapes de reproduction
      description: Numérotez les étapes (1. 2. 3.) permettant de reproduire le bug systématiquement.
      placeholder: |
        1. Ouvrir ShutdownPro
        2. Choisir un délai de 15 minutes
        3. Cliquer sur « Programmer »
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Comportement attendu
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: Comportement observé
    validations:
      required: true
  - type: textarea
    id: context
    attributes:
      label: Contexte
      description: Version de ShutdownPro, édition de Windows, journal d'erreur le cas échéant.
      placeholder: |
        - Version : 0.1.0
        - OS : Windows 11 23H2
    validations:
      required: true
  - type: markdown
    attributes:
      value: |
        ⚠️ Si le problème est une vulnérabilité de sécurité, **n'ouvrez pas cette issue** : consultez [SECURITY.md](https://github.com/libreflow/ShutdownPro/blob/master/SECURITY.md).
