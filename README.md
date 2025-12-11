# Hassaniya Arabic Destination Service

A backend service that transcribes Hassaniya Arabic (Nouakchott dialect) audio and maps spoken destinations to coordinates of known places in Nouakchott, Mauritania.

## Features

- 🎙️ **Speech Recognition**: Uses OpenAI Whisper API for high-quality Arabic transcription
- 🗺️ **Smart Matching**: Fuzzy matching algorithm to identify destinations from Hassaniya dialect
- 🏗️ **Clean Architecture**: Modular TypeScript codebase with clear separation of concerns
- 🔍 **Text Normalization**: Handles Arabic diacritics, character variations, and common intent phrases
- 📍 **Nouakchott Gazetteer**: Pre-loaded with 12 districts and landmarks

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express
- **ASR**: OpenAI Whisper API
- **Dev Tools**: ts-node, nodemon, ESLint

## Project Structure

```
src/
├── config/
│   └── env.ts              # Environment configuration
├── data/
│   └── places.json         # Nouakchott destinations gazetteer
├── core/
│   ├── normalization.ts    # Arabic/Hassaniya text normalization
│   ├── similarity.ts       # String similarity algorithms
│   ├── destinationMatcher.ts # Destination resolution logic
│   └── asr.ts              # OpenAI Whisper integration
├── routes/
│   └── destinationRoute.ts # HTTP endpoint handler
└── server.ts               # Express app bootstrap
```

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- OpenAI API key with access to Whisper

### Steps

1. **Clone or navigate to the project directory**
   ```bash
   cd /path/to/sixthAttempt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   PORT=3000
   ```

## Usage

### Development Mode

Start the server with auto-reload on file changes:

```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the PORT you specified in `.env`).

### Production Build

Build the TypeScript code:

```bash
npm run build
```

Run the compiled JavaScript:

```bash
npm start
```

### Linting

Check code quality:

```bash
npm run lint
```

## API Reference

### Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "service": "hassaniya-destination-api"
}
```

### Destination from Audio

**Endpoint**: `POST /api/destination-from-audio`

**Request**:
- **Content-Type**: `multipart/form-data`
- **Field name**: `audio`
- **Accepted formats**: `.mp3`, `.m4a`, `.wav`, `.webm`, `.ogg`, `.flac`
- **Max file size**: 25MB (configurable via `MAX_FILE_SIZE` env var)

**Response** (Success):
```json
{
  "transcript": "نبغي نمشي توجنين",
  "normalizedTranscript": "توجنين",
  "destination": {
    "id": 1,
    "canonicalName": "Toujounine",
    "matchedVariant": "توجنين",
    "lat": 18.0853,
    "lon": -15.9785,
    "confidence": 0.95
  },
  "error": null
}
```

**Response** (No match found):
```json
{
  "transcript": "نبغي نمشي مكان غير معروف",
  "normalizedTranscript": "مكان غير معروف",
  "destination": null,
  "error": "No destination could be confidently identified from the transcript."
}
```

**Response** (Error):
```json
{
  "error": "ASR_FAILED",
  "message": "Failed to transcribe audio",
  "details": "API rate limit exceeded"
}
```

### Example cURL Command

Test the endpoint with an audio file:

```bash
curl -X POST http://localhost:3000/api/destination-from-audio \
  -F "audio=@/path/to/your/audio.m4a"
```

Example with a recorded phrase "نبغي نمشي توجنين" (I want to go to Toujounine):

```bash
curl -X POST http://localhost:3000/api/destination-from-audio \
  -F "audio=@./test_audio/toujounine.m4a" \
  | jq
```

## How It Works

### 1. Audio Transcription
Audio is sent to OpenAI Whisper API with Arabic language specified. Whisper handles the Hassaniya dialect as a variant of Arabic.

### 2. Text Normalization
The transcript goes through normalization:
- Remove Arabic diacritics (tashkeel)
- Normalize character variations (different alif forms, etc.)
- Strip common intent phrases like "نبغي نمشي" (I want to go)
- Convert to lowercase and clean whitespace

### 3. Destination Matching
Uses multiple strategies:
- **N-gram matching**: Extracts candidate spans (1-4 tokens) from normalized text
- **Fuzzy matching**: Levenshtein distance-based similarity scoring
- **Containment check**: Detects embedded location names
- **Confidence threshold**: Only returns matches with ≥75% confidence

### 4. Response
Returns the matched destination with coordinates, the variant that matched, and a confidence score.

## Supported Destinations

The current gazetteer includes 12 Nouakchott locations:

1. **Toujounine** (توجنين)
2. **Teyaret** (تيارت)
3. **Ksar** (كصر)
4. **Tevragh Zeina** (تفرغ زينة)
5. **Sebkha** (سبخة)
6. **Dar Naim** (دار النعيم)
7. **Arafat** (عرفات)
8. **Carrefour** (كارفور)
9. **Cinquième** (سانكيام)
10. **Capitale** (كابيتال)
11. **Port** (الميناء)
12. **Marché Capitale** (سوق كابيتال)

To add more destinations, edit `src/data/places.json` and include Arabic and Latin variants.

## Configuration

Environment variables (`.env` file):

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key (required) | - |
| `PORT` | Server port | 3000 |
| `MAX_FILE_SIZE` | Max audio file size in bytes | 26214400 (25MB) |
| `OPENAI_TRANSCRIBE_MODEL` | Transcription model (e.g., `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`) | gpt-4o-transcribe |
| `OPENAI_TRANSCRIBE_TEMPERATURE` | Temperature passed to transcription | 0 |
| `OPENAI_TRANSCRIBE_FORCE_LANGUAGE_AR` | Force `language: ar` when true | true |

## Error Codes

| Code | Description |
|------|-------------|
| `MISSING_FILE` | No audio file was uploaded |
| `ASR_FAILED` | Whisper transcription failed |
| `INTERNAL_ERROR` | Unexpected server error |

## Development

### Code Organization

- **`config/`**: Environment and configuration management
- **`data/`**: Static data (gazetteer)
- **`core/`**: Business logic (ASR, normalization, matching)
- **`routes/`**: HTTP request handlers
- **`server.ts`**: Application entry point

### Adding New Destinations

Edit `src/data/places.json`:

```json
{
  "id": 13,
  "canonicalName": "New District",
  "variants": [
    "حي جديد",
    "new district",
    "district nouveau"
  ],
  "lat": 18.1234,
  "lon": -15.9876
}
```

Include common spelling variations and both Arabic and Latin transliterations.

### Testing Normalization

You can test the normalization logic independently:

```typescript
import { normalizeText } from './src/core/normalization';

console.log(normalizeText('نبغي نمشي توجنين'));
// Output: "توجنين"
```

## Limitations

- Requires active internet connection for Whisper API
- Audio files limited to 25MB by default
- Matching confidence threshold is fixed at 75%
- Currently supports Nouakchott locations only

## Future Enhancements

- [ ] Add unit tests for core functions
- [ ] Support for multiple cities/regions
- [ ] Configurable confidence threshold
- [ ] Caching layer for repeated transcriptions
- [ ] Batch processing endpoint
- [ ] Alternative ASR provider support

## License

ISC

## Support

For issues or questions, please open an issue in the project repository.
