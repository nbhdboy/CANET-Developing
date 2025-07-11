import { create } from 'zustand';
import type { UserProfile, SavedCard } from './types/index';
import { supabase } from './lib/supabaseClient';

export interface Store {
  language: string;
  setLanguage: (language: string) => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  savedCards: SavedCard[];
  updateUserCards: (cards: SavedCard[]) => void;
  fetchUserCards?: () => Promise<void>;
  idToken: string | null;
  setIdToken: (token: string | null) => void;
}

export const useStore = create<Store>((set, get) => ({
  language: 'zh_TW',
  setLanguage: (language) => set({ language }),
  user: null,
  setUser: (user) => {
    console.log('【DEBUG】setUser 前 user.savedCards:', user?.savedCards);
    console.log('setUser 更新:', user);
    set({ user });
  },
  savedCards: [],
  updateUserCards: (cards) => {
    console.log('updateUserCards 更新:', cards);
    set({ savedCards: cards });
  },
  idToken: null,
  setIdToken: (token) => set({ idToken: token }),
  fetchUserCards: async () => {
    const user = get().user;
    if (!user) return;
    // 延長等待時間，確保 DB 已同步
    await new Promise(r => setTimeout(r, 2000));
    console.log('=== fetchUserCards 執行 ===');
    console.log('fetchUserCards: 查詢 user_cards for', user.userId);
    // 只查詢安全欄位
    const { data, error } = await supabase
      .from('user_cards')
      .select('id, last_four, brand, expiry_month, expiry_year')
      .eq('line_user_id', user.userId);
    console.log('fetchUserCards 查詢結果:', data, error);
    console.log('【DEBUG】fetchUserCards 查詢結果 data:', data);
    // 只存安全欄位
    const cards = (data || []).map(card => ({
      id: card.id,
      last_four: card.last_four,
      brand: card.brand,
      expiryMonth: card.expiry_month,
      expiryYear: card.expiry_year
    }));
    set((state) => ({
      user: state.user ? { ...state.user, savedCards: [...cards] } : null,
      savedCards: [...cards]
    }));
    console.log('【DEBUG】fetchUserCards set cards:', cards);
  }
})); 