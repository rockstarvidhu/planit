import React, { useState } from 'react';

// Helper function to get an icon based on activity type
const getActivityIcon = (type) => {
  const icons = {
    park: '🌳',
    natural_feature: '🏔️',
    tourist_attraction: '🏛️',
    campground: '⛺',
    movie_theater: '🎬',
    amusement_park: '🎢',
    aquarium: '🐠',
    zoo: '🦁',
    bowling_alley: '🎳',
    arcade: '🕹️',
    casino: '🎰',
    night_club: '🎤',
    spa: '🧖',
    default: '📍'
  };
  return icons[type] || icons.default;
};

// Helper function to get transport mode icon and description
const getTransportInfo = (mode) => {
  const transportInfo = {
    own_vehicle: { icon: '🚗', description: 'Own Vehicle', color: 'blue' },
    ride_share: { icon: '🚕', description: 'Ride Share', color: 'yellow' },
    public_transport: { icon: '🚌', description: 'Public Transport', color: 'green' }
  };
  return transportInfo[mode] || transportInfo.own_vehicle;
};

const ItineraryOptions = ({ data, onSelectOption }) => {
  const [selectedOption, setSelectedOption] = useState(null);

  if (!data || !data.options || data.options.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-red-900/30 rounded-2xl shadow-2xl p-8 border-2 border-red-800/30">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-red-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-2xl font-extrabold text-white mb-3">No Options Available</h3>
          <p className="text-gray-300 font-bold mb-6">Unable to find activities within your budget. Try increasing your budget or expanding your search radius.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="inline-block px-3 py-1 bg-red-600/70 text-white font-extrabold rounded-full text-sm">Increase Budget</span>
            <span className="inline-block px-3 py-1 bg-orange-600/70 text-white font-extrabold rounded-full text-sm">Expand Radius</span>
            <span className="inline-block px-3 py-1 bg-yellow-600/70 text-white font-extrabold rounded-full text-sm">Try Different Location</span>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectOption = (option) => {
    setSelectedOption(option);
    onSelectOption(option);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-5xl font-black text-white mb-4 tracking-tight">Choose Your Adventure</h2>
        <p className="text-xl text-gray-300 font-bold mb-6">Multiple itinerary options tailored to your budget</p>
        
        {/* Summary Stats */}
        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-6 border border-gray-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-black text-blue-400">💰</div>
              <div className="text-sm text-gray-300 font-bold">Budget</div>
              <div className="text-lg font-black text-white">₹{data.budget}</div>
            </div>
            <div>
              <div className="text-2xl font-black text-green-400">👥</div>
              <div className="text-sm text-gray-300 font-bold">People</div>
              <div className="text-lg font-black text-white">{data.people}</div>
            </div>
            <div>
              <div className="text-2xl font-black text-yellow-400">🎯</div>
              <div className="text-sm text-gray-300 font-bold">Options</div>
              <div className="text-lg font-black text-white">{data.options.length}</div>
            </div>
            <div>
              <div className="text-2xl font-black text-purple-400">📍</div>
              <div className="text-sm text-gray-300 font-bold">Places Found</div>
              <div className="text-lg font-black text-white">{data.totalPlacesFound}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Itinerary Options */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.options.map((option, index) => {
          const transportInfo = getTransportInfo(data.transportMode);
          const isSelected = selectedOption === option;
          
          return (
            <div
              key={index}
              className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 border-2 shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 ${
                isSelected 
                  ? 'border-blue-500 shadow-blue-500/20' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => handleSelectOption(option)}
            >
              {/* Option Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg`}>
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">{option.title}</h3>
                    <p className="text-gray-400 font-bold">{option.places.length} locations</p>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Cost Breakdown */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-black text-green-400">₹{option.totalCost}</div>
                    <div className="text-xs text-gray-400 font-bold">Total Cost</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-blue-400">₹{option.budgetRemaining}</div>
                    <div className="text-xs text-gray-400 font-bold">Remaining</div>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <div className="text-sm text-gray-300 font-bold">
                    {Math.round((option.totalCost / data.budget) * 100)}% of budget used
                  </div>
                </div>
              </div>

              {/* Transport Info */}
              <div className="flex items-center justify-center mb-4">
                <div className={`flex items-center space-x-2 bg-${transportInfo.color}-900/30 px-4 py-2 rounded-full`}>
                  <span className="text-xl">{transportInfo.icon}</span>
                  <span className="text-gray-200 font-bold text-sm">{transportInfo.description}</span>
                </div>
              </div>

              {/* Places Preview */}
              <div className="space-y-2">
                {option.places.slice(0, 3).map((place, placeIndex) => (
                  <div key={placeIndex} className="flex items-center space-x-3 p-2 bg-gray-700/50 rounded-lg">
                    <span className="text-lg">{getActivityIcon(place.filterType)}</span>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">{place.name}</div>
                      <div className="text-xs text-gray-400">₹{place.placeCost} • {place.rating ? `⭐ ${place.rating}` : 'No rating'}</div>
                    </div>
                  </div>
                ))}
                {option.places.length > 3 && (
                  <div className="text-center text-gray-400 font-bold text-sm">
                    +{option.places.length - 3} more locations
                  </div>
                )}
              </div>

              {/* Select Button */}
              <button
                className={`w-full mt-4 py-3 rounded-xl font-black transition-all duration-300 ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {isSelected ? 'Selected' : 'Select This Option'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ItineraryOptions;
