import React, { useEffect, useState } from 'react';
import { ArrowLeft, QrCode, Smartphone, Info, Link as LinkIcon, Globe, Copy } from 'lucide-react';
import { useStore } from '../store';
import { translations } from '../i18n';

interface InstallInstructionsProps {
  onBack: () => void;
  iccid?: string;
  name?: string;
  flagUrl?: string;
}

interface StepMap {
  [key: string]: string;
}

interface InstallationMethod {
  model?: string | null;
  version?: string | null;
  installation_via_qr_code?: {
    steps: StepMap;
    qr_code_data?: string;
    qr_code_url?: string;
    direct_apple_installation_url?: string;
  };
  installation_manual?: {
    steps: StepMap;
    smdp_address_and_activation_code?: string;
    activation_code?: string;
  };
  network_setup?: {
    steps: StepMap;
    apn_type?: string;
    apn_value?: string;
    is_roaming?: boolean;
  };
}

interface Instructions {
  language: string;
  ios?: InstallationMethod[];
  android?: InstallationMethod[];
}

interface ApiResponse {
  data: {
    instructions: Instructions;
    name?: string;
    iccid?: string;
    flag_url?: string;
  };
}

// 解析 LPA 格式
function parseLpaString(lpa: string) {
  if (!lpa?.startsWith('LPA:1$')) return { smdp: lpa, code: '' };
  const parts = lpa.split('$');
  return {
    smdp: parts[1] || '',
    code: parts[2] || '',
  };
}

// localStorage 快取設定
const CACHE_PREFIX = 'esim_install_instructions_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天（毫秒）
function getCacheKey(iccid: string, language: string) {
  return `${CACHE_PREFIX}${iccid}_${language}`;
}
function setCache(iccid: string, language: string, data: any) {
  localStorage.setItem(getCacheKey(iccid, language), JSON.stringify({ data, ts: Date.now() }));
}
function getCache(iccid: string, language: string) {
  const raw = localStorage.getItem(getCacheKey(iccid, language));
  if (!raw) return null;
  try {
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) {
      return data;
    }
    localStorage.removeItem(getCacheKey(iccid, language));
    return null;
  } catch {
    return null;
  }
}

// 新增：iOS/Android 安裝方式選項
const IOS_OPTIONS = [
  { key: 'apple', label: '一鍵安裝' },
  { key: 'qrcode', label: 'QR code安裝' },
  { key: 'manual', label: '手動安裝' },
];
const ANDROID_OPTIONS = [
  { key: 'qrcode', label: 'QR code安裝' },
  { key: 'manual', label: '手動安裝' },
];

// 新增：iOS 步驟對應圖片檔名
const IOS_QRCODE_IMAGES = [
  'ios_第一步.png',      // 0
  'ios_第二步.png',     // 1
  'ios_QR code_1.png',  // 2
  'ios_QR code_2.png',  // 3
  'ios_第五步.png',     // 4
  'ios_第六步.png',     // 5
  'ios_第八步.png',     // 6
  'ios_第九步.png',     // 7
  'ios_第10步.png',     // 8
  'ios_第二階段＿第一步.png', // 9（全形底線）
  'ios_第二階段＿第一步.png', // 10（全形底線）
  'ios_第二階段＿第二步.png', // 11（全形底線）
];
const IOS_MANUAL_IMAGES = [
  'ios_第一步.png',         // 0
  'ios_第二步.png',        // 1
  'ios_QR code_1.png',     // 2
  'ios_手動.png',           // 3
  'ios_第五步.png',         // 4
  'ios_第六步.png',         // 5
  'ios_第八步.png',         // 6
  'ios_第九步.png',         // 7
  'ios_第10步.png',         // 8
  'ios_第二階段＿第一步.png', // 9（全形底線）
  'ios_第二階段＿第一步.png', // 10（全形底線）
  'ios_第二階段＿第二步.png', // 11（全形底線）
];
const IOS_APPLE_IMAGES = [
  'app自動安裝.png',           // 1（無空格）
  'ios_第六步.png',           // 2
  'ios_第八步.png',           // 3
  'ios_第九步.png',           // 4
  'ios_第10步.png',           // 5
  'ios_第二階段＿第一步.png',   // 6（全形底線）
  'ios_第二階段＿第一步.png',   // 7（全形底線）
  'ios_第二階段＿第二步.png',   // 8（全形底線）
];

