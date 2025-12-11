import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:record/record.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_polyline_points/flutter_polyline_points.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:convert';
import 'dart:io';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Fasty',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF00BFA5),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const DestinationMapPage(),
    );
  }
}

class DestinationMapPage extends StatefulWidget {
  const DestinationMapPage({super.key});

  @override
  State<DestinationMapPage> createState() => _DestinationMapPageState();
}

class _DestinationMapPageState extends State<DestinationMapPage> with SingleTickerProviderStateMixin {
  GoogleMapController? _mapController;
  final TextEditingController _textController = TextEditingController();
  final AudioRecorder _audioRecorder = AudioRecorder();
  
  // Fixed departure point: Carrefour Ould Mahe كرفور ولد اماه
  static const LatLng _departurePoint = LatLng(18.099011164111623, -15.958358591628299);
  final Set<Marker> _markers = {};
  final Set<Polyline> _polylines = {};
  
  // Location state
  LatLng? _currentLocation;
  bool _useCurrentLocation = false;
  
  // Pending destination (before confirmation)
  Map<String, dynamic>? _pendingDestination;
  
  // Confirmed destination
  String? _confirmedDestinationName;
  LatLng? _confirmedDestinationPos;
  
  bool _isRecording = false;
  bool _isProcessing = false;
  String? _statusMessage;
  String? _matchMethod;
  
  // Animation
  late AnimationController _pulseController;
  
  // DEBUG
  final List<String> _debugLogs = [];
  
  static const String apiUrl = 'https://nouakchott-destination-backend-production.up.railway.app/api/destination-from-audio';

  static const String directionsApiKey = 'AIzaSyCePYzzXuJDUE7P4s_7XiKHGvtmJQ8Uw-8';
  @override
  void initState() {
    super.initState();
    _addDepartureMarker();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _log('App initialized');
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _audioRecorder.dispose();
    _textController.dispose();
    _mapController?.dispose();
    super.dispose();
  }

  void _log(String message) {
    final timestamp = DateTime.now().toString().substring(11, 19);
    setState(() => _debugLogs.add('[$timestamp] $message'));
    print('DEBUG: $message');
  }

