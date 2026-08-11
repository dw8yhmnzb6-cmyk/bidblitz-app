# BidBlitz — ROADMAP

## Status nach final geschlossenem POS-Acceptance-Paket — 11.08.2026
- ✅ Die harten POS-Gates aus Iteration 314 gelten jetzt als **geschlossen**: Mobile/Tablet-Layout, Touch Targets, Failure-/Unknown-State, Customer-Display-Privacy und Backend-Duplikatschutz sind testverifiziert.
- ✅ Teststand: **`/app/test_reports/iteration_316.json` PASS**, `backend/tests/test_pos_acceptance_iter316.py` **PASS**, `backend/tests/test_pos_hardening_iter314.py` **PASS (16/16)**.
- ✅ Performance-Nachweis laut Testreport: POS-Start **1.45s**, Payment-Transition **82ms**; Search/Product-Tap im Report als **INFO** vermerkt, aber nicht blockierend.
- 🔴 Nächster Hauptschritt bleibt: **Telegram-Alarm als Monitoring-Backup** (kritische Alarme + Tagesreport), sobald **Bot-Token + Chat-ID** vorliegen.
- 🟡 Danach: weitere Commerce-/Mobility-Roadmap und optionale Storage-/Evidence-Anbindung für Disputes.

## Status nach Finance V2 Ausbau + Kids-GPS-Fix — 10.08.2026
- ✅ Finance V2 steht jetzt deutlich breiter: **Reserve-Regeln**, **Adjustment-Freigaben**, **Dispute-/Chargeback-Sicht** und **deutschsprachige CSV-Exporte** sind live.
- ✅ Merchant Command Center und Admin Merchant Settlements wurden um Risiko-, Reserve-, Adjustment- und Dispute-Steuerung erweitert.
- ✅ Verifiziert mit **`backend/tests/test_merchant_finance_v2_iter316.py` PASS (7/7)**, API-Smokes **PASS** und Frontend-Smoke **PASS**.
- ✅ Kids-GPS-Fehler aus dem Nutzer-Screenshot ist behoben: **`/api/kids/gps/*`** war wegen fehlender Router-Registrierung nicht erreichbar und antwortet jetzt wieder korrekt.
- 🔴 Nächster sinnvoller Schritt: die restlichen **harten POS-Acceptance-Gates aus Iteration 314** weiter schließen und die noch fehlenden Mess-/A11y-/Retry-Nachweise sauber finalisieren.
- 🟡 Danach: **Telegram-Alarm als Monitoring-Backup** umsetzen, sobald **Bot-Token + Chat-ID** vorliegen.
- 🟡 Parallel bleibt möglich: Finance V2 weiter auf **Evidence-Uploads / Storage-Anbindung** und feinere Reconciliation-Ansichten ausbauen.

## Status nach Merchant Settlement / Payout / Daily Closing / POS Leitstand — 02.08.2026
- ✅ Merchant-Finanzkern ist live: **`/api/merchant/balance`**, **`/api/merchant/command-center`**, Settlement-Liste/Overview/Detail, Payout-Historie und Daily Closing.
- ✅ Neue Owner-/Admin-Oberflächen sind live: **`/merchant/dashboard`**, **`/merchant/payouts`**, **`/merchant/pos/daily-closing`**, **`/merchant/settlements/:id`**, **`/admin/merchant-settlements`**.
- ✅ Ledger-/Minor-Unit-Grundlage ist aktiv; Balances sind in **pending / available / reserved / payout_in_progress / paid_out_total** getrennt.
- ✅ Verifiziert mit API-Smokes, Browser-Smokes und **Testing Agent Iteration 315 PASS**; zusätzlicher Frontend-Admin-Route-Fix nach Subagent-Fund ebenfalls geprüft.
- 🔴 Nächster sinnvoller Schritt: die noch offenen **POS-Acceptance-Gates aus Iteration 314** gezielt schließen (Touch-Targets, unbekannte Zahlungszustände, Retry-/Duplicate-Proof, Customer-Display-Privacy, gemessene Performance-Gates).
- 🔴 Parallel offen: Settlement-/Finance-V2 für **Reserve-/Adjustment-Admin-Workflows**, **Export-Polish**, **Dispute-/Chargeback-Sicht** und tiefergehende Refund-/Rollback-Automation erweitern.
- 🟡 Danach: die größere Roadmap wieder aufnehmen — **Telegram-Alarm als Monitoring-Backup** und anschließend die größeren Refactors in **App.js / MerchantDashboardPage / Home / Wallet**.

## Status nach Mehr-Seiten-Split / Rangliste entfernt — 02.08.2026
- ✅ Die sichtbare **Rangliste** ist aus der aktiven More-Navigation entfernt.
- ✅ Die Mehr-Seite ist jetzt in **2 Bereiche** aufgeteilt: **Seite 1 = Wichtig**, **Seite 2 = Mehr entdecken**.
- ✅ Inhalte wie **Auktionen, Mining, Rewards und weitere Extras** sind jetzt sauber auf **Seite 2** verschoben.
- ✅ Die Route **`/leaderboard`** zeigt nicht mehr die alte Ranglisten-UI, sondern führt direkt in die neue zweite Mehr-Seite.
- ✅ Browser-Smoke **PASS** und Frontend-Testagent **PASS** für die neue Navigation ohne sichtbaren Ranglisten-Eintrag.
- 🔴 Nächster sinnvoller Schritt: die neue Mehr-Struktur weiter kürzen und pro Seite noch stärker nach **Kernaktionen vs. Entdecken** sortieren, damit die zweite Seite nicht erneut überfrachtet.
- 🟡 Parallel offen: die alte ungenutzte Ranglisten-Komponente `ExtraFeatures.jsx` später technisch bereinigen oder in reine Search-/Onboarding-Helferdatei aufteilen.

## Status nach Final BidBlitz Completion Phase / Master Roadmap Control Center — 02.08.2026
- ✅ Neue offizielle Abschlusszentrale **`/admin/master-roadmap`** ist live und testverifiziert.
- ✅ Enthalten: **8 Phasen**, **P0 Launch Blockers**, **Release Gates**, **Feature Registry**, **Launch Readiness**, **CEO View**, **Wallet-/Environment-/Version-Diagnosen** und **Final Acceptance Report**.
- ✅ Neue restriktive Fortschrittsroute **`/investors/progress`** ist live und gibt keine sensiblen internen Daten preis.
- ✅ Visual-QA-Issues können jetzt zusätzlich als Roadmap-Tasks synchronisiert werden.
- ✅ Wallet-API-Contract wurde gehärtet: **`/api/wallet`** und **`/api/wallet/balance`** liefern denselben kanonischen EUR-Saldo plus **`canonical_source='users.balance'`**.
- ✅ Verifiziert mit API-Selbsttests, Browser-Smoke, `backend/tests/test_master_roadmap_control_center.py` **PASS** und **Testing Agent Iteration 313 PASS**.
- 🔴 P0 bleibt bewusst offen: **Wallet-Konsistenz vollständig schließen**, **Environment-Separation production-safe machen**, **Version-Parity real verifizieren**, **GitHub-Workflow-Gates wirklich grün bekommen**.
- 🔴 Nächster sinnvoller Umsetzungsschritt: auf Basis der neuen Zentrale jetzt **Phase 1 – Wallet Consistency** technisch fertigziehen (alle Legacy-Reads/duplizierten Endpunkte/Engine-Bypässe systematisch entfernen und Reconciliation sauber abschließen).
- 🟡 Danach: **Phase 2 Core User Flows** matrizenartig durchtesten (Success, Validation, Network Error, Expired Session, Unauthorized, Empty, Loading, Mobile).
- 🟡 Danach: **Store-safe Release** und **Release Artifacts** gegen echte Mobile-Build-Artefakte und Reviewer-Checklisten abgleichen.

## Status nach zentralem Design System + Visual-QA-Anbindung — 01.08.2026
- ✅ Zentrale BidBlitz-Tokens für Farben, Spacing, Radien, Buttonhöhen, Bottom-Nav und Safe Areas sind live.
- ✅ Neue Shared-Komponenten **MoneyAmount**, **CountdownTimer**, **ProductImageGallery**, **BidBlitzPageShell**, Button- und Card-Sets sind gebaut.
- ✅ Neue Dev-Route **`/design-system`** ist live und per **Testing Agent Iteration 312 PASS** verifiziert.
- ✅ `/auctions`, Auktionsdetail und `/taxi` wurden sichtbar auf das Design-System gehärtet: deutsches Preisformat, Dark Theme, mobile Stack-Regeln, Gallery-Metadaten, Safe-Area-/Sticky-CTA-Absicherung.
- ✅ Visual-QA-Spezifikation erkennt jetzt zusätzlich Token-Snapshots, Button-Min-Höhen und Gallery-Metadaten.
- 🔴 Nächster sinnvoller Schritt: **weitere Kernrouten** wie Wallet, Home und More schrittweise auf dieselben Shared-Bausteine migrieren, damit Mobile/UI-Verhalten nicht mehr pro Seite auseinanderläuft.
- 🔴 Parallel offen: den **lokalen Playwright-Workspace-Pfad** sauber finalisieren, damit Visual-QA nicht nur über Browser-Agenten, sondern auch wieder direkt per Projekt-Command stabil läuft.
- 🟡 Danach zurück auf die größere Produkt-Roadmap: **Investor-Portal Phase 2** und — falls wieder priorisiert — **Telegram-Alarm als Monitoring-Backup**.

