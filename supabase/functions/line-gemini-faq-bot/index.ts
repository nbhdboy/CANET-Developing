import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as b64encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// 內建 TextEncoder 取代 encoding/utf8.ts
const encodeToUint8Array = (str: string) => new TextEncoder().encode(str);

// HMAC-SHA256 驗證簽名（修正版，使用標準 base64）
async function verifyLineSignature(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encodeToUint8Array(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encodeToUint8Array(body)
  );
  const computedSignature = b64encode(new Uint8Array(sig));
  return computedSignature === signature;
}

// FAQ 內容中英文對照
const faqs: Array<{ question_zh: string; answer_zh: string; question_en: string; answer_en: string; flexible?: boolean }> = [
  { question_zh: "可以撥打電話或傳簡訊嗎？", answer_zh: "目前我們的 eSIM 服務不支援撥打和接收電話及簡訊。但您仍然可以使用 iMessage。", question_en: "Can I make calls or send SMS?", answer_en: "Our eSIM service does not support making or receiving calls and SMS. However, you can still use iMessage." },
  { question_zh: "會有額外費用嗎？", answer_zh: "使用 CANET eSIM 不會產生任何額外費用。顯示的價格即為最終價格。", question_en: "Are there any extra fees?", answer_en: "There are no extra fees for using CANET eSIM. The displayed price is the final price." },
  { question_zh: "如何查看目前的數據用量？", answer_zh: "當您的數據即將用完時，我們會透過 LINE 官方帳號通知您。您也可以在 Mini app 的「我的 eSIM」中查看目前用量，並隨時進行充值。", question_en: "How can I check my current data usage?", answer_en: "When your data is about to run out, we will notify you via the official LINE account. You can also check your current usage in the Mini app under 'My eSIM' and top up anytime." },
  { question_zh: "無法連線到網路該怎麼辦？", answer_zh: "1. 進入「設定」→「行動網路」→ 檢查已啟用的號碼是否顯示，如有則關閉後重新開啟。\n2.「行動網路」→「eSIM」→ 檢查數據漫遊是否已開啟。\n3. 檢查 APN 設定是否正確，如不正確請手動修改。您可以在「我的 eSIM」→「eSIM 詳情」中找到正確設定。\n4. 在「電信業者選擇」中，關閉自動選擇並手動選擇支援的網路。\n5. 重設網路設定：「設定」>「一般」>「傳輸或重設 iPhone」>「重設網路設定」。\n6. 重新啟動裝置。", question_en: "What should I do if I can't connect to the network?", answer_en: "1. Go to 'Settings' → 'Cellular' → Check if the enabled number is displayed. If so, turn it off and on again.\n2. 'Cellular' → 'eSIM' → Check if data roaming is enabled.\n3. Check if the APN settings are correct. If not, please modify them manually. You can find the correct settings in 'My eSIM' → 'eSIM Details'.\n4. In 'Carrier Selection', turn off auto-select and manually select a supported network.\n5. Reset network settings: 'Settings' > 'General' > 'Transfer or Reset iPhone' > 'Reset Network Settings'.\n6. Restart your device." },
  { question_zh: "可以開啟熱點分享嗎？", answer_zh: "是的，您可以使用熱點分享功能。但請注意，開啟熱點分享會增加數據用量。", question_en: "Can I enable hotspot sharing?", answer_en: "Yes, you can use the hotspot sharing feature. Please note that enabling hotspot will increase data usage." },
  { question_zh: "為什麼我的裝置顯示不支援 eSIM？", answer_zh: "請確認您的裝置型號是否支援 eSIM。您可以在裝置的「設定」→「一般」→「關於本機」中查看是否有 eSIM 相關資訊。", question_en: "Why does my device show that eSIM is not supported?", answer_en: "Please check if your device model supports eSIM. You can check for eSIM information in 'Settings' → 'General' → 'About'." },
  { question_zh: "數據用完了怎麼辦？", answer_zh: "您可以在 Mini app 中購買數據充值包。我們提供多種容量選擇，價格合理且即買即用。", question_en: "What should I do if I run out of data?", answer_en: "You can purchase a data top-up package in the Mini app. We offer various capacities at reasonable prices, available for immediate use." },
  { question_zh: "可以同時使用多張 eSIM 嗎？", answer_zh: "是的，但需要您的裝置支援多張 eSIM 同時啟用。請注意，同時啟用多張 eSIM 可能會增加耗電量。", question_en: "Can I use multiple eSIMs at the same time?", answer_en: "Yes, but your device must support multiple eSIMs being enabled simultaneously. Please note that enabling multiple eSIMs may increase power consumption." },
  { question_zh: "如何查看數據用量？", answer_zh: "您可以在「設定」→「行動網路」→「數據用量」中查看，或在我們的 Mini app 中查看詳細用量統計。", question_en: "How do I check data usage?", answer_en: "You can check in 'Settings' → 'Cellular' → 'Data Usage', or view detailed usage statistics in our Mini app." },
  { question_zh: "安裝 eSIM 時遇到問題怎麼辦？", answer_zh: "請確保您的裝置已連接到網路，並按照安裝指南的步驟操作。", question_en: "What should I do if I encounter problems installing eSIM?", answer_en: "Please make sure your device is connected to the internet and follow the installation guide steps." },
  { question_zh: "出國換SIM卡我的LINE和其他東西會不見嗎？", answer_zh: "更換實體SIM卡或使用eSIM，都不影響您手機裡的應用程式。換SIM卡只是變更如何連接網路，不會改動手機的其他功能哦！", question_en: "Will I lose my LINE or other apps if I change my SIM card when going abroad?", answer_en: "Changing your physical SIM card or using an eSIM will not affect the apps on your phone. Switching SIM cards only changes how you connect to the internet and does not alter other functions of your device." },
  { question_zh: "1GB夠用嗎？", answer_zh: "一般情況下，通訊軟體或瀏覽網頁的平均數據使用量約為1GB。若您計劃玩遊戲或直播，建議購買更大流量的方案，以避免流量不足。", question_en: "Is 1GB of data enough?", answer_en: "On average, 1GB of data is enough for messaging apps or browsing the web. If you plan to play games or stream videos, we recommend purchasing a larger data plan to avoid running out of data." },
  { question_zh: "什麼是FUP公平流量使用原則？", answer_zh: "公平使用原則（FUP）是為了確保所有用戶都能公平使用網路服務。如果短時間內大量使用流量，可能會被暫時限速或暫停服務。", question_en: "What is the Fair Usage Policy (FUP)?", answer_en: "The Fair Usage Policy (FUP) ensures that all users can use network services fairly. If you use a large amount of data in a short period, your speed may be temporarily reduced or your service may be suspended." },
  { question_zh: "原生線路是什麼？", answer_zh: "原生線路是直接從當地電信商購買的SIM卡產品，通常比漫遊SIM卡更穩定，無需開啟漫遊功能。", question_en: "What is a native line?", answer_en: "A native line refers to a SIM card product purchased directly from a local carrier, usually offering more stable connections than roaming SIM cards and not requiring roaming to be enabled." },
  { question_zh: "LTE和4G訊號的區別？", answer_zh: "LTE是4G網路技術的標準之一，常被稱為4G LTE，提供比3G更快的數據傳輸速度。", question_en: "What is the difference between LTE and 4G?", answer_en: "LTE is a standard for 4G networks, often called 4G LTE, and provides faster data speeds than 3G." },
  { question_zh: "APP、應用程式是否有使用受限？", answer_zh: "因網路連接基於原生或漫遊線路，部分應用程式可能因IP位置或服務範圍限制而功能異常。", question_en: "Are there any restrictions on using apps?", answer_en: "Some apps may have limited functionality due to network connection type or IP location restrictions." },
  { question_zh: "eSIM安裝後未啟用，抵達目的地才會啟用？", answer_zh: "eSIM安裝後若顯示「正在啟用」或「啟用失敗」，通常抵達目的地並進入網路涵蓋區域後會自動完成啟用。", question_en: "My eSIM is not activated after installation. Will it activate when I arrive at my destination?", answer_en: "If your eSIM shows 'activating' or 'activation failed' after installation, it will usually activate automatically once you arrive at your destination and enter a network coverage area." },
  { question_zh: "如何在 Google Pixel 裝置上使用 CANET eSIM 存取網路？", answer_zh: "請依照 CANET 應用程式內的指示安裝 eSIM，並確認已啟用 eSIM、開啟行動數據、正確設定 APN 及數據漫遊。如遇問題，請參考官方教學。", question_en: "How do I use CANET eSIM to access the internet on a Google Pixel device?", answer_en: "Please follow the instructions in the CANET app to install the eSIM, ensure the eSIM is enabled, mobile data is turned on, and APN and data roaming are set correctly. If you encounter issues, refer to the official guide." },
  { question_zh: "刪不掉 Samsung Galaxy S22 上的 CANET eSIM，該怎麼辦？", answer_zh: "部分 S22 因軟體問題無法刪除 eSIM，請先檢查軟體更新，或嘗試移除/新增實體 SIM、重啟裝置、重設網路設定。如仍無法解決，請聯繫 Samsung 或電信商。", question_en: "What should I do if I can't delete the CANET eSIM on my Samsung Galaxy S22?", answer_en: "Some S22 devices have software issues preventing eSIM deletion. Please check for software updates, try removing/inserting a physical SIM, restart the device, or reset network settings. If the issue persists, contact Samsung or your carrier." },
  { question_zh: "出現「無法完成更改行動方案」錯誤訊息怎麼辦？", answer_zh: "請嘗試重新啟動裝置、重設網路設定，或移除後重新安裝 eSIM", question_en: "What should I do if I see the \"Unable to complete cellular plan change\" error?", answer_en: "Try restarting your device, resetting network settings, or removing and reinstalling the eSIM." },
  { question_zh: "如何在 Samsung Galaxy 裝置上使用 CANET eSIM 存取網路？", answer_zh: "請依照 CANET 應用程式內的指示安裝 eSIM，並確認已啟用 eSIM、開啟行動數據、正確設定 APN 及數據漫遊。如遇問題，請參考官方教學。", question_en: "How do I use CANET eSIM to access the internet on a Samsung Galaxy device?", answer_en: "Please follow the instructions in the CANET app to install the eSIM, ensure the eSIM is enabled, mobile data is turned on, and APN and data roaming are set correctly. If you encounter issues, refer to the official guide." },
  { question_zh: "出現「PDP 認證失敗」怎麼辦？", answer_zh: "請檢查 APN 設定是否正確，並嘗試重啟裝置或重設網路設定。", question_en: "What should I do if I see a \"PDP authentication failed\" error?", answer_en: "Please check if your APN settings are correct, and try restarting your device or resetting network settings." },
  { question_zh: "我無法掃描行動條碼怎麼辦？", answer_zh: "若無法掃描條碼，建議您可以在「我的eSIM」-->點擊前往安裝按鈕-->選擇手動安裝，複製SM-DP+ 位址、啟用碼後，依照安裝說明，填入對頁位置，即可使用。", question_en: "What should I do if I can't scan the QR code?", answer_en: "If you can't scan the QR code, we recommend that you go to 'My eSIM' → tap the install button → select manual installation, then copy the SM-DP+ address and activation code, and follow the installation instructions to fill in the corresponding fields. This will allow you to use the eSIM." },
  { question_zh: "我的沒辦法用QR code啟用怎麼辦", answer_zh: "若無法掃描條碼，建議您可以在「我的eSIM」-->點擊前往安裝按鈕-->選擇手動安裝，複製SM-DP+ 位址、啟用碼後，依照安裝說明，填入對頁位置，即可使用。", question_en: "I can't activate with QR code, what should I do?", answer_en: "If you can't scan the QR code, we recommend that you go to 'My eSIM' → tap the install button → select manual installation, then copy the SM-DP+ address and activation code, and follow the installation instructions to fill in the corresponding fields. This will allow you to use the eSIM." },
  { question_zh: "QR code不能用怎麼辦", answer_zh: "若無法掃描條碼，建議您可以在「我的eSIM」-->點擊前往安裝按鈕-->選擇手動安裝，複製SM-DP+ 位址、啟用碼後，依照安裝說明，填入對頁位置，即可使用。", question_en: "QR code not working, what should I do?", answer_en: "If you can't scan the QR code, we recommend that you go to 'My eSIM' → tap the install button → select manual installation, then copy the SM-DP+ address and activation code, and follow the installation instructions to fill in the corresponding fields. This will allow you to use the eSIM." },
  { question_zh: "如果我的裝置鎖定了網路或電信商該怎麼辦？", answer_zh: "若裝置被鎖定，將無法安裝 eSIM。", question_en: "What should I do if my device is locked to a network or carrier?", answer_en: "If your device is locked, you cannot install an eSIM." },
  { question_zh: "出現「此代碼已失效」錯誤怎麼辦？", answer_zh: "請確認輸入的啟用碼正確且未過期。", question_en: "What should I do if I see a \"This code has expired\" error?", answer_en: "Please make sure the activation code is correct and not expired." },
  { question_zh: "如何更改 APN 設定？", answer_zh: "請依照 CANET 應用程式或指示，在裝置的行動網路設定中新增或修改 APN。若不確定設定值，請查詢 eSIM 詳細資料。", question_en: "How do I change my APN settings?", answer_en: "Please follow the instructions in the CANET app to add or modify the APN in your device's mobile network settings. If you are unsure about the values, check your eSIM details." },
  { question_zh: "出現「無法加入此電信業者的行動方案」錯誤訊息怎麼辦？", answer_zh: "請確認裝置支援 eSIM 並已更新至最新系統，嘗試重啟裝置或重設網路設定。", question_en: "What should I do if I see the \"Unable to add this carrier's cellular plan\" error?", answer_en: "Please make sure your device supports eSIM and is updated to the latest system. Try restarting your device or resetting network settings." },
  { question_zh: "購買後，eSIM需要在多久內啟用或安裝？", answer_zh: "請於購買日起90天內完成eSIM的啟用或安裝，以避免eSIM逾期失效。", question_en: "After purchase, how long do I have to activate or install the eSIM?", answer_en: "Please activate or install your eSIM within 90 days from the date of purchase to avoid expiration." },
  { question_zh: "安裝後，eSIM需要在多久內開始使用？", answer_zh: "請於安裝日起90天內開始使用eSIM，以確保您的eSIM不會過期失效。", question_en: "After installation, how long do I have to start using the eSIM?", answer_en: "Please start using your eSIM within 90 days from the installation date to ensure it does not expire." },
  { question_zh: "哪些裝置/手機支援 eSIM？",
    answer_zh: `您可以參考我們的清單，確認您要使用的裝置是否支援 eSIM。 請注意，部分地區特規型號可能不支援 eSIM。

我們會定期更新清單，但無法盡善盡美；如果找不到您的裝置，請與您的製造商確認裝置是否支援 eSIM。

截至 2025 年 2 月為止，支援 eSIM 的裝置如下：

APPLE*
iPhone

iPhone 16
iPhone 16 Plus
iPhone 16 Pro
iPhone 16 Pro Max
iPhone 15
iPhone 15 Plus
iPhone 15 Pro
iPhone 15 Pro Max
iPhone 14
iPhone 14 Plus
iPhone 14 Pro
iPhone 14 Pro Max
iPhone 13
iPhone 13 Mini
iPhone 13 Pro
iPhone 13 Pro
iPhone 13 Pro Max
iPhone 12
iPhone 12 Mini
iPhone 12 Pro
iPhone 12 Pro Max
iPhone 11
iPhone 11 Pro
iPhone 11 Pro Max
iPhone XS
iPhone XS Max
iPhone XR
iPhone SE (2020 和 2022)
iPad

iPad (第 7 代起)
iPad Air (第 3 代起)
iPad Pro 11 吋 (第 1 代起)
iPad Pro 12.9 吋 (第 3 代起)
iPad Mini (第 5 代起)
*以下 Apple 裝置不具備 eSIM 功能：
• 來自中國大陸的iPhone 設備。
• 香港和澳門的 iPhone 裝置 (iPhone 13 Mini、iPhone 12 Mini、iPhone SE 2020 和 iPhone XS 除外)。
*在土耳其購買的 iPhone 和 iPad：
•   如果您在 2020 年 6 月 23 日之後設定裝置，您的 eSIM 將在安裝後啟動——如 eSIM 未啟用，請與您的電信商聯絡。
•   若是在 2020 年 6 月 23 日之前設定的裝置，請按照此連結中的步驟來啟用您的 eSIM。 過程可能會要求您清除裝置資料——請務必事先備份裝置。
*只支援具備 Wi-Fi + 行動服務功能的 iPad 裝置。
SAMSUNG*
Galaxy A55 5G*
Galaxy A54 5G*
Galaxy A35 5G*
Galaxy A23 5G*
Galaxy Z Flip
Galaxy Z Flip 5G
Galaxy Z Flip 3 5G
Galaxy Z Flip 4
Galaxy Z Flip 5
Galaxy Z Flip6
Galaxy Z Fold
Galaxy Z Fold 2 5G
Galaxy Z Fold 3
Galaxy Z Fold 4
Galaxy Z Fold 5
Galaxy Z Fold 6
Galaxy Note 20
Galaxy Note 20 5G
Galaxy Note 20 Ultra
Galaxy Note 20 Ultra 5G
Galaxy S20
Galaxy S20 5G
Galaxy S20+
Galaxy S20+ 5G
Galaxy S20 Ultra
Galaxy S20 Ultra 5G
Galaxy S21 5G
Galaxy S21+ 5G
Galaxy S21 Ultra 5G
Galaxy S22 5G
Galaxy S22+ 5G
Galaxy S22 Ultra 5G
Galaxy S23
Galaxy S23 5G
Galaxy S23 FE
Galaxy S23+
Galaxy S23 Ultra
Galaxy S24
Galaxy S24+
Galaxy S24 Ultra
Galaxy S24 FE
Galaxy S25
Galaxy S25 Edge
Galaxy S25+
Galaxy S25 Slim
Galaxy S25 Ultra
Galaxy Fold
*以下 Samsung Galaxy 裝置不具備 eSIM 功能：
• 來自中國、香港和台灣的所有 Galaxy 裝置。
‧    所有 Galaxy FE「Fan Edition」型號，Galaxy S23 FE 和 S24 FE 除外。
• 美國型號的 Galaxy S20、S21*和 Note 20 Ultra。
*除了 Galaxy S24、S23、Z Fold 5、Z Fold 4、Z Flip 5、Z Flip 4 和 A54 5G 型號外，在南韓購買的大多數 Samsung Galaxy 裝置都不支援 eSIM。
GOOGLE PIXEL
Pixel 9
Pixel 9a
Pixel 9 Pro
Pixel 9 Pro XL
Pixel 9 Pro Fold
Pixel 8
Pixel 8a
Pixel 8 Pro
Pixel 7
Pixel 7a
Pixel 7 Pro
Pixel 6
Pixel 6a
Pixel 6 Pro
Pixel 5
Pixel 5a
Pixel 5a 5G
Pixel 4
Pixel 4a
Pixel 4a 5G
Pixel 4 XL
Pixel 3
Pixel 3a
Pixel 3 XL
Pixel 3a XL
Pixel 2
Pixel 2 XL
Pixel Fold
*以下 Google Pixel 裝置「不」具備 eSIM 功能：     
• 來自澳洲、台灣和日本的 Pixel 3 型號，以及透過 Sprint 和 Google Fi 以外的美國或加拿大業者提供服務購買的型號。          
• 在東南亞購買並使用 Verizon 服務的 Pixel 3a 型號。
HAMMER*
Explorer PRO
Blade 3
Blade 5G
myPhone NOW eSIM
myPhone Hammer Construction
*eSIM 支援僅限特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 Hammer 裝置是否具備 eSIM 功能。
HONOR*
HONOR 90
HONOR 200
HONOR 200 Pro
Magic7 Pro
Magic6 Pro
Magic6 Pro RSR
Magic Vs3
Magic V2
Magic V3
Magic5 Pro
Magic4 Pro
*eSIM 支援僅限特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 Honor 裝置是否具備 eSIM 功能。
HUAWEI
P40 
P40 Pro*
Mate 40 Pro
*下列華為設備不具備 eSIM 功能：
•    Huawei P40 Pro+          
• 在中國購買的所有華為設備均不支援 eSIM。
MOTOROLA*
Moto G34
Moto G35
Moto G53
Moto G54
Moto G54 Power
Moto G55
Moto G75
Moto G85
Moto G (2024)
Moto G Power (2024)
Moto G Stylus 5G
Edge Fusion
Edge 50 
Edge 50 Fusion
Edge 50 Pro
Edge 50 Neo
Edge 50 Ultra
Edge 40 Neo
Edge 40 Pro
Edge+
Edge+ (2023)
Edge (2024)
Edge (2023)
Edge (2022)
Razr 40
Razr 40 Ultra
Razr 50
Razr 50 Ultra
Razr 2024
Razr+ 2024
Razr 2022
Razr 2019
Razr 5G
ThinkPhone 25
*eSIM 支援僅限特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 Motorola 裝置是否具備 eSIM 功能。
NOKIA*
G60
XR21
X30
*能否使用 eSIM 需視國家/地區和電信商而定。 請聯絡您的電信商或裝置製造商，以確認您的 Nokia 裝置是否具備 eSIM 功能。
ONEPLUS*
OnePlus 13
OnePlus 12
OnePlus 11
OnePlus Open
*eSIM 支援僅限特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 OnePlus 裝置是否具備 eSIM 功能。
OPPO*
Find N2 Flip
Find X5
Find X5 Pro
Find X8 Pro
Find X8
Find X3 Pro
Find X3
*eSIM 支援僅限日本和特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 Oppo 裝置是否具備 eSIM 功能。
RAKUTEN*
Rakuten Big
Rakuten Big S
Rakuten Mini
Rakuten Hand
Rakuten Hand 5G
*eSIM 支援僅限日本和特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 Rakuten 裝置是否具備 eSIM 功能。
SHARP*
AQUOS sense9
AQUOS sense8
AQUOS sense7
AQUOS sense7 plus
AQUOS R9 Pro
AQUOS R9 
AQUOS R8 pro
AQUOS R8
AQUOS R8s pro
AQUOS wish
AQUOS zero6
**eSIM 支援僅限日本和特定地區。 請聯絡您的電信商或裝置製造商，以確認您的 Sharp 裝置是否具備 eSIM 功能。
SONY*
Xperia 1 IV
Xperia 1 V
Xperia 1 VI
Xperia 5 IV
Xperia 5 V
Xperia 10 III Lite
Xperia 10 IV*
Xperia 10 V
Xperia 10 VI
*能否使用 eSIM 需視國家/地區和電信商而定。 請聯絡您的電信商或裝置製造商，以確認您的 Xperia 裝置是否具備 eSIM 功能。
*Sony Xperia 10 IV eSIM 支援僅限歐洲地區。 請聯絡您的電信商或裝置製造商，以確認您的 Sony Xperia 10 IV 裝置是否具備 eSIM 功能。
 

TCL*
50 5G
50 NxtPaper
50 Pro NxtPaper
40 XL
*能否使用 eSIM 需視國家/地區和電信商而定。 請聯絡您的電信商或裝置製造商，以確認您的 Xperia 裝置是否具備 eSIM 功能。
 
T-Mobile*
Revvl 7
Revvl 7 Pro
*能否使用 eSIM 需視國家/地區和電信商而定。 請聯絡您的電信商或裝置製造商，以確認您的 Xperia 裝置是否具備 eSIM 功能。
VIVO*
X200 Pro
X200
X100 Pro
X90 Pro*
V29 (Europe and Latin America)*
V29 Lite 5G (Europe)*
V40
V40 Lite (Europe)*
V50
*能否使用 eSIM 需視國家/地區和電信商而定。 請聯絡您的電信商或裝置製造商，以確認您的 vivo 裝置是否具備 eSIM 功能。
XIAOMI*
Xiaomi 15
Xiaomi 14
Xiaomi 14 Pro
Xiaomi 14T
Xiaomi 14T Pro
Xiaomi 13
Xiaomi 13 Pro
Xiaomi 13T
Xiaomi 13T Pro
Xiaomi 13 Lite
Xiaomi 12T Pro
Redmi Note 14 Pro
Redmi Note 14 Pro 5G
Redmi Note 14 Pro+
Redmi Note 14 Pro+ 5G
Redmi Note 13 Pro
Redmi Note 13 Pro+
Redmi Note 11 Pro 5G*
*能否使用 eSIM 需視國家/地區和電信商而定。 請聯絡您的電信商或裝置製造商，以確認您的裝置是否具備 eSIM 功能。
其他的*
Nuu Mobile X5
Gemini PDA 4G+Wi-Fi
Fairphone 4
Fairphone 5
Realme 14 Pro+
ASUS Zenfone 12 Ultra
ZTE nubia Flip2
*Surface：任何 AT&T 鎖定裝置將不支援 eSIM。 若您的裝置是透過另一家電信商購買的，該電信商可能已停用 Surface Duo 中的 eSIM 功能。
WINDOWS 10*/ WINDOWS 11 筆記型電腦
ACER

Acer Swift 3
Acer Swift 7
Acer TravelMate P2
Acer TravelMate Spin P4
Acer TravelMate P6
ASUS
ASUS Mini Transformer T103HAF
ASUS NovaGo TP370QL
ASUS Vivobook Flip 14 TP401NA
DELL
Dell Latitude 7440
Dell Latitude 7210 2-in-1
Dell Latitude 9410
Dell Latitude 7310
Dell Latitude 7410
Dell Latitude 9510
Dell Latitude 5410
Dell Latitude 5411
Dell Latitude 5511
HP
HP Elitebook G5
HP Probook G5
HP Zbook G5
HP Spectre Folio 13
LENOVO
ThinkPad X1 Titanium Yoga 2 in 1
ThinkPad X1 Carbon Gen 9
ThinkPad X1 Fold
ThinkPad X1 Nano
ThinkPad X12 Detachable
Lenovo Flex 5G
Lenovo Yoga C630
Lenovo Miix 630
Lenovo Yoga 520
Lenovo Yoga 720 (2-in-1 models)
SURFACE*
Surface Pro 9
Surface Go 3
Surface Pro X
Surface Duo 2
Surface Duo
*Windows 10：您的 PC 至少要有 Windows 10 1703 以上版本，才能使用 eSIM。 裝置也需具備 LTE 功能。
*Surface：任何 AT&T 鎖定裝置將不支援 eSIM。 若您的裝置是透過另一家電信商購買的，該電信商可能已停用 Surface Duo 中的 eSIM 功能。 實際情形請洽詢電信商。`,
    question_en: "Which devices/phones support eSIM?",
    answer_en: `You can refer to our list to check if your device supports eSIM. Please note that some region-specific models may not support eSIM.

We update the list regularly, but it may not be exhaustive. If you cannot find your device, please check with your manufacturer to confirm eSIM support.

As of February 2025, the following devices support eSIM:

APPLE*
iPhone

iPhone 16
iPhone 16 Plus
iPhone 16 Pro
iPhone 16 Pro Max
iPhone 15
iPhone 15 Plus
iPhone 15 Pro
iPhone 15 Pro Max
iPhone 14
iPhone 14 Plus
iPhone 14 Pro
iPhone 14 Pro Max
iPhone 13
iPhone 13 Mini
iPhone 13 Pro
iPhone 13 Pro
iPhone 13 Pro Max
iPhone 12
iPhone 12 Mini
iPhone 12 Pro
iPhone 12 Pro Max
iPhone 11
iPhone 11 Pro
iPhone 11 Pro Max
iPhone XS
iPhone XS Max
iPhone XR
iPhone SE (2020 and 2022)
iPad

iPad (7th generation and later)
iPad Air (3rd generation and later)
iPad Pro 11-inch (1st generation and later)
iPad Pro 12.9-inch (3rd generation and later)
iPad Mini (5th generation and later)
*The following Apple devices do NOT support eSIM:
• iPhone devices from mainland China.
• iPhone devices from Hong Kong and Macau (except iPhone 13 Mini, iPhone 12 Mini, iPhone SE 2020, and iPhone XS).
*For iPhones and iPads purchased in Turkey:
•   If you set up your device after June 23, 2020, your eSIM will activate after installation—if not, please contact your carrier.
•   If you set up your device before June 23, 2020, please follow the steps in this link to activate your eSIM. The process may require you to erase your device—please back up your data first.
*Only iPad models with Wi-Fi + Cellular support eSIM.
SAMSUNG*
Galaxy A55 5G*
Galaxy A54 5G*
Galaxy A35 5G*
Galaxy A23 5G*
Galaxy Z Flip
Galaxy Z Flip 5G
Galaxy Z Flip 3 5G
Galaxy Z Flip 4
Galaxy Z Flip 5
Galaxy Z Flip6
Galaxy Z Fold
Galaxy Z Fold 2 5G
Galaxy Z Fold 3
Galaxy Z Fold 4
Galaxy Z Fold 5
Galaxy Z Fold 6
Galaxy Note 20
Galaxy Note 20 5G
Galaxy Note 20 Ultra
Galaxy Note 20 Ultra 5G
Galaxy S20
Galaxy S20 5G
Galaxy S20+
Galaxy S20+ 5G
Galaxy S20 Ultra
Galaxy S20 Ultra 5G
Galaxy S21 5G
Galaxy S21+ 5G
Galaxy S21 Ultra 5G
Galaxy S22 5G
Galaxy S22+ 5G
Galaxy S22 Ultra 5G
Galaxy S23
Galaxy S23 5G
Galaxy S23 FE
Galaxy S23+
Galaxy S23 Ultra
Galaxy S24
Galaxy S24+
Galaxy S24 Ultra
Galaxy S24 FE
Galaxy S25
Galaxy S25 Edge
Galaxy S25+
Galaxy S25 Slim
Galaxy S25 Ultra
Galaxy Fold
*The following Samsung Galaxy devices do NOT support eSIM:
• All Galaxy devices from China, Hong Kong, and Taiwan.
‧    All Galaxy FE "Fan Edition" models, except Galaxy S23 FE and S24 FE.
• US models of Galaxy S20, S21*, and Note 20 Ultra.
*Except for Galaxy S24, S23, Z Fold 5, Z Fold 4, Z Flip 5, Z Flip 4, and A54 5G, most Samsung Galaxy devices purchased in South Korea do not support eSIM.
GOOGLE PIXEL
Pixel 9
Pixel 9a
Pixel 9 Pro
Pixel 9 Pro XL
Pixel 9 Pro Fold
Pixel 8
Pixel 8a
Pixel 8 Pro
Pixel 7
Pixel 7a
Pixel 7 Pro
Pixel 6
Pixel 6a
Pixel 6 Pro
Pixel 5
Pixel 5a
Pixel 5a 5G
Pixel 4
Pixel 4a
Pixel 4a 5G
Pixel 4 XL
Pixel 3
Pixel 3a
Pixel 3 XL
Pixel 3a XL
Pixel 2
Pixel 2 XL
Pixel Fold
*The following Google Pixel devices do NOT support eSIM:     
• Pixel 3 models from Australia, Taiwan, and Japan, and those purchased from US or Canadian carriers other than Sprint and Google Fi.          
• Pixel 3a models purchased in Southeast Asia and used with Verizon service.
HAMMER*
Explorer PRO
Blade 3
Blade 5G
myPhone NOW eSIM
myPhone Hammer Construction
*eSIM support is limited to certain regions. Please check with your carrier or device manufacturer to confirm if your Hammer device supports eSIM.
HONOR*
HONOR 90
HONOR 200
HONOR 200 Pro
Magic7 Pro
Magic6 Pro
Magic6 Pro RSR
Magic Vs3
Magic V2
Magic V3
Magic5 Pro
Magic4 Pro
*eSIM support is limited to certain regions. Please check with your carrier or device manufacturer to confirm if your Honor device supports eSIM.
HUAWEI
P40 
P40 Pro*
Mate 40 Pro
*The following Huawei devices do NOT support eSIM:
•    Huawei P40 Pro+          
• All Huawei devices purchased in China do not support eSIM.
MOTOROLA*
Moto G34
Moto G35
Moto G53
Moto G54
Moto G54 Power
Moto G55
Moto G75
Moto G85
Moto G (2024)
Moto G Power (2024)
Moto G Stylus 5G
Edge Fusion
Edge 50 
Edge 50 Fusion
Edge 50 Pro
Edge 50 Neo
Edge 50 Ultra
Edge 40 Neo
Edge 40 Pro
Edge+
Edge+ (2023)
Edge (2024)
Edge (2023)
Edge (2022)
Razr 40
Razr 40 Ultra
Razr 50
Razr 50 Ultra
Razr 2024
Razr+ 2024
Razr 2022
Razr 2019
Razr 5G
ThinkPhone 25
*eSIM support is limited to certain regions. Please check with your carrier or device manufacturer to confirm if your Motorola device supports eSIM.
NOKIA*
G60
XR21
X30
*eSIM support depends on country/region and carrier. Please check with your carrier or device manufacturer to confirm if your Nokia device supports eSIM.
ONEPLUS*
OnePlus 13
OnePlus 12
OnePlus 11
OnePlus Open
*eSIM support is limited to certain regions. Please check with your carrier or device manufacturer to confirm if your OnePlus device supports eSIM.
OPPO*
Find N2 Flip
Find X5
Find X5 Pro
Find X8 Pro
Find X8
Find X3 Pro
Find X3
*eSIM support is limited to Japan and certain regions. Please check with your carrier or device manufacturer to confirm if your Oppo device supports eSIM.
RAKUTEN*
Rakuten Big
Rakuten Big S
Rakuten Mini
Rakuten Hand
Rakuten Hand 5G
*eSIM support is limited to Japan and certain regions. Please check with your carrier or device manufacturer to confirm if your Rakuten device supports eSIM.
SHARP*
AQUOS sense9
AQUOS sense8
AQUOS sense7
AQUOS sense7 plus
AQUOS R9 Pro
AQUOS R9 
AQUOS R8 pro
AQUOS R8
AQUOS R8s pro
AQUOS wish
AQUOS zero6
**eSIM support is limited to Japan and certain regions. Please check with your carrier or device manufacturer to confirm if your Sharp device supports eSIM.
SONY*
Xperia 1 IV
Xperia 1 V
Xperia 1 VI
Xperia 5 IV
Xperia 5 V
Xperia 10 III Lite
Xperia 10 IV*
Xperia 10 V
Xperia 10 VI
*eSIM support depends on country/region and carrier. Please check with your carrier or device manufacturer to confirm if your Xperia device supports eSIM.
*Sony Xperia 10 IV eSIM support is limited to Europe. Please check with your carrier or device manufacturer to confirm if your Sony Xperia 10 IV device supports eSIM.
 

TCL*
50 5G
50 NxtPaper
50 Pro NxtPaper
40 XL
*eSIM support depends on country/region and carrier. Please check with your carrier or device manufacturer to confirm if your Xperia device supports eSIM.
 
T-Mobile*
Revvl 7
Revvl 7 Pro
*eSIM support depends on country/region and carrier. Please check with your carrier or device manufacturer to confirm if your Xperia device supports eSIM.
VIVO*
X200 Pro
X200
X100 Pro
X90 Pro*
V29 (Europe and Latin America)*
V29 Lite 5G (Europe)*
V40
V40 Lite (Europe)*
V50
*eSIM support depends on country/region and carrier. Please check with your carrier or device manufacturer to confirm if your vivo device supports eSIM.
XIAOMI*
Xiaomi 15
Xiaomi 14
Xiaomi 14 Pro
Xiaomi 14T
Xiaomi 14T Pro
Xiaomi 13
Xiaomi 13 Pro
Xiaomi 13T
Xiaomi 13T Pro
Xiaomi 13 Lite
Xiaomi 12T Pro
Redmi Note 14 Pro
Redmi Note 14 Pro 5G
Redmi Note 14 Pro+
Redmi Note 14 Pro+ 5G
Redmi Note 13 Pro
Redmi Note 13 Pro+
Redmi Note 11 Pro 5G*
*eSIM support depends on country/region and carrier. Please check with your carrier or device manufacturer to confirm if your device supports eSIM.
Others*
Nuu Mobile X5
Gemini PDA 4G+Wi-Fi
Fairphone 4
Fairphone 5
Realme 14 Pro+
ASUS Zenfone 12 Ultra
ZTE nubia Flip2
*Surface: Any AT&T-locked device will not support eSIM. If your device was purchased from another carrier, that carrier may have disabled eSIM functionality in the Surface Duo.
WINDOWS 10*/ WINDOWS 11 laptops
ACER

Acer Swift 3
Acer Swift 7
Acer TravelMate P2
Acer TravelMate Spin P4
Acer TravelMate P6
ASUS
ASUS Mini Transformer T103HAF
ASUS NovaGo TP370QL
ASUS Vivobook Flip 14 TP401NA
DELL
Dell Latitude 7440
Dell Latitude 7210 2-in-1
Dell Latitude 9410
Dell Latitude 7310
Dell Latitude 7410
Dell Latitude 9510
Dell Latitude 5410
Dell Latitude 5411
Dell Latitude 5511
HP
HP Elitebook G5
HP Probook G5
HP Zbook G5
HP Spectre Folio 13
LENOVO
ThinkPad X1 Titanium Yoga 2 in 1
ThinkPad X1 Carbon Gen 9
ThinkPad X1 Fold
ThinkPad X1 Nano
ThinkPad X12 Detachable
Lenovo Flex 5G
Lenovo Yoga C630
Lenovo Miix 630
Lenovo Yoga 520
Lenovo Yoga 720 (2-in-1 models)
SURFACE*
Surface Pro 9
Surface Go 3
Surface Pro X
Surface Duo 2
Surface Duo
*Windows 10: Your PC must be running Windows 10 version 1703 or later to use eSIM. The device must also support LTE.
*Surface: Any AT&T-locked device will not support eSIM. If your device was purchased from another carrier, that carrier may have disabled eSIM functionality in the Surface Duo. Please check with your carrier for details.`,
    flexible: true
  },
  {
    question_zh: "AI推薦專案",
    answer_zh: `請根據下方的流量消耗參考資料與所有國家方案，協助用戶推薦最合適的專案。
1. 如果你還不知道用戶的旅遊國家，請先詢問：「請問您的旅遊國家是哪一個？」
2. 如果已經知道國家但還不知道常用平台，請再詢問：「請問您最常用哪些平台（IG、Facebook、Threads、YouTube、Google Maps、LINE、一般網站等）？」
3. 如果已經知道用戶的國家與平台，請直接根據下方資料，推薦最合適的專案與推薦理由。在推薦後，你「必須」加上這個貼心提醒：「如果旅途中發現流量不夠用，隨時都可以到『我的eSIM』->『查看用量』中加購流量包喔。」不要再重複詢問，也不需詳列推理過程。

【流量消耗參考資料】

各平台功能流量消耗總清單（單位：MB）

📱 Instagram（IG）
功能
每次流量消耗（估算）
瀏覽圖片貼文：約 1–2MB
瀏覽 Reels 短影片（15–30秒）：約 3–5MB
瀏覽限時動態（圖片）：約 1–2MB
瀏覽限時動態（影片）：約 3–5MB
發佈圖片貼文：約 2–3MB
發佈影片貼文：約 5–10MB
發佈限時動態（圖片）：約 2–3MB
發佈限時動態（影片）：約 4–6MB

Facebook（FB）
功能
每次流量消耗（估算）
瀏覽圖片貼文：約 1.5–3MB
瀏覽影片貼文（自動播放）：約 4–8MB（每30秒）
瀏覽限時動態（圖片）：約 1–2MB
瀏覽限時動態（影片）：約 3–5MB
發佈圖片貼文：約 2–4MB
發佈影片貼文：約 5–10MB
發佈限時動態（圖片）：約 2–3MB
發佈限時動態（影片）：約 4–6MB
點擊新聞或外部連結：約 1–2MB

Threads
功能
每次流量消耗（估算）
瀏覽純文字貼文：約 0.5–1MB
瀏覽圖片貼文：約 1–2MB
發佈純文字貼文：約 0.5MB
發佈圖片貼文：約 1.5–3MB

YouTube（依畫質）
畫質設定 每分鐘流量 每小時流量
144p：約 1.3MB／約 80MB
360p：約 5MB／約 300MB
720p（HD）：約 17MB／約 1GB
1080p（FHD）：約 25–34MB／約 1.5–2GB

Google Maps
功能 流量消耗說明
一般導航（駕駛或步行）：約 5MB／小時
導航 + 即時路況：約 7–10MB／小時
使用衛星地圖模式：約 15MB／小時
查詢地點（如餐廳、車站等）：約 0.5–1MB／次
縮放地圖、滑動瀏覽：約 0.5–1MB／次（快取情況下更省）

LINE
功能 每次流量消耗（估算）
傳送純文字訊息：幾乎可忽略（<0.01MB）
傳送圖片（一般解析度）：約 1–2MB／張
傳送短影片（15秒以內）：約 3–6MB
語音通話（1分鐘）：約 0.3–0.5MB
視訊通話（1分鐘）：約 4–6MB
瀏覽 LINE OA 圖文選單：約 0.3–0.8MB／次
點開 LINE 貼圖商店或活動頁面：約 1–2MB／次

一般網站瀏覽（含媒體、商店）
功能或網站類型 每頁流量消耗（估算）
純文字頁面（如新聞簡訊）：約 0.5–1MB
圖文頁面（如新聞＋圖片）：約 1–3MB
圖片大量頁（如購物網站）：約 3–5MB／頁
含影片自動播放網頁：約 5–10MB／頁

目前所有國家方案：

JP: {
    "moshi-moshi-7days-1gb"
    "moshi-moshi-15days-2gb"
    "moshi-moshi-30days-3gb"
    "moshi-moshi-30days-5gb"
    "moshi-moshi-30days-10gb"
    "moshi-moshi-30days-20gb"
  },
  KR: {
    "jang-7days-1gb"
    "jang-15days-2gb"
    "jang-30days-3gb"
    "jang-30days-5gb"
    "jang-30days-10gb"
    "jang-30days-20gb"
  },
  HK: {
    "hkmobile-7days-1gb"
    "hkmobile-15days-2gb"
    "hkmobile-30days-3gb"
    "hkmobile-30days-5gb"
    "hkmobile-30days-10gb"
    "hkmobile-10days-unlimited"
  },
  MO: {
    "macau-mobile-7days-1gb"
    "macau-mobile-15days-2gb"
    "macau-mobile-30days-3gb"
    "macau-mobile-30days-5gb"
    "macau-mobile-30days-10gb"
    "macau-mobile-30days-20gb"
  },
  SG: {
    "connect-lah-7days-1gb"
    "connect-lah-15days-2gb"
    "connect-lah-30days-3gb"
    "connect-lah-30days-5gb"
    "connect-lah-30days-10gb"
    "connect-lah-30days-20gb"
    "connect-lah-10days-unlimited"
  },
  TH: {
    "maew-7-days-1gb"
    "maew-15-days-2gb"
    "maew-30-days-3gb"
    "maew-30-days-5gb"
    "maew-30-days-10gb"
    "maew-30-days-20gb"
    "maew-30days-50gb"
  },
  VN: {
    "xin-chao-7days-1gb"
    "xin-chao-15days-2gb"
    "xin-chao-30days-3gb"
    "xin-chao-30days-5gb"
    "xin-chao-30days-10gb"
    "xin-chao-30days-20gb"
  },
  MY: {
    "sambungkan-7days-1gb"
    "sambungkan-15days-2gb"
    "sambungkan-30days-3gb"
    "sambungkan-30days-5gb"
    "sambungkan-30days-10gb"
    "sambungkan-30days-20gb"
    "sambungkan-10days-unlimited"
  },
  CN: {
    "chinacom-7days-1gb"
    "chinacom-15days-2gb"
    "chinacom-30days-3gb"
    "chinacom-30days-5gb"
    "chinacom-30days-10gb"
    "chinacom-30days-20gb"
    "chinam-mobile-10days-unlimited"
  },
  PH: {
    "alpas-mobile-7days-1gb"
    "alpas-mobile-15days-2gb"
    "alpas-mobile-30days-3gb"
    "alpas-mobile-30days-5gb"
    "alpas-mobile-30days-10gb"
    "alpas-mobile-30days-20gb"
  },
  KH: {
    "connect-cambodia-7days-1gb"
    "connect-cambodia-15days-2gb"
    "connect-cambodia-30days-3gb"
    "connect-cambodia-30days-5gb"
    "connect-cambodia-30days-10gb"
    "connect-cambodia-30days-20gb"
  },
  US: {
    "change-7days-1gb"
    "change-15days-2gb"
    "change-30days-3gb"
    "change-30days-5gb"
    "change-30days-10gb"
    "change-30days-20gb"
  },
  GB: {
    "uki-mobile-7days-1gb"
    "uki-mobile-15days-2gb"
    "uki-mobile-30days-3gb"
    "uki-mobile-30days-5gb"
    "uki-mobile-30days-10gb"
    "uki-mobile-30days-20gb"
  },
  DE: {
    "hallo-mobil-7days-1gb"
    "hallo-mobil-15days-2gb"
    "hallo-mobil-30days-3gb"
    "hallo-mobil-30days-5gb"
    "hallo-mobil-30days-10gb"
    "hallo-mobil-30days-20gb"
  },
  IT: {
    "mamma-mia-7days-1gb"
    "mamma-mia-15days-2gb"
    "mamma-mia-30days-3gb"
    "mamma-mia-30days-5gb"
    "mamma-mia-30days-10gb"
    "mamma-mia-30days-20gb"
  },
  ID: {
    "indotel-7days-1gb"
    "indotel-15days-2gb"
    "indotel-30days-3gb"
    "indotel-30days-5gb"
    "indotel-30days-10gb"
    "indotel-30days-20gb"
    "indotel-10days-unlimited"
  },
  Europe: {
    "eurolink-7days-1gb"
    "eurolink-15days-2gb"
    "eurolink-30days-3gb"
    "eurolink-30days-5gb"
    "eurolink-30days-10gb"
    "eurolink-30days-20gb"
    "eurolink-90days-50gb"
    "eurolink-180days-100gb"
    "eurolink-10days-unlimited"
  },
  North America: {
    "americanmex-7days-1gb"
    "americanmex-15days-2gb"
    "americanmex-30days-3gb"
    "americanmex-30days-5gb"
    "americanmex-30days-10gb"
  },
  Asia: {
    "asialink-7days-1gb"
    "asialink-15days-2gb"
    "asialink-30days-3gb"
    "asialink-30days-5gb"
    "asialink-30days-10gb"
    "asialink-30days-20gb"
    "asialink-90days-50gb"
    "asialink-180days-100gb"
  },
  Oceania: {
    "oceanlink-7days-1gb"
    "oceanlink-15days-2gb"
    "oceanlink-30days-3gb"
    "oceanlink-30days-5gb"
    "oceanlink-30days-10gb"
    "oceanlink-30days-20gb"
  },
  Africa: {
    "hello-africa-30days-1gb"
    "hello-africa-30days-3gb"
  }
`,
    question_en: "AI Project Recommendation",
    answer_en: `Based on the following data usage reference and all country/region plans, please help the user select the most suitable plan.
1. If you do not know the user's travel country and main platforms, first ask: "Which country are you traveling to?"
2. If you already know the user's country but not the platforms, ask: "Which platforms do you use most often? (IG, Facebook, Threads, YouTube, Google Maps, LINE, general web browsing, etc.)"
3. If you already know the user's country and platforms, directly recommend the most suitable plan and provide the reason based on the information below. After making the recommendation, you MUST also add the following friendly reminder: "If you find that the data is not enough during your trip, you can always go to 'My eSIMs' -> 'View Usage' to purchase additional top-up packages at any time." Do not ask again or show the calculation process.

[Data usage reference]

Data usage summary for each platform (unit: MB)

📱 Instagram (IG)
Feature
Estimated data usage per action
View photo post: about 1–2MB
View Reels short video (15–30s): about 3–5MB
View story (photo): about 1–2MB
View story (video): about 3–5MB
Post photo: about 2–3MB
Post video: about 5–10MB
Post story (photo): about 2–3MB
Post story (video): about 4–6MB

Facebook (FB)
Feature
Estimated data usage per action
View photo post: about 1.5–3MB
View video post (autoplay): about 4–8MB (per 30s)
View story (photo): about 1–2MB
View story (video): about 3–5MB
Post photo: about 2–4MB
Post video: about 5–10MB
Post story (photo): about 2–3MB
Post story (video): about 4–6MB
Click news or external link: about 1–2MB

Threads
Feature
Estimated data usage per action
View text post: about 0.5–1MB
View photo post: about 1–2MB
Post text: about 0.5MB
Post photo: about 1.5–3MB

YouTube (by quality)
Quality setting Per minute Per hour
144p: about 1.3MB / about 80MB
360p: about 5MB / about 300MB
720p (HD): about 17MB / about 1GB
1080p (FHD): about 25–34MB / about 1.5–2GB

Google Maps
Feature Data usage
General navigation (driving or walking): about 5MB/hour
Navigation + real-time traffic: about 7–10MB/hour
Satellite mode: about 15MB/hour
Search for places (e.g., restaurants, stations): about 0.5–1MB/time
Zoom/scroll map: about 0.5–1MB/time (less if cached)

LINE
Feature Estimated data usage per action
Send text message: negligible (<0.01MB)
Send photo (normal resolution): about 1–2MB/photo
Send short video (under 15s): about 3–6MB
Voice call (1 min): about 0.3–0.5MB
Video call (1 min): about 4–6MB
Browse LINE OA menu: about 0.3–0.8MB/time
Open LINE sticker shop or event page: about 1–2MB/time

General web browsing (media, shopping)
Feature or site type Estimated data usage per page
Text-only page (e.g., news): about 0.5–1MB
Image+text page (e.g., news + images): about 1–3MB
Image-heavy page (e.g., shopping): about 3–5MB/page
Page with autoplay video: about 5–10MB/page

All current country/region plans:

JP: {
    "moshi-moshi-7days-1gb"
    "moshi-moshi-15days-2gb"
    "moshi-moshi-30days-3gb"
    "moshi-moshi-30days-5gb"
    "moshi-moshi-30days-10gb"
    "moshi-moshi-30days-20gb"
  },
  KR: {
    "jang-7days-1gb"
    "jang-15days-2gb"
    "jang-30days-3gb"
    "jang-30days-5gb"
    "jang-30days-10gb"
    "jang-30days-20gb"
  },
  HK: {
    "hkmobile-7days-1gb"
    "hkmobile-15days-2gb"
    "hkmobile-30days-3gb"
    "hkmobile-30days-5gb"
    "hkmobile-30days-10gb"
    "hkmobile-10days-unlimited"
  },
  MO: {
    "macau-mobile-7days-1gb"
    "macau-mobile-15days-2gb"
    "macau-mobile-30days-3gb"
    "macau-mobile-30days-5gb"
    "macau-mobile-30days-10gb"
    "macau-mobile-30days-20gb"
  },
  SG: {
    "connect-lah-7days-1gb"
    "connect-lah-15days-2gb"
    "connect-lah-30days-3gb"
    "connect-lah-30days-5gb"
    "connect-lah-30days-10gb"
    "connect-lah-30days-20gb"
    "connect-lah-10days-unlimited"
  },
  TH: {
    "maew-7-days-1gb"
    "maew-15-days-2gb"
    "maew-30-days-3gb"
    "maew-30-days-5gb"
    "maew-30-days-10gb"
    "maew-30-days-20gb"
    "maew-30days-50gb"
  },
  VN: {
    "xin-chao-7days-1gb"
    "xin-chao-15days-2gb"
    "xin-chao-30days-3gb"
    "xin-chao-30days-5gb"
    "xin-chao-30days-10gb"
    "xin-chao-30days-20gb"
  },
  MY: {
    "sambungkan-7days-1gb"
    "sambungkan-15days-2gb"
    "sambungkan-30days-3gb"
    "sambungkan-30days-5gb"
    "sambungkan-30days-10gb"
    "sambungkan-30days-20gb"
    "sambungkan-10days-unlimited"
  },
  CN: {
    "chinacom-7days-1gb"
    "chinacom-15days-2gb"
    "chinacom-30days-3gb"
    "chinacom-30days-5gb"
    "chinacom-30days-10gb"
    "chinacom-30days-20gb"
    "chinam-mobile-10days-unlimited"
  },
  PH: {
    "alpas-mobile-7days-1gb"
    "alpas-mobile-15days-2gb"
    "alpas-mobile-30days-3gb"
    "alpas-mobile-30days-5gb"
    "alpas-mobile-30days-10gb"
    "alpas-mobile-30days-20gb"
  },
  KH: {
    "connect-cambodia-7days-1gb"
    "connect-cambodia-15days-2gb"
    "connect-cambodia-30days-3gb"
    "connect-cambodia-30days-5gb"
    "connect-cambodia-30days-10gb"
    "connect-cambodia-30days-20gb"
  },
  US: {
    "change-7days-1gb"
    "change-15days-2gb"
    "change-30days-3gb"
    "change-30days-5gb"
    "change-30days-10gb"
    "change-30days-20gb"
  },
  GB: {
    "uki-mobile-7days-1gb"
    "uki-mobile-15days-2gb"
    "uki-mobile-30days-3gb"
    "uki-mobile-30days-5gb"
    "uki-mobile-30days-10gb"
    "uki-mobile-30days-20gb"
  },
  DE: {
    "hallo-mobil-7days-1gb"
    "hallo-mobil-15days-2gb"
    "hallo-mobil-30days-3gb"
    "hallo-mobil-30days-5gb"
    "hallo-mobil-30days-10gb"
    "hallo-mobil-30days-20gb"
  },
  IT: {
    "mamma-mia-7days-1gb"
    "mamma-mia-15days-2gb"
    "mamma-mia-30days-3gb"
    "mamma-mia-30days-5gb"
    "mamma-mia-30days-10gb"
    "mamma-mia-30days-20gb"
  },
  ID: {
    "indotel-7days-1gb"
    "indotel-15days-2gb"
    "indotel-30days-3gb"
    "indotel-30days-5gb"
    "indotel-30days-10gb"
    "indotel-30days-20gb"
    "indotel-10days-unlimited"
  },
  Europe: {
    "eurolink-7days-1gb"
    "eurolink-15days-2gb"
    "eurolink-30days-3gb"
    "eurolink-30days-5gb"
    "eurolink-30days-10gb"
    "eurolink-30days-20gb"
    "eurolink-90days-50gb"
    "eurolink-180days-100gb"
    "eurolink-10days-unlimited"
  },
  North America: {
    "americanmex-7days-1gb"
    "americanmex-15days-2gb"
    "americanmex-30days-3gb"
    "americanmex-30days-5gb"
    "americanmex-30days-10gb"
  },
  Asia: {
    "asialink-7days-1gb"
    "asialink-15days-2gb"
    "asialink-30days-3gb"
    "asialink-30days-5gb"
    "asialink-30days-10gb"
    "asialink-30days-20gb"
    "asialink-90days-50gb"
    "asialink-180days-100gb"
  },
  Oceania: {
    "oceanlink-7days-1gb"
    "oceanlink-15days-2gb"
    "oceanlink-30days-3gb"
    "oceanlink-30days-5gb"
    "oceanlink-30days-10gb"
    "oceanlink-30days-20gb"
  },
  Africa: {
    "hello-africa-30days-1gb"
    "hello-africa-30days-3gb"
  }
`,
    flexible: true
  }
].map(faq => ({
  question_zh: faq.question_zh.replace(/airalo/gi, 'CANET').replace(/waysim/gi, 'CANET'),
  answer_zh: faq.answer_zh.replace(/airalo/gi, 'CANET').replace(/waysim/gi, 'CANET'),
  question_en: faq.question_en.replace(/airalo/gi, 'CANET').replace(/waysim/gi, 'CANET'),
  answer_en: faq.answer_en.replace(/airalo/gi, 'CANET').replace(/waysim/gi, 'CANET'),
  flexible: faq.flexible
}));

