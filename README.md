# ProjectDashboard

## Disclaimer

This project is completely written by AI! I am not responsible for any damage caused by this project.

Electron-basierter Projekt-Dashboard-Launcher mit Widgets fuer:

- DDEV Status + Start/Stop/Restart
- Git Status/Pull/Push
- Disk Usage
- Programmstarter (Cursor, VS Code, Explorer, Terminal)
- SSH-Verbindungen
- Browser-URLs aus Projektkonfigurationen

## Voraussetzungen

- Node.js 20+
- npm
- optional: `ddev`, `git`, `cursor`, `code`

## Installation

```bash
npm install
```

## Start

```bash
npm start
```

## Buildprozess (Pakete)

Nach `npm install` stehen folgende Build-Skripte zur Verfuegung:

```bash
npm run build:deb
npm run build:dev
npm run build:rpm
npm run build:appimage
npm run build:mac
npm run build:win
npm run build:flatpak
npm run build:all
```

- `build:dev` ist ein Alias auf `build:deb`.
- Artefakte werden in `dist/` geschrieben.

### Flatpak Voraussetzungen

Fuer `npm run build:flatpak` muessen auf dem System installiert sein:

- `flatpak`
- `flatpak-builder`

## Konfiguration

Beim ersten Start wird automatisch eine Konfigurationsdatei erstellt:

- Linux/macOS: `~/.config/dashboard/config.json`
- Windows: `%APPDATA%/dashboard/config.json`

Ein Schema liegt im Projekt unter `config.schema.json`.

Die Basiskonfiguration ist als Baum aufgebaut:

- Kunde
  - Projektmanager
    - Projekte (Verzeichnisse)

In der App gibt es dafuer eine Konfigurationsmaske in der Sidebar:

- Kunde hinzufuegen
- Projektmanager einem Kunden zuordnen
- Projektverzeichnis einem Projektmanager hinzufuegen

Die Basiskonfiguration ist bewusst reduziert:

- pro Projekt ist nur `path` verpflichtend
- `name` und `widgets` sind optional
- der Projektname wird bei Bedarf aus dem Verzeichnisnamen abgeleitet

## Hinweise

- SSH-Passwoerter werden nicht automatisiert verarbeitet; der Login erfolgt im geoeffneten Terminal.
- Browser-URLs werden aus `.ddev/config.yaml` und `config/sites/**/*.yaml` gelesen.