## Status nach neuer Homepage-Section „Warum gerade jetzt?“ — 01.08.2026
- ✅ Neue Premium-Section **„Warum gerade jetzt?“** ist live.
- ✅ Enthalten: 10-Punkte-Progress-Timeline, 4 Karten **„Warum jetzt?“**, 6 Meilensteine, 6 Fokus-Karten und CTA mit zwei funktionierenden Buttons.
- ✅ Vollständig übersetzt in allen vorhandenen BidBlitz-Sprachen.
- ✅ Verifiziert mit Screenshot-Smoke und **Testing Agent Iteration 311 PASS**; responsive auf **320px / 390px / 768px / Desktop** ohne Overflow.
- ✅ Regression-Check bestanden: **„Unsere Vision“**, **„Warum BidBlitz?“** und die Investor-Section bleiben intakt.
- 🔴 Nächster sinnvoller Schritt: die Homepage-Sections jetzt in eine endgültige High-Conversion-Reihenfolge bringen und die CTA-Wege auf Wallet / Registrierung / Investor-Flow feinjustieren.
- 🔴 Parallel dazu bleibt **Investor-Portal Phase 2** der nächste große Ausbau — Login/Register, Portal-Bereiche, Admin-Dokumente, Fragen, Meetings und Statuslogik vollständig verifizieren.

## Status nach neuer Homepage-Section „Unsere Vision“ — 01.08.2026
- ✅ Neue Premium-Section **„Unsere Vision“** ist live.
- ✅ Enthalten: Mission, 3-Phasen-Roadmap, Werte, Begründungsblock, Anspruchsblock und CTA mit funktionierenden Buttons.
- ✅ Vollständig übersetzt in allen vorhandenen BidBlitz-Sprachen.
- ✅ Verifiziert mit Screenshot-Smoke, **Testing Agent Iteration 310 PASS** und zusätzlichem Frontend-Testagenten; responsive auf **320px / 390px / 768px / Desktop** ohne Overflow.
- ✅ Regression-Check bestanden: **„Warum BidBlitz?“** und die Investor-Section bleiben darunter intakt.
- 🔴 Nächster sinnvoller Schritt: das **Investor-Portal Phase 2** umsetzen — **`/investor-login`**, **`/investor-register`**, **`/investor-portal/*`**, Admin-Bereiche, Dokumente, Fragen, Meetings und Statuslogik.
- 🟡 Danach: Homepage-Funnel weiter verfeinern und einzelne Premium-Sections mit gezielten Deep-Links in Wallet, Merchant und Investor-Flows verbinden.

## Status nach neuer Homepage-Section „Warum BidBlitz?“ — 01.08.2026
- ✅ Neue Premium-Section **„Warum BidBlitz?“** ist live.
- ✅ Enthalten: **8 Feature-Karten**, Vergleich **Andere Apps vs. BidBlitz**, Zielgruppenblock und vollständige Übersetzungen in allen vorhandenen Sprachen.
- ✅ Verifiziert mit Screenshot-Smoke und **Testing Agent Iteration 309 PASS** inkl. Mobile-Checks **320px / 390px**.
- ✅ Regression-Check bestanden: die neue Investor-Section bleibt darunter sichtbar und funktionsfähig.
- 🔴 Nächster sinnvoller Schritt: das **Investor-Portal Phase 2** umsetzen — **`/investor-login`**, **`/investor-register`**, **`/investor-portal/*`**, Admin-Bereiche, Dokumente, Fragen, Meetings und Statuslogik.
- 🟡 Danach: Homepage weiter modularisieren und die Guest-Section-Reihenfolge endgültig auf den bestätigten Wallet-First-Funnel ausrichten.
- 🟡 Danach: gezielte CTA-Verknüpfungen aus Feature-Karten in Wallet, Merchant, Travel und Mobility sauber verbinden, ohne die Startseite zu überladen.

## Status nach Investor-Homepage-Section + `/investieren` Interest-Flow — 01.08.2026
- ✅ Neue Premium-Homepage-Sektion **„Warum jetzt in BidBlitz investieren?“** ist live, inklusive **6 Karten**, **Kapital-Einsatz**, **Roadmap** und finalem CTA.
- ✅ Neue öffentliche Route **`/investieren`** ist live und enthält denselben Informationsblock plus **unverbindliches Interessensformular**.
- ✅ Backend für Public-Investor-Leads ist live: **`POST /api/investor-interest/lead`** mit Duplicate-Schutz und Rate-Limit.
- ✅ Verifiziert mit Screenshot-Smoke, API-Selbsttests und **Testing Agent Iteration 308 PASS**; responsive auch auf **320px** geprüft.
- 🔴 Nächster sinnvoller Schritt: das **rechtlich saubere Investor-Portal Phase 2** bauen — **`/investor-login`**, **`/investor-register`**, **`/investor-portal/*`**, getrennte Investor-Datenmodelle, Statuslogik, Dokumentfreigaben, Fragen, Meetings, Admin-Tabellen und CSV-Export.
- 🟡 Danach: Homepage-Reststruktur weiter exakt an die bestätigte Wallet-First-Reihenfolge annähern (Benefits / Privat-Unternehmen / CTA noch stärker modularisieren und entflechten).
- 🟡 Danach: E-Mail-Benachrichtigungen für Investor-Status-/Dokumenten-Events sauber anschließen, sobald der Resend/DNS-Blocker wirklich gelöst ist.

## Status nach BidBlitz Pay Sandbox-Gateway — 01.08.2026
- ✅ Neue BidBlitz-Pay-Sandbox-Struktur ist live: **Zahlung starten**, **Redirect Checkout**, **Wallet-/App-Freigabe**, **Status**, **Success/Cancel**, **Webhook**, **Refund-Struktur**, **Idempotency** und **Audit-Logs**.
- ✅ Bestehender Checkout blieb intakt; zusätzlich wurde der Router-Konflikt gelöst, sodass **`/api/pay/directory`** wieder korrekt erreichbar ist.
- ✅ Verifiziert mit API-Selbsttests, **Testing Agent Iteration 307 PASS**, **Frontend Testing PASS** und **Backend Testing PASS**.
- 🔴 Nächster sinnvoller Schritt: echte **Live-Credentials** für BidBlitz Pay per Environment setzen und den neuen Gateway-Pfad gegen den realen Provider-Endpunkt validieren.
- 🟡 Danach: echtes Merchant-/Provider-Webhook-Monitoring mit Retry-Backoff, Delivery-Statusansicht und Alerting ausbauen.
- 🟡 Danach: UX-Polish für den Hosted Checkout (z. B. Login-inline, besserer Deep-Link-Fallback, klarere Sandbox/Live-Indikatoren).
- 🟡 Wichtig: Im aktuellen Stand sind Wallet-/App-Freigabe und Refund-Abschluss im neuen Gateway **MOCKED**, bis echte Provider-Zugangsdaten vorliegen.

## Status nach Mobile-Hero-Fix — 30.07.2026
- ✅ Mobile P2P-Hero-Demo nach Video-Feedback überarbeitet.
- ✅ Demo-Namen jetzt **Lena / Jonas** statt Afrim / Albin.
- ✅ Phone-Mockups und mobile Transfer-Demo auf iPhone sauber ausgerichtet und lesbarer.

## Status nach Wallet-First Homepage Hero — 30.07.2026
- ✅ Homepage kommuniziert für neue Besucher jetzt sofort **P2P-Geld senden/empfangen**.
- ✅ Bitcoin-Mining-Proof ist nach unten verschoben und nicht mehr die Hauptbotschaft.
- ✅ Neue Wallet-Hero-Section plus **„So einfach funktioniert BidBlitz“**-Sektion sind live.
- ✅ Übersetzungen für die neue Homepage-Sektion sind in allen vorhandenen BidBlitz-Sprachen ergänzt.
- ✅ Verifiziert mit 320px/390px/Desktop-Smokes, **Testing Agent Iteration 306 PASS** und finalem Frontend-Smoke.
- 🔴 Nächster sinnvoller UX-Schritt: den **Send/Receive Flow** direkt aus dem Hero in einen geführten Wallet-Onboarding-Flow überführen.
- 🟡 Danach: Reward-Stufen mit konkreten Einlösungen und Vorteils-Copy.
- 🟡 Danach: Regel-Laufzeiten / Gültigkeitsfenster je Region/Händler.

## Status nach In-App Vorschau — 30.07.2026
- ✅ **In-App Vorschau** für Charge-Rechnungen und Garantiebelege ist live.
- ✅ Vorschau funktioniert jetzt auch im **Händlerkontext** über die Detailseite.
- ✅ Bilder und PDFs werden direkt in der App geöffnet; Download bleibt zusätzlich erhalten.
- ✅ Verifiziert mit Backend-Selbsttests, Browser-Smoke und **Testing Agent Iteration 305 PASS**.
- 🔴 Nächster sinnvoller Charge-Schritt: **Reward-Stufen mit konkreten Einlösungen** und sichtbarer Vorteils-Copy.
- 🟡 Danach: Regel-Laufzeiten / Gültigkeitsfenster je Region/Händler.
- 🟡 Danach: feinere CRM-/Push-Kampagnen für personalisierte Charge-Angebote.
- 🟡 Separat weiter offen: **Telegram-Alarm als Monitoring-Backup** nur wenn wieder gewünscht.

