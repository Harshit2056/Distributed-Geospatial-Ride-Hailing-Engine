import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { RiderDashboard } from './components/RiderDashboard';
import { DriverDashboard } from './components/DriverDashboard';
import { getSocket } from './services/socket';
import { Compass, Car, Sparkles, Activity, Layers, ShieldCheck } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [activeRoleView, setActiveRoleView] = useState<'RIDER' | 'DRIVER'>('RIDER');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Sync role view when user logs in
  useEffect(() => {
    if (user?.role) {
      setActiveRoleView(user.role);
    }
  }, [user?.role]);

  // Track socket connection status
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    if (socket.connected) setSocketConnected(true);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-gray-400">Loading CabPulse Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      <Navbar
        socketConnected={socketConnected}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Role View Switcher & Engine Architecture Header Bar */}
      <div className="bg-gray-900/60 border-b border-gray-800/80 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Architecture badges */}
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <span className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-800/70 border border-gray-700/60">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <span>Uber H3 Spatial Hexagons</span>
            </span>
            <span className="hidden md:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-800/70 border border-gray-700/60">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>Redis Pub/Sub & Mutex Locks</span>
            </span>
            <span className="hidden lg:flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-800/70 border border-gray-700/60">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>FSM State Machine</span>
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center space-x-1 bg-gray-950 p-1 rounded-2xl border border-gray-800">
            <button
              onClick={() => setActiveRoleView('RIDER')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeRoleView === 'RIDER'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Rider View</span>
            </button>
            <button
              onClick={() => setActiveRoleView('DRIVER')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeRoleView === 'DRIVER'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              <span>Driver View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1">
        {!user ? (
          <div className="max-w-4xl mx-auto my-8 p-6 sm:p-8 bg-gray-900 border border-gray-800 rounded-3xl text-center shadow-2xl">
            <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-4">
              <Sparkles className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Distributed Ride-Hailing & Real-Time Dispatch System
            </h1>
            <p className="text-gray-400 text-sm max-w-xl mx-auto mt-2 mb-6">
              Powered by Node.js, TypeScript, PostgreSQL, Redis Geospatial (Uber H3), Worker-Thread Dijkstra Routing, and Socket.IO.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-6 py-3 rounded-2xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/30 transition active:scale-95"
              >
                Sign In / Open Demo Console
              </button>
            </div>
          </div>
        ) : activeRoleView === 'RIDER' ? (
          <RiderDashboard />
        ) : (
          <DriverDashboard />
        )}
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
