import React, { useState, useEffect } from 'react';
import UserInputForm from './components/UserInputForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import MapView from './components/MapView';
import SplashScreen from './components/SplashScreen';

function App() {
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [currentStep, setCurrentStep] = useState('input'); 

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5000); 
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  // FIX: Accept the FULL data object (including aiSummary)
  const handleItineraryGenerated = (fullData) => {
    setItinerary(fullData); 
    setLoading(false);
    setError(null);
    setCurrentStep('result');
  };

  const handleError = (msg) => {
    setLoading(false);
    setError(msg);
  };

  const handleStartOver = () => {
    setItinerary(null);
    setError(null);
    setCurrentStep('input');
  };

  const handleFormSubmit = () => {
    setLoading(true);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-black bg-grid-pattern font-sans relative overflow-x-hidden selection:bg-blue-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black/0 to-black pointer-events-none fixed" />

      {/* Header */}
      <header className="glass-card sticky top-0 z-50 border-t-0 border-x-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3 group cursor-pointer" onClick={handleStartOver}>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.4)] group-hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] transition-all duration-300">
                <span className="text-white font-black font-display text-xl">P</span>
              </div>
              <h1 className="text-2xl font-black font-display bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent tracking-tight group-hover:text-glow transition-all duration-300">
                Planit
              </h1>
            </div>
            {currentStep === 'result' && (
              <button
                onClick={handleStartOver}
                className="px-5 py-2 text-sm font-bold text-gray-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-lg transition-all duration-200 backdrop-blur-sm"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {/* Step Indicator */}
        {currentStep !== 'result' && (
          <div className="mb-12">
            <div className="flex items-center justify-center space-x-6">
              {[
                { step: 'input', num: 1, label: 'Input Details' },
                { step: 'loading', num: 2, label: 'Generate' },
                { step: 'result', num: 3, label: 'Results' }
              ].map((item, idx) => (
                <React.Fragment key={item.step}>
                  <div className={`flex items-center group ${currentStep === item.step ? 'text-blue-400 text-glow' : 'text-gray-600'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 ${
                      currentStep === item.step 
                        ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-110' 
                        : 'bg-gray-800 border border-gray-700'
                    }`}>
                      {item.num}
                    </div>
                    <span className="ml-3 text-sm font-bold hidden sm:block">{item.label}</span>
                  </div>
                  {idx < 2 && <div className="w-12 h-0.5 bg-gray-800 rounded-full"></div>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Loading Screen */}
        {loading && (
          <div className="text-center py-20 animate-fade-in-up">
            <div className="inline-flex flex-col items-center">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full loader-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
              </div>
              <h3 className="text-2xl font-black font-display text-white mb-2 text-glow">Crafting your perfect trip...</h3>
              <p className="text-blue-300/80 font-medium">Consulting AI & Analyzing Routes</p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="glass-card border-red-500/30 bg-red-900/20 p-6 mb-8 rounded-2xl flex items-start space-x-4 animate-fade-in-up">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-200">Something went wrong</h3>
              <p className="text-red-300/80 mt-1">{error}</p>
              <button 
                onClick={() => { setError(null); setLoading(false); }} 
                className="mt-2 text-sm font-bold text-red-400 hover:text-red-300 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Input Form */}
        {!loading && currentStep !== 'result' && (
          <UserInputForm 
            onItineraryGenerated={handleItineraryGenerated}
            onSubmit={handleFormSubmit}
            onError={handleError}
          />
        )}

        {/* Results */}
        {currentStep === 'result' && itinerary && (
          <div className="space-y-12 animate-fade-in-up">
            <div className="text-center mb-10">
              <h2 className="text-5xl font-black font-display text-white mb-4 tracking-tight text-glow">
                Your Itinerary is Ready
              </h2>
              <p className="text-xl text-gray-400 font-medium max-w-2xl mx-auto">
                We've organized the perfect plan within your budget.
              </p>
            </div>
            <ItineraryDisplay itinerary={itinerary} />
            <MapView itinerary={itinerary} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="glass-card mt-20 border-b-0 border-x-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm font-medium text-gray-500">
            <p>&copy; {new Date().getFullYear()} Planit. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;