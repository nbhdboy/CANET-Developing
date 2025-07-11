import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/cors.ts";

function decodeJwt(token: string) {
  // 基本 JWT decode，不驗證簽章
  const payload = token.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    console.error("[line-get-user-profile] 缺少 Supabase 環境變數");
    return new Response(JSON.stringify({ error: "Missing Supabase env" }), { status: 500, headers: corsHeaders });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  let idToken: string | undefined;
  try {
    const { id_token } = await req.json();
    idToken = id_token;
    console.log("[line-get-user-profile] 收到 id_token:", idToken);
  } catch {
    console.error("[line-get-user-profile] 缺少 id_token");
    return new Response(JSON.stringify({ error: "Missing id_token" }), { status: 400, headers: corsHeaders });
  }
  if (!idToken) {
    console.error("[line-get-user-profile] id_token 為空");
    return new Response(JSON.stringify({ error: "Missing id_token" }), { status: 400, headers: corsHeaders });
  }

  let decoded;
  try {
    decoded = decodeJwt(idToken);
    console.log("[line-get-user-profile] 解碼後 payload:", decoded);
  } catch {
    console.error("[line-get-user-profile] id_token 解碼失敗");
    return new Response(JSON.stringify({ error: "Invalid id_token" }), { status: 400, headers: corsHeaders });
  }

  const line_user_id = decoded.sub;
  const name = decoded.name;
  const picture = decoded.picture;

  if (!line_user_id) {
    console.error("[line-get-user-profile] id_token 無 sub 欄位");
    return new Response(JSON.stringify({ error: "No sub in id_token" }), { status: 400, headers: corsHeaders });
  }

  // 檢查 user_cards 是否已存在該 line_user_id
  const { data: existing, error: selectError } = await supabase
    .from("user_cards")
    .select("id")
    .eq("line_user_id", line_user_id)
    .maybeSingle();
  console.log("[line-get-user-profile] 查詢 user_cards 結果:", existing, selectError);

  if (!existing) {
    // 新增 user_cards 記錄
    const { error: insertError } = await supabase
      .from("user_cards")
      .insert({ line_user_id });
    if (insertError) {
      console.error("[line-get-user-profile] 新增 user_cards 失敗:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
    }
    console.log("[line-get-user-profile] 新增 user_cards 成功");
  }

  console.log("[line-get-user-profile] 回傳資料:", { name, picture });
  return new Response(JSON.stringify({ name, picture }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}); 