## Status nach neuem AAB-Buildversuch — 30.07.2026
- ✅ Neuer lokaler **Android Release-Keystore** ist erzeugt.
- ✅ Android SDK + Java wurden im Container für den Buildpfad vorbereitet.
- 🔴 Finales **Play-Store-AAB** bleibt im aktuellen **ARM64-Container** weiterhin blockiert durch **AAPT2 / Exec format error**.
- 🔴 Nächster zwingender Schritt für echten Upload: denselben Release-Build auf **x86_64 / Android Studio / lokalem Rechner** ausführen.
- 🟡 Danach: AAB hochladen und Play-Console-Release anlegen.

## Status nach Admin-Regelsteuerung — 30.07.2026
- ✅ **Admin-pflegbare Charge-Angebotsregeln** sind live.
- ✅ Admin kann jetzt Regeln nach **Region**, **Händler**, **Kategorie**, **Score-Boost** und **Priorität** pflegen und aktiv/inaktiv schalten.
- ✅ Diese Regeln wirken direkt auf Charge-Personalisierung und Merchant-Ranking.
- ✅ Verifiziert mit Backend-Selbsttests, Browser-Smoke und **Testing Agent Iteration 304 PASS**.
- 🔴 Nächster sinnvoller Charge-Schritt: echte **In-App Vorschau** für Rechnungen/Bilder plus Vorschau im Garantie-/Händlerkontext.
- 🟡 Danach: Reward-Stufen mit konkreten Einlösungen und Vorteils-Copy.
- 🟡 Danach: feinere regionale Kampagnensteuerung mit Laufzeiten / Gültigkeitsfenstern je Regel.
- 🟡 Separat weiter offen: **Telegram-Alarm als Monitoring-Backup** nur wenn wieder gewünscht.

## Status nach Charge-Personalisierung — 30.07.2026
- ✅ **Personalisierte Charge-Angebote je Händler/Region** sind live.
- ✅ Dashboard liefert jetzt **Personalization Profile**, **personalized_offers** und **ranking-basierte Händler**.
- ✅ Händler- und Angebotsklicks werden im Charge-Modul als Interaktionen erfasst.
- ✅ Verifiziert mit Backend-Selbsttests, Browser-Smoke und **Testing Agent Iteration 303 PASS**.
- 🔴 Nächster sinnvoller Charge-Schritt: echte **In-App Vorschau** für Rechnungen/Bilder plus Vorschau in Händler-/Garantiekontext.
- 🟡 Danach: dynamische Angebotssteuerung je Region/Händlerkategorie mit Admin-Pflegefeldern.
- 🟡 Danach: Reward-Stufen mit konkreten Einlösungen und Vorteils-Copy.
- 🟡 Separat weiter offen: **Telegram-Alarm als Monitoring-Backup** nur wenn wieder gewünscht.

## Status nach Charge-App V2 — 29.07.2026
- ✅ **Datei-Uploads** für Rechnungen und Garantiebelege sind live.
- ✅ **Digitaler Garantiepass** mit QR-Vorschau und Download ist live.
- ✅ **Händlerdetailseite** aus dem Charge-Finder ist live.
- ✅ Verifiziert mit Backend-Selbsttests, Browser-Smoke und **Testing Agent Iteration 302 PASS**.
- 🔴 Nächster sinnvoller Charge-Schritt: echte **Bild-/PDF-Vorschau** direkt in der App statt nur Download-Link.
- 🟡 Danach: personalisierte Angebote je Händler / Region / Produktkategorie.
- 🟡 Danach: Kundenvorteile und Reward-Stufen sichtbar mit konkreten Einlösungen.
- 🟡 Separat weiter offen: **Telegram-Alarm als Monitoring-Backup** nur wenn wieder gewünscht.

## Status nach Charge-App MVP — 29.07.2026
- ✅ Neue **BidBlitz Charge Kunden-App** unter **`/charge-app`** ist live.
- ✅ Kunden können jetzt **Garantie registrieren**, **Rechnungen speichern**, **Punkte sehen/sammeln**, **Angebote erhalten** und **Händler finden**.
- ✅ Verifiziert mit Browser-Smoke und **Testing Agent Iteration 301 PASS**.
- 🔴 Nächster sinnvoller Charge-Schritt: **Datei-Uploads für Rechnungen/Garantiebelege** plus echter digitaler Garantiepass für Kunden.
- 🟡 Danach: Händlerdetailseite / Händlerprofil aus dem Charge-Finder heraus.
- 🟡 Danach: Reward-Stufen, personalisierte Charge-Angebote und Conversion-optimierte Vorteilskommunikation.
- 🟡 Separat weiter offen: **Telegram-Alarm als Monitoring-Backup** nur wenn wieder gewünscht.

## Status nach Admin-Error-Fix — 24.07.2026
- ✅ Händlerportal V1.5: Werbematerial-Downloads, Materialanfragen und Garantie-Status-Aktionen sind live.
- ✅ Händlerportal V1 für **BidBlitz Charge** steht: Lagerbestand, Nachbestellung, Rechnungen, Werbematerial und Garantieabwicklung sind im Händler-Login verfügbar.
- ✅ Build-Frontend-Deploy-Fehler durch zu groben `localhost`-Guard im Workflow behoben.
- ✅ IONOS-Deploy-Workflow gegen SSH-Secret-Mismatch gehärtet (`VPS_PASSWORD` oder `VPS_SSH_KEY`).
- ✅ Die bekannten Startseiten-404s auf Ads/Home-Recommendations/AI-Recommendations sind behoben; Router nun korrekt registriert.
- ✅ GitHub-IonOS-Deploy-Workflow auf stabile npm-Workspace-Kette umgestellt; akuter Build/Lint-Fehlerpfad beseitigt.
- ✅ Die aktuelle Nutzer-Meldung **„Fehler“** wurde auf zwei echte Admin-Frontend-Crashes zurückgeführt und behoben.
- ✅ `/admin/analytics` rendert wieder mit belastbaren Live-Kennzahlen statt mit `undefined.total` zu crashen.
- ✅ `/admin/merchants` rendert wieder Händlerkarten statt mit `undefined.toLowerCase` bzw. Lade-Loop hängen zu bleiben.
- ✅ Verifiziert mit Frontend-Smoke, Frontend-Testing-Agent PASS und Backend-Regression-Check PASS.
- 🔴 Nächster Produktpunkt bleibt: **Telegram-Alarm als Monitoring-Backup**.
- 🟡 Nächster sinnvoller Ausbau für das Händlerportal: Datei-Uploads für Garantiebelege/Bilder, echte Packaging-Mockups und dedizierter Händler-Login-Rollout für nicht-admin Testkonten.

## Status nach kompletter KYC-Deaktivierung im Testbuild — 24.07.2026
- ✅ KYC ist im **aktuellen Testbuild vollständig deaktiviert**: keine KYC-Karte, keine KYC-Buttons, keine KYC-Redirects, keine KYC-Routen-Blocks.
- ✅ Reviewer-Testnutzer hat Full Access auf Home, Wallet und offene Service-Navigation ohne KYC-Sperren.
- ✅ Root-iOS-Bundle neu gebaut und **Testing Agent Iteration 298 PASS**.
- 🔴 Weiter offen: echter GitHub-Push auf `main` und physischer Xcode-/iPhone-Test des neuesten lokalen iOS-Bundles.

## Status nach iOS-KYC-RCA — 24.07.2026
- ✅ Root Cause der falschen iOS-Testansicht bestätigt: **stale lokales iOS-Bundle**, nicht falscher Remote-Host.
- ✅ KYC-Sperrkarte aus `HomePage.jsx` und Route-Guard aus `App.js` / `pathUtils.js` hängen jetzt an den echten Testbuild-Flags statt an impliziten Nebeneffekten.
- ✅ Root-iOS-Bundle **`/app/ios/App/App/public`** neu aufgebaut und mit aktuellem Build synchronisiert.
- ✅ Admin-Debug-Zeile für Build-/Flag-/Asset-Quelle ergänzt.
- ✅ **Testing Agent Iteration 297 PASS**.
- 🔴 Weiter offen: echter GitHub-Push/Run auf `main` und physischer Xcode-/iPhone-Buildtest durch den Nutzer.
- 🟡 Danach: Telegram-Alarm als Monitoring-Backup.

## Status nach CI-Fix & iOS-Testmodus-Polish — 24.07.2026
- ✅ Gemeldeter CI-Fehler behoben: `.github/workflows/ci.yml` nutzt jetzt **npm** statt Yarn und der ESLint-Schritt verwendet einen funktionierenden Workspace-Befehl.
- ✅ iOS-/Test-App-Verhalten wieder auf normalen BidBlitz-Start zurückgeführt: **kein** Live-Check-Banner, **keine** sichtbaren KYC-Gates auf Home/More/Wallet für den Reviewer-Testnutzer.
- ✅ iOS-Build-Skripte übernehmen jetzt zusätzlich `REACT_APP_DISABLE_KYC` und `REACT_APP_SHOW_LIVE_CHECK_BANNER`, damit der Testzustand im nativen Build nicht verloren geht.
- ✅ Verifiziert mit **Testing Agent Iteration 296 PASS**.
- 🔴 Weiter offen: echter GitHub-Run und danach Preview-vs-Production-Parität auf `bidblitz.ae`.
- 🟡 Danach: **Telegram-Alarm als Monitoring-Backup**.
- 🟡 Danach: ESLint-Warnungen gezielt abbauen (aktuell viele Alt-Warnungen, aber keine blockierenden Errors).

