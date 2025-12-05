import React, { useState } from 'react';

const defaultPrefs = {
  food: true,
  entertainment: true,
  activities: true,
};

export default function UserInputForm({ onItineraryGenerated, onSubmit, onError }) {
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('5000');
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [privateVehicleOwned, setPrivateVehicleOwned] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleChange = (e) => {
    setPreferences({ ...preferences, [e.target.name]: e.target.checked });
  };

  // 🛰️ GPS Location Logic
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      if (onError) onError("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = `${position.coords.latitude},${position.coords.longitude}`;
        setLocation(coords);
        setLocating(false);
      },
      (error) => {
        console.error("Location error:", error);
        if (onError) onError("Unable to retrieve location. Please type it manually.");
        setLocating(false);
      }
    );
  };

  // 🚦 Navigation Logic
  const nextStep = (e) => {
    if (e) e.preventDefault(); // Stop form submission if triggered by Enter key
    if (currentStep < 3 && isStepValid()) {
      setCurrentStep(curr => curr + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(curr => curr - 1);
  };

  // 🛡️ Key Press Handler (Prevents accidental submits)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Stop default submit
      if (currentStep < 3) {
        nextStep(); // Go to next step instead
      }
    }
  };

  // 🚀 Final Submission Logic
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // SAFETY CHECK: If we are not on Step 3, DO NOT submit.
    if (currentStep !== 3) {
      return; 
    }
    
    onSubmit(); // Notify App.js loading started
    setSubmitting(true);

    const preferenceTypeMap = {
      food: 'restaurant',
      entertainment: 'movie_theater',
      activities: 'tourist_attraction', // Updated to find more spots
    };
    
    const filters = Object.entries(preferences)
      .filter(([key, value]) => value)
      .map(([key]) => preferenceTypeMap[key]);

    // Fallback: If no filters selected, pick at least one
    if (filters.length === 0) filters.push('tourist_attraction');

    const requestData = {
      budget: parseInt(budget),
      location,
      radius,
      filters,
      people: numberOfPeople,
      hasPrivateVehicle: privateVehicleOwned,
    };

    try {
      const response = await fetch('http://localhost:5000/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch itinerary');
      }

      onItineraryGenerated(result);

    } catch (error) {
      console.error('Error:', error);
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8 px-4">
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out" 
               style={{ width: `${(currentStep / 3) * 100}%` }}></div>
        </div>
      </div>

      <form className="glass-card p-8 sm:p-10 rounded-3xl animate-fade-in-up">
        
        {/* Step 1: Location */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-3xl font-black font-display text-white tracking-tight">Where to?</h3>
            </div>
            
            <div className="relative">
                <input 
                    type="text" 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    onKeyDown={handleKeyDown} // Handle Enter Key
                    placeholder="e.g. Mannuthy, Thrissur" 
                    className="w-full pl-6 pr-14 py-4 bg-gray-900/50 border border-gray-700 rounded-2xl focus:border-blue-500 text-xl text-white outline-none transition-all"
                    autoFocus 
                />
                {/* GPS Button */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all disabled:animate-pulse"
                  title="Use Current Location"
                >
                  {locating ? (
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
            </div>

            <div className="pt-2">
                <div className="flex justify-between text-xs font-bold text-blue-400 uppercase mb-2">
                    <span>Search Radius</span>
                    <span>{(parseInt(radius)/1000).toFixed(1)} km</span>
                </div>
                <input 
                    type="range" 
                    min="1000" 
                    max="25000" 
                    step="1000" 
                    value={radius} 
                    onChange={e => setRadius(e.target.value)} 
                    className="slider w-full" 
                />
            </div>
          </div>
        )}

        {/* Step 2: Budget */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-3xl font-black font-display text-white text-center">Your Budget</h3>
            <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 text-xl">₹</span>
                <input 
                    type="number" 
                    value={budget} 
                    onChange={e => setBudget(e.target.value)} 
                    onKeyDown={handleKeyDown} // Handle Enter Key
                    placeholder="5000" 
                    className="w-full pl-12 pr-6 py-4 bg-gray-900/50 border border-gray-700 rounded-2xl text-xl text-white focus:border-green-500 outline-none" 
                    autoFocus 
                />
            </div>
            <div className="flex justify-center items-center gap-4 bg-gray-900/30 p-4 rounded-2xl border border-gray-800">
                <button type="button" onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))} className="w-10 h-10 bg-gray-800 rounded-lg text-white hover:bg-gray-700">-</button>
                <span className="text-xl font-bold font-display text-white w-24 text-center">{numberOfPeople} People</span>
                <button type="button" onClick={() => setNumberOfPeople(numberOfPeople + 1)} className="w-10 h-10 bg-gray-800 rounded-lg text-white hover:bg-gray-700">+</button>
            </div>
          </div>
        )}

        {/* Step 3: Preferences & Submit */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-3xl font-black font-display text-white text-center">Vibe Check</h3>
            <div className="space-y-3">
                {[
                    { key: 'food', label: 'Food & Cafes', icon: '🍽️' },
                    { key: 'entertainment', label: 'Movies & Fun', icon: '🎬' },
                    { key: 'activities', label: 'Adventure & Nature', icon: '🧗' }
                ].map(({ key, label, icon }) => (
                    <label key={key} className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${preferences[key] ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'}`}>
                        <input type="checkbox" name={key} checked={preferences[key]} onChange={handleChange} className="mr-4 w-5 h-5 accent-blue-500"/>
                        <span className="text-2xl mr-3">{icon}</span>
                        <span className="text-white font-bold">{label}</span>
                    </label>
                ))}
            </div>
            
            <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-all ${privateVehicleOwned ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'}`}>
              <input type="checkbox" checked={privateVehicleOwned} onChange={e => setPrivateVehicleOwned(e.target.checked)} className="mr-4 w-5 h-5 accent-purple-500"/>
              <span className="text-2xl mr-3">🚗</span>
              <div>
                  <span className="text-white font-bold block">I have a vehicle</span>
                  <span className="text-xs text-gray-400">Calculate fuel cost instead of cab</span>
              </div>
            </label>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
            {currentStep > 1 ? (
                <button type="button" onClick={prevStep} className="text-gray-400 hover:text-white font-bold px-4">Back</button>
            ) : <div></div>}
            
            <button 
                // SAFETY: Type is strictly 'button' unless on Step 3
                type={currentStep === 3 ? 'button' : 'button'} 
                onClick={currentStep === 3 ? handleSubmit : nextStep}
                disabled={!isStepValid() || submitting}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold font-display hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {submitting ? (
                    <>
                     <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     Planning...
                    </>
                ) : (
                    currentStep === 3 ? 'Create Plan ✨' : 'Next Step →'
                )}
            </button>
        </div>
      </form>
    </div>
  );
}