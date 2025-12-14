# Hassaniya Arabic Destination Service

## Server-Only API Service

A headless backend API service that transcribes Hassaniya Arabic (Nouakchott dialect) audio and maps spoken destinations to coordinates of known places in Nouakchott, Mauritania. This service is designed for external parties to integrate via HTTP API calls - send audio, receive coordinates.

**Note**: This is a server-only service with no UI. The `nouakchott_destination_app/` directory contains a legacy Flutter client app that is not used by this service. The server is independent and can be used by any client application.

## Features

- 🎙️ **Speech Recognition**: Uses OpenAI Whisper API for high-quality Arabic transcription
- 🗺️ **Smart Matching**: Fuzzy matching algorithm to identify destinations from Hassaniya dialect
- 🏗️ **Clean Architecture**: Modular TypeScript codebase with clear separation of concerns
- 🔍 **Text Normalization**: Handles Arabic diacritics, character variations, and common intent phrases
- 📍 **Nouakchott Gazetteer**: Pre-loaded with 23 districts and landmarks

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

nouakchott_destination_app/  # Legacy Flutter client (not used by server)
```

**Note about Flutter App**: The `nouakchott_destination_app/` directory contains a Flutter mobile application that was previously used as a client for this service. This app is **not used** by the server service and is kept for reference/legacy purposes only. The server is completely independent and can be integrated by any client application via HTTP API calls.

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

## Server Setup

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

## API Usage for External Parties

This service is designed to be integrated by external applications. Send audio files via HTTP POST request and receive destination coordinates in the response.

### Response Format

The API returns JSON with the following structure:

**Success Response** (200 OK):
```json
{
  "transcript": "نبغي نمشي توجنين",
  "normalizedTranscript": "توجنين",
  "destination": {
    "id": 1,
    "canonicalName": "توجنين",
    "matchedVariant": "توجنين",
    "lat": 18.0724,
    "lon": -15.9099,
    "confidence": 0.95,
    "matchedBy": "fuzzy"
  },
  "error": null
}
```

**Key Fields**:
- `destination.lat` - **Latitude coordinate** (required for mapping)
- `destination.lon` - **Longitude coordinate** (required for mapping)
- `destination.canonicalName` - Official name of the destination
- `destination.confidence` - Match confidence score (0.0 to 1.0)
- `transcript` - Raw transcription from audio
- `error` - Error message if destination not found (null on success)

**No Match Response** (200 OK):
```json
{
  "transcript": "نبغي نمشي مكان غير معروف",
  "normalizedTranscript": "مكان غير معروف",
  "destination": null,
  "error": "لم نتمكن من تحديد وجهة في نواكشوط. حاول مرة أخرى بالتوضيح."
}
```

### Integration Examples

#### cURL

**Production**:
```bash
curl -X POST https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio \
  -F "audio=@/path/to/your/audio.m4a"
```

**Local Development**:
```bash
curl -X POST http://localhost:3000/api/destination-from-audio \
  -F "audio=@/path/to/your/audio.m4a"
```

With pretty-printed JSON output (Production):
```bash
curl -X POST https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio \
  -F "audio=@./test_audio/toujounine.m4a" \
  | jq
```

#### JavaScript/TypeScript (Fetch API)

```javascript
// Production URL
const API_URL = 'https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio';
// For local development, use: 'http://localhost:3000/api/destination-from-audio'

async function getDestinationFromAudio(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await fetch(API_URL, {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  
  if (data.destination) {
    console.log('Destination:', data.destination.canonicalName);
    console.log('Coordinates:', data.destination.lat, data.destination.lon);
    return {
      lat: data.destination.lat,
      lon: data.destination.lon,
      name: data.destination.canonicalName
    };
  } else {
    console.error('No destination found:', data.error);
    return null;
  }
}

// Usage with file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const audioFile = e.target.files[0];
  const result = await getDestinationFromAudio(audioFile);
  if (result) {
    // Use coordinates: result.lat, result.lon
  }
});
```

#### Python (requests library)

```python
import requests

# Production URL
API_URL = 'https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio'
# For local development, use: 'http://localhost:3000/api/destination-from-audio'

def get_destination_from_audio(audio_file_path):
    url = API_URL
    
    with open(audio_file_path, 'rb') as audio_file:
        files = {'audio': audio_file}
        response = requests.post(url, files=files)
        data = response.json()
    
    if data.get('destination'):
        destination = data['destination']
        print(f"Destination: {destination['canonicalName']}")
        print(f"Coordinates: {destination['lat']}, {destination['lon']}")
        return {
            'lat': destination['lat'],
            'lon': destination['lon'],
            'name': destination['canonicalName']
        }
    else:
        print(f"No destination found: {data.get('error')}")
        return None