// Gemini API 設定
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY environment variable");
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY;

// LINE Channel Access Token
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
if (!LINE_CHANNEL_ACCESS_TOKEN) throw new Error("Missing LINE_CHANNEL_ACCESS_TOKEN environment variable");
// LINE Channel Secret
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET");
if (!LINE_CHANNEL_SECRET) throw new Error("Missing LINE_CHANNEL_SECRET environment variable");

// Supabase 初始化
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// LINE webhook handler
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // 取得原始 body
  const rawBody = await req.text();
  // 取得 LINE 簽名
  const signature = req.headers.get("x-line-signature") || "";
  // 驗證簽名
  const valid = await verifyLineSignature(LINE_CHANNEL_SECRET, rawBody, signature);
  if (!valid) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const body = JSON.parse(rawBody);
    console.log("收到 LINE webhook body:", JSON.stringify(body));
    const events = body.events || [];
    
    for (const event of events) {
      console.log("收到 event:", JSON.stringify(event));
      if (event.type === "message" && event.message.type === "text") {
        const userQuestion = event.message.text;
        const userId = event.source?.userId || null;
        const now = new Date().toISOString();
        // 儲存 user 訊息
        if (userId) {
          await supabase.from('conversations').insert([
            { user_id: userId, role: 'user', message: userQuestion, created_at: now }
          ]);
        }
        // 查詢歷史訊息
        let historyPrompt = '';
        let firstUserMessage = null;
        let historyRows = null;
        if (userId) {
          const { data } = await supabase
            .from('conversations')
            .select('role,message,created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
          historyRows = data;
          if (historyRows && historyRows.length > 0) {
            historyRows.forEach(row => {
              if (row.role === 'user') {
                if (!firstUserMessage) firstUserMessage = row.message;
                historyPrompt += `使用者: ${row.message}\n`;
              } else if (row.role === 'assistant') {
                historyPrompt += `客服: ${row.message}\n`;
              }
            });
          }
        }
        // 語言判斷：根據第一則 user 訊息
        let useEnglish = false;
        if (firstUserMessage) {
          useEnglish = !(/[\u4e00-\u9fa5]/.test(firstUserMessage));
        } else {
          // fallback: 若無歷史，才用本次訊息判斷
          useEnglish = !(/[\u4e00-\u9fa5]/.test(userQuestion));
        }
        // 強化客服身份說明與語言規則
        let context = useEnglish
          ? `You are a customer service representative of CANET, replying in the official LINE account. Please prioritize referring to the FAQ below. If the FAQ does not resolve the user's issue, please use your own knowledge and the FAQ context to provide the most appropriate advice.`
            + "\nHere are some frequently asked questions and answers:\n"
          : `你是 CANET 官方 LINE 客服。請優先參考 FAQ，若 FAQ 沒有解決，請根據你的知識與 FAQ context 給出最合適的建議。`
            + "\n以下是常見問題與解答：\n";
        // 插入歷史對話
        if (historyPrompt) {
          context = (useEnglish
            ? 'Conversation history:\n' : '對話歷史：\n') + historyPrompt + '\n' + context;
        }
        faqs.forEach(faq => {
          if (useEnglish) {
            context += `Q: ${faq.question_en}\nA: ${faq.answer_en}\n`;
          } else {
            context += `Q: ${faq.question_zh}\nA: ${faq.answer_zh}\n`;
          }
        });
        // 新增結尾語句
        const ending = useEnglish
          ? "If you have any further questions, please feel free to ask at any time. I will help you as soon as possible."
          : "如還有任何問題，請再不要吝嗇隨時提出，我會第一時間幫你解惑。";
        // 若是AI推薦專案，不加結尾語句（根據歷史第一句）
        let isAiRecommend = false;
        if (historyRows && historyRows.length > 0) {
          const firstMsg = historyRows.find(row => row.role === 'user');
          if (firstMsg && (firstMsg.message.includes('AI推薦專案') || firstMsg.message.toLowerCase().includes('ai project recommendation'))) {
            isAiRecommend = true;
          }
        }
        context += `\n${userQuestion}\nPlease answer in the same language as the question and do not repeat the FAQ opening statement.`;
        if (!isAiRecommend) {
          context += ` Please strictly end your reply with: '${ending}' and do not use any other language. Strictly follow this instruction.`;
        }
        // 直接呼叫 Gemini API，不再做 FAQ 比對
        const geminiRes = await fetch(GEMINI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: context }] }
            ]
          })
        });
        const geminiData = await geminiRes.json();
        console.log("Gemini API 回傳:", JSON.stringify(geminiData));
        const answer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "很抱歉，目前無法回答您的問題。";
        // 去除回覆內容結尾多餘換行
        const cleanAnswer = answer.replace(/\n+$/g, '');
        // 儲存 AI 回覆
        if (userId) {
          await supabase.from('conversations').insert([
            { user_id: userId, role: 'assistant', message: cleanAnswer, created_at: new Date().toISOString() }
          ]);
        }
        // 呼叫 LINE Messaging API reply endpoint
        const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [{ type: "text", text: cleanAnswer }]
          })
        });
        if (!lineRes.ok) {
          console.error("LINE API 回傳錯誤:", await lineRes.text());
        }
        console.log("回覆給 LINE:", JSON.stringify({ replyToken: event.replyToken, answer }));
      }
    }
    
    // 回傳 200 OK 給 LINE Platform
    return new Response("ok", {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    console.error("function error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}); 