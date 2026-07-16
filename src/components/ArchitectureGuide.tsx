import React from "react";
import { Network, Cpu, Sliders, Layers, Zap, Info, Shield, CheckCircle2 } from "lucide-react";

export default function ArchitectureGuide() {
  return (
    <div id="architecture-guide-root" className="space-y-8">
      
      {/* 1. FLOWCHART ENGINE DIALECTIC */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <Network className="w-5 h-5 text-sky-400" />
          <h3 className="text-white font-semibold text-lg">Nearby Connections Protocol Lifecycle</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          The game leverages Google's offline P2P sockets using the <strong>P2P_POINT_TO_POINT</strong> discovery strategy. 
          This opens a high-bandwidth, low-latency raw socket channel utilizing dual Bluetooth-LE and Local Wi-Fi frequencies simultaneously.
        </p>

        {/* Custom SVG flow chart */}
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-900 flex flex-col md:flex-row items-center justify-around space-y-6 md:space-y-0">
          
          {/* Host Side */}
          <div className="flex flex-col items-center text-center space-y-2.5 max-w-[160px]">
            <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/45">
              <span className="font-bold text-sm">HOST</span>
            </div>
            <p className="text-xs font-semibold text-slate-200">StartAdvertising()</p>
            <p className="text-[10px] text-slate-500">Broadcasting Bluetooth LE service discovery advertisements.</p>
          </div>

          <div className="text-slate-600 font-bold text-lg hidden md:block">➔</div>

          {/* Handshake Phase */}
          <div className="flex flex-col items-center text-center space-y-2.5 max-w-[180px]">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-500">
              <Zap className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-200">AcceptConnection()</p>
            <p className="text-[10px] text-slate-500">Symmetric auto-acceptance after handshake token match verification.</p>
          </div>

          <div className="text-slate-600 font-bold text-lg hidden md:block">➔</div>

          {/* Client Side */}
          <div className="flex flex-col items-center text-center space-y-2.5 max-w-[160px]">
            <div className="w-12 h-12 rounded-full bg-violet-950 border border-violet-500 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-950/45">
              <span className="font-bold text-sm">CLIENT</span>
            </div>
            <p className="text-xs font-semibold text-slate-200">StartDiscovery()</p>
            <p className="text-[10px] text-slate-500">Scanning RF bounds. RequestConnection() on found endpoint.</p>
          </div>

        </div>
      </div>

      {/* 2. THE LERPING MATHEMATICAL FORMULA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Lag Interpolation Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <Cpu className="w-5 h-5 text-violet-400" />
              <h4 className="text-white font-semibold">1. Linear Lag Interpolation</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Directly rendering raw packets triggers noticeable stuttering from wireless packet clustering (jitter). To avoid this, our loop maintains an historical state buffer, delayed by exactly 100ms, and calculates smooth linear blends:
            </p>
            
            {/* Equation callout */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 font-mono text-center text-xs text-violet-400 py-6 my-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-sans">Linear Interpolation Formula</p>
              <p className="text-sm font-semibold">P_render = P_lhs + (P_rhs - P_lhs) × t</p>
              <p className="text-[9px] text-slate-500 mt-2 font-sans">Where: t = (RenderTime - timestamp_lhs) / (timestamp_rhs - timestamp_lhs)</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-medium">Resolves jitter completely at the expense of a tiny 100ms latency.</span>
          </div>
        </div>

        {/* Dead Reckoning Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h4 className="text-white font-semibold">2. Dead Reckoning Extrapolation</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              When temporary signal interference drops packets (e.g., 20% packet loss), we can't interpolate between missing points. Instead, the game engine falls back to <em>Dead Reckoning</em>, projecting the object along its last known velocity vector:
            </p>

            {/* Equation callout */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 font-mono text-center text-xs text-emerald-400 py-6 my-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-sans">Extrapolation Formula</p>
              <p className="text-sm font-semibold">P_est = P_last + (V_last × Δt)</p>
              <p className="text-[9px] text-slate-500 mt-2 font-sans">Extrapolates movement vectors seamlessly until new packets re-sync.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-medium">Maintains fluent physics simulations even through extreme wireless signal drops.</span>
          </div>
        </div>

      </div>

      {/* 3. HARDWARE ORIENTATION AND PERFORMANCE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <Layers className="w-5 h-5 text-amber-500" />
          <h3 className="text-white font-semibold text-lg">Cross-Device Architectural Guidelines</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <h5 className="text-slate-200 font-semibold text-xs">A. Symmetrical Coordinate Geometry</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              In head-to-head local gaming, both players need to play on the bottom half of their physical screen. 
              Our packet deserializer mirrors the received opponent coordinates on the center line: 
              <br/><code className="font-mono text-amber-500 text-[10px]">X_mirrored = Width - X_raw</code>
              <br/><code className="font-mono text-amber-500 text-[10px]">Y_mirrored = Height - Y_raw</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <h5 className="text-slate-200 font-semibold text-xs">B. High-Performance Byte Packing</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Standard serializations (like JSON, XML) trigger extensive string parsing, high RAM allocation, and force heavy garbage collection (GC) sweeps on mobile devices. 
              Our code uses raw binary <strong className="text-sky-400 font-mono">ByteBuffer</strong> buffers. High-frequency paddle state packets are only <strong>13 bytes</strong>, preserving memory channels.
            </p>
          </div>

          <div className="space-y-1.5">
            <h5 className="text-slate-200 font-semibold text-xs">C. Server-Authoritative Physics</h5>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              To prevent dual-paddle desync and state conflicts on the puck collision vector, the game appoints the <strong>Host (Advertising player)</strong> as the sole physics simulation authority. 
              The Client acts as a passive rendering display that pipes touch-input vectors to the server.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
