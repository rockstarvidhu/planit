import React, { useState } from 'react';

// Helper function to format currency (e.g., for Indian Rupees)
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// Helper function to get an icon based on activity type
const getActivityIcon = (type) => {
    const icons = {
        food: '🍽️',
        nature: '🌳',
        date: '💕',
        adventure: '🏔️',
        explore: '🗺️',
        entertainment: '🎬',
        activities: '🎯'
    };
    return icons[type] || '📍';
};

// Helper function to get an icon for transport mode
const getTransportIcon = (mode) => {
    const icons = {
        private_vehicle: '🚗',
        public_transport: '🚌',
        walking: '🚶',
        bicycling: '🚲'
    };
    return icons[mode] || '🚚';
};

const ItineraryDisplay = ({ itinerary }) => {
    const [expandedDay, setExpandedDay] = useState(null);
    const [selectedTab, setSelectedTab] = useState('summary');

    if (!itinerary || !itinerary.itinerary || itinerary.itinerary.length === 0) {
        return (
            <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-black text-white mb-2">No Itinerary Generated</h3>
                    <p className="text-gray-400 font-medium">Please adjust your preferences and try again.</p>
                </div>
            </div>
        );
    }

    // Flat itinerary: just show each place in a list
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-4xl font-black text-white mb-2">Your Perfect Itinerary</h2>
                <p className="text-xl text-gray-300 font-medium">Tailored just for you with smart recommendations</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {itinerary.itinerary.map((place, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-2xl font-black text-white">{place.name}</h3>
                            <span className="text-sm font-bold text-blue-400 capitalize">{place.type}</span>
                        </div>
                        <div className="text-gray-300 font-medium mb-1">{place.address}</div>
                        <div className="flex items-center space-x-4 text-sm mt-2">
                            <span className="font-black text-green-400">₹{place.estimatedCost}</span>
                            <span className="text-yellow-400 font-black">⭐ {place.rating}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-right mt-6">
                <span className="text-lg font-black text-white">Total Estimated Cost: </span>
                <span className="text-lg font-black text-green-400">₹{itinerary.totalCost}</span>
            </div>
        </div>
    );
};

export default ItineraryDisplay;

