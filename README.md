# VEPO Product Configurator

Shopify App für Produkt-Konfiguration, gebaut mit Remix und Prisma.

## Tech Stack

- **Framework:** Remix (React)
- **Database:** MySQL mit Prisma ORM
- **Hosting:** Fly.io
- **CI/CD:** GitHub Actions

## Lokale Entwicklung

### Voraussetzungen

- Node.js >= 18
- npm
- MySQL Datenbank

### Setup

1. Dependencies installieren:
```bash
npm install
```

2. Environment-Variablen konfigurieren:
```bash
cp .env.example .env
# Dann .env mit deinen Werten ausfüllen
```

3. Datenbank migrieren:
```bash
npx prisma migrate dev
```

4. Dev-Server starten:
```bash
npm run dev
```

## Deployment

### Erstmaliges Setup auf Fly.io

1. Fly CLI installieren:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Bei Fly.io einloggen:
```bash
fly auth login
```

3. App erstellen (einmalig):
```bash
fly apps create vepo-product-configurator
```

4. Secrets setzen:
```bash
fly secrets set DATABASE_URL="mysql://vepo2:PASSWORT@87.106.224.224:3306/vepo2db"
fly secrets set SHOPIFY_API_KEY="dein-api-key"
fly secrets set SHOPIFY_API_SECRET="dein-api-secret"
fly secrets set SCOPES="read_products,write_products,read_themes,write_themes,read_files,write_files,write_cart_transforms,read_publications,write_publications,read_inventory,write_inventory"
fly secrets set SHOPIFY_APP_URL="https://vepo-product-configurator.fly.dev"
```

5. Deployen:
```bash
fly deploy
```

### Automatisches Deployment (CI/CD)

Bei Push auf `main` wird automatisch deployed via GitHub Actions.

**Benötigte GitHub Secrets:**
- `FLY_API_TOKEN` - Fly.io API Token (erstellen via `fly tokens create deploy`)

### Manuelles Deployment

```bash
fly deploy
```

## Datenbank

### Backup

Manuelles Backup erstellen:
```bash
./scripts/backup-database.sh
```

Für automatische tägliche Backups, Cron-Job auf dem Server einrichten:
```bash
# Crontab öffnen
crontab -e

# Tägliches Backup um 3:00 Uhr
0 3 * * * DB_PASSWORD="dein-passwort" /pfad/zu/scripts/backup-database.sh >> /var/log/vepo-backup.log 2>&1
```

### Migrationen

```bash
# Neue Migration erstellen
npx prisma migrate dev --name beschreibung

# Migrationen in Production anwenden
npx prisma migrate deploy
```

## Shopify App Konfiguration

Nach dem Deployment muss die App URL in der Shopify Partner Dashboard aktualisiert werden:

1. Gehe zu: https://partners.shopify.com
2. Apps → VEPO Product Configurator
3. App Setup:
   - **App URL:** `https://vepo-product-configurator.fly.dev`
   - **Allowed redirection URLs:** `https://vepo-product-configurator.fly.dev/api/auth/callback`
4. App Proxy:
   - **URL:** `https://vepo-product-configurator.fly.dev/vepoapi`

## Branch-Strategie

- `main` - Production Branch (protected)
- Feature Branches → Pull Request → Review → Merge zu `main`

### Branch Protection Rules (GitHub)

- Require pull request reviews before merging
- Require status checks to pass (Lint & Type Check)
- No direct pushes to `main`

## Nützliche Befehle

```bash
# Logs anschauen
fly logs

# SSH in die VM
fly ssh console

# App Status
fly status

# Secrets anzeigen
fly secrets list
```
