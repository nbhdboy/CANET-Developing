import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { PackageCard } from './components/PackageCard';
import { BottomNav } from './components/BottomNav';
import { PackageConfirmation } from './components/PackageConfirmation';
import { PaymentPage } from './components/PaymentPage';
import { SaveCardPage } from './components/SaveCardPage';
import { InstallInstructions } from './components/InstallInstructions';
import { TopUpPackages } from './components/TopUpPackages';
import { TermsAndConditions } from './components/TermsAndConditions';
import { FAQ } from './components/FAQ';
import { ViewDetails } from './components/ViewDetails';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { useStore } from './store';
import { translations } from './i18n';
import { PACKAGES } from './data/packages';
import type { ESIMPackage, UserProfile, PackageData } from './types';
import PackageList from './components/PackageList';
import { Profile } from './components/Profile';
import { fetchAiraloPackages, parseAiraloPackages, CountryPackageSummary, groupByCountry } from './data/packages';
import { Routes, Route } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// === 國家與區域白名單 ===
const ALLOWED_COUNTRY_CODES = [
  'JP','KR','HK','MO','SG','TH','VN','MY','CN','PH','KH','US','GB','DE','IT','ID'
];
const ALLOWED_TITLES = [
  'Europe','North America','Asia','Oceania','Africa'
];

// eSIM usage 快取型別
type EsimUsage = {
  status: string;
  remaining: number;
  expired_at?: string;
  total: number;
};

// === 國碼對應 country background 圖檔 mapping ===
const countryCodeToBg: Record<string, string> = {
  JP: '日本.png',
  KR: '韓國.png',
  US: '美國.png',
  HK: '香港.png',
  MO: '澳門.png',
  SG: '新加坡.png',
  TH: '泰國.png',
  VN: '越南.png',
  MY: '馬來西亞.png',
  CN: '中國.png',
  PH: '菲律賓.png',
  KH: '柬埔寨.png',
  GB: '英國.png',
  DE: '德國.png',
  IT: '義大利.png',
  ID: '印尼.png',
  AS: '亞洲.png',
  EU: '歐洲.png',
  NA: '北美洲.png',
  OC: '大洋洲.png',
  AF: '非洲.png',
};

// 國家中英文對照表
const countryNames: Record<string, { zh: string; en: string }> = {
  JP: { zh: '日本', en: 'Japan' },
  KR: { zh: '韓國', en: 'South Korea' },
  US: { zh: '美國', en: 'United States' },
  HK: { zh: '香港', en: 'Hong Kong' },
  MO: { zh: '澳門', en: 'Macau' },
  SG: { zh: '新加坡', en: 'Singapore' },
  TH: { zh: '泰國', en: 'Thailand' },
  VN: { zh: '越南', en: 'Vietnam' },
  MY: { zh: '馬來西亞', en: 'Malaysia' },
  CN: { zh: '中國', en: 'China' },
  PH: { zh: '菲律賓', en: 'Philippines' },
  KH: { zh: '柬埔寨', en: 'Cambodia' },
  GB: { zh: '英國', en: 'United Kingdom' },
  DE: { zh: '德國', en: 'Germany' },
  IT: { zh: '義大利', en: 'Italy' },
  ID: { zh: '印尼', en: 'Indonesia' },
  AS: { zh: '亞洲', en: 'Asia' },
  EU: { zh: '歐洲', en: 'Europe' },
  NA: { zh: '北美洲', en: 'North America' },
  OC: { zh: '大洋洲', en: 'Oceania' },
  AF: { zh: '非洲', en: 'Africa' },
};

