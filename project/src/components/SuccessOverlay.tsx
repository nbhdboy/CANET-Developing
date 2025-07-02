import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { translations } from '../i18n';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function SuccessOverlay() {
  const { language } = useStore();
  const t = translations[language];
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
      {/* Confetti animation */}
      {showConfetti && (
        <DotLottieReact
          src="https://lottie.host/df7aabcd-03c7-4500-bd2c-9e161c4d170a/mAl3tXkfk6.lottie"
          loop
          autoplay
          style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 100 }}
            />
      )}

      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6 max-w-sm mx-4 w-full animate-success-pop">
        <div className="relative">
          <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden">
            <img
              src="/icons/celebrate icon.png"
              alt="celebrate icon"
              className="w-20 h-20 object-contain animate-success-check"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))' }}
            />
          </div>
        </div>
        
        <div className="text-center">
          <h3 className="text-2xl font-bold bg-line-gradient bg-clip-text text-transparent mb-2 flex items-center justify-center">
            {t.purchaseSuccess.replace('🎉','')}
          </h3>
          <div className="text-xl font-bold bg-line-gradient bg-clip-text text-transparent mb-2">
            {t.haveANiceTrip}
          </div>
          <p className="text-gray-600">{t.redirectingToEsims}</p>
        </div>

        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-line-gradient animate-progress rounded-full" />
        </div>
      </div>
    </div>
  );
}