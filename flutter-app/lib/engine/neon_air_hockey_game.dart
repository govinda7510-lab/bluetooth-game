import 'dart:math';
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

  late Vector2 tableSize;
  
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
    
    hostPaddle = Vector2(tableSize.x / 2, tableSize.y * 0.8);
    clientPaddle = Vector2(tableSize.x / 2, tableSize.y * 0.2);
    puckPosition = Vector2(tableSize.x / 2, tableSize.y / 2);
    puckVelocity = Vector2.zero();

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
      
      final invertedX = tableSize.x - rx;
      final invertedY = tableSize.y - ry;

      if (isHost) {
        syncManager.ingestRemoteState(invertedX, invertedY, ts);
      } else {
        syncManager.ingestRemoteState(invertedX, invertedY, ts);
      }
    } else if (type == GameSyncManager.packetTypePuckUpdate && !isHost) {
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

    if (isHost) {
      clientPaddle = syncManager.getInterpolatedPosition();
      _runServerAuthoritativePhysics(dt);
      
      final puckPacket = syncManager.packHostWorldState(puckPosition, puckVelocity, scoreHost, scoreClient);
      network.sendPacket(puckPacket);
    } else {
      hostPaddle = syncManager.getInterpolatedPosition();
    }
  }

  void _runServerAuthoritativePhysics(double dt) {
    puckVelocity *= pow(friction, dt * 60.0);
    puckPosition += puckVelocity * dt;

    if (puckPosition.x - puckRadius <= 0) {
      puckPosition.x = puckRadius;
      puckVelocity.x = -puckVelocity.x * 0.85;
    } else if (puckPosition.x + puckRadius >= tableSize.x) {
      puckPosition.x = tableSize.x - puckRadius;
      puckVelocity.x = -puckVelocity.x * 0.85;
    }

    if (puckPosition.y < 0) {
      scoreHost++;
      _resetPuck();
    } else if (puckPosition.y > tableSize.y) {
      scoreClient++;
      _resetPuck();
    } else {
      if (puckPosition.y - puckRadius <= 0) {
        puckPosition.y = puckRadius;
        puckVelocity.y = -puckVelocity.y * 0.85;
      } else if (puckPosition.y + puckRadius >= tableSize.y) {
        puckPosition.y = tableSize.y - puckRadius;
        puckVelocity.y = -puckVelocity.y * 0.85;
      }
    }

    _solveElasticCollision(hostPaddle, true);
    _solveElasticCollision(clientPaddle, false);
  }

  void _solveElasticCollision(Vector2 paddlePos, bool isHostPaddle) {
    double dist = puckPosition.distanceTo(paddlePos);
    double minDist = puckRadius + paddleRadius;
    if (dist < minDist) {
      Vector2 normal = (puckPosition - paddlePos).normalized();
      puckPosition = paddlePos + normal * minDist;

      double relativeVelocity = puckVelocity.dot(normal);
      if (relativeVelocity < 0) {
        double restitution = 1.25;
        puckVelocity -= normal * (1.0 + restitution) * relativeVelocity;
        
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

  @override
  void onDragUpdate(DragUpdateEvent event) {
    super.onDragUpdate(event);
    final pos = event.localEndPosition;

    if (isHost) {
      hostPaddle.x = pos.x.clamp(paddleRadius, tableSize.x - paddleRadius);
      hostPaddle.y = pos.y.clamp(tableSize.y / 2 + paddleRadius, tableSize.y - paddleRadius);
      
      final packet = syncManager.packPaddleState(hostPaddle.x, hostPaddle.y);
      network.sendPacket(packet);
    } else {
      clientPaddle.x = pos.x.clamp(paddleRadius, tableSize.x - paddleRadius);
      clientPaddle.y = pos.y.clamp(tableSize.y / 2 + paddleRadius, tableSize.y - paddleRadius);
      
      final packet = syncManager.packPaddleState(clientPaddle.x, clientPaddle.y);
      network.sendPacket(packet);
    }
  }

  @override
  void render(Canvas canvas) {
    final tablePaint = Paint()..color = const Color(0xFF0F172A);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.x, size.y), tablePaint);

    final linePaint = Paint()
      ..color = const Color(0xFF38BDF8).withOpacity(0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    
    canvas.drawLine(Offset(0, size.y / 2), Offset(size.x, size.y / 2), linePaint);
    canvas.drawCircle(Offset(size.x / 2, size.y / 2), 60.0, linePaint);

    canvas.drawRect(Rect.fromLTWH(size.x / 2 - 80, 0, 160, 12), Paint()..color = const Color(0xFFF43F5E));
    canvas.drawRect(Rect.fromLTWH(size.x / 2 - 80, size.y - 12, 160, 12), Paint()..color = const Color(0xFF10B981));

    _drawGlowCircle(canvas, Offset(hostPaddle.x, hostPaddle.y), paddleRadius, const Color(0xFF06B6D4));
    _drawGlowCircle(canvas, Offset(clientPaddle.x, clientPaddle.y), paddleRadius, const Color(0xFF8B5CF6));
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
}
