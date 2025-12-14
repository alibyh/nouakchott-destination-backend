### Prompt 1 — Build the Server-Side “audio → transcript (Whisper) → destination match → coordinates” API (NO UI)

You are an expert backend engineer. Create a **new standalone project** (separate repo/folder) that implements the same destination-matching logic we already built, but as a **server API** (no Flutter, no UI). This must work immediately after `npm install` + `.env` setup.

## Goal

Build an HTTP service that:
- Receives **audio** via `multipart/form-data` (field name **`audio`**)
- Runs **Whisper transcription on OUR server side** (preferred: OpenAI Audio Transcriptions API, but keep code modular so we can swap to self-hosted Whisper later)
- Runs our existing **hybrid fuzzy + LLM fallback** destination matcher on the transcript
- Returns the matched destination **coordinates** (`lat`, `lon`) + metadata

This should replicate the behavior of our current endpoint exactly, but packaged as a clean deployable server.

## Tech Stack (required)

- Node.js **>= 20** (important because we use `File` in the OpenAI SDK)
- TypeScript
- Express
- Multer (in-memory upload)
- `openai` SDK (for transcription; and optionally for LLM fallback matcher)
- No database
- Places are loaded from a static JSON gazetteer (`places.json`)

## Exact API Contract (MUST MATCH)

### Endpoint

`POST /api/destination-from-audio`

### Request

- `Content-Type: multipart/form-data`
- One file field: `audio`
- Accept common audio formats: `.mp3`, `.m4a`, `.wav`, `.webm`, `.ogg`, `.flac`, `.mp4`, `.mpeg` or `audio/*` mime types.
- Enforce max file size via env var (default 25MB).

### Success Response (always 200 on successful processing, even if no match)

When **match found**:
```json
{
  "transcript": "…",
  "normalizedTranscript": "…",
  "destination": {
    "id": 123,
    "canonicalName": "…",
    "matchedVariant": "…",
    "lat": 18.123,
    "lon": -15.456,
    "confidence": 0.88,
    "matchedBy": "fuzzy"
  },
  "error": null
}
```

When **no match**:
```json
{
  "transcript": "…",
  "normalizedTranscript": "…",
  "destination": null,
  "error": "لم نتمكن من تحديد وجهة في نواكشوط. حاول مرة أخرى بالتوضيح."
}
```

### Error Responses

- If file missing: **400**
```json
{ "error": "MISSING_FILE", "message": "No audio file provided. Please upload an audio file with field name \"audio\"." }
```

- If transcription fails: **500**
```json
{ "error": "ASR_FAILED", "message": "Failed to transcribe audio", "details": "…" }
```

- Any unexpected server error: **500**
```json
{ "error": "INTERNAL_ERROR", "message": "An unexpected error occurred", "details": "…" }
```

## Implementation Requirements (be strict)

### 1) Code structure (create these files)

Create this minimal structure:

- `src/server.ts`
  - Express app
  - `GET /health` returns `{ status: "ok", service: "hassaniya-destination-api" }`
  - Mount router under `/api`
  - Bind to `0.0.0.0`
- `src/routes/destinationRoute.ts`
  - Defines `POST /destination-from-audio`
  - Multer memoryStorage with fileFilter and size limit
  - Pipeline: upload → transcribe → normalize → resolveDestination → response
- `src/config/env.ts`
  - Reads env vars with `dotenv`
  - Validates required vars
- `src/data/places.json`
  - The gazetteer (provided by me)
- `src/core/normalization.ts`
  - `normalizeText()` and `generateNGrams()` exactly as spec
- `src/core/similarity.ts`
  - Levenshtein similarity and `containsSimilarity`
- `src/core/destinationMatcher.ts`
  - `resolveDestination(transcript, places)` with:
    - n-grams up to 4
    - fuzzy best match threshold **0.75**
    - fallback to LLM if below threshold
    - returns `matchedBy: "fuzzy" | "llm"`
- `src/core/llmMatcher.ts` (optional but recommended)
  - `matchWithLLM(transcript, places)` using OpenAI chat with JSON response
  - Use a cheap model (e.g. `gpt-4o-mini`)
- `src/core/asr.ts`
  - `transcribeAudio(buffer, mimeType, originalFilename?)`
  - Use OpenAI Audio Transcriptions API
  - Provide a Nouakchott-guided prompt list (canonical destination list)
  - Must support `application/octet-stream` from iOS recordings by mapping extension

### 2) Environment variables

Create `.env` with:

- `OPENAI_API_KEY=...` (required)
- `PORT=3000`
- `MAX_FILE_SIZE=26214400`
- `OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe`
- `OPENAI_TRANSCRIBE_TEMPERATURE=0`
- `OPENAI_TRANSCRIBE_FORCE_LANGUAGE_AR=true`

Also support (optional) `MATCHER_ENABLE_LLM=true/false` if you want to let us disable LLM fallback easily.

### 3) Dependencies (package.json)

Include scripts:
- `dev`: run TS server with nodemon
- `build`: `tsc`
- `start`: `node dist/server.js`

Dependencies:
- `express`
- `multer`
- `dotenv`
- `openai`

Dev deps:
- `typescript`
- `ts-node`
- `nodemon`
- eslint types if you want, but don’t overcomplicate

### 4) Must be deploy-ready

- No hardcoded secrets
- Reads port from env
- Clear logs (upload metadata, ASR model, transcript, match result)
- Works with `curl` and with a Flutter client

## What files I will provide you (you must assume these exist and wire them in)

I will provide:
- `src/data/places.json` (required)
- If helpful, I can also provide the canonical destination list used in ASR prompt, but you can derive it from `places.json`’s `canonicalName`.

You must implement everything else.

## How the pipeline MUST work

1) Receive audio file (`req.file`)
2) Transcribe audio on server using Whisper (OpenAI transcription)
3) `normalizeText(transcript)`
4) `resolveDestination(transcript, places)`
5) Return JSON in the exact format above

## Local test commands (include in README.md)

Add a `README.md` with:

- Install:
  - `npm i`
  - `cp .env .env` and set `OPENAI_API_KEY`
- Run:
  - `npm run dev`
- Test:
```bash
curl -X POST http://localhost:3000/api/destination-from-audio \
  -F "audio=@/path/to/sample.m4a"
```

## Whisper location: our side vs their side (make the decision explicit)

We are choosing **Whisper on our server** for:
- consistent quality
- no client API keys
- easier iteration on prompting and normalization

Write the code so the ASR is a module we can swap later to self-hosted `faster-whisper`.

## Deliverables

- The full project with the file structure above
- No missing imports
- TypeScript compiles
- Endpoint works immediately
- README + `.env`


