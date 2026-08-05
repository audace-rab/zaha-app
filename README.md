# Zaha App — Monorepo

Application mobile de voyage (Madagascar) avec **React Native (Expo)**, backend **Next.js** et base **Supabase (PostgreSQL)**.

## Structure

```
zaha-app-v2/
├── apps/
│   ├── api/          # Backend Next.js (Route Handlers)
│   └── mobile/       # App React Native (Expo)
├── packages/
│   └── shared/       # Types TypeScript partagés
├── supabase/
│   └── migrations/   # Schéma PostgreSQL + RLS
└── legacy/web/       # Ancienne app Vite (référence)
```

## Prérequis

- Node.js 20+
- Compte [Supabase](https://supabase.com)
- Clé API [Google Gemini](https://aistudio.google.com/apikey)
- [Expo Go](https://expo.dev/go) sur téléphone (dev mobile)

## 1. Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans **SQL Editor** et exécutez le fichier :
   `supabase/migrations/20260804120000_initial_schema.sql`
3. Récupérez dans **Settings → API** :
   - `Project URL`
   - `anon public` key
   - `service_role` key (secret, backend uniquement)

## 2. Variables d'environnement

```bash
cp apps/api/.env.example apps/api/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Remplissez les clés Supabase et Gemini dans `apps/api/.env.local`.

Pour le mobile, si vous testez sur un **téléphone physique**, remplacez `localhost` par l'IP locale du PC :

```
EXPO_PUBLIC_API_URL=http://172.16.0.11:3000
```

## 3. Installation

```bash
npm install
```

## 4. Lancer en développement

**Terminal 1 — API :**
```bash
npm run dev:api
```

**Terminal 2 — Mobile :**
```bash
npm run dev:mobile
```

Scannez le QR code avec Expo Go.

## API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé du service |
| GET | `/api/feed` | Flux social |
| POST | `/api/places/search` | Recherche de lieux (Gemini) |
| POST | `/api/places/geocode` | Géocodage / identification ville |
| POST | `/api/chat` | Chat avec l'agent Zaha |

## Stack

| Couche | Technologie |
|--------|-------------|
| Mobile | React Native 0.86 + Expo 57 |
| Backend | Next.js 16 (App Router) |
| BDD | Supabase (PostgreSQL + Auth + Storage) |
| IA | Google Gemini (côté serveur) |
| Types | `@zaha/shared` |

## Legacy

L'ancienne app web Vite est conservée dans `legacy/web/` :

```bash
npm run dev:web
```
