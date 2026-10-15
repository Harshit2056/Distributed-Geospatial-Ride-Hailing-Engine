import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LocationCoordinate } from '../types';

// Custom clean map icons using L.divIcon
const createCustomIcon = (type: 'pickup' | 'dropoff' | 'driver' | 'nearby') => {
  let innerHtml = '';

  if (type === 'pickup') {
    innerHtml = `
      <div style="background-color: #10b981; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
        P
      </div>
    `;
  } else if (type === 'dropoff') {
    innerHtml = `
      <div style="background-color: #ef4444; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
        D
      </div>
    `;
  } else if (type === 'driver') {
    innerHtml = `
      <div style="background-color: #f59e0b; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
        🚕
      </div>
    `;
  } else {
    // Nearby taxi
    innerHtml = `
      <div style="background-color: #1f2937; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 1.5px solid #9ca3af;">
        🚕
      </div>
    `;
  }

  return L.divIcon({
    html: innerHtml,
    className: 'custom-leaflet-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

        {/* Road Navigation Polyline */}
        {routeCoordinates && routeCoordinates.length > 1 ? (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#2563eb',
              weight: 5,
              opacity: 0.9,
              lineJoin: 'round',
              lineCap: 'round',
            }}
          />
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
