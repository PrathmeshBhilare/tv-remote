'use client';

import React, { useState, useEffect } from 'react';
import { Tv, Trash2, Power, RefreshCw, Plus, Shield, Network } from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfileStorage } from '../../src/storage/tv-store';
import { TVProfile } from '../../src/integrations/tv/types';

export const DevicesSettings: React.FC<{ onAddDevice: () => void }> = ({ onAddDevice }) => {
  const { currentProfile, forgetCurrentTV, connectTV, powerOff, connectionState } = useTV();
  const [profiles, setProfiles] = useState<TVProfile[]>([]);

  useEffect(() => {
    setProfiles(TVProfileStorage.getProfiles());
  }, [currentProfile]);

  const handleDeleteProfile = (id: string) => {
    TVProfileStorage.deleteProfile(id);
    setProfiles(TVProfileStorage.getProfiles());
    if (currentProfile?.id === id) {
      forgetCurrentTV();
    }
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm px-4 select-none pb-8">
      {/* Active Device Card */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-widest text-tv-textMuted font-semibold">
          Active Device
        </h3>

        {currentProfile ? (
          <div className="bg-tv-surface border border-tv-border rounded-2xl p-4 flex flex-col gap-3 shadow-remoteButton">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-tv-textPrimary">{currentProfile.name}</h4>
                  <p className="text-xs text-tv-textSecondary font-mono">{currentProfile.ip}:{currentProfile.port}</p>
                </div>
              </div>

              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                  isConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-tv-border">
              <button
                type="button"
                onClick={() => connectTV(currentProfile)}
                className="flex-1 py-2 px-3 rounded-xl bg-tv-surfaceHover hover:bg-tv-surfaceActive text-xs text-tv-textPrimary font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>

              <button
                type="button"
                disabled={!isConnected}
                onClick={powerOff}
                className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs text-rose-400 font-medium flex items-center justify-center gap-1.5 border border-rose-500/20 disabled:opacity-40 transition-colors"
              >
                <Power className="w-3.5 h-3.5" />
                Power Off
              </button>

              <button
                type="button"
                onClick={forgetCurrentTV}
                className="py-2 px-3 rounded-xl bg-tv-surfaceHover hover:bg-rose-500/20 text-xs text-tv-textMuted hover:text-rose-400 flex items-center justify-center transition-colors"
                title="Forget TV Credentials"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-tv-surface/60 border border-dashed border-tv-border rounded-2xl p-6 text-center text-xs text-tv-textMuted flex flex-col items-center gap-2">
            <Tv className="w-8 h-8 opacity-40" />
            <p>No active TV connected</p>
          </div>
        )}
      </div>

      {/* Saved TVs List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-widest text-tv-textMuted font-semibold">
            Saved TVs ({profiles.length})
          </h3>
          <button
            type="button"
            onClick={onAddDevice}
            className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add TV
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-tv-surface border border-tv-border rounded-xl p-3 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-tv-textPrimary">{p.name}</span>
                <span className="text-[11px] text-tv-textMuted font-mono">{p.ip}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => connectTV(p)}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium border border-blue-500/20"
                >
                  Connect
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(p.id)}
                  className="p-1.5 text-tv-textMuted hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network & Security Diagnostics */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-widest text-tv-textMuted font-semibold flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5" />
          Network & Architecture Info
        </h3>
        <div className="bg-tv-surface border border-tv-border rounded-2xl p-3.5 text-xs text-tv-textSecondary space-y-2">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong className="text-tv-textPrimary">Zero Cloud Proxy:</strong> All communication happens directly across your local network between your device and the TV. Client keys are stored locally and never transmitted to external servers.
            </p>
          </div>
          <div className="pt-2 border-t border-tv-border text-[11px] text-tv-textMuted">
            If browser security blocks WebSocket connections to local IP addresses, run the application inside the native Android container shell.
          </div>
        </div>
      </div>
    </div>
  );
};

