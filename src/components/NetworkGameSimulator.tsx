import React, { useState, useEffect, useRef } from "react";
import { Laptop, Smartphone, Wifi, RefreshCw, Send, AlertTriangle, Play, Zap, Info } from "lucide-react";

interface Packet {
  timestamp: string;
  type: "MALLET" | "WORLD" | "HANDSHAKE" | "DISCONNECT";
  size: number;
  hex: string;
  sender: "Host" | "Client";
}

interface DelayedPayload {
  deliverAt: number;
  data: any;
}

export default function NetworkGameSimulator() {
  // Connection states: 'idle' | 'advertising' | 'discovering' | 'connecting' | 'connected' | 'disconnected'
  const [connectionState, setConnectionState] = useState<"idle" | "advertising" | "discovering" | "connecting" | "connected" | "disconnected">("idle");
  
  // Simulated Networking settings
  const [latency, setLatency] = useState<number>(80); // in ms
  const [packetLoss, setPacketLoss] = useState<number>(5); // in %
  const [enableInterpolation, setEnableInterpolation] = useState<boolean>(true);
  
  // Scores
  const [scoreHost, setScoreHost] = useState<number>(0);
  const [scoreClient, setScoreClient] = useState<number>(0);
  
  // Debug Monitor logs
  const [packetLog, setPacketLog] = useState<Packet[]>([]);
  const packetCountRef = useRef<number>(0);

  // Canvas dimensions
  const width = 240;
  const height = 360;

  // Host local positions (authoritative)
  const hostPaddleRef = useRef({ x: 120, y: 300 });
  const hostPuckRef = useRef({ x: 120, y: 180, vx: 1.5, vy: -1.5 });
  // Host's view of Client paddle
  const hostRemoteClientPaddleRef = useRef({ x: 120, y: 60 });

  // Client local positions
  const clientPaddleRef = useRef({ x: 120, y: 300 }); // local bottom is client
  // Client's view of Host paddle and Puck (from network)
  const clientRemoteHostPaddleRef = useRef({ x: 120, y: 60 });
  const clientPuckRef = useRef({ x: 120, y: 180, vx: 0, vy: 0 });

  // Buffer lists for network interpolation [ {x, y, ts} ]
  const hostIncomingClientBuffer = useRef<{ x: number; y: number; ts: number }[]>([]);
  const clientIncomingHostBuffer = useRef<{ x: number; y: number; ts: number }[]>([]);
  const clientIncomingPuckBuffer = useRef<{ x: number; y: number; vx: number; vy: number; ts: number }[]>([]);

  // Simulation network queues (to simulate latency)
  const hostToClientQueue = useRef<DelayedPayload[]>([]);
  const clientToHostQueue = useRef<DelayedPayload[]>([]);

  // Canvas elements
  const hostCanvasRef = useRef<HTMLCanvasElement>(null);
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active inputs
  const hostDragRef = useRef<boolean>(false);
  const clientDragRef = useRef<boolean>(false);

  // Log packet utility
  const logPacket = (type: "MALLET" | "WORLD" | "HANDSHAKE" | "DISCONNECT", size: number, sender: "Host" | "Client") => {
    const hexChars = "0123456789ABCDEF";
    let hex = "0" + (type === "MALLET" ? "2" : type === "WORLD" ? "03" : "01");
    for (let i = 0; i < size - 2; i++) {
      hex += hexChars[Math.floor(Math.random() * 16)];
    }
    const newPacket: Packet = {
      timestamp: new Date().toLocaleTimeString().split(" ")[0] + "." + String(Date.now() % 1000).padStart(3, "0"),
      type,
      size,
      hex: hex.substring(0, 24) + (hex.length > 24 ? "..." : ""),
      sender,
    };
    setPacketLog((prev) => [newPacket, ...prev.slice(0, 15)]);
  };

  // Connect flow triggers
  const startAdvertising = () => {
    setConnectionState("advertising");
    setTimeout(() => {
      // Simulate client entering discovery mode and automatically finding it
    }, 1000);
  };

  const startDiscovery = () => {
    setConnectionState("discovering");
  };

  const connectDevices = () => {
    setConnectionState("connecting");
    setTimeout(() => {
      setConnectionState("connected");
      setScoreHost(0);
      setScoreClient(0);
      logPacket("HANDSHAKE", 12, "Client");
      logPacket("HANDSHAKE", 12, "Host");
    }, 1200);
  };

  const triggerDisconnect = () => {
    setConnectionState("disconnected");
    logPacket("DISCONNECT", 4, "Host");
  };

  const resetToIdle = () => {
    setConnectionState("idle");
    setPacketLog([]);
    // Reset positions
    hostPaddleRef.current = { x: 120, y: 300 };
    hostPuckRef.current = { x: 120, y: 180, vx: 2, vy: -2 };
    hostRemoteClientPaddleRef.current = { x: 120, y: 60 };
    clientPaddleRef.current = { x: 120, y: 300 };
    clientRemoteHostPaddleRef.current = { x: 120, y: 60 };
    clientPuckRef.current = { x: 120, y: 180, vx: 0, vy: 0 };
    hostIncomingClientBuffer.current = [];
    clientIncomingHostBuffer.current = [];
    clientIncomingPuckBuffer.current = [];
    hostToClientQueue.current = [];
    clientToHostQueue.current = [];
  };

  // Main high-frequency game logic and sync scheduler
  useEffect(() => {
    if (connectionState !== "connected") return;

    let active = true;
    let lastTime = performance.now();
    let networkTickTimer = 0;

    const gameLoop = (now: number) => {
      if (!active) return;
      const dt = Math.min((now - lastTime) / 1000, 0.1); // clamp dt to avoid giant leaps
      lastTime = now;

      // --- 1. RUN SERVER/HOST AUTHORITATIVE PHYSICS ---
      const puck = hostPuckRef.current;
      const hPaddle = hostPaddleRef.current;
      const cPaddleOnHost = hostRemoteClientPaddleRef.current;

      // Friction
      puck.vx *= Math.pow(0.99, dt * 60);
      puck.vy *= Math.pow(0.99, dt * 60);
      
      // Update position
      puck.x += puck.vx * dt * 60;
      puck.y += puck.vy * dt * 60;

      // Bounce sides
      const rPuck = 10;
      if (puck.x - rPuck < 0) {
        puck.x = rPuck;
        puck.vx = -puck.vx * 0.9;
      } else if (puck.x + rPuck > width) {
        puck.x = width - rPuck;
        puck.vx = -puck.vx * 0.9;
      }

      // Goals (Y bounds)
      const inGoalZone = puck.x > width / 2 - 40 && puck.x < width / 2 + 40;
      if (puck.y < 0) {
        if (inGoalZone) {
          setScoreHost((s) => s + 1);
          puck.x = width / 2;
          puck.y = height / 2;
          puck.vx = (Math.random() - 0.5) * 4;
          puck.vy = 2;
        } else {
          puck.y = rPuck;
          puck.vy = -puck.vy * 0.9;
        }
      } else if (puck.y > height) {
        if (inGoalZone) {
          setScoreClient((s) => s + 1);
          puck.x = width / 2;
          puck.y = height / 2;
          puck.vx = (Math.random() - 0.5) * 4;
          puck.vy = -2;
        } else {
          puck.y = height - rPuck;
          puck.vy = -puck.vy * 0.9;
        }
      }

      // Check collision with Host Mallet
      let dx = puck.x - hPaddle.x;
      let dy = puck.y - hPaddle.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      const rPaddle = 18;
      if (dist < rPuck + rPaddle) {
        const nx = dx / dist;
        const ny = dy / dist;
        puck.x = hPaddle.x + nx * (rPuck + rPaddle);
        const relVel = puck.vx * nx + puck.vy * ny;
        if (relVel < 0) {
          const impulse = -2.1 * relVel; // energetic bounce
          puck.vx += impulse * nx;
          puck.vy += impulse * ny;
        }
      }

      // Check collision with Client Mallet (as reflected on Host)
      dx = puck.x - cPaddleOnHost.x;
      dy = puck.y - cPaddleOnHost.y;
      dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < rPuck + rPaddle) {
        const nx = dx / dist;
        const ny = dy / dist;
        puck.x = cPaddleOnHost.x + nx * (rPuck + rPaddle);
        const relVel = puck.vx * nx + puck.vy * ny;
        if (relVel < 0) {
          const impulse = -2.1 * relVel;
          puck.vx += impulse * nx;
          puck.vy += impulse * ny;
        }
      }

      // Clamp puck speed
      const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
      if (speed > 12) {
        puck.vx = (puck.vx / speed) * 12;
        puck.vy = (puck.vy / speed) * 12;
      }

      // --- 2. PACKET EMISSION SCHEDULES (Tick-based, ~30Hz to match Nearby capacity) ---
      networkTickTimer += dt * 1000;
      if (networkTickTimer >= 33) {
        networkTickTimer = 0;
        const sendTime = Date.now();

        // Host broadcasts absolute puck state & scores to Client
        if (Math.random() * 100 >= packetLoss) {
          hostToClientQueue.current.push({
            deliverAt: sendTime + latency,
            data: {
              type: "WORLD",
              px: puck.x,
              py: puck.y,
              vx: puck.vx,
              vy: puck.vy,
              ts: sendTime,
            },
          });
        } else {
          // Packet dropped!
        }

        // Host broadcasts its mallet position to Client (Client views it inverted at top)
        if (Math.random() * 100 >= packetLoss) {
          hostToClientQueue.current.push({
            deliverAt: sendTime + latency,
            data: {
              type: "MALLET_HOST",
              x: hPaddle.x,
              y: hPaddle.y,
              ts: sendTime,
            },
          });
        }

        // Client broadcasts its mallet state to Host
        const cPaddle = clientPaddleRef.current;
        if (Math.random() * 100 >= packetLoss) {
          clientToHostQueue.current.push({
            deliverAt: sendTime + latency,
            data: {
              type: "MALLET_CLIENT",
              x: cPaddle.x,
              y: cPaddle.y,
              ts: sendTime,
            },
          });
        }
      }

      // --- 3. INGEST DELIVERED PACKETS FROM QUEUES ---
      const currentTime = Date.now();

      // Host ingests Client packets
      while (hostToClientQueue.current.length > 0 && hostToClientQueue.current[0].deliverAt <= currentTime) {
        const payload = hostToClientQueue.current.shift()!;
        const item = payload.data;
        if (item.type === "WORLD") {
          // Unpack puck position (inverted geometry: Client sees top as top)
          const invX = width - item.px;
          const invY = height - item.py;
          
          if (enableInterpolation) {
            clientIncomingPuckBuffer.current.push({
              x: invX,
              y: invY,
              vx: -item.vx,
              vy: -item.vy,
              ts: item.ts,
            });
            if (clientIncomingPuckBuffer.current.length > 15) clientIncomingPuckBuffer.current.shift();
          } else {
            clientPuckRef.current.x = invX;
            clientPuckRef.current.y = invY;
          }
          if (Math.random() < 0.15) logPacket("WORLD", 21, "Host");
        } else if (item.type === "MALLET_HOST") {
          const invX = width - item.x;
          const invY = height - item.y;
          if (enableInterpolation) {
            clientIncomingHostBuffer.current.push({ x: invX, y: invY, ts: item.ts });
            if (clientIncomingHostBuffer.current.length > 15) clientIncomingHostBuffer.current.shift();
          } else {
            clientRemoteHostPaddleRef.current.x = invX;
            clientRemoteHostPaddleRef.current.y = invY;
          }
        }
      }

      // Client delivers to Host
      while (clientToHostQueue.current.length > 0 && clientToHostQueue.current[0].deliverAt <= currentTime) {
        const payload = clientToHostQueue.current.shift()!;
        const item = payload.data;
        if (item.type === "MALLET_CLIENT") {
          const invX = width - item.x;
          const invY = height - item.y;
          if (enableInterpolation) {
            hostIncomingClientBuffer.current.push({ x: invX, y: invY, ts: item.ts });
            if (hostIncomingClientBuffer.current.length > 15) hostIncomingClientBuffer.current.shift();
          } else {
            hostRemoteClientPaddleRef.current.x = invX;
            hostRemoteClientPaddleRef.current.y = invY;
          }
          if (Math.random() < 0.15) logPacket("MALLET", 13, "Client");
        }
      }

      // --- 4. APPLY LERP INTERPOLATION ---
      const interpDelay = 100; // 100ms render delay buffer
      const renderTime = currentTime - interpDelay;

      // Host interpolating Client's paddle
      if (enableInterpolation && hostIncomingClientBuffer.current.length > 1) {
        const buf = hostIncomingClientBuffer.current;
        if (buf[0].ts <= renderTime && buf[buf.length - 1].ts >= renderTime) {
          for (let i = 0; i < buf.length - 1; i++) {
            const lhs = buf[i];
            const rhs = buf[i + 1];
            if (renderTime >= lhs.ts && renderTime <= rhs.ts) {
              const t = (renderTime - lhs.ts) / (rhs.ts - lhs.ts);
              hostRemoteClientPaddleRef.current.x = lhs.x + (rhs.x - lhs.x) * t;
              hostRemoteClientPaddleRef.current.y = lhs.y + (rhs.y - lhs.y) * t;
              break;
            }
          }
        } else if (buf[buf.length - 1].ts < renderTime) {
          // Dead reckoning fallback: lock to newest state
          hostRemoteClientPaddleRef.current.x = buf[buf.length - 1].x;
          hostRemoteClientPaddleRef.current.y = buf[buf.length - 1].y;
        }
      }

      // Client interpolating Host's paddle
      if (enableInterpolation && clientIncomingHostBuffer.current.length > 1) {
        const buf = clientIncomingHostBuffer.current;
        if (buf[0].ts <= renderTime && buf[buf.length - 1].ts >= renderTime) {
          for (let i = 0; i < buf.length - 1; i++) {
            const lhs = buf[i];
            const rhs = buf[i + 1];
            if (renderTime >= lhs.ts && renderTime <= rhs.ts) {
              const t = (renderTime - lhs.ts) / (rhs.ts - lhs.ts);
              clientRemoteHostPaddleRef.current.x = lhs.x + (rhs.x - lhs.x) * t;
              clientRemoteHostPaddleRef.current.y = lhs.y + (rhs.y - lhs.y) * t;
              break;
            }
          }
        } else if (buf[buf.length - 1].ts < renderTime) {
          clientRemoteHostPaddleRef.current.x = buf[buf.length - 1].x;
          clientRemoteHostPaddleRef.current.y = buf[buf.length - 1].y;
        }
      }

      // Client interpolating the Puck
      if (enableInterpolation && clientIncomingPuckBuffer.current.length > 1) {
        const buf = clientIncomingPuckBuffer.current;
        if (buf[0].ts <= renderTime && buf[buf.length - 1].ts >= renderTime) {
          for (let i = 0; i < buf.length - 1; i++) {
            const lhs = buf[i];
            const rhs = buf[i + 1];
            if (renderTime >= lhs.ts && renderTime <= rhs.ts) {
              const t = (renderTime - lhs.ts) / (rhs.ts - lhs.ts);
              clientPuckRef.current.x = lhs.x + (rhs.x - lhs.x) * t;
              clientPuckRef.current.y = lhs.y + (rhs.y - lhs.y) * t;
              break;
            }
          }
        } else if (buf[buf.length - 1].ts < renderTime) {
          // Dead reckoning extrapolator: pos = lastPos + vel * delta
          const last = buf[buf.length - 1];
          const deltaSec = (renderTime - last.ts) / 1000;
          clientPuckRef.current.x = last.x + last.vx * deltaSec * 60;
          clientPuckRef.current.y = last.y + last.vy * deltaSec * 60;
        }
      }

      // --- 5. REDRAW CANVASES ---
      drawScreen(hostCanvasRef.current, hostPaddleRef.current, hostRemoteClientPaddleRef.current, hostPuckRef.current, "Host");
      drawScreen(clientCanvasRef.current, clientPaddleRef.current, clientRemoteHostPaddleRef.current, clientPuckRef.current, "Client");

      requestAnimationFrame(gameLoop);
    };

    const drawScreen = (
      canvas: HTMLCanvasElement | null,
      bottomPaddle: { x: number; y: number },
      topPaddle: { x: number; y: number },
      puck: { x: number; y: number },
      label: "Host" | "Client"
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear Screen
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, width, height);

      // Center Divider Circle and Line
      ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Draw Goals
      ctx.fillStyle = "rgba(244, 63, 94, 0.5)";
      ctx.fillRect(width / 2 - 40, 0, 80, 5); // opponent side goal (top)
      ctx.fillStyle = "rgba(16, 185, 129, 0.5)";
      ctx.fillRect(width / 2 - 40, height - 5, 80, 5); // player side goal (bottom)

      // 1. Draw top opponent mallet (Violet for Client, Cyan for Host)
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = label === "Host" ? "#8B5CF6" : "#06B6D4";
      ctx.fillStyle = label === "Host" ? "#8B5CF6" : "#06B6D4";
      ctx.beginPath();
      ctx.arc(topPaddle.x, topPaddle.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Draw bottom local player mallet
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = label === "Host" ? "#06B6D4" : "#8B5CF6";
      ctx.fillStyle = label === "Host" ? "#06B6D4" : "#8B5CF6";
      ctx.beginPath();
      ctx.arc(bottomPaddle.x, bottomPaddle.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Draw puck (Neon Rose)
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#EC4899";
      ctx.fillStyle = "#EC4899";
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    requestAnimationFrame(gameLoop);
    return () => {
      active = false;
    };
  }, [connectionState, latency, packetLoss, enableInterpolation]);

  // Handle Drag gestures inside simulated mobile phone canvases
  const handleHostTouch = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (connectionState !== "connected" || !hostCanvasRef.current) return;
    const canvas = hostCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const mouseX = ((clientX - rect.left) / rect.width) * width;
    const mouseY = ((clientY - rect.top) / rect.height) * height;

    // Constraint: Can only drive paddle in bottom half
    hostPaddleRef.current.x = Math.max(18, Math.min(mouseX, width - 18));
    hostPaddleRef.current.y = Math.max(height / 2 + 18, Math.min(mouseY, height - 18));
  };

  const handleClientTouch = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (connectionState !== "connected" || !clientCanvasRef.current) return;
    const canvas = clientCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const mouseX = ((clientX - rect.left) / rect.width) * width;
    const mouseY = ((clientY - rect.top) / rect.height) * height;

    // Client constraints
    clientPaddleRef.current.x = Math.max(18, Math.min(mouseX, width - 18));
    clientPaddleRef.current.y = Math.max(height / 2 + 18, Math.min(mouseY, height - 18));
  };

  return (
    <div id="simulator-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
      
      {/* Interactive Mobile Sandbox Canvases */}
      <div className="lg:col-span-8 flex flex-col items-center justify-center space-y-6">
        <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Wifi className="w-5 h-5 text-sky-400 animate-pulse" />
            <h3 className="text-white font-semibold text-lg">Nearby Sandbox Simulator</h3>
          </div>
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-mono text-slate-300 capitalize">{connectionState}</span>
          </div>
        </div>

        {connectionState === "idle" && (
          <div className="h-[440px] flex flex-col items-center justify-center text-center space-y-4 max-w-md">
            <div className="w-16 h-16 bg-sky-950 border border-sky-800 text-sky-400 rounded-2xl flex items-center justify-center animate-bounce">
              <Laptop className="w-8 h-8" />
            </div>
            <h4 className="text-white font-semibold text-lg">Offline Connection Simulation</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Launch two virtual peer devices in the room. Observe Nearby Connection state handshakes, direct payload streaming, and latency smoothing.
            </p>
            <div className="flex space-x-4 pt-2">
              <button
                id="btn-advertise"
                onClick={startAdvertising}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm rounded-xl transition duration-150 flex items-center space-x-2 shadow-lg shadow-sky-900/30"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Host (Advertise)</span>
              </button>
              <button
                id="btn-discover"
                onClick={startDiscovery}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm rounded-xl transition duration-150 flex items-center space-x-2 shadow-lg shadow-violet-900/30"
              >
                <Smartphone className="w-4 h-4" />
                <span>Join (Discover)</span>
              </button>
            </div>
          </div>
        )}

        {connectionState === "advertising" && (
          <div className="h-[440px] flex flex-col items-center justify-center text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 bg-sky-950/50 border border-sky-800/40 rounded-full flex items-center justify-center relative">
              <span className="absolute inset-0 rounded-full border-2 border-sky-400/30 animate-ping"></span>
              <Wifi className="w-6 h-6 text-sky-400" />
            </div>
            <h4 className="text-white font-semibold">Advertising...</h4>
            <p className="text-xs font-mono text-slate-500">Service: com.example.neon_aura_hockey</p>
            <p className="text-sm text-slate-400">Broadcasting high-frequency Bluetooth & LAN tokens. Waiting for local device handshakes...</p>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Simulated Host Name</span>
                <span className="font-mono text-sky-400 font-semibold">Phone_A_Host</span>
              </div>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                id="btn-host-connect"
                onClick={connectDevices}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition"
              >
                Simulate Discovery Match
              </button>
              <button onClick={resetToIdle} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {connectionState === "discovering" && (
          <div className="h-[440px] flex flex-col items-center justify-center text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 bg-violet-950/50 border border-violet-800/40 rounded-full flex items-center justify-center relative">
              <span className="absolute inset-0 rounded-full border-2 border-violet-400/30 animate-ping"></span>
              <Smartphone className="w-6 h-6 text-violet-400" />
            </div>
            <h4 className="text-white font-semibold">Scanning...</h4>
            <p className="text-xs text-slate-400">Searching Nearby connections (WIFI/Bluetooth frequencies)</p>
            
            <div className="w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-2 text-left">
              <p className="text-xs text-slate-500 px-2 pb-2 border-b border-slate-900 font-medium">Discovered Endpoints</p>
              <div className="p-2 flex items-center justify-between hover:bg-slate-900 rounded-lg transition mt-1">
                <div>
                  <p className="text-sm text-white font-medium">Phone_A_Host</p>
                  <p className="text-[10px] text-slate-500 font-mono">ID: xF92K (P2P_POINT_TO_POINT)</p>
                </div>
                <button
                  id="btn-join-room"
                  onClick={connectDevices}
                  className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-md transition"
                >
                  Connect
                </button>
              </div>
            </div>

            <button onClick={resetToIdle} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition mt-2">
              Cancel
            </button>
          </div>
        )}

        {connectionState === "connecting" && (
          <div className="h-[440px] flex flex-col items-center justify-center text-center space-y-4">
            <RefreshCw className="w-12 h-12 text-amber-500 animate-spin" />
            <h4 className="text-white font-semibold">Initiating Socket Handshake</h4>
            <p className="text-sm text-slate-400 max-w-xs">Exchanging Nearby auth tokens. Negotiating secure socket connection...</p>
          </div>
        )}

        {connectionState === "connected" && (
          <div className="flex flex-col md:flex-row items-center justify-center md:space-x-8 space-y-6 md:space-y-0 py-2">
            
            {/* DEVICE A: HOST */}
            <div className="flex flex-col items-center">
              <div className="flex items-center space-x-1 mb-2">
                <span className="text-xs font-semibold font-mono text-cyan-400">Device A (Host - Cyan)</span>
              </div>
              <div className="border-4 border-slate-700 bg-slate-950 rounded-[2rem] p-3 shadow-xl relative overflow-hidden">
                {/* Score Indicator Overlay */}
                <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none z-10">
                  <span className="text-xs font-bold font-mono text-cyan-400 bg-slate-950/70 px-2 py-0.5 rounded border border-cyan-400/20">You: {scoreHost}</span>
                  <span className="text-xs font-bold font-mono text-violet-400 bg-slate-950/70 px-2 py-0.5 rounded border border-violet-400/20">Peer: {scoreClient}</span>
                </div>
                
                <canvas
                  id="canvas-host"
                  ref={hostCanvasRef}
                  width={width}
                  height={height}
                  onMouseMove={handleHostTouch}
                  onTouchMove={handleHostTouch}
                  onMouseDown={() => { hostDragRef.current = true; }}
                  onMouseUp={() => { hostDragRef.current = false; }}
                  className="rounded-2xl cursor-crosshair bg-slate-950 select-none touch-none border border-slate-900"
                />
                
                <p className="text-[9px] text-center text-slate-500 mt-2 font-mono">DRAG MOUSE INSIDE BOTTOM HALF</p>
              </div>
            </div>

            {/* CONNECTION GRAPHIC */}
            <div className="hidden md:flex flex-col items-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400 shadow-inner">
                <Zap className="w-5 h-5 animate-pulse" />
              </div>
              <div className="h-20 w-0.5 border-r border-dashed border-sky-500/50"></div>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">Nearby<br/>Channel</span>
            </div>

            {/* DEVICE B: CLIENT */}
            <div className="flex flex-col items-center">
              <div className="flex items-center space-x-1 mb-2">
                <span className="text-xs font-semibold font-mono text-violet-400">Device B (Client - Violet)</span>
              </div>
              <div className="border-4 border-slate-700 bg-slate-950 rounded-[2rem] p-3 shadow-xl relative overflow-hidden">
                {/* Score Indicator Overlay */}
                <div className="absolute top-6 left-6 right-6 flex justify-between pointer-events-none z-10">
                  <span className="text-xs font-bold font-mono text-violet-400 bg-slate-950/70 px-2 py-0.5 rounded border border-violet-400/20">You: {scoreClient}</span>
                  <span className="text-xs font-bold font-mono text-cyan-400 bg-slate-950/70 px-2 py-0.5 rounded border border-cyan-400/20">Peer: {scoreHost}</span>
                </div>

                <canvas
                  id="canvas-client"
                  ref={clientCanvasRef}
                  width={width}
                  height={height}
                  onMouseMove={handleClientTouch}
                  onTouchMove={handleClientTouch}
                  onMouseDown={() => { clientDragRef.current = true; }}
                  onMouseUp={() => { clientDragRef.current = false; }}
                  className="rounded-2xl cursor-crosshair bg-slate-950 select-none touch-none border border-slate-900"
                />

                <p className="text-[9px] text-center text-slate-500 mt-2 font-mono">DRAG MOUSE INSIDE BOTTOM HALF</p>
              </div>
            </div>

          </div>
        )}

        {connectionState === "disconnected" && (
          <div className="h-[440px] flex flex-col items-center justify-center text-center space-y-4 max-w-sm">
            <div className="w-16 h-16 bg-rose-950/50 border border-rose-800/40 rounded-full flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h4 className="text-white font-semibold">Match Connection Disrupted</h4>
            <p className="text-sm text-slate-400">
              The Nearby Connection layer reported packet failure (Status: DISCONNECTED). The game state has been safely paused.
            </p>
            <button
              id="btn-return-lobby"
              onClick={resetToIdle}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition"
            >
              Return to Lobby Menu
            </button>
          </div>
        )}

      </div>

      {/* Network Metrics & Log Stream Dashboard */}
      <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-800 pt-6 lg:pt-0 lg:pl-6 flex flex-col space-y-6">
        <div>
          <h4 className="text-white font-semibold text-sm mb-3">Sync & Network Options</h4>
          <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            
            {/* Latency Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Simulated Latency</span>
                <span className="font-mono text-sky-400 font-semibold">{latency} ms</span>
              </div>
              <input
                id="slider-latency"
                type="range"
                min="0"
                max="500"
                step="10"
                value={latency}
                onChange={(e) => setLatency(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <span className="text-[9px] text-slate-500">Real Bluetooth range is 30-80ms; hotspot LAN is 10-30ms.</span>
            </div>

            {/* Packet Loss Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Simulated Packet Loss</span>
                <span className="font-mono text-rose-400 font-semibold">{packetLoss}%</span>
              </div>
              <input
                id="slider-loss"
                type="range"
                min="0"
                max="50"
                step="1"
                value={packetLoss}
                onChange={(e) => setPacketLoss(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* Toggle Interpolation */}
            <div className="flex items-center justify-between border-t border-slate-900 pt-3">
              <div>
                <p className="text-xs text-white font-medium">Render Interpolation</p>
                <p className="text-[10px] text-slate-500">Lag buffer and Lerp physics</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="toggle-interpolation"
                  type="checkbox"
                  checked={enableInterpolation}
                  onChange={(e) => setEnableInterpolation(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

          </div>
        </div>

        {/* Live Packet Log Stream */}
        <div className="flex-1 flex flex-col min-h-[180px]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-semibold text-sm">Nearby Packet Monitor</h4>
            <span className="text-[10px] font-mono text-slate-500">Bytes via Sockets</span>
          </div>
          
          <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] p-3 overflow-y-auto max-h-[220px] space-y-2">
            {connectionState === "connected" ? (
              packetLog.length > 0 ? (
                packetLog.map((pkt, idx) => (
                  <div key={idx} className="flex items-start justify-between border-b border-slate-900 pb-1.5 last:border-0">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1">
                        <span className="text-slate-500 font-medium">{pkt.timestamp}</span>
                        <span className={`px-1 rounded text-[8px] font-bold ${
                          pkt.type === "MALLET" ? "bg-violet-950 text-violet-400 border border-violet-900" :
                          pkt.type === "WORLD" ? "bg-cyan-950 text-cyan-400 border border-cyan-900" : "bg-amber-950 text-amber-400"
                        }`}>{pkt.type}</span>
                        <span className="text-[9px] text-slate-400 font-bold">{pkt.sender === "Host" ? "A → B" : "B → A"}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 truncate max-w-[170px] mt-0.5">{pkt.hex}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold">{pkt.size} B</span>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-center py-6">
                  Waiting for network payload logs...
                </div>
              )
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-center py-6">
                Offline. Connect Peer devices to stream packet logs.
              </div>
            )}
          </div>
        </div>

        {/* Action controls */}
        {connectionState === "connected" && (
          <button
            id="btn-kill-conn"
            onClick={triggerDisconnect}
            className="w-full py-2 bg-rose-950/40 hover:bg-rose-950/60 border border-rose-800/50 text-rose-400 text-xs font-semibold rounded-lg transition duration-150 flex items-center justify-center space-x-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Simulate Disconnect Exception</span>
          </button>
        )}
      </div>

    </div>
  );
}