## Status nach Root-Exportprojekt — 24.07.2026
- ✅ Vollständiges Download-Projekt **`BidBlitz/`** gebaut und als **`/app/BidBlitz.zip`** verpackt.
- ✅ Root-Struktur mit `package.json`, `package-lock.json`, `capacitor.config.ts`, `src`, `public`, `ios`, `backend`, `README.md`, `.env.example` vorhanden.
- ✅ Verifiziert: `npm install`, `npm run build`, `npx cap sync ios`, `npx cap open ios`, Workspace vorhanden, `import Capacitor` vorhanden, Bundle ID `com.bidblitz.app`.
- ⚠️ Echter Xcode-/iOS-Build bleibt **nur auf macOS mit Xcode + CocoaPods** final testbar.
- 🔴 Weiter offen nach Nutzerstart: echter Live-Deploy-Run und danach Preview-vs-Production-Parität.

## Status nach Admin-Nachupload & Live-Warnung — 23.07.2026
- ✅ Admin kann jetzt **KYC-Notizen schreiben** und gezielt **Nachupload** anfordern.
- ✅ Kunde sieht die **Admin-Hinweise** direkt im KYC-Status und in der Verification-Seite.
- ✅ Vor dem Absenden erscheinen jetzt **Live-Bildwarnungen** bei dunklen oder niedrig aufgelösten Uploads.
- ✅ Verifiziert mit **Testing Agent Iteration 292 PASS**.
- 🔴 Live-Deploy auf `bidblitz.ae` bleibt weiterhin der nächste offene Schritt und braucht den echten GitHub-Run.

## Status nach KYC-Feedback-Ausbau — 23.07.2026
- ✅ KYC zeigt jetzt **konkrete Fehlertexte** für Kunden statt generischem Fehlschlag.
- ✅ Nach **2 Fehlversuchen** erscheint der Button **„Manuelle Prüfung anfordern“**.
- ✅ Admin-KYC-Liste zeigt jetzt **Fehlversuche**, **konkrete Problemtexte** und **Freischalten / Ablehnen** direkt im Panel.
- ✅ Verifiziert mit Backend-Selbsttest + **Testing Agent Iteration 289 PASS**.
- 🔴 Nächster Schritt bleibt: echter GitHub-Deploy auf Live und danach Preview-vs-Production-Parität erneut prüfen.
- 🟡 Danach: **Telegram-Alarm als Monitoring-Backup**.

## Status nach GitHub-Deploy-Workflow-Fix — 22.07.2026
- ✅ Gemeldeter GitHub-Fehler **`.github/workflows/deploy.yml: No jobs were run`** ist behoben.
- ✅ `deploy.yml` triggert jetzt auf **alle Pushes**; Branch-Runs machen automatisch **Preflight only** (Build + ESLint + Backend-Smoke), während **`main`** und **`workflow_dispatch`** weiterhin den echten Live-Deploy-Pfad nutzen.
- ✅ Verifiziert mit YAML-Check, Preview-Smoke und **Testing Agent Iteration 288 PASS**.
- 🔴 Nächster echter Schritt bleibt: erfolgreichen GitHub-Deploy auf Live ausführen und danach `https://bidblitz.ae/api/system/version` plus Preview-vs-Production-Parität erneut prüfen.
- 🟡 Danach den nächsten Produktpunkt **Telegram-Alarm als Monitoring-Backup** umsetzen.

## Status nach Audi-Ticketverkauf — 18.07.2026
- 🔴 Production-Deployment-Blocker offen: Live ist weiterhin nicht auf dem freigegebenen Preview-Commit. Nächster realer Schritt ist der echte GitHub/VPS-Deploy mit anschließendem Re-Check von `/api/system/version`, neuem Update-Banner und entferntem AI-FAB.
- 🟡 Danach sofort Live-Visual-Compare erneut ausführen, bis Preview und Production identisch sind.
- ✅ Finaler Produktions-Startup-Timing-Fix verifiziert; **Testing Agent Iteration 281 PASS**. Danach erneuter Live-Deploy nötig.
- ✅ Produktions-Readiness-Fix für Backend verifiziert; **Testing Agent Iteration 280 PASS**. Neuer Redeploy nötig, damit Live den Fix übernimmt.
- ✅ Guest-/Landing-Mobile-Polish verifiziert; **Testing Agent Iteration 279 PASS**.
- ✅ Chatbot-Dateien physisch gelöscht und restlos bereinigt; **Testing Agent Iteration 278 PASS**.
- ✅ AI-/Landing-/Floating-Chatbots komplett aus dem Rendering entfernt; **Testing Agent Iteration 276 PASS**.
- ✅ Backend-Readiness für Live-Deploy verbessert: `/health` kommt jetzt früh zurück, schwere Initialisierung läuft im Hintergrund mit Worker-Lock.
- ✅ iPhone-UI-Polish für Header + Bottom-Nav verifiziert; **Testing Agent Iteration 275 PASS**.
- ✅ Floating AI-/Chat-Button im Testbetrieb entfernt; **Testing Agent Iteration 270 PASS**.
- ✅ Finaler KYC-Gate-Fix verifiziert: Home/More lesen jetzt zusätzlich die echte `/api/kyc/status`-Freigabe via `useEffectiveKycAccess`, damit stale lokale User-State-Reste keine Pre-KYC-Karten mehr anzeigen; **Testing Agent Iteration 269 PASS**.
- ✅ Zentraler **TEST_MODE** ist aktiv und verifiziert: alle KYC-Banner, Gates, Redirects und Restriktionen bleiben im Testbetrieb verborgen; Reviewer wird als verifiziert behandelt; **Testing Agent Iteration 264 PASS**.
- ✅ Dashboard-Karte **„Zugriff bewusst reduziert“** ist im Testbetrieb entfernt, ohne den KYC-Codepfad zu löschen.
- ✅ Build-Smokes unter Testmodus erfolgreich: `yarn build`, `yarn ios:diagnose`, `npx cap sync android`.
- ✅ Wallet-Mobilbug gefixt: die Karten **Kasse/Händler**, **Privat empfangen** und **Privat senden** sind auf iPhone-/Mobile-Viewport wieder direkt tappbar; **Testing Agent Iteration 263 PASS**.
- ✅ iOS-CoreData-Launch-Härtung erweitert: zusätzliche **`[CoreDataFix]`**-Pfad-/State-Logs plus frühes Directory-Prepare in `AppDelegate.swift`; `yarn ios:diagnose` erfolgreich.
- ✅ **KYC temporär ausgeschaltet für Tests**: `REACT_APP_DISABLE_KYC=true` aktiv; keine Banner, Gates oder Redirects mehr; **Testing Agent Iteration 262 PASS**.
- ✅ **Audi-Ticketverkauf** auf der Webseite ist jetzt live unter **`/audi-tickets`**.
- ✅ Zahlung läuft wie vom Nutzer gewünscht **direkt über das BidBlitz Wallet** statt über Stripe/externe Checkout-Seiten.
- ✅ Nutzerflow fertig: öffentliche Eventseite, Tickettypen, Verfügbarkeit, Wallet-Kauf, digitale Ticketcodes, persönliche Bestellliste.
- ✅ Adminflow fertig: Dashboard-Daten + **Check-in** für gültige Ticketcodes.
- ✅ Verifikation grün: Self-Test PASS und **Testing Agent Iteration 259 PASS**.
- ✅ ReceiveMoney-QR-Bug zusätzlich auf **iPhone-Build-Ebene** abgesichert: aktuelles iOS-Bundle enthält jetzt Preview-Backend-URL + QR-Render-Fallback; **Testing Agent Iteration 260 PASS**.
- ✅ iPhone-Home-UX aus Nutzer-Video bereinigt: Cookie-Banner nicht mehr über Bottom-Nav bei Auth-Usern, AI-FAB auf Kernrouten entfernt, Bottom-Nav dynamisch an Browser-Bottom angepasst, Mobile-Home kompakter; **Testing Agent Iteration 261 PASS**.
- 🟡 Nächster Produkt-Schritt: **Telegram-Alarm als Backup** für Monitoring ergänzen.
- 🟡 Danach optional: echter iPhone/Xcode-Lauf mit den neuen **`[CoreDataFix]`**- / **`[CoreDataTrace]`**-Logs prüfen, sobald der Nutzer den Log liefert.
- 🟡 Parallel offen für User-Verifikation: echter iPhone/Xcode-Test für den nativen Inline-Scanner-Pfad und den CoreData-/SwiftData-Laufzeitpfad; dabei jetzt gezielt auf **`[CoreDataFix]`**, **`[CoreDataTrace]`** und **`[HealthDebug]`** achten.

## Status nach Inline-Scanner-Umstellung — 18.07.2026
- ✅ „Empfänger-Code scannen“ läuft jetzt direkt **inline in der Seite** statt in einem separaten Scanner-Sheet.
- ✅ Native iOS-/Capacitor-Integration ergänzt: **`@capgo/camera-preview`** für eingebettete Live-Vorschau + Barcode-Events und **`capacitor-native-settings`** für den Settings-Pfad bei verweigerter Kamera-Berechtigung.
- ✅ `npm run build` und `npx cap sync ios` erfolgreich; **Testing Agent Iteration 258 PASS**.
- 🟡 Offener letzter Realwelt-Schritt: echter iPhone-/Xcode-Kameratest gegen den neuen nativen Pfad, weil der Linux-Container keine physische iOS-Kamera ausführen kann.
- 🟡 Danach zurück auf Produkt-Roadmap: Audi-Ticketverkauf und Telegram-Monitoring-Backup.

