import React, { useState, useEffect, useMemo } from 'react';

// Simplified Radar Map (No Google API)
export default function MapView({ itinerary }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 0.5)), 20);
    return () => clearInterval(interval);
  }, []);

  const points = useMemo(() => {
    if (!itinerary?.itinerary) return [];
    return itinerary.itinerary.map((p, i) => ({
      x: 20 + (i * 20), // Simple positioning for demo
      y: 50 + (Math.sin(i) * 20),
      name: p.name
    }));
  }, [itinerary]);

  if (!itinerary) return null;

  return (
    <div className="glass-card rounded-3xl overflow-hidden animate-fade-in-up h-[400px] relative bg-gray-900 border border-blue-500/20">
      <div className="absolute top-0 left-0 p-6 z-20">
        <h3 className="text-2xl font-black font-display text-white uppercase">Mission Radar</h3>
        <p className="text-blue-400 font-mono text-xs">LIVE TRACKING</p>
      </div>
      
      {/* Radar Grid */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

      {/* Visualizer */}
      <svg className="w-full h-full z-10">
        {points.map((p, i) => (
           <g key={i}>
             <circle cx={`${p.x}%`} cy={`${p.y}%`} r="6" fill="#3B82F6" className="animate-pulse" />
             <text x={`${p.x}%`} y={`${p.y + 10}%`} fill="white" fontSize="10" textAnchor="middle">{p.name}</text>
           </g>
        ))}
        {/* Fake Scanning Line */}
        <line x1={`${progress}%`} y1="0" x2={`${progress}%`} y2="100%" stroke="#3B82F6" strokeWidth="2" opacity="0.5" />
      </svg>
    </div>
  );
}