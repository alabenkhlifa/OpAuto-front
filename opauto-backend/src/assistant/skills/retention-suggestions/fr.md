---
name: retention-suggestions
description: Use when the user asks how to retain a specific at-risk customer, what to offer them, or how to bring them back. Scores the customer's churn factors and recommends the right outreach (SMS reminder, discount offer, personal call) with concrete copy.
triggers: [retention, win-back, retain, at-risk, churn, bring-back]
tools: [get_customer, list_at_risk_customers, propose_retention_action]
---

Tu produis une recommandation de fidélisation pour UN client précis. Adapte le ton à la langue de l'utilisateur ; les noms d'outils restent en anglais.

## Étape 1 : identifier le client

- Si l'utilisateur a déjà nommé ou désigné un client précis (nom, téléphone, ID, ou « ce client » via le contexte de page), utilise ce client.
- Sinon, appelle `list_at_risk_customers({"limit":10})` et choisis le client le plus à risque correspondant à l'intention. Sans préférence exprimée, prends la première entrée et précise-le à l'utilisateur.

## Étape 2 : récupérer la fiche complète

Appelle `get_customer({"customerId":"<id>"})` pour obtenir les dernières visites, le total dépensé et les facteurs de désengagement.

## Étape 3 : évaluer

Pondère les facteurs :

- **Jours depuis la dernière visite** — > 180 jours = forte pression de désengagement.
- **Dépense moyenne** — les gros dépensiers méritent un appel personnel, pas un SMS générique.
- **Niveau de fidélité** — les niveaux gold/silver méritent une approche plus chaleureuse et personnalisée.
- **Schéma de visites** — les anciens clients réguliers devenus silencieux sont la priorité absolue.

Choisis EXACTEMENT UN mécanisme de relance : **rappel SMS** (peu intrusif, dormants ≤ 180j), **offre de remise** (moyennement intrusif, ≤ 365j), ou **appel personnel** (très personnel, haute valeur ou silence > 365j).

## Étape 4 : rédiger le message (SMS uniquement)

Si tu as choisi le SMS, appelle `propose_retention_action({"customerId":"<id>"})` pour générer un brouillon soumis à l'approbation du propriétaire. N'appelle PAS `send_sms` directement — l'envoi passe par le circuit d'approbation existant.

## Format de sortie

1. **Diagnostic** (1 paragraphe, 3-4 lignes) — nomme le client, résume pourquoi il est à risque, cite les chiffres.
2. **Recommandation** (1 paragraphe, 3-4 lignes) — nomme le mécanisme retenu et justifie-le par les facteurs ci-dessus.
3. **Actions suivantes** (liste à puces, 2 à 4 éléments) — les étapes concrètes pour le propriétaire, avec les outils à utiliser. Si un brouillon a été généré, mentionne qu'il est en attente d'approbation.

Pas de remplissage. Pas d'alternatives.
