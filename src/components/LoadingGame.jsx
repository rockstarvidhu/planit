import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- CONSTANTS (Moved outside to fix dependency issues) ---
const LANES = [20, 50, 80];

export default function LoadingGame() {
  // Game State
  const [playerPos, setPlayerPos] = useState(50); // % from left
  const [obstacles, setObstacles] = useState([]);
  const [coins, setCoins] = useState([]); 
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameSpeed, setGameSpeed] = useState(1.0); 
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState(null); 
  
  const requestRef = useRef();
  const scoreRef = useRef(0); 

  // --- GAME LOOP ---
  const updateGame = useCallback(() => {
    if (gameOver) return;

    setScore(s => {
      const newScore = s + 1;
      scoreRef.current = newScore;
      if (newScore > 0 && newScore % 500 === 0) {
        setGameSpeed(prev => Math.min(prev + 0.1, 2.2)); 
        setMessage({ text: "SPEED UP!", color: "text-red-400", id: Date.now() });
        setTimeout(() => setMessage(null), 800);
      }
      return newScore;
    });

    // 1. Move Obstacles
    setObstacles(prev => {
      const newObstacles = prev
        .map(obs => ({ ...obs, y: obs.y + (0.7 * gameSpeed) })) 
        .filter(obs => obs.y < 100);

      const crash = newObstacles.some(obs => {
        const verticalHit = obs.y > 80 && obs.y < 94;
        const horizontalHit = Math.abs(obs.x - playerPos) < 12; 
        return verticalHit && horizontalHit;
      });

      if (crash) {
        setGameOver(true);
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        return prev;
      }
      return newObstacles;
    });

    // 2. Move Coins
    setCoins(prev => {
      let collected = false;
      const newCoins = prev
        .map(c => ({ ...c, y: c.y + (0.7 * gameSpeed) }))
        .filter(c => {
          if (!collected && c.y > 80 && c.y < 94 && Math.abs(c.x - playerPos) < 15) {
            collected = true;
            return false; 
          }
          return c.y < 100;
        });

      if (collected) {
        setScore(s => s + 100);
        setMessage({ text: "+100", color: "text-yellow-400", id: Date.now() });
        setTimeout(() => setMessage(null), 800);
      }
      return newCoins;
    });

    // 3. SPAWN LOGIC (WAVES)
    if (Math.random() < 0.012 * gameSpeed) { 
        // Inline Spawn Logic to avoid dependency issues
        const rand = Math.random();
        const id = Date.now();
        if (rand < 0.4) {
            const safeLaneIndex = Math.floor(Math.random() * 3); 
            const newObs = [];
            LANES.forEach((laneX, index) => {
                if (index !== safeLaneIndex) {
                    newObs.push({ id: id + index, x: laneX, y: -20 });
                }
            });
            setObstacles(prev => [...prev, ...newObs]);
        } 
        else {
            const lane = LANES[Math.floor(Math.random() * LANES.length)];
            setObstacles(prev => [...prev, { id: id, x: lane, y: -20 }]);
        }
    }
    
    // Spawn Coin
    if (Math.random() < 0.005) { 
        const lane = LANES[Math.floor(Math.random() * LANES.length)];
        setCoins(prev => [...prev, { id: Date.now(), x: lane, y: -20 }]);
    }

    if (Math.random() < 0.05) setMessage(null);

    requestRef.current = requestAnimationFrame(updateGame);
  }, [gameOver, playerPos, gameSpeed, highScore]); // Dependencies are now clean

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [updateGame]);

  // --- CONTROLS ---
  const moveLeft = () => setPlayerPos(p => Math.max(15, p - 5)); 
  const moveRight = () => setPlayerPos(p => Math.min(85, p + 5));

  useEffect(() => {
    const handleKey = (e) => {
      if (gameOver) return;
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameOver]);

  const restartGame = () => {
    setGameOver(false);
    setObstacles([]);
    setCoins([]);
    setScore(0);
    setGameSpeed(1.0);
    scoreRef.current = 0;
  };

  return (
    <div className="w-full h-64 relative overflow-hidden rounded-2xl border-4 border-gray-800 shadow-2xl select-none bg-green-800">
      
      {/* Game Over UI */}
      {gameOver && (
        <div className="absolute inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
          <h3 className="text-red-500 font-black text-4xl font-display mb-1 tracking-wider">CRASHED!</h3>
          <div className="text-white font-mono text-sm mb-6 flex flex-col items-center">
            <span>SCORE: {Math.floor(score)}</span>
            <span className="text-yellow-500 text-xs mt-1">BEST: {Math.floor(highScore > score ? highScore : score)}</span>
          </div>
          <button 
            onClick={restartGame} 
            className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs uppercase hover:scale-110 hover:bg-blue-400 transition-all shadow-lg cursor-pointer active:scale-95"
          >
            Play Again
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-3 left-4 z-40 flex flex-col items-start pointer-events-none">
        <span className="text-white font-black font-mono text-xl shadow-black drop-shadow-md">{Math.floor(score)}</span>
        <span className="text-[10px] text-white/80 font-mono uppercase tracking-widest bg-black/40 px-1 rounded">SPD: {gameSpeed.toFixed(1)}x</span>
      </div>

      {/* Message Popup */}
      {message && (
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 z-40 text-2xl font-black italic animate-bounce ${message.color}`} key={message.id}>{message.text}</div>
      )}

      {/* --- ROAD CONTAINER --- */}
      <div className="absolute inset-y-0 left-8 right-8 bg-[#333] overflow-hidden border-l-4 border-r-4 border-white/20">
          
          <div className="absolute left-0 w-2 h-full bg-[repeating-linear-gradient(180deg,red,red_20px,white_20px,white_40px)] opacity-80"></div>
          <div className="absolute right-0 w-2 h-full bg-[repeating-linear-gradient(180deg,red,red_20px,white_20px,white_40px)] opacity-80"></div>
          <div className="absolute left-1/3 w-1 h-full border-r-2 border-dashed border-white/30"></div>
          <div className="absolute right-1/3 w-1 h-full border-l-2 border-dashed border-white/30"></div>
          <div className="absolute inset-0 opacity-20 animate-road-scroll bg-[url('https://www.transparenttextures.com/patterns/asphalt-dark.png')]"></div>

          {coins.map(coin => (
            <div key={coin.id} className="absolute w-6 h-6 rounded-full bg-yellow-400 shadow-[0_0_15px_#facc15] flex items-center justify-center border-2 border-yellow-200 z-10 animate-spin-slow" style={{ left: `${coin.x}%`, top: `${coin.y}%`, transform: 'translateX(-50%)' }}>
                <span className="text-[10px] font-bold text-yellow-800">$</span>
            </div>
          ))}

          <div className="absolute bottom-4 w-10 h-16 transition-all duration-75 ease-linear z-20" style={{ left: `${playerPos}%`, transform: 'translateX(-50%)' }}>
            <div className="w-full h-full bg-gradient-to-b from-red-600 to-red-800 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] relative overflow-hidden border border-red-900">
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 bg-white/20"></div>
                <div className="absolute top-4 left-1 right-1 h-3 bg-gray-900/90 rounded-sm border-t border-gray-700"></div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/40 flex justify-evenly items-center rounded-sm">
                    <div className="w-1 h-full bg-black/60"></div><div className="w-1 h-full bg-black/60"></div>
                </div>
                <div className="absolute bottom-1 left-1 w-2 h-2 bg-red-500 shadow-[0_0_5px_red] rounded-full"></div>
                <div className="absolute bottom-1 right-1 w-2 h-2 bg-red-500 shadow-[0_0_5px_red] rounded-full"></div>
            </div>
          </div>

          {obstacles.map(obs => (
            <div key={obs.id} className="absolute w-10 h-16 z-30" style={{ left: `${obs.x}%`, top: `${obs.y}%`, transform: 'translateX(-50%)' }}>
                <div className="w-full h-full bg-slate-800 rounded-xl shadow-xl border border-slate-900 relative">
                    <div className="absolute bottom-2 left-1 right-1 h-3 bg-black/50 rounded-sm"></div>
                    <div className="absolute top-1 left-1 w-2 h-1 bg-yellow-500 shadow-[0_0_5px_yellow]"></div>
                    <div className="absolute top-1 right-1 w-2 h-1 bg-yellow-500 shadow-[0_0_5px_yellow]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-6 bg-slate-900 rounded-sm opacity-50"></div>
                </div>
            </div>
          ))}
      </div>

      {/* Controls Overlay - ONLY RENDER IF NOT GAME OVER */}
      {!gameOver && (
        <div className="absolute inset-0 z-50 flex">
            <div className="w-1/2 h-full active:bg-white/5 transition-colors" onClick={moveLeft}></div>
            <div className="w-1/2 h-full active:bg-white/5 transition-colors" onClick={moveRight}></div>
        </div>
      )}

      <style jsx>{`
        @keyframes road-scroll {
            from { background-position: 0 0; }
            to { background-position: 0 40px; }
        }
        .animate-road-scroll {
            animation: road-scroll 0.3s linear infinite;
        }
      `}</style>
    </div>
  );
}