  void _showDebugLogs() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Debug Logs'),
        content: SizedBox(
          width: double.maxFinite,
          height: 400,
          child: ListView.builder(
            itemCount: _debugLogs.length,
            itemBuilder: (context, index) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text(_debugLogs[index], style: const TextStyle(fontSize: 11)),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _debugLogs.clear());
              Navigator.pop(context);
            },
            child: const Text('Clear'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  // Get current departure point (either current location or fixed)
  LatLng get _currentDeparturePoint {
    return _useCurrentLocation && _currentLocation != null
        ? _currentLocation!
        : _departurePoint;
  }

  void _addDepartureMarker() {
    setState(() {
      _markers.removeWhere((m) => m.markerId.value == 'departure');
      _markers.add(
        Marker(
          markerId: const MarkerId('departure'),
          position: _currentDeparturePoint,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: InfoWindow(
            title: _useCurrentLocation ? 'Current Location' : 'Departure',
          ),
        ),
      );
    });
  }

  void _addDestinationMarker(LatLng position, String name) {
    setState(() {
      _markers.removeWhere((m) => m.markerId.value == 'destination');
      _markers.add(
        Marker(
          markerId: const MarkerId('destination'),
          position: position,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: InfoWindow(title: name),
        ),
      );
    });
  }

  Future<void> _drawRoute(LatLng destination) async {
    setState(() => _polylines.clear());
    final origin = _currentDeparturePoint;

    if (directionsApiKey.isEmpty) {
      _log('Directions API key missing. Pass --dart-define=DIRECTIONS_API_KEY=...');
      _polylines.add(
        Polyline(
          polylineId: const PolylineId('route'),
          points: [origin, destination],
          color: const Color(0xFF00BFA5),
          width: 5,
        ),
      );
      return;
    }

    try {
      final points = await _fetchRoutePolyline(origin, destination);

      if (points.isEmpty) {
        _log('No route points returned; falling back to straight line');
        setState(() {
          _polylines.add(
            Polyline(
              polylineId: const PolylineId('route'),
              points: [origin, destination],
              color: const Color(0xFF00BFA5),
              width: 5,
            ),
          );
        });
        return;
      }

      setState(() {
        _polylines.add(
          Polyline(
            polylineId: const PolylineId('route'),
            points: points,
            color: const Color(0xFF00BFA5),
            width: 6,
          ),
        );
      });

      _mapController?.animateCamera(
        CameraUpdate.newLatLngBounds(_boundsFromPoints(points), 60),
      );
    } catch (e) {
      _log('Route fetch error: $e');
      _showError('Route unavailable. Check network/API key.');
      setState(() {
        _polylines.add(
          Polyline(
            polylineId: const PolylineId('route'),
            points: [origin, destination],
            color: const Color(0xFF00BFA5),
            width: 5,
          ),
        );
      });
    }
  }

  Future<List<LatLng>> _fetchRoutePolyline(LatLng origin, LatLng destination) async {
    final url = Uri.parse(
      'https://maps.googleapis.com/maps/api/directions/json'
      '?origin=${origin.latitude},${origin.longitude}'
      '&destination=${destination.latitude},${destination.longitude}'
      '&mode=driving'
      '&key=$directionsApiKey',
    );

    final res = await http.get(url);
    if (res.statusCode != 200) {
      throw Exception('Directions failed (${res.statusCode})');
    }

    final data = json.decode(res.body) as Map<String, dynamic>;
    final routes = data['routes'] as List<dynamic>?;
    if (routes == null || routes.isEmpty) {
      throw Exception('No routes returned');
    }

    final overview = routes.first['overview_polyline'] as Map<String, dynamic>?;
    final encoded = overview?['points'] as String?;
    if (encoded == null || encoded.isEmpty) {
      throw Exception('No polyline in response');
    }

    final decoded = PolylinePoints().decodePolyline(encoded);
    return decoded.map((p) => LatLng(p.latitude, p.longitude)).toList();
  }

  LatLngBounds _boundsFromPoints(List<LatLng> points) {
    double? minLat, maxLat, minLng, maxLng;
    for (final p in points) {
      minLat = (minLat == null || p.latitude < minLat) ? p.latitude : minLat;
      maxLat = (maxLat == null || p.latitude > maxLat) ? p.latitude : maxLat;
      minLng = (minLng == null || p.longitude < minLng) ? p.longitude : minLng;
      maxLng = (maxLng == null || p.longitude > maxLng) ? p.longitude : maxLng;
    }

    return LatLngBounds(
      southwest: LatLng(minLat ?? 0, minLng ?? 0),
      northeast: LatLng(maxLat ?? 0, maxLng ?? 0),
    );
  }

  Future<void> _startRecording() async {
    _log('Start recording called');
    final status = await Permission.microphone.status;
    _log('Permission status: $status');
    
    if (status.isDenied) {
      final result = await Permission.microphone.request();
      if (!result.isGranted) {
        _showError('Microphone permission required');
        return;
      }
    } else if (status.isPermanentlyDenied) {
      _showError('Enable microphone in Settings');
      return;
    }
    
    final path = '${Directory.systemTemp.path}/audio_${DateTime.now().millisecondsSinceEpoch}.m4a';
    
    try {
      await _audioRecorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 128000, sampleRate: 44100),
        path: path,
      );
      setState(() {
        _isRecording = true;
        _statusMessage = '🎙️ Recording... Speak destination';
      });
      _log('Recording started');
    } catch (e) {
      _log('Recording error: $e');
      _showError('Recording failed: $e');
    }
  }

  Future<void> _stopRecording() async {
    _log('Stop recording called');
    try {
      final path = await _audioRecorder.stop();
      _log('Recording stopped: $path');
      
      setState(() {
        _isRecording = false;
        _isProcessing = true;
        _statusMessage = '⏳ Processing audio...';
      });

      if (path != null) {
        await _sendAudioToBackend(path);
      }
    } catch (e) {
      _log('Stop error: $e');
      _showError('Error: $e');
    }
  }

  Future<void> _sendAudioToBackend(String audioPath) async {
    _log('Sending to backend');
    try {
      final file = File(audioPath);
      final request = http.MultipartRequest('POST', Uri.parse(apiUrl));
      request.files.add(await http.MultipartFile.fromPath('audio', audioPath));

      final response = await request.send();
      final responseBody = await response.stream.bytesToString();
      _log('Response: $responseBody');
      
      final data = json.decode(responseBody);

      if (data['destination'] != null) {
        final dest = data['destination'];
        
        setState(() {
          // Reset confirmed destination state to allow new destination confirmation
          _confirmedDestinationName = null;
          _confirmedDestinationPos = null;
          _markers.removeWhere((m) => m.markerId.value == 'destination');
          _polylines.clear();
          
          // Set new pending destination
          _pendingDestination = dest;
          _matchMethod = dest['matchedBy'];
          _statusMessage = '📍 Found: ${dest['canonicalName']}';
          _textController.text = dest['canonicalName']; // Show destination name, not transcript
          _isProcessing = false;
        });
        
        // Reset camera to departure point when new destination is found
        _mapController?.animateCamera(
          CameraUpdate.newLatLngZoom(_currentDeparturePoint, 12),
        );
        
        _log('Destination found: ${dest['canonicalName']}');
      } else {
        _showError(data['error'] ?? 'No destination found');
        setState(() => _isProcessing = false);
      }
      
      await file.delete();
    } catch (e) {
      _log('Backend error: $e');
      _showError('Error: $e');
      setState(() => _isProcessing = false);
    }
  }

  void _confirmDestination() {
    if (_pendingDestination == null) return;
    
    final dest = _pendingDestination!;
    final destLatLng = LatLng(dest['lat'], dest['lon']);
    
    setState(() {
      _confirmedDestinationName = dest['canonicalName'];
      _confirmedDestinationPos = destLatLng;
      _pendingDestination = null;
      _matchMethod = null;
      _statusMessage = null;
      _textController.clear();
      _isProcessing = false;
      _isRecording = false;
    });
    
    _addDestinationMarker(destLatLng, dest['canonicalName']);
    _drawRoute(destLatLng);
  }

  void _tryAgain() {
    setState(() {
      _pendingDestination = null;
      _confirmedDestinationName = null;
      _confirmedDestinationPos = null;
      _textController.clear();
      _statusMessage = null;
      _markers.removeWhere((m) => m.markerId.value == 'destination');
      _polylines.clear();
    });
    
    _mapController?.animateCamera(
      CameraUpdate.newLatLngZoom(_currentDeparturePoint, 12),
    );
  }

  Future<void> _toggleLocationMode() async {
    if (_useCurrentLocation) {
      // Switch back to fixed location
      setState(() {
        _useCurrentLocation = false;
        _currentLocation = null;
        // Clear route since departure point changed
        _polylines.clear();
        _confirmedDestinationName = null;
        _confirmedDestinationPos = null;
        _markers.removeWhere((m) => m.markerId.value == 'destination');
      });
      _addDepartureMarker();
      _mapController?.animateCamera(
        CameraUpdate.newLatLngZoom(_departurePoint, 12),
      );
      _log('Switched to fixed departure point');
    } else {
      // Request location permission and get current location
      final granted = await _ensureLocationPermission();
      if (!granted) return;

      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showError('Please enable location services');
        return;
      }

      try {
        setState(() {
          _isProcessing = true;
          _statusMessage = '📍 Getting location...';
        });

        Position position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );

        setState(() {
          _currentLocation = LatLng(position.latitude, position.longitude);
          _useCurrentLocation = true;
          _isProcessing = false;
          _statusMessage = null;
          // Clear route since departure point changed
          _polylines.clear();
          _confirmedDestinationName = null;
          _confirmedDestinationPos = null;
          _markers.removeWhere((m) => m.markerId.value == 'destination');
        });

        _addDepartureMarker();
        _mapController?.animateCamera(
          CameraUpdate.newLatLngZoom(_currentLocation!, 15),
        );
        _log('Using current location: ${position.latitude}, ${position.longitude}');
      } catch (e) {
        _log('Location error: $e');
        _showError('Failed to get location: $e');
        setState(() {
          _isProcessing = false;
          _statusMessage = null;
        });
      }
    }
  }

  Future<bool> _ensureLocationPermission() async {
    var status = await Permission.locationWhenInUse.status;

    if (status.isGranted) {
      return true;
    }

    if (status.isDenied) {
      status = await Permission.locationWhenInUse.request();
      if (status.isGranted) return true;
    }

    if (status.isPermanentlyDenied || status.isRestricted) {
      _showError('Enable location permission in Settings');
      await openAppSettings();
      return false;
    }

    _showError('Location permission required');
    return false;
  }

  void _showAvailablePlaces() {
    // List of available places from places.json
    final places = [
      "توجنين",
      "تيارت",
      "لكصر",
      "تفرغ زينة",
      "السبخة",
      "دار النعيم",
      "عرفات",
      "عنكار دارالبركة",
      "سانكيام",
      "Port - الميناء",
      "مرصة كابيتال",
      "كارفور عين الطلح",
      "سمعة منت أجدي",
      "فور ولد سبرو",
      "كرفور بي أم دي",
      "مسجد ولد أحمدو",
      "مستشفى نواكشوط العسكري",
      "مسجد ولد اموحود",
      "مجمع عباد الرحمان 1",
      "مجمع عباد الرحمان 3",
      "بقالة الرزام",
      "مسجد التجانيين",
      "وقفة صكوك",
    ];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.info_outline, color: Color(0xFF00BFA5)),
            SizedBox(width: 8),
            Text('Available Places'),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          height: 400,
          child: ListView.builder(
            itemCount: places.length,
            itemBuilder: (context, index) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                places[index],
                style: const TextStyle(fontSize: 16),
                textDirection: TextDirection.rtl,
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showError(String message) {
    _log('Error: $message');
    setState(() => _statusMessage = '❌ $message');
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Map
          GoogleMap(
            onMapCreated: (controller) {
              _mapController = controller;
              _log('Map created');
            },
            initialCameraPosition: CameraPosition(target: _currentDeparturePoint, zoom: 12),
            markers: _markers,
            polylines: _polylines,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),
          
          // Gradient App Bar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF00BFA5),
                    const Color(0xFF00BFA5).withOpacity(0.8),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 10,
                bottom: 15,
                left: 20,
                right: 20,
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_taxi, color: Colors.white, size: 32),
                  const SizedBox(width: 12),
                  const Text(
                    'Fasty',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: Badge(
                      label: Text('${_debugLogs.length}'),
                      child: const Icon(Icons.bug_report, color: Colors.white),
                    ),
                    onPressed: _showDebugLogs,
                  ),
                  IconButton(
                    icon: Icon(
                      _useCurrentLocation ? Icons.my_location : Icons.location_on,
                      color: _useCurrentLocation ? Colors.yellow : Colors.white,
                    ),
                    tooltip: _useCurrentLocation ? 'Use Fixed Location' : 'Use Current Location',
                    onPressed: _toggleLocationMode,
                  ),
                  IconButton(
                    icon: const Icon(Icons.info_outline, color: Colors.white),
                    tooltip: 'Available Places',
                    onPressed: _showAvailablePlaces,
                  ),
                ],
              ),
            ),
          ),
          
          // Status Bar
          if (_statusMessage != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + 70,
              left: 16,
              right: 16,
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: _matchMethod == 'llm'
                          ? [Colors.purple.shade50, Colors.purple.shade100]
                          : [Colors.blue.shade50, Colors.blue.shade100],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _matchMethod == 'llm' ? Icons.psychology : Icons.search,
                        color: _matchMethod == 'llm' ? Colors.purple : Colors.blue,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _statusMessage!,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: _matchMethod == 'llm' ? Colors.purple.shade900 : Colors.blue.shade900,
                          ),
                        ),
                      ),
                      if (_matchMethod != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _matchMethod == 'llm' ? Colors.purple : Colors.blue,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _matchMethod == 'llm' ? 'AI' : 'Fuzzy',
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          
          // Confirmation Card
          if (_pendingDestination != null && _confirmedDestinationName == null)
            Center(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                child: Card(
                  elevation: 8,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Going to',
                          style: TextStyle(fontSize: 14, color: Colors.grey),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _pendingDestination!['canonicalName'],
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _tryAgain,
                                icon: const Icon(Icons.refresh),
                                label: const Text('Try Again'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.grey.shade300,
                                  foregroundColor: Colors.black87,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _confirmDestination,
                                icon: const Icon(Icons.check_circle),
                                label: const Text('Confirm'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF00BFA5),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  elevation: 4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          
          // Bottom Control Panel
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 20,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Input field
                    TextField(
                      controller: _textController,
                      readOnly: true,
                      decoration: InputDecoration(
                        hintText: 'Tap microphone to speak...',
                        filled: true,
                        fillColor: Colors.grey.shade100,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      ),
                    ),
                    const SizedBox(height: 16),
                    
                    // Microphone Button
                    GestureDetector(
                      onTap: _isProcessing ? null : (_isRecording ? _stopRecording : _startRecording),
                      child: AnimatedBuilder(
                        animation: _pulseController,
                        builder: (context, child) {
                          return Container(
                            width: 80,
                            height: 80,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: _isRecording
                                    ? [Colors.red, Colors.red.shade700]
                                    : _isProcessing
                                        ? [Colors.grey, Colors.grey.shade600]
                                        : [const Color(0xFF00BFA5), const Color(0xFF00897B)],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: (_isRecording ? Colors.red : const Color(0xFF00BFA5))
                                      .withOpacity(_isRecording ? _pulseController.value * 0.5 : 0.3),
                                  blurRadius: _isRecording ? 20 + (_pulseController.value * 10) : 15,
                                  spreadRadius: _isRecording ? 5 + (_pulseController.value * 5) : 2,
                                ),
                              ],
                            ),
                            child: _isProcessing
                                ? const Center(
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 3,
                                    ),
                                  )
                                : Icon(
                                    _isRecording ? Icons.stop : Icons.mic,
                                    color: Colors.white,
                                    size: 40,
                                  ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}