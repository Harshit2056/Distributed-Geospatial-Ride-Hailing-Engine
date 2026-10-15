import React, { useState, useEffect, useRef } from 'react';
import type { LocationCoordinate, AssignedRidePayload, RideRecord } from '../types';
import { driverApi, rideApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { MapView } from './MapView';
import {
  Power,
  Navigation,
  Car,
  BellRing,
  Play,
  CheckCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinate>({
    latitude: 28.6335,
    longitude: 77.2185,
  });
  const [incomingRide, setIncomingRide] = useState<AssignedRidePayload | null>(null);
  const [activeTrip, setActiveTrip] = useState<RideRecord | null>(null);
  const [isSimulatingMove, setIsSimulatingMove] = useState<boolean>(false);
  const [lastH3Cell, setLastH3Cell] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const simulationIntervalRef = useRef<any>(null);

  // Push driver location to backend
  const pushLocation = async (lat: number, lon: number) => {
    try {
      const res = await driverApi.updateLocation(lat, lon);
      setLastH3Cell(res.data?.h3Index || null);
    } catch (e: any) {
      console.warn('Driver location push error:', e.message);
    }
  };

  // Broadcast live location whenever driver turns online or moves
  useEffect(() => {
    if (isOnline) {
      pushLocation(currentLocation.latitude, currentLocation.longitude);
    }
  }, [isOnline]);

  // Fetch any active assigned trip when driver loads or logs in
  useEffect(() => {
    const fetchActiveTrip = async () => {
      try {
        const res = await rideApi.getActiveRide();
        if (res.data) {
          setActiveTrip(res.data);
          const socket = getSocket();
          if (socket) {
            socket.emit('join_ride', res.data.id);
          }
        }
      } catch (e) {
        console.warn('Could not fetch active trip for driver:', e);
      }
    };
    fetchActiveTrip();
  }, [user?.id]);

  // Socket.io listeners for driver
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    // Listen to new assigned ride from backend
    const handleNewRide = (payload: AssignedRidePayload) => {
      console.log('🚨 NEW RIDE ASSIGNED TO THIS DRIVER:', payload);
      setIncomingRide(payload);
    };

    // Listen to ride status updates
    const handleStatusUpdate = (data: { rideId: string; status: RideRecord['status'] }) => {
      if (activeTrip && activeTrip.id === data.rideId) {
        setActiveTrip((prev) => (prev ? { ...prev, status: data.status } : null));
      }
    };

    socket.on('new_ride_assigned', handleNewRide);
    socket.on('ride_status_updated', handleStatusUpdate);

    return () => {
      socket.off('new_ride_assigned', handleNewRide);
      socket.off('ride_status_updated', handleStatusUpdate);
    };
  }, [user?.id, activeTrip?.id]);

  // Accept incoming ride
  const handleAcceptRide = () => {
    if (!incomingRide) return;
    const initialRecord: RideRecord = {
      id: incomingRide.rideId,
      rider_id: incomingRide.riderId || 'rider_1',
      driver_id: user?.id || null,
      pickup_lat: incomingRide.pickup.latitude,
      pickup_lon: incomingRide.pickup.longitude,
      dropoff_lat: incomingRide.dropoff.latitude,
      dropoff_lon: incomingRide.dropoff.longitude,
      fare: incomingRide.fare,
      status: 'MATCHED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setActiveTrip(initialRecord);
    setIncomingRide(null);

    // Join ride room
    const socket = getSocket();
    if (socket) {
      socket.emit('join_ride', incomingRide.rideId);
    }
  };

  // State Transition Actions (FSM)
  const handleTransitionStatus = async (nextStatus: RideRecord['status']) => {
    if (!activeTrip) return;
    setErrorMsg(null);
    try {
      const res = await rideApi.updateStatus(activeTrip.id, nextStatus);
      setActiveTrip(res.data);

      if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED') {
        clearInterval(simulationIntervalRef.current);
        setIsSimulatingMove(false);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || err.message || 'Status transition failed');
    }
  };

  // Simulate Drive towards target coordinates and emit socket telemetry
  const startDriveSimulation = () => {
    if (!activeTrip) return;
    setIsSimulatingMove(true);

    const target = activeTrip.status === 'MATCHED'
      ? { latitude: activeTrip.pickup_lat, longitude: activeTrip.pickup_lon }
      : { latitude: activeTrip.dropoff_lat, longitude: activeTrip.dropoff_lon };

    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

    simulationIntervalRef.current = setInterval(() => {
      setCurrentLocation((prev) => {
        const step = 0.0008;
        const dLat = target.latitude - prev.latitude;
        const dLon = target.longitude - prev.longitude;
        const dist = Math.hypot(dLat, dLon);

        if (dist < 0.001) {
          clearInterval(simulationIntervalRef.current);
          setIsSimulatingMove(false);
          return target;
        }

        const newLat = prev.latitude + (dLat / dist) * step;
        const newLon = prev.longitude + (dLon / dist) * step;

        // Push to backend H3 & socket
        pushLocation(newLat, newLon);
        const socket = getSocket();
        if (socket && activeTrip) {
          socket.emit('driver_location_update', {
            rideId: activeTrip.id,
            latitude: newLat,
            longitude: newLon,
          });
        }

        return { latitude: newLat, longitude: newLon };
      });
    }, 1200);
  };

  const stopDriveSimulation = () => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    setIsSimulatingMove(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Driver Controls (Left column) */}
      <div className="lg:col-span-5 flex flex-col space-y-5">
        {/* Duty Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Driver Console</h2>
                <p className="text-xs text-gray-400">
                  H3 Cell Index:{' '}
                  <span className="font-mono text-amber-400 font-semibold">
                    {lastH3Cell || 'Registering...'}
                  </span>
                </p>
              </div>
            </div>

            {/* Online Toggle Switch */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-2xl font-bold text-xs transition border active:scale-95 ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
              }`}
            >
              <Power className="h-4 w-4" />
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </button>
          </div>

          {/* Quick Telemetry status */}
          <div className="mt-4 p-3.5 rounded-2xl bg-gray-950 border border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">Current GPS Telemetry:</span>
            <span className="font-mono text-gray-200">
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Incoming Ride Alert Modal / Card */}
        {incomingRide && (
          <div className="bg-amber-950/30 border-2 border-amber-500 rounded-3xl p-5 shadow-2xl animate-bounce-slow">
            <div className="flex items-center space-x-2 text-amber-400 font-extrabold text-sm mb-3">
              <BellRing className="h-5 w-5 animate-pulse" />
              <span>NEW RIDE ASSIGNMENT ALERT!</span>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated Fare:</span>
                <span className="text-lg font-black text-emerald-400">₹{incomingRide.fare}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pickup Coords:</span>
                <span className="font-mono">
                  {incomingRide.pickup.latitude.toFixed(3)}, {incomingRide.pickup.longitude.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dropoff Coords:</span>
                <span className="font-mono">
                  {incomingRide.dropoff.latitude.toFixed(3)}, {incomingRide.dropoff.longitude.toFixed(3)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleAcceptRide}
                className="py-2.5 rounded-xl font-bold text-xs text-gray-950 bg-amber-400 hover:bg-amber-300 transition text-center shadow-lg shadow-amber-400/20"
              >
                Accept Trip
              </button>
              <button
                onClick={() => setIncomingRide(null)}
                className="py-2.5 rounded-xl font-semibold text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 transition text-center"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Active Trip FSM Control Panel */}
        {activeTrip ? (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Current Active Trip
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {activeTrip.status}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-gray-950 border border-gray-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Trip Fare:</span>
                <span className="text-emerald-400 font-extrabold text-sm">₹{activeTrip.fare}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Rider ID:</span>
                <span className="font-mono text-gray-300">{activeTrip.rider_id.slice(0, 12)}...</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Telemetry Simulator Buttons */}
            {activeTrip.status !== 'COMPLETED' && (
              <div className="pt-2">
                <button
                  onClick={isSimulatingMove ? stopDriveSimulation : startDriveSimulation}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs transition border flex items-center justify-center space-x-2 ${
                    isSimulatingMove
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  <Navigation className="h-4 w-4" />
                  <span>
                    {isSimulatingMove
                      ? 'Simulating GPS Stream (Pause)'
                      : activeTrip.status === 'MATCHED'
                      ? 'Simulate Drive to Pickup'
                      : 'Simulate Drive to Destination'}
                  </span>
                </button>
              </div>
            )}

            {/* FSM Progression Buttons */}
            {activeTrip.status === 'MATCHED' && (
              <button
                onClick={() => handleTransitionStatus('IN_TRANSIT')}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 active:scale-98 shadow-lg shadow-blue-600/30 transition flex items-center justify-center space-x-2"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Start Trip (Pickup Completed)</span>
              </button>
            )}

            {activeTrip.status === 'IN_TRANSIT' && (
              <button
                onClick={() => handleTransitionStatus('COMPLETED')}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Complete Trip & Collect Fare</span>
              </button>
            )}

            {activeTrip.status === 'COMPLETED' && (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                <p className="text-emerald-400 font-bold text-sm">🎉 Trip Completed Successfully!</p>
                <p className="text-xs text-gray-400 mt-1">₹{activeTrip.fare} credited to Driver wallet</p>
                <button
                  onClick={() => setActiveTrip(null)}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gray-800 hover:bg-gray-700 transition"
                >
                  Ready for Next Ride
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center text-gray-500 shadow-xl">
            <Zap className="h-8 w-8 text-amber-500/50 mx-auto mb-2 animate-pulse" />
            <p className="font-semibold text-gray-300 text-sm">Waiting for Ride Assignments...</p>
            <p className="text-xs text-gray-500 mt-1">
              Keep duty ONLINE. Rides in your H3 hexagon cell will be dispatched to you automatically via Redis & Socket.io.
            </p>
          </div>
        )}
      </div>

      {/* Interactive Map (Right column) */}
      <div className="lg:col-span-7 flex flex-col h-[520px] lg:h-[720px]">
        <MapView
          pickup={activeTrip ? { latitude: activeTrip.pickup_lat, longitude: activeTrip.pickup_lon } : null}
          dropoff={activeTrip ? { latitude: activeTrip.dropoff_lat, longitude: activeTrip.dropoff_lon } : null}
          driverLocation={currentLocation}
          onMapClick={(coords) => {
            setCurrentLocation(coords);
            if (isOnline) pushLocation(coords.latitude, coords.longitude);
          }}
        />
      </div>
    </div>
  );
};
