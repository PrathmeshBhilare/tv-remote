import { Preferences } from '@capacitor/preferences';
import { TVProfile } from '../integrations/tv/types';

const STORAGE_KEY_PROFILES = 'lg_remote_saved_profiles_v1';
const STORAGE_KEY_ACTIVE_ID = 'lg_remote_active_profile_id_v1';
const STORAGE_KEY_SEARCH_HISTORY = 'lg_remote_yt_search_history_v1';
const STORAGE_KEY_BRIDGE_URL = 'lg_remote_bridge_url_v1';

// In-memory cache for synchronous access across React components
let cachedProfiles: TVProfile[] | null = null;
let cachedActiveId: string | null = null;
let cachedSearchHistory: string[] | null = null;
let cachedBridgeUrl: string | null = null;

export class TVProfileStorage {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  private static isNative(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    return Boolean(win.Capacitor?.isNativePlatform?.());
  }

  /**
   * Initializes cache from storage (localStorage or native Preferences).
   * Called automatically on first read.
   */
  public static initCache(): void {
    if (!this.isBrowser()) return;

    try {
      if (typeof window.localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
        if (raw) cachedProfiles = JSON.parse(raw);
        cachedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
        const rawHistory = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
        if (rawHistory) cachedSearchHistory = JSON.parse(rawHistory);
        cachedBridgeUrl = localStorage.getItem(STORAGE_KEY_BRIDGE_URL);
      }
    } catch {}

    // If running natively, synchronize with native secure storage asynchronously
    if (this.isNative()) {
      Preferences.get({ key: STORAGE_KEY_PROFILES }).then(({ value }) => {
        if (value) {
          try {
            cachedProfiles = JSON.parse(value);
          } catch {}
        }
      });
      Preferences.get({ key: STORAGE_KEY_ACTIVE_ID }).then(({ value }) => {
        if (value) cachedActiveId = value;
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
    const activeId = cachedActiveId || (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ACTIVE_ID) : null);
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

    // Save to web storage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, profile.id);
      }
    } catch {}

    // Save to native encrypted preferences if running in native app
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
    try {
      return (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_BRIDGE_URL) : null) || '';
    } catch {
      return '';
    }
  }

  public static setBridgeUrl(url: string): void {
    if (!this.isBrowser()) return;
    cachedBridgeUrl = url;
    try {
      if (typeof localStorage !== 'undefined') {
        if (url) localStorage.setItem(STORAGE_KEY_BRIDGE_URL, url);
        else localStorage.removeItem(STORAGE_KEY_BRIDGE_URL);
      }
    } catch {}
  }

  public static getSearchHistory(): string[] {
    if (!this.isBrowser()) return [];
    if (cachedSearchHistory !== null) return cachedSearchHistory;
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

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(capped));
      }
    } catch {}
  }

  public static clearSearchHistory(): void {
    if (!this.isBrowser()) return;
    cachedSearchHistory = [];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
      }
    } catch {}
  }
}
