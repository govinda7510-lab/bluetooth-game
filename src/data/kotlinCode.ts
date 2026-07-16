import { CodeFile } from "./flutterCode";

export const kotlinCodeFiles: CodeFile[] = [
  {
    name: "build.gradle",
    path: "app/build.gradle",
    language: "groovy",
    description: "App-level build configurations declaring Play Services Nearby, Jetpack Compose, and Kotlin Coroutines.",
    code: `plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
}

android {
    namespace 'com.example.neon_aura_hockey'
    compileSdk 34

    defaultConfig {
        applicationId "com.example.neon_aura_hockey"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary true
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = '1.8'
    }
    buildFeatures {
        compose true
    }
    composeOptions {
        kotlinCompilerExtensionVersion '1.5.1'
    }
    packagingOptions {
        resources {
            excludes += '/META-INF/{AL2.0,LGPL2.1}'
        }
    }
}

dependencies {
    // AndroidX & Core dependencies
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.7.0'
    implementation 'androidx.activity:activity-compose:1.8.2'

    // Google Play Services Nearby Connections API
    implementation 'com.google.android.gms:play-services-nearby:19.0.2'

    // Jetpack Compose Toolkit
    implementation platform('androidx.compose:compose-bom:2023.08.00')
    implementation 'androidx.compose.ui:ui'
    implementation 'androidx.compose.ui:ui-graphics'
    implementation 'androidx.compose.ui:ui-tooling-preview'
    implementation 'androidx.compose.material3:material3'
    implementation 'androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0'

    // Kotlin Coroutines for async tasks
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'

    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}`
  },
  {
    name: "AndroidManifest.xml",
    path: "app/src/main/AndroidManifest.xml",
    language: "xml",
    description: "Detailed Android Manifest, requesting Fine Location, Bluetooth Scan/Connect, and local WiFi permissions.",
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.neon_aura_hockey">

    <!-- Play Services Nearby Connections API requirements -->
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

    <!-- Feature requirement rules -->
    <uses-feature android:name="android.hardware.bluetooth" android:required="false" />
    <uses-feature android:name="android.hardware.wifi" android:required="true" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Neon Aura Hockey"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.Design.NoActionBar">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.Design.NoActionBar"
            android:screenOrientation="portrait"
            android:configChanges="orientation|keyboardHidden|screenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`
  },
  {
    name: "NearbyConnectionManager.kt",
    path: "app/src/main/java/com/example/neon_aura_hockey/network/NearbyConnectionManager.kt",
    language: "kotlin",
    description: "Thread-safe Kotlin wrapper interfacing with Google Play Services Nearby Connections API. Drives high-speed async pairing and payload streams.",
    code: `package com.example.neon_aura_hockey.network

import android.content.Context
import android.util.Log
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import java.nio.ByteBuffer

enum class LobbyState { IDLE, ADVERTISING, DISCOVERING, CONNECTING, CONNECTED, ERROR }

class NearbyConnectionManager(private val context: Context, val myName: String) {
    
    private val connectionsClient = Nearby.getConnectionsClient(context)
    private val serviceId = "com.example.neon_aura_hockey"
    private val strategy = Strategy.P2P_POINT_TO_POINT

    var state = mutableStateOf(LobbyState.IDLE)
    var connectedEndpointId: String? = null
    var connectedEndpointName: String? = null
    
    val discoveredDevices = mutableStateListOf<DiscoveredDevice>()
    
    var onPayloadReceivedListener: ((ByteArray) -> Unit)? = null
    var onDisconnectListener: (() -> Unit)? = null

    data class DiscoveredDevice(val id: String, val name: String)

    // --- HOSTING ACTIVITY ---
    fun startAdvertising() {
        if (state.value == LobbyState.CONNECTED) return
        stopAll()
        state.value = LobbyState.ADVERTISING

        val options = AdvertisingOptions.Builder().setStrategy(strategy).build()
        connectionsClient.startAdvertising(
            myName,
            serviceId,
            connectionLifecycleCallback,
            options
        ).addOnSuccessListener {
            Log.d("Nearby", "Advertising initiated successfully!")
        }.addOnFailureListener { e ->
            Log.e("Nearby", "Advertising failed to start", e)
            state.value = LobbyState.ERROR
        }
    }

    // --- CLIENT SCANNING ---
    fun startDiscovery() {
        if (state.value == LobbyState.CONNECTED) return
        stopAll()
        discoveredDevices.clear()
        state.value = LobbyState.DISCOVERING

        val options = DiscoveryOptions.Builder().setStrategy(strategy).build()
        connectionsClient.startDiscovery(
            serviceId,
            endpointDiscoveryCallback,
            options
        ).addOnSuccessListener {
            Log.d("Nearby", "Discovery initiated successfully!")
        }.addOnFailureListener { e ->
            Log.e("Nearby", "Discovery failed to start", e)
            state.value = LobbyState.ERROR
        }
    }

    // --- INITIATE HANDSHAKE ---
    fun connectToEndpoint(endpointId: String) {
        state.value = LobbyState.CONNECTING
        connectionsClient.requestConnection(
            myName,
            endpointId,
            connectionLifecycleCallback
        ).addOnFailureListener { e ->
            Log.e("Nearby", "Connection handshake request failed", e)
            state.value = LobbyState.ERROR
        }
    }

    // --- SEND BINARY PAYLOAD ---
    fun sendBytes(data: ByteArray) {
        val endpointId = connectedEndpointId ?: return
        if (state.value == LobbyState.CONNECTED) {
            connectionsClient.sendPayload(
                endpointId,
                Payload.fromBytes(data)
            )
        }
    }

    // --- DISCOVERY CALLBACKS ---
    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            if (discoveredDevices.none { it.id == endpointId }) {
                discoveredDevices.add(DiscoveredDevice(endpointId, info.endpointName))
            }
        }

        override fun onEndpointLost(endpointId: String) {
            discoveredDevices.removeAll { it.id == endpointId }
        }
    }

    // --- CONNECTION LIFECYCLE HANDLERS ---
    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            // Auto-accept connection from both sides for high-grade offline UX
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    connectedEndpointId = endpointId
                    connectedEndpointName = discoveredDevices.find { it.id == endpointId }?.name ?: "Opponent"
                    state.value = LobbyState.CONNECTED
                    
                    connectionsClient.stopAdvertising()
                    connectionsClient.stopDiscovery()
                }
                else -> {
                    state.value = LobbyState.IDLE
                    connectedEndpointId = null
                }
            }
        }

        override fun onDisconnected(endpointId: String) {
            if (connectedEndpointId == endpointId) {
                connectedEndpointId = null
                connectedEndpointName = null
                state.value = LobbyState.IDLE
                onDisconnectListener?.invoke()
            }
        }
    }

    // --- PAYLOAD RECEIVER ---
    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                payload.asBytes()?.let {
                    onPayloadReceivedListener?.invoke(it)
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // For real-time gaming bytes, transfer updates can be ignored to preserve core threads
        }
    }

    // --- TEARDOWN ---
    fun stopAll() {
        connectionsClient.stopAdvertising()
        connectionsClient.stopDiscovery()
        connectionsClient.stopAllEndpoints()
        connectedEndpointId = null
        connectedEndpointName = null
        state.value = LobbyState.IDLE
    }
}`
  },
  {
    name: "GameSyncEngine.kt",
    path: "app/src/main/java/com/example/neon_aura_hockey/engine/GameSyncEngine.kt",
    language: "kotlin",
    description: "A timestamp-tracked lag interpolator, using binary ByteBuffers to pack paddle updates and authoritative physics snapshots.",
    code: `package com.example.neon_aura_hockey.engine

import java.nio.ByteBuffer
import java.nio.ByteOrder

data class LatencyFrame(val x: Float, val y: Float, val timestamp: Long)

class GameSyncEngine {

    companion object {
        const val PACKET_MALLET_UPDATE: Byte = 0x02
        const val PACKET_WORLD_UPDATE: Byte = 0x03
        const val INTERPOLATION_WINDOW_MS = 100L
    }

    private val stateBuffer = mutableListOf<LatencyFrame>()

    // --- PACK PADDLE DATA (13 Bytes) ---
    // [Type: 1B] [Timestamp: 8B] [X: 4B FLOAT] [Y: 4B FLOAT]
    fun packPaddleState(x: Float, y: Float): ByteArray {
        val buffer = ByteBuffer.allocate(17).apply {
            order(ByteOrder.BIG_ENDIAN)
            put(PACKET_MALLET_UPDATE)
            putLong(System.currentTimeMillis())
            putFloat(x)
            putFloat(y)
        }
        return buffer.array()
    }

    // --- PACK HOST WORLD STATE (25 Bytes) ---
    // [Type: 1B] [PuckX: 4B] [PuckY: 4B] [PuckVx: 4B] [PuckVy: 4B] [ScoreH: 4B] [ScoreC: 4B]
    fun packWorldState(puckX: Float, puckY: Float, vx: Float, vy: Float, scoreA: Int, scoreB: Int): ByteArray {
        val buffer = ByteBuffer.allocate(25).apply {
            order(ByteOrder.BIG_ENDIAN)
            put(PACKET_WORLD_UPDATE)
            putFloat(puckX)
            putFloat(puckY)
            putFloat(vx)
            putFloat(vy)
            putInt(scoreA)
            putInt(scoreB)
        }
        return buffer.array()
    }

    // --- INGEST STATE PACKET ---
    fun ingestRemoteFrame(x: Float, y: Float, timestamp: Long) {
        stateBuffer.add(LatencyFrame(x, y, timestamp))
        if (stateBuffer.size > 40) {
            stateBuffer.removeAt(0)
        }
    }

    // --- RUNNING LERPER ENGINE ---
    fun getInterpolatedPosition(): Pair<Float, Float> {
        if (stateBuffer.isEmpty()) return Pair(0f, 0f)
        if (stateBuffer.size == 1) return Pair(stateBuffer[0].x, stateBuffer[0].y)

        val renderTime = System.currentTimeMillis() - INTERPOLATION_WINDOW_MS

        // Outer boundaries
        if (stateBuffer.first().timestamp > renderTime) {
            return Pair(stateBuffer.first().x, stateBuffer.first().y)
        }
        if (stateBuffer.last().timestamp < renderTime) {
            return Pair(stateBuffer.last().x, stateBuffer.last().y)
        }

        // Loop and linear-interpolate inside buffer
        for (i in 0 until stateBuffer.size - 1) {
            val lhs = stateBuffer[i]
            val rhs = stateBuffer[i + 1]

            if (renderTime in lhs.timestamp..rhs.timestamp) {
                val totalSpan = (rhs.timestamp - lhs.timestamp).toFloat()
                val progress = if (totalSpan > 0) (renderTime - lhs.timestamp) / totalSpan else 1f
                
                val lerpX = lhs.x + (rhs.x - lhs.x) * progress
                val lerpY = lhs.y + (rhs.y - lhs.y) * progress
                return Pair(lerpX, lerpY)
            }
        }
        return Pair(stateBuffer.last().x, stateBuffer.last().y)
    }
}`
  },
  {
    name: "GameView.kt",
    path: "app/src/main/java/com/example/neon_aura_hockey/engine/GameView.kt",
    language: "kotlin",
    description: "High performance rendering thread powered by Android SurfaceView. Resolves game loops, physics collision, and redraws at maximum device FPS.",
    code: `package com.example.neon_aura_hockey.engine

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.example.neon_aura_hockey.network.NearbyConnectionManager
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

class GameView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : SurfaceView(context, attrs), SurfaceHolder.Callback, Runnable {

    private var gameThread: Thread? = null
    private var isRunning = false
    private val surfaceHolder: SurfaceHolder = holder

    lateinit var networkManager: NearbyConnectionManager
    var isHost: Boolean = true

    private val syncEngine = GameSyncEngine()

    // Game Dimension states
    private var screenWidth = 0f
    private var screenHeight = 0f

    // Coordinates
    private var hostPaddleX = 0f
    private var hostPaddleY = 0f
    private var clientPaddleX = 0f
    private var clientPaddleY = 0f
    
    private var puckX = 0f
    private var puckY = 0f
    private var puckVx = 0f
    private var puckVy = 0f

    private val puckRadius = 32f
    private val paddleRadius = 50f
    private val friction = 0.985f
    private val maxSpeed = 1500f

    var scoreHost = 0
    var scoreClient = 0

    // Render tools
    private val backgroundPaint = Paint().apply { color = Color.parseColor("#0F172A") }
    private val linePaint = Paint().apply {
        color = Color.parseColor("#38BDF8")
        alpha = 100
        style = Paint.Style.STROKE
        strokeWidth = 5f
        isAntiAlias = true
    }
    private val textPaint = Paint().apply {
        color = Color.WHITE
        textSize = 48f
        isAntiAlias = true
    }

    init {
        surfaceHolder.addCallback(this)
    }

    fun initSession(manager: NearbyConnectionManager, host: Boolean) {
        this.networkManager = manager
        this.isHost = host
        
        networkManager.onPayloadReceivedListener = { bytes ->
            decodePacket(bytes)
        }
    }

    private fun decodePacket(bytes: ByteArray) {
        if (bytes.isEmpty()) return
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)
        val type = buffer.get()

        if (type == GameSyncEngine.PACKET_MALLET_UPDATE) {
            val ts = buffer.long
            val rx = buffer.float
            val ry = buffer.float

            // Mirror positions relative to vertical orientation coordinates
            val mirroredX = screenWidth - rx
            val mirroredY = screenHeight - ry

            syncEngine.ingestRemoteFrame(mirroredX, mirroredY, ts)
        } else if (type == GameSyncEngine.PACKET_WORLD_UPDATE && !isHost) {
            puckX = screenWidth - buffer.float
            puckY = screenHeight - buffer.float
            puckVx = -buffer.float
            puckVy = -buffer.float
            scoreHost = buffer.int
            scoreClient = buffer.int
        }
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        screenWidth = width.toFloat()
        screenHeight = height.toFloat()

        hostPaddleX = screenWidth / 2f
        hostPaddleY = screenHeight * 0.8f
        clientPaddleX = screenWidth / 2f
        clientPaddleY = screenHeight * 0.2f

        puckX = screenWidth / 2f
        puckY = screenHeight / 2f

        isRunning = true
        gameThread = Thread(this).apply { start() }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        isRunning = false
        try {
            gameThread?.join()
        } catch (e: InterruptedException) {
            e.printStackTrace()
        }
    }

    override fun run() {
        var lastTime = System.nanoTime()
        while (isRunning) {
            if (!surfaceHolder.surface.isValid) continue

            val now = System.nanoTime()
            val dt = (now - lastTime) / 1_000_000_000f
            lastTime = now

            updatePhysics(dt)
            drawGame()
            
            try {
                Thread.sleep(16) // Target ~60FPS loops
            } catch (e: Exception) {}
        }
    }

    private fun updatePhysics(dt: Float) {
        // Run interpolation for the network opponent
        val interpolated = syncEngine.getInterpolatedPosition()
        if (isHost) {
            clientPaddleX = interpolated.first
            clientPaddleY = interpolated.second
            runHostPhysics(dt)
            
            // Broadcast Authoritative World Payload to remote client
            val worldData = syncEngine.packWorldState(puckX, puckY, puckVx, puckVy, scoreHost, scoreClient)
            networkManager.sendBytes(worldData)
        } else {
            hostPaddleX = interpolated.first
            hostPaddleY = interpolated.second
        }
    }

    private fun runHostPhysics(dt: Float) {
        // Decay speed
        puckVx *= friction.pow(dt * 60f)
        puckVy *= friction.pow(dt * 60f)

        puckX += puckVx * dt
        puckY += puckVy * dt

        // Horizontal bounce limits
        if (puckX - puckRadius <= 0) {
            puckX = puckRadius
            puckVx = -puckVx * 0.85f
        } else if (puckX + puckRadius >= screenWidth) {
            puckX = screenWidth - puckRadius
            puckVx = -puckVx * 0.85f
        }

        // Vertical boundaries and goal post checking
        if (puckY < 0) {
            scoreHost++
            resetPuck()
        } else if (puckY > screenHeight) {
            scoreClient++
            resetPuck()
        } else {
            if (puckY - puckRadius <= 0) {
                puckY = puckRadius
                puckVy = -puckVy * 0.85f
            } else if (puckY + puckRadius >= screenHeight) {
                puckY = screenHeight - puckRadius
                puckVy = -puckVy * 0.85f
            }
        }

        // Physics overlap resolution
        resolveImpact(hostPaddleX, hostPaddleY)
        resolveImpact(clientPaddleX, clientPaddleY)
    }

    private fun resolveImpact(paddleX: Float, paddleY: Float) {
        val dx = puckX - paddleX
        val dy = puckY - paddleY
        val distance = sqrt(dx.pow(2) + dy.pow(2))
        val minDistance = puckRadius + paddleRadius

        if (distance < minDistance) {
            val nx = dx / distance
            val ny = dy / distance
            
            puckX = paddleX + nx * minDistance

            val relativeVel = puckVx * nx + puckVy * ny
            if (relativeVel < 0) {
                val impulse = -(1f + 1.25f) * relativeVel
                puckVx += impulse * nx
                puckVy += impulse * ny

                val currentSpeed = sqrt(puckVx.pow(2) + puckVy.pow(2))
                if (currentSpeed > maxSpeed) {
                    puckVx = (puckVx / currentSpeed) * maxSpeed
                    puckVy = (puckVy / currentSpeed) * maxSpeed
                }
            }
        }
    }

    private fun resetPuck() {
        puckX = screenWidth / 2f
        puckY = screenHeight / 2f
        puckVx = 0f
        puckVy = 0f
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.action) {
            MotionEvent.ACTION_MOVE, MotionEvent.ACTION_DOWN -> {
                if (isHost) {
                    // Control bottom half
                    hostPaddleX = max(paddleRadius, min(x, screenWidth - paddleRadius))
                    hostPaddleY = max(screenHeight / 2f + paddleRadius, min(y, screenHeight - paddleRadius))
                    
                    val packet = syncEngine.packPaddleState(hostPaddleX, hostPaddleY)
                    networkManager.sendBytes(packet)
                } else {
                    // Client bottom controls
                    clientPaddleX = max(paddleRadius, min(x, screenWidth - paddleRadius))
                    clientPaddleY = max(screenHeight / 2f + paddleRadius, min(y, screenHeight - paddleRadius))
                    
                    val packet = syncEngine.packPaddleState(clientPaddleX, clientPaddleY)
                    networkManager.sendBytes(packet)
                }
            }
        }
        return true
    }

    private fun drawGame() {
        val canvas: Canvas = surfaceHolder.lockCanvas() ?: return
        try {
            // Draw background
            canvas.drawRect(0f, 0f, screenWidth, screenHeight, backgroundPaint)

            // Board designs
            canvas.drawLine(0f, screenHeight / 2f, screenWidth, screenHeight / 2f, linePaint)
            canvas.drawCircle(screenWidth / 2f, screenHeight / 2f, 120f, linePaint)

            // Red/Green Goal bars
            val redPaint = Paint().apply { color = Color.parseColor("#F43F5E") }
            val greenPaint = Paint().apply { color = Color.parseColor("#10B981") }
            canvas.drawRect(RectF(screenWidth / 2f - 150f, 0f, screenWidth / 2f + 150f, 20f), redPaint)
            canvas.drawRect(RectF(screenWidth / 2f - 150f, screenHeight - 20f, screenWidth / 2f + 150f, screenHeight), greenPaint)

            // Draw Mallets with Glow filters
            val hostPaint = Paint().apply {
                color = Color.parseColor("#06B6D4")
                isAntiAlias = true
            }
            canvas.drawCircle(hostPaddleX, hostPaddleY, paddleRadius, hostPaint)

            val clientPaint = Paint().apply {
                color = Color.parseColor("#8B5CF6")
                isAntiAlias = true
            }
            canvas.drawCircle(clientPaddleX, clientPaddleY, paddleRadius, clientPaint)

            // Draw Puck
            val puckPaint = Paint().apply {
                color = Color.parseColor("#EC4899")
                isAntiAlias = true
            }
            canvas.drawCircle(puckX, puckY, puckRadius, puckPaint)

            // Text scores overlays
            canvas.drawText("Host: \$scoreHost", 50f, 100f, textPaint)
            canvas.drawText("Client: \$scoreClient", screenWidth - 300f, 100f, textPaint)

        } finally {
            surfaceHolder.unlockCanvasAndPost(canvas)
        }
    }
}`
  },
  {
    name: "MainActivity.kt",
    path: "app/src/main/java/com/example/neon_aura_hockey/MainActivity.kt",
    language: "kotlin",
    description: "Orchestrator Activity hosting the main menu flow, runtime permission sheets, and embedding the Android SurfaceView game wrapper.",
    code: `package com.example.neon_aura_hockey

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.example.neon_aura_hockey.engine.GameView
import com.example.neon_aura_hockey.network.LobbyState
import com.example.neon_aura_hockey.network.NearbyConnectionManager
import kotlin.random.Random

class MainActivity : ComponentActivity() {

    private lateinit var connectionManager: NearbyConnectionManager
    private val requiredPermissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.NEARBY_WIFI_DEVICES,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE
        )
    } else {
        arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val randomName = "AndroidPlayer_\${Random.nextInt(1000, 9999)}"
        connectionManager = NearbyConnectionManager(this, randomName)

        checkPermissions()

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                LobbyNavigationContainer(connectionManager)
            }
        }
    }

    private fun checkPermissions() {
        val permissionsToRequest = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), 100)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        connectionManager.stopAll()
    }
}

@Composable
fun LobbyNavigationContainer(manager: NearbyConnectionManager) {
    val state by manager.state
    val context = LocalContext.current
    var showDisconnectAlert by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        manager.onDisconnectListener = {
            showDisconnectAlert = true
        }
    }

    if (showDisconnectAlert) {
        AlertDialog(
            onDismissRequest = {},
            title = { Text("Connection Disrupted") },
            text = { Text("Your opponent has disconnected. Match lobby has been closed.") },
            confirmButton = {
                TextButton(onClick = {
                    showDisconnectAlert = false
                    manager.stopAll()
                }) {
                    Text("Return to Menu")
                }
            }
        )
    }

    when (state) {
        LobbyState.CONNECTED -> {
            // Embed high-performance custom Native Game SurfaceView in Compose
            AndroidView(
                factory = { ctx ->
                    GameView(ctx).apply {
                        initSession(
                            manager = manager,
                            host = manager.connectedEndpointId != null && 
                                   manager.discoveredDevices.none { it.id == manager.connectedEndpointId }
                        )
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }
        else -> {
            LobbySetupScreen(manager, state)
        }
    }
}

@Composable
fun LobbySetupScreen(manager: NearbyConnectionManager, state: LobbyState) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "NEON AURA HOCKEY",
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF38BDF8),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            Text(
                text = "Offline Nearby Mobile Game Loop",
                fontSize = 14.sp,
                color = Color.LightGray,
                modifier = Modifier.padding(bottom = 48.dp)
            )

            when (state) {
                LobbyState.IDLE, LobbyState.ERROR -> {
                    Button(
                        onClick = { manager.startAdvertising() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0EA5E9)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                    ) {
                        Text("Create Match (Host Room)", fontSize = 16.sp, color = Color.White)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { manager.startDiscovery() },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                    ) {
                        Text("Search Match (Join Room)", fontSize = 16.sp, color = Color.White)
                    }
                }

                LobbyState.ADVERTISING -> {
                    CircularProgressIndicator(color = Color(0xFF0EA5E9))
                    Spacer(modifier = Modifier.height(24.dp))
                    Text("Advertising Room...", color = Color.White, fontSize = 18.sp)
                    Text("ID: \${manager.myName}", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    Spacer(modifier = Modifier.height(48.dp))
                    TextButton(onClick = { manager.stopAll() }) {
                        Text("Cancel & Stop", color = Color.Red)
                    }
                }

                LobbyState.DISCOVERING -> {
                    CircularProgressIndicator(color = Color(0xFF8B5CF6))
                    Spacer(modifier = Modifier.height(24.dp))
                    Text("Scanning Nearby Hosts...", color = Color.White, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(16.dp))

                    if (manager.discoveredDevices.isEmpty()) {
                        Text("Waiting for advertisements...", color = Color.Gray)
                    } else {
                        LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 250.dp)) {
                            items(manager.discoveredDevices) { device ->
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(16.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(device.name, color = Color.White, fontWeight = FontWeight.Bold)
                                        Button(
                                            onClick = { manager.connectToEndpoint(device.id) },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color.Amber)
                                        ) {
                                            Text("Connect", color = Color.Black)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                    TextButton(onClick = { manager.stopAll() }) {
                        Text("Cancel & Stop", color = Color.Red)
                    }
                }

                LobbyState.CONNECTING -> {
                    CircularProgressIndicator(color = Color.Yellow)
                    Spacer(modifier = Modifier.height(24.dp))
                    Text("Handshaking Connection...", color = Color.Yellow, fontSize = 18.sp)
                }
                else -> {}
            }
        }
    }
}`
  }
];
