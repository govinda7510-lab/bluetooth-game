export interface CodeFile {
  name: string;
  path: string;
  language: string;
  code: string;
  description: string;
}

export const flutterCodeFiles: CodeFile[] = [
  {
    name: "pubspec.yaml",
    path: "pubspec.yaml",
    language: "yaml",
    description: "App dependencies including Flame engine, Nearby Connections API wrapper, and audio utilities.",
    code: `name: neon_aura_hockey
description: A local offline 2D multiplayer Neon Air Hockey game.
version: 1.0.0+1

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  
  # High-performance 2D game engine
  flame: ^1.18.0
  
  # Google's Nearby Connections API wrapper for Flutter
  nearby_connections: ^4.0.1
  
  # State management and event tracking
  provider: ^6.1.1
  
  # Fast, lightweight binary serialization
  flat_buffers: ^23.5.26
  
  # Vector math utilities for Flame
  vector_math: ^2.1.4

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/audio/`
  },
  {
    name: "AndroidManifest.xml",
    path: "android/app/src/main/AndroidManifest.xml",
    language: "xml",
    description: "Crucial permissions for offline discovery, including Bluetooth, Fine Location, and WiFi State.",
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.neon_aura_hockey">

    <!-- Nearby Connections Permissions -->
    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />

    <!-- Declare hardware feature requirements -->
    <uses-feature android:name="android.hardware.bluetooth" android:required="false" />
    <uses-feature android:name="android.hardware.wifi" android:required="true" />

    <application
        android:label="Neon Aura Hockey"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            
            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme" />
              
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>`
  },
  {
    name: "nearby_service.dart",
    path: "lib/services/nearby_service.dart",
    language: "dart",
    description: "Robust offline network adapter encapsulating Advertising, Discovery, Connection Request Management, and Payload Transfers.",
    code: `import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:nearby_connections/nearby_connections.dart';

enum ConnectionState { idle, advertising, discovering, connecting, connected, error }

class NearbyService extends ChangeNotifier {
  static const String serviceId = "com.example.neon_aura_hockey";
  static const Strategy strategy = Strategy.P2P_POINT_TO_POINT;

  String username;
  String? connectedEndpointId;
  String? connectedEndpointName;
  ConnectionState state = ConnectionState.idle;
  
  Map<String, String> discoveredDevices = {}; // endpointId -> Name
  
  // Callback invoked when binary payload is received from the peer
  void Function(Uint8List)? onPayloadReceived;
  // Callback invoked on peer disconnect
  void Function()? onDisconnected;

  NearbyService({required this.username});

  Future<bool> checkAndRequestPermissions() async {
    bool location = await Nearby().checkLocationPermission();
    bool externalStorage = await Nearby().checkExternalStoragePermission();
    bool bluetooth = await Nearby().checkBluetoothPermission();

    if (!location) await Nearby().askLocationPermission();
    if (!externalStorage) await Nearby().askExternalStoragePermission();
    if (!bluetooth) await Nearby().askBluetoothPermission();

    return await Nearby().checkLocationPermission() && 
           await Nearby().checkBluetoothPermission();
  }

  // --- HOST: START ADVERTISING ---
  Future<void> startAdvertising() async {
    if (state == ConnectionState.advertising || state == ConnectionState.connected) return;
    
    await stopAllEndpoints();
    state = ConnectionState.advertising;
    notifyListeners();

    try {
      bool success = await Nearby().startAdvertising(
        username,
        strategy,
        onConnectionInitiated: _onConnectionInitiated,
        onConnectionResult: _onConnectionResult,
        onDisconnected: _onDisconnected,
        serviceId: serviceId,
      );
      if (!success) {
        state = ConnectionState.error;
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Advertising failed: \$e");
      state = ConnectionState.error;
      notifyListeners();
    }
  }

  // --- CLIENT: START DISCOVERING ---
  Future<void> startDiscovery() async {
    if (state == ConnectionState.discovering || state == ConnectionState.connected) return;

    await stopAllEndpoints();
    discoveredDevices.clear();
    state = ConnectionState.discovering;
    notifyListeners();

    try {
      bool success = await Nearby().startDiscovery(
        username,
        strategy,
        onEndpointFound: (endpointId, endpointName, serviceId) {
          discoveredDevices[endpointId] = endpointName;
          notifyListeners();
        },
        onEndpointLost: (endpointId) {
          discoveredDevices.remove(endpointId);
          notifyListeners();
        },
        serviceId: serviceId,
      );
      if (!success) {
        state = ConnectionState.error;
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Discovery failed: \$e");
      state = ConnectionState.error;
      notifyListeners();
    }
  }

  // --- REQUEST CONNECTION ---
  Future<void> requestConnection(String endpointId) async {
    state = ConnectionState.connecting;
    notifyListeners();
    try {
      await Nearby().requestConnection(
        username,
        endpointId,
        onConnectionInitiated: _onConnectionInitiated,
        onConnectionResult: _onConnectionResult,
        onDisconnected: _onDisconnected,
      );
    } catch (e) {
      debugPrint("Connection request failed: \$e");
      state = ConnectionState.error;
      notifyListeners();
    }
  }

  // --- CHANNELS & HANDSHAKE ---
  void _onConnectionInitiated(String endpointId, ConnectionInfo info) {
    // Auto-accept connection on both sides for seamless UX
    Nearby().acceptConnection(
      endpointId,
      onPayLoadRecieved: (endpoint, payload) {
        if (payload.type == PayloadType.BYTES && payload.bytes != null) {
          onPayloadReceived?.call(payload.bytes!);
        }
      },
    );
  }

  void _onConnectionResult(String endpointId, Status status) {
    if (status == Status.CONNECTED) {
      connectedEndpointId = endpointId;
      connectedEndpointName = discoveredDevices[endpointId] ?? "Opponent";
      state = ConnectionState.connected;
      Nearby().stopAdvertising();
      Nearby().stopDiscovery();
    } else {
      state = ConnectionState.idle;
      connectedEndpointId = null;
    }
    notifyListeners();
  }

  void _onDisconnected(String endpointId) {
    if (connectedEndpointId == endpointId) {
      connectedEndpointId = null;
      connectedEndpointName = null;
      state = ConnectionState.idle;
      onDisconnected?.call();
      notifyListeners();
    }
  }

  // --- SEND LOW-LATENCY PACKET ---
  void sendPacket(Uint8List payload) {
    if (connectedEndpointId != null && state == ConnectionState.connected) {
      Nearby().sendBytesPayload(connectedEndpointId!, payload);
    }
  }

  // --- TEARDOWN ---
  Future<void> stopAllEndpoints() async {
    await Nearby().stopAdvertising();
    await Nearby().stopDiscovery();
    await Nearby().stopAllEndpoints();
    connectedEndpointId = null;
    connectedEndpointName = null;
    state = ConnectionState.idle;
    notifyListeners();
  }
}`
  },
  {
    name: "game_sync_manager.dart",
    path: "lib/engine/game_sync_manager.dart",
    language: "dart",
    description: "Calculates interpolation and packs coordinates into highly compact binary buffers to preserve bandwidth.",
    code: `import 'dart:typed_data';
import 'package:vector_math/vector_math_64.dart';

class LatencyState {
  final double x;
  final double y;
  final int timestamp;
  
  LatencyState({required this.x, required this.y, required this.timestamp});
}

class GameSyncManager {
  // Packet identifiers
  static const int packetTypeHandshake = 0x01;
  static const int packetTypeMalletUpdate = 0x02;
  static const int packetTypePuckUpdate = 0x03;
  static const int packetTypeScoreUpdate = 0x04;

  final List<LatencyState> _stateBuffer = [];
  static const int interpolationDelayMs = 100; // Optimal buffer window to absorb network jitter

  // --- SERIALIZE PALETTE STATE (13 Bytes) ---
  // [Type: 1B] [Timestamp: 4B] [X: 4B FLOAT] [Y: 4B FLOAT]
  Uint8List packPaddleState(double x, double y) {
    final byteData = ByteData(13);
    byteData.setUint8(0, packetTypeMalletUpdate);
    byteData.setUint32(1, DateTime.now().millisecondsSinceEpoch & 0xFFFFFFFF);
    byteData.setFloat32(5, x);
    byteData.setFloat32(9, y);
    return byteData.buffer.asUint8List();
  }

  // --- SERIALIZE COMPLETE MATCH STATE (23 Bytes) ---
  // [Type: 1B] [PuckX: 4B] [PuckY: 4B] [PuckVx: 4B] [PuckVy: 4B] [ScoreHost: 2B] [ScoreClient: 2B]
  Uint8List packHostWorldState(Vector2 puckPos, Vector2 puckVel, int scoreA, int scoreB) {
    final byteData = ByteData(21);
    byteData.setUint8(0, packetTypePuckUpdate);
    byteData.setFloat32(1, puckPos.x);
    byteData.setFloat32(5, puckPos.y);
    byteData.setFloat32(9, puckVel.x);
    byteData.setFloat32(13, puckVel.y);
    byteData.setUint16(17, scoreA);
    byteData.setUint16(19, scoreB);
    return byteData.buffer.asUint8List();
  }

  // --- UNPACK DATA ---
  void ingestRemoteState(double x, double y, int timestamp) {
    _stateBuffer.add(LatencyState(x: x, y: y, timestamp: timestamp));
    
    // Maintain a moving buffer of the last 30 frames to limit memory growth
    if (_stateBuffer.length > 30) {
      _stateBuffer.removeAt(0);
    }
  }

  // --- LERP-BASED LAG INTERPOLATOR ---
  // Locates the state matching (CurrentTime - DelayWindow) and blends positions seamlessly
  Vector2 getInterpolatedPosition() {
    if (_stateBuffer.isEmpty) return Vector2.zero();
    if (_stateBuffer.length == 1) return Vector2(_stateBuffer.first.x, _stateBuffer.first.y);

    final int renderTime = DateTime.now().millisecondsSinceEpoch - interpolationDelayMs;

    // Boundary conditions
    if (_stateBuffer.first.timestamp > renderTime) {
      return Vector2(_stateBuffer.first.x, _stateBuffer.first.y);
    }
    if (_stateBuffer.last.timestamp < renderTime) {
      return Vector2(_stateBuffer.last.x, _stateBuffer.last.y);
    }

    // Binary search for surrounding frames
    for (int i = 0; i < _stateBuffer.length - 1; i++) {
      final lhs = _stateBuffer[i];
      final rhs = _stateBuffer[i + 1];
      
      if (renderTime >= lhs.timestamp && renderTime <= rhs.timestamp) {
        final double t = (renderTime - lhs.timestamp) / (rhs.timestamp - lhs.timestamp);
        // Linear Interpolation: Lerp(a, b, t)
        final double interpolatedX = lhs.x + (rhs.x - lhs.x) * t;
        final double interpolatedY = lhs.y + (rhs.y - lhs.y) * t;
        return Vector2(interpolatedX, interpolatedY);
      }
    }

    return Vector2(_stateBuffer.last.x, _stateBuffer.last.y);
  }
}`
  },
  {
    name: "neon_air_hockey_game.dart",
    path: "lib/engine/neon_air_hockey_game.dart",
    language: "dart",
    description: "Main game controller using the Flame loop. Implements real-time 2D rigid-body collision and sync-state rendering.",
    code: `import 'dart:math';
import 'dart:typed_data';
import 'package:flame/events.dart';
import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart';
import '../services/nearby_service.dart';
import 'game_sync_manager.dart';

class NeonAirHockeyGame extends FlameGame with DragCallbacks {
  final NearbyService network;
  final bool isHost;
  final GameSyncManager syncManager = GameSyncManager();

  // Dynamic board metrics
  late Vector2 tableSize;
  
  // Game Actors
  Vector2 hostPaddle = Vector2.zero();
  Vector2 clientPaddle = Vector2.zero();
  Vector2 puckPosition = Vector2.zero();
  Vector2 puckVelocity = Vector2.zero();

  static const double puckRadius = 24.0;
  static const double paddleRadius = 38.0;
  static const double friction = 0.985;
  static const double speedLimit = 1200.0;

  int scoreHost = 0;
  int scoreClient = 0;
  
  NeonAirHockeyGame({required this.network, required this.isHost});

  @override
  Future<void> onLoad() async {
    super.onLoad();
    tableSize = size;
    
    // Standard initialization points
    hostPaddle = Vector2(tableSize.x / 2, tableSize.y * 0.8);
    clientPaddle = Vector2(tableSize.x / 2, tableSize.y * 0.2);
    puckPosition = Vector2(tableSize.x / 2, tableSize.y / 2);
    puckVelocity = Vector2.zero();

    // Attach Network Listeners
    network.onPayloadReceived = (bytes) {
      _decodeIncomingPacket(bytes);
    };
  }

  void _decodeIncomingPacket(Uint8List bytes) {
    if (bytes.isEmpty) return;
    final byteData = ByteData.sublistView(bytes);
    final type = byteData.getUint8(0);

    if (type == GameSyncManager.packetTypeMalletUpdate) {
      final int ts = byteData.getUint32(1);
      final double rx = byteData.getFloat32(5);
      final double ry = byteData.getFloat32(9);
      
      // Invert coordinates for correct top-versus-bottom viewing geometry on local devices
      final invertedX = tableSize.x - rx;
      final invertedY = tableSize.y - ry;

      if (isHost) {
        // Host ingests Client mallet
        syncManager.ingestRemoteState(invertedX, invertedY, ts);
      } else {
        // Client ingests Host mallet
        syncManager.ingestRemoteState(invertedX, invertedY, ts);
      }
    } else if (type == GameSyncManager.packetTypePuckUpdate && !isHost) {
      // Clients parse physics calculations directly from the authoritative Host
      puckPosition.x = tableSize.x - byteData.getFloat32(1);
      puckPosition.y = tableSize.y - byteData.getFloat32(5);
      puckVelocity.x = -byteData.getFloat32(9);
      puckVelocity.y = -byteData.getFloat32(13);
      scoreHost = byteData.getUint16(17);
      scoreClient = byteData.getUint16(19);
    }
  }

  @override
  void update(double dt) {
    super.update(dt);

    // Apply interpolation for the remote opponent
    if (isHost) {
      clientPaddle = syncManager.getInterpolatedPosition();
      _runServerAuthoritativePhysics(dt);
      
      // Broadcast state to remote device
      final puckPacket = syncManager.packHostWorldState(puckPosition, puckVelocity, scoreHost, scoreClient);
      network.sendPacket(puckPacket);
    } else {
      hostPaddle = syncManager.getInterpolatedPosition();
    }
  }

  void _runServerAuthoritativePhysics(double dt) {
    // 1. Apply speed decay (Air cushion drag)
    puckVelocity *= pow(friction, dt * 60.0);
    puckPosition += puckVelocity * dt;

    // 2. Bound constraints & Bounce
    if (puckPosition.x - puckRadius <= 0) {
      puckPosition.x = puckRadius;
      puckVelocity.x = -puckVelocity.x * 0.85;
    } else if (puckPosition.x + puckRadius >= tableSize.x) {
      puckPosition.x = tableSize.x - puckRadius;
      puckVelocity.x = -puckVelocity.x * 0.85;
    }

    // 3. Goal checking vs Top/Bottom Table Bounds
    if (puckPosition.y < 0) {
      scoreHost++;
      _resetPuck();
    } else if (puckPosition.y > tableSize.y) {
      scoreClient++;
      _resetPuck();
    } else {
      // Wall Bounce if not in Goal Zone
      if (puckPosition.y - puckRadius <= 0) {
        puckPosition.y = puckRadius;
        puckVelocity.y = -puckVelocity.y * 0.85;
      } else if (puckPosition.y + puckRadius >= tableSize.y) {
        puckPosition.y = tableSize.y - puckRadius;
        puckVelocity.y = -puckVelocity.y * 0.85;
      }
    }

    // 4. Rigid-Body Collisions vs Players
    _solveElasticCollision(hostPaddle, true);
    _solveElasticCollision(clientPaddle, false);
  }

  void _solveElasticCollision(Vector2 paddlePos, bool isHostPaddle) {
    double dist = puckPosition.distanceTo(paddlePos);
    double minDist = puckRadius + paddleRadius;
    if (dist < minDist) {
      Vector2 normal = (puckPosition - paddlePos).normalized();
      puckPosition = paddlePos + normal * minDist; // prevent overlap sticking

      // Calculate relative impact velocity vector
      double relativeVelocity = puckVelocity.dot(normal);
      if (relativeVelocity < 0) {
        double restitution = 1.25; // boost factor for neon game feel
        puckVelocity -= normal * (1.0 + restitution) * relativeVelocity;
        
        // Limit velocity profile
        if (puckVelocity.length > speedLimit) {
          puckVelocity = puckVelocity.normalized() * speedLimit;
        }
      }
    }
  }

  void _resetPuck() {
    puckPosition = Vector2(tableSize.x / 2, tableSize.y / 2);
    puckVelocity = Vector2.zero();
  }

  // --- DRAG INTERACTIVE GESTURES ---
  @override
  void onDragUpdate(DragUpdateEvent event) {
    super.onDragUpdate(event);
    final pos = event.localEndPosition;

    if (isHost) {
      // Host drives bottom mallet, bound within bottom half of the field
      hostPaddle.x = pos.x.clamp(paddleRadius, tableSize.x - paddleRadius);
      hostPaddle.y = pos.y.clamp(tableSize.y / 2 + paddleRadius, tableSize.y - paddleRadius);
      
      final packet = syncManager.packPaddleState(hostPaddle.x, hostPaddle.y);
      network.sendPacket(packet);
    } else {
      // Client drives bottom mallet (relative), bound within its bottom half
      clientPaddle.x = pos.x.clamp(paddleRadius, tableSize.x - paddleRadius);
      clientPaddle.y = pos.y.clamp(tableSize.y / 2 + paddleRadius, tableSize.y - paddleRadius);
      
      final packet = syncManager.packPaddleState(clientPaddle.x, clientPaddle.y);
      network.sendPacket(packet);
    }
  }

  // --- VECTOR DRAW RENDER ENGINE ---
  @override
  void render(Canvas canvas) {
    // 1. Draw Background Table layout
    final tablePaint = Paint()..color = const Color(0xFF0F172A);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.x, size.y), tablePaint);

    final linePaint = Paint()
      ..color = const Color(0xFF38BDF8).withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    
    // Halfway Divider Line
    canvas.drawLine(Offset(0, size.y / 2), Offset(size.x, size.y / 2), linePaint);
    canvas.drawCircle(Offset(size.x / 2, size.y / 2), 60.0, linePaint);

    // Goal Boxes
    canvas.drawRect(Rect.fromLTWH(size.x / 2 - 80, 0, 160, 12), Paint()..color = const Color(0xFFF43F5E));
    canvas.drawRect(Rect.fromLTWH(size.x / 2 - 80, size.y - 12, 160, 12), Paint()..color = const Color(0xFF10B981));

    // 2. Render Host Mallet (Cyan Glow)
    _drawGlowCircle(canvas, Offset(hostPaddle.x, hostPaddle.y), paddleRadius, const Color(0xFF06B6D4));

    // 3. Render Client Mallet (Violet Glow)
    _drawGlowCircle(canvas, Offset(clientPaddle.x, clientPaddle.y), paddleRadius, const Color(0xFF8B5CF6));

    // 4. Render Authoritative Puck (Neon Rose Glow)
    _drawGlowCircle(canvas, Offset(puckPosition.x, puckPosition.y), puckRadius, const Color(0xFFEC4899));
  }

  void _drawGlowCircle(Canvas canvas, Offset offset, double radius, Color color) {
    final shadowPaint = Paint()
      ..color = color.withOpacity(0.45)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawCircle(offset, radius + 4, shadowPaint);

    final solidPaint = Paint()..color = color;
    canvas.drawCircle(offset, radius, solidPaint);

    final highlightPaint = Paint()..color = Colors.white.withOpacity(0.8);
    canvas.drawCircle(offset - Offset(radius * 0.3, radius * 0.3), radius * 0.25, highlightPaint);
  }
}`
  },
  {
    name: "main.dart",
    path: "lib/main.dart",
    language: "dart",
    description: "App entrypoint launching the Device Connection Lobby before launching the high-refresh game canvas.",
    code: `import 'package:flutter/material.dart';
import 'package:flame/game.dart';
import 'package:provider/provider.dart';
import 'services/nearby_service.dart';
import 'engine/neon_air_hockey_game.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => NearbyService(username: "Player_\${1000 + (new DateTime.now().millisecond % 9000)}"),
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Neon Aura Hockey',
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B0F19),
      ),
      home: const ConnectionLobbyScreen(),
    );
  }
}