## Status nach ReceiveMoney-QR-Fix — 18.07.2026
- ✅ Der QR-Code auf **Empfangen → Mein QR-Code** rendert wieder stabil, auch nach dem iOS-Startup-Fix.
- ✅ Pflichtdatenpfad vereinheitlicht: `userId`, `walletId`, `token`, `bidblitzId`, `name` fließen jetzt sauber in einen JSON-String-Payload für `QRCodeSVG`.
- ✅ Die rohe Browsermeldung **`The string did not match the expected pattern.`** wird dem Nutzer nicht mehr angezeigt; stattdessen existiert eine kontrollierte deutsche Fallback-Meldung.
- ✅ `npm run build` und `npx cap sync ios` wurden ausgeführt; **Testing Agent Iteration 257 PASS**.
- 🟡 Nächster Schritt bleibt: nativen Xcode-/iPhone-Run gegen den aktuellen Stand prüfen, danach wieder zurück zu **Audi-Ticketverkauf** und **Telegram-Monitoring-Backup**.

## Status nach iOS Startup-Crash Fix — 18.07.2026
- ✅ React-Fehlergrenze jetzt aussagekräftig: Frontend-Errors loggen **`message`**, **`stack`**, **`component_stack`** und strukturierte Metadaten statt leerem `{}`.
- ✅ Der iOS-Startup-Crash im Lazy-Chunk wurde auf den **Wallet-Chunk** eingegrenzt und mit Browser-/Runtime-Guards in Wallet, TopUpModal, WalletSecurityCards und Wallet-Hooks entschärft.
- ✅ Testing Agent **Iteration 256 PASS**: Stripe-Return-Pfad, direkte `/wallet`-Route, iPhone-Viewport und authentifizierte Wallet-Ansicht rendern ohne Blank Screen oder sichtbare Error Boundary.
- 🟡 Nächster sinnvoller Schritt: User/Xcode-Gerätetest gegen den nativen iOS-Build, damit wir sehen, ob nach dem JS-Fix noch ein neuer echter Device-Fehler übrig bleibt.
- 🟡 Danach wieder in die Produkt-Roadmap zurück: **Audi-Ticketverkauf auf der Webseite** und **Telegram-Alarm als Monitoring-Backup**.

## Status nach Auktionsdetail-Fix — 16.07.2026
- ✅ Bug 1 behoben: Auktionsbilder passen wieder zum Artikeltyp.
- ✅ Bug 2 behoben: Countdown / verbleibende Zeit funktioniert wieder korrekt in Detail- und Grid-Ansicht.
- ✅ Testing Agent **Iteration 251 PASS** (100% Frontend für diese beiden Bugs).
- ✅ Danach zusätzlich verfeinert: Beschreibung aufgeräumt und modellgenaue Bilder für zentrale Smartphone-/Laptop-Auktionen. **Iteration 253 PASS**.
- ✅ Danach nochmals tiefer korrigiert: **Samsung/iPhone-Galerie-Reihenfolge** getrennt und per **Iteration 254 PASS** final verifiziert.
- ⚠️ Einziger nicht-blockierender Hinweis im Test: Cookie-Banner überlagert unten rechts etwas Fläche.
- 🟡 Nächster sinnvoller Schritt: Falls gewünscht, kann die Auktionsgalerie noch mit **echten produktspezifischen Mehrfachbildern** statt teilweise identischen Gallery-URLs verbessert werden.

## Status nach Schwimmbad-System MVP — 15.07.2026
- ✅ Neues Modul **Schwimmbad-System** live: öffentliche Pool-Seite `/pool` + Betreiber-Dashboard `/admin/pool`.
- ✅ Kernflows im MVP fertig: Tickets/Tarife, QR-/RFID-Readiness, Spind-Zuordnung, Drehkreuz-/Einlasslogik, Snack-POS, Kassenverkauf, Online-Checkout-Vorbereitung via Stripe.
- ✅ Frontend-Testing Agent **PASS** (Iteration 250) und Backend-Smoke grün.
- ✅ Hardware-Architektur jetzt fachlich definiert: RFID/NFC + QR, HTTP/TCP/Serial Turnstiles, Netzwerk-API + Relay für Locker, plus Betriebsmodelle Cloud / Edge / Hybrid.
- ⚠️ Reale Hersteller-/SDK-Integration bleibt weiterhin **MOCKED** bis konkrete Vendoren/Controller gewählt sind.
- ⚠️ Wegen Container-Speichergrenzen läuft das MVP hier mit kleiner Lockerkapazität (**8 Lockers**); fachlich ist die Struktur aber skalierbar angelegt.
- 🟡 Nächster sinnvoller Schritt: konkrete Hersteller/Controller pro Bereich festlegen und daraus echte Adapter/Edge-Daemon-Verträge ableiten.

## Status nach RTK-Installation — 15.07.2026
- ✅ RTK CLI Proxy **v0.43.0** ist im aktuellen **aarch64-Kubernetes-Container** installiert und lauffähig.
- ✅ Globaler Hook-Only-Mode für Claude-Code-artige Bash-Rewrites ist aktiv (`rtk hook claude` in `~/.claude/settings.json`).
- ✅ Telemetry ist deaktiviert; erste Bash-Verifikation mit `rtk git status`, `rtk ls /app` und `rtk gain` erfolgreich.
- ⚠️ Wichtige technische Notiz: Das offizielle ARM64-Release-Binary war in diesem Container wegen **GLIBC_2.39** inkompatibel; funktionierende Lösung in diesem Fork ist daher **lokaler Build aus dem offiziellen Tag `v0.43.0`** statt direkter Release-Extraktion.
- ✅ RTK wurde danach zusätzlich **ausgewogen konfiguriert** (`include_commands` + `exclude_commands`) und auf weitere Agent-Ziele im Container ausgerollt: **Codex, Gemini CLI, Hermes, Cursor**.
- ✅ Danach wurde zusätzlich eine echte **Admin-/Debug-Ansicht für RTK-Status/Savings** gebaut: `/admin/rtk` mit Live-Daten aus `/api/diag/rtk`.
- ✅ Danach wurden auch **projektspezifische `.rtk/filters.toml`-Filter** für dieses Repo ergänzt und im Admin-Dashboard sichtbar gemacht.
- ✅ Danach wurden auch echte **RTK-Admin-Aktionen** eingebaut: Trust, Telemetry-Forget und Agent-Reapply direkt aus `/admin/rtk`.
- ✅ Danach wurde auch **„Rewrite-Test neu ausführen“** als vierte RTK-Admin-Aktion ergänzt.
- ✅ Danach wurde auch eine echte **RTK-Event-History** für die letzten Admin-Aktionen ergänzt.
- ✅ Danach wurde auch **Project Filter Diff / Validation** mit Baseline-Speicherung ergänzt.
- 🟡 Nächster sinnvoller Schritt: Falls gewünscht, noch History-Funktionen wie **Export / Clear / Filter nach Aktionstyp** ergänzen oder die RTK-Seite um Auto-Refresh erweitern.

## Status nach Admin-Kundendaten-Mix-Fix — 11.07.2026
- ✅ Admin-Datenmix bei `admin@bidblitz.ae` bereinigt.
- ✅ Balance blieb korrekt; jetzt sind auch **Registrierungsdatum, letzte Anmeldung und Login-Zähler** überall kanonisch.
- ✅ Testing Agent Iteration 239 PASS.

## Status nach Admin-KI-Assistent — 11.07.2026
- ✅ Neuer **Admin KI-Assistent** live unter `/admin/ai-assistant`.
- ✅ Versteht freie deutsche Befehle für Admin-Aufgaben und zeigt **immer zuerst einen Vorschlag**.
- ✅ Erste Aktionen live: neue Auktionen anlegen, Auktionen ersetzen, Standard-Katalog wiederherstellen, Plattform-Checks anstoßen, Passwort-Reset, Wallet-Gutschrift/Abzug, Lead-Status-Änderung sowie Fehler-/Login-Berichte.
- 🟡 Nächster sinnvoller Ausbau: komplette Mining-CRM-Aktionen, Monitoring-Alerts mit Telegram/E-Mail, noch tiefere Kunden-Listenfilter und automatische Tagesreports für Armend.

## Status nach Admin-Fehlerzentrale — 11.07.2026
- ✅ Admin-Monitoring zeigt jetzt nicht nur Server-Health, sondern auch eine echte **Fehlerzentrale** für kaputte Kernbereiche.
- ✅ Live-Probes für **Webseite**, **Login**, **Registrierung** und **Auktionen** eingebaut.
- ✅ Frontend-Fehler laufen nicht mehr ins Leere (`/api/monitoring/log-error` war vorher 404), sondern werden jetzt gespeichert und in der Fehlerzentrale sichtbar.
- ✅ E-Mail-Alarmierung per Resend technisch angeschlossen.
- 🟡 Blocker: Resend-Domain `bidblitz.ae` muss im Resend-Account verifiziert werden, sonst werden Live-Mails abgelehnt.

