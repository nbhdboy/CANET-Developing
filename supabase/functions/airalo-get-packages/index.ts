import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 取得查詢參數 country_code
    const url = new URL(req.url);
    const countryCodeParam = url.searchParams.get('country_code');
    const countryCodeQuery = countryCodeParam ? `eq.${countryCodeParam}` : undefined;

    // 只查詢 DB，回傳細分專案給前端
    // 只回傳 country_code, operator, data, day, sell_price
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      let dbUrl = `${SUPABASE_URL}/rest/v1/esim_packages?select=package_id,country_code,operator,data,day,sell_price`;
      if (countryCodeQuery) {
        dbUrl += `&country_code=${countryCodeQuery}`;
      }
      // 第一次查詢 DB
      let dbRes = await fetch(dbUrl, {
        method: "GET",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json"
        }
      });
      let dbData = await dbRes.json();
      console.log(`[airalo-get-packages] 第一次查詢 DB，資料筆數: ${Array.isArray(dbData) ? dbData.length : '非陣列'}`);
      // 如果查到空陣列，觸發 airalo-sync-packages function
      if (Array.isArray(dbData) && dbData.length === 0) {
        console.log('[airalo-get-packages] 查無資料，觸發 airalo-sync-packages function 進行自動補資料');
        // 呼叫同步 function
        const syncRes = await fetch(`${SUPABASE_URL.replace(/\/rest\/v1$/, '')}/functions/v1/airalo-sync-packages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "apikey": SERVICE_ROLE_KEY
          }
        });
        console.log(`[airalo-get-packages] airalo-sync-packages function 呼叫結果 status: ${syncRes.status}`);
        // 同步完再查一次 DB
        dbRes = await fetch(dbUrl, {
          method: "GET",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json"
          }
        });
        dbData = await dbRes.json();
        console.log(`[airalo-get-packages] 同步後再次查詢 DB，資料筆數: ${Array.isArray(dbData) ? dbData.length : '非陣列'}`);
      }
      return new Response(JSON.stringify(dbData), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } else {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
  } catch (error) {
    // 若 error.message 包含 Unauthenticated，回傳 401
    if (error.message && error.message.includes("Unauthenticated")) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}); 