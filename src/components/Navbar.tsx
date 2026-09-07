import React from 'react';
import { 
  LogOut, 
  Wifi, 
  WifiOff, 
  Download, 
  ShieldCheck, 
  RefreshCw,
  Zap
} from 'lucide-react';
import { SecureTrackLogo } from './SecureTrackLogo';

interface NavbarProps {
  techEmail: string;
  role: 'admin' | 'technician';
  isOnline: boolean;
  onLogout: () => void;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
  pendingOfflineCount: number;
  isSyncingOffline: boolean;
  onTriggerSync: () => void;
  isAdminViewOpen: boolean;
  onToggleAdminView: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  techEmail,
  role,
  isOnline,
  onLogout,
  canInstallPwa,
  onInstallPwa,
  pendingOfflineCount,
  isSyncingOffline,
  onTriggerSync,
  isAdminViewOpen,
  onToggleAdminView
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3.5 sm:px-4 py-2.5">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <SecureTrackLogo size="sm" showTagline={false} />
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* Offline Pending Queue Badge */}
          {pendingOfflineCount > 0 && (
            <button
              type="button"
              onClick={onTriggerSync}
              disabled={!isOnline || isSyncingOffline}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                isSyncingOffline
                  ? 'bg-blue-950 text-blue-300 border-blue-800 animate-pulse'
                  : isOnline
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600 hover:bg-amber-900 cursor-pointer'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
              title={isOnline ? 'Click to sync queued installations now' : 'Installations saved locally. Will sync when back online.'}
            >
              {isSyncingOffline ? (
                <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
              ) : (
                <Zap className="w-3 h-3 text-amber-400" />
              )}
              <span>{pendingOfflineCount} queued</span>
            </button>
          )}

          {/* Online/Offline Badge */}
          <div
            id="network-status-indicator"
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-medium border ${
              isOnline
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50'
                : 'bg-amber-950/50 text-amber-400 border-amber-700/60'
            }`}
            title={isOnline ? 'Online - Realtime sync active' : 'Offline - Queued locally via localForage'}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden xs:inline font-mono">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span className="font-mono">OFFLINE</span>
              </>
            )}
          </div>

          {/* Admin Dashboard Switcher */}
          {role === 'admin' && (
            <button
              id="toggle-admin-portal-button"
              type="button"
              onClick={onToggleAdminView}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                isAdminViewOpen
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/30'
                  : 'bg-slate-900 text-emerald-400 border-emerald-500/40 hover:bg-slate-800'
              }`}
              title="Toggle Fleet Admin Command Portal"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isAdminViewOpen ? 'Field' : 'Admin'}</span>
            </button>
          )}

          {/* PWA Install Button if available */}
          {canInstallPwa && (
            <button
              id="install-pwa-button"
              type="button"
              onClick={onInstallPwa}
              className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
              title="Install SECURETROCK PWA"
            >
              <Download className="w-4 h-4" />
            </button>
          )}

          {/* Sign Out Button */}
          <button
            id="logout-button"
            type="button"
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
