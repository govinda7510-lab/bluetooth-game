import 'dart:typed_data';
import 'package:vector_math/vector_math_64.dart';

class LatencyState {
  final double x;
  final double y;
  final int timestamp;
  
  LatencyState({required this.x, required this.y, required this.timestamp});
}

class GameSyncManager {
  static const int packetTypeHandshake = 0x01;
  static const int packetTypeMalletUpdate = 0x02;
  static const int packetTypePuckUpdate = 0x03;
  static const int packetTypeScoreUpdate = 0x04;

  final List<LatencyState> _stateBuffer = [];
  static const int interpolationDelayMs = 100;

  Uint8List packPaddleState(double x, double y) {
    final byteData = ByteData(13);
    byteData.setUint8(0, packetTypeMalletUpdate);
    byteData.setUint32(1, DateTime.now().millisecondsSinceEpoch & 0xFFFFFFFF);
    byteData.setFloat32(5, x);
    byteData.setFloat32(9, y);
    return byteData.buffer.asUint8List();
  }

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

  void ingestRemoteState(double x, double y, int timestamp) {
    _stateBuffer.add(LatencyState(x: x, y: y, timestamp: timestamp));
    if (_stateBuffer.length > 30) {
      _stateBuffer.removeAt(0);
    }
  }

  Vector2 getInterpolatedPosition() {
    if (_stateBuffer.isEmpty) return Vector2.zero();
    if (_stateBuffer.length == 1) return Vector2(_stateBuffer.first.x, _stateBuffer.first.y);

    final int renderTime = DateTime.now().millisecondsSinceEpoch - interpolationDelayMs;

    if (_stateBuffer.first.timestamp > renderTime) {
      return Vector2(_stateBuffer.first.x, _stateBuffer.first.y);
    }
    if (_stateBuffer.last.timestamp < renderTime) {
      return Vector2(_stateBuffer.last.x, _stateBuffer.last.y);
    }

    for (int i = 0; i < _stateBuffer.length - 1; i++) {
      final lhs = _stateBuffer[i];
      final rhs = _stateBuffer[i + 1];
      
      if (renderTime >= lhs.timestamp && renderTime <= rhs.timestamp) {
        final double t = (renderTime - lhs.timestamp) / (rhs.timestamp - lhs.timestamp);
        final double interpolatedX = lhs.x + (rhs.x - lhs.x) * t;
        final double interpolatedY = lhs.y + (rhs.y - lhs.y) * t;
        return Vector2(interpolatedX, interpolatedY);
      }
    }

    return Vector2(_stateBuffer.last.x, _stateBuffer.last.y);
  }
}
