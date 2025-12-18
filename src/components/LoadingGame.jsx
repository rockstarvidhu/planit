import React, { useState, useEffect, useRef } from 'react';

export default function LoadingGame() {
  // Game State
  const [playerPos, setPlayerPos] = useState(50); // % from left
  const [obstacles, setObstacles] = useState([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const requestRef = useRef();

  // --- GAME LOOP ---
  const updateGame = () => {
    if (gameOver) return;

    // 1. Move Obstacles Down
    setObstacles(prev => {
      const newObstacles = prev
        .map(obs => ({ ...obs, y: obs.y + 1.5 })) // Speed of falling
        .filter(obs => obs.y < 100); // Remove if off screen

      // 2. Collision Detection
      const collision = newObstacles.some(obs => 
        obs.y > 80 && obs.y < 95 && // Vertical range of player
        Math.abs(obs.x - playerPos) < 15 // Horizontal collision range
      );

      if (collision) {
        setGameOver(true);
        return prev;
      }
      return newObstacles;
    });

    // 3. Add Score
    setScore(s => s + 1);

    // 4. Randomly Add New Obstacle
    if (Math.random() < 0.05) { // 5% chance per frame
      setObstacles(prev => [
        ...prev, 
        { id: Date.now(), x: Math.random() * 80 + 10, y: -10 }
      ]);
    }

    requestRef.current = requestAnimationFrame(updateGame);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameOver, playerPos]); // Re-bind when state changes

  // --- CONTROLS ---
  const moveLeft = () => setPlayerPos(p => Math.max(10, p - 10));
  const moveRight = () => setPlayerPos(p => Math.min(90, p + 10));

  // Keyboard Support
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="w-full h-64 bg-gray-900 relative overflow-hidden rounded-2xl border-2 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
      
      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center animate-fade-in">
          <h3 className="text-red-500 font-black text-3xl font-display mb-2">CRASHED!</h3>
          <p className="text-gray-400 font-mono text-sm mb-4">But don't worry, your trip is still loading...</p>
          <button 
            onClick={() => { setGameOver(false); setObstacles([]); setScore(0); }}
            className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs uppercase hover:scale-105 transition-transform"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Score */}
      <div className="absolute top-4 right-4 text-white font-mono text-xs z-10 bg-black/50 px-2 py-1 rounded">
        SCORE: {Math.floor(score / 10)}
      </div>
      
      {/* Instructions */}
      {!gameOver && score < 100 && (
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 font-black text-4xl pointer-events-none text-center">
            TAP TO<br/>DODGE
         </div>
      )}

      {/* Road Markings (Animated) */}
      <div className="absolute inset-0 flex justify-center">
         <div className="w-2 h-full border-l-2 border-dashed border-gray-700 opacity-50"></div>
      </div>

      {/* Player Car */}
      <div 
        className="absolute bottom-4 w-8 h-12 bg-blue-500 rounded-lg shadow-[0_0_15px_#3b82f6] transition-all duration-100 ease-out z-10"
        style={{ left: `${playerPos}%`, transform: 'translateX(-50%)' }}
      >
        {/* Car Details */}
        <div className="w-full h-2 bg-blue-300 rounded-t-lg mb-6"></div>
        <div className="w-full h-1 bg-red-500 shadow-[0_0_5px_red]"></div>
      </div>

      {/* Obstacles (Other Cars) */}
      {obstacles.map(obs => (
        <div 
          key={obs.id}
          className="absolute w-8 h-12 bg-red-600 rounded-lg shadow-lg border-b-4 border-red-800"
          style={{ left: `${obs.x}%`, top: `${obs.y}%`, transform: 'translateX(-50%)' }}
        >
             <div className="w-full h-2 bg-yellow-200 rounded-b-lg mt-8 shadow-[0_0_5px_yellow]"></div>
        </div>
      ))}

      {/* Touch Controls (Invisible overlay) */}
      <div className="absolute inset-0 z-0 flex">
        <div className="w-1/2 h-full" onClick={moveLeft}></div>
        <div className="w-1/2 h-full" onClick={moveRight}></div>
      </div>

    </div>
  );
}