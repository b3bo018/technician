import React, { useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X } from 'lucide-react';

interface PwaInstallPromptProps {
  canInstallPrompt: boolean;
  onInstall: () => void;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  canInstallPrompt,
  onInstall
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone)
  );

  if (isStandalone || isDismissed) return null;

  return (
    <div
      id="pwa-install-banner"
      className="w-full rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 border border-blue-500/30 p-3.5 shadow-md flex items-center justify-between gap-3 text-xs"
    >
      <div className="flex items-center space-x-2.5">
        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0">
          <Smartphone className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold text-white">Install Mobile App</p>
          <p className="text-[11px] text-slate-300">
            {isIos ? (
              <span className="flex items-center">
                Tap <Share className="w-3 h-3 mx-1 text-blue-400" /> then "Add to Home Screen" <PlusSquare className="w-3 h-3 ml-1 text-blue-400" />
              </span>
            ) : (
              'Fast camera scanning & offline support on your home screen'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        {canInstallPrompt && !isIos && (
          <button
            type="button"
            onClick={onInstall}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center space-x-1 shadow"
          >
            <Download className="w-3 h-3" />
            <span>Install</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-slate-400 hover:text-white"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
