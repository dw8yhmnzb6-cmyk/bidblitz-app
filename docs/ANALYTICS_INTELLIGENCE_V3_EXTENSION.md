# BidBlitz Intelligence 3.0 — Enterprise-Erweiterung
Stand: 2026-10-12. Ergänzt die sieben Analytics-Basismodule und zwölf zuvor geplante Enterprise-Funktionen. **Kein Live-Deployment.**

## Funktionskatalog 20–34
| ID | Modul | Messgröße und Abnahme |
|---|---|---|
| INT-020 | Customer Data Platform | Einwilligungs-/rechtsgrundlagengesteuerte Identitätsverknüpfung; Opt-out, Löschung und Projekttrennung bestehen Tests |
| INT-021 | Data Warehouse & BI | Reproduzierbare, inkrementelle Exporte, Datenherkunft, Schema-Versionen, Kosten-/Lasttests |
| INT-022 | Server-Side Conversion Tracking | Nur bestätigte Transaktionsereignisse, idempotente Event-IDs, keine unberechtigte Datenweitergabe |
| INT-023 | Marketing Mix Modeling | Spend-/Outcome-Zeitreihen, Unsicherheitsintervalle, Mindestdatenvolumen |
| INT-024 | Incrementality Testing | Randomisierte Holdout-Gruppen, Effekt plus Konfidenzintervall, Schutz vor Peeking |
| INT-025 | Recommendation Engine | Transparente Regeln vor ML, Guardrails für Fairness und missbräuchliche Personalisierung |
| INT-026 | Customer Segmentation | Rollen-/Consent-gebundene Segmente, Mindestgruppengröße, Löschpfad |
| INT-027 | Lifecycle Automation | Zustimmung zu Kommunikationskanälen, Frequenzgrenzen, Abmeldung, Auditlog |
| INT-028 | Subscription Intelligence | MRR/ARR, erfolgreiche Verlängerungen, Churn, fehlgeschlagene Abbuchung, Refunds |
| INT-029 | SLA & SLO Monitoring | Fehlerbudget, SLOs für Login/Checkout/API, Alert Routing, Incident Review |
| INT-030 | API Intelligence | Ausfallrate, Latenz, Provider-Billing, regionale Performance, API-Secret-Schutz |
| INT-031 | FinOps Center | Infrastruktur-/KI-Kosten auf Projekt und Umgebung zugeordnet, Budgetalarm |
| INT-032 | Data Governance Center | Datenkatalog, Zweckbindung, Owner, Aufbewahrung, Rollenrechte und Lineage |
| INT-033 | Experimentation Governance | Experiment-Registry, Varianten-Validierung, SRM-Checks, Holdout-Policies |
| INT-034 | Automated Incident Response | Sichere Runbooks mit Genehmigung, Staging-Tests und nachweislichem Rollback |

## Architekturentscheidungen
1. Vorhandenes `backend/routes/analytics.py`, Conversion-Kollektionen und den gemeinsamen Event-Vertrag weiterverwenden; **keine neue parallele Haupt-Datenbank**.
2. Zuerst Consent, RBAC, Event-Integrität, Data Quality und Umsatzabgleich. Danach Portfolio-UI, SLO und FinOps; erst bei ausreichenden Daten ML/Attribution.
3. Für Trade, Eyes, Verify und Wallet sensible Interaktionen generell von Replay und frei formulierbaren Event-Payloads ausschließen.
4. BidBlitz ID darf Anmeldung vereinheitlichen, ist aber kein automatisches Tracking-Einverständnis.
5. Echte Umsätze ausschließlich aus autoritativen Zahlungs-/Buchungsdaten ermitteln; Browser-Events dienen nur der Nutzungsmessung.
6. Ausgelagerte Anbieter nur nach Datenflussprüfung, Datenverarbeitungsvertrag und technischer Kontrolle anbinden.
7. Alle neuen Module standardmäßig aus; per projektbezogenem Feature Flag schrittweise in Staging aktivieren.

## Umsetzung in sechs XXL-Paketen
- **A — Trust Foundation:** Eventvertrag, SDK-Kompatibilität, Backend-Validator, Consent/Widerruf, Datenminimierung, Tenant-RBAC, Qualitätsrobotik.
- **B — Commercial Truth:** Payment Reconciliation, Subscription KPI, CLV, Kosten- und Margendefinition, serverseitige Konversionen.
- **C — Portfolio OS:** Zentrale Projektkennzahlen, Data Catalog, FinOps, API-/SLO-Telemetrie, auditiertes Berichtswesen.
- **D — Growth OS:** Marketing-Attribution, Marketing Mix, Incrementality, Kohorten, Segmente, Lifecycle mit Opt-outs.
- **E — Optimization:** Experimente, Feature Flags, Empfehlungen, Release Impact, Heatmap/Replay ausschließlich nach Privacy-Prüfung.
- **F — AI & Resilience:** Prognosen nur mit ausreichenden Daten, Incident-Warnungen, KI-gestützte Berichte, überprüfbare Runbooks.

## Definition of Done
Jede Funktion benötigt Quellcode/Commit, positive UND negative Tests, Integrationsnachweis, Datenschutz-/Berechtigungsprüfung, Datenqualitätsnachweis, Staging Smoke Test und Rückfallplan. Ohne dies bleibt sie 'geplant' bzw. 'in Arbeit'.

## Messmethodik
- Besucher, Sessions und Kunden sind drei unterschiedliche Größen; Consent-Lücken dokumentieren.
- Conversion Rate immer mit benanntem Nenner, Zeitraum und Entdoppelungsverfahren.
- CLV als Schätzwert mit expliziter Kostendefinition, Währung, Kohortenbezug und Unsicherheit kennzeichnen.
- Unternehmensgewinn nur nach vollständiger Kostenallokation darstellen; keine Gleichsetzung mit Umsatz minus ausgewählten Kosten.
- Prognosen niemals als tatsächliche Zahl und A/B-Korrelation niemals als bewiesene Kausalität ausgeben.

## Explizit nicht enthalten
Produktiv-Rollout, Servermigration, Kundendaten-Exporte, Live-Handel, automatische Kontosperren oder Zahlungsänderungen. Diese erfordern separate sichere Freigabe.
