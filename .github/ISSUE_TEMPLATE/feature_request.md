name: Proposition de fonctionnalité
about: Suggérer une amélioration ou une nouvelle fonctionnalité
title: "[feature] "
labels: enhancement
body:
  - type: textarea
    id: problem
    attributes:
      label: Problème à résoudre
      description: Quel besoin ou quelle frustration cette fonctionnalité adresse-t-elle ?
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Solution proposée
      description: Décrivez ce que vous aimeriez voir, en restant réaliste par rapport au périmètre de l'app.
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives envisagées
    validations:
      required: false
  - type: checkboxes
    id: scope
    attributes:
      label: Périmètre
      options:
        - label: Accepteriez-vous que la fonctionnalité soit Windows uniquement ?
          required: false
