import React, { useState } from 'react';

export default function MapView({ itinerary }) {
  const [selectedDay, setSelectedDay] = useState(1);

  if (!itinerary || !itinerary.itinerary || itinerary.itinerary.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-white mb-2">Interactive Map</h3>
          <p className="text-gray-400 font-medium">Your itinerary locations will appear here</p>
        </div>
      </div>
    );
  }

  const days = itinerary.itinerary.map(day => day.day);
  const selectedDayData = itinerary.itinerary.find(day => day.day === selectedDay);

  return (
    <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black mb-2">Interactive Map</h3>
            <p className="text-blue-100 font-medium">View your itinerary locations and routes</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex space-x-2 overflow-x-auto">
          {days.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-lg font-black whitespace-nowrap transition-all duration-200 ${
                selectedDay === day
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              Day {day}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="p-6">
        <div className="bg-gray-800 rounded-xl p-8 border-2 border-dashed border-gray-600 relative overflow-hidden">
          {/* Map Placeholder */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="text-lg font-black text-white mb-2">Map Integration Coming Soon</h4>
            <p className="text-gray-400 font-medium mb-4">Interactive map with real-time location data</p>
          </div>

          {/* Location Pins */}
          <div className="relative">
            {selectedDayData?.activities.map((activity, index) => (
              <div key={index} className="absolute transform -translate-x-1/2 -translate-y-1/2">
                <div 
                  className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    left: `${20 + (index * 15)}%`,
                    top: `${30 + (index * 10)}%`
                  }}
                  title={activity.name}
                ></div>
                <div 
                  className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 rounded-lg shadow-lg p-2 text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity border border-gray-700"
                  style={{
                    left: `${20 + (index * 15)}%`,
                    top: `${30 + (index * 10)}%`
                  }}
                >
                  <span className="text-white font-medium">{activity.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Route Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {selectedDayData?.activities.slice(0, -1).map((_, index) => (
              <line
                key={index}
                x1={`${20 + (index * 15)}%`}
                y1={`${30 + (index * 10)}%`}
                x2={`${20 + ((index + 1) * 15)}%`}
                y2={`${30 + ((index + 1) * 10)}%`}
                stroke="#3B82F6"
                strokeWidth="2"
                strokeDasharray="5,5"
                opacity="0.6"
              />
            ))}
          </svg>
        </div>

        {/* Location List */}
        <div className="mt-6">
          <h5 className="text-lg font-black text-white mb-4">Day {selectedDay} Locations</h5>
          <div className="space-y-3">
            {selectedDayData?.activities.map((activity, index) => (
              <div key={index} className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-black mr-3">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-black text-white">{activity.name}</div>
                  <div className="text-sm text-gray-400 font-medium">{activity.time}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-blue-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button className="p-2 text-gray-400 hover:text-blue-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Map Features */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '📍', title: 'Location Pins', desc: 'See all your stops' },
            { icon: '🛣️', title: 'Route Planning', desc: 'Optimized travel paths' },
            { icon: '⏰', title: 'Timing Info', desc: 'Real-time schedules' }
          ].map((feature, index) => (
            <div key={index} className="text-center p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="font-black text-white text-sm">{feature.title}</div>
              <div className="text-gray-400 text-xs font-medium">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 