// iOS 手動安裝：每個圖片對應教學文字的 index
const IOS_MANUAL_TEXT_INDEX = [
  0, 0, 0, // 文案1
  1, 1,    // 文案2
  2,       // 文案3
  3,       // 文案4
  4,       // 文案5
  5,       // 文案6
  6,       // network_setup 文案1
  7,       // network_setup 文案2
  8        // network_setup 文案3
];

// QR code mapping: 每個圖片對應到哪個文案 index
// 前 9 張對應 installation_via_qr_code.steps（0~8），後 3 張對應 network_setup.steps（8,9,10）
const IOS_QRCODE_TEXT_INDEX = [0,0,0,1,1,2,3,4,5,6,7,8];

// Apple 自動安裝步驟對應圖片（8步，文案一對多）
const IOS_APPLE_TEXT_INDEX = [0,1,2,3,4,5,5,6];

// === Android QR code 安裝步驟對應 ===
const ANDROID_QRCODE_IMAGES = [
  'aos_第一步.png',    // 0
  'aos_第二步.png',    // 1
  'aos_第三步.png',    // 2
  'aos_第四步.png',    // 3
  'aos_第五步.png',    // 4
  'aos_第六步_QR code.png', // 5
  'aos_第七步.png',    // 6
  'aos_第八步.png',    // 7
  'aos_第九步.png',    // 8
  'aos_第10步.png',    // 9
  'aos_第11步.png',    // 10
  'aos_第二階段＿第一步.png', // 11
  'aos_第二階段＿第一步.png', // 12
  'aos_第二階段＿第一步.png', // 13
  'aos_第二階段＿第二步.png', // 14
  'aos_第二階段＿第二步.png', // 15
];
// === Android 手動安裝步驟對應 ===
const ANDROID_MANUAL_IMAGES = [
  'aos_第一步.png',    // 0
  'aos_第二步.png',    // 1
  'aos_第三步.png',    // 2
  'aos_第四步.png',    // 3
  'aos_第五步.png',    // 4
  'aos_第六步_手動1.png', // 5
  'aos_第六步_手動2.png', // 6
  'aos_第七步.png',    // 7
  'aos_第八步.png',    // 8
  'aos_第九步.png',    // 9
  'aos_第10步.png',    // 10
  'aos_第11步.png',    // 11
  'aos_第二階段＿第一步.png', // 12
  'aos_第二階段＿第一步.png', // 13
  'aos_第二階段＿第一步.png', // 14
  'aos_第二階段＿第二步.png', // 15
  'aos_第二階段＿第二步.png', // 16 新增
];
// Android QR code 安裝：每個圖片對應的文案 index
const ANDROID_QRCODE_TEXT_INDEX = [
  0,0,0, // 1的文案
  1,     // 2的文案
  2,     // 3的文案
  3,3,3,3, // 4的文案
  4,4,   // 5的文案
  5,6,7,8,9 // network_setup 1~5
];
// Android 手動安裝：每個圖片對應的文案 index
const ANDROID_MANUAL_TEXT_INDEX = [
  0,0,0,    // 1的文案
  1,        // 2的文案
  2,        // 3的文案
  3,        // 4的文案
  4,4,4,4,  // 5的文案
  5,5,      // 6的文案
  6,7,8,9,10,11 // network_setup 1~6
];

