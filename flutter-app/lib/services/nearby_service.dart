import 'dart:typed_data';
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
  
  void Function(Uint8List)? onPayloadReceived;
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
      debugPrint("Advertising failed: $e");
      state = ConnectionState.error;
      notifyListeners();
    }
  }

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
      debugPrint("Discovery failed: $e");
      state = ConnectionState.error;
      notifyListeners();
    }
  }

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
      debugPrint("Connection request failed: $e");
      state = ConnectionState.error;
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

  void sendPacket(Uint8List payload) {
    if (connectedEndpointId != null && state == ConnectionState.connected) {
      Nearby().sendBytesPayload(connectedEndpointId!, payload);
    }
  }

  Future<void> stopAllEndpoints() async {
    await Nearby().stopAdvertising();
    await Nearby().stopDiscovery();
    await Nearby().stopAllEndpoints();
    connectedEndpointId = null;
    connectedEndpointName = null;
    state = ConnectionState.idle;
    notifyListeners();
  }
}
