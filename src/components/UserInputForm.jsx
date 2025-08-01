import React, { useState } from 'react';

const defaultPrefs = {
  food: true,
  entertainment: true,
  activities: true,
};

export default function UserInputForm({ onItineraryGenerated, onSubmit }) {
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('5');
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [numberOfPeople, setNumberOfPeople] = useState(2);
  const [privateVehicleOwned, setPrivateVehicleOwned] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setPreferences({
      ...preferences,
      [e.target.name]: e.target.checked,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submit triggered at step', currentStep);
    // Only submit if on the last step
    if (currentStep !== 3) {
      // If not on last step, advance to next step instead
      setCurrentStep(currentStep + 1);
      console.log('Advancing to step', currentStep + 1);
      return;
    }
    setLoading(true);
    onSubmit();

    // Map preferences to Google Places types
    const preferenceTypeMap = {
      food: 'restaurant',
      entertainment: 'movie_theater',
      activities: 'park',
    };
    const filters = Object.entries(preferences)
      .filter(([key, value]) => value)
      .map(([key]) => preferenceTypeMap[key]);

    const data = {
      budget,
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
        body: JSON.stringify(data),
      });

      const result = await response.json();
      onItineraryGenerated(result.itinerary, numberOfPeople, privateVehicleOwned);
    } catch (error) {
      console.error('Error fetching itinerary:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return location.trim() !== '';
      case 2:
        return budget > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-500' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
              currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              1
            </div>
            <span className="ml-2 text-sm font-bold">Location</span>
          </div>
          <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-500' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
              currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              2
            </div>
            <span className="ml-2 text-sm font-bold">Budget</span>
          </div>
          <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-500' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
              currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}>
              3
            </div>
            <span className="ml-2 text-sm font-bold">Preferences</span>
          </div>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      <form onSubmit={currentStep === 3 ? handleSubmit : (e) => e.preventDefault()} className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
        {/* Step 1: Location */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-black text-white mb-2">Where are you going?</h3>
              <p className="text-gray-300 font-medium">Tell us your destination to find the best local experiences</p>
            </div>
            
            <div>
              <label className="block text-sm font-black text-gray-200 mb-2">
                Destination
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Enter city, address, or landmark"
                required
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg text-white font-medium placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-gray-200 mb-2">
                Search Radius (km)
              </label>
              <div className="relative">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={radius}
                  onChange={e => setRadius(e.target.value)}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1 font-medium">
                  <span>1km</span>
                  <span className="font-black text-blue-400">{radius}km</span>
                  <span>20km</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Budget */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="text-3xl font-black text-white mb-2">What's your budget?</h3>
              <p className="text-gray-300 font-medium">Help us find activities that fit your budget perfectly</p>
            </div>
            
            <div>
              <label className="block text-sm font-black text-gray-200 mb-2">
                Total Budget (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg">₹</span>
                <input
                  type="number"
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 text-lg text-white font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-gray-200 mb-2">
                Number of People
              </label>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors border border-gray-700"
                >
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-2xl font-black text-white min-w-[3rem] text-center">{numberOfPeople}</span>
                <button
                  type="button"
                  onClick={() => setNumberOfPeople(numberOfPeople + 1)}
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors border border-gray-700"
                >
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Preferences */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-black text-white mb-2">What interests you?</h3>
              <p className="text-gray-300 font-medium">Select your preferences to get personalized recommendations</p>
            </div>
            
            <div className="space-y-4">
              <label className="block text-sm font-black text-gray-200 mb-3">
                Activity Types
              </label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'food', label: 'Food & Dining', icon: '🍽️', description: 'Restaurants, cafes, and local cuisine' },
                  { key: 'entertainment', label: 'Entertainment', icon: '🎬', description: 'Movies, shows, and fun activities' },
                  { key: 'activities', label: 'Outdoor Activities', icon: '🌳', description: 'Parks, hiking, and adventure' }
                ].map(({ key, label, icon, description }) => (
                  <label key={key} className="flex items-center p-4 border border-gray-700 rounded-xl hover:bg-gray-800 cursor-pointer transition-colors bg-gray-800">
                    <input
                      type="checkbox"
                      name={key}
                      checked={preferences[key]}
                      onChange={handleChange}
                      className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center">
                        <span className="text-xl mr-3">{icon}</span>
                        <span className="font-black text-white">{label}</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 font-medium">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-black text-gray-200 mb-3">
                Transportation
              </label>
              <label className="flex items-center p-4 border border-gray-700 rounded-xl hover:bg-gray-800 cursor-pointer transition-colors bg-gray-800">
                <input
                  type="checkbox"
                  checked={privateVehicleOwned}
                  onChange={e => setPrivateVehicleOwned(e.target.checked)}
                  className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <span className="text-xl mr-3">🚗</span>
                    <span className="font-black text-white">I have a private vehicle</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 font-medium">This helps us plan better transportation options</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-700">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="px-6 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors font-black border border-gray-700"
            >
              ← Back
            </button>
          )}
          
          <div className="ml-auto">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!isStepValid()}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-black"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !isStepValid()}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200 font-black shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Plan...
                  </div>
                ) : (
                  'Create My Plan ✨'
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
} 