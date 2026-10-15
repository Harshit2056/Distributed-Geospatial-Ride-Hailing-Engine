import React, { useState, useEffect } from 'react';
import type { LocationCoordinate, RideRecord, NearbyDriver } from '../types';
import { rideApi, driverApi, routeApi } from '../services/api';
import { getSocket } from '../services/socket';
import { MapView } from './MapView';
import {
  Navigation,
  TrendingUp,
  AlertCircle,
  Car,
  CheckCircle2,
  Compass,
  Cpu,
} from 'lucide-react';

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
  // Dynamic Surge Multiplier display
  const surgeMultiplier = effectiveDistance > 10 ? 1.4 : 1.1;
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Control Panel (Left column) */}
      <div className="lg:col-span-5 flex flex-col space-y-5">
        {/* Title */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Compass className="h-5 w-5 text-blue-400" />
              <span>Book Your Ride</span>
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              {nearbyDrivers.length} Drivers in H3 Cell
            </span>
          </div>

          {/* Quick Presets */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-400 mb-2 block">Quick Location Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => {
                    if (pinMode === 'pickup') setPickup(loc.coords);
                    else setDropoff(loc.coords);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60 transition"
                >
                  {loc.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup and Dropoff selector buttons */}
          <div className="space-y-3">
            {/* Pickup selection */}
            <div
              onClick={() => setPinMode('pickup')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                pinMode === 'pickup'
                  ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
                  : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                    P
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-300 block">Pickup Location</span>
                    <span className="text-[11px] text-gray-500">
                      {pickup.latitude.toFixed(4)}, {pickup.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
                {pinMode === 'pickup' && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Click map to pin
                  </span>
                )}
              </div>
            </div>

            {/* Dropoff selection */}
            <div
              onClick={() => setPinMode('dropoff')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition ${
                pinMode === 'dropoff'
                  ? 'bg-rose-950/30 border-rose-500/60 shadow-lg shadow-rose-950/50'
                  : 'bg-gray-950/60 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs border border-rose-500/30">
                    D
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-300 block">Dropoff Destination</span>
                    <span className="text-[11px] text-gray-500">
                      {dropoff.latitude.toFixed(4)}, {dropoff.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>
                {pinMode === 'dropoff' && (
                  <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                    Click map to pin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Pricing & AI Surge breakdown */}
          <div className="mt-5 p-4 rounded-2xl bg-gray-950 border border-gray-800/80">
            {/* Dijkstra Route Badge */}
            <div className="p-3 mb-3 rounded-xl bg-blue-950/40 border border-blue-500/30">
              <div className="flex items-center justify-between text-xs text-blue-300 mb-1.5 font-bold">
                <span className="flex items-center space-x-1.5">
                  <Cpu className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
                  <span>Dijkstra Worker-Thread Route</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                  {isCalculatingRoute ? 'Calculating...' : `${effectiveDistance} km • ~${formatDuration(estimatedMinutes)}`}
                </span>
              </div>
              {routeWaypoints.length > 0 ? (
                <div className="text-[11px] text-gray-300 flex flex-wrap items-center gap-1.5 leading-relaxed">
                  {routeWaypoints.map((wp, i) => (
                    <span key={wp.id} className="inline-flex items-center">
                      <span className="text-white font-medium bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">{wp.name}</span>
                      {i < routeWaypoints.length - 1 && <span className="text-blue-400 mx-1">➔</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">
                  Continuous shortest road graph calculated via background Node.js worker threads.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-gray-800">
              <span className="flex items-center space-x-1">
                <Navigation className="h-3.5 w-3.5 text-blue-400" />
                <span>Road Network Distance</span>
              </span>
              <span className="font-semibold text-gray-200">{effectiveDistance} km</span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400 py-2 border-b border-gray-800">
              <span className="flex items-center space-x-1">
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                <span>AI Surge Multiplier</span>
              </span>
              <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                {surgeMultiplier}x Demand
              </span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <div>
                <span className="text-xs text-gray-400 block">Total Estimated Fare</span>
                <span className="text-2xl font-extrabold text-white">₹{estimatedFare}</span>
              </div>
              <span className="text-[11px] text-gray-500 font-medium">Incl. taxes & fees</span>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Booking Button */}
          {!activeRide || activeRide.status === 'COMPLETED' || activeRide.status === 'CANCELLED' ? (
            <button
              onClick={handleRequestRide}
              disabled={bookingLoading}
              className="w-full mt-5 py-3.5 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-xl shadow-blue-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Car className="h-5 w-5" />
              <span>{bookingLoading ? 'Matching with Nearest Driver...' : 'Request Ride Now'}</span>
            </button>
          ) : null}
        </div>

        {/* Active Trip Status Card */}
        {activeRide && (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Live Trip Status
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                  activeRide.status === 'MATCHED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                    : activeRide.status === 'IN_TRANSIT'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : activeRide.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                }`}
              >
                {activeRide.status}
              </span>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-500">Ride ID:</span>
                <span className="font-mono text-gray-300">{activeRide.id.slice(0, 13)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Assigned Driver:</span>
                <span className="font-semibold text-emerald-300">
                  {activeRide.driver_name
                    ? `${activeRide.driver_name} (${activeRide.driver_email})`
                    : activeRide.driver_id
                    ? `Driver #${activeRide.driver_id.slice(0, 8)}`
                    : 'Searching...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Agreed Fare:</span>
                <span className="font-bold text-emerald-400">₹{activeRide.fare}</span>
              </div>
            </div>

            {/* State Progress Bar */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
                <span className={activeRide.status === 'REQUESTED' ? 'text-blue-400' : ''}>Requested</span>
                <span>→</span>
                <span className={activeRide.status === 'MATCHED' ? 'text-amber-400 font-bold' : ''}>Driver Matched</span>
                <span>→</span>
                <span className={activeRide.status === 'IN_TRANSIT' ? 'text-indigo-400 font-bold' : ''}>In Transit</span>
                <span>→</span>
                <span className={activeRide.status === 'COMPLETED' ? 'text-emerald-400 font-bold' : ''}>Done</span>
              </div>
            </div>

            {/* Cancel Action if trip hasn't completed */}
            {activeRide.status !== 'COMPLETED' && activeRide.status !== 'CANCELLED' && (
              <button
                onClick={handleCancelRide}
                className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
              >
                Cancel Booking
              </button>
            )}

            {activeRide.status === 'COMPLETED' && (
              <button
                onClick={() => setActiveRide(null)}
                className="w-full mt-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition flex items-center justify-center space-x-1"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Trip Completed! Book Another Ride</span>
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
