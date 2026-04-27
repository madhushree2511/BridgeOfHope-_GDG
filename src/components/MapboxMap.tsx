import React, { useState, useEffect } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, Loader2 } from 'lucide-react';

interface MapboxMapProps {
  address: string;
  className?: string;
  zoom?: number;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function MapboxMap({ address, className = "w-full h-full", zoom = 14 }: MapboxMapProps) {
  const [viewState, setViewState] = useState({
    latitude: 0,
    longitude: 0,
    zoom: zoom
  });
  const [markerLocation, setMarkerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    if (!MAPBOX_TOKEN) {
        setError("Mapbox token missing");
        setLoading(false);
        return;
    }

    const geocode = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
        );
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          setMarkerLocation({ lat, lng });
          setViewState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
          }));
        } else {
          setError("Location not found");
        }
      } catch (err) {
        setError("Map load failed");
      } finally {
        setLoading(false);
      }
    };

    geocode();
  }, [address]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center p-6 text-center`}>
        <p className="text-gray-400 text-xs font-black uppercase tracking-widest">
          Mapbox Token Not Configured
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${className} bg-gray-50 flex flex-col items-center justify-center gap-2`}>
        <Loader2 className="animate-spin text-blue-600" />
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Geocoding...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-gray-50 flex items-center justify-center`}>
        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{error}</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={MAPBOX_TOKEN}
        attributionControl={false}
      >
        {markerLocation && (
          <Marker 
            latitude={markerLocation.lat} 
            longitude={markerLocation.lng} 
          >
            <div className="bg-red-600 p-2 rounded-full shadow-lg border-2 border-white text-white flex items-center justify-center">
              <MapPin size={22} fill="currentColor" />
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}
