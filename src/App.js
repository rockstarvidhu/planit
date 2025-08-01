import React, { useState, useEffect } from 'react';
import UserInputForm from './components/UserInputForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import MapView from './components/MapView';
import SplashScreen from './components/SplashScreen';

function App() {
  const [userInput, setUserInput] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [currentStep, setCurrentStep] = useState('input'); // 'input', 'loading', 'result'

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5000); // 5 seconds
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) return <SplashScreen />;

  const handleItineraryGenerated = (itinerary, totalCost) => {
    setItinerary({ itinerary, totalCost });
    setLoading(false);
    setError(null);
    setCurrentStep('result');
  };

  const handleStartOver = () => {
    setItinerary(null);
    setError(null);
    setCurrentStep('input');
  };

  const handleFormSubmit = () => {
    setLoading(true);
    // Do NOT set currentStep here; let UserInputForm handle its own steps
  };

  return (
    <div className="min-h-screen bg-black font-sans">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <h1 className="text-xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Planit
              </h1>
            </div>
            {itinerary && (
              <button
                onClick={handleStartOver}
                className="px-4 py-2 text-sm font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Indicator */}
        {currentStep !== 'input' && (
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              <div className={`flex items-center ${currentStep === 'input' ? 'text-blue-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                  currentStep === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  1
                </div>
                <span className="ml-2 text-sm font-bold">Input Details</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-700"></div>
              <div className={`flex items-center ${currentStep === 'loading' ? 'text-blue-500' : currentStep === 'result' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                  currentStep === 'loading' ? 'bg-blue-600 text-white' : currentStep === 'result' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-bold">Generate Plan</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-700"></div>
              <div className={`flex items-center ${currentStep === 'result' ? 'text-green-500' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                  currentStep === 'result' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  3
                </div>
                <span className="ml-2 text-sm font-bold">View Results</span>
              </div>
            </div>
          </div>
        )}

        {/* Always show the form unless on result page */}
        {currentStep !== 'result' && (
          <UserInputForm 
            onItineraryGenerated={handleItineraryGenerated}
            onSubmit={handleFormSubmit}
          />
        )}

        {/* Loading Screen */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center px-4 py-2 font-bold leading-6 text-blue-400 transition ease-in-out duration-150">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Crafting your perfect itinerary...
            </div>
            <p className="mt-4 text-gray-400 font-medium">This may take a few moments</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-bold text-red-300">Error</h3>
                <div className="mt-2 text-sm text-red-200">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {currentStep === 'result' && itinerary && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-4xl font-black text-white mb-4">
                Your Personalized Itinerary
              </h2>
              <p className="text-xl text-gray-300 font-medium">
                Here's your perfect day out, tailored just for you!
              </p>
            </div>
            <ItineraryDisplay itinerary={itinerary} />
            <MapView itinerary={itinerary} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/80 backdrop-blur-md border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-400 text-sm font-medium">
            <p>&copy; {new Date().getFullYear()} Planit. Made with ❤️ for amazing experiences.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App; 