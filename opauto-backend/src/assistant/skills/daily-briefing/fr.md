---
name: daily-briefing
description: Use when the user asks for a morning summary, daily snapshot, end-of-day report, or 'what happened today/yesterday'. Compiles revenue, customer activity, active jobs, overdue invoices, and at-risk customers into a structured 5-section briefing.
triggers: [morning, daily, briefing, summary, snapshot]
tools: [get_dashboard_kpis, get_revenue_summary, get_customer_count, list_active_jobs, get_invoices_summary, list_overdue_invoices, list_at_risk_customers, list_low_stock_parts]
---

Tu produis un briefing quotidien concis pour le propriétaire du garage. Adapte le ton à la langue de l'utilisateur. Les noms d'outils restent en anglais (identifiants techniques).

## Collecte des données (séquentielle, puis agrégation)

1. Appelle `get_revenue_summary({"period":"today"})` puis `get_revenue_summary({"period":"week"})`. Calcule l'écart en pourcentage entre aujourd'hui et la moyenne sur 7 jours.
2. Appelle `get_customer_count` avec `newSince` fixé à la date ISO-8601 d'hier (00h00 locale) pour obtenir les nouveaux clients des dernières 24h.
3. Appelle `list_active_jobs` (sans argument) pour les interventions en cours.
4. Appelle `list_overdue_invoices` pour le nombre et le total des impayés.
5. Appelle `list_at_risk_customers({"limit":5})` pour les 5 principaux clients à risque.
6. Appelle `list_low_stock_parts` pour les alertes de stock.

En cas d'échec d'un outil, mentionne-le brièvement dans la section concernée et continue — n'abandonne jamais le briefing.

## Format de sortie

Produis exactement cinq sections courtes, chacune de 2 à 3 lignes maximum, dans cet ordre :

1. **Chiffre d'affaires** — total du jour, cumul de la semaine, écart vs moyenne 7 jours.
2. **Clients** — nouveaux clients sur 24h, plus une ligne de lecture d'activité.
3. **Interventions** — nombre d'interventions actives et la plus ancienne encore ouverte si pertinent.
4. **Factures en attente** — nombre d'impayés et montant total.
5. **Risques & stock** — nombre de clients à risque (cite le top 1-2) et pièces en rupture.

Termine par une seule ligne : `Action recommandée :` suivie d'UNE suggestion concrète — idéalement un outil à appeler, un client ou une facture à traiter en priorité.

Garde l'ensemble sous 200 mots. Pas de salutations, pas de formules de politesse.
