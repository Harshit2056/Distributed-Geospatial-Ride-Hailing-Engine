import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Car, User as UserIcon, LogOut, Radio } from 'lucide-react';

interface NavbarProps {
  socketConnected: boolean;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ socketConnected, onOpenAuth }) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Car className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xl tracking-tight text-white bg-clip-text">
                Cab<span className="text-blue-500">Pulse</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Engine v1.0
              </span>
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">
              Distributed Real-Time Mobility & Ride-Hailing Platform
            </p>
          </div>
        </div>

        {/* Status Indicators & User Profile */}
        <div className="flex items-center space-x-4">
          {/* Socket.io Indicator */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border border-gray-800 bg-gray-950/60">
            <Radio className={`h-3.5 w-3.5 ${socketConnected ? 'text-emerald-400 animate-pulse' : 'text-rose-500'}`} />
            <span className={socketConnected ? 'text-emerald-400' : 'text-gray-400'}>
              {socketConnected ? 'Realtime Connected' : 'Offline'}
            </span>
          </div>

          {/* User Profile or Login CTA */}
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-gray-200">{user.name}</span>
                <div className="flex items-center justify-end space-x-1">
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                      user.role === 'DRIVER'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {user.role}
                  </span>
                  <span className="text-[11px] text-gray-500">{user.email}</span>
                </div>
              </div>

              <button
                onClick={logout}
                title="Logout"
                className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2"
            >
              <UserIcon className="h-4 w-4" />
              <span>Login / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