## Status nach Penny Auctions Premium-Tech-Reset — 11.07.2026
- ✅ Penny Auctions komplett erneuert: aktiver Katalog enthält jetzt **exakt 30 neue Premium-Tech-Auktionen** statt alter Demo-Produkte.
- ✅ Alle 30 Auktionen erfüllen den neuen Produktvertrag: **2026-Modelle**, **UVP > 1000€**, **Startpreis 0,01€**, **7 Tage Laufzeit**, **2–4 Bilder** und aggressive Bot-Konfiguration.
- ✅ `/auctions` ist in der Preview wieder direkt testbar; Store-Safe-Blocking greift dort nicht mehr, bleibt aber für echte Store-Builds erhalten.
- ✅ Galerie im Auktionsdetail live: Nutzer sehen Thumbnails und können zwischen Produktbildern wechseln.
- 🟡 Nächster sinnvoller Auktions-Schritt: echte Merchandising-/Conversion-Layer ergänzen — z. B. "Top Deals", "Fast Ending", Gewinner-Highlights oder sekundäre Premium-Pricing-Experimente für Credits.

## Status nach Dating Safety Pro + Real Premium Checkout — 10.07.2026
- ✅ Mining Revenue Conversion Block live: Ansprechpartner, Zielgruppen-Segmentierung und Angebotskarten leiten Nutzer jetzt direkt in passende Mining-Anfragen.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Kontaktziele (WhatsApp/Telegram/Telefon), feste Ansprechpartnerdaten und Response-SLA mit echtem Team-Branding.
- ✅ Mining Trust Quick Contact + FAQ live: 1-Klick-Kontakt und häufige Fragen sind jetzt direkt auf der Seite integriert.
- 🟡 Nächster sinnvoller Mining-Schritt: echte WhatsApp-/Telegram-Ziele, Rückruf-Workflow und noch stärkere Conversion-Bausteine wie feste Ansprechpartner oder Response-SLA.
- ✅ Mining Trust Lead Form vereinfacht: Schnell-Auswahl, optionale Firma und minimaler Submit mit Name + E-Mail funktionieren.
- 🟡 Nächster sinnvoller Mining-Schritt: noch mehr Conversion mit WhatsApp-/Telegram-Schnellanfrage oder 1-Klick-Kontaktmodulen für Kunden.
- ✅ Mining Trust Admin CRM + Video Slots live: Leads können verwaltet und Dubai-/Abu-Dhabi-Videos direkt gepflegt werden.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Rollen-/Dashboard-Auswertung für Mining-Leads (Neu/Kontaktiert/Qualified), plus Medien-Uploads statt nur URL-basierter Verwaltung.
- ✅ Mining Trust Public API + Lead Capture live: `/mining-trust` liefert jetzt öffentliche Proof-Daten und nimmt Leads direkt an.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Video-Uploads/Einbindung für Dubai & Abu Dhabi sowie Admin-/CRM-Ansicht für eingehende Mining-Leads.
- ✅ Mining Trust Investor-Version live: Live-Kennzahlen, Standortkarte und Proof-of-Infrastructure-Timeline sind ergänzt.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Nutzer-Videos/Fotos und echte Live-Daten statt Platzhalterwerte einbinden.
- ✅ Mining Trust Page live: separate Proof-Seite für Bitcoin-Mining-Infrastruktur mit Dubai-/Abu-Dhabi-Fokus, ASIC-Fotos und Video-Platzhaltern.
- 🟡 Nächster sinnvoller Mining-Schritt: echte Nutzer-Fotos/Videos ersetzen die AI-Platzhalter und optional Live-Metriken (Hashrate/Uptime/Standortstatus) ergänzen.
- ✅ Segment-/Preisexperimente live: Starter-Deals, Bundle-Angebote und Paywall-Kombinationen variieren jetzt deterministisch pro Nutzersegment.
- ✅ Dynamische Monetarisierung live: Hero, Plan-Highlight und limitierte Bundles passen sich an Experimente an.
- 🟡 Nächster sinnvoller Dating-Schritt: echte Conversion-Messung/Auswertung (Impressions → Checkout → Paid) je Experiment-Variante, damit wir Gewinner automatisch hochziehen können.
- ✅ Roses / Priority Inbox live: Standouts haben jetzt direkte Rose-Kaufhebel und Priority Inbox-Metadaten.
- ✅ Top Picks tägliche Rotation live: tägliche, stabile Rotation pro Nutzer/Tag ist vorbereitet und im UI sichtbar.
- 🟡 Nächster sinnvoller Dating-Schritt: echte Segment-/Preisexperimente, z. B. Starter-Offer-Varianten, unterschiedliche Paywall-Kombinationen oder zeitlich limitierte Rose-Bundles.
- ✅ Top Picks / Standouts live: kuratierte Discovery-Flächen für Gold/Platinum-Upsell sind eingebaut.
- ✅ Platinum Message-before-match live: erste Nachricht kann schon beim Like gesendet werden.
- 🟡 Nächster sinnvoller Dating-Schritt: echte **Top Picks Rotation** mit täglichen Refreshes, Standouts mit stärkerem Super-Like-Kaufdruck und eventuell **Roses / Priority Inbox** als nächster Umsatzhebel.
- ✅ Dating Monetization V1 live: Plus / Gold / Platinum, sichtbare Conversion-Flächen, Einzelkäufe für Boosts / Super Likes / Rewinds, Starter-Offer-Logik und echte Stripe-Checkout-Flows.
- ✅ Umsatz-Trigger eingebaut: Likes-You-Lock, stärkerer Paywall, Entitlements, Plan-Karten und Einzelkauf-Grid.
- 🟡 Nächster sinnvoller Dating-Schritt: noch stärkere Monetarisierung wie Message-before-match / Standouts / Top Picks oder dynamische Preis-/Abo-Experimente für Segmente.
- ✅ Dating P2 Safety Pro live: Scam-Signal-Erkennung im Profiltext, Nudity-Warnung/Fallback-Scan für Bilder, `safety_summary` auf Profil, Discover, Likes und Matches.
- ✅ Dating Discovery / Ranking Intelligence verbessert: `discover_rank` berücksichtigt jetzt Safety, Profil-Vervollständigung und Medienqualität (Voice/Video) zusätzlich zu Boost/Verifizierung.
- ✅ Dating Premium Hauptflow ist jetzt real: `GET /api/dating/premium/plans`, `POST /api/dating/premium/checkout`, `GET /api/dating/premium/status/{session_id}` arbeiten mit echtem Stripe Checkout und `payment_transactions`.
- ⚠️ `POST /api/dating/premium/demo-upgrade` bleibt weiterhin **MOCKED** nur für Backward Compatibility; Haupt-UI-Flow nutzt bereits den realen Checkout.
- 🟡 Nächster sinnvoller Dating-Schritt: Safety Pro weiter vertiefen (z. B. Chat-Scam-Signale / Inbox-Warnungen) oder Live-Dating / Events als nächster P2-Differenzierer.

## Status nach Dating Video-Profil — 10.07.2026
- ✅ Dating P2 Video-Profil live: Aufnahme, Upload, Playback und Löschen funktionieren; Video-Metadaten erscheinen in Profil, Discover, Likes und Matches.
- ✅ Dating P2 Voice Intro live.
- ✅ Dating P2 Nearby / Crossed Paths live.
- ✅ Safety Pro, Discovery / Ranking Intelligence und realer Premium-Checkout sind inzwischen umgesetzt.
- ⚠️ Dating Premium Demo-Endpoint bleibt zusätzlich **MOCKED** für Backward Compatibility.

## Status nach Dating Voice Intro — 10.07.2026
- ✅ Dating P2 Voice Intro live: Aufnahme, Upload, Playback und Löschen funktionieren; Voice-Metadaten erscheinen in Discover, Likes und Matches.
- ✅ Dating P2 Nearby / Crossed Paths bereits live und stabil.
- 🟡 Nächster sinnvoller Dating-Schritt: **Video-Profil** als nächster Medienbaustein oder **Safety Pro** (Scam Detection / Nudity Warning).
- ⚠️ Dating Premium Aktivierung bleibt weiterhin **MOCKED** über `/api/dating/premium/demo-upgrade`; echte Subscription-/Payment-Verknüpfung ist weiterhin offen.

## Status nach Dating Nearby / Crossed Paths — 10.07.2026
- ✅ Dating P2 Nearby live: Nutzer können Standort freigeben; Nearby-Profile werden mit `distance_km` ausgeliefert.
- ✅ Dating P2 Crossed Paths live: räumliche Begegnungen werden gespeichert und im Dating-UI angezeigt.
- ✅ Dating Setup-UX verbessert: Profil-Modal blockiert nicht mehr hart und kann per **„Später“** geschlossen werden.
- 🟡 Nächster sinnvoller Dating-Schritt: Voice Intro / Video-Profil oder Safety Pro (Scam Detection / Nudity Warning) als nächster Differenzierer.
- ⚠️ Dating Premium Aktivierung bleibt weiterhin **MOCKED** über `/api/dating/premium/demo-upgrade`; echte Subscription-/Payment-Verknüpfung ist weiterhin offen.

## Status nach Dating Boost + AI Helpers — 10.07.2026
- ✅ Dating P1 Boost/Spotlight live: Premium-Nutzer können Boost aktivieren; Discover priorisiert geboostete Profile serverseitig und liefert `boost`-/`spotlight`-Metadaten aus.
- ✅ Dating P2 Start live: AI Bio, AI Profil-Coach und AI Icebreakers funktionieren über echte Backend-Endpunkte mit `emergentintegrations`.
- ✅ Dating-Stabilität verbessert: Duplicate-Key-Race-Conditions beim Profil-/Seed-Like-Setup beseitigt; Testing-Agent Iteration 219 vollständig grün.
- 🟡 Nächster sinnvoller Schritt im Dating-Modul: UX-Feinschliff im Profil-Setup (z. B. `Skip for now` statt hartem Auto-Open) und danach P2-Ausbau Richtung Voice/Video oder Nearby/Crossed Paths.
- ⚠️ Premium-Aktivierung für Dating bleibt aktuell bewusst **MOCKED** über `/api/dating/premium/demo-upgrade`; echte Payment-/Subscription-Verknüpfung ist der nächste Monetization-Schritt.

