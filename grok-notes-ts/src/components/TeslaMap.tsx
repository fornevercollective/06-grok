import React, { useEffect, useRef, useState } from 'react';

const TeslaMap: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          setUserLocation({ lat: 39.8283, lng: -98.5795 }); // Default to US center
        }
      );
    } else {
      setUserLocation({ lat: 39.8283, lng: -98.5795 });
    }

    // Load Google Maps script
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('VITE_GOOGLE_MAPS_API_KEY not set');
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    script.onload = () => {
      const g = window.google;
      if (!mapRef.current || !g || !userLocation) return;
      const map = new g.maps.Map(mapRef.current, {
        center: userLocation,
        zoom: 8,
      });

      // Add markers for Tesla superchargers (expanded mock data)
      const superchargers = [
        { lat: 37.7749, lng: -122.4194, name: 'San Francisco Supercharger' },
        { lat: 34.0522, lng: -118.2437, name: 'Los Angeles Supercharger' },
        { lat: 40.7128, lng: -74.0060, name: 'New York Supercharger' },
        { lat: 41.8781, lng: -87.6298, name: 'Chicago Supercharger' },
        { lat: 29.7604, lng: -95.3698, name: 'Houston Supercharger' },
        { lat: 33.4484, lng: -112.0740, name: 'Phoenix Supercharger' },
        { lat: 39.7392, lng: -104.9903, name: 'Denver Supercharger' },
        { lat: 47.6062, lng: -122.3321, name: 'Seattle Supercharger' },
        { lat: 35.6762, lng: 139.6503, name: 'Tokyo Supercharger' },
        { lat: 51.5074, lng: -0.1278, name: 'London Supercharger' },
        // Add more as needed
      ];

      superchargers.forEach((station) => {
        new g.maps.Marker({
          position: { lat: station.lat, lng: station.lng },
          map,
          title: station.name,
        });
      });
    };

    return () => {
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, [userLocation]);

  if (!process.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="gp-brand-embed gp-brand-missing-key">
        <div className="gp-status-card">
          <h3>Tesla map</h3>
          <p>
            Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env</code> to load Google Maps.
          </p>
          <p>
            <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer">
              Google Cloud Console — Maps JavaScript API
            </a>
          </p>
          <p style={{ marginTop: 10 }}>Illustrative vehicle / energy readouts (not live API):</p>
          <div className="gp-status-row">
            <span className="gp-status-k">Charge</span>
            <span className="gp-status-v">85% (mock)</span>
          </div>
          <div className="gp-status-row">
            <span className="gp-status-k">Powerwall</span>
            <span className="gp-status-v">Online (mock)</span>
          </div>
          <div className="gp-status-row">
            <span className="gp-status-k">Solar</span>
            <span className="gp-status-v">5 kW (mock)</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gp-brand-embed">
      <div ref={mapRef} className="gp-brand-map" />
      <div className="gp-status-card" aria-label="Tesla status (mock)">
        <h3>Superchargers</h3>
        <p>Mock markers — real vehicle and charger data need Tesla APIs + OAuth.</p>
        <div className="gp-status-row">
          <span className="gp-status-k">Charge</span>
          <span className="gp-status-v">85% (mock)</span>
        </div>
        <div className="gp-status-row">
          <span className="gp-status-k">Powerwall</span>
          <span className="gp-status-v">Online (mock)</span>
        </div>
        <div className="gp-status-row">
          <span className="gp-status-k">Solar</span>
          <span className="gp-status-v">5 kW (mock)</span>
        </div>
      </div>
    </div>
  );
};

export default TeslaMap;