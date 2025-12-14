### Prompt 2 — Build a Minimal Flutter “Map + Text + Mic” Test Client (records audio and calls our server)

You are an expert Flutter engineer. Create a **new standalone Flutter app project** (separate repo/folder) that is only for testing our server feature.

## Goal

Build a simple Flutter app that:
- Shows a Google Map
- Shows a read-only text field for status / recognized destination
- Has ONE mic button:
  - tap to start recording
  - tap again to stop
  - sends recorded audio to OUR server endpoint
  - receives JSON response with destination coordinates
  - places a marker on the map at the returned destination
  - updates the text field with the returned `canonicalName` (or an error message if destination is null)

NO extra UI (no confirmation card, no debug dialog, no route drawing required).

## Server Contract (must match)

The server endpoint is:
- `POST {BASE_URL}/api/destination-from-audio`
- multipart/form-data with file field name: `audio`

Response JSON:
- `destination` can be null
- If not null, it contains: `canonicalName`, `lat`, `lon`

## Required Flutter packages

In `pubspec.yaml` include:
- `google_maps_flutter`
- `http`
- `record`
- `permission_handler`

## Platform permissions (MUST)

### iOS
In `ios/Runner/Info.plist` add:
- `NSMicrophoneUsageDescription`: “This app needs microphone access to record audio.”

### Android
In `AndroidManifest.xml` add:
- `RECORD_AUDIO`
and request microphone permission at runtime using `permission_handler`.

## App behavior details

### UI layout
- Fullscreen Google Map
- Bottom sheet (or bottom panel) containing:
  - a read-only text field showing:
    - “Tap mic to speak”
    - “Recording…”
    - “Uploading…”
    - “Found: <canonicalName>”
    - or “No destination found, try again”
  - one circular mic button (tap to start/stop)

### Audio recording
- Use `record` package
- Record to a temp file (e.g., `.m4a` AAC if possible)
- Ensure stop returns a file path

### Upload
- Use `http.MultipartRequest`
- Field name must be **`audio`**
- Set filename and content-type best-effort (`audio/m4a` or `application/octet-stream`)
- Send to:
  - `BASE_URL` should be configurable at the top of the file (or via `--dart-define=API_BASE_URL=...`)

### Handling response
- If `destination != null`:
  - update text field to destination canonical name
  - add marker at `LatLng(lat, lon)`
  - animate camera to that marker
- If `destination == null`:
  - show `error` string from server in the text field
  - do not crash

### Error handling
- If upload fails (non-200):
  - show “Upload failed: <status>”
- If JSON parse fails:
  - show “Bad response”
- Always reset UI state to allow retry

## File structure

Keep it simple:
- `lib/main.dart` only (single file is ok)

## Deliverables

- A working Flutter app that compiles and runs on iOS simulator/device and Android
- No placeholder logic
- No missing permissions
- Works by simply changing `API_BASE_URL`

## Quick manual test checklist

1) Run server locally on your machine
2) Run Flutter on a real device on same network
3) Set `API_BASE_URL` to your machine IP (not localhost)
4) Tap mic, say a destination, stop
5) See text update + map marker move



