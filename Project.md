# Projektkonzept: ProjectDashboard

## 1. Zielbild

ProjectDashboard ist eine Electron-App, die pro Softwareprojekt ein zentrales Dashboard bereitstellt.  
Ziel ist es, häufige Entwicklungsaufgaben (Statuspruefung, Start/Stop lokaler Dienste, Git-Aktionen, Tool-Start) in einer einheitlichen Oberflaeche zu buendeln.

## 2. Problemstellung

Im Entwicklungsalltag sind Informationen und Aktionen auf viele Tools verteilt:

- Terminal fuer DDEV und Git
- Dateimanager und Editor fuer Navigation
- Browser fuer lokale URLs und Dokumentation
- Manuelle Checks fuer Ressourcen (z. B. Speicherplatz)

Das fuehrt zu Kontextwechseln, Zeitverlust und uneinheitlichen Projektablaeufen.

## 3. Zielgruppen

- **Projektmanager**: schneller Ueberblick je Projekt (Status, Health, Risiken)
- **Entwickler**: operative Steuerung (DDEV, Git, Tool-Launcher)
- **Technische Leitung**: standardisierte Projektkonfiguration und Team-Onboarding

## 4. Kernfunktionen (MVP)

### 4.1 Projektverwaltung

- Projekte sind nach **Kunde** und **Projektmanager** gruppiert.
- Jedes Projekt besitzt ein eigenes Dashboard mit konfigurierbaren Widgets.

### 4.2 Widgets

- **DDEV Widget**
  - Status anzeigen
  - Start/Stop/Restart ausfuehren
- **Projektstatistik Widget**
  - Speicherplatznutzung (Disk Usage)
  - Basisdiagramme (zunaechst lokal, ohne externe Telemetrie)
- **Git Widget**
  - Status anzeigen
  - Pull/Push ausfuehren
  - Optional: Branch-Info anzeigen
- **Programmstarter Widget**
  - Cursor
  - VS Code
  - File Explorer
  - Terminal
-- **ssh Widget**
  - multiple ssh connections with different usernames and passwords
- **Browser Widget**
  - Browser
  -- die urls sollen aus den konfigurationen der projekte kommen
  --- ddev/config.yaml
  --- typo3 unter config/sites/**/*.yaml

## 5. Nicht-funktionale Anforderungen

- **Plattform**: Linux (MVP), spaeter optional macOS/Windows
- **Performance**: Dashboard soll in < 2 Sekunden laden (ohne schwere Scans)
- **Sicherheit**: nur lokale Daten, keine Cloud-Pflicht
- **Stabilitaet**: fehlgeschlagene Shell-Kommandos werden sichtbar mit Fehlermeldung
- **Erweiterbarkeit**: Widgets modular, spaetere Plugin-Logik moeglich

## 6. Technisches Konzept

### 6.1 Technologie-Stack

- **Desktop App**: Electron
- **UI**: Web-Frontend innerhalb Electron (z. B. React/Vue, spaeter final entscheiden)
- **Systemintegration**: sichere Shell-Bridge ueber Electron Main Process

### 6.2 Architektur (high-level)

1. **Renderer (UI)** zeigt Dashboards und Widgets.
2. **Main Process** kapselt lokale Systembefehle (DDEV, Git, Toolstart).
3. **Config Service** laedt und validiert JSON-Konfiguration.
4. **Widget Layer** rendert Widgets anhand Konfiguration.

## 7. Konfiguration

Die Konfiguration liegt in der Homestruktur des Benutzers liegen.
Hier sind linux, macos und windows unterschiedlich.
Linux:
```
~/.config/dashboard/config.json
```
Macos:
```
~/.config/dashboard/config.json
```
Windows:
```
C:\Users\<username>\AppData\Roaming\dashboard\config.json
```

### 7.1 Beispielstruktur

```json
{
  "customers": [
    {
      "name": "Kunde A",
      "projects": [
        {
          "name": "Projekt X",
          "path": "/home/user/projects/projekt-x",
          "projectManager": "Max Mustermann",
          "widgets": {
            "ddev": true,
            "diskUsage": true,
            "git": true,
            "launcher": {
              "cursor": true,
              "vscode": true,
              "explorer": true,
              "terminal": true,
              "browser": true
            }
          }
        }
      ]
    }
  ]
}
```

## 8. UX- und Designleitlinien

- Klare Kartenstruktur pro Widget
- Einheitliche Action-Buttons (Start, Stop, Pull, Push)
- Statusfarben fuer schnelle Erkennung (gruen/gelb/rot)
- Design-Umsetzung ueber den MCP-Server **Stitch**

## 9. Roadmap

### Phase 1 (MVP)

- Projektliste und Dashboard-Navigation
- DDEV-, Git- und Launcher-Widget
- Konfigurationsdatei laden und validieren

### Phase 2

- Erweiterte Statistiken und Verlauf
- Bessere Fehlerdiagnose und Logs
- Import/Export der Konfiguration

### Phase 3

- Plugin-Schnittstelle fuer eigene Widgets

## 10. Risiken und Gegenmassnahmen

- **Shell-Kommandos verhalten sich je System unterschiedlich**  
  -> Kommandos kapseln und sauber validieren.
- **Ungueltige JSON-Konfiguration**  
  -> Schema-Validierung mit klaren Fehlermeldungen.
- **Zu viele Widgets ueberladen die UI**  
  -> MVP auf Kernwidgets begrenzen, spaeter optional erweitern.

## 11. Naechste konkrete Schritte

1. Finales UI-Framework festlegen (React oder Vue).
2. JSON-Schema fuer `config.json` definieren.
3. Electron-Projektgrundgeruest erstellen.
4. DDEV- und Git-Commands als Main-Process-Service implementieren.
5. Erste lauffaehige MVP-Oberflaeche bauen.