import { ITVAdapter } from './adapter';
import { LGWebOSTVAdapter } from '../lg-webos/lg-adapter';

export type BrandIdentifier = 'lg-webos' | 'samsung-tizen' | 'android-tv' | 'roku';

class TVAdapterRegistry {
  private adapters = new Map<string, () => ITVAdapter>();

  constructor() {
    // Register built-in LG webOS adapter
    this.register('lg-webos', () => new LGWebOSTVAdapter());
  }

  public register(brand: BrandIdentifier | string, factory: () => ITVAdapter): void {
    this.adapters.set(brand.toLowerCase(), factory);
  }

  public getAdapter(brand: BrandIdentifier | string): ITVAdapter {
    const factory = this.adapters.get(brand.toLowerCase());
    if (!factory) {
      throw new Error(`No adapter registered for TV brand: "${brand}".`);
    }
    return factory();
  }

  public getSupportedBrands(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const tvRegistry = new TVAdapterRegistry();

