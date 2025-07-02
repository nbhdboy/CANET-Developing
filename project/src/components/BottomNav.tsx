import React from 'react';
import { Store, User } from 'lucide-react';
import { useStore } from '../store';
import { translations } from '../i18n';

interface BottomNavProps {
  activeTab: 'store' | 'esims' | 'profile';
  onTabChange: (tab: 'store' | 'esims' | 'profile') => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { language } = useStore();
  const t = translations[language];

  const SimIcon = () => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={`w-6 h-6 transition-colors ${activeTab === 'esims' ? 'text-line' : 'text-gray-600'}`}
    >
      <path 
        d="M8 6H16C17.1046 6 18 6.89543 18 8V16C18 17.1046 17.1046 18 16 18H8C6.89543 18 6 17.1046 6 16V8C6 6.89543 6.89543 6 8 6Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={activeTab === 'esims' ? 'animate-pulse' : ''}
      />
      <path 
        d="M10 11C10.5523 11 11 10.5523 11 10C11 9.44772 10.5523 9 10 9C9.44772 9 9 9.44772 9 10C9 10.5523 9.44772 11 10 11Z" 
        fill="currentColor"
        className={activeTab === 'esims' ? 'animate-bounce' : ''}
      />
      <path 
        d="M14 15C14.5523 15 15 14.5523 15 14C15 13.4477 14.5523 13 14 13C13.4477 13 13 13.4477 13 14C13 14.5523 13.4477 15 14 15Z" 
        fill="currentColor"
        className={activeTab === 'esims' ? 'animate-bounce delay-100' : ''}
      />
    </svg>
  );

  const StoreIcon = () => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={`w-6 h-6 transition-colors ${activeTab === 'store' ? 'text-line' : 'text-gray-600'}`}
    >
      <path 
        d="M4 4h2l2 11h12l2-7H8" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={`transform origin-right transition-transform ${activeTab === 'store' ? 'animate-[swing_1s_ease-in-out_infinite]' : ''}`}
      />
      <path 
        d="M10 20a1 1 0 100-2 1 1 0 000 2z" 
        fill="currentColor"
        className={activeTab === 'store' ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}
      />
      <path 
        d="M18 20a1 1 0 100-2 1 1 0 000 2z" 
        fill="currentColor"
        className={activeTab === 'store' ? 'animate-[wiggle_1s_ease-in-out_infinite] delay-100' : ''}
      />
      <style>
        {`
          @keyframes swing {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-5deg); }
            75% { transform: rotate(5deg); }
          }
          @keyframes wiggle {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-1px); }
            75% { transform: translateX(1px); }
          }
        `}
      </style>
    </svg>
  );

  const ProfileIcon = () => (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      className={`w-6 h-6 transition-colors ${activeTab === 'profile' ? 'text-line' : 'text-gray-600'}`}
    >
      <path 
        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={activeTab === 'profile' ? 'animate-pulse' : ''}
      />
      <path 
        d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className={activeTab === 'profile' ? 'animate-bounce' : ''}
      />
    </svg>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe">
      <div className="flex justify-around items-center h-16">
        <button
          onClick={() => onTabChange('esims')}
          className={`flex flex-col items-center justify-center w-full h-full ${
            activeTab === 'esims' ? 'text-line' : 'text-gray-600'
          }`}
        >
          <SimIcon />
          <span className="text-xs mt-1">{t.myEsims}</span>
        </button>
        <button
          onClick={() => onTabChange('store')}
          className={`flex flex-col items-center justify-center w-full h-full ${
            activeTab === 'store' ? 'text-line' : 'text-gray-600'
          }`}
        >
          <StoreIcon />
          <span className="text-xs mt-1">{t.esimStore}</span>
        </button>
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center w-full h-full ${
            activeTab === 'profile' ? 'text-line' : 'text-gray-600'
          }`}
        >
          <ProfileIcon />
          <span className="text-xs mt-1">{t.profile.title}</span>
        </button>
      </div>
    </nav>
  );
}