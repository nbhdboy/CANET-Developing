import React from 'react';
import { useStore } from '../store';
import { translations } from '../i18n';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function LoadingOverlay() {
  const { language } = useStore();
  const t = translations[language];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4 w-full">
        <DotLottieReact
          src="https://lottie.host/392c4e43-1540-4c7e-8d2f-a01e3eec27ba/2TDIsdLa6w.lottie"
          loop
          autoplay
          speed={3.5}
          style={{ width: 96, height: 96 }}
        />
        <div className="text-center">
          <p className="text-xl font-semibold bg-line-gradient bg-clip-text text-transparent animate-pulse">
            {t.processing}
          </p>
          <p className="text-gray-500 mt-2">{t.pleaseWait}</p>
        </div>
      </div>
    </div>
  );
}

export function DeletingOverlay() {
  const { language } = useStore();
  const t = translations[language];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4 w-full">
        <DotLottieReact
          src="https://lottie.host/392c4e43-1540-4c7e-8d2f-a01e3eec27ba/2TDIsdLa6w.lottie"
          loop
          autoplay
          speed={3.5}
          style={{ width: 96, height: 96 }}
        />
        <div className="text-center">
          <p className="text-xl font-semibold bg-line-gradient bg-clip-text text-transparent animate-pulse">
            {t.deleting}
          </p>
          <p className="text-gray-500 mt-2">{t.deletingCardWait}</p>
        </div>
      </div>
    </div>
  );
}