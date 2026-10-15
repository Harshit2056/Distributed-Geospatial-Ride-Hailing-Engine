import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { RiderDashboard } from './components/RiderDashboard';
import { DriverDashboard } from './components/DriverDashboard';
import { getSocket } from './services/socket';
import { Car } from 'lucide-react';

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

      {/* Simple Role Mode Switcher Bar */}
      {user && (
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Current View:</span>
            <div className="flex space-x-1 bg-gray-950 p-1 rounded-lg border border-gray-800">
              <button
                onClick={() => setActiveRoleView('RIDER')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  activeRoleView === 'RIDER'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Rider
              </button>
              <button
                onClick={() => setActiveRoleView('DRIVER')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  activeRoleView === 'DRIVER'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Driver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {!user ? (
          <div className="max-w-md mx-auto my-16 p-8 bg-gray-900 border border-gray-800 rounded-2xl text-center">
            <div className="h-12 w-12 mx-auto rounded-xl bg-blue-600 flex items-center justify-center text-white mb-4">
              <Car className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to CabPulse</h1>
            <p className="text-gray-400 text-sm mb-6">
              Sign in to book a ride or switch to driver mode.
            </p>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="w-full py-2.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 transition"
            >
              Sign In / Register
            </button>
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
