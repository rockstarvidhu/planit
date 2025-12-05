import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';

const mapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] }
];

const containerStyle = { width: '100%', height: '100%', borderRadius: '1rem' };
const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Default to Bangalore center

// 🚕 CHARACTER ICON
const CAR_ICON = {
  url: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png", // Pixel Taxi Art
  scaledSize: { width: 40, height: 40 } // Size of the car
};

export default function MapView({ itinerary }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_API_KEY || ""
  });

  const [map, setMap] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [carPosition, setCarPosition] = useState(null);
  const animationRef = useRef(null);
  const progressRef = useRef(0);

  const markers = useMemo(() => {
    if (!itinerary?.itinerary) return [];
    return itinerary.itinerary.map((place, i) => ({
      id: i,
      name: place.name, // Real name from backend
      position: place.location,
      type: place.type,
      travelTime: place.travelTime,
      travelCost: place.travelCost
    })).filter(m => m.position && m.position.lat);
  }, [itinerary]);

  useEffect(() => {
    if (markers.length > 1) {
      const path = markers.map(m => m.position);
      setRoutePath(path);
      setCarPosition(path[0]);
      progressRef.current = 0;
    }
  }, [markers]);

  // SMOOTH ANIMATION
  useEffect(() => {
    if (!routePath.length || routePath.length < 2) return;
    const animate = () => {
      progressRef.current += 0.005; // Speed adjustment
      if (progressRef.current >= routePath.length - 1) progressRef.current = 0;
      
      const currentIdx = Math.floor(progressRef.current);
      const nextIdx = (currentIdx + 1) % routePath.length;
      const ratio = progressRef.current - currentIdx;
      
      const p1 = routePath[currentIdx];
      const p2 = routePath[nextIdx];
      
      const lat = p1.lat + (p2.lat - p1.lat) * ratio;
      const lng = p1.lng + (p2.lng - p1.lng) * ratio;
      
      setCarPosition({ lat, lng });
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [routePath]);

  const onLoad = useCallback((map) => {
    setMap(map);
    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.position));
      map.fitBounds(bounds);
    }
  }, [markers]);

  if (loadError) return <div className="text-red-500 text-center p-10">Map Error: {loadError.message}</div>;
  if (!isLoaded) return <div className="glass-card h-96 flex items-center justify-center text-blue-300 animate-pulse">LOADING SATELLITE FEED...</div>;

  return (
    <div className="glass-card rounded-3xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
      <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-black font-display text-white mb-1">Live Tracking</h3>
          <p className="text-gray-400 text-sm">Visualizing route sequence</p>
        </div>
      </div>

      <div className="h-[500px] w-full relative">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={12}
          onLoad={onLoad}
          options={{ styles: mapStyles, disableDefaultUI: false }}
        >
          {/* 1. Route Line */}
          <Polyline path={routePath} options={{ strokeColor: "#3b82f6", strokeOpacity: 0.6, strokeWeight: 6, geodesic: true }} />

          {/* 2. Destination Pins (With Names) */}
          {markers.map((marker, i) => (
            <Marker
              key={marker.id}
              position={marker.position}
              onClick={() => setSelectedPlace(marker)}
              label={{ 
                text: marker.name, // SHOWS NAME ON MAP
                color: "white", 
                className: "bg-black/50 px-2 py-1 rounded text-xs font-bold mt-10" // Custom styling for label
              }} 
            />
          ))}

          {/* 3. The Moving Character/Car */}
          {carPosition && (
            <Marker
              position={carPosition}
              icon={CAR_ICON} // Uses the taxi image
              zIndex={1000}
            />
          )}

          {/* 4. Info Window */}
          {selectedPlace && (
            <InfoWindow position={selectedPlace.position} onCloseClick={() => setSelectedPlace(null)}>
              <div className="text-black p-2 min-w-[150px]">
                <h4 className="font-bold text-lg mb-1 font-display">{selectedPlace.name}</h4>
                <div className="text-xs text-gray-600 space-y-1">
                    <p>🚕 Travel: {selectedPlace.travelTime || 'Calculating...'}</p>
                    <p>💵 Cost: ₹{selectedPlace.travelCost || 0}</p>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}