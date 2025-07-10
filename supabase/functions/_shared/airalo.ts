// Airalo Access Token Utility with in-memory cache
// 取得 Airalo API access token，建議將 client_id/client_secret 設定於環境變數

const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

async function redisGet(key: string): Promise<string | null> {
  const res = await fetch(`${redisUrl}/get/${key}`, {
    headers: { Authorization: `Bearer ${redisToken}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

async function redisSet(key: string, value: string, expireSec: number) {
  await fetch(`${redisUrl}/set/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ value, EX: expireSec }),
  });
}

// 新增刪除 Redis key 方法
export async function redisDel(key: string) {
  await fetch(`${redisUrl}/del/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken}` },
  });
}

console.log('AIRALO_CLIENT_ID:', Deno.env.get('AIRALO_CLIENT_ID'));
console.log('AIRALO_CLIENT_SECRET:', Deno.env.get('AIRALO_CLIENT_SECRET'));

export async function getAiraloAccessToken() {
  const clientId = Deno.env.get('AIRALO_CLIENT_ID');
  const clientSecret = Deno.env.get('AIRALO_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('缺少 AIRALO_CLIENT_ID 或 AIRALO_CLIENT_SECRET 環境變數');
  }

  // 1. 先從 Redis 讀取 token
  const cached = await redisGet("airalo_access_token");
  if (cached) {
    try {
      // Upstash 會包成 JSON 格式
      const parsed = JSON.parse(cached);
      if (parsed.value) {
        console.log('[AiraloToken][Redis] 取得快取 token:', parsed.value.slice(0, 8) + '...');
        return parsed.value;
      }
      console.log('[AiraloToken][Redis] 取得快取 token:', cached.slice(0, 8) + '...');
      return cached;
    } catch {
      console.log('[AiraloToken][Redis] 取得快取 token:', cached.slice(0, 8) + '...');
      return cached;
    }
  }

  // 2. 沒有快取或過期，重新申請
  const form = new FormData();
  form.append('client_id', clientId);
  form.append('client_secret', clientSecret);
  form.append('grant_type', 'client_credentials');

  const response = await fetch('https://sandbox-partners-api.airalo.com/v2/token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json'
    },
    body: form
  });

  // 印出 status、headers
  console.log('[AiraloToken][申請] status:', response.status);
  console.log('[AiraloToken][申請] headers:', Array.from(response.headers.entries()));

  const text = await response.text();
  console.log('[AiraloToken][申請] body:', text);
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Airalo 回傳非 JSON：' + text);
  }

  // 檢查是否有錯誤訊息
  if (data.code && data.message) {
    console.log('[AiraloToken][申請] 錯誤:', data.code, data.message);
    throw new Error(`Airalo API 錯誤: ${data.code} ${data.message} | 原始回應: ${text}`);
  }

  if (!data.data || !data.data.access_token || !data.data.expires_in) {
    console.log('[AiraloToken][申請] 缺少 access_token 或 expires_in:', text);
    throw new Error('Airalo 回傳內容缺少 access_token 或 expires_in | 原始回應: ' + text);
  }

  // 3. 存到 Redis，設定過期時間（保守起見提早 1 分鐘過期）
  const token = data.data.access_token;
  const expireIn = data.data.expires_in - 60; // 秒
  await redisSet("airalo_access_token", token, expireIn);

  console.log('[AiraloToken][申請] 取得新 token:', token.slice(0, 8) + '...');
  return token;
}