## Status nach Frontend-i18n Final Cleanup — 09.07.2026
- ✅ Offene harte Texte in Wallet-Filtern, KYC-Banner, User Stats, Monitoring, Leaderboard/ExtraFeatures und Restaurant Tables Admin bereinigt.
- ✅ Gemeinsame i18n-Keys für **DE / EN / SQ / AR** ergänzt; Albanisch-Modus per Smoke-Test und Frontend-Testagent geprüft.
- 🟡 Nächster sinnvoller Schritt: projektweiter Rest-Audit auf tiefer liegende Seiten/Legacy-Flows außerhalb der zuletzt bearbeiteten Kernbereiche.
- 🔴 Android-AAB-Build bleibt im aktuellen ARM64-Container durch AAPT2-Inkompatibilität blockiert; kein finales `.aab` aus diesem Container.

## Status nach Mobile Store Prep + Production Audit — 09.07.2026
- ✅ Huawei AppGallery / Samsung Galaxy Store / Apple App Store Connect Copy-Paste-Pakete vorbereitet.
- ✅ iOS Permission-Texte review-sicher aktualisiert; Android Package-/Version-Metadaten auf `com.bidblitz.app` / Version `1.0.0` / Build `3` ausgerichtet.
- ✅ Reviewer-Flow, Legal-Seiten und Store-safe UI erneut geprüft; reviewer-sichtbare Auktions-Texte aus More/KYC-Hinweisen entfernt.
- 🔴 Public/Store Launch weiter blockiert durch Wallet P0, fehlenden produktionsreifen Health-Endpoint und ungeklärte Produktions-DB-Konfiguration (`DB_NAME="test_database"`).
- 🔴 Android-Alt-Store-Export im Container weiter blockiert durch fehlenden Android-SDK-Pfad und fehlenden Release-Keystore.

## Status nach Admin Customer Intelligence — 01.07.2026
- ✅ 06.07.2026 Commerce Center V1 vertieft: Analytics, Programmplanung und Performance Board live; Event-Tracking und CTA-Flows per Testing-Agent verifiziert.
- ✅ 06.07.2026 P1 Mobility-Ausbau abgeschlossen: E‑Bike und Carsharing in Mobility Center + Mobility Map integriert, 6‑Wege Vergleich aktiv und per Testing-Agent verifiziert.
- ✅ 06.07.2026 P0 Stabilitätsschritt abgeschlossen: großer Frontend-Router entschlackt (`App.js` in Hilfsmodule zerlegt) und per Testing-Agent Iteration 195 ohne Regressionen verifiziert.
- ✅ 06.07.2026 Taxi P0 geschlossen: Uber-like Live-Autocomplete ab 1 Buchstaben, Kosovo-Tarif `2€ Start + Kilometer`, Admin-Seed-Startup wieder idempotent aktiv.
- ✅ 06.07.2026 Taxi P1 vertieft: persönliche Trefferquellen vor Live-Geocode, Quellen-Badges, Kosovo-Stadtprofile Prishtina/Prizren/Peja.
- ✅ 06.07.2026 Taxi Airport-Festpreis ergänzt: Flughafen Kosovo/PRN ↔ Prishtina mit 15€/20€/24€ und sauberem Festpreis-Breakdown; Gast-Console-Taxi-Noise reduziert und Public Feature Flags restored.
- ✅ 06.07.2026 Admin-Kanonisierung: `admin@bidblitz.ae` ist einziger echter Admin; `admin@bidblitz.com` ist deaktiviert; `.ae` Admin bleibt vollständig freigeschaltet.
- ✅ 06.07.2026 Admin Merchant Controls: Händler-Feature-Freischaltung, individuelle Modulpreise, Händlerbearbeitung, Zahlstatus und Blockieren/Freigeben bei Nichtzahlung live.
- ✅ 06.07.2026 Admin Provisioning API: Händler/Gastro/Kiosk per API oder Dropdown freischalten, Bundlepreise setzen und POS Public API-Key erzeugen; Kassen-/Gutschein-/Auflade-Flow dokumentiert.
- ✅ Admin sieht jetzt Sekunden-/Bid-Credit-Käufe, Käufer, Commerce/POS-Käufe, Standortsignale, Shop-Matches und Jahresanalyse.
- ✅ Customer Live Radar ergänzt: Radar-Alerts, Segmente, Heatmap-Zellen und Privacy Guard.
- ✅ Radar Actions ergänzt: Coupon, Push, Manager-Alert und Auto-Aktion direkt aus Admin-Radar-Alerts.
- ✅ Kampagnen-Templates, Erfolgsmessung und Customer-Radar-Action-Historie/Timeline ergänzt.
- ✅ Radar Automation Rule Center ergänzt: Regeln speichern, simulieren und ausführen; Daily Cap, Trigger Type, Cooldown und positive VIP-Ausführung verifiziert.
- ✅ Radar Scheduler + Performance ergänzt: Scheduler-Config, manueller Tick, Background-Loop und Performance-Grid im Admin.
- ✅ Deployment-Hygiene/CORS-Härtung abgeschlossen: App-Level credentialed CORS, Production-Nginx CORS und Deployment-Agent PASS.
- ✅ Direkt-Routen verfügbar: `/admin/customer-intelligence` und `/admin/customer-map`.
- 🟡 Nächster sinnvoller Schritt: echte Geo-Kachelkarte mit Heatmap/Clustern und DSGVO-konformer Standort-Einwilligungs-/Retention-Policy.

## Status nach 01.07.2026
- ✅ P0 Staff-BioTime-Frontend: Check-in/Check-out via PalmPay für Mitarbeiter umgesetzt.
- ✅ P0 Executable Approval-Flows: Manual Wallet Adjustments und Customer Account Changes werden nach Manager-Freigabe direkt ausgeführt; Reject und Repeat-Block sind aktiv.
- 🔴 P0 verbleibend: Approval-Ausführung für weitere Sonderfälle vertiefen, falls neue Top-up-/Refund-Typen außerhalb der vorhandenen Execution-Pfade entstehen.
- ✅ P1: Commerce Center V1 — Marketplace, Live Shopping, Penny Auctions.
- ✅ P1: Mobility Center V1 — E-Scooter, E-Bike, Carsharing.
- ✅ P2: Externe Hardware-/Vendor-Diagnostics und restliches Game Center abgeschlossen.
- ✅ P2: Move & Earn AI Coach + GPS/Sensor-Scoring ausgebaut und verifiziert.
- ✅ P2: Move & Earn Admin-Analytics um ROI, Reward-Kosten nach Typ/Quelle/Segment und DAU/MAU vertieft.
- ✅ 07.07.2026 Move & Earn: native Schrittquellen (HealthKit / Health Connect) sauber über Capacitor angebunden; Web-Preview bleibt mit erklärtem Fallback stabil.
- ✅ 07.07.2026 Move & Earn ROI v2 mit echten Commerce-/Merchant-/POS-Conversions gekoppelt; Admin sieht jetzt attributed Orders, GMV, Platform Revenue, Conversion Rate, Cost per Conversion sowie Channel-/Attribution-Windows.
- ✅ 07.07.2026 Mobility: Premium Live-Tracking für Shuttle/VIP mit Approach-/Trip-Phase, Checkpoints, Shuttle-Stops und Map-Overlays erweitert.

