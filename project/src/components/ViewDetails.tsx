import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Signal, Calendar, ChevronLeft, ChevronRight, CreditCard, Wifi, Clock } from 'lucide-react';
import type { ESIMPackage } from '../types';
import { useStore } from '../store';
import { translations } from '../i18n';
import { BottomNav } from './BottomNav';
import { supabase } from '../lib/supabaseClient';

interface ViewDetailsProps {
  package: ESIMPackage & {
    status?: 'active' | 'inactive' | 'not_activated';
    activationDate?: string;
    expiryDate?: string;
    usedData?: string;
    totalData?: string;
    addOnPackages?: Array<{
      dataAmount: string;
      validity: string;
    }>;
    purchaseCount?: number;
    iccid?: string;
  };
  onBack: () => void;
  onPurchaseConfirm?: (pkg: ESIMPackage) => void;
  onTabChange?: (tab: 'store' | 'esims' | 'profile') => void;
  onShowInstallInstructions?: (iccid?: string) => void;
}

export function ViewDetails({ 
  package: pkg, 
  onBack, 
  onPurchaseConfirm,
  onTabChange,
  onShowInstallInstructions
}: ViewDetailsProps) {
  const { language } = useStore();
  const t = translations[language];
  const [currentTopUpIndex, setCurrentTopUpIndex] = useState(0);
  const touchStartRef = useRef(0);
  const touchEndRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [usage, setUsage] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState('');
  const [topUpPackages, setTopUpPackages] = useState<any[]>([]);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');

  const TOPUP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7天
  function getTopupCacheKey(iccid: string) {
    return `esim_topups_${iccid}`;
  }
  function setTopupCache(iccid: string, data: any) {
    localStorage.setItem(getTopupCacheKey(iccid), JSON.stringify({ data, ts: Date.now() }));
  }
  function getTopupCache(iccid: string) {
    const raw = localStorage.getItem(getTopupCacheKey(iccid));
    if (!raw) return null;
    try {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < TOPUP_CACHE_TTL) {
        return data;
      }
      localStorage.removeItem(getTopupCacheKey(iccid));
      return null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!pkg.iccid) return;
    setUsageLoading(true);
    setUsageError('');

    // 先檢查主頁卡片的全域快取
    const USAGE_CACHE_KEY = '__esim_usage_cache__';
    const cache = (window as any)[USAGE_CACHE_KEY] || {};
    const now = Date.now();
    const cacheItem = cache[pkg.iccid];
    console.log('[詳細頁] 查詢 usage，ICCID:', pkg.iccid, '全域快取內容:', cache, 'cacheItem:', cacheItem);
    if (cacheItem && now - cacheItem.ts < 15 * 60 * 1000) {
      console.log('[詳細頁] 命中主頁快取，不發API', cacheItem);
      setUsage(cacheItem.data);
      setUsageLoading(false);
      return;
    } else {
      console.log('[詳細頁] 沒命中快取，會發API');
    }
    fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-usage?iccid=${pkg.iccid}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setUsage(json.data);
          (window as any)[USAGE_CACHE_KEY] = {
            ...cache,
            [pkg.iccid]: { data: json.data, ts: now }
          };
        } else setUsageError(t.viewDetails.usageErrorNoData);
      })
      .catch(() => setUsageError(t.viewDetails.usageErrorFailed))
      .finally(() => setUsageLoading(false));
  }, [pkg.iccid, t]);

  useEffect(() => {
    if (!pkg.iccid) return;
    setTopUpLoading(true);
    setTopUpError('');
    // 先查 localStorage
    const cacheKey = getTopupCacheKey(pkg.iccid);
    const cached = getTopupCache(pkg.iccid);
    console.log('[DEBUG] localStorage:', localStorage.getItem(cacheKey));
    console.log('[DEBUG] getTopupCache:', cached);
    if (cached) {
      setTopUpPackages(cached);
      setTopUpLoading(false);
      console.log('[DEBUG] setTopUpPackages from cache:', cached);
      return;
    }
    // 沒有快取才發 API，API 回傳後直接 setTopUpPackages
    fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-topups?iccid=${pkg.iccid}`)
      .then(res => res.json())
      .then(json => {
        console.log('[DEBUG] API 回傳:', json);
        setTopUpPackages(json.data || []);
        setTopupCache(pkg.iccid, json.data || []);
        console.log('[DEBUG] setTopUpPackages from API:', json.data);
      })
      .catch(() => {
        setTopUpError(t.viewDetails.topUpErrorFailed);
        setTopUpPackages([]);
        console.log('[DEBUG] setTopUpPackages catch error, set to []');
      })
      .finally(() => setTopUpLoading(false));
  }, [pkg.iccid, t]);

  useEffect(() => {
    if (!pkg.iccid) return;
    // 觸發後端 function，讓 top up 方案寫入 DB
    fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-topups?iccid=${pkg.iccid}`)
      .then(res => res.json())
      .then(json => {
        // 可選：log 回傳內容
        console.log('top up function result', json);
      })
      .catch(() => {});
  }, [pkg.iccid]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.targetTouches[0].clientX;
    touchEndRef.current = e.targetTouches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    touchEndRef.current = e.targetTouches[0].clientX;
    const newOffset = touchEndRef.current - touchStartRef.current;
    setDragOffset(newOffset);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    const minSwipeDistance = 50;
    const swipeDistance = touchStartRef.current - touchEndRef.current;
    
    if (Math.abs(swipeDistance) >= minSwipeDistance) {
      if (swipeDistance > 0) {
        // 向左滑動
        handleNextPackage();
      } else {
        // 向右滑動
        handlePrevPackage();
      }
    }
    setDragOffset(0);
  };

  const handlePrevPackage = () => {
    setCurrentTopUpIndex((prev) => 
      prev === 0 ? topUpPackages.length - 1 : prev - 1
    );
  };

  const handleNextPackage = () => {
    setCurrentTopUpIndex((prev) => 
      prev === topUpPackages.length - 1 ? 0 : prev + 1
    );
  };

  const handleTopUp = (e: React.MouseEvent, selectedPackage: typeof topUpPackages[0]) => {
    e.stopPropagation();
    if (onPurchaseConfirm) {
      console.log('【DEBUG】加購彈窗 handleTopUp 被呼叫，selectedPackage:', selectedPackage);
      const topUpPackage = {
        ...pkg,
        package_id: selectedPackage.package_id,
        dataAmount: selectedPackage.data,
        validity: selectedPackage.day,
        price: parseFloat(selectedPackage.sell_price),
        sell_price: parseFloat(selectedPackage.sell_price),
        currency: 'TWD',
        // 更新加購專案列表
        addOnPackages: [
          ...(pkg.addOnPackages || []),
          {
            dataAmount: selectedPackage.data,
            validity: selectedPackage.day
          }
        ],
        // 更新加購次數
        purchaseCount: (pkg.purchaseCount || 0) + 1,
        isTopUp: true
      };
      console.log('【DEBUG】加購彈窗 handleTopUp 傳遞 topUpPackage:', topUpPackage);
      onPurchaseConfirm(topUpPackage);
    }
  };

  const handleTabChange = (tab: 'store' | 'esims' | 'profile') => {
    if (onTabChange) {
      onTabChange(tab);
    }
    onBack(); // 切換頁面時同時關閉詳情頁
  };

  const handleShowInstallInstructions = () => {
    if (onShowInstallInstructions) {
      onShowInstallInstructions(pkg.iccid);
    }
  };

  const renderUsageGraph = () => {
    // 狀態優先顯示
    let statusText = '';
    let percentUsed = 0;
    let used = 0;
    let total = 0;
    let isFinished = false;
    if (usage) {
      used = usage.total - usage.remaining;
      total = usage.total;
      isFinished = usage.status === 'FINISHED';
      percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;
    }
    const radius = 150;
    const centerX = 120;
    const centerY = 150;
    const strokeWidth = 20;

    // 計算圓弧路徑
    // 支援可選 startAngle
    const createArc = (percentage: number, startAngle = -180) => {
      const r = radius - strokeWidth / 2;
      const endAngle = startAngle + (180 * percentage) / 100;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + r * Math.cos(startRad);
      const y1 = centerY + r * Math.sin(startRad);
      const x2 = centerX + r * Math.cos(endRad);
      const y2 = centerY + r * Math.sin(endRad);

      const largeArcFlag = 0;

      return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
    };

    return (
      <div className="bg-white rounded-lg p-3">
        <h2 className="text-lg font-semibold mb-1">{t.usage}</h2>
        <div>
          <div className="flex items-center justify-between mb-0">
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4" />
              <span className="font-medium text-sm">{t.viewDetails.dataUsage}</span>
            </div>
            {usage && usage.status === 'ACTIVE' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#4CD964] text-white ml-2">{t.viewDetails.statusActive}</span>
            )}
            {usage && usage.status === 'NOT_ACTIVE' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-400 text-white ml-2">{t.viewDetails.statusNotActive}</span>
            )}
            {usage && usage.status === 'EXPIRED' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-400 text-white ml-2">{t.viewDetails.statusExpired}</span>
            )}
            {usage && usage.status === 'FINISHED' && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-400 text-white ml-2">{t.viewDetails.statusFinished}</span>
            )}
            {usage && !['ACTIVE','NOT_ACTIVE','EXPIRED','FINISHED'].includes(usage.status) && (
              <span className="text-xs text-gray-500">{statusText}</span>
            )}
          </div>
          <div className="relative mt-4">
            <div className="w-full h-36 mx-auto relative">
              <div className="absolute inset-0">
                <svg viewBox="0 0 240 240" className="w-full h-full">
                  <defs>
                    <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style={{ stopColor: '#4ADE80' }} />
                      <stop offset="100%" style={{ stopColor: '#86EFAC' }} />
                    </linearGradient>
                  </defs>
                  {/* 綠色底半圓，永遠畫滿 */}
                  {!isFinished && (
                    <path
                      d={createArc(100, -180)}
                      fill="none"
                      stroke="url(#greenGradient)"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                  )}
                  {/* 灰色已用量覆蓋，從左邊起，覆蓋已用百分比 */}
                  {isFinished ? (
                    <path
                      d={createArc(100, -180)}
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                  ) : (
                    percentUsed > 0 && (
                      <path
                        d={createArc(percentUsed, -180)}
                        fill="none"
                        stroke="#E5E7EB"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                      />
                    )
                  )}
                </svg>
              </div>
              <div className="absolute inset-0 flex items-center justify-center flex-col translate-y-2">
                {usageLoading ? (
                  <span className="text-gray-400">{t.viewDetails.loading}</span>
                ) : usageError ? (
                  <span className="text-red-500">{usageError}</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-700">{isFinished ? 100 : percentUsed}%</span>
                    <div className="flex items-center justify-center gap-1 mt-7">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#4CD964]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke="#4CD964" strokeWidth="2" fill="white"/><path stroke="#4CD964" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01"/></svg>
                      <span className="text-xs text-black">{t.viewDetails.usageUpdateDisclaimer}</span>
                    </div>
                    <div className="text-sm text-gray-500">{t.remainingData}</div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-0 space-y-1.5 border-t pt-2 text-xs">
            <div className="flex justify-between">
              <span className="text-black">{t.viewDetails.currentPlanData}</span>
              <span className="font-medium text-gray-500">{usage ? usage.total : 0} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">{t.viewDetails.dataUsed}</span>
              <span className="font-medium text-gray-500">{used} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">{t.viewDetails.dataRemaining}</span>
              <span className="font-medium text-gray-500">{usage ? usage.remaining : 0} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">{t.viewDetails.validityPeriod}</span>
              <span className="font-medium text-gray-500">{usage && usage.expired_at ? usage.expired_at : t.viewDetails.statusNotActive}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPackageDetails = () => (
    <div className="bg-white rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">{t.myPackages}</h2>
      <div className="relative">
        {pkg.status === 'not_activated' && (
          <div className="absolute top-0 left-0 bg-orange-400 text-white px-3 py-1 rounded-md text-sm">
            {t.notActivated}
          </div>
        )}
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#4CD964]" />
              <span className="font-medium">{t.viewDetails.addOns}</span>
            </div>
            <div className="text-right">
              {pkg.addOnPackages && pkg.addOnPackages.length > 0 ? (
                pkg.addOnPackages.map((addOn, index) => (
                  <div key={index} className="bg-green-50 rounded-lg px-4 py-2 mb-2 last:mb-0">
                    <div className="font-medium text-green-600 text-lg">{addOn.dataAmount}</div>
                    <div className="text-sm text-gray-600">{
                      addOn.validity
                        ? (language === 'en'
                            ? `Valid for ${String(addOn.validity).replace('天', '')} days`
                            : t.viewDetails.validityDuration.replace('{days}', addOn.validity)
                          )
                        : ''
                    }</div>
                  </div>
                ))
              ) : (
                <span className="text-gray-500">{t.viewDetails.noAddOns}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 排序加購方案（依據 data 由小到大）
  const sortedTopUpPackages = [...topUpPackages].sort((a, b) => {
    // 只取數字部分，忽略單位
    const getGB = (data: string) => {
      if (!data) return 0;
      const match = data.match(/([\d.]+)\s*GB/i);
      return match ? parseFloat(match[1]) : 0;
    };
    return getGB(a.data) - getGB(b.data);
  });
  console.log('[DEBUG] topUpPackages:', topUpPackages);
  console.log('[DEBUG] sortedTopUpPackages:', sortedTopUpPackages);

  const renderTopUpPackages = () => {
    // 判斷當前 eSIM 是否已封存
    const isArchived = usage?.status === 'EXPIRED' || usage?.status === 'FINISHED';

    return (
    <div className={`bg-white rounded-lg p-4 h-full ${isArchived ? 'grayscale' : ''}`}>
      <h3 className="text-lg font-semibold mb-2">{t.viewDetails.availableTopUps}</h3>
      {topUpLoading ? (
        <div className="text-gray-400">{t.viewDetails.loading}</div>
      ) : topUpError ? (
        <div className="text-red-500">{topUpError}</div>
      ) : sortedTopUpPackages.length === 0 ? (
        <div className="text-gray-500">{t.viewDetails.noAvailableTopUps}</div>
      ) : (
        <div className="relative overflow-hidden h-[calc(100%-3rem)]">
          <div 
            className="flex transition-transform duration-300 ease-out h-full"
            style={{
              transform: `translateX(${dragOffset}px)`,
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {sortedTopUpPackages.map((topUpPkg, index) => (
              <div 
                key={index}
                className={`w-full flex-shrink-0 transition-transform duration-300 ${
                  index === currentTopUpIndex ? 'scale-100' : 'scale-95 opacity-80'
                }`}
                style={{
                  transform: `translateX(-${currentTopUpIndex * 100}%)`,
                }}
              >
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 mx-2 h-full">
                  <div className="flex w-full justify-between mb-4">
                    <div className="flex flex-col items-center w-1/3">
                      <CreditCard className="text-green-500 mb-1" size={24} />
                      <span className="text-black text-sm mb-1">{t.viewDetails.price}</span>
                      <span className="font-normal text-gray-500 text-lg">${topUpPkg.sell_price ? Math.round(Number(topUpPkg.sell_price)) : '-'}</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3">
                      <Wifi className="text-green-500 mb-1" size={24} />
                      <span className="text-black text-sm mb-1">{t.viewDetails.data}</span>
                      <span className="font-normal text-gray-500 text-lg">{topUpPkg.data}</span>
                    </div>
                    <div className="flex flex-col items-center w-1/3">
                      <Clock className="text-green-500 mb-1" size={24} />
                      <span className="text-black text-sm mb-1">{t.viewDetails.validity}</span>
                      <span className="font-normal text-gray-500 text-lg">{topUpPkg.day}{t.viewDetails.daysUnit}</span>
                    </div>
                  </div>
                  {/* brand logo 一排＋小時數 */}
                  <div className="flex w-full justify-between items-end mb-4 px-2">
                    {(() => {
                      // 解析 data 轉 MB
                      const dataStr = (topUpPkg.data || '').replace(/\s+/g, '').toUpperCase();
                      let mb = 0;
                      if (dataStr.endsWith('GB')) mb = parseFloat(dataStr) * 1024;
                      else if (dataStr.endsWith('MB')) mb = parseFloat(dataStr);
                      // 先除以5
                      const base = Math.round(mb / 5);
                      // 各 logo 一小時用量
                      const logoUsage = [
                        { label: 'YouTube', file: 'youtube.png', usage: 1024 },
                        { label: 'Google Map', file: 'google_map.png', usage: 15 },
                        { label: 'Facebook', file: 'facebook.png', usage: 180 },
                        { label: 'Instagram', file: 'ig.png', usage: 180 },
                        { label: 'Threads', file: 'thread.png', usage: 120 },
                      ];
                      return logoUsage.map(brand => {
                        const hours = base && brand.usage ? (base / brand.usage) : 0;
                        return (
                          <div key={brand.label} className="flex flex-col items-center w-1/5">
                            <img
                              src={`/brand logo/${brand.file}`}
                              alt={brand.label}
                              className="w-4 h-4 object-contain mb-1"
                            />
                            <span className="text-[10px] text-gray-500 leading-tight">{hours ? hours.toFixed(1) : '-'}</span>
                            <span className="text-[10px] text-gray-400 leading-tight">{t.viewDetails.hoursUnit}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="space-y-2">
                    <button 
                      onClick={(e) => !isArchived && handleTopUp(e, topUpPkg)}
                      disabled={isArchived}
                      className={`w-full py-3 text-white rounded-[16px] text-sm transition-all duration-300 ${
                        isArchived 
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600'
                      }`}
                    >
                      {isArchived ? t.viewDetails.cannotTopUp : t.topUp}
                    </button>
                    <div className="flex justify-center gap-2 pt-2">
                      {sortedTopUpPackages.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            idx === currentTopUpIndex ? 'w-2 bg-green-500' : 'w-2 bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto pb-[60px]">
      <div className="bg-[#4CD964] text-white sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4 relative">
            <button
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={20} />
              {t.back}
            </button>
            <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
              <h1 className="text-xl font-bold text-white pb-0 text-center pointer-events-none">{t.viewDetails.title}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            {renderUsageGraph()}
            {renderPackageDetails()}
          </div>
          <div>
            {renderTopUpPackages()}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white z-50">
        <BottomNav activeTab="esims" onTabChange={handleTabChange} />
      </div>

      <div className="relative">
        <button
          className="absolute top-4 right-4 bg-button-gradient hover:bg-button-gradient-hover text-white px-4 py-2 rounded-full shadow-button z-10"
          onClick={handleShowInstallInstructions}
        >
          {t.installInstructions}
        </button>
      </div>
    </div>
  );
}