import React from 'react';

interface SecureTrackLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const SecureTrackLogo: React.FC<SecureTrackLogoProps> = ({
  className = '',
  size = 'md',
  showTagline = true
}) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Arabic header subtle line */}
      <div className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-0.5 px-1">
        <span className="tracking-widest uppercase text-[10px] text-emerald-500/90 font-mono">EST. TRACKING</span>
        <span className="text-xs text-slate-400 tracking-wider font-medium font-arabic" dir="rtl">
          ســــيكور تـــــراك
        </span>
      </div>

      {/* Main Logo Row */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* SECURE in bright emerald green */}
        <span
          className={`font-black tracking-tight text-emerald-500 ${
            isSm ? 'text-lg' : isLg ? 'text-2xl sm:text-3xl' : 'text-xl'
          }`}
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          SECURE
        </span>

        {/* T in crisp white */}
        <span
          className={`font-black tracking-tight text-white ${
            isSm ? 'text-lg' : isLg ? 'text-2xl sm:text-3xl' : 'text-xl'
          }`}
        >
          T
        </span>

        {/* Red Map Pin replacing R */}
        <div className="relative inline-flex items-center justify-center -mx-0.5">
          <svg
            viewBox="0 0 24 30"
            className={`${isSm ? 'w-4 h-5' : isLg ? 'w-6 h-7' : 'w-5 h-6'}`}
            fill="none"
          >
            <path
              d="M12 0C5.37 0 0 5.37 0 12C0 21 12 30 12 30C12 30 24 21 24 12C24 5.37 18.63 0 12 0Z"
              fill="#e11d48"
            />
            <circle cx="12" cy="11" r="4.5" fill="#ffffff" />
          </svg>
        </div>

        {/* ACK in crisp white */}
        <span
          className={`font-black tracking-tight text-white ${
            isSm ? 'text-lg' : isLg ? 'text-2xl sm:text-3xl' : 'text-xl'
          }`}
        >
          ACK
        </span>

        {/* Radar Chevron Wings icon */}
        <div className="relative ml-1 flex items-center justify-center">
          {/* Radar dash ring */}
          <div className="absolute w-8 h-8 rounded-full border border-dashed border-slate-600/80 pointer-events-none" />
          <div className="absolute w-6 h-6 rounded-full border border-dotted border-emerald-500/60 pointer-events-none" />

          {/* Chevrons >< */}
          <div className="flex items-center text-xs font-black z-10 px-0.5">
            <span className="text-slate-400">&gt;</span>
            <span className="text-emerald-400 font-extrabold">&lt;</span>
          </div>
        </div>
      </div>

      {/* Subtitle / Tagline */}
      {showTagline && (
        <div className="w-full text-center mt-1">
          <span className="text-[9px] sm:text-[10px] font-extrabold tracking-[0.25em] text-slate-400 uppercase">
            PRECISION · PROTECTION · POSITIONING
          </span>
        </div>
      )}
    </div>
  );
};
