import { Preferences } from '@capacitor/preferences';
import { TVProfile } from '../integrations/tv/types';

const STORAGE_KEY_PROFILES = 'lg_remote_saved_profiles_v1';
const STORAGE_KEY_ACTIVE_ID = 'lg_remote_active_profile_id_v1';
const STORAGE_KEY_SEARCH_HISTORY = 'lg_remote_yt_search_history_v1';
const STORAGE_KEY_BRIDGE_URL = 'lg_remote_bridge_url_v1';
const STORAGE_KEY_BRIDGE_TOKEN = 'lg_remote_bridge_token_v1';

interface AndroidBridgeStorage {
  getStorageItem?: (key: string) => string | null;
  setStorageItem?: (key: string, value: string) => void;
  removeStorageItem?: (key: string) => void;
}

// In-memory cache for synchronous access across React components
let cachedProfiles: TVProfile[] | null = null;
let cachedActiveId: string | null = null;
let cachedSearchHistory: string[] | null = null;
let cachedBridgeUrl: string | null = null;
let cachedBridgeToken: string | null = null;

export class TVProfileStorage {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private static getAndroidBridge(): AndroidBridgeStorage | null {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as { AndroidBridge?: AndroidBridgeStorage };
    if (win.AndroidBridge && typeof win.AndroidBridge.getStorageItem === 'function') {
      return win.AndroidBridge;
    }
    return null;
  }

  private static isNative(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    return Boolean(win.Capacitor?.isNativePlatform?.());
  }

