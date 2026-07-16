import React, { useState } from "react";
import { Gamepad2, Layers, Smartphone, Cpu, HelpCircle, Rocket, Sparkles } from "lucide-react";
import NetworkGameSimulator from "./components/NetworkGameSimulator";
import CodeViewer from "./components/CodeViewer";
import ArchitectureGuide from "./components/ArchitectureGuide";
import NeonAuraHockey from "./components/NeonAuraHockey";

export default function App() {
  // Navigation tabs: 'play' | 'simulator' | 'architecture' | 'flutter' | 'kotlin' | 'launch'
  const [activeTab, setActiveTab] = useState<"play" | "simulator" | "architecture" | "flutter" | "kotlin" | "launch">("play");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      
      {/* Visual Header / Premium Navigation Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-purple-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Gamepad2 className="w-5.5 h-5.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Neon Aura Hockey</h1>
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-pink-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">PRO v2.0</span>
              </div>
              <p className="text-xs text-slate-400">Offline P2P Multiplayer &amp; Physics Sync Simulator</p>
            </div>
          </div>

          {/* Symmetrical Navigation Controls */}
          <nav className="flex flex-wrap items-center justify-center bg-slate-900/50 border border-slate-900 p-1.5 rounded-xl gap-1">
            <button
              id="tab-btn-play"
              onClick={() => setActiveTab("play")}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
                activeTab === "play" 
                  ? "bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md shadow-cyan-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Play Game</span>
            </button>

            <button
              id="tab-btn-simulator"
              onClick={() => setActiveTab("simulator")}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
                activeTab === "simulator" 
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>P2P Sandbox</span>
            </button>

            <button
              id="tab-btn-architecture"
              onClick={() => setActiveTab("architecture")}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
                activeTab === "architecture" 
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Sync Math</span>
            </button>

            <button
              id="tab-btn-flutter"
              onClick={() => setActiveTab("flutter")}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
                activeTab === "flutter" 
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Flutter Source</span>
            </button>

            <button
              id="tab-btn-kotlin"
              onClick={() => setActiveTab("kotlin")}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
                activeTab === "kotlin" 
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kotlin Source</span>
            </button>

            <button
              id="tab-btn-launch"
              onClick={() => setActiveTab("launch")}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition duration-150 ${
                activeTab === "launch" 
                  ? "bg-sky-500 text-white shadow-md shadow-sky-500/10" 
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Launch Prep</span>
            </button>
          </nav>

        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dynamic Screen router */}
        <div className="transition-all duration-300">
          {activeTab === "play" && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl max-w-2xl text-center">
                <h2 className="text-2xl font-black text-white tracking-tight">Play Neon Aura Hockey</h2>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Launch the interactive game simulation below. The engine uses zero-allocation canvas loops, dynamic vector reflection, and adaptive AI bots for maximum 60FPS fluid playability.
                </p>
              </div>
              <NeonAuraHockey />
            </div>
          )}

          {activeTab === "simulator" && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl max-w-3xl">
                <h2 className="text-xl font-bold text-white tracking-tight">Interactive Local Multiplayer Playground</h2>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Experience first-hand how coordinates synchronize over Nearby socket protocols. Drag the active mallets below. 
                  Adjust the <strong>Latency</strong> and <strong>Packet Loss</strong> parameters to see how linear interpolation (Lerp) and Dead Reckoning prevent micro-stuttering on remote peers.
                </p>
              </div>
              <NetworkGameSimulator />
            </div>
          )}

          {activeTab === "architecture" && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl max-w-2xl">
                <h2 className="text-xl font-bold text-white tracking-tight">Networking &amp; Interpolation Math</h2>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Deep-dive into vector mathematics, byte stream optimization, and asymmetrical coordinate geometries used to maintain fluent 60FPS local gameplay.
                </p>
              </div>
              <ArchitectureGuide />
            </div>
          )}

          {activeTab === "flutter" && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl max-w-2xl">
                <h2 className="text-xl font-bold text-white tracking-tight">Flutter + Flame Engine Architecture</h2>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Highly optimized, production-ready codebase using the <code className="text-sky-400 font-mono text-xs">nearby_connections</code> pub package for local advertising, packet handshakes, and canvas rendering loops.
                </p>
              </div>
              <CodeViewer framework="flutter" />
            </div>
          )}

          {activeTab === "kotlin" && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl max-w-2xl">
                <h2 className="text-xl font-bold text-white tracking-tight">Native Android (Kotlin) Architecture</h2>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Clean-architecture Kotlin implementation built with Play Services Nearby Connections and custom SurfaceView drawing threads for minimal touch latency.
                </p>
              </div>
              <CodeViewer framework="kotlin" />
            </div>
          )}

          {activeTab === "launch" && (
            <div className="space-y-6">
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl max-w-2xl">
                <h2 className="text-xl font-bold text-white tracking-tight">Play Store Launch, Compliance &amp; Monetization</h2>
                <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                  Production-grade integrations for Google Play Store compliance, crash-proofing, memory leak prevention, and user-friendly offline AdMob banners and interstitials.
                </p>
              </div>
              <CodeViewer framework="launch" />
            </div>
          )}
        </div>

      </main>

      {/* Developer footer signature */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Aura Hockey Multiplayer Suite. All rights reserved.</p>
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-600" />
              <span>Fully offline architecture ready for deployment to Android devices</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

