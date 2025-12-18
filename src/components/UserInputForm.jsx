import React, { useState } from 'react';
import LoadingGame from './LoadingGame'; // Ensure this file exists in src/components/

// Default vibes are OFF (User must select them)
const defaultPrefs = {
  nature: false,
  adventure: false,
  fun: false,
  food: false,
};

export default function UserInputForm({ onItineraryGenerated, onSubmit, onError }) {
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('5000');
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [privateVehicleOwned, setPrivateVehicleOwned] = useState(false);
  const [mileage, setMileage] = useState(15);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const togglePref = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      if (onError) onError("Geolocation is not supported");
      return;
    }
    setLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
            // PROXY CALL: Ask backend for address to avoid CORS errors
            const response = await fetch('https://planit-backend-1fga.onrender.com/api/reverse-geocode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lng })
            });

            const data = await response.json();
            
            if (response.ok && data.address) {
                // Address found! (e.g. "Whitefield, Bangalore")
                setLocation(data.address);
            } else {
                // Fallback to coordinates if address lookup fails
                setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
        } catch (error) {
            console.error("Geocoding failed:", error);
            setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } finally {
            setLocating(false);
        }
      },
      () => {
        if (onError) onError("Unable to locate. Please type your city.");
        setLocating(false);
      }
    );
  };

  const nextStep = () => {
    if (currentStep < 3 && isStepValid()) setCurrentStep(curr => curr + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1);
  };

  const handleSubmit = async () => {
    onSubmit();
    setSubmitting(true);

    const preferenceTypeMap = {
      nature: 'nature_park',
      adventure: 'adventure_sports',
      fun: 'entertainment',
      food: 'restaurant',
    };
    
    const filters = Object.entries(preferences)
      .filter(([key, value]) => value)
      .map(([key]) => preferenceTypeMap[key]);

    if (filters.length === 0) filters.push('nature_park');

    const requestData = {
      budget: parseInt(budget),
      location,
      radius,
      filters,
      people: numberOfPeople,
      hasPrivateVehicle: privateVehicleOwned,
      mileage: privateVehicleOwned ? parseFloat(mileage) : null,
    };

    try {
      const response = await fetch('https://planit-backend-1fga.onrender.com/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed');
      onItineraryGenerated(result);

    } catch (error) {
      if (onError) onError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1: return location && location.trim() !== '';
      case 2: return budget && budget > 0;
      case 3: return true;
      default: return false;
    }
  };

  const VibeCard = ({ id, label, icon, color, active }) => (
    <div 
      onClick={() => togglePref(id)}
      className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-300 group overflow-hidden ${
        active 
          ? `bg-${color}-500/20 border-${color}-500 shadow-[0_0_20px_rgba(var(--${color}-rgb),0.3)] scale-[1.02]` 
          : 'bg-gray-900/40 border-gray-700 hover:border-gray-500'
      }`}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br from-${color}-500 to-transparent transition-opacity`}></div>
      <div className="flex flex-col items-center text-center">
        <span className={`text-3xl mb-2 transition-transform group-hover:scale-110 ${active ? 'grayscale-0' : 'grayscale'}`}>{icon}</span>
        <span className={`font-bold font-display uppercase tracking-wider text-sm ${active ? 'text-white' : 'text-gray-500'}`}>{label}</span>
      </div>
      <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${active ? `bg-${color}-500 shadow-[0_0_10px_currentColor]` : 'bg-gray-800'}`}></div>
    </div>
  );

  // --- RENDER ---
  return (
    <div className="max-w-2xl mx-auto min-h-[500px] flex flex-col justify-center">
      
      {/* 1. LOADING STATE (GAME) */}
      {submitting ? (
        <div className="animate-fade-in text-center">
          <h3 className="text-2xl font-black font-display text-white mb-2">Planning your Trip...</h3>
          <p className="text-blue-400 font-mono text-xs uppercase tracking-widest mb-6">Play while you wait!</p>
          
          <LoadingGame /> 

          <p className="text-gray-500 text-[10px] mt-4 font-mono">Analyzing {location} reviews for best prices...</p>
        </div>
      ) : (
        
        /* 2. FORM STATE */
        <div className="glass-card p-8 sm:p-10 rounded-3xl border border-white/10 relative overflow-hidden animate-fade-in-up">
            
            {/* Progress Steps */}
            <div className="flex justify-center gap-2 mb-8 absolute top-6 left-0 right-0">
                {[1, 2, 3].map(num => (
                <div key={num} className={`h-1.5 w-8 rounded-full transition-all duration-500 ${
                    currentStep >= num ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-gray-800'
                }`}></div>
                ))}
            </div>
        
            {/* STEP 1: LOCATION */}
            {currentStep === 1 && (
            <div className="space-y-8 text-center animate-fade-in mt-6">
                <div>
                    <h3 className="text-4xl font-black font-display text-white mb-2">Where to?</h3>
                    {/* --- DEBUG BUTTON FOR TESTING GAME --- */}
                    <button 
                       onClick={() => setSubmitting(true)}
                       className="text-[10px] bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/50 hover:bg-red-500 hover:text-white transition-colors mb-2"
                    >
                       [DEBUG: TEST GAME]
                    </button>
                    <p className="text-blue-400 font-mono text-xs uppercase tracking-widest">Enter Location</p>
                </div>
                
                <div className="relative group">
                    <input 
                        type="text" 
                        value={location} 
                        onChange={e => setLocation(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && nextStep()} 
                        placeholder="City or Address" 
                        className="w-full text-center py-6 bg-black/30 border-2 border-gray-700 rounded-2xl focus:border-blue-500 text-2xl font-bold text-white outline-none transition-all placeholder:text-gray-700 placeholder:text-lg focus:shadow-[0_0_30px_rgba(59,130,246,0.2)] pr-32" 
                        autoFocus 
                    />
                    
                    <button 
                        type="button" 
                        onClick={handleUseCurrentLocation} 
                        disabled={locating} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white border border-gray-600 hover:border-blue-500 px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg z-10"
                    >
                    {locating ? (
                        <>
                            <span className="animate-spin">↻</span>
                            <span className="text-xs font-bold uppercase tracking-wider">Locating...</span>
                        </>
                    ) : (
                        <>
                            <span>📍</span>
                            <span className="text-xs font-bold uppercase tracking-wider">Locate Me</span>
                        </>
                    )}
                    </button>
                </div>
                
                <div className="text-xs text-gray-500 font-mono -mt-4">
                    Tip: Tap 'Locate Me' to use your current position
                </div>

                <div className="w-full px-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between text-xs font-mono text-gray-500 mb-2">
                        <span>Search Range</span>
                        <span className="text-blue-400">{(parseInt(radius)/1000).toFixed(1)} km</span>
                    </div>
                    <input type="range" min="1000" max="25000" step="1000" value={radius} onChange={e => setRadius(e.target.value)} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
            </div>
            )}

            {/* STEP 2: BUDGET */}
            {currentStep === 2 && (
            <div className="space-y-8 text-center animate-fade-in mt-6">
                <div>
                    <h3 className="text-4xl font-black font-display text-white mb-2">Total Budget</h3>
                    <p className="text-green-400 font-mono text-xs uppercase tracking-widest">For the whole group</p>
                </div>
                <div className="relative inline-block">
                    <span className="absolute top-4 left-6 text-gray-600 text-3xl">₹</span>
                    <input 
                        type="number" 
                        value={budget} 
                        onChange={e => setBudget(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && nextStep()} 
                        placeholder="2000" 
                        className="w-full text-center py-6 bg-black/30 border-2 border-gray-700 rounded-2xl focus:border-green-500 text-5xl font-black font-display text-green-400 outline-none transition-all placeholder:text-gray-800 focus:shadow-[0_0_30px_rgba(34,197,94,0.2)]" 
                        autoFocus 
                    />
                </div>
                <div className="flex justify-center items-center gap-6">
                    <button onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))} className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold text-white transition-colors">-</button>
                    <div className="text-center">
                        <span className="block text-2xl font-bold text-white">{numberOfPeople}</span>
                        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-widest">People</span>
                    </div>
                    <button onClick={() => setNumberOfPeople(numberOfPeople + 1)} className="w-12 h-12 rounded-xl bg-gray-800 hover:bg-gray-700 text-2xl font-bold text-white transition-colors">+</button>
                </div>
            </div>
            )}

            {/* STEP 3: VIBES */}
            {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in mt-6">
                <div className="text-center">
                    <h3 className="text-3xl font-black font-display text-white mb-1">Select Vibes</h3>
                    <p className="text-purple-400 font-mono text-xs uppercase tracking-widest">Pick your preferences</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <VibeCard id="adventure" label="Adventure" icon="🏎️" color="orange" active={preferences.adventure} />
                    <VibeCard id="fun" label="Fun & Games" icon="🎮" color="purple" active={preferences.fun} />
                    <VibeCard id="nature" label="Nature" icon="🌿" color="emerald" active={preferences.nature} />
                    <VibeCard id="food" label="Food" icon="🍔" color="amber" active={preferences.food} />
                </div>
                
                <div onClick={() => setPrivateVehicleOwned(!privateVehicleOwned)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${privateVehicleOwned ? 'border-blue-500 bg-blue-900/20' : 'border-gray-800 bg-black/20'}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🚗</span>
                        <div>
                            <span className={`block font-bold text-sm ${privateVehicleOwned ? 'text-white' : 'text-gray-500'}`}>I have a Vehicle</span>
                            <span className="text-[10px] text-gray-600 font-mono">Calculate fuel cost</span>
                        </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${privateVehicleOwned ? 'bg-green-400 text-green-400' : 'bg-gray-800 text-transparent'}`}></div>
                </div>
                
                {privateVehicleOwned && (
                    <div className="animate-fade-in-down">
                        <div className="flex justify-between text-xs font-bold text-blue-400 uppercase mb-1 px-1">
                            <span>Vehicle Mileage</span>
                            <span>{mileage} km/l</span>
                        </div>
                        <input type="range" min="5" max="60" step="1" value={mileage} onChange={e => setMileage(e.target.value)} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </div>
                )}
            </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-10 pt-6 border-t border-white/5">
                <button 
                    type="button" 
                    onClick={prevStep} 
                    className={`text-sm font-mono text-gray-500 hover:text-white transition-colors ${currentStep === 1 ? 'opacity-0 pointer-events-none' : ''}`}
                >
                    &lt; BACK
                </button>
                <button 
                    type="button" 
                    onClick={currentStep === 3 ? handleSubmit : nextStep} 
                    disabled={!isStepValid() || submitting} 
                    className="bg-white text-black px-8 py-3 rounded-xl font-black font-display uppercase tracking-widest hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {submitting ? 'PLANNING...' : (currentStep === 3 ? 'FIND PLANS' : 'NEXT >')}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}