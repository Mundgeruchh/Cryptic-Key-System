# Cryptic Key System

Sauber strukturiertes Cloudflare-Pages-Projekt: statisches HTML/CSS/JS im `public`-Ordner, API-Logik als einzelne Pages Functions im `functions`-Ordner.

Ablauf: Turnstile-Bot-Check → 3× "Werbung ansehen" (je 20s Timer, serverseitig gezählt) → Key wird aus dem KV-Pool ausgegeben.
`/admin` → Passwortabfrage (Secret `ADMIN_PASS`) → Stats + Keys per TXT-Upload nachfüllen.

## Projektstruktur

```
public/
  index.html          Startseite
  admin.html          Admin-Seite (erreichbar unter /admin)
  css/style.css        gemeinsames lila Design
  js/main.js           Frontend-Logik der Startseite
  js/admin.js          Frontend-Logik der Admin-Seite

functions/
  _lib/kv.js                    gemeinsame Helfer (kein Route, führendes "_")
  api/config.js                 liefert den öffentlichen Turnstile-Sitekey ans Frontend
  api/verify-turnstile.js       prüft den Bot-Check
  api/ad-step.js                zählt einen abgeschlossenen Werbe-Schritt
  api/claim-key.js              gibt einen Key aus dem KV-Pool aus
  api/admin/stats.js            liefert Statistik (geschützt durch ADMIN_PASS)
  api/admin/upload-keys.js      fügt neue Keys aus einer TXT hinzu (geschützt)

wrangler.toml          nur für lokale Tests mit "wrangler pages dev", nicht für den GitHub-Deploy nötig
```

## 1. KV-Namespace

Nutze deinen bestehenden Namespace `cryptic-key-system` (ID `15532578ec2e44b7baa5b20d6294e33d`) oder erstelle einen neuen unter Cloudflare Dashboard → Workers & Pages → KV.

## 2. Cloudflare Pages Dashboard konfigurieren

Im Pages-Projekt → **Settings**:

**Functions → KV namespace bindings**
- Variable name: `KV`
- KV namespace: dein Namespace (z. B. `cryptic-key-system`)

**Environment variables** (für Production UND Preview jeweils setzen):
- `TURNSTILE_SITEKEY` = dein Sitekey (z. B. `0x4AAAAAAE7iqGCztCrwijja`) — normale Variable
- `ADMIN_PASS` = dein Admin-Passwort — als **Secret**
- `TURNSTILE_SECRET` = dein Turnstile Secret Key — als **Secret**

Danach neu deployen (Push aufs Repo oder "Retry deployment" im Dashboard).

## 3. Deploy

- Ganzen Inhalt dieses Ordners (also `public/`, `functions/`, `wrangler.toml`, `README.md`) ins GitHub-Repo pushen.
- Im Pages-Projekt als Build-Einstellung: **Build output directory** = `public`, kein Build-Command nötig (reines statisches Projekt + Functions).
- Cloudflare erkennt `functions/` automatisch und bindet die Routen unter `/api/...` ein.

## 4. Keys hochladen

Auf `/admin` einloggen (dein `ADMIN_PASS`) und eine `.txt`-Datei mit einem Key pro Zeile hochladen. Duplikate werden übersprungen. Die Keys landen direkt im KV-Namespace, nicht im Repo.

## 5. Werbung einbauen (musst du selbst machen)

1. Bei einem Ad-Network anmelden, das "Content Locker"/"Interstitial"-Anzeigen anbietet (z. B. Adsterra, Monetag, PropellerAds — Konditionen selbst prüfen).
2. In `public/index.html` den Bereich `<div class="ad-slot" id="ad-slot">...</div>` durch dein Snippet ersetzen.
3. Timer-Länge in `public/js/main.js` (`AD_WAIT_SECONDS`, aktuell 20) an dein Ad-Network anpassen.

**Hinweis:** Die Schritte werden serverseitig gezählt — das schützt vor den einfachsten Bypass-Versuchen, aber nicht vor technisch versierten Nutzern, die die API direkt ansprechen. Vollständigen Schutz bietet nur serverseitiges Klick-Tracking deines Ad-Networks, falls angeboten.

## 6. Monetarisierung – rechtlich beachten

- Impressum/Datenschutz: Cookies/Tracking durch Drittanbieter-Werbung offenlegen (DSGVO bei EU-Besuchern), ggf. Cookie-Consent einholen.
- AGB deines Ad-Networks lesen — manche verbieten "erzwungene Klicks" oder Bot-artigen Traffic ausdrücklich.
