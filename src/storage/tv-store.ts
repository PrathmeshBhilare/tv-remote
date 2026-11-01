import { TVProfile } from '../integrations/tv/types';

const STORAGE_KEY_PROFILES = 'lg_remote_saved_profiles_v1';
const STORAGE_KEY_ACTIVE_ID = 'lg_remote_active_profile_id_v1';
const STORAGE_KEY_SEARCH_HISTORY = 'lg_remote_yt_search_history_v1';

export class TVProfileStorage {
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  public static getProfiles(): TVProfile[] {
    if (!this.isBrowser()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY_PROFILES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static getActiveProfile(): TVProfile | null {
    if (!this.isBrowser()) return null;
    const profiles = this.getProfiles();
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (!activeId && profiles.length > 0) {
      return profiles[0];
    }
    return profiles.find((p) => p.id === activeId) || (profiles[0] ?? null);
  }

  public static saveProfile(profile: TVProfile): void {
    if (!this.isBrowser()) return;
    const profiles = this.getProfiles();
    const existingIndex = profiles.findIndex((p) => p.id === profile.id || p.ip === profile.ip);

    if (existingIndex >= 0) {
      profiles[existingIndex] = { ...profiles[existingIndex], ...profile };
    } else {
      profiles.push(profile);
    }

    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, profile.id);
  }

  public static deleteProfile(profileId: string): void {
    if (!this.isBrowser()) return;
    const profiles = this.getProfiles().filter((p) => p.id !== profileId);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));

    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (activeId === profileId) {
      if (profiles.length > 0) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, profiles[0].id);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
      }
    }
  }

  public static setActiveProfileId(profileId: string): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, profileId);
  }

  public static getSearchHistory(): string[] {
    if (!this.isBrowser()) return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static addSearchQuery(query: string): void {
    if (!this.isBrowser() || !query.trim()) return;
    const trimmed = query.trim();
    const history = this.getSearchHistory().filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    history.unshift(trimmed);
    const capped = history.slice(0, 15); // keep last 15
    localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(capped));
  }

  public static clearSearchHistory(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem(STORAGE_KEY_SEARCH_HISTORY);
  }
}

