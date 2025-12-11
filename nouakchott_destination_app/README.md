# Nouakchott Destination Flutter App

A Flutter mobile app demo for the Hassaniya Arabic destination service. Speak a destination in Hassaniya and watch the map navigate to it!

## Features

- 🗺️ **Interactive Map**: OpenStreetMap with Nouakchott centered
- 🎤 **Voice Input**: Record audio with a simple microphone button
- 🤖 **Smart Matching**: Visual indicators showing whether fuzzy or AI matching was used
- 📍 **Auto Navigation**: Map automatically moves to matched destinations
- ✨ **Clean UI**: Modern Material Design 3 interface

## Prerequisites

- Flutter SDK 3.38.3 or higher
- iOS Simulator or physical device (iOS 12+)
- Android Emulator or physical device (API 21+)
- Backend API running on `localhost:3000`

## Setup

### 1. Install Dependencies

```bash
cd nouakchott_destination_app
flutter pub get
```

### 2. Configure Backend URL

The app is configured to connect to:
```
http://localhost:3000/api/destination-from-audio
```

**For iOS Simulator**: `localhost` works fine

**For Android Emulator**: You may need to change `localhost` to `10.0.2.2` in `lib/main.dart`:

```dart
static const String apiUrl = 'http://10.0.2.2:3000/api/destination-from-audio';
```

**For Physical Device**: Change to your computer's local IP:

```dart
static const String apiUrl = 'http://192.168.1.xxx:3000/api/destination-from-audio';
```

### 3. Run the Backend

Make sure your backend server is running:

```bash
cd ../  # Go back to sixthAttempt directory
npm run dev
```

## Running the App

### iOS

```bash
flutter run -d iphone
```

Or open Xcode and run from there.

### Android

```bash
flutter run -d android
```

## How to Use

1. **Launch the app** - Map centered on Nouakchott (Ksar area)

2. **Tap the microphone button** - It will turn red and show "Recording..."

3. **Speak your destination** in Hassaniya Arabic, for example:
   - "نبغي نمشي توجنين" (I want to go to Toujounine)
   - "باغي نمشي تيارت" (I want to go to Teyaret)
   - "وديني الميناء" (Take me to the port)

4. **Tap again to stop** recording

5. **Watch the magic!**
   - Audio sent to backend
   - Whisper transcribes it
   - Hybrid matcher finds the destination
   - Map animates to the location
   - Status bar shows match method (Fuzzy or AI)

## UI Elements

### Status Bar
- **Blue background** = Fuzzy match (fast, free)
- **Purple background** = AI/LLM match (smart, fallback)
- Shows confidence percentage
- Displays match method chip

### Map Markers
- **Blue marker** = Your current location (Ksar by default)
- **Red marker** = Matched destination with label

### Input Area
- **Text field** = Shows the transcript (read-only)
- **Microphone button** = 
  - Blue = Ready to record
  - Red = Recording
  - Grey with spinner = Processing

## Troubleshooting

### Microphone Permission Denied
- **iOS**: Go to Settings → Privacy → Microphone → Allow for the app
- **Android**: App should request permission automatically

### "Failed to connect"
- Make sure backend is running (`npm run dev`)
- Check the API URL matches your setup
- For Android emulator, use `10.0.2.2` instead of `localhost`
- For physical device, use your computer's IP

### Map not loading
- Check internet connection (needed for OpenStreetMap tiles)
- Maps should work out of the box, no API key required

## Architecture

```
User speaks → Audio recorded → Sent to backend → Whisper transcribes
→ Hybrid matcher (fuzzy → LLM fallback) → Coordinates returned
→ Map animates to destination
```

## Dependencies

- `flutter_map` - OpenStreetMap integration
- `latlong2` - Geographic coordinates
- `http` - REST API calls
- `record` - Audio recording
- `permission_handler` - Runtime permissions

## Next Steps

- Add manual text search functionality
- Save favorite destinations
- Show route between current location and destination
- Add more places to the gazetteer
- Implement destination search history

## License

ISC
