import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Car, User as UserIcon, LogOut } from 'lucide-react';

interface NavbarProps {
  socketConnected: boolean;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ socketConnected, onOpenAuth }) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Car className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg text-white">
            Cab<span className="text-blue-500">Pulse</span>
          </span>
        </div>

        {/* Status Indicators & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Socket Indicator */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-950 border border-gray-800">
            <span className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-gray-400 text-[11px]">{socketConnected ? 'Connected' : 'Offline'}</span>
          </div>

          {/* User Profile or Login CTA */}
          {user ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-300 font-medium hidden sm:inline">{user.name}</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                {user.role}
              </span>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 rounded-md text-gray-400 hover:text-rose-400 hover:bg-gray-800 transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition flex items-center space-x-1.5"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
