# Zaha API — Next.js

Backend Next.js pour l’application mobile Zaha, avec routes API, services métiers et intégration Supabase.

## Configuration

Copiez les variables d’environnement d’exemple :

```bash
cp .env.example .env.local
```

Puis remplissez :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`

## Installation

```bash
npm install
```

## Lancer en développement

```bash
npm run dev
```

## Endpoints

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | Vérifie que le service est disponible |
| GET | `/api/feed` | Récupère le flux social |
| POST | `/api/places/search` | Recherche de lieux |
| POST | `/api/places/geocode` | Géocodage / identification de lieu |
| POST | `/api/chat` | Chat avec l’agent IA |

## Stack

- Next.js 16 (App Router)
- Supabase PostgreSQL
- Google Gemini (IA)
- Types partagés via `@zaha/shared`