class ConnectionLobbyScreen extends StatefulWidget {
  const ConnectionLobbyScreen({super.key});

  @override
  State<ConnectionLobbyScreen> createState() => _ConnectionLobbyScreenState();
}

class _ConnectionLobbyScreenState extends State<ConnectionLobbyScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<NearbyService>(context, listen: false).checkAndRequestPermissions();
    });
  }

  @override
  Widget build(BuildContext context) {
    final nearby = Provider.of<NearbyService>(context);

    // Automatically transition to game view when peer successfully connects
    if (nearby.state == ConnectionState.connected) {
      return GamePlayScreen(
        network: nearby,
        isHost: nearby.connectedEndpointId != null && nearby.discoveredDevices.containsKey(nearby.connectedEndpointId!) == false,
      );
    }

    return Scaffold(
      body: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 48.0),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF020617)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            const Text(
              "NEON AURA HOCKEY",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 32.0,
                fontWeight: FontWeight.bold,
                color: Color(0xFF38BDF8),
                letterSpacing: 3,
                shadows: [
                  Shadow(color: Color(0xFF0284C7), blurRadius: 15),
                ],
              ),
            ),
            const SizedBox(height: 8.0),
            const Text(
              "Offline Nearby Multiplayer Engine",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14.0, color: Colors.blueGrey),
            ),
            const Spacer(),
            
            if (nearby.state == ConnectionState.idle) ...[
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  padding: const EdgeInsets.symmetric(vertical: 16.0),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.wifi_tethering, color: Colors.white),
                label: const Text("Create Match (Host)", style: TextStyle(color: Colors.white, fontSize: 16)),
                onPressed: () => nearby.startAdvertising(),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  padding: const EdgeInsets.symmetric(vertical: 16.0),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.search, color: Colors.white),
                label: const Text("Join Match (Scan)", style: TextStyle(color: Colors.white, fontSize: 16)),
                onPressed: () => nearby.startDiscovery(),
              ),
            ],

            if (nearby.state == ConnectionState.advertising) ...[
              const Center(child: CircularProgressIndicator(color: Color(0xFF0EA5E9))),
              const SizedBox(height: 24),
              const Text(
                "Advertising Lobby Room...",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(
                "Your ID: \${nearby.username}",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.blueGrey),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => nearby.stopAllEndpoints(),
                child: const Text("Cancel", style: TextStyle(color: Colors.redAccent)),
              ),
            ],

            if (nearby.state == ConnectionState.discovering) ...[
              const Center(child: CircularProgressIndicator(color: Color(0xFF8B5CF6))),
              const SizedBox(height: 24),
              const Text(
                "Scanning for Nearby Rooms...",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: nearby.discoveredDevices.isEmpty
                    ? const Center(child: Text("Waiting for hosts to broadcast...", style: TextStyle(color: Colors.grey)))
                    : ListView.builder(
                        itemCount: nearby.discoveredDevices.length,
                        itemBuilder: (context, index) {
                          String epId = nearby.discoveredDevices.keys.elementAt(index);
                          String name = nearby.discoveredDevices[epId]!;
                          return Card(
                            color: const Color(0xFF1E293B),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            margin: const EdgeInsets.symmetric(vertical: 6.0),
                            child: ListTile(
                              title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                              subtitle: const Text("Tap to connect & play", style: TextStyle(color: Colors.grey, fontSize: 12)),
                              trailing: const Icon(Icons.bolt, color: Colors.amber),
                              onTap: () => nearby.requestConnection(epId),
                            ),
                          );
                        },
                      ),
              ),
              TextButton(
                onPressed: () => nearby.stopAllEndpoints(),
                child: const Text("Cancel", style: TextStyle(color: Colors.redAccent)),
              ),
            ],

            if (nearby.state == ConnectionState.connecting) ...[
              const Center(child: CircularProgressIndicator(color: Colors.amber)),
              const SizedBox(height: 24),
              const Text(
                "Connecting & Handshaking...",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.amber, fontSize: 16),
              ),
            ],
            
            const Spacer(),
          ],
        ),
      ),
    );
  }
}

class GamePlayScreen extends StatefulWidget {
  final NearbyService network;
  final bool isHost;
  const GamePlayScreen({super.key, required this.network, required this.isHost});

  @override
  State<GamePlayScreen> createState() => _GamePlayScreenState();
}

class _GamePlayScreenState extends State<GamePlayScreen> {
  late NeonAirHockeyGame game;

  @override
  void initState() {
    super.initState();
    game = NeonAirHockeyGame(network: widget.network, isHost: widget.isHost);
    widget.network.onDisconnected = () {
      _showDisconnectedDialog();
    };
  }

  void _showDisconnectedDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text("Connection Lost"),
        content: const Text("Your opponent has disconnected from the match lobby."),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop(); // dismiss dialog
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (context) => const ConnectionLobbyScreen()),
                (route) => false,
              );
            },
            child: const Text("Return to Menu"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            GameWidget(game: game),
            
            // Score UI overlays
            Positioned(
              top: 20,
              left: 20,
              right: 20,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "You: \${widget.isHost ? game.scoreHost : game.scoreClient}",
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.cyanAccent),
                  ),
                  Text(
                    "Opponent: \${widget.isHost ? game.scoreClient : game.scoreHost}",
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.violetAccent),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}`
  }
];
