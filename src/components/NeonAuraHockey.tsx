import React, { useState, useEffect, useRef } from "react";
import { Gamepad2, Play, Users, Cpu, RotateCcw, ArrowLeft, Trophy, VolumeX, ShieldAlert, Sparkles } from "lucide-react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
}

interface TrailNode {
  x: number;
  y: number;
}

type GameMode = "menu" | "mode_select" | "countdown" | "playing" | "game_over";
type PlayMode = "ai" | "local_1v1";
type Difficulty = "easy" | "medium" | "hard";

export default function NeonAuraHockey() {
  const [gameState, setGameState] = useState<GameMode>("menu");
  const [playMode, setPlayMode] = useState<PlayMode>("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [scoreRed, setScoreRed] = useState<number>(0);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [winner, setWinner] = useState<"Red" | "Blue" | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [screenShake, setScreenShake] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Dimensions
  const gameWidth = 400;
  const gameHeight = 650;
  const paddleRadius = 25;
  const puckRadius = 15;
  const goalWidth = 140;

  // Physics Positions
  const puckRef = useRef({ x: 200, y: 325, vx: 0, vy: 0 });
  const paddleBlueRef = useRef({ x: 200, y: 550, lastX: 200, lastY: 550 }); // Bottom (Player)
  const paddleRedRef = useRef({ x: 200, y: 100, lastX: 200, lastY: 100 });  // Top (AI or Player 2)

  // Particles & Trails
  const particlesRef = useRef<Particle[]>([]);
  const puckTrailRef = useRef<TrailNode[]>([]);
  const paddleBlueTrailRef = useRef<TrailNode[]>([]);
  const paddleRedTrailRef = useRef<TrailNode[]>([]);

  // Drag tracking
  const activeTouchesRef = useRef<{ [key: string]: { paddle: "blue" | "red"; startY: number } }>({});

  const triggerShake = () => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 300);
  };

  const createExplosion = (x: number, y: number, color: string, count: number = 20) => {
    const tempParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      tempParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 4 + 2,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.015,
      });
    }
    particlesRef.current.push(...tempParticles);
  };

  const resetPuck = (servingTo: "Red" | "Blue") => {
    puckRef.current = {
      x: gameWidth / 2,
      y: servingTo === "Blue" ? gameHeight / 2 + 50 : gameHeight / 2 - 50,
      vx: (Math.random() - 0.5) * 2,
      vy: servingTo === "Blue" ? 2 : -2,
    };
    puckTrailRef.current = [];
  };

  const resetPositions = () => {
    paddleBlueRef.current = { x: gameWidth / 2, y: 550, lastX: gameWidth / 2, lastY: 550 };
    paddleRedRef.current = { x: gameWidth / 2, y: 100, lastX: gameWidth / 2, lastY: 100 };
    paddleBlueTrailRef.current = [];
    paddleRedTrailRef.current = [];
  };

  const startGame = (mode: PlayMode) => {
    setPlayMode(mode);
    setScoreRed(0);
    setScoreBlue(0);
    setWinner(null);
    setGameState("countdown");
    setCountdown(3);
    resetPositions();
    puckRef.current = { x: gameWidth / 2, y: gameHeight / 2, vx: 0, vy: 0 };
  };

  // Countdown timer effect
  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setGameState("playing");
      resetPuck(Math.random() > 0.5 ? "Blue" : "Red");
    }
  }, [countdown, gameState]);

  // Main high-performance simulation loop
  useEffect(() => {
    if (gameState !== "playing") {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.666, 2); // cap max frame leap
      lastTime = time;

      const puck = puckRef.current;
      const blue = paddleBlueRef.current;
      const red = paddleRedRef.current;

      // Update trails
      puckTrailRef.current.push({ x: puck.x, y: puck.y });
      if (puckTrailRef.current.length > 8) puckTrailRef.current.shift();
      paddleBlueTrailRef.current.push({ x: blue.x, y: blue.y });
      if (paddleBlueTrailRef.current.length > 6) paddleBlueTrailRef.current.shift();
      paddleRedTrailRef.current.push({ x: red.x, y: red.y });
      if (paddleRedTrailRef.current.length > 6) paddleRedTrailRef.current.shift();

      // Calculate instantaneous paddle velocities for transfer of momentum
      const velBlueX = blue.x - blue.lastX;
      const velBlueY = blue.y - blue.lastY;
      const velRedX = red.x - red.lastX;
      const velRedY = red.y - red.lastY;

      // Cache positions
      blue.lastX = blue.x;
      blue.lastY = blue.y;
      red.lastX = red.x;
      red.lastY = red.y;

      // AI Logic
      if (playMode === "ai") {
        let aiSpeed = 3.5;
        if (difficulty === "easy") aiSpeed = 2.2;
        if (difficulty === "hard") aiSpeed = 5.2;

        const targetX = puck.x;
        // Defensive or attacking threshold Y
        let targetY = 100;

        if (puck.y < gameHeight / 2) {
          // If puck is on AI's side, take aggressive calculations
          if (puck.y < 200 && Math.abs(puck.x - red.x) < 80) {
            targetY = puck.y;
          } else {
            targetY = puck.y - 40;
          }
        } else {
          // Idle back to home position
          targetY = 100;
        }

        // Restrict AI within bounds
        const idealY = Math.max(paddleRadius + 10, Math.min(targetY, gameHeight / 2 - paddleRadius - 10));
        const idealX = Math.max(paddleRadius + 10, Math.min(targetX, gameWidth - paddleRadius - 10));

        red.x += (idealX - red.x) * 0.15 * aiSpeed * dt;
        red.y += (idealY - red.y) * 0.15 * aiSpeed * dt;
      }

      // Puck Physics: Friction damping
      puck.vx *= Math.pow(0.992, dt);
      puck.vy *= Math.pow(0.992, dt);

      // Integrate positions
      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;

      // Outer boundary wall bounce calculations
      const minX = puckRadius;
      const maxX = gameWidth - puckRadius;
      
      // X boundaries bounce
      if (puck.x < minX) {
        puck.x = minX;
        puck.vx = -puck.vx * 0.85;
        createExplosion(puck.x, puck.y, "#06B6D4", 8);
      } else if (puck.x > maxX) {
        puck.x = maxX;
        puck.vx = -puck.vx * 0.85;
        createExplosion(puck.x, puck.y, "#06B6D4", 8);
      }

      // Goal detection
      const inGoalX = puck.x > (gameWidth / 2 - goalWidth / 2) && puck.x < (gameWidth / 2 + goalWidth / 2);

      // Top Y boundary (Red Goal)
      if (puck.y - puckRadius < 0) {
        if (inGoalX) {
          // Blue scores
          setScoreBlue((s) => {
            const next = s + 1;
            if (next >= 7) {
              setWinner("Blue");
              setGameState("game_over");
            } else {
              triggerShake();
              createExplosion(puck.x, puck.y, "#ec4899", 35);
              resetPuck("Red");
            }
            return next;
          });
        } else {
          puck.y = puckRadius;
          puck.vy = -puck.vy * 0.85;
          createExplosion(puck.x, puck.y, "#ec4899", 8);
        }
      }

      // Bottom Y boundary (Blue Goal)
      if (puck.y + puckRadius > gameHeight) {
        if (inGoalX) {
          // Red scores
          setScoreRed((s) => {
            const next = s + 1;
            if (next >= 7) {
              setWinner("Red");
              setGameState("game_over");
            } else {
              triggerShake();
              createExplosion(puck.x, puck.y, "#06B6D4", 35);
              resetPuck("Blue");
            }
            return next;
          });
        } else {
          puck.y = gameHeight - puckRadius;
          puck.vy = -puck.vy * 0.85;
          createExplosion(puck.x, puck.y, "#ec4899", 8);
        }
      }

      // Collision helper between circle and mallets
      const checkCollision = (paddle: typeof paddleBlueRef.current, pVelX: number, pVelY: number) => {
        const dx = puck.x - paddle.x;
        const dy = puck.y - paddle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDist = paddleRadius + puckRadius;

        if (distance < minDist) {
          const nx = dx / distance;
          const ny = dy / distance;

          // Push puck out of collision intersection
          puck.x = paddle.x + nx * minDist;
          puck.y = paddle.y + ny * minDist;

          // Calculate relative velocity along collision normal
          const kx = puck.vx - pVelX;
          const ky = puck.vy - pVelY;
          const relVel = kx * nx + ky * ny;

          // Only apply impulse if objects are moving towards each other
          if (relVel < 0) {
            const restitution = 1.15; // springy neon speed boost
            const impulse = -(1 + restitution) * relVel;
            puck.vx += nx * impulse;
            puck.vy += ny * impulse;

            // Cap puck speed for control and clean frame rates
            const maxSpeed = 16;
            const currentSpeed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy);
            if (currentSpeed > maxSpeed) {
              puck.vx = (puck.vx / currentSpeed) * maxSpeed;
              puck.vy = (puck.vy / currentSpeed) * maxSpeed;
            }

            createExplosion(puck.x, puck.y, "#e11d48", 12);
          }
        }
      };

      checkCollision(blue, velBlueX, velBlueY);
      checkCollision(red, velRedX, velRedY);

      // Update floating sparks
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      // Draw everything
      draw();

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark background fill
      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, gameWidth, gameHeight);

      // Arena Glow lines
      ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, gameWidth, gameHeight);

      // Center Divider Circle & line
      ctx.strokeStyle = "rgba(139, 92, 246, 0.25)";
      ctx.beginPath();
      ctx.arc(gameWidth / 2, gameHeight / 2, 70, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, gameHeight / 2);
      ctx.lineTo(gameWidth, gameHeight / 2);
      ctx.stroke();

      // Top Goal Line (Red)
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(gameWidth / 2 - goalWidth / 2, 2);
      ctx.lineTo(gameWidth / 2 + goalWidth / 2, 2);
      ctx.stroke();

      // Bottom Goal Line (Blue)
      ctx.strokeStyle = "#06b6d4";
      ctx.beginPath();
      ctx.moveTo(gameWidth / 2 - goalWidth / 2, gameHeight - 2);
      ctx.lineTo(gameWidth / 2 + goalWidth / 2, gameHeight - 2);
      ctx.stroke();

      // Draw Trails
      // Puck trail
      const trail = puckTrailRef.current;
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        const ratio = (i + 1) / trail.length;
        ctx.fillStyle = `rgba(225, 29, 72, ${ratio * 0.25})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, puckRadius * ratio, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Puck
      const puck = puckRef.current;
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#f43f5e";
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puckRadius, 0, Math.PI * 2);
      ctx.fill();
      // Puck inner design
      ctx.fillStyle = "#ffe4e6";
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puckRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Red Mallet (Top)
      const red = paddleRedRef.current;
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#d946ef";
      ctx.fillStyle = "#d946ef";
      ctx.beginPath();
      ctx.arc(red.x, red.y, paddleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fdf4ff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Draw Blue Mallet (Bottom)
      const blue = paddleBlueRef.current;
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#06b6d4";
      ctx.fillStyle = "#06b6d4";
      ctx.beginPath();
      ctx.arc(blue.x, blue.y, paddleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ecfeff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Draw Particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, playMode, difficulty]);

  // Handle pointer/touch dragging on the screen
  const processInput = (clientX: number, clientY: number, pointerId: string | number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Scale coordinates inside canvas dimensions
    const scaleX = gameWidth / rect.width;
    const scaleY = gameHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Define boundary zones: Player 1 (Bottom Half), Player 2 (Top Half)
    const isBottomHalf = y > gameHeight / 2;

    if (playMode === "local_1v1") {
      if (isBottomHalf) {
        // Control Blue paddle
        paddleBlueRef.current.x = Math.max(paddleRadius, Math.min(x, gameWidth - paddleRadius));
        paddleBlueRef.current.y = Math.max(gameHeight / 2 + paddleRadius + 2, Math.min(y, gameHeight - paddleRadius));
      } else {
        // Control Red paddle
        paddleRedRef.current.x = Math.max(paddleRadius, Math.min(x, gameWidth - paddleRadius));
        paddleRedRef.current.y = Math.max(paddleRadius, Math.min(y, gameHeight / 2 - paddleRadius - 2));
      }
    } else {
      // Single player AI Mode (Only bottom half works)
      if (isBottomHalf) {
        paddleBlueRef.current.x = Math.max(paddleRadius, Math.min(x, gameWidth - paddleRadius));
        paddleBlueRef.current.y = Math.max(gameHeight / 2 + paddleRadius + 2, Math.min(y, gameHeight - paddleRadius));
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    processInput(e.clientX, e.clientY, e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (canvasRef.current && canvasRef.current.hasPointerCapture(e.pointerId)) {
      processInput(e.clientX, e.clientY, e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (canvasRef.current) {
      canvasRef.current.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-2 select-none">
      
      {/* Title / Score Display HUD */}
      {gameState === "playing" && (
        <div className="w-full max-w-[400px] flex items-center justify-between px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl mb-4 shadow-xl">
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Opponent</span>
            <span className="text-xl font-bold font-mono text-pink-500 neon-text-magenta">{scoreRed}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-slate-950 border border-slate-800 text-purple-400 font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono">
              {playMode === "ai" ? `vs AI (${difficulty})` : "Local 1v1"}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">You</span>
            <span className="text-xl font-bold font-mono text-cyan-400 neon-text-cyan">{scoreBlue}</span>
          </div>
        </div>
      )}

      {/* Main Interactive Screen Frame */}
      <div className={`relative border-[6px] border-slate-800 rounded-[2.5rem] bg-slate-950 shadow-2xl p-2.5 overflow-hidden transition-transform duration-75 ${screenShake ? "animate-shake" : ""}`}>
        
        {/* Splash Menu Screen */}
        {gameState === "menu" && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 mb-6">
              <Gamepad2 className="w-9 h-9" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 tracking-tight">
              NEON AURA
            </h2>
            <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-1">Air Hockey Experience</p>
            
            <p className="text-sm text-slate-400 max-w-xs mt-4 leading-relaxed">
              Fast, high-fidelity responsive air hockey physics built with zero-lag canvas inputs.
            </p>

            <button
              onClick={() => setGameState("mode_select")}
              className="mt-8 px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-sm rounded-xl transition duration-150 flex items-center space-x-2 shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>LAUNCH GAME</span>
            </button>
          </div>
        )}

        {/* Mode Selector Screen */}
        {gameState === "mode_select" && (
          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6">
            <h3 className="text-xl font-bold text-white mb-6">Select Match Type</h3>

            <div className="w-full space-y-4 max-w-[280px]">
              <button
                onClick={() => startGame("ai")}
                className="w-full p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 rounded-2xl text-left transition duration-150 flex items-center space-x-4 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Player vs AI</h4>
                  <p className="text-[11px] text-slate-500">Test your reflexes against neural bots.</p>
                </div>
              </button>

              <button
                onClick={() => startGame("local_1v1")}
                className="w-full p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-pink-500/50 rounded-2xl text-left transition duration-150 flex items-center space-x-4 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-pink-950 border border-pink-800 text-pink-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Local 1v1 Dual</h4>
                  <p className="text-[11px] text-slate-500">Play split-screen on the same device.</p>
                </div>
              </button>
            </div>

            {playMode === "ai" && gameState === "mode_select" && (
              <div className="mt-6 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-2">Bot Level</span>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-850">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setDifficulty(diff)}
                      className={`px-3 py-1 text-xs capitalize font-bold rounded-md transition duration-100 cursor-pointer ${
                        difficulty === diff
                          ? "bg-cyan-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setGameState("menu")}
              className="mt-8 flex items-center space-x-1.5 text-xs text-slate-500 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Menu</span>
            </button>
          </div>
        )}

        {/* Countdown Screen */}
        {gameState === "countdown" && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mb-2">Match Starting</span>
            <h1 className="text-7xl font-extrabold text-white animate-ping">{countdown > 0 ? countdown : "GO!"}</h1>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === "game_over" && (
          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center">
            <Trophy className="w-14 h-14 text-yellow-500 animate-bounce mb-4" />
            <h3 className="text-2xl font-bold text-white">Match Finished!</h3>
            
            <p className="text-sm text-slate-400 mt-2">
              {winner === "Blue" ? "Blue player wins the match!" : "Red player wins the match!"}
            </p>

            <div className="text-xl font-bold font-mono my-4 text-purple-400">
              {scoreRed} - {scoreBlue}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => startGame(playMode)}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Play Again</span>
              </button>
              <button
                onClick={() => setGameState("mode_select")}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Change Mode
              </button>
            </div>
          </div>
        )}

        {/* Interactive Game Canvas */}
        <canvas
          id="neon-hockey-canvas"
          ref={canvasRef}
          width={gameWidth}
          height={gameHeight}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="rounded-[2rem] bg-slate-950 select-none touch-none cursor-crosshair border border-slate-900"
          style={{ width: "100%", maxWidth: `${gameWidth}px`, height: "auto" }}
        />

      </div>

      {/* Rink Guidelines for local player split layout */}
      {gameState === "playing" && (
        <div className="text-center text-[10px] text-slate-500 font-mono mt-3 max-w-[320px]">
          {playMode === "local_1v1" ? (
            <span>🚀 <strong>Dual control:</strong> Bottom player drags bottom half; Top player drags top half.</span>
          ) : (
            <span>⚡ Control your neon blue mallet inside the bottom half of the arena.</span>
          )}
        </div>
      )}

      {/* Mini Controller Button Overlay */}
      {gameState === "playing" && (
        <button
          onClick={() => {
            setGameState("mode_select");
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          }}
          className="mt-4 px-4 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white text-[11px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Match</span>
        </button>
      )}

    </div>
  );
}
