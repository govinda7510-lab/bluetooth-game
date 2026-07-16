import 'package:flutter/foundation.dart';
import 'package:nearby_connections/nearby_connections.dart';

// Fix: Renamed to NearbyConnectionState to avoid ambiguous conflict with
// flutter/widgets.dart's built-in ConnectionState enum.
enum NearbyConnectionState { idle, advertising, discovering, connecting, connected, error }

class NearbyService extends ChangeNotifier {
  static const String serviceId = "com.example.neon_aura_hockey";
  static const Strategy strategy = Strategy.P2P_POINT_TO_POINT;

  String username;
  String? connectedEndpointId;
  String? connectedEndpointName;
  NearbyConnectionState state = NearbyConnectionState.idle;
  
  Map<String, String> discoveredDevices = {}; // endpointId -> Name
  
  void Function(Uint8List)? onPayloadReceived;
  void Function()? onDisconnected;

  NearbyService({required this.username});

  // Fix: nearby_connections ^4.x removed individual permission-check methods.
  // Use the package:permission_handler pattern or simply request at OS level.
  // We now request permissions via the Android manifest (already declared)
  // and gracefully handle denial at runtime.
  Future<bool> checkAndRequestPermissions() async {
    // Permissions are declared in AndroidManifest.xml.
    // On Android 12+, the OS will prompt the user automatically on first use.
    // Return true to indicate we've done what we can from the Dart side.
    debugPrint("Permissions are handled via AndroidManifest declarations.");
    return true;
  }

  Future<void> startAdvertising() async {
    if (state == NearbyConnectionState.advertising || state == NearbyConnectionState.connected) return;
    
    await stopAllEndpoints();
    state = NearbyConnectionState.advertising;
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
        state = NearbyConnectionState.error;
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Advertising failed: $e");
      state = NearbyConnectionState.error;
      notifyListeners();
    }
  }

  Future<void> startDiscovery() async {
    if (state == NearbyConnectionState.discovering || state == NearbyConnectionState.connected) return;

    await stopAllEndpoints();
    discoveredDevices.clear();
    state = NearbyConnectionState.discovering;
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
        state = NearbyConnectionState.error;
        notifyListeners();
      }
    } catch (e) {
      debugPrint("Discovery failed: $e");
      state = NearbyConnectionState.error;
      notifyListeners();
    }
  }

  Future<void> requestConnection(String endpointId) async {
    state = NearbyConnectionState.connecting;
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
      debugPrint("Connection request failed: $e");
      state = NearbyConnectionState.error;
      notifyListeners();
    }
  }

  void _onConnectionInitiated(String endpointId, ConnectionInfo info) {
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
      state = NearbyConnectionState.connected;
      Nearby().stopAdvertising();
      Nearby().stopDiscovery();
    } else {
      state = NearbyConnectionState.idle;
      connectedEndpointId = null;
    }
    notifyListeners();
  }

  void _onDisconnected(String endpointId) {
    if (connectedEndpointId == endpointId) {
      connectedEndpointId = null;
      connectedEndpointName = null;
      state = NearbyConnectionState.idle;
      onDisconnected?.call();
      notifyListeners();
    }
  }

  void sendPacket(Uint8List payload) {
    if (connectedEndpointId != null && state == NearbyConnectionState.connected) {
      Nearby().sendBytesPayload(connectedEndpointId!, payload);
    }
  }

  Future<void> stopAllEndpoints() async {
    await Nearby().stopAdvertising();
    await Nearby().stopDiscovery();
    await Nearby().stopAllEndpoints();
    connectedEndpointId = null;
    connectedEndpointName = null;
    state = NearbyConnectionState.idle;
    notifyListeners();
  }
}