// Airalo 下單 API 共用函式
export async function submitAiraloOrder({ package_id, quantity = 1, description, brand_settings_name = 'CANET' }) {
  let token = await getAiraloAccessToken();
  let body = new FormData();
  body.append('package_id', package_id);
  body.append('quantity', String(quantity));
  body.append('description', description);
  if (brand_settings_name) {
    body.append('brand_settings_name', brand_settings_name);
  }
  let response = await fetch('https://sandbox-partners-api.airalo.com/v2/orders', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body
  });
  // 若遇到 401，清除 token 並重試一次
  if (response.status === 401) {
    await redisDel('airalo_access_token');
    token = await getAiraloAccessToken();
    response = await fetch('https://sandbox-partners-api.airalo.com/v2/orders', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body
    });
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Airalo 下單失敗: ${JSON.stringify(data)}`);
  }
  return data;
} 

// 根據 ICCID 取得 Airalo 安裝說明
export async function getAiraloInstallInstructions(iccid: string, language: string = 'en') {
  // 1. 先查 Airalo API
  try {
    const token = await getAiraloAccessToken();
    const url = `https://sandbox-partners-api.airalo.com/v2/sims/${iccid}/instructions`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept-Language': language
      },
    });
    console.log('[Airalo][getAiraloInstallInstructions] 實際傳遞 Accept-Language:', language);
    const data = await res.json();
    console.log('[Airalo][DEBUG] API 回傳原始資料:', JSON.stringify(data, null, 2));
    let instructions = data?.data?.instructions;
    let sims = data?.data?.sims;
    // 檢查 instructions 是否有 network_setup
    let hasNetworkSetup = false;
    if (instructions) {
      hasNetworkSetup =
        (instructions.ios && instructions.ios[0] && instructions.ios[0].network_setup) ||
        (instructions.android && instructions.android[0] && instructions.android[0].network_setup);
    }
    // 如果沒有 network_setup，但有 sims，則自動組出 network_setup
    if (instructions && !hasNetworkSetup && Array.isArray(sims) && sims.length > 0) {
      const sim = sims[0];
      // 預設步驟
      const defaultStepsIOS = {
        1: "到 設定 > 行動服務 > 加入行動方案。",
        2: "選擇 eSIM，開啟數據漫遊。",
        3: "如需手動設定 APN，請參考下方資訊。"
      };
      const defaultStepsAOS = {
        1: "到 設定 > 連線 > SIM 卡管理員。",
        2: "選擇 eSIM，開啟數據漫遊。",
        3: "如需手動設定 APN，請參考下方資訊。"
      };
      // iOS 分流
      const iosNetwork = sim.apn && sim.apn.ios ? sim.apn.ios : { apn_type: sim.apn_type, apn_value: sim.apn_value };
      // Android 分流
      const androidNetwork = sim.apn && sim.apn.android ? sim.apn.android : { apn_type: sim.apn_type, apn_value: sim.apn_value };
      if (instructions.ios && instructions.ios[0]) {
        instructions.ios[0].network_setup = {
          steps: defaultStepsIOS,
          apn_type: iosNetwork.apn_type || null,
          apn_value: iosNetwork.apn_value || null,
          is_roaming: sim.is_roaming ?? null
        };
      }
      if (instructions.android && instructions.android[0]) {
        instructions.android[0].network_setup = {
          steps: defaultStepsAOS,
          apn_type: androidNetwork.apn_type || null,
          apn_value: androidNetwork.apn_value || null,
          is_roaming: sim.is_roaming ?? null
        };
      }
      hasNetworkSetup = true;
    }
    // 如果 instructions 結構正確，直接 upsert 並回傳
    if (instructions && ((instructions.ios && instructions.ios[0]) || (instructions.android && instructions.android[0]))) {
      // upsert 快取到本地 DB
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        const upsertRows = [];
        for (const os_type of ['ios', 'android']) {
          for (const item of instructions[os_type] || []) {
            // manual
            if (item.installation_manual) {
              upsertRows.push({
                iccid,
                os_type,
                install_type: 'manual',
                version: item.version || null,
                content: item.installation_manual || {},
                qrcode_url: null,
                direct_apple_installation_url: item.direct_apple_installation_url || null,
                apn_type: item.network_setup?.apn_type || null,
                apn_value: item.network_setup?.apn_value || null,
                is_roaming: item.network_setup?.is_roaming ?? null,
              });
            }
            // qrcode
            if (item.installation_via_qr_code) {
              upsertRows.push({
                iccid,
                os_type,
                install_type: 'qrcode',
                version: item.version || null,
                content: item.installation_via_qr_code || {},
                qrcode_url: item.installation_via_qr_code.qr_code_url || null,
                direct_apple_installation_url: item.direct_apple_installation_url || null,
                apn_type: item.network_setup?.apn_type || null,
                apn_value: item.network_setup?.apn_value || null,
                is_roaming: item.network_setup?.is_roaming ?? null,
              });
            }
            // network_setup
            if (item.network_setup) {
              upsertRows.push({
                iccid,
                os_type,
                install_type: 'network_setup',
                version: item.version || null,
                content: item.network_setup || {},
                qrcode_url: null,
                direct_apple_installation_url: item.direct_apple_installation_url || null,
                apn_type: item.network_setup?.apn_type || null,
                apn_value: item.network_setup?.apn_value || null,
                is_roaming: item.network_setup?.is_roaming ?? null,
              });
            }
          }
        }
        console.log('[UPSET] 準備 upsert 到 esim_install_instructions:', JSON.stringify(upsertRows, null, 2));
        if (upsertRows.length > 0) {
          const upsertResult = await supabase.from('esim_install_instructions').upsert(upsertRows, { onConflict: ['iccid', 'os_type', 'install_type', 'version'] });
          console.log('[UPSET] upsert 結果:', JSON.stringify(upsertResult, null, 2));
        } else {
          console.log('[UPSET] 沒有 upsertRows，未執行 upsert');
        }
        // 修正：用 upsertRows group by install_type 回傳（必須放在 try 區塊內，確保 upsertRows 作用域正確）
        const iosRows = upsertRows.filter(row => row.os_type === 'ios');
        const androidRows = upsertRows.filter(row => row.os_type === 'android');
        const filtered = {
          ios: pickLatestByInstallType(iosRows),
          android: pickLatestByInstallType(androidRows)
        };
        // 新增 log：filtered 內容
        console.log('[RETURN][DEBUG] filtered.ios.length:', filtered.ios.length, 'install_types:', filtered.ios.map(i => i.install_type));
        console.log('[RETURN][DEBUG] filtered.android.length:', filtered.android.length, 'install_types:', filtered.android.map(i => i.install_type));
        return { instructions: filtered };
      } catch (e) {
        console.log('upsert esim_install_instructions 失敗:', e?.message || e);
      }
    }
  } catch (e) {
    // Airalo API 錯誤時繼續 fallback
    console.log('Airalo API error, fallback to DB:', e?.message || e);
  }
  // 2. fallback 查詢 esim_install_instructions
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: rows, error } = await supabase
      .from('esim_install_instructions')
      .select('*')
      .eq('iccid', iccid);
    if (!error && rows && rows.length > 0) {
      // 只回傳最新版本那一筆
      function pickLatest(arr) {
        if (!arr || arr.length === 0) return null;
        // 過濾有 version 的
        const withVersion = arr.filter(item => item.version);
        if (withVersion.length === 0) return arr[1] || arr[0] || null;
        let latest = null;
        let latestVersion = -Infinity;
        for (const item of withVersion) {
          // 可能是 "16.0,15.0,14.0"
          const versions = item.version.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
          const max = Math.max(...versions);
          if (max > latestVersion) {
            latestVersion = max;
            latest = item;
          }
        }
        return latest;
      }
      const iosArr = rows.filter(row => row.os_type === 'ios');
      const androidArr = rows.filter(row => row.os_type === 'android');
      const instructions = { ios: [], android: [] };
      const iosLatest = pickLatest(iosArr);
      const androidLatest = pickLatest(androidArr);
      if (iosLatest) instructions.ios.push(iosLatest);
      if (androidLatest) instructions.android.push(androidLatest);
      return { instructions };
    }
  } catch (e) {
    console.log('查詢 esim_install_instructions 失敗:', e?.message || e);
  }
  // 3. fallback 查詢 esim_orders、esim_order_detail，組成通用說明（ios/aos 內容一樣，或分流）
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    // 先查 detail
    const { data: detail, error: detailError } = await supabase
      .from('esim_order_detail')
      .select('*')
      .eq('iccid', iccid)
      .maybeSingle();
    if (detail && detail.order_id) {
      // 再查 order
      const { data: order, error: orderError } = await supabase
        .from('esim_orders')
        .select('*')
        .eq('order_id', detail.order_id)
        .maybeSingle();
      if (order) {
        const manual = order.manual_installation || '';
        const qrcode_url = detail.qrcode_url || '';
        const direct_apple_installation_url = detail.direct_apple_installation_url || '';
        const apn = detail.apn;
        const instructions: any = { ios: [], android: [] };
        if (apn && apn.ios && apn.android) {
          // 分流
          instructions.ios.push({
            install_type: 'manual',
            content: manual,
            qrcode_url,
            direct_apple_installation_url,
            apn_type: apn.ios.apn_type,
            apn_value: apn.ios.apn_value,
            is_roaming: null,
          });
          instructions.android.push({
            install_type: 'manual',
            content: manual,
            qrcode_url,
            direct_apple_installation_url,
            apn_type: apn.android.apn_type,
            apn_value: apn.android.apn_value,
            is_roaming: null,
          });
        } else {
          // 通用
          instructions.ios.push({
            install_type: 'manual',
            content: manual,
            qrcode_url,
            direct_apple_installation_url,
            apn_type: null,
            apn_value: null,
            is_roaming: null,
          });
          instructions.android.push({
            install_type: 'manual',
            content: manual,
            qrcode_url,
            direct_apple_installation_url,
            apn_type: null,
            apn_value: null,
            is_roaming: null,
          });
        }
        return { instructions };
      }
    }
  } catch (e) {
    console.log('查詢 esim_orders/esim_order_detail 失敗:', e?.message || e);
  }
  // 全部查不到
  throw new Error('查無 eSIM 安裝說明資料');
}

