import React from 'react';

const ItineraryDisplay = ({ itinerary }) => {
    // Safety check
    if (!itinerary || !itinerary.itinerary || itinerary.itinerary.length === 0) {
        return (
            <div className="glass-card p-10 rounded-2xl text-center">
                <div className="text-gray-400 mb-2">No data found</div>
                <p className="text-sm text-gray-500">Try changing your search filters</p>
            </div>
        );
    }

    // Helper to safely format text
    const formatSummary = (text) => {
        if (!text) return "AI is formulating your plan..."; // Default text if empty
        return text.replace(/^"|"$/g, ''); // Remove quotes
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            
            {/* 🤖 AI Card - NOW ALWAYS VISIBLE for debugging */}
            <div className="glass-card p-6 rounded-2xl border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-blue-900/20 shadow-lg">
                <div className="flex items-start gap-4">
                    <div className="text-4xl">🤖</div>
                    <div>
                        <h3 className="text-xl font-black font-display text-purple-300 mb-2">AI Trip Manager</h3>
                        <p className="text-gray-200 italic text-lg leading-relaxed">
                            {/* Uses the helper function above */}
                            "{formatSummary(itinerary.aiSummary)}"
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="glass-card p-6 rounded-2xl flex flex-wrap justify-around items-center gap-4">
                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Total Cost</p>
                    <p className="text-3xl font-black font-display text-green-400 text-glow">₹{itinerary.totalCost}</p>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block"></div>
                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Stops</p>
                    <p className="text-3xl font-black font-display text-blue-400 text-glow">{itinerary.itinerary.length}</p>
                </div>
                <div className="w-px h-10 bg-white/10 hidden sm:block"></div>
                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Vibe</p>
                    <p className="text-3xl font-black font-display text-purple-400 text-glow">Adventure</p>
                </div>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {itinerary.itinerary.map((place, idx) => (
                    <div key={idx} className="glass-card rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300 group hover:-translate-y-1">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-2xl font-black font-display text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 transition-all">
                                    {place.name}
                                </h3>
                                <div className="flex items-center mt-2 text-sm text-gray-400">
                                    <span className="mr-2">📍</span>
                                    <span className="truncate max-w-[200px]">{place.address}</span>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-300 rounded-lg text-xs font-bold border border-blue-500/20 uppercase tracking-wide">
                                {place.type ? place.type.replace('_', ' ') : 'Place'}
                            </span>
                        </div>
                        
                        <div className="h-px bg-white/5 my-4"></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-yellow-400 text-sm">⭐ {place.rating || '4.5'}</span>
                                <span className="text-gray-600 text-xs">•</span>
                                <span className="text-gray-400 text-xs font-medium">{place.userRatingsTotal || 100}+ reviews</span>
                            </div>
                            <div className="text-right">
                                <div className="text-green-400 font-black text-lg">₹{place.estimatedCost || place.activityCost}</div>
                                {place.travelCost > 0 && (
                                    <div className="text-xs text-gray-500">+ ₹{place.travelCost} Cab</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ItineraryDisplay;