// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { submitAiraloOrder } from '../_shared/airalo.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

console.log("Hello from Process Payment Function!")

interface TapPayRequest {
  prime: string;
  amount: number;
  currency: string;
  details?: string;
  cardholder?: {
    phone_number?: string;
    name?: string;
    email?: string;
  };
  redirect_url?: string;
  notify_url?: string;
}

interface TapPayResponse {
  status: number;
  msg: string;
  rec_trade_id?: string;
  order_number?: string;
  transaction_time_millis?: number;
  bank_transaction_id?: string;
  bank_result_code?: string;
  bank_result_msg?: string;
}

serve(async (req) => {
  // 獲取所有請求頭
  const headers = Object.fromEntries(req.headers.entries());
  console.log('=== 完整請求信息 ===');
  console.log('請求 Headers:', JSON.stringify(headers, null, 2));

  // 處理 OPTIONS 請求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const data = await req.json();
    console.log('收到的請求數據:', data);
    
    // 判斷流程：有 card_key 和 card_token 就走 pay by card token，否則走 pay by prime
    let isCardTokenFlow = false;
    let cardKey = data.card_key;
    let cardToken = data.card_token;
    // 新增：如果有 card_id + user_id，後端查詢敏感資訊
    if (data.card_id && data.user_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: cardRow, error: cardError } = await supabase
        .from('user_cards')
        .select('card_key, card_token')
        .eq('id', data.card_id)
        .eq('line_user_id', data.user_id)
        .maybeSingle();
      if (!cardRow || cardError) {
        return new Response(JSON.stringify({ success: false, error: '找不到卡片或權限不足' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      cardKey = cardRow.card_key;
      cardToken = cardRow.card_token;
    }
    isCardTokenFlow =
      typeof cardKey === 'string' && cardKey.length > 0 &&
      typeof cardToken === 'string' && cardToken.length > 0;
    const isPrimeFlow = !isCardTokenFlow;

    if (!isCardTokenFlow && !isPrimeFlow) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '缺少 prime 或 card_key/card_token',
          debug: { receivedData: { ...data, prime: undefined, card_key: undefined, card_token: undefined } }
        }), 
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
    if (!data.amount) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '缺少 amount',
          debug: { receivedData: { ...data, prime: undefined } }
        }), 
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const partnerKey = Deno.env.get('TAPPAY_PARTNER_KEY');
    const merchantId = Deno.env.get('TAPPAY_MERCHANT_ID');

    if (!partnerKey || !merchantId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: '缺少 TapPay 配置資訊'
        }), 
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    let tapPayUrl = '';
    let tapPayData: any = {};
    if (isCardTokenFlow) {
      // pay-by-card-token 流程
      tapPayUrl = 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-token';
      tapPayData = {
        card_key: cardKey,
        card_token: cardToken,
        partner_key: partnerKey,
        merchant_id: merchantId,
        amount: data.amount,
        currency: data.currency || 'TWD',
        details: 'eSIM Payment',
        remember: true,
        cardholder: data.cardholder || {
          phone_number: '+886900000000',
          name: 'Test User',
          email: 'test@example.com'
        },
        order_number: data.order_number || `ESIM_${Date.now()}`
      };
    } else {
      // pay-by-prime 流程
      tapPayUrl = 'https://sandbox.tappaysdk.com/tpc/payment/pay-by-prime';
      tapPayData = {
      prime: data.prime,
      partner_key: partnerKey,
      merchant_id: merchantId,
      amount: data.amount,
      currency: data.currency || 'TWD',
      details: 'eSIM Payment',
        cardholder: data.cardholder || {
        phone_number: '+886900000000',
        name: 'Test User',
        email: 'test@example.com'
        }
    };
    }

    console.log('準備發送到 TapPay 的數據:', {
      ...tapPayData,
      prime: tapPayData.prime ? '***' : undefined,
      card_key: tapPayData.card_key ? '***' : undefined,
      card_token: tapPayData.card_token ? '***' : undefined,
      partner_key: '***',
      merchant_id: '***'
    });

    // 發送請求到 TapPay
    const tapPayHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': partnerKey
    };
    const tapPayResponse = await fetch(tapPayUrl, {
      method: 'POST',
      headers: tapPayHeaders,
      body: JSON.stringify(tapPayData)
    });

    // 取得 TapPay 原始回應
    const rawText = await tapPayResponse.text();
    console.log('TapPay 原始回應:', tapPayResponse.status, rawText);

    let tapPayResult = {};
    try {
      tapPayResult = JSON.parse(rawText);
    } catch (e) {
      tapPayResult = { raw: rawText };
    }

    if (tapPayResult.status === 0) {
      // 付款成功，根據 isTopUp 決定下單流程
      try {
        const { package_id, user_id, isTopUp, iccid, sell_price, discount_code, discount_rate, description } = data;
        if (!package_id || !user_id) {
          return new Response(JSON.stringify({ success: false, error: '缺少 package_id 或 user_id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (isTopUp && iccid) {
          // 加購流程，呼叫 airalo-topup-order function
          const topupPayload = {
            package_id,
            iccid,
            user_id,
            description: description || `Top up order (user_id:${user_id})`,
            sell_price,
            discount_code: discount_code || null,
            discount_rate: discount_rate || null,
            carrier: data.carrier,
            country: data.country,
            buyer_email: data.cardholder?.email || data.buyer_email || ''
          };
          const topupRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/airalo-topup-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') },
            body: JSON.stringify(topupPayload)
          });
          const topupResult = await topupRes.json();
          if (!topupResult.success) {
            throw new Error(topupResult.error || 'Top up 下單失敗');
          }
          // 直接回傳 top up 下單結果，不處理發票
          return new Response(JSON.stringify({
            success: true,
            message: '支付與加購下單成功',
            transaction_id: tapPayResult.rec_trade_id,
            esim: topupResult.esim
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // 主方案流程（原本的 submitAiraloOrder）
        // 組 description
        const description = `user_id:${user_id}`;
        const airaloOrder = await submitAiraloOrder({ package_id, quantity: 1, description, brand_settings_name: 'CANET' });
        // 取得 eSIM 資訊
        const esimData = airaloOrder.data;
        // 寫入資料庫
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        // 寫入 esim_orders
        const sellPrice = Math.round(Number(data.sell_price || esimData.sell_price || esimData.price));
        const orderData = {
          user_id,
          order_id: esimData.id,
          order_code: esimData.code,
          package_id: esimData.package_id,
          package_name: esimData.package,
          data: esimData.data,
          validity: esimData.validity,
          price: sellPrice,
          sell_price: sellPrice,
          discount_code: data.discount_code || null,
          discount_rate: data.discount_rate || null,
          currency: esimData.currency,
          description: esimData.description,
          type: esimData.type,
          esim_type: esimData.esim_type,
          created_at: esimData.created_at,
          manual_installation: esimData.manual_installation,
          qrcode_installation: esimData.qrcode_installation,
          installation_guides: esimData.installation_guides,
          brand_settings_name: esimData.brand_settings_name,
          raw_response: airaloOrder
        };
        console.log('準備寫入 esim_orders:', orderData);
        const orderRes = await supabase.from('esim_orders').insert([orderData]).select().single();
        console.log('esim_orders insert 結果:', orderRes);
        // 寫入 esim_order_detail
        const sim = esimData.sims?.[0] || {};
        const detailData = {
          order_id: esimData.id,
          sim_id: sim.id,
          iccid: sim.iccid,
          lpa: sim.lpa,
          matching_id: sim.matching_id,
          qrcode: sim.qrcode,
          qrcode_url: sim.qrcode_url,
          direct_apple_installation_url: sim.direct_apple_installation_url,
          apn_type: sim.apn_type,
          apn_value: sim.apn_value,
          is_roaming: sim.is_roaming,
          confirmation_code: sim.confirmation_code,
          created_at: sim.created_at
        };
        console.log('準備寫入 esim_order_detail:', detailData);
        const detailRes = await supabase.from('esim_order_detail').insert([detailData]);
        console.log('esim_order_detail insert 結果:', detailRes);
        // 過濾敏感欄位
        const safeEsim = { ...esimData };
        delete safeEsim.price;
        delete safeEsim.net_price;
        // 組裝發票資料
        console.log('DEBUG carrier input:', data.carrier);
        console.log('carrier regex test (手機條碼):', /^\/[A-Z0-9.+\-]{7}$/.test(data.carrier));
        console.log('carrier regex test (自然人憑證):', /^[A-Z]{2}[0-9]{14}$/.test(data.carrier));
        let carrierField;
        if (data.carrier && /^\/[A-Z0-9.+\-]{7}$/.test(data.carrier)) {
          // 手機條碼載具
          carrierField = { type: 1, number: data.carrier };
        } else if (data.carrier && /^[A-Z]{2}[0-9]{14}$/.test(data.carrier)) {
          // 自然人憑證載具
          carrierField = { type: 2, number: data.carrier };
        } else {
          // 會員載具
          carrierField = { type: 0 };
        }
        const invoicePayload = {
          partner_key: Deno.env.get('TAPPAY_PARTNER_KEY'),
          order_number: orderData.order_id,
          order_date: new Date().toISOString().slice(0,10).replace(/-/g, ''),
          seller_name: '森聯科技有限公司',
          seller_identifier: Deno.env.get('SELLER_IDENTIFIER'),
          buyer_email: data.cardholder?.email || data.buyer_email,
          currency: 'TWD',
          invoice_type: 1,
          sales_amount: orderData.sell_price,
          zero_tax_sales_amount: 0,
          free_tax_sales_amount: 0,
          tax_amount: 0,
          total_amount: orderData.sell_price,
          details: [
            {
              sequence_id: '001',
              sub_amount: orderData.sell_price,
              unit_price: orderData.sell_price,
              quantity: 1,
              description: (data.country || '') + '-' + (data.package_id || ''),
              tax_type: 1
            }
          ],
          notify_url: Deno.env.get('INVOICE_NOTIFY_URL'),
          carrier: carrierField,
          issue_notify_email: 'AUTO'
        };
        console.log('送出開立發票 payload:', invoicePayload);
        const invoiceRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/issue-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') },
          body: JSON.stringify(invoicePayload)
        });
        const invoiceResult = await invoiceRes.json();
        console.log('開立發票結果:', invoiceResult);
        return new Response(JSON.stringify({
          success: true,// 組裝發票資料
          message: '支付與下單成功',
          transaction_id: tapPayResult.rec_trade_id,
          esim: safeEsim
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        }
      } catch (err) {
        // Airalo 下單失敗，記錄錯誤並回傳
        console.error('Airalo 下單失敗:', err);
        return new Response(JSON.stringify({ success: false, error: 'Airalo 下單失敗', detail: String(err) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // 直接回傳 TapPay 的完整錯誤內容與原始回應
      return new Response(
        JSON.stringify({
          success: false,
          error: tapPayResult.msg || '支付處理失敗',
          tappay: tapPayResult,
          rawText,
          status: tapPayResponse.status,
          timestamp: new Date().toISOString()
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  } catch (error) {
    let tappayError = '';
    if (error && error.response) {
      try {
        const data = await error.response.json();
        tappayError = data.msg || JSON.stringify(data);
      } catch (e) {}
    }
    // 嘗試從 error 物件本身取出 msg
    if (!tappayError && error && error.msg) {
      tappayError = error.msg;
    }
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || '支付處理失敗',
        tappayError,
        timestamp: new Date().toISOString()
      }), 
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});