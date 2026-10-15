import React, { useState, useEffect } from 'react';
import type { LocationCoordinate, RideRecord, NearbyDriver, SurgeData } from '../types';
import { rideApi, driverApi, routeApi } from '../services/api';
import { getSocket } from '../services/socket';
import { MapView } from './MapView';
import { Car } from 'lucide-react';

// Comprehensive Delhi NCR transit presets
const PRESET_LOCATIONS: { name: string; coords: LocationCoordinate }[] = [
  { name: 'Connaught Place', coords: { latitude: 28.6315, longitude: 77.2167 } },
  { name: 'India Gate', coords: { latitude: 28.6129, longitude: 77.2295 } },
  { name: 'Noida Sec 18', coords: { latitude: 28.5708, longitude: 77.3260 } },
  { name: 'Cyber Hub Gurgaon', coords: { latitude: 28.4952, longitude: 77.0891 } },
  { name: 'IGI Airport T3', coords: { latitude: 28.5562, longitude: 77.1000 } },
  { name: 'Saket Citywalk', coords: { latitude: 28.5280, longitude: 77.2190 } },
  { name: 'Hauz Khas IIT', coords: { latitude: 28.5460, longitude: 77.1940 } },
  { name: 'Nehru Place Hub', coords: { latitude: 28.5490, longitude: 77.2530 } },
  { name: 'Dwarka Sec 21', coords: { latitude: 28.5920, longitude: 77.0380 } },
  { name: 'Janakpuri West', coords: { latitude: 28.6290, longitude: 77.0780 } },
  { name: 'Rohini Sec 10', coords: { latitude: 28.7140, longitude: 77.1150 } },
  { name: 'DU North Campus', coords: { latitude: 28.6890, longitude: 77.2100 } },
  { name: 'Indirapuram', coords: { latitude: 28.6360, longitude: 77.3710 } },
  { name: 'Pari Chowk Gr. Noida', coords: { latitude: 28.4680, longitude: 77.5090 } },
  { name: 'Faridabad Chowk', coords: { latitude: 28.4110, longitude: 77.3130 } },
];

