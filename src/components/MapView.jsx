import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertCircle, X, Navigation } from 'lucide-react';

export default function MapView({ itinerary }) {
  const [progress, setProgress] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // Radar Scan Animation
  useEffect(() => {
    const interval = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 0.5)), 20);
    return () => clearInterval(interval);
  }, []);

  // Generate coordinates for the dots
  const points = useMemo(() => {
    if (!itinerary?.itinerary) return [];
    return itinerary.itinerary.map((p, i) => ({
      // Spread the points out so they aren't clustered
      x: 15 + (i * 15) + (Math.sin(i * 132) * 10), 
      y: 40 + (Math.cos(i * 42) * 20),
      ...p // Attach all place data to the point
    }));
  }, [itinerary]);

  if (!itinerary) return null;

  return (
    <div className="glass-card rounded-3xl overflow-hidden animate-fade-in-up h-[500px] relative bg-gray-900 border border-blue-500/20 shadow-2xl mt-8">
      
      {/* HUD Header */}
      <div className="absolute top-0 left-0 p-6 z-20 pointer-events-none">
        <h3 className="text-2xl font-black font-display text-white uppercase tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">Mission Radar</h3>
        <div className="flex items-center space-x-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <p className="text-blue-400 font-mono text-[10px] tracking-widest">LIVE TRACKING ACTIVE</p>
        </div>
      </div>
      
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-60 pointer-events-none"></div>

      {/* SVG Interaction Layer */}
      <svg className="w-full h-full z-10 relative">
        {/* Connection Lines (Sci-Fi Aesthetic) */}
        <polyline 
            points={points.map(p => `${p.x}%,${p.y}%`).join(' ')} 
            fill="none" 
            stroke="#3B82F6" 
            strokeWidth="1" 
            strokeOpacity="0.2" 
            strokeDasharray="4 4"
        />

        {/* Interactive Points */}
        {points.map((p, i) => {
           const isSelected = selectedPlace?.place_id === p.place_id;
           
           return (
             <g 
               key={i} 
               onClick={() => setSelectedPlace(isSelected ? null : p)} 
               className="cursor-pointer group transition-all duration-300"
               style={{ opacity: selectedPlace && !isSelected ? 0.3 : 1 }}
             >
               {/* Pulse Ring */}
               <circle cx={`${p.x}%`} cy={`${p.y}%`} r="20" fill="#3B82F6" opacity="0" className="group-hover:opacity-20 transition-opacity duration-300" />
               <circle cx={`${p.x}%`} cy={`${p.y}%`} r="12" fill="#3B82F6" opacity="0.2" className="animate-pulse" />
               
               {/* The Dot */}
               <circle 
                  cx={`${p.x}%`} 
                  cy={`${p.y}%`} 
                  r={isSelected ? "8" : "5"} 
                  fill={isSelected ? "#60A5FA" : "#1D4ED8"} 
                  stroke="white" 
                  strokeWidth={isSelected ? "3" : "1.5"}
                  className="transition-all duration-300 ease-out"
               />
               
               {/* Label (Only visible on hover or select) */}
               <text 
                  x={`${p.x}%`} 
                  y={`${p.y + 10}%`} 
                  fill="white" 
                  fontSize="10" 
                  textAnchor="middle" 
                  className={`font-mono font-bold uppercase tracking-widest transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  style={{ textShadow: '0 2px 4px black' }}
               >
                  {p.name}
               </text>
             </g>
           );
        })}
        
        {/* Scanning Beam */}
        <line x1={`${progress}%`} y1="0" x2={`${progress}%`} y2="100%" stroke="#3B82F6" strokeWidth="2" opacity="0.3" className="pointer-events-none" style={{ filter: 'drop-shadow(0 0 8px #3B82F6)' }} />
      </svg>

      {/* DETAILS POPUP (Interactive Overlay) */}
      {selectedPlace && (
        <div className="absolute bottom-6 right-6 z-30 w-full max-w-sm animate-fade-in-up px-4 md:px-0">
            <div className="glass-card bg-slate-900/90 backdrop-blur-xl border border-blue-500/30 p-5 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
                
                {/* Close Button */}
                <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedPlace(null); }}
                    className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1 rounded-full"
                >
                    <X size={14} />
                </button>

                {/* Place Info */}
                <div className="pr-8">
                    <h4 className="text-xl font-black text-white font-display mb-1 leading-tight">{selectedPlace.name}</h4>
                    <div className="flex items-center space-x-3 text-[10px] text-blue-300 font-mono uppercase tracking-widest mb-4 opacity-80">
                        <span className="flex items-center"><Navigation size={10} className="mr-1"/> {selectedPlace.distance}</span>
                        <span>•</span>
                        <span>{selectedPlace.travelTime} drive</span>
                    </div>
                </div>
                
                {/* Verified Price Box */}
                <div className="bg-gradient-to-r from-blue-900/40 to-slate-900/40 rounded-xl p-4 border border-blue-500/20 flex justify-between items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                    
                    <div className="relative z-10">
                        <div className="text-[9px] text-blue-200 uppercase font-bold tracking-wider mb-0.5">Estimated Total</div>
                        <div className="text-2xl font-black text-white text-glow leading-none">₹{selectedPlace.totalOptionCost}</div>
                    </div>
                    
                    {/* Status Badge */}
                    <div className="relative z-10">
                        {selectedPlace.costNote?.toLowerCase().includes("verified") ? (
                            <div className="flex flex-col items-end">
                                <span className="flex items-center text-[10px] text-green-400 font-bold uppercase tracking-wider bg-green-900/30 px-2 py-1 rounded border border-green-500/30 mb-1">
                                    <CheckCircle size={10} className="mr-1.5" /> Verified
                                </span>
                                <span className="text-[9px] text-green-500/60 font-mono">Real Reviews</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end">
                                <span className="flex items-center text-[10px] text-orange-400 font-bold uppercase tracking-wider bg-orange-900/30 px-2 py-1 rounded border border-orange-500/30 mb-1">
                                    <AlertCircle size={10} className="mr-1.5" /> Estimated
                                </span>
                                <span className="text-[9px] text-orange-500/60 font-mono">Google Avg</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}