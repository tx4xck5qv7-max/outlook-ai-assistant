# Outlook AI Assistant Backend

Minimales MVP-Backend für einen Outlook E-Mail-Assistenten.

## Ziel

- Node.js + Express
- Ein Endpoint: `POST /analyze-email`
- Eingabe: `emailContent` als Text
- Ausgabe: eine Zusammenfassung + drei Antwortvorschläge
- Keine Microsoft Graph Integration
- Kein TypeScript
- Kein Auth-System
- Kein Kalender
- Kein Kontakt-System

## Dateien

- `index.js` - Server und API
- `openaiAssistant.js` - OpenAI-Auswertung
- `.env.example` - Umgebungsvariablen
- `.gitignore`

## Installation

1. `npm install`
2. `.env.example` kopieren nach `.env`
3. OpenAI API-Key in `.env` eintragen
4. `npm start`

## Beispiel

Request:

```json
{
  "emailContent": "Hallo, ich brauche eine kurze Zusammenfassung und drei Antwortvorschläge."
}
```

Response:

```json
{
  "summary": "...",
  "suggestions": ["...", "...", "..."]
}
```