function App() {
  const { language, setUser, user, fetchUserCards } = useStore();
  const [activeTab, setActiveTab] = useState<'store' | 'esims' | 'profile'>('store');
  const [selectedPackage, setSelectedPackage] = useState<ESIMPackage | null>(null);
  const [showPackageList, setShowPackageList] = useState(false);
  const [showPackageConfirmation, setShowPackageConfirmation] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSaveCard, setShowSaveCard] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const [showTopUpPackages, setShowTopUpPackages] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showViewDetails, setShowViewDetails] = useState(false);
  const [esimTab, setEsimTab] = useState<'current' | 'archived'>('current');
  const [isTopUpFlow, setIsTopUpFlow] = useState(false);
  const [purchasedEsims, setPurchasedEsims] = useState<Array<ESIMPackage & {
    status: 'active' | 'inactive';
    activationDate?: string;
    expiryDate?: string;
    usedData?: string;
    totalData?: string;
    topUpCount?: number;
  }>>([]);
  const [discountedPrice, setDiscountedPrice] = useState<number | null>(null);
  const t = translations[language];

  // 新增：API 動態資料
  const [countryPackages, setCountryPackages] = useState<CountryPackageSummary[]>([]);
  const [rawApiData, setRawApiData] = useState<any>(null); // 保存 API 原始資料
  const [selectedCountryPackages, setSelectedCountryPackages] = useState<any[]>([]); // 保存選中國家的所有細分方案
  const [loading, setLoading] = useState(true);

  // eSIM usage 狀態快取
  const [usageMap, setUsageMap] = useState<Record<string, EsimUsage>>({});
  const usageFetchedRef = useRef(false);

  // 新增 loadingPackageList 狀態
  const [loadingPackageList, setLoadingPackageList] = useState(false);

  const esimListRef = useRef<HTMLDivElement>(null);

  const [esimLoading, setEsimLoading] = useState(false);

  // 新增 profileLoading 狀態
  const [profileLoading, setProfileLoading] = useState(false);

  // 1. 新增搜尋 state
  const [searchText, setSearchText] = useState('');

  // 1. 新增搜尋 tab 狀態
  const [searchTab, setSearchTab] = useState<'country' | 'region'>('country');

  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const fetchPurchasedEsims = useCallback(async () => {
    setEsimLoading(true);
    if (!user?.userId) {
      setEsimLoading(false);
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/my-esims`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.userId })
      });
      const data = await res.json();
      if (!Array.isArray(data)) {
        setPurchasedEsims([]);
        setEsimLoading(false);
        return;
      }
      setPurchasedEsims(data);
    } catch (e) {
      setPurchasedEsims([]);
    }
    setEsimLoading(false);
  }, [user?.userId]);

  useEffect(() => {
    async function loadPackages() {
      setLoading(true);
      // 直接拿 DB 查詢的細分專案陣列
      const allPackages = await fetchAiraloPackages();
      setRawApiData(allPackages); // 保存原始細分專案陣列
      // 前端 groupByCountry 彙總顯示首頁
      const grouped = groupByCountry(allPackages);
      // 依照 ALLOWED_COUNTRY_CODES 順序排序
      const sorted = ALLOWED_COUNTRY_CODES
        .map(code => grouped.find(pkg => pkg.countryCode === code))
        .filter(Boolean);
      setCountryPackages(sorted);
      setLoading(false);
    }
    loadPackages();
  }, []);

  useEffect(() => {
    const scripts = document.querySelectorAll('script');
    scripts.forEach(s => {
      console.log('[首頁 useEffect] script:', s.src || '[inline script]');
    });
  }, []);

  useEffect(() => {
    if ((window as any).TPDirect) return; // 已載入過就不重複載入
    const script = document.createElement('script');
    script.src = 'https://js.tappaysdk.com/sdk/tpdirect/v5.20.0';
    script.async = true;
    script.id = 'tappay-sdk';
    document.body.appendChild(script);
    return () => {
      // 可選：離開網站時移除 script
      // document.getElementById('tappay-sdk')?.remove();
    };
  }, []);

  // Mock login/logout functions
  const handleLogin = () => {
    const mockUser: UserProfile = {
      userId: 'test_user_001',
      displayName: 'Demo User',
      pictureUrl: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop',
      language: language as 'en' | 'zh_TW',
      savedCards: []  // 添加默認的空卡片列表
    };
    setUser(mockUser);
  };

  const handleLogout = () => {
    setUser(null);
  };
  
  const handlePackageSelect = (pkg: ESIMPackage) => {
    console.log('[LOG] handlePackageSelect', pkg);
    if (!user) {
      handleLogin();
      return;
    }
    setSelectedPackage(pkg);
    setShowPackageList(true);
  };

  const handlePackageConfirm = (pkg: ESIMPackage | null) => {
    console.log('[LOG] handlePackageConfirm', pkg);
    if (pkg === null) {
      setShowPackageList(false);
      setSelectedPackage(null);
      return;
    }
    setSelectedPackage(pkg);
    setShowPackageList(false);
    setShowPackageConfirmation(true);
  };

  const handleConfirmationBack = () => {
    if (isTopUpFlow) {
      // 加購流程：返回詳細頁面，保持原始 eSIM 資訊
      const originalEsim = purchasedEsims.find(esim => esim.id === selectedPackage?.id);
      setShowPackageConfirmation(false);
      setShowViewDetails(true);
      if (originalEsim) {
        setSelectedPackage(originalEsim);
      }
      setIsTopUpFlow(false);
    } else {
      // 一般購買流程：返回專案列表
      setShowPackageConfirmation(false);
      setShowPackageList(true);
      setSelectedPackage(null);
    }
  };

  const handleConfirmationProceed = (pkg: ESIMPackage) => {
    console.log('[LOG] handleConfirmationProceed', pkg);
    setSelectedPackage(pkg);
    setShowPackageConfirmation(false);
    setShowPayment(true);
  };

  const handlePaymentBack = () => {
    console.log('[LOG] handlePaymentBack', selectedPackage);
    if (isTopUpFlow) {
      // 加購流程：返回詳細頁面，保持原始 eSIM 資訊
      const originalEsim = purchasedEsims.find(esim => esim.id === selectedPackage?.id);
      setShowPayment(false);
      setShowViewDetails(true);
      if (originalEsim) {
        setSelectedPackage(originalEsim);
      }
      setIsTopUpFlow(false);
    } else {
      // 一般購買流程：返回專案列表
      setShowPayment(false);
      setShowPackageList(true);
      setSelectedPackage(null);
    }
    setDiscountedPrice(null);
  };

  // 添加一個新的函數來轉換數據格式
  const convertToPackageData = (esimPackage: ESIMPackage): PackageData[] => {
    // 根據不同的數據量提供不同的選項
    const baseData = parseInt(esimPackage.dataAmount) || 1;
    return [
      {
        data: '1GB',
        validity: '7',
        price: '5.00'
      },
      {
        data: '2GB',
        validity: '15',
        price: '7.00'
      },
      {
        data: '3GB',
        validity: '30',
        price: '10.00'
      },
      {
        data: '10GB',
        validity: '30',
        price: '21.00'
      },
      {
        data: '20GB',
        validity: '30',
        price: '32.00'
      },
      {
        data: 'unlimited',
        validity: '10',
        price: '35.00'
      }
    ];
  };

  // 追蹤 purchasedEsims 狀態變化，並自動 scroll 到最上方
  useEffect(() => {
    if (esimListRef.current) {
      esimListRef.current.scrollTop = 0;
    }
    console.log('[LOG][App] purchasedEsims 狀態變化', purchasedEsims);
  }, [purchasedEsims]);

  const handlePurchaseComplete = (iccid?: string) => {
    console.log('[LOG][App] handlePurchaseComplete 執行', { selectedPackage, iccid, isTopUpFlow, purchasedEsims });
    if (selectedPackage) {
      if (isTopUpFlow) {
        // 找到原始的 eSIM
        const originalEsimIndex = purchasedEsims.findIndex(esim => esim.id === selectedPackage.id);
        if (originalEsimIndex !== -1) {
          const originalEsim = purchasedEsims[originalEsimIndex];
          // 新增 log：追蹤所有 replace 相關欄位
          console.log('[DEBUG][App] originalEsim.totalData:', originalEsim.totalData, typeof originalEsim.totalData);
          console.log('[DEBUG][App] selectedPackage.dataAmount:', selectedPackage.dataAmount, typeof selectedPackage.dataAmount);
          console.log('[DEBUG][App] originalEsim.validity:', originalEsim.validity, typeof originalEsim.validity);
          console.log('[DEBUG][App] selectedPackage.validity:', selectedPackage.validity, typeof selectedPackage.validity);
          
          // 更新加購專案列表
          const newAddOnPackage = {
            dataAmount: selectedPackage.dataAmount,
            validity: String(parseInt(selectedPackage.validity))
          };
          
          // 更新 eSIM
          const updatedEsim = {
            ...originalEsim,
            addOnPackages: [
              ...(originalEsim.addOnPackages || []),
              newAddOnPackage
            ],
            // 更新總數據量
            totalData: (() => {
              const originalData = parseFloat(originalEsim.totalData.replace('GB', ''));
              const topUpData = parseFloat(selectedPackage.dataAmount.replace('GB', ''));
              return `${originalData + topUpData}GB`;
            })(),
            // 更新有效期
            validity: (() => {
              const originalValidity = parseInt(
                typeof originalEsim.validity === 'string'
                  ? originalEsim.validity.replace(' days', '')
                  : originalEsim.validity
              );
              const topUpValidity = parseInt(
                typeof selectedPackage.validity === 'string'
                  ? selectedPackage.validity.replace(' days', '')
                  : selectedPackage.validity
              );
              return `${originalValidity + topUpValidity} days`;
            })(),
            // 更新總價格
            price: Number((originalEsim.price + (discountedPrice || selectedPackage.price)).toFixed(1)),
            // 更新到期日
            expiryDate: (() => {
              const originalValidity = parseInt(
                typeof originalEsim.validity === 'string'
                  ? originalEsim.validity.replace(' days', '')
                  : originalEsim.validity
              );
              const topUpValidity = parseInt(
                typeof selectedPackage.validity === 'string'
                  ? selectedPackage.validity.replace(' days', '')
                  : selectedPackage.validity
              );
              return new Date(Date.now() + (originalValidity + topUpValidity) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            })(),
            // 更新加購次數
            topUpCount: (originalEsim.topUpCount || 0) + 1,
            iccid: iccid || originalEsim.iccid
          };
          
          // 更新 purchasedEsims 陣列
          const newPurchasedEsims = [...purchasedEsims];
          newPurchasedEsims[originalEsimIndex] = updatedEsim;
          setPurchasedEsims(newPurchasedEsims);
          
          // 更新選中的套餐為更新後的 eSIM
          setSelectedPackage(updatedEsim);
          // 新增：購買後主動查 usage 並寫入全域快取，避免 race condition
          if (iccid) {
            const USAGE_CACHE_KEY = '__esim_usage_cache__';
            (async () => {
              try {
                const res = await fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-usage?iccid=${iccid}`);
                const json = await res.json();
                if (json.data) {
                  const usage = {
                    status: json.data.status,
                    remaining: json.data.remaining,
                    expired_at: json.data.expired_at,
                    total: json.data.total,
                  };
                  const globalCache = (window as any)[USAGE_CACHE_KEY] || {};
                  (window as any)[USAGE_CACHE_KEY] = {
                    ...globalCache,
                    [iccid]: { data: usage, ts: Date.now() }
                  };
                  // 也寫入 localStorage
                  const cacheKey = `__esim_usage_cache_${iccid}`;
                  window.localStorage.setItem(cacheKey, JSON.stringify({ data: usage, ts: Date.now() }));
                  console.log('[LOG][App] 購買後主動查 usage 並寫入快取', iccid, usage);
                }
              } catch (e) {
                console.warn('[LOG][App] 購買後查 usage 失敗', iccid, e);
              }
            })();
          }
        }
      } else {
        // 原有的新購買邏輯
        const newEsim = {
          ...selectedPackage,
          price: discountedPrice || selectedPackage.price,
          status: 'ACTIVE' as const,
          activationDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + parseInt(selectedPackage.validity) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          usedData: '0 MB',
          totalData: selectedPackage.dataAmount,
          addOnPackages: [],
          topUpCount: 0, // 初始化加購次數為 0
          iccid: iccid
        };
        console.log('[LOG][App] 新增 newEsim', newEsim);
        setPurchasedEsims([newEsim, ...purchasedEsims]);
        setSelectedPackage(null);
        // 新增：購買後主動查 usage 並寫入全域快取，避免 race condition
        if (iccid) {
          const USAGE_CACHE_KEY = '__esim_usage_cache__';
          (async () => {
            try {
              const res = await fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-usage?iccid=${iccid}`);
              const json = await res.json();
              if (json.data) {
                const usage = {
                  status: json.data.status,
                  remaining: json.data.remaining,
                  expired_at: json.data.expired_at,
                  total: json.data.total,
                };
                const globalCache = (window as any)[USAGE_CACHE_KEY] || {};
                (window as any)[USAGE_CACHE_KEY] = {
                  ...globalCache,
                  [iccid]: { data: usage, ts: Date.now() }
                };
                // 也寫入 localStorage
                const cacheKey = `__esim_usage_cache_${iccid}`;
                window.localStorage.setItem(cacheKey, JSON.stringify({ data: usage, ts: Date.now() }));
                console.log('[LOG][App] 購買後主動查 usage 並寫入快取', iccid, usage);
              }
            } catch (e) {
              console.warn('[LOG][App] 購買後查 usage 失敗', iccid, e);
            }
          })();
        }
      }
    }

    // 清理狀態
    setShowPayment(false);
    setShowPackageConfirmation(false);
    setDiscountedPrice(null);

    // 不論加購或新購買，結帳後都回主卡列表
    setActiveTab('esims');
    setShowPackageList(false);
    setShowViewDetails(false);
    setIsTopUpFlow(false);

    setEsimLoading(true);
    setTimeout(() => {
      fetchPurchasedEsims();
    }, 1000); // 延遲1秒再fetch
  };

  const handleTopUpSelect = (packageId: string) => {
    const pkg = PACKAGES.find(p => p.id === packageId);
    if (pkg) {
      setSelectedPackage(pkg);
      setShowTopUpPackages(false);
    }
  };

  const handleViewDetails = (pkg: ESIMPackage) => {
    setSelectedPackage(pkg);
    setShowViewDetails(true);
  };

  const handleTopUpConfirm = (topUpPackage: ESIMPackage) => {
    setIsTopUpFlow(true);
    setSelectedPackage(topUpPackage);
    setShowViewDetails(false);
    setShowPackageConfirmation(true);
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/remove-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cardId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete card');
      }

      // 更新用戶的已保存卡片列表
      if (user) {
        const updatedCards = user.savedCards.filter(card => card.id !== cardId);
        setUser({
          ...user,
          savedCards: updatedCards,
        });
      }
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const renderProfile = () => (
    <div className="space-y-6">
      {user && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={user.pictureUrl}
              alt={user.displayName}
              className="w-20 h-20 rounded-full"
            />
            <div>
              <h3 className="text-xl font-semibold">{user.displayName}</h3>
              <p className="text-gray-600">ID: {user.userId}</p>
            </div>
          </div>

          {/* Saved Cards Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4">{t.paymentSettings}</h4>
            {user.savedCards?.map(card => (
              <div key={card.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-2">
                <div className="flex items-center gap-3">
                  <div className="text-line">{card.brand === 'Visa' ? 'Visa' : 'Mastercard'}</div>
                  <div>•••• {card.last4}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    {card.expiryMonth}/{card.expiryYear}
                  </div>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    {t.deleteCard}
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setShowSaveCard(true)}
              className="mt-4 w-full bg-line-gradient hover:bg-line-gradient-hover text-white py-2 rounded-full transition-colors font-medium"
            >
              {t.addCreditCard}
            </button>
          </div>

          {/* Other Sections */}
          <div className="space-y-4">
            <button 
              onClick={() => setShowTerms(true)}
              className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t.termsAndConditions}
            </button>
            <button 
              onClick={() => setShowPrivacyPolicy(true)}
              className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t.privacyPolicy}
            </button>
            <button 
              onClick={() => window.open('https://line.me/R/ti/p/@canet', '_blank')}
              className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t.customerService}
            </button>
            <button 
              onClick={() => setShowFAQ(true)}
              className="w-full text-left p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t.faq}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full bg-gray-100 text-gray-700 py-2 rounded-full hover:bg-gray-200 transition-colors font-medium mt-6"
          >
            {t.logout}
          </button>
        </div>
      )}
    </div>
  );

  // 進入「我的 eSIM」頁時批次查詢 usage 狀態
  useEffect(() => {
    if (activeTab !== 'esims' || usageFetchedRef.current) return;
    if (!purchasedEsims || purchasedEsims.length === 0) return;
    usageFetchedRef.current = true;
    const fetchAllUsage = async () => {
      const newUsageMap: Record<string, EsimUsage> = {};
      for (const esim of purchasedEsims) {
        if (!esim.iccid) continue;
        try {
          const cacheKey = `__esim_usage_cache_${esim.iccid}`;
          const cache = window.localStorage.getItem(cacheKey);
          let usage: EsimUsage | null = null;
          if (cache) {
            const parsed = JSON.parse(cache);
            if (Date.now() - parsed.ts < 15 * 60 * 1000) {
              usage = parsed.data;
            }
          }
          if (!usage) {
            const res = await fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-usage?iccid=${esim.iccid}`);
            const json = await res.json();
            if (json.data) {
              usage = {
                status: json.data.status,
                remaining: json.data.remaining,
                expired_at: json.data.expired_at,
                total: json.data.total,
              };
              window.localStorage.setItem(cacheKey, JSON.stringify({ data: usage, ts: Date.now() }));
            }
          }
          if (usage) newUsageMap[esim.iccid] = usage;
          // 新增：寫入全域快取，讓詳細頁/安裝頁能共用
          if (usage) {
            const USAGE_CACHE_KEY = '__esim_usage_cache__';
            const globalCache = (window as any)[USAGE_CACHE_KEY] || {};
            (window as any)[USAGE_CACHE_KEY] = {
              ...globalCache,
              [esim.iccid]: { data: usage, ts: Date.now() }
            };
          }
        } catch {}
      }
      // 新增 log：比對 purchasedEsims 與 newUsageMap
      console.log('[usageMap] purchasedEsims iccids:', purchasedEsims.map(e => e.iccid));
      console.log('[usageMap] newUsageMap keys:', Object.keys(newUsageMap));
      setUsageMap(newUsageMap);
      // 新增 log：setUsageMap 後的內容
      setTimeout(() => {
        console.log('[usageMap] setUsageMap 後:', newUsageMap);
        // 顯示哪些 iccid 沒有 usage 狀態
        const missingStatus = purchasedEsims.filter(e => !newUsageMap[e.iccid]);
        if (missingStatus.length > 0) {
          console.warn('[usageMap] 下列 iccid 沒有 usage 狀態:', missingStatus.map(e => e.iccid));
        }
      }, 100);
    };
    fetchAllUsage();
  }, [activeTab, purchasedEsims]);

  // 合併 usage 狀態進每個 package
  const mergedEsims = purchasedEsims.map(esim => {
    if (!esim.iccid) return esim;
    const usage = usageMap[esim.iccid];
    return usage
      ? { ...esim, status: usage.status, remaining: usage.remaining, expired_at: usage.expired_at }
      : esim;
  });

  // useEffect 只依賴 showPackageList 和 selectedPackage
  useEffect(() => {
    if (showPackageList && selectedPackage) {
      console.log('[LOG] useEffect 觸發 fetch，showPackageList:', showPackageList, 'selectedPackage:', selectedPackage);
      setLoadingPackageList(true);
      const start = Date.now();
      (async () => {
        try {
          console.log('[LOG] fetch 前，loadingPackageList:', loadingPackageList);
          // 改用快取 function
          const countryPackages = await fetchAiraloPackages(selectedPackage.countryCode);
          setSelectedCountryPackages(countryPackages);
          console.log('[LOG] fetch 完成，countryPackages:', countryPackages);
      } catch (e) {
          setSelectedCountryPackages([]);
          console.log('[LOG] fetch 失敗', e);
        }
        const elapsed = Date.now() - start;
        const minLoading = 500;
        if (elapsed < minLoading) {
          setTimeout(() => {
            setLoadingPackageList(false);
            console.log('[LOG] setLoadingPackageList(false) (延遲)');
          }, minLoading - elapsed);
        } else {
          setLoadingPackageList(false);
          console.log('[LOG] setLoadingPackageList(false)');
        }
      })();
    }
  }, [showPackageList, selectedPackage]);

  useEffect(() => {
    if (activeTab === 'esims') {
      setEsimLoading(true);
    fetchPurchasedEsims();
    }
  }, [user?.userId, activeTab, fetchPurchasedEsims]);

  const renderMyEsims = () => {
    if (esimLoading) {
      return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-8 max-w-sm mx-4 w-full">
            <DotLottieReact
              src="https://lottie.host/392c4e43-1540-4c7e-8d2f-a01e3eec27ba/2TDIsdLa6w.lottie"
              loop
              autoplay
              speed={3.5}
              style={{ width: 120, height: 120 }}
            />
            <div className="text-center">
              <p className="text-xl font-semibold bg-line-gradient bg-clip-text text-transparent animate-pulse">
                {t.loadingScreen}
              </p>
            </div>
          </div>
        </div>
      );
    }
    console.log('mergedEsims:', mergedEsims);
    // 分別計算 current/archived 兩組資料
    const currentEsims = mergedEsims.filter(esim =>
      esim.status === 'ACTIVE' || esim.status === 'NOT_ACTIVE' || !esim.status
    );
    const archivedEsims = mergedEsims.filter(esim =>
      esim.status === 'EXPIRED' || esim.status === 'FINISHED'
    );
    // 有購買但該類型沒資料
    if (currentEsims.length === 0 && archivedEsims.length === 0) {
      return <div className="text-center text-gray-400 py-8">{t.noData}</div>;
    }
    // 有購買且有符合條件的 eSIM
    const sortedCurrentEsims = currentEsims.slice().sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    const sortedArchivedEsims = archivedEsims.slice().sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return (
      <div ref={esimListRef} className="space-y-8" style={{overflowY: 'auto', maxHeight: '80vh'}}>
        <div className="flex justify-between items-center">
          {/* <h2 className="text-3xl font-bold bg-line-gradient bg-clip-text text-transparent">{t.myEsims}</h2> */}
        </div>
        {/* 分頁 tab */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4 w-full max-w-xs mx-auto shadow">
          <button
            className={`flex-1 py-2 rounded-xl font-semibold text-base transition 
              ${esimTab === 'current'
                ? 'bg-[#06C755] text-white shadow'
                : 'bg-transparent text-black shadow-none'
              }`}
            onClick={() => setEsimTab('current')}
          >
            {t.myEsimsPage.currentTab}
          </button>
          <button
            className={`flex-1 py-2 rounded-xl font-semibold text-base transition 
              ${esimTab === 'archived'
                ? 'bg-[#06C755] text-white shadow'
                : 'bg-transparent text-black shadow-none'
              }`}
            onClick={() => setEsimTab('archived')}
          >
            {t.myEsimsPage.archivedTab}
          </button>
        </div>
        {/* 黃色警告 tooltip，僅在"目前使用"tab顯示 */}
        {esimTab === 'current' && (
        <div
          className="rounded-2xl px-6 py-2 mb-6 flex items-center w-full max-w-3xl mx-auto shadow-sm"
          style={{
            background: 'linear-gradient(90deg, #2EC9C8 0%, #2AACE3 100%)',
          }}
        >
          <svg className="w-8 h-8 flex-shrink-0 mr-3" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="12" fill="none" />
            <path d="M32 16V36" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            <circle cx="32" cy="46" r="2.5" fill="#fff" />
            <path d="M32 6C17.088 6 5 18.088 5 33C5 47.912 17.088 60 32 60C46.912 60 59 47.912 59 33C59 18.088 46.912 6 32 6Z" stroke="#fff" strokeWidth="4" />
          </svg>
          <div className="text-sm font-bold leading-snug text-white w-full">
            {t.myEsimsPage.installOnceWarning}
          </div>
        </div>
        )}
        {/* 目前的eSIM列表 */}
        {console.log('目前 eSIM iccid：', sortedCurrentEsims.map(e => e.iccid))}
        <div className={esimTab === 'current' ? '' : 'hidden'}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedCurrentEsims.map((esim, idx) => (
              <PackageCard
                key={esim.iccid || esim.id || `empty-${idx}`}
                package={esim}
                onSelect={handleViewDetails}
                isPurchased
                onShowInstallInstructions={handleShowInstallInstructions}
              />
            ))}
          </div>
          {sortedCurrentEsims.length === 0 && (
            <div className="text-center text-gray-400 py-8">{t.noData}</div>
          )}
        </div>
        {/* 已封存的eSIM列表 */}
        <div className={esimTab === 'archived' ? '' : 'hidden'}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedArchivedEsims.map((esim, idx) => (
              <PackageCard
                key={esim.iccid || esim.id || `empty-${idx}`}
                package={esim}
                onSelect={handleViewDetails}
                isPurchased
                onShowInstallInstructions={handleShowInstallInstructions}
              />
            ))}
          </div>
          {sortedArchivedEsims.length === 0 && (
            <div className="text-center text-gray-400 py-8">{t.noData}</div>
          )}
        </div>
      </div>
    );
  };

  const [installIccid, setInstallIccid] = useState<string | undefined>(undefined);
  const handleShowInstallInstructions = (iccid?: string) => {
    setInstallIccid(iccid);
    setShowInstallInstructions(true);
  };

  // 進入個人資料頁時自動fetchUserCards並控制loading
  useEffect(() => {
    if (activeTab === 'profile') {
      setProfileLoading(true);
      if (typeof fetchUserCards === 'function') {
        fetchUserCards().finally(() => setProfileLoading(false));
      } else {
        setProfileLoading(false);
      }
    }
  }, [activeTab, fetchUserCards]);

  // 登入後自動 fetch email 並同步到全域 user 狀態
  useEffect(() => {
    if (user?.userId) {
      Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/save-email?line_user_id=${user.userId}`).then(res => res.json()),
        fetch(`${import.meta.env.VITE_API_URL}/save-email?line_user_id=${user.userId}&field=carrier`).then(res => res.json())
      ]).then(([emailData, carrierData]) => {
        setUser({ ...user, email: emailData.email, carrier: carrierData.carrier });
        });
      if (typeof fetchUserCards === 'function') {
        fetchUserCards();
      }
    }
    // eslint-disable-next-line
  }, [user?.userId]);

  if (loading) return <div>{t.loadingScreen}</div>;

  const tabTitles = {
    store: t.esimStore,
    esims: t.myEsims,
    profile: t.profile.title,
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'esims':
        return renderMyEsims();
      case 'profile':
        if (profileLoading) {
          return (
            <div className="fixed inset-0 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-8 max-w-sm mx-4 w-full">
                <DotLottieReact
                  src="https://lottie.host/392c4e43-1540-4c7e-8d2f-a01e3eec27ba/2TDIsdLa6w.lottie"
                  loop
                  autoplay
                  speed={3.5}
                  style={{ width: 120, height: 120 }}
                />
                <div className="text-center">
                  <p className="text-xl font-semibold bg-line-gradient bg-clip-text text-transparent animate-pulse">
                    {t.loadingScreen}
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div className="p-4">
            {user ? (
              <Profile 
                onAddCard={() => {
                  setShowSaveCard(true);
                  console.log('App setShowSaveCard(true)');
                }}
                onShowTerms={() => setShowTerms(true)}
                onShowPrivacy={() => setShowPrivacyPolicy(true)}
                onShowFAQ={() => setShowFAQ(true)}
                loading={profileLoading}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">{t.loginToViewProfile}</p>
                <button
                  onClick={handleLogin}
                  className="bg-line-gradient hover:bg-line-gradient-hover text-white px-6 py-2 rounded-full transition-colors font-medium"
                >
                  {t.login}
                </button>
              </div>
            )}
          </div>
        );
      default:
        // 依 tab 狀態過濾
        let filteredPackages = countryPackages;
        if (searchTab === 'country') {
          filteredPackages = countryPackages.filter(pkg => ALLOWED_COUNTRY_CODES.includes(pkg.countryCode));
        } else if (searchTab === 'region') {
          filteredPackages = countryPackages.filter(pkg => ALLOWED_TITLES.includes(pkg.country));
        }
        // 搜尋再進一步過濾
        filteredPackages = filteredPackages.filter(pkg => {
          if (!searchText) return true;
          if (language === 'zh_TW') {
            return pkg.country && pkg.country.startsWith(searchText);
          } else {
            return pkg.country && pkg.country.toLowerCase().startsWith(searchText.toLowerCase());
          }
        });
        return (
          <>
            <div className="mb-8">
              {/* <h2 className="text-2xl font-bold bg-line-gradient bg-clip-text text-transparent mb-4">{t.availablePackages}</h2> */}
              <div className="flex justify-center">
                <div className="relative w-full max-w-7xl">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {/* 放大鏡 SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="w-full rounded-lg border border-gray-300 pl-12 pr-4 py-2 shadow focus:outline-none focus:ring-2 focus:ring-[#4CD964] placeholder-ellipsis"
                    style={{ minWidth: 200 }}
                  />
                </div>
              </div>
              {/* 分頁 tab */}
              <div className="flex bg-gray-100 rounded-xl p-1 mb-4 w-full max-w-xs mx-auto shadow mt-4">
                <button
                  className={`flex-1 py-2 rounded-xl font-semibold text-base transition 
                    ${searchTab === 'country'
                      ? 'bg-[#06C755] text-white shadow'
                      : 'bg-transparent text-black shadow-none'
                    }`}
                  onClick={() => setSearchTab('country')}
                >
                  {t.country}
                </button>
                <button
                  className={`flex-1 py-2 rounded-xl font-semibold text-base transition 
                    ${searchTab === 'region'
                      ? 'bg-[#06C755] text-white shadow'
                      : 'bg-transparent text-black shadow-none'
                    }`}
                  onClick={() => setSearchTab('region')}
                >
                  {t.region}
                </button>
              </div>
            </div>

            {!user && (
              <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
                <button
                  onClick={handleLogin}
                  className="w-full bg-line-gradient hover:bg-line-gradient-hover text-white py-3 rounded-full transition-colors font-medium"
                >
                  {t.login}
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPackages.map(pkg => (
                <div
                  key={pkg.countryCode}
                  className="bg-white rounded-2xl p-6 shadow-card hover:shadow-lg transition-shadow duration-300 cursor-pointer flex flex-col items-center"
                  onClick={() => {
                    setSelectedPackage(pkg);
                    setLoadingPackageList(true);
                    setSelectedCountryPackages([]);
                    setTimeout(() => {
                      setShowPackageList(true);
                    }, 0);
                  }}
                >
                  {/* 國家小圖與名稱 */}
                  <div className="flex items-center gap-3 mb-2 w-full justify-center">
                    <img
                      src={`https://flagcdn.com/${pkg.countryCode.toLowerCase()}.svg`}
                      alt={pkg.country}
                      className="w-12 h-12 object-cover rounded shadow"
                    />
                    <span className="text-2xl font-bold text-gray-900">{countryNames[pkg.countryCode]?.[language] || pkg.country}</span>
                  </div>
                  {/* 三個橢圓框只顯示 label，value 移到下方且變小變灰 */}
                  <div className="flex gap-3 mb-1 w-full justify-center">
                    <span className="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-semibold flex-1 min-w-[90px] max-w-[120px] text-ellipsis overflow-hidden whitespace-nowrap text-center">{t.operators}</span>
                    <span className="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-semibold flex-1 min-w-[90px] max-w-[120px] text-ellipsis overflow-hidden whitespace-nowrap text-center">{t.validityRange}</span>
                    <span className="px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-700 text-sm font-semibold flex-1 min-w-[90px] max-w-[120px] text-ellipsis overflow-hidden whitespace-nowrap text-center">{t.dataRange}</span>
                  </div>
                  {/* summary value */}
                  <div className="flex gap-3 mb-2 w-full justify-center">
                    <span className="block flex-1 min-w-[90px] max-w-[120px] text-center text-xs text-gray-500 font-normal">
                      {pkg.operators?.[0] || '—'}
                    </span>
                    <span className="block flex-1 min-w-[90px] max-w-[120px] text-center text-xs text-gray-500 font-normal">
                      {language === 'en'
                        ? (pkg.validityRange ? pkg.validityRange.replace(/天/g, 'days').replace('～', '~') : '—')
                        : (pkg.validityRange || '—')}
                    </span>
                    <span className="block flex-1 min-w-[90px] max-w-[120px] text-center text-xs text-gray-500 font-normal">
                      {pkg.dataRange ? pkg.dataRange.replace('～', '-') : '—'}
                    </span>
                  </div>
                  {/* 中間背景圖，調整為更寬且無外框 */}
                  <div className="w-full flex justify-center my-4">
                    <img
                      src={countryCodeToBg[pkg.countryCode] ? `/country background/${countryCodeToBg[pkg.countryCode]}` : '/country background/default.png'}
                      alt={pkg.country}
                      className="w-full max-w-[340px] h-32 object-cover rounded-xl"
                      style={{ boxShadow: 'none', border: 'none' }}
                    />
                  </div>
                  {/* 五個 brand logo，縮小且移除 30小時，並在下方顯示小時區間 */}
                  <div className="flex w-full justify-between items-end mb-4 px-2">
                    {(() => {
                      // 取所有 data，轉 MB
                      const datas = (pkg.packages || []).map(p => (p.data || '').replace(/\s+/g, '').toUpperCase());
                      const mbs = datas.map(d => d.endsWith('GB') ? parseFloat(d) * 1024 : d.endsWith('MB') ? parseFloat(d) : 0).filter(n => !isNaN(n) && n > 0);
                      const minMB = Math.min(...mbs);
                      const maxMB = Math.max(...mbs);
                      // 先除以5
                      const minBase = Math.round(minMB / 5);
                      const maxBase = Math.round(maxMB / 5);
                      // 各 logo 一小時用量
                      const logoUsage = [
                        { label: 'YouTube', file: 'youtube.png', usage: 1024 },
                        { label: 'Google Map', file: 'google_map.png', usage: 15 },
                        { label: 'Facebook', file: 'facebook.png', usage: 180 },
                        { label: 'Instagram', file: 'ig.png', usage: 180 },
                        { label: 'Threads', file: 'thread.png', usage: 120 },
                      ];
                      return logoUsage.map(brand => {
                        const minH = minBase && brand.usage ? (minBase / brand.usage) : 0;
                        const maxH = maxBase && brand.usage ? (maxBase / brand.usage) : 0;
                        let text = '-';
                        if (minH && maxH) {
                          text = minH === maxH ? `${minH.toFixed(1)}` : `${minH.toFixed(1)}-${maxH.toFixed(1)}`;
                        } else if (minH) {
                          text = minH.toFixed(1);
                        } else if (maxH) {
                          text = maxH.toFixed(1);
                        }
                        return (
                          <div key={brand.label} className="flex flex-col items-center w-1/5">
                            <img
                              src={`/brand logo/${brand.file}`}
                              alt={brand.label}
                              className="w-4 h-4 object-contain mb-1"
                            />
                            <span className="text-[10px] text-gray-500 leading-tight">{text}</span>
                            <span className="text-[10px] text-gray-400 leading-tight">{t.hour}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {/* 選擇按鈕 */}
                  <button className="mt-2 w-full bg-[#4CD964] text-white py-2 rounded-lg font-bold hover:bg-[#43c05c] transition">{t.select}</button>
                </div>
              ))}
            </div>
          </>
        );
    }
  };

  if (loading) return <div>{t.loadingScreen}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header 
        onMenuClick={() => console.log('Menu clicked')} 
        onLogout={user ? handleLogout : undefined}
        title={tabTitles[activeTab]}
      />
      
      <main className="container mx-auto px-4 pt-20 pb-24">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/faq" element={<FAQ onBack={() => window.history.back()} />} />
            <Route path="/privacypolicy" element={<PrivacyPolicy onBack={() => window.history.back()} />} />
            <Route path="/profile" element={<Profile onAddCard={() => setShowSaveCard(true)} onShowTerms={() => {}} onShowPrivacy={() => {}} onShowFAQ={() => {}} />} />
            <Route path="/terms" element={<TermsAndConditions onBack={() => window.history.back()} />} />
            <Route path="*" element={activeTab === 'esims' ? renderMyEsims() : renderContent()} />
          </Routes>
        </div>
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {selectedPackage && showPackageList && (
        <PackageList
          language={language}
          onSelectPackage={handlePackageConfirm}
          selectedCountry={selectedPackage}
          onClose={() => {
            setShowPackageList(false);
            setSelectedPackage(null);
            setSelectedCountryPackages([]);
          }}
          packages={selectedCountryPackages}
          loading={loadingPackageList}
        />
      )}

      {selectedPackage && showPackageConfirmation && (
        <PackageConfirmation
          package={selectedPackage}
          onConfirm={handleConfirmationProceed}
          onCancel={handleConfirmationBack}
        />
      )}

      {selectedPackage && showPayment && (
        <PaymentPage
          package={{
            ...selectedPackage,
            price: discountedPrice || selectedPackage.price
          }}
          onClose={handlePaymentBack}
          onPurchaseComplete={handlePurchaseComplete}
        />
      )}

      {selectedPackage && showViewDetails && (
        <ViewDetails
          package={selectedPackage}
          onBack={() => {
            setShowViewDetails(false);
            setSelectedPackage(null);
            setIsTopUpFlow(false);
          }}
          onPurchaseConfirm={handleTopUpConfirm}
          onTabChange={setActiveTab}
          onShowInstallInstructions={handleShowInstallInstructions}
        />
      )}

        <SaveCardPage
        show={showSaveCard}
          onClose={() => setShowSaveCard(false)}
          onSave={() => setShowSaveCard(false)}
        />

      {showInstallInstructions && (
        <InstallInstructions
          onBack={() => setShowInstallInstructions(false)}
          iccid={installIccid}
        />
      )}

      {showTopUpPackages && (
        <TopUpPackages
          onSelect={handleTopUpSelect}
          onClose={() => setShowTopUpPackages(false)}
        />
      )}

      {showTerms && (
        <TermsAndConditions onBack={() => setShowTerms(false)} />
      )}

      {showFAQ && (
        <FAQ onBack={() => setShowFAQ(false)} />
      )}

      {showPrivacyPolicy && (
        <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} />
      )}
    </div>
  );
}

export default App;