export const RiderDashboard: React.FC = () => {
  const [pickup, setPickup] = useState<LocationCoordinate>(PRESET_LOCATIONS[0].coords);
  const [dropoff, setDropoff] = useState<LocationCoordinate>(PRESET_LOCATIONS[1].coords);
  const [pinMode, setPinMode] = useState<'pickup' | 'dropoff'>('pickup');
  const [nearbyDrivers, setNearbyDrivers] = useState<{ id: string; location: LocationCoordinate }[]>([]);
  const [activeRide, setActiveRide] = useState<RideRecord | null>(null);
  const [driverTelemetry, setDriverTelemetry] = useState<LocationCoordinate | null>(null);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dijkstra Shortest Path State
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeWaypoints, setRouteWaypoints] = useState<{ id: number; name: string; latitude: number; longitude: number }[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeEtaSeconds, setRouteEtaSeconds] = useState<number | null>(null);
  const [aiSurge, setAiSurge] = useState<SurgeData | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);

  // Approximate fallback distance (in km)
  const calculateDistance = (p1: LocationCoordinate, p2: LocationCoordinate) => {
    const R = 6371; // Earth radius km
    const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.latitude * Math.PI) / 180) *
        Math.cos((p2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  };

  const fallbackDist = calculateDistance(pickup, dropoff);
  const effectiveDistance = routeDistance !== null && routeDistance > 0 ? routeDistance : fallbackDist;
  const estimatedBaseFare = 50.0;
  const perKmRate = 14.0;
  // Dynamic Gemini AI Surge Multiplier
  const surgeMultiplier = aiSurge?.multiplier || (effectiveDistance > 10 ? 1.35 : 1.1);
  const estimatedFare = Number(((estimatedBaseFare + effectiveDistance * perKmRate) * surgeMultiplier).toFixed(2));

  // Realistic ETA formatting: Dijkstra worker routeEtaSeconds or realistic city transit speed (~28 km/h)
  const estimatedMinutes = routeEtaSeconds && routeEtaSeconds > 0
    ? Math.max(1, Math.round(routeEtaSeconds / 60))
    : Math.max(1, Math.round((effectiveDistance / 28) * 60));

  const formatDuration = (mins: number) => {
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hrs} hr ${remainingMins} min` : `${hrs} hr`;
    }
    return `${mins} min`;
  };

  // Calculate Optimal Dijkstra Shortest Path when pickup or dropoff changes
  useEffect(() => {
    let isMounted = true;
    const computeOptimalRoute = async () => {
      setIsCalculatingRoute(true);
      try {
        const res = await routeApi.calculateRoute(pickup, dropoff);
        if (isMounted && res.data) {
          setRouteCoordinates(res.data.coordinates || []);
          setRouteWaypoints(res.data.waypoints || []);
          setRouteDistance(res.data.distance);
          setRouteEtaSeconds(res.data.etaSeconds);
          if (res.data.surge) {
            setAiSurge(res.data.surge);
          }
        }
      } catch (err) {
        console.warn('Dijkstra route calculation fallback:', err);
      } finally {
        if (isMounted) setIsCalculatingRoute(false);
      }
    };

    computeOptimalRoute();
    return () => {
      isMounted = false;
    };
  }, [pickup, dropoff]);

  // Fetch existing active ride on mount if page is refreshed
  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await rideApi.getActiveRide();
        if (res.data) {
          setActiveRide(res.data);
          setPickup({ latitude: Number(res.data.pickup_lat), longitude: Number(res.data.pickup_lon) });
          setDropoff({ latitude: Number(res.data.dropoff_lat), longitude: Number(res.data.dropoff_lon) });
        }
      } catch (e) {
        console.warn('Could not fetch active rider trip:', e);
      }
    };
    fetchActive();
  }, []);

  // Fetch nearby drivers whenever pickup changes
  useEffect(() => {
    const fetchNearby = async () => {
      try {
        const res = await driverApi.getNearby(pickup.latitude, pickup.longitude, 2);
        if (res.data?.drivers) {
          // Generate natural 360-degree radial scatter around pickup location
          const count = res.data.drivers.length;
          const plotted = res.data.drivers.map((d: NearbyDriver, idx: number) => {
            const angle = (idx * (2 * Math.PI)) / count + 0.4;
            const dist = 0.005 + ((idx * 23) % 9) * 0.0016; // Realistic 400m - 1.5km scatter
            return {
              id: d.driverId,
              location: {
                latitude: Number((pickup.latitude + Math.sin(angle) * dist).toFixed(6)),
                longitude: Number((pickup.longitude + Math.cos(angle) * dist * 1.15).toFixed(6)),
              },
            };
          });
          setNearbyDrivers(plotted);
        }
      } catch (e) {
        console.warn('Could not fetch nearby drivers:', e);
      }
    };

    fetchNearby();
  }, [pickup]);

  // Socket.io Real-time Event Subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeRide) return;

    // Join ride private room
    socket.emit('join_ride', activeRide.id);

    // Listen to driver live telemetry
    const handleDriverMoved = (data: { driverId: string; latitude: number; longitude: number }) => {
      setDriverTelemetry({
        latitude: data.latitude,
        longitude: data.longitude,
      });
    };

    // Listen to ride status transitions (FSM updates)
    const handleStatusUpdate = (data: { rideId: string; status: RideRecord['status'] }) => {
      if (data.rideId === activeRide.id) {
        setActiveRide((prev) => (prev ? { ...prev, status: data.status } : null));
      }
    };

    socket.on('driver_moved', handleDriverMoved);
    socket.on('ride_status_updated', handleStatusUpdate);

    return () => {
      socket.off('driver_moved', handleDriverMoved);
      socket.off('ride_status_updated', handleStatusUpdate);
    };
  }, [activeRide?.id]);

  // Request Ride Handler
  const handleRequestRide = async () => {
    setErrorMsg(null);
    setBookingLoading(true);

    try {
      const res = await rideApi.requestRide(pickup, dropoff, 1, 5);
      const ride = res.data;
      setActiveRide(ride);

      // If matched, seed initial driver position near pickup
      if (ride.driver_id) {
        setDriverTelemetry({
          latitude: pickup.latitude + 0.004,
          longitude: pickup.longitude + 0.003,
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || err.message || 'Ride booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  // Cancel Ride
  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      await rideApi.updateStatus(activeRide.id, 'CANCELLED');
      setActiveRide((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
    } catch (e: any) {
      console.error('Cancellation failed', e);
    }
  };

  const handleMapClick = (coords: LocationCoordinate) => {
    if (activeRide && activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELLED') {
      return; // Lock coordinates during active trip
    }
    if (pinMode === 'pickup') {
      setPickup(coords);
    } else {
      setDropoff(coords);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Control Panel (Left column) */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        {/* Simple Booking Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-white">Ride Booking</h2>
            <span className="text-xs text-gray-400">
              {nearbyDrivers.length} drivers nearby
            </span>
          </div>

          {/* Quick Presets */}
          <div className="mb-4">
            <span className="text-xs text-gray-400 block mb-1.5 font-medium">Quick Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LOCATIONS.slice(0, 5).map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => {
                    if (pinMode === 'pickup') setPickup(loc.coords);
                    else setDropoff(loc.coords);
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                >
                  {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup & Dropoff selection */}
          <div className="space-y-2 mb-4">
            <button
              onClick={() => setPinMode('pickup')}
              className={`w-full text-left p-3 rounded-lg border text-xs transition flex items-center justify-between ${
                pinMode === 'pickup'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  P
                </span>
                <div>
                  <span className="font-semibold block text-gray-200">Pickup Point</span>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {pickup.latitude.toFixed(4)}, {pickup.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
              {pinMode === 'pickup' && (
                <span className="text-[10px] text-emerald-400 font-medium">Click map to set</span>
              )}
            </button>

            <button
              onClick={() => setPinMode('dropoff')}
              className={`w-full text-left p-3 rounded-lg border text-xs transition flex items-center justify-between ${
                pinMode === 'dropoff'
                  ? 'border-rose-500 bg-rose-500/10 text-rose-300'
                  : 'border-gray-800 bg-gray-950 text-gray-300 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className="h-6 w-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  D
                </span>
                <div>
                  <span className="font-semibold block text-gray-200">Dropoff Destination</span>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {dropoff.latitude.toFixed(4)}, {dropoff.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
              {pinMode === 'dropoff' && (
                <span className="text-[10px] text-rose-400 font-medium">Click map to set</span>
              )}
            </button>
          </div>

          {/* Trip Details & Pricing */}
          <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-lg space-y-2 mb-4 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Distance & ETA:</span>
              <span className="font-medium text-white">
                {isCalculatingRoute ? 'Calculating...' : `${effectiveDistance} km • ~${formatDuration(estimatedMinutes)}`}
              </span>
            </div>

            {routeWaypoints.length > 0 && (
              <div className="text-[11px] text-gray-400 pt-1.5 border-t border-gray-800">
                <span className="text-gray-500">Route: </span>
                {routeWaypoints.map((w) => w.name).join(' ➔ ')}
              </div>
            )}

            {surgeMultiplier > 1 && (
              <div className="flex justify-between items-center text-amber-400 pt-1.5 border-t border-gray-800">
                <span>AI Surge:</span>
                <span className="font-semibold">{surgeMultiplier}x ({aiSurge?.aiInsights?.demandTrend || 'High'} Demand)</span>
              </div>
            )}

            {aiSurge?.aiInsights?.reasoning && (
              <p className="text-[11px] text-gray-400 italic pt-1">
                {aiSurge.aiInsights.reasoning}
              </p>
            )}

            <div className="flex justify-between items-center pt-2.5 border-t border-gray-800">
              <span className="text-xs font-semibold text-gray-300">Total Estimated Fare:</span>
              <span className="text-xl font-bold text-white">₹{estimatedFare}</span>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Booking Button */}
          {!activeRide || activeRide.status === 'COMPLETED' || activeRide.status === 'CANCELLED' ? (
            <button
              onClick={handleRequestRide}
              disabled={bookingLoading}
              className="w-full py-2.5 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition text-sm flex items-center justify-center space-x-2"
            >
              <Car className="h-4 w-4" />
              <span>{bookingLoading ? 'Finding Driver...' : 'Request Ride'}</span>
            </button>
          ) : null}
        </div>

        {/* Active Trip Status Card */}
        {activeRide && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-800">
              <span className="text-xs font-semibold text-gray-400 uppercase">Live Trip Status</span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  activeRide.status === 'MATCHED'
                    ? 'bg-amber-500/20 text-amber-300'
                    : activeRide.status === 'IN_TRANSIT'
                    ? 'bg-blue-500/20 text-blue-300'
                    : activeRide.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {activeRide.status}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Driver:</span>
                <span className="font-semibold text-white">
                  {activeRide.driver_name
                    ? `${activeRide.driver_name} (${activeRide.driver_email})`
                    : activeRide.driver_id
                    ? `Driver #${activeRide.driver_id.slice(0, 8)}`
                    : 'Searching for driver...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fare:</span>
                <span className="font-bold text-emerald-400">₹{activeRide.fare}</span>
              </div>
            </div>

            {/* Cancel Action */}
            {activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELLED' && (
              <button
                onClick={handleCancelRide}
                className="w-full mt-3 py-2 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
              >
                Cancel Ride
              </button>
            )}

            {activeRide.status === 'COMPLETED' && (
              <button
                onClick={() => setActiveRide(null)}
                className="w-full mt-3 py-2 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition"
              >
                Trip Completed! Book New Ride
              </button>
            )}
          </div>
        )}
      </div>

      {/* Interactive Map (Right column) */}
      <div className="lg:col-span-7 flex flex-col h-[520px] lg:h-[720px]">
        <MapView
          pickup={pickup}
          dropoff={dropoff}
          driverLocation={driverTelemetry}
          nearbyDrivers={nearbyDrivers}
          routeCoordinates={routeCoordinates}
          waypoints={routeWaypoints}
          onMapClick={handleMapClick}
        />
      </div>
    </div>
  );
};