# Usage
result = get_destination_from_audio('./test_audio/toujounine.m4a')
if result:
    # Use coordinates: result['lat'], result['lon']
    pass
```

## Deployment

### Railway Production Deployment

The service is deployed on Railway at:
**Production URL**: `https://nouakchott-destination-backend-production.up.railway.app`

The API is publicly accessible at this URL. Use this endpoint for production integrations.

### Local Development

For local development, the server runs on `http://localhost:3000` (or the PORT specified in `.env`).

## API Reference

### Base URLs

- **Production**: `https://nouakchott-destination-backend-production.up.railway.app`
- **Local Development**: `http://localhost:3000`

### Health Check

**Endpoint**: `GET /health`

**Production**: `https://nouakchott-destination-backend-production.up.railway.app/health`

**Response**:
```json
{
  "status": "ok",
  "service": "hassaniya-destination-api"
}
```

### Destination from Audio

**Endpoint**: `POST /api/destination-from-audio`

**Production**: `https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio`

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
    "canonicalName": "توجنين",
    "matchedVariant": "توجنين",
    "lat": 18.0724,
    "lon": -15.9099,
    "confidence": 0.95,
    "matchedBy": "fuzzy"
  },
  "error": null
}
```

**Important**: The `lat` and `lon` fields in the `destination` object are the coordinates you need for mapping/navigation. These are the primary return values from the API.

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
Returns the matched destination with **coordinates (lat/lon)**, the variant that matched, and a confidence score. The coordinates are the primary output for external integrations.

## Supported Destinations

The current gazetteer includes **23 Nouakchott locations** with coordinates:

1. **توجنين** (Toujounine)
2. **تيارت** (Teyaret)
3. **لكصر** (Ksar)
4. **تفرغ زينة** (Tevragh Zeina)
5. **السبخة** (Sebkha)
6. **دار النعيم** (Dar Naim)
7. **عرفات** (Arafat)
8. **عنكار دارالبركة** (Enkar Dar Al-Baraka)
9. **سانكيام** (Cinquième)
10. **Port - الميناء** (Port)
11. **مرصة كابيتال** (Marché Capitale)
12. **كارفور عين الطلح** (Carrefour Ain Talh)
13. **سمعة منت أجدي** (Mint Jdey)
14. **فور ولد سبرو** (Four Ould Sibrou)
15. **كرفور بي أم دي** (Carrefour BMD)
16. **مسجد ولد أحمدو** (Mosque Ould Ahmedou)
17. **مستشفى نواكشوط العسكري** (Nouakchott Military Hospital)
18. **مسجد ولد اموحود** (Mosque Ould Oumouhoud)
19. **مجمع عباد الرحمان 1** (Complexe Ibadou Al-Rahman 1)
20. **مجمع عباد الرحمان 3** (Complexe Ibadou Al-Rahman 3)
21. **بقالة الرزام** (Bakala Al-Rizam)
22. **مسجد التجانيين** (Mosque Al-Tijaniyine)
23. **وقفة صكوك** (Wakfat Sokok)

Each destination includes latitude (`lat`) and longitude (`lon`) coordinates that are returned in the API response. To add more destinations, edit `src/data/places.json` and include Arabic and Latin variants.

## Railway Deployment

The service is deployed on Railway at:
**Production URL**: `https://nouakchott-destination-backend-production.up.railway.app`

### Railway Environment Variables

Set these in your Railway project settings:

- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Railway will set this automatically (usually 3000 or from `$PORT`)
- `MAX_FILE_SIZE` - Max audio file size in bytes (default: 26214400 = 25MB)
- `OPENAI_TRANSCRIBE_MODEL` - Transcription model (default: gpt-4o-transcribe)
- `OPENAI_TRANSCRIBE_TEMPERATURE` - Temperature for transcription (default: 0)
- `OPENAI_TRANSCRIBE_FORCE_LANGUAGE_AR` - Force Arabic language (default: true)

### Railway Build Settings

Railway will automatically:
- Detect Node.js project
- Run `npm install` to install dependencies
- Run `npm run build` to compile TypeScript
- Run `npm start` to start the server

Make sure your `package.json` has the correct start script:
```json
{
  "scripts": {
    "start": "node dist/server.js"
  }
}
```

## Configuration

Environment variables (`.env` file for local development):

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