  /**
   * Initializes cache from storage (AndroidBridge, localStorage, or native Preferences).
   * Called automatically on first read.
   */
  public static initCache(): void {
    if (!this.isBrowser()) return;

    // 1. Check AndroidBridge (Native Android SharedPreferences - synchronous and permanent across restarts)
    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        const rawProfiles = bridge.getStorageItem?.(STORAGE_KEY_PROFILES);
        if (rawProfiles) {
          cachedProfiles = JSON.parse(rawProfiles);
        }
        const activeId = bridge.getStorageItem?.(STORAGE_KEY_ACTIVE_ID);
        if (activeId) cachedActiveId = activeId;

        const rawHistory = bridge.getStorageItem?.(STORAGE_KEY_SEARCH_HISTORY);
        if (rawHistory) cachedSearchHistory = JSON.parse(rawHistory);

        const bUrl = bridge.getStorageItem?.(STORAGE_KEY_BRIDGE_URL);
        if (bUrl) cachedBridgeUrl = bUrl;

        const bTok = bridge.getStorageItem?.(STORAGE_KEY_BRIDGE_TOKEN);
        if (bTok) cachedBridgeToken = bTok;
      } catch (e) {
        console.warn('Error reading from AndroidBridge storage:', e);
      }
    }

    // 2. Check localStorage (Browser / PWA fallback)
    try {
      if (typeof window.localStorage !== 'undefined') {
        if (!cachedProfiles || cachedProfiles.length === 0) {
          const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
          if (raw) cachedProfiles = JSON.parse(raw);
        }
        if (!cachedActiveId) {
          cachedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
        }
        if (!cachedSearchHistory || cachedSearchHistory.length === 0) {
          const rawHistory = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
          if (rawHistory) cachedSearchHistory = JSON.parse(rawHistory);
        }
        if (!cachedBridgeUrl) {
          cachedBridgeUrl = localStorage.getItem(STORAGE_KEY_BRIDGE_URL);
        }
        if (!cachedBridgeToken) {
          cachedBridgeToken = localStorage.getItem(STORAGE_KEY_BRIDGE_TOKEN);
        }
      }
    } catch {}

    // 3. Fall back to Capacitor Preferences if available
    if (this.isNative()) {
      Preferences.get({ key: STORAGE_KEY_PROFILES }).then(({ value }) => {
        if (value && (!cachedProfiles || cachedProfiles.length === 0)) {
          try {
            cachedProfiles = JSON.parse(value);
          } catch {}
        }
      });
      Preferences.get({ key: STORAGE_KEY_ACTIVE_ID }).then(({ value }) => {
        if (value && !cachedActiveId) cachedActiveId = value;
      });
    }
  }

  public static getProfiles(): TVProfile[] {
    if (!this.isBrowser()) return [];
    if (cachedProfiles === null) {
      this.initCache();
    }
    return cachedProfiles || [];
  }

  public static getActiveProfile(): TVProfile | null {
    if (!this.isBrowser()) return null;
    const profiles = this.getProfiles();
    let activeId = cachedActiveId;
    if (!activeId) {
      const bridge = this.getAndroidBridge();
      if (bridge) {
        activeId = bridge.getStorageItem?.(STORAGE_KEY_ACTIVE_ID) || null;
      }
      if (!activeId && typeof localStorage !== 'undefined') {
        activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      }
    }
    if (!activeId && profiles.length > 0) {
      return profiles[0];
    }
    return profiles.find((p) => p.id === activeId) || (profiles[0] ?? null);
  }

  public static saveProfile(profile: TVProfile): void {
    if (!this.isBrowser()) return;
    const profiles = [...this.getProfiles()];
    const existingIndex = profiles.findIndex((p) => p.id === profile.id || p.ip === profile.ip);

    if (existingIndex >= 0) {
      profiles[existingIndex] = { ...profiles[existingIndex], ...profile };
    } else {
      profiles.push(profile);
    }

    cachedProfiles = profiles;
    cachedActiveId = profile.id;

    // 1. Save synchronously to Native Android SharedPreferences (persists permanently until app uninstall)
    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        bridge.setStorageItem?.(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
        bridge.setStorageItem?.(STORAGE_KEY_ACTIVE_ID, profile.id);
      } catch (err) {
        console.warn('Native storage save error:', err);
      }
    }

    // 2. Save to web localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, profile.id);
      }
    } catch {}

    // 3. Save to native encrypted preferences if running in native app
    if (this.isNative()) {
      Preferences.set({ key: STORAGE_KEY_PROFILES, value: JSON.stringify(profiles) });
      Preferences.set({ key: STORAGE_KEY_ACTIVE_ID, value: profile.id });
    }
  }

  public static deleteProfile(profileId: string): void {
    if (!this.isBrowser()) return;
    const profiles = this.getProfiles().filter((p) => p.id !== profileId);
    cachedProfiles = profiles;

    let newActiveId: string | null = cachedActiveId;
    if (cachedActiveId === profileId) {
      newActiveId = profiles.length > 0 ? profiles[0].id : null;
      cachedActiveId = newActiveId;
    }

    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        bridge.setStorageItem?.(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
        if (newActiveId) {
          bridge.setStorageItem?.(STORAGE_KEY_ACTIVE_ID, newActiveId);
        } else {
          bridge.removeStorageItem?.(STORAGE_KEY_ACTIVE_ID);
        }
      } catch {}
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
        if (newActiveId) {
          localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newActiveId);
        } else {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
        }
      }
    } catch {}

    if (this.isNative()) {
      Preferences.set({ key: STORAGE_KEY_PROFILES, value: JSON.stringify(profiles) });
      if (newActiveId) {
        Preferences.set({ key: STORAGE_KEY_ACTIVE_ID, value: newActiveId });
      } else {
        Preferences.remove({ key: STORAGE_KEY_ACTIVE_ID });
      }
    }
  }

  public static setActiveProfileId(profileId: string): void {
    if (!this.isBrowser()) return;
    cachedActiveId = profileId;

    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        bridge.setStorageItem?.(STORAGE_KEY_ACTIVE_ID, profileId);
      } catch {}
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, profileId);
      }
    } catch {}
    if (this.isNative()) {
      Preferences.set({ key: STORAGE_KEY_ACTIVE_ID, value: profileId });
    }
  }

  public static getBridgeUrl(): string {
    if (!this.isBrowser()) return '';
    if (cachedBridgeUrl !== null) return cachedBridgeUrl;
    const bridge = this.getAndroidBridge();
    if (bridge) {
      const bUrl = bridge.getStorageItem?.(STORAGE_KEY_BRIDGE_URL);
      if (bUrl) return bUrl;
    }
    try {
      return (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BRIDGE_URL) : null) || 'http://127.0.0.1:3005';
    } catch {
      return 'http://127.0.0.1:3005';
    }
  }

  public static setBridgeUrl(url: string): void {
    if (!this.isBrowser()) return;
    cachedBridgeUrl = url;
    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        if (url) bridge.setStorageItem?.(STORAGE_KEY_BRIDGE_URL, url);
        else bridge.removeStorageItem?.(STORAGE_KEY_BRIDGE_URL);
      } catch {}
    }
    try {
      if (typeof localStorage !== 'undefined') {
        if (url) localStorage.setItem(STORAGE_KEY_BRIDGE_URL, url);
        else localStorage.removeItem(STORAGE_KEY_BRIDGE_URL);
      }
    } catch {}
  }

  public static getBridgeToken(): string {
    if (!this.isBrowser()) return '';
    if (cachedBridgeToken !== null) return cachedBridgeToken;
    const bridge = this.getAndroidBridge();
    if (bridge) {
      const tok = bridge.getStorageItem?.(STORAGE_KEY_BRIDGE_TOKEN);
      if (tok) return tok;
    }
    try {
      return (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BRIDGE_TOKEN) : null) || '';
    } catch {
      return '';
    }
  }

  public static setBridgeToken(token: string): void {
    if (!this.isBrowser()) return;
    cachedBridgeToken = token;
    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        if (token) bridge.setStorageItem?.(STORAGE_KEY_BRIDGE_TOKEN, token);
        else bridge.removeStorageItem?.(STORAGE_KEY_BRIDGE_TOKEN);
      } catch {}
    }
    try {
      if (typeof localStorage !== 'undefined') {
        if (token) localStorage.setItem(STORAGE_KEY_BRIDGE_TOKEN, token);
        else localStorage.removeItem(STORAGE_KEY_BRIDGE_TOKEN);
      }
    } catch {}
  }

  public static getSearchHistory(): string[] {
    if (!this.isBrowser()) return [];
    if (cachedSearchHistory !== null) return cachedSearchHistory;
    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        const data = bridge.getStorageItem?.(STORAGE_KEY_SEARCH_HISTORY);
        if (data) {
          cachedSearchHistory = JSON.parse(data);
          return cachedSearchHistory || [];
        }
      } catch {}
    }
    try {
      const data = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY) : null;
      cachedSearchHistory = data ? JSON.parse(data) : [];
      return cachedSearchHistory || [];
    } catch {
      return [];
    }
  }

  public static addSearchQuery(query: string): void {
    if (!this.isBrowser() || !query.trim()) return;
    const trimmed = query.trim();
    const history = this.getSearchHistory().filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    history.unshift(trimmed);
    const capped = history.slice(0, 15);
    cachedSearchHistory = capped;

    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        bridge.setStorageItem?.(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(capped));
      } catch {}
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(capped));
      }
    } catch {}
  }

  public static clearSearchHistory(): void {
    if (!this.isBrowser()) return;
    cachedSearchHistory = [];
    const bridge = this.getAndroidBridge();
    if (bridge) {
      try {
        bridge.removeStorageItem?.(STORAGE_KEY_SEARCH_HISTORY);
      } catch {}
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
      }
    } catch {}
  }
}