## P0
- 🔴 Produktionsfreigabe-Audit offen: `/api/health` auf Produktion fehlt (404) und muss für Monitoring/Store-Verifikation sauber bereitgestellt werden.
- 🔴 Produktionsdatenbank-Kontrakt offen: `DB_NAME="test_database"` ist für Public-Launch/TestFlight/Internal-Testing nicht freigabefähig, solange nicht bestätigt ist, dass dies die echte produktive DB sein soll.
- 🔴 Wallet P0 bleibt aktiv bis die manuellen Repair-Aktionen für kritische Fälle sauber abgearbeitet sind: Reconciliation Center + Controlled Manual Repair sind live, jetzt fehlen die fachlichen Einzelentscheidungen pro kritischem Wallet.
- 🔴 Alt-Store-Mobile-Release bleibt blockiert, bis ein echter Android-SDK-Pfad und ein dauerhafter Release-Keystore im Build-Kontext vorhanden sind.
- 🔴 Finaler Google-Play-AAB-Build bleibt in diesem Container zusätzlich durch ARM64/AAPT2-Binary-Inkompatibilität blockiert; für den tatsächlichen Upload ist ein kompatibler x86_64-Build-Host oder ein funktionierender ARM64-AAPT2-Workaround nötig.
- 🔴 Wallet P0 bleibt aktiv bis die manuellen Repair-Aktionen für kritische Fälle sauber abgearbeitet sind: Reconciliation Center + Controlled Manual Repair sind live, jetzt fehlen die fachlichen Einzelentscheidungen pro kritischem Wallet.
- 🔴 Nach Manual Decisions Run 1 bleiben insbesondere diese Risikoklassen offen: Ledger-Rebuild-Fälle, Legacy-Wallets mit widersprüchlicher Historie und negative Delta-Fälle mit vorhandener `wallets.balance`-Abweichung.
- 🔴 Admin-/Alias-UI bleibt unter Beobachtung: weitere Listen außerhalb von Auth + Admin-Kundenliste bei Bedarf auf dieselbe kanonische Admin-Namenslogik umstellen.
- 🔴 KYC-Altstatus-Quellen außerhalb der Hauptkundenverwaltung bei Bedarf ebenfalls auf dieselbe Normalisierung angleichen (`verified` → `approved`, `failed/error` → `rejected`).
- 🔴 Falls weitere versteckte Admin-Altaccounts auftauchen, dieselbe Deaktivierungslogik konsequent anwenden statt neue Admin-Aliase wieder zuzulassen.
- 🔴 Offene Wallet-Härtung nach Phase 3: weitere historische EUR-Geldpfade außerhalb des Kern-Wallet-/POS-/Admin-Bereichs schrittweise auf zentrale Engine migrieren (z. B. Invoicing, Tips, Mobility, Stripe-Webhooks, Merchant/Restaurant/Taxi-Altpfade), ohne Bestandswerte blind anzupassen.
- 🔴 Store Launch bleibt blockiert, bis Reconciliation für Altbestände und restliche historische EUR-Pfade abgeschlossen sind.
- Frontend-Routing-Stabilität als Basis für nächste Ausbaustufe verbessert; weiterer Fokus jetzt auf P1-Feature-Ausbau statt monolithischer Routerpflege
- BioPay V4 weiter vertiefen: Staff-BioTime als vollständige operative Oberfläche, Admin-Audit-Drilldowns pro Merchant/Terminal und Ausreißer-Workflows
- POS Security V2 operativ abrunden: Manual Wallet Adjustment und Customer Account Change auch mit kompletter Ausführungs-UI statt nur Approval-Request/Queue ergänzen
- Merchant Platform V5: Omnichannel Commerce nach dem neuen Enterprise Dashboard als nächstes vertiefen — kanalübergreifender Bestand, Sync-Status, Order-Funnel und operative Automationen auf Basis der bestehenden POS-/Inventory-/Merchant-Module
- Merchant Platform V5: Executive AI nach Modul 1/2 weiter ausbauen — Drilldowns pro Filiale, recurring Briefings, Alert-Subscriptions und Automation-Vorschläge für Einkauf/Staffing
- Merchant Platform V5: Business Automation nach V1 weiter vertiefen — echte Auto-PO-Freigabeketten, Supplier-SLA-Eskalationen, Task-Zuweisung nach Rolle und Revenue-Playbooks mit messbarer Conversion
- Mobility Center V1 nach E‑Bike/Carsharing weiter vertiefen: Parking, Pendler-Abos, Fleet-Verfügbarkeit, Saved/Frequent Routes und Rebook-Intelligence enger im neuen Hub bündeln
- Smart Invoice Follow-up: Payment-Link Reminder-Kampagnen (Batch/Schedule), echte Webhook-Settlement-Härtung und öffentliche Payment-Seite um Success/Retry/Resume weiter vertiefen
- Frontend-ESLint-Warnings schrittweise abbauen, damit die Codebase nach dem CI-Fix nicht nur fehlerfrei, sondern langfristig wartbarer wird
- Game Center V1 nach dem neuen Hub um echte Season-Quests, XP-Claims und VIP-Perk-Aktivierungen vertiefen
- Taxi nach dem UX-Umbau weiter vertiefen: Live-Ride-Tracking, gespeicherte Adressen/Favoriten noch stärker in den neuen Kundenflow integrieren und Wallet/Apple-Pay-Checkout visuell weiter glätten
- Taxi nach dem UX-Umbau weiter vertiefen: echte Home/Work-Verwaltung, Favoriten-Speicherung aus der Suche, noch stärkeres Post-Booking-Live-Tracking und Checkout-Varianten (Wallet/Apple Pay) visuell weiter glätten
- CI-/Build-Härtung fortsetzen: historische Dependency-Pins weiter reduzieren und Integrations-abhängige Module langfristig sauberer von Core-/Smoke-Tests entkoppeln
- Taxi nächster Schritt: letzte Ziele noch stärker personalisieren, Fahrerkarte/Ankunfts-Tracking weiter glätten und gespeicherte Orte/Empfängerflows noch stärker in den Bestell-Button-Flow einbinden
- Taxi nächster Schritt: Search-to-Book noch direkter machen, weitere Kosovo-Airport-/City-Festpreise ergänzen und optional globale Guest-Auth-Checks leiser gestalten
- Mobility nächster Schritt: Tracking jetzt mit Rebook/Support/Push-Remindern verknüpfen und danach Commerce Center wieder priorisieren

## P1
- Monitoring/Operations: Telegram-Alarm als zusätzlicher Backup-Kanal für kritische Monitoring-Events jetzt als nächster Schritt umsetzen.
- Wallet/Reconciliation Admin Center vertiefen: Bulk-Filter, CSV-Export, Delta-Gruppierung, Referenzketten und sichere Einzelfall-Korrektur-Workflows mit Review-Step ergänzen.
- POS Security: Fraud Scoring weiter vertiefen (kassiererübergreifende Muster, Echtzeit-Suspicion-Score, Auto-Eskalation an Admin)
- BioPay: Staff-BioTime-Seite im Frontend, Check-in/out-Historie und Manager-Freigabe für Ausreißer ergänzen
- BioPay: FacePay hinter Feature-Flag mit Merchant-sichtbarer Readiness-Anzeige weiter zur produktionsreifen Aktivierung führen
- BioPay: Admin Audit Center um Filter, Export, Merchant-Drilldowns und Terminal-Warnworkflows erweitern
- Merchant Platform V5: Digital Signage + Smart Pricing auf dem neuen Enterprise-Datenmodell aufsetzen (Preisregeln, Promotion-Slots, Filialausspielung)
- Merchant Platform V5: Procurement AI auf dem Business-Automation-V1 aufsetzen (Forecast-basierte Mengen, Supplier-Vergleich, Genehmigungslogik, Inventory-Playbooks)
- Commerce: Live-Auctions-Seed/Programmplanung, Live-Produkt-Pinning und dedizierte Commerce-Analytics für Conversion, Flash-Sale-Umsatz und CTA-Klicks ergänzen
- Merchant Commerce: Bulk-Flash-Sale-Kampagnen, Scheduler und Performance-Rankings ergänzen
- Commerce nach V1 jetzt weiter vertiefen: Merchant-seitige Bulk-Flash-Sale-Kampagnen, Scheduler, Live-Produkt-Pinning und noch stärkere Conversion-Drilldowns
- Mobility: Compare-Flow nach dem neuen 6-Wege-Vergleich um Saved/Frequent Routes, One-Tap-Rebook, Parking und City-/Fleet-Kombinationen erweitern
- Game Center: Achievements-/Season-Daten stärker mit Rewards, Referral und VIP Drops koppeln
- Move & Earn: native Schrittquellen nach Geräteverifikation weiter vertiefen (z. B. Background-Refresh, feinere Distanz-/Source-Analyse, iOS-/Android-spezifische Messaging-UX)
- Move & Earn: Ride & Earn / Eco Rewards noch tiefer mit realen Scooter-/Bike-/Taxi-/EV-Events, Merchant-QR-Events und Referral-/Friends-Logik koppeln
- Move & Earn: Admin-Analytics um DAU/MAU, Reward-Kosten pro Typ, ROI und gesponserte Rewards ausbauen
- Move & Earn: Reward-Tickets auch für Spin Wheel / Mystery Boxes direkt im Reward Hub einlösbar machen
- Mobility: Stripe-Checkout zusätzlich per Webhook/Session-Resume noch robuster gegen abgebrochene Browser-Sessions machen
- Mobility: Tracking für Shuttle/VIP und weitere Transportarten mit echterer Live-Progression vertiefen
- Mobility: Tracking-Seite um echte Map-Animation und Fortschritts-Polylines weiter ausbauen
- Native NFC-Bridge nachreichen, sobald User-Lizenz vorliegt
- Reale USB-/Netzwerk-Drucker über Native-/Device-Bridge außerhalb Preview mit Hardware-Mapping verifizieren
- USB-Auto-Suche im nativen Drucker-Wizard auf echten Geräten verifizieren
- KYC-Flow später noch um bessere Upload-Fehlermeldungen und klare Status-Refresh-UX erweitern
- Floorplan-/Raumplan-Editor für Tische mit Mehrraum/Zoom/Snapping ausbauen

## P2
- ✅ Merchant Platform V5: Multi-Company Management, Document Center und Maintenance Tracker auf Basis der neuen Enterprise-Struktur ergänzt und per Testing-Agent verifiziert.
- ✅ Game Center: Arcade Hub mit Season-/All-Time-Leaderboards, Personal Best und Reward-/Session-KPIs live und verifiziert.
- ✅ BioPay Admin: Vendor Diagnostics, Warning Workflows und Terminal Readiness im Audit Center live und verifiziert.
- ✅ Move & Earn: AI Coach mit Coaching-Plänen sowie GPS-/Sensor-/Behavior-Scoring live und verifiziert
- Mobility: echte Live-Positionsupdates/Tracking für Shuttle, VIP und weitere Transportarten vertiefen
- Mobility: serverseitige Ranking-Heuristik für Autocomplete und Empfehlungslogik weiter schärfen
- Printer-Diagnose später um echte Live-Socket-Logs/Retry-Historie pro Gerät vertiefen
- Floorplan später um Mehrraum-Zonen, Rotation und freien Rechteck-/Polygon-Raumaufbau vertiefen