export function InstallInstructions({ onBack, iccid, name, flagUrl }: InstallInstructionsProps) {
  const { language } = useStore();
  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [tab, setTab] = useState<'ios' | 'android'>('ios');
  const [iosType, setIosType] = useState('qrcode');
  const [androidType, setAndroidType] = useState('qrcode');
  const [step, setStep] = useState(0);
  const [meta, setMeta] = useState<{ name?: string; iccid?: string; flag_url?: string }>({});
  const [rawApiData, setRawApiData] = useState<any>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const [usageStatus, setUsageStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!iccid) return;
    setLoading(true);
    setError(null);
    // 先檢查 localStorage 快取
    const cached = getCache(iccid, language);
    if (cached && cached.instructions) {
      setInstructions(cached.instructions);
      setMeta({
        name: cached.name,
        iccid: cached.iccid,
        flag_url: cached.flag_url,
      });
      setLoading(false);
      return;
    }
    // 沒有快取才發 API
    fetch(`https://lcfsxxncgqrhjtbfmtig.functions.supabase.co/airalo-install-instructions?iccid=${iccid}&language=${language}`)
      .then(res => {
        if (!res.ok) throw new Error('API 請求失敗');
        return res.json();
      })
      .then((json: any) => {
        console.log('[InstallInstructions] API 回傳：', json);
        let data = json.data || json;
        console.log('data:', data, 'typeof data:', typeof data, 'isArray:', Array.isArray(data));
        if (Array.isArray(data)) {
          data = data[0];
          console.log('data[0]:', data);
        }
        if (!data || !data.instructions) {
          console.log('進入 setInstructions(null)');
          setInstructions(null);
          setLoading(false);
          return;
        }
        setCache(iccid, language, data); // 寫入快取
        setInstructions(data.instructions);
        setMeta({
          name: data.name,
          iccid: data.iccid,
          flag_url: data.flag_url,
        });
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [iccid, language]);

  useEffect(() => {
    if (!iccid) return;
    // 先檢查主頁卡片的全域快取
    const USAGE_CACHE_KEY = '__esim_usage_cache__';
    const cache = (window as any)[USAGE_CACHE_KEY] || {};
    const now = Date.now();
    const cacheItem = cache[iccid];
    console.log('[安裝頁] 查詢 usage status，ICCID:', iccid, '全域快取內容:', cache, 'cacheItem:', cacheItem);
    if (cacheItem && now - cacheItem.ts < 15 * 60 * 1000 && cacheItem.data && cacheItem.data.status) {
      console.log('[安裝頁] 命中主頁快取，不發API', cacheItem);
      setUsageStatus(cacheItem.data.status);
      return;
    } else {
      console.log('[安裝頁] 沒命中快取，會發API');
    }
    // 無快取才發 API
    fetch(`https://lcfsxxncgqrhjtbfmtig.supabase.co/functions/v1/airalo-get-usage?iccid=${iccid}`)
      .then(res => res.json())
      .then(json => {
        if (json.data && json.data.status) {
          setUsageStatus(json.data.status);
          // 寫入快取
          localStorage.setItem(USAGE_CACHE_KEY, JSON.stringify({ status: json.data.status, ts: Date.now() }));
        } else {
          setUsageStatus(null);
        }
      })
      .catch(() => setUsageStatus(null));
  }, [iccid]);

  // 取得目前 OS 的 instructions（只取 version 為 null 的第一筆）
  const currentInstruction = instructions
    ? (tab === 'ios'
        ? Array.isArray(instructions.ios) ? instructions.ios.filter(item => item.version === '16.0')[0] : null
        : Array.isArray(instructions.android) ? instructions.android.filter(item => !item.version)[0] : null)
    : null;

  // 警告提示
  const warning = (
    <div className="bg-green-100 text-green-900 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
      <span className="font-bold text-xl">⚠️</span>
      <span>警告！大多數的 eSIM 只能安裝一次。若將 eSIM 從裝置中移除，就無法再次安裝。</span>
    </div>
  );

  // 根據下拉選單與步驟取得對應圖片
  let images: string[] = [];
  if (tab === 'ios') {
    if (iosType === 'qrcode') images = IOS_QRCODE_IMAGES;
    else if (iosType === 'manual') images = IOS_MANUAL_IMAGES;
    else if (iosType === 'apple') images = IOS_APPLE_IMAGES;
  } else if (tab === 'android') {
    if (androidType === 'qrcode') images = ANDROID_QRCODE_IMAGES;
    else if (androidType === 'manual') images = ANDROID_MANUAL_IMAGES;
  }

  // 取得目前步驟的圖片路徑
  const currentImage = images[step] ? `/installation instruction/${images[step]}` : '';
  // 取得目前步驟的教學文字（API steps 依序對應）
  let stepsArr: string[] = [];
  if (tab === 'ios' && instructions) {
    let inst: any = null;
    if (iosType === 'qrcode') inst = instructions.ios?.find(i => i.installation_via_qr_code);
    else if (iosType === 'manual') inst = instructions.ios?.find(i => i.installation_manual);
    else if (iosType === 'apple') inst = instructions.ios?.find(i => i.direct_apple_installation_url);
    if (inst && inst.installation_via_qr_code && iosType === 'qrcode') {
      // 合併 network_setup.steps 1~3
      const installSteps = Object.values(inst.installation_via_qr_code.steps || {});
      const networkSteps = inst.network_setup?.steps ? [
        inst.network_setup.steps[1] || '',
        inst.network_setup.steps[2] || '',
        inst.network_setup.steps[3] || '',
      ] : [];
      stepsArr = [...installSteps, ...networkSteps];
    } else if (inst && inst.installation_manual && iosType === 'manual') {
      // 完全依照需求組合 stepsArr
      const installSteps = Object.values(inst.installation_manual.steps || {}); // 6個文案
      const networkSteps = inst.network_setup?.steps ? [
        inst.network_setup.steps[1] || '',
        inst.network_setup.steps[2] || '',
        inst.network_setup.steps[3] || '',
      ] : [];
      stepsArr = [...installSteps, ...networkSteps]; // 共9個文案
    } else if (inst && inst.direct_apple_installation_url && iosType === 'apple') {
      stepsArr = [t.installInstructions + '（Apple 直接安裝）'];
    }
  } else if (tab === 'android' && instructions) {
    if (androidType === 'qrcode') {
      // 前5個文案：installation_via_qr_code.steps
      const inst = instructions.android?.find(i => i.installation_via_qr_code);
      const installSteps = inst?.installation_via_qr_code?.steps ? Object.values(inst.installation_via_qr_code.steps) : [];
      // 後5個文案：network_setup.steps 1~5
      const networkSteps = inst?.network_setup?.steps ? [
        inst.network_setup.steps[1] || '',
        inst.network_setup.steps[2] || '',
        inst.network_setup.steps[3] || '',
        inst.network_setup.steps[4] || '',
        inst.network_setup.steps[5] || '',
      ] : [];
      stepsArr = [...installSteps, ...networkSteps];
    } else if (androidType === 'manual') {
      // 前6個文案：installation_manual.steps
      const inst = instructions.android?.find(i => i.installation_manual);
      const installSteps = inst?.installation_manual?.steps ? Object.values(inst.installation_manual.steps) : [];
      // 後5個文案：network_setup.steps 1~5
      const networkSteps = inst?.network_setup?.steps ? [
        inst.network_setup.steps[1] || '',
        inst.network_setup.steps[2] || '',
        inst.network_setup.steps[3] || '',
        inst.network_setup.steps[4] || '',
        inst.network_setup.steps[5] || '',
      ] : [];
      stepsArr = [...installSteps, ...networkSteps];
    }
  }
  // 進度 bar 長度
  const totalSteps = images.length;

  // 取得目前步驟對應的教學文字 index
  let textIndex = step;
  if (tab === 'ios' && iosType === 'qrcode') {
    textIndex = IOS_QRCODE_TEXT_INDEX[step] ?? 0;
  } else if (tab === 'ios' && iosType === 'manual') {
    textIndex = IOS_MANUAL_TEXT_INDEX[step] ?? 0;
  } else if (tab === 'ios' && iosType === 'apple') {
    textIndex = IOS_APPLE_TEXT_INDEX[step] ?? 0;
  } else if (tab === 'android' && androidType === 'qrcode') {
    textIndex = ANDROID_QRCODE_TEXT_INDEX[step] ?? 0;
  } else if (tab === 'android' && androidType === 'manual') {
    textIndex = ANDROID_MANUAL_TEXT_INDEX[step] ?? 0;
  }

  // 切換步驟
  const handlePrev = () => setStep(s => (s - 1 + totalSteps) % totalSteps);
  const handleNext = () => setStep(s => (s + 1) % totalSteps);
  // 切換下拉選單時重設步驟
  const handleIosTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIosType(e.target.value);
    setStep(0);
  };
  const handleAndroidTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAndroidType(e.target.value);
    setStep(0);
  };

  // images 變動時自動 reset step
  useEffect(() => {
    setStep(0);
  }, [tab, iosType, androidType]);

  // 保險：step 超過 images 長度時自動歸零
  useEffect(() => {
    if (step >= images.length) setStep(0);
  }, [images.length, step]);

  // 當 step 變動時，自動捲動到底部，確保按鈕可見
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [step]);

  useEffect(() => {
    if (sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="bg-line-gradient text-white sticky top-0 z-50">
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
              <h1 className="text-2xl font-bold pb-0 text-center pointer-events-none">前往安裝</h1>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        {/* 卡片資訊 */}
        <div className="flex items-center gap-4 mb-0" ref={sectionRef} style={{scrollMarginTop: 80}}>
          {meta.flag_url && <img src={meta.flag_url} alt="flag" className="w-8 h-8 rounded" />}
          <div className="flex flex-col gap-1 w-full">
            <div className="font-bold text-lg leading-tight">ICCID：</div>
            <div className="flex items-center gap-4 w-full">
              <span className="text-xs text-gray-500">{meta.iccid || iccid}</span>
              <button
                className="ml-1 text-gray-400 hover:text-gray-700"
                onClick={() => {
                  navigator.clipboard.writeText(meta.iccid || iccid || '');
                }}
                title="複製 ICCID"
              >
                <Copy size={14} />
              </button>
              {/* iOS/Android tab 靠右 */}
              <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
                <button
                  className={`px-4 py-1 rounded-full text-sm font-semibold transition ${tab === 'ios' ? 'bg-white text-green-600 shadow' : 'text-gray-500'}`}
                  onClick={() => setTab('ios')}
                >iOS</button>
                <button
                  className={`px-4 py-1 rounded-full text-sm font-semibold transition ${tab === 'android' ? 'bg-white text-green-600 shadow' : 'text-gray-500'}`}
                  onClick={() => setTab('android')}
                >Android</button>
              </div>
            </div>
          </div>
        </div>
        {/* 安裝完成 bar，移到 tab 下方、圖片區上方 */}
        {usageStatus === 'ACTIVE' && (
          <div className="w-full flex justify-center mb-0 mt-1">
            <div className="bg-line-gradient text-white rounded-2xl h-8 flex items-center gap-1.5 shadow-md w-48 justify-center">
              <svg className="w-5 h-5 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="11" stroke="white" strokeWidth="2" fill="none" />
                <path d="M7.5 12.5L11 16L17 9.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-bold text-sm leading-tight">您的 eSIM 已成功安裝</span>
            </div>
          </div>
        )}
        {/* 手機截圖區+下拉選單 */}
        <div
          className="p-0 mb-1 flex flex-col items-center"
          onTouchStart={e => {
            if (e.touches.length === 1) {
              (window as any)._esim_swipe_startX = e.touches[0].clientX;
            }
          }}
          onTouchEnd={e => {
            const startX = (window as any)._esim_swipe_startX;
            if (typeof startX !== 'number') return;
            const endX = e.changedTouches[0].clientX;
            const deltaX = endX - startX;
            if (Math.abs(deltaX) > 40) {
              if (deltaX > 0) {
                handlePrev(); // 向左滑
              } else {
                handleNext(); // 向右滑
              }
            }
            (window as any)._esim_swipe_startX = undefined;
          }}
        >
          {/* 固定大小圖片容器，圖片置中且等大 */}
          <div className="w-full max-w-[440px] flex items-center justify-center bg-white mx-auto overflow-hidden relative min-h-[220px]">
            <AnimatedImage key={step + '-' + tab + '-' + (tab === 'ios' ? iosType : androidType)} src={currentImage} />
          </div>
        </div>
        {/* 教學文字區 */}
        <div className="p-0 mb-6 min-h-[120px] flex flex-col justify-center items-start w-full max-w-md mx-auto">
          {/* 主標 & 副標 + drop down list */}
          <div className="w-full mb-2">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-left">
                {(tab === 'ios' && iosType === 'qrcode') ? (step < 9 ? '流程1/2-安裝eSIM' : '流程2/2-存取數據') :
                 (tab === 'ios' && iosType === 'apple') ? (step < 5 ? '流程1/2-安裝eSIM' : '流程2/2-存取數據') :
                 (tab === 'android' && androidType === 'qrcode') ? (step < 11 ? '流程1/2-安裝eSIM' : '流程2/2-存取數據') :
                 (tab === 'android' && androidType === 'manual') ? (step < 12 ? '流程1/2-安裝eSIM' : '流程2/2-存取數據') :
                 (step < 10 ? '流程1/2-安裝eSIM' : '流程2/2-存取數據')}
              </div>
              {/* drop down list 靠右 */}
              {tab === 'ios' && (
                <select value={iosType} onChange={handleIosTypeChange} className="border border-gray-200 bg-gray-100 px-2 py-1 text-xs shadow-sm rounded-none focus:outline-none focus:ring-2 focus:ring-green-200 transition-all duration-150 ml-2">
                  {IOS_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                </select>
              )}
              {tab === 'android' && (
                <select value={androidType} onChange={handleAndroidTypeChange} className="border border-gray-200 bg-gray-100 px-2 py-1 text-xs shadow-sm rounded-none focus:outline-none focus:ring-2 focus:ring-green-200 transition-all duration-150 ml-2">
                  {ANDROID_OPTIONS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                </select>
              )}
            </div>
            <div className="text-sm font-semibold text-left text-[#06C755]">
              {`步驟${step+1}`}
            </div>
          </div>
          <div className="text-xs text-gray-800 text-left whitespace-pre-line w-full">
            {tab === 'ios' && iosType === 'apple' && instructions ? (
              (() => {
                // 只在 step 0~4 顯示 App 直接安裝連結 button
                if (step <= 4) {
                  const inst = instructions.ios?.find(i => i.direct_apple_installation_url);
                  if (inst && inst.direct_apple_installation_url) {
                    return (
                      <div className="w-full flex justify-center">
                        <a href={inst.direct_apple_installation_url} target="_blank" rel="noopener noreferrer"
                          className="inline-block px-8 py-3 bg-green-500 hover:bg-green-600 text-white text-base rounded transition-colors font-medium flex items-center justify-center gap-2">
                          點擊直接安裝
                        </a>
                      </div>
                    );
                  }
                  return '（無教學文字）';
                }
                // step 5~7 顯示 network_setup 文案
                // 取得 network_setup steps
                let networkSteps: string[] = [];
                const inst = instructions.ios?.[0];
                if (inst && inst.network_setup && inst.network_setup.steps) {
                  networkSteps = [
                    inst.network_setup.steps[1] || '',
                    inst.network_setup.steps[2] || '',
                    inst.network_setup.steps[3] || '',
                  ];
                }
                if (step >= 5 && step <= 7 && networkSteps[step - 5]) {
                  return (
                    <ul className="list-disc pl-5">
                      {[networkSteps[step - 5]]
                        .filter(line => line.trim())
                        .map((line, idx) => <li key={idx}>{line.trim()}</li>)}
                    </ul>
                  );
                }
                return '（無教學文字）';
              })()
            ) : (
              // 其他模式的教學文案
              !(tab === 'ios' && iosType === 'qrcode' && step === 3) &&
              !(tab === 'android' && androidType === 'qrcode' && step === 5) && (
                <ul className="list-disc pl-5">
                  {(() => {
                    if (tab === 'android' && androidType === 'qrcode') {
                      return [stepsArr[textIndex] || '（無教學文字）']
                        .filter(line => line.trim())
                        .map((line, idx) => <li key={idx}>{line.trim()}</li>);
                    } else if (tab === 'android' && androidType === 'manual') {
                      return [stepsArr[textIndex] || '（無教學文字）']
                        .filter(line => line.trim())
                        .map((line, idx) => <li key={idx}>{line.trim()}</li>);
                    } else if (tab === 'ios' && iosType === 'manual') {
                      // iOS 手動安裝：每一張圖只顯示一個文案
                      return <li>{stepsArr[textIndex] || '（無教學文字）'}</li>;
                    }
                    // 其餘維持原本邏輯
                    return (stepsArr[textIndex] || '（無教學文字）')
                      .split(/\n|。/)
                      .filter(line => line.trim())
                      .map((line, idx) => <li key={idx}>{line.trim()}</li>);
                  })()}
                </ul>
              )
            )}
            {/* iOS 手動安裝第4步顯示 SM-DP+地址與啟用碼表格 */}
            {tab === 'ios' && iosType === 'manual' && step === 3 && instructions && (() => {
              const inst = instructions.ios?.find(i => i.installation_manual);
              // 直接取 smdp_address 與 activation_code
              const smdp = inst?.installation_manual?.smdp_address || '';
              const code = inst?.installation_manual?.activation_code || '';
              if (smdp || code) {
                return (
                  <div className="flex items-start mt-2">
                    <span className="text-black text-base mr-2 select-none" style={{lineHeight:'28px'}}>•</span>
                    <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 w-full max-w-xs min-w-[180px] mx-0">
                      <div className="grid grid-cols-[88px_16px_1fr_20px] gap-x-0 gap-y-1 items-start">
                        {/* SM-DP+ 位址 */}
                        <span className="font-bold text-xs text-black col-start-1 row-start-1 row-span-2">SM-DP+ 位址</span>
                        <span className="font-bold text-xs text-black col-start-2 row-start-1 row-span-2 flex items-start">：</span>
                        {/* 內容多行分開顯示 */}
                        {smdp.split(/\n|<br\s*\/?/).map((line, idx) => (
                          <span key={idx} className="font-mono text-xs break-all col-start-3 row-start-1 row-span-2" style={{gridRowStart: idx+1}}>{line}</span>
                        ))}
                        {/* 複製按鈕只在第一行顯示 */}
                        <button
                          className="ml-2 text-gray-400 hover:text-gray-700 col-start-4 row-start-1 row-span-2 p-0 h-5 w-5 flex items-center justify-center"
                          style={{gridRowStart: 1}}
                          onClick={() => navigator.clipboard.writeText(smdp)}
                          title="複製 SM-DP+位址"
                        >
                          <Copy size={12} />
                        </button>
                        {/* 啟用碼 */}
                        <span className="font-bold text-xs text-black col-start-1 row-start-3">啟用碼</span>
                        <span className="font-bold text-xs text-black col-start-2 row-start-3 flex items-center">：</span>
                        <span className="font-mono text-xs break-all col-start-3 row-start-3">{code}</span>
                        <button
                          className="ml-2 text-gray-400 hover:text-gray-700 col-start-4 row-start-3 p-0 h-5 w-5 flex items-center justify-center"
                          onClick={() => navigator.clipboard.writeText(code)}
                          title="複製啟用碼"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {/* iOS QR code 安裝步驟4時，於文字區塊下方顯示 QR code */}
            {tab === 'ios' && iosType === 'qrcode' && step === 3 && instructions && (() => {
              const inst = instructions.ios?.find(i => i.installation_via_qr_code);
              const qrUrl = inst?.installation_via_qr_code?.qr_code_url;
              const qrData = inst?.installation_via_qr_code?.qr_code_data;
              if (qrUrl || qrData) {
                return (
                  <div className="w-full flex flex-row items-start mt-4 gap-4">
                    {/* 主要教學文字（左側） */}
                    <div className="flex-1 min-w-0">
                      <ul className="list-disc pl-5 text-left">
                        <li>{stepsArr[textIndex] || '（無教學文字）'}</li>
                      </ul>
                    </div>
                    {/* QR code（右側） */}
                    <div className="flex flex-col items-center min-w-[90px]">
                      <img
                        src={qrUrl ? qrUrl : `data:image/png;base64,${qrData}`}
                        alt="QR code"
                        className="w-20 h-20 object-contain mb-2 border border-gray-200 rounded bg-white"
                      />
                      <div className="flex flex-row gap-2 w-full justify-center mt-1">
                        <a
                          href={qrUrl ? qrUrl : `data:image/png;base64,${qrData}`}
                          download="esim-qr.png"
                          className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 text-xs hover:bg-gray-200 transition text-center min-w-[40px]"
                        >下載</a>
                        {navigator.share && (
                          <button
                            className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 text-xs hover:bg-gray-200 transition text-center min-w-[40px]"
                            onClick={() => {
                              if (qrUrl) {
                                navigator.share({ title: 'eSIM QR code', url: qrUrl });
                              } else if (qrData) {
                                navigator.share({ title: 'eSIM QR code', files: [new File([Uint8Array.from(atob(qrData), c => c.charCodeAt(0))], 'esim-qr.png', { type: 'image/png' })] });
                              }
                            }}
                          >分享</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {/* Android QR code 安裝步驟6時，於文字區塊右側顯示 QR code 及下載、分享按鈕 */}
            {tab === 'android' && androidType === 'qrcode' && step === 5 && instructions && (() => {
              const inst = instructions.android?.find(i => i.installation_via_qr_code);
              const qrUrl = inst?.installation_via_qr_code?.qr_code_url;
              const qrData = inst?.installation_via_qr_code?.qr_code_data;
              if (qrUrl || qrData) {
                return (
                  <div className="w-full flex flex-row items-start mt-4 gap-4">
                    {/* 主要教學文字（左側） */}
                    <div className="flex-1 min-w-0">
                      <ul className="list-disc pl-5 text-left">
                        <li>{stepsArr[textIndex] || '（無教學文字）'}</li>
                      </ul>
                    </div>
                    {/* QR code（右側） */}
                    <div className="flex flex-col items-center min-w-[90px]">
                      <img
                        src={qrUrl ? qrUrl : `data:image/png;base64,${qrData}`}
                        alt="QR code"
                        className="w-20 h-20 object-contain mb-2 border border-gray-200 rounded bg-white"
                      />
                      <div className="flex flex-row gap-2 w-full justify-center mt-1">
                        <a
                          href={qrUrl ? qrUrl : `data:image/png;base64,${qrData}`}
                          download="esim-qr.png"
                          className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 text-xs hover:bg-gray-200 transition text-center min-w-[40px]"
                        >下載</a>
                        {navigator.share && (
                          <button
                            className="px-1 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-300 text-xs hover:bg-gray-200 transition text-center min-w-[40px]"
                            onClick={() => {
                              if (qrUrl) {
                                navigator.share({ title: 'eSIM QR code', url: qrUrl });
                              } else if (qrData) {
                                navigator.share({ title: 'eSIM QR code', files: [new File([Uint8Array.from(atob(qrData), c => c.charCodeAt(0))], 'esim-qr.png', { type: 'image/png' })] });
                              }
                            }}
                          >分享</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            {/* Android 手動安裝步驟7時，於文字區塊下方顯示 SM-DP+地址與啟用碼 */}
            {tab === 'android' && androidType === 'manual' && step === 6 && instructions && (() => {
              const inst = instructions.android?.find(i => i.installation_manual);
              let smdp = inst?.installation_manual?.smdp_address_and_activation_code || '';
              let code = inst?.installation_manual?.activation_code || '';
              // 新增：解析 LPA 格式
              if (smdp.startsWith('LPA:1$')) {
                const parts = smdp.split('$');
                smdp = parts[1] || '';
                code = parts[2] || code;
              }
              if (smdp || code) {
                return (
                  <div className="flex items-start mt-2">
                    <span className="text-black text-base mr-2 select-none" style={{lineHeight:'28px'}}>•</span>
                    <div className="bg-white rounded-xl border border-gray-200 px-3 py-2 w-full max-w-xs min-w-[180px] mx-0">
                      <div className="grid grid-cols-[88px_16px_1fr_20px] gap-x-0 gap-y-1 items-start">
                        {/* SM-DP+ 位址 */}
                        <span className="font-bold text-xs text-black col-start-1 row-start-1 row-span-2">SM-DP+ 位址</span>
                        <span className="font-bold text-xs text-black col-start-2 row-start-1 row-span-2 flex items-start">：</span>
                        {/* 內容多行分開顯示 */}
                        {smdp.split(/\n|<br\s*\/?/).map((line, idx) => (
                          <span key={idx} className="font-mono text-xs break-all col-start-3 row-start-1 row-span-2" style={{gridRowStart: idx+1}}>{line}</span>
                        ))}
                        {/* 複製按鈕只在第一行顯示 */}
                        <button
                          className="ml-2 text-gray-400 hover:text-gray-700 col-start-4 row-start-1 row-span-2 p-0 h-5 w-5 flex items-center justify-center"
                          style={{gridRowStart: 1}}
                          onClick={() => navigator.clipboard.writeText(smdp)}
                          title="複製 SM-DP+位址"
                        >
                          <Copy size={12} />
                        </button>
                        {/* 啟用碼 */}
                        <span className="font-bold text-xs text-black col-start-1 row-start-3">啟用碼</span>
                        <span className="font-bold text-xs text-black col-start-2 row-start-3 flex items-center">：</span>
                        <span className="font-mono text-xs break-all col-start-3 row-start-3">{code}</span>
                        <button
                          className="ml-2 text-gray-400 hover:text-gray-700 col-start-4 row-start-3 p-0 h-5 w-5 flex items-center justify-center"
                          onClick={() => navigator.clipboard.writeText(code)}
                          title="複製啟用碼"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
        {/* 進度 bar+橫線+按鈕 */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-full max-w-md flex flex-col items-center gap-1">
            <div className="flex w-full justify-between items-center mb-2">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={
                    idx === step
                      ? 'h-1.5 w-8 bg-black rounded transition-all duration-200'
                      : 'h-1 w-8 bg-gray-300 rounded'
                  }
                />
              ))}
            </div>
            {/* 步驟按鈕與數字同一排 */}
            <div className="flex w-full justify-between items-center mt-0">
              <button
                onClick={handlePrev}
                className="w-20 px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs disabled:opacity-50"
              >上一步</button>
              <span className="text-xs text-gray-500 text-center">{step + 1}/{totalSteps}</span>
              <button
                onClick={handleNext}
                className="w-20 px-2 py-1 rounded bg-green-500 text-white text-xs disabled:opacity-50"
              >下一步</button>
            </div>
          </div>
        </div>
        {/* 捲動定位點 */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function AnimatedImage({ src }: { src: string }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 10);
    return () => clearTimeout(t);
  }, [src]);
  return (
    <img
      src={src}
      alt="step"
      className={`h-full w-auto max-w-full object-contain transition-transform duration-500 ease-in-out ${show ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}
      style={{margin:0,padding:0,position:'absolute',left:'50%',right:'auto',transform:`translateX(-50%) ${show ? '' : 'translateX(80px)'}`}}
    />
  );
}