// group by install_type，回傳每個 install_type 最新版本
function pickLatestByInstallType(arr) {
  if (!arr || arr.length === 0) return [];
  const group = {};
  for (const item of arr) {
    if (!group[item.install_type]) group[item.install_type] = [];
    group[item.install_type].push(item);
  }
  const result = [];
  for (const type in group) {
    const withVersion = group[type].filter(item => item.version);
    let latest = null;
    let latestVersion = -Infinity;
    if (withVersion.length === 0) {
      latest = group[type][1] || group[type][0] || null;
    } else {
      for (const item of withVersion) {
        const versions = item.version.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        const max = Math.max(...versions);
        if (max > latestVersion) {
          latestVersion = max;
          latest = item;
        }
      }
    }
    if (latest) result.push(latest);
  }
  return result;
}

// 根據 ICCID 取得 Airalo 用量資訊
export async function getAiraloUsage(iccid: string) {
  const token = await getAiraloAccessToken();
  const url = `https://sandbox-partners-api.airalo.com/v2/sims/${iccid}/usage`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Airalo 用量查詢失敗: ${JSON.stringify(data)}`);
  }
  return data;
} 

// 取得指定 eSIM 的可加購 top up 方案
export async function getAiraloTopupPackages(iccid: string) {
  const token = await getAiraloAccessToken();
  const url = `https://sandbox-partners-api.airalo.com/v2/sims/${iccid}/topups`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Airalo Topup 查詢失敗: ${JSON.stringify(data)}`);
  }
  return data;
}

// 下單 top up 方案
export async function submitAiraloTopupOrder({ package_id, iccid, description }) {
  let token = await getAiraloAccessToken();
  let body = new FormData();
  body.append('package_id', package_id);
  body.append('iccid', iccid);
  body.append('description', description || `Topup (${iccid})`);
  // 新增 log
  console.log('[Topup 下單參數]', {
    package_id,
    iccid,
    description,
    token: token ? token.slice(0, 8) + '...' : '無 token'
  });
  let response = await fetch('https://sandbox-partners-api.airalo.com/v2/orders/topups', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body
  });
  // 若遇到 401，清除 token 並重試一次
  if (response.status === 401) {
    await redisDel('airalo_access_token');
    token = await getAiraloAccessToken();
    response = await fetch('https://sandbox-partners-api.airalo.com/v2/orders/topups', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body
    });
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Airalo Topup 回傳非 JSON: ${text}`);
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Airalo Topup 下單失敗: ${JSON.stringify(data)}`);
  }
  return data;
} 