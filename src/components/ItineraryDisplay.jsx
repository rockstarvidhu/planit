import React, { useState } from 'react';
import TiltCard from './TiltCard';

const ItineraryDisplay = ({ itinerary }) => {
    const [expandedId, setExpandedId] = useState(null);

    if (!itinerary || itinerary.length === 0) {
        return (
            <div className="glass-card p-10 rounded-2xl text-center">
                <div className="text-gray-400 mb-2">No options found</div>
                <p className="text-sm text-gray-500">Try adjusting your filters.</p>
            </div>
        );
    }

    const toggleExpand = (idx) => {
        setExpandedId(expandedId === idx ? null : idx);
    };

    const getTheme = (type, name) => {
        const n = name?.toLowerCase() || "";
        const t = type?.toLowerCase() || "";
        
        if (n.includes("amusement") || t.includes("amusement") || n.includes("kart") || n.includes("arena") || n.includes("storm") || n.includes("wonderla")) {
            return {
                gradient: "from-orange-600/20 to-red-900/40",
                border: "border-orange-500/50",
                text: "text-orange-400",
                shadow: "shadow-[0_0_30px_rgba(249,115,22,0.2)]",
                icon: "🎡" 
            };
        }
        if (n.includes("fun") || n.includes("mall") || n.includes("cinema") || n.includes("theatre") || t.includes("movie")) {
            return {
                gradient: "from-purple-600/20 to-fuchsia-900/40",
                border: "border-purple-500/50",
                text: "text-purple-400",
                shadow: "shadow-[0_0_30px_rgba(168,85,247,0.2)]",
                icon: "🎮"
            };
        }
        if (t.includes("park") || n.includes("dam") || n.includes("hill") || n.includes("fall") || n.includes("garden")) {
            return {
                gradient: "from-emerald-600/20 to-teal-900/40",
                border: "border-emerald-500/50",
                text: "text-emerald-400",
                shadow: "shadow-[0_0_30px_rgba(16,185,129,0.2)]",
                icon: "🌿"
            };
        }
        if (t.includes("restaurant") || t.includes("cafe") || n.includes("bistro")) {
            return {
                gradient: "from-amber-600/20 to-yellow-900/40",
                border: "border-amber-500/50",
                text: "text-amber-400",
                shadow: "shadow-[0_0_30px_rgba(245,158,11,0.2)]",
                icon: "🍔"
            };
        }
        return {
            gradient: "from-blue-600/20 to-indigo-900/40",
            border: "border-blue-500/50",
            text: "text-blue-400",
            shadow: "shadow-[0_0_30px_rgba(59,130,246,0.2)]",
            icon: "✨"
        };
    };

    return (
        <div className="space-y-8 animate-fade-in-up pb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {itinerary.map((place, idx) => {
                    const theme = getTheme(place.type, place.name);
                    const isExpanded = expandedId === idx;
                    
                    return (
                        <TiltCard 
                            key={idx} 
                            onClick={() => toggleExpand(idx)}
                            disabled={isExpanded} // ✅ DISABLE TILT WHEN EXPANDED
                            className={`glass-card rounded-3xl p-6 border ${theme.border} bg-gradient-to-br ${theme.gradient} cursor-pointer relative overflow-hidden group ${isExpanded ? 'lg:col-span-2 lg:row-span-2 shadow-2xl' : ''} ${theme.shadow}`}
                        >
                            <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

                            <div className="relative z-10 flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-4xl mb-3 block filter drop-shadow-lg transform transition-transform group-hover:scale-110 duration-300">{theme.icon}</span>
                                    <h3 className="text-2xl font-black font-display text-white leading-tight break-words pr-2">{place.name}</h3>
                                    <p className="text-gray-400 text-[10px] mt-1 font-mono uppercase tracking-widest">{place.type?.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="bg-black/40 backdrop-blur border border-white/10 px-2 py-1 rounded flex flex-col items-center">
                                    <span className="text-yellow-400 font-bold text-xs">★ {place.rating || '4.0'}</span>
                                    <span className="text-[9px] text-gray-500 mt-0.5">{place.userRatingsTotal || '100+'}</span>
                                </div>
                            </div>

                            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 opacity-100 mb-6' : 'max-h-0 opacity-0'}`}>
                                <div className="bg-black/30 rounded-xl p-4 border border-white/5 backdrop-blur-md">
                                    <p className="text-gray-200 italic text-sm mb-4 leading-relaxed border-l-2 border-white/30 pl-3">"{place.description}"</p>
                                    
                                    <div className="flex justify-between items-end border-b border-white/10 pb-2 mb-2">
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activities</h4>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Est. Cost</h4>
                                    </div>
                                    
                                    <ul className="space-y-2">
                                        {place.activities?.map((act, i) => (
                                            <li key={i} className="flex justify-between items-center text-sm text-white/90">
                                                <span>• {act.split('(')[0]}</span>
                                                <span className={`text-xs font-bold ${theme.text} bg-black/40 px-2 py-0.5 rounded`}>{act.match(/\(~?₹\d+\)/)?.[0] || '₹???'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="relative z-10 pt-4 border-t border-white/10 flex justify-between items-center mt-auto">
                                <div className="text-[10px] text-gray-400 font-mono flex flex-col gap-1">
                                    <span className="flex items-center gap-1">🚕 {place.travelTime}</span>
                                    <span className="flex items-center gap-1">📍 {place.distance} away</span>
                                </div>
                                <div className={`text-[9px] font-bold uppercase tracking-widest text-white/40 ${isExpanded ? 'hidden' : 'animate-pulse'}`}>Tap Info</div>
                                <div className="text-right">
                                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Total Est.</div>
                                    <div className={`text-2xl font-black font-display ${theme.text} text-glow`}>₹{place.totalOptionCost}</div>
                                </div>
                            </div>
                        </TiltCard>
                    );
                })}
            </div>
        </div>
    );
};

export default ItineraryDisplay;
