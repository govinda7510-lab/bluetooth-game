import 'package:flutter/material.dart';
import 'package:flame/game.dart';
import 'package:provider/provider.dart';
import 'services/nearby_service.dart';
import 'engine/neon_air_hockey_game.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => NearbyService(username: "Player_${1000 + (DateTime.now().millisecond % 9000)}"),
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

    // Fix: Use NearbyConnectionState (renamed enum) instead of ambiguous ConnectionState
    if (nearby.state == NearbyConnectionState.connected) {
      return GamePlayScreen(
        network: nearby,
        isHost: nearby.connectedEndpointId != null &&
            nearby.discoveredDevices.containsKey(nearby.connectedEndpointId!) == false,
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
            
            if (nearby.state == NearbyConnectionState.idle) ...[
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

            if (nearby.state == NearbyConnectionState.advertising) ...[
              const Center(child: CircularProgressIndicator(color: Color(0xFF0EA5E9))),
              const SizedBox(height: 24),
              const Text(
                "Advertising Lobby Room...",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(
                "Your ID: ${nearby.username}",
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.blueGrey),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => nearby.stopAllEndpoints(),
                child: const Text("Cancel", style: TextStyle(color: Colors.redAccent)),
              ),
            ],

            if (nearby.state == NearbyConnectionState.discovering) ...[
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

            if (nearby.state == NearbyConnectionState.connecting) ...[
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
              Navigator.of(context).pop();
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
            Positioned(
              top: 20,
              left: 20,
              right: 20,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "You: ${widget.isHost ? game.scoreHost : game.scoreClient}",
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.cyanAccent),
                  ),
                  Text(
                    "Opponent: ${widget.isHost ? game.scoreClient : game.scoreHost}",
                    // Fix: Colors.violetAccent doesn't exist — replaced with purple accent
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.purpleAccent),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
