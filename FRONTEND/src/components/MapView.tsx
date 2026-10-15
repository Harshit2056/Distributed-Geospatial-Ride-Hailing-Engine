import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LocationCoordinate } from '../types';

// Custom modern SVG icons using L.divIcon
const createCustomIcon = (type: 'pickup' | 'dropoff' | 'driver' | 'nearby') => {
  let innerHtml = '';

  if (type === 'pickup') {
    innerHtml = `
      <div class="relative flex items-center justify-center w-8 h-8">
        <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
        <div class="relative inline-flex items-center justify-center rounded-full h-7 w-7 bg-emerald-600 text-white font-bold text-xs shadow-lg border-2 border-white">
          P
        </div>
      </div>
    `;
  } else if (type === 'dropoff') {
    innerHtml = `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="relative inline-flex items-center justify-center rounded-full h-7 w-7 bg-rose-600 text-white font-bold text-xs shadow-lg border-2 border-white">
          D
        </div>
      </div>
    `;
  } else if (type === 'driver') {
    innerHtml = `
      <div class="relative flex items-center justify-center w-10 h-10">
        <span class="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-pulse"></span>
        <div class="relative inline-flex items-center justify-center rounded-full h-8 w-8 bg-amber-500 text-gray-900 shadow-xl border-2 border-gray-950 text-sm">
          🚕
        </div>
      </div>
    `;
  } else {
    // Nearby taxi
    innerHtml = `
      <div class="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-amber-400 text-xs shadow-md">
        🚕
      </div>
    `;
  }

  return L.divIcon({
    html: innerHtml,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Component to dynamically fit bounds or recenter
const ChangeMapView: React.FC<{ center: [number, number]; zoom?: number }> = ({ center, zoom = 14 }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

// Component to handle map clicks
const MapClickHandler: React.FC<{
  onMapClick?: (coords: LocationCoordinate) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick({
          latitude: Number(e.latlng.lat.toFixed(6)),
          longitude: Number(e.latlng.lng.toFixed(6)),
        });
      }
    },
  });
  return null;
};

interface MapViewProps {
  pickup?: LocationCoordinate | null;
  dropoff?: LocationCoordinate | null;
  driverLocation?: LocationCoordinate | null;
  nearbyDrivers?: { id: string; location: LocationCoordinate }[];
  routeCoordinates?: [number, number][];
  waypoints?: { id: number; name: string; latitude: number; longitude: number }[];
  onMapClick?: (coords: LocationCoordinate) => void;
  center?: [number, number];
  zoom?: number;
}

export const MapView: React.FC<MapViewProps> = ({
  pickup,
  dropoff,
  driverLocation,
  nearbyDrivers = [],
  routeCoordinates,
  waypoints = [],
  onMapClick,
  center = [28.6315, 77.2167], // Connaught Place, New Delhi default
  zoom = 13,
}) => {
  const mapCenter: [number, number] = pickup
    ? [pickup.latitude, pickup.longitude]
    : driverLocation
    ? [driverLocation.latitude, driverLocation.longitude]
    : center;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-800 shadow-2xl bg-gray-950">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      >
        <ChangeMapView center={mapCenter} zoom={zoom} />
        <MapClickHandler onMapClick={onMapClick} />

        {/* CartoDB modern tile layer with official key param or OpenStreetMap fallback */}
        {(() => {
          const apiKey = import.meta.env.VITE_CARTO_API_KEY;
          const url = apiKey && apiKey !== 'your_carto_api_key_here'
            ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${apiKey}`
            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

          return (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={url}
            />
          );
        })()}

        {/* Pickup Marker */}
        {pickup && (
          <Marker
            position={[pickup.latitude, pickup.longitude]}
            icon={createCustomIcon('pickup')}
          >
            <Popup className="text-gray-900 font-sans">
              <div className="font-semibold text-emerald-700">📍 Pickup Location</div>
              <div className="text-xs text-gray-600">
                Lat: {pickup.latitude}, Lng: {pickup.longitude}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dropoff Marker */}
        {dropoff && (
          <Marker
            position={[dropoff.latitude, dropoff.longitude]}
            icon={createCustomIcon('dropoff')}
          >
            <Popup className="text-gray-900 font-sans">
              <div className="font-semibold text-rose-700">🏁 Dropoff Location</div>
              <div className="text-xs text-gray-600">
                Lat: {dropoff.latitude}, Lng: {dropoff.longitude}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Dijkstra Shortest Path Road Navigation Polyline */}
        {routeCoordinates && routeCoordinates.length > 1 ? (
          <>
            {/* Outer road boundary glow */}
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#1d4ed8',
                weight: 8,
                opacity: 0.85,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
            {/* Inner neon navigation beam */}
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#60a5fa',
                weight: 4,
                opacity: 1,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
          </>
        ) : (
          pickup &&
          dropoff && (
            <Polyline
              positions={[
                [pickup.latitude, pickup.longitude],
                [dropoff.latitude, dropoff.longitude],
              ]}
              pathOptions={{
                color: '#3b82f6',
                weight: 4,
                dashArray: '8, 8',
                opacity: 0.8,
              }}
            />
          )
        )}

        {/* Dijkstra Intermediate Waypoint Markers */}
        {waypoints.map((wp) => (
          <Marker
            key={wp.id}
            position={[wp.latitude, wp.longitude]}
            icon={L.divIcon({
              html: `
                <div class="flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md">
                  <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
                </div>
              `,
              className: 'custom-waypoint-dot',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          >
            <Popup className="text-gray-900 font-sans">
              <div className="font-semibold text-blue-700">🛣️ Dijkstra Road Intersection</div>
              <div className="text-xs font-medium text-gray-800">{wp.name}</div>
              <div className="text-[10px] text-gray-500">Node #{wp.id}</div>
            </Popup>
          </Marker>
        ))}

        {/* Active Driver Marker */}
        {driverLocation && (
          <Marker
            position={[driverLocation.latitude, driverLocation.longitude]}
            icon={createCustomIcon('driver')}
          >
            <Popup className="text-gray-900 font-sans">
              <div className="font-bold text-amber-600">🚕 Assigned Driver</div>
              <div className="text-xs text-gray-600">
                Lat: {driverLocation.latitude}, Lng: {driverLocation.longitude}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Nearby Drivers Markers */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={driver.id}
            position={[driver.location.latitude, driver.location.longitude]}
            icon={createCustomIcon('nearby')}
          >
            <Popup className="text-gray-900 font-sans">
              <div className="font-semibold text-gray-700">Nearby Driver</div>
              <div className="text-xs text-gray-500">ID: {driver.id.slice(0, 8)}...</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
