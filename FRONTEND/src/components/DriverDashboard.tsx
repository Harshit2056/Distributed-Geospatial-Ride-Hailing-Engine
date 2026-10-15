import React, { useState, useEffect, useRef } from 'react';
import type { LocationCoordinate, AssignedRidePayload, RideRecord } from '../types';
import { driverApi, rideApi } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { MapView } from './MapView';
import { Power, Navigation, Play, CheckCircle } from 'lucide-react';

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Driver Controls (Left column) */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        {/* Duty Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800">
            <div>
              <h2 className="text-base font-semibold text-white">Driver Console</h2>
              <p className="text-xs text-gray-400">
                H3 Cell: <span className="font-mono text-gray-300">{lastH3Cell || 'Locating...'}</span>
              </p>
            </div>

            {/* Online Toggle Switch */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition border ${
                isOnline
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </button>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Current GPS:</span>
            <span className="font-mono text-gray-300">
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Incoming Ride Alert Modal / Card */}
        {incomingRide && (
          <div className="bg-gray-900 border-2 border-blue-500 rounded-xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                New Ride Request
              </span>
              <span className="text-lg font-bold text-white">₹{incomingRide.fare}</span>
            </div>

            <div className="space-y-1 text-xs text-gray-300 mb-3">
              <div>
                <span className="text-gray-400">Pickup: </span>
                <span className="font-mono">{incomingRide.pickup.latitude.toFixed(3)}, {incomingRide.pickup.longitude.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-gray-400">Dropoff: </span>
                <span className="font-mono">{incomingRide.dropoff.latitude.toFixed(3)}, {incomingRide.dropoff.longitude.toFixed(3)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAcceptRide}
                className="py-2 rounded-lg font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 transition text-center"
              >
                Accept
              </button>
              <button
                onClick={() => setIncomingRide(null)}
                className="py-2 rounded-lg font-semibold text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 transition text-center"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Active Trip Control Panel */}
        {activeTrip ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="text-xs font-semibold text-gray-400 uppercase">Active Trip</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                {activeTrip.status}
              </span>
            </div>

            <div className="flex justify-between text-xs text-gray-300">
              <span className="text-gray-400">Trip Fare:</span>
              <span className="text-base font-bold text-emerald-400">₹{activeTrip.fare}</span>
            </div>

            {errorMsg && (
              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Telemetry Simulator Buttons */}
            {activeTrip.status !== 'COMPLETED' && (
              <button
                onClick={isSimulatingMove ? stopDriveSimulation : startDriveSimulation}
                className="w-full py-2 rounded-lg font-medium text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition flex items-center justify-center space-x-1.5"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>
                  {isSimulatingMove
                    ? 'Pause GPS Simulation'
                    : activeTrip.status === 'MATCHED'
                    ? 'Simulate Drive to Pickup'
                    : 'Simulate Drive to Dropoff'}
                </span>
              </button>
            )}

            {/* FSM Progression Buttons */}
            {activeTrip.status === 'MATCHED' && (
              <button
                onClick={() => handleTransitionStatus('IN_TRANSIT')}
                className="w-full py-2.5 rounded-lg font-semibold text-xs text-white bg-blue-600 hover:bg-blue-500 transition flex items-center justify-center space-x-1.5"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Start Trip (Pickup Done)</span>
              </button>
            )}

            {activeTrip.status === 'IN_TRANSIT' && (
              <button
                onClick={() => handleTransitionStatus('COMPLETED')}
                className="w-full py-2.5 rounded-lg font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 transition flex items-center justify-center space-x-1.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Complete Trip</span>
              </button>
            )}

            {activeTrip.status === 'COMPLETED' && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-emerald-400 font-semibold text-xs">Trip Completed!</p>
                <button
                  onClick={() => setActiveTrip(null)}
                  className="mt-2 text-xs text-gray-400 hover:text-white underline"
                >
                  Clear and wait for next ride
                </button>
              </div>
            )}
          </div>
        ) : (
          !incomingRide && (
            <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl text-center">
              <p className="text-gray-400 text-xs">Waiting for new ride requests...</p>
            </div>
          )
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
