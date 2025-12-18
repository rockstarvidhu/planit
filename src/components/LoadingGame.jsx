import React, { useState, useEffect, useRef, useCallback } from 'react';

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
      // Difficulty Ramp: Every 500 points, speed increases slightly
      if (newScore > 0 && newScore % 500 === 0) {
        setGameSpeed(prev => Math.min(prev + 0.1, 2.5)); 
        showMessage("SPEED UP!", "text-red-400");
      }
      return newScore;
    });

    // 1. Move Obstacles (Cars)
    setObstacles(prev => {
      const newObstacles = prev
        .map(obs => ({ ...obs, y: obs.y + (0.8 * gameSpeed) })) 
        .filter(obs => obs.y < 100);

      // Collision Detection (Player vs Car)
      const crash = newObstacles.some(obs => {
        const verticalHit = obs.y > 82 && obs.y < 96;
        const horizontalHit = Math.abs(obs.x - playerPos) < 6; 
        return verticalHit && horizontalHit;
      });

      if (crash) {
        setGameOver(true);
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        return prev;
      }
      return newObstacles;
    });

    // 2. Move & Collect Coins
    setCoins(prev => {
      let collected = false;
      const newCoins = prev
        .map(c => ({ ...c, y: c.y + (0.8 * gameSpeed) }))
        .filter(c => {
          if (!collected && c.y > 82 && c.y < 96 && Math.abs(c.x - playerPos) < 10) {
            collected = true;
            return false; 
          }
          return c.y < 100;
        });

      if (collected) {
        setScore(s => s + 100);
        showMessage("+100", "text-yellow-400");
      }
      return newCoins;
    });

    // 3. Spawners
    if (Math.random() < 0.015 * gameSpeed) { 
      setObstacles(prev => [...prev, { id: Date.now() + Math.random(), x: Math.random() * 80 + 10, y: -15 }]);
    }
    if (Math.random() < 0.01) { 
      setCoins(prev => [...prev, { id: Date.now() + Math.random(), x: Math.random() * 80 + 10, y: -15 }]);
    }

    // 4. Clear old messages
    if (Math.random() < 0.05) setMessage(null);

    requestRef.current = requestAnimationFrame(updateGame);
  }, [gameOver, playerPos, gameSpeed, highScore]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [updateGame]);

  // --- CONTROLS ---
  const moveLeft = () => setPlayerPos(p => Math.max(10, p - 6)); 
  const moveRight = () => setPlayerPos(p => Math.min(90, p + 6));

  useEffect(() => {
    const handleKey = (e) => {
      if (gameOver) return;
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameOver]);

  const showMessage = (text, color) => {
    setMessage({ text, color, id: Date.now() });
    setTimeout(() => setMessage(null), 800);
  };

  const restartGame = () => {
    setGameOver(false);
    setObstacles([]);
    setCoins([]);
    setScore(0);
    setGameSpeed(1.0);
    scoreRef.current = 0;
  };

  return (
    <div className="w-full h-64 bg-gray-900 relative overflow-hidden rounded-2xl border-2 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)] select-none">
      
      {/* Game Over UI */}
      {gameOver && (
        <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center animate-fade-in backdrop-blur-sm">
          <h3 className="text-red-500 font-black text-4xl font-display mb-1 tracking-wider">CRASHED!</h3>
          <div className="text-white font-mono text-sm mb-6 flex flex-col items-center">
            <span>SCORE: {Math.floor(score)}</span>
            <span className="text-yellow-500 text-xs mt-1">BEST: {Math.floor(highScore > score ? highScore : score)}</span>
          </div>
          <button 
            onClick={restartGame}
            className="bg-white text-black px-6 py-2 rounded-full font-bold text-xs uppercase hover:scale-110 hover:bg-blue-400 transition-all shadow-lg"
          >
            Play Again
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-3 left-4 z-20 flex flex-col items-start pointer-events-none">
        <span className="text-white font-black font-mono text-xl shadow-black drop-shadow-md">
            {Math.floor(score)}
        </span>
        <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
            SPD: {gameSpeed.toFixed(1)}x
        </span>
      </div>

      {/* Popup Messages */}
      {message && (
        <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 z-20 text-2xl font-black italic animate-bounce ${message.color}`} key={message.id}>
          {message.text}
        </div>
      )}

      {/* Moving Road */}
      <div className="absolute inset-0 flex justify-center opacity-30">
         <div className="w-full h-full bg-[linear-gradient(to_bottom,transparent_50%,#333_50%)] bg-[length:100%_40px] animate-road-scroll"></div>
      </div>
      <div className="absolute inset-0 flex justify-center">
         <div className="w-1 h-full border-l-2 border-dashed border-gray-600 opacity-60"></div>
      </div>

      {/* COINS */}
      {coins.map(coin => (
        <div 
            key={coin.id}
            className="absolute w-6 h-6 rounded-full bg-yellow-400 shadow-[0_0_15px_#facc15] flex items-center justify-center border-2 border-yellow-200 z-10 animate-spin-slow"
            style={{ left: `${coin.x}%`, top: `${coin.y}%`, transform: 'translateX(-50%)' }}
        >
            <span className="text-[10px] font-bold text-yellow-800">$</span>
        </div>
      ))}

      {/* --- PLAYER CAR (RED SPORTS STYLE) --- */}
      <div 
        className="absolute bottom-4 w-10 h-16 transition-all duration-75 ease-linear z-20"
        style={{ left: `${playerPos}%`, transform: 'translateX(-50%)' }}
      >
        {/* Body - Red Gradient & Sleek Shape */}
        <div className="w-full h-full bg-gradient-to-b from-red-500 to-red-700 rounded-xl shadow-[0_10px_25px_rgba(220,38,38,0.5)] relative overflow-hidden border-2 border-red-900">
            {/* Racing Stripe */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-2 bg-white/20"></div>

            {/* Windshield (Darker, sleeker) */}
            <div className="absolute top-4 left-1 right-1 h-3 bg-gray-900/80 rounded-sm border-t border-gray-700"></div>

            {/* Engine Vents (Black hint at back) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/30 flex justify-evenly items-center rounded-sm opacity-50">
                <div className="w-1 h-full bg-black/50"></div>
                <div className="w-1 h-full bg-black/50"></div>
            </div>

            {/* Tail Lights (Round & Bright Red) */}
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-red-500 shadow-[0_0_8px_red] rounded-full border border-red-950"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-red-500 shadow-[0_0_8px_red] rounded-full border border-red-950"></div>
        </div>
      </div>
      {/* ------------------------------------ */}

      {/* ENEMY CARS */}
      {obstacles.map(obs => (
        <div 
          key={obs.id}
          className="absolute w-10 h-16 z-10"
          style={{ left: `${obs.x}%`, top: `${obs.y}%`, transform: 'translateX(-50%)' }}
        >
             <div className="w-full h-full bg-red-600 rounded-xl shadow-lg border border-red-800 relative">
                <div className="absolute bottom-2 left-1 right-1 h-3 bg-black/30 rounded-sm"></div>
                <div className="absolute top-1 left-1 w-2 h-1 bg-yellow-400 shadow-[0_0_5px_yellow]"></div>
                <div className="absolute top-1 right-1 w-2 h-1 bg-yellow-400 shadow-[0_0_5px_yellow]"></div>
             </div>
        </div>
      ))}

      {/* Controls Overlay */}
      <div className="absolute inset-0 z-0 flex">
        <div className="w-1/2 h-full active:bg-white/5 transition-colors" onClick={moveLeft}></div>
        <div className="w-1/2 h-full active:bg-white/5 transition-colors" onClick={moveRight}></div>
      </div>

      <style jsx>{`
        @keyframes road-scroll {
            from { background-position: 0 0; }
            to { background-position: 0 40px; }
        }
        .animate-road-scroll {
            animation: road-scroll 0.5s linear infinite;
        }
      `}</style>

    </div>
  );
}