'use client';

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Trash2,
  Power,
  RefreshCw,
  Plus,
  Shield,
  Network,
  Server,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfileStorage } from '../../src/storage/tv-store';
import { TVProfile } from '../../src/integrations/tv/types';

export const DevicesSettings: React.FC<{ onAddDevice: () => void }> = ({ onAddDevice }) => {
  const { currentProfile, forgetCurrentTV, connectTV, powerOff, connectionState } = useTV();
  const [profiles, setProfiles] = useState<TVProfile[]>([]);
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [isTestingBridge, setIsTestingBridge] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    setProfiles(TVProfileStorage.getProfiles());
    setBridgeUrl(TVProfileStorage.getBridgeUrl());
  }, [currentProfile]);

  const handleDeleteProfile = (id: string) => {
    TVProfileStorage.deleteProfile(id);
    setProfiles(TVProfileStorage.getProfiles());
    if (currentProfile?.id === id) {
      forgetCurrentTV();
    }
  };

  const handleCopyBridgeCmd = () => {
    navigator.clipboard.writeText('npm run bridge');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleSaveBridgeUrl = async () => {
    setIsTestingBridge(true);
    setBridgeStatus(null);
    const target = bridgeUrl.trim();
    if (!target) {
      TVProfileStorage.setBridgeUrl('');
      setBridgeStatus('Bridge URL reset to auto-detect.');
      setIsTestingBridge(false);
      return;
    }

    const testUrl = target.replace(/\/+$/, '') + '/health';
    try {
      const res = await fetch(testUrl, { method: 'GET' });
      const data = await res.json();
      if (data.status === 'ok') {
        TVProfileStorage.setBridgeUrl(target);
        setBridgeStatus('Connected to local bridge server!');
      } else {
        setBridgeStatus('Bridge returned unexpected status.');
      }
    } catch {
      setBridgeStatus('Bridge unreachable. Check IP and port.');
      TVProfileStorage.setBridgeUrl(target);
    } finally {
      setIsTestingBridge(false);
    }
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col gap-5 w-full max-w-sm px-4 select-none pb-8 animate-fadeIn">
      {/* Active Device Card */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-widest text-[#737267] font-semibold">
          Active TV Device
        </h3>

        {currentProfile ? (
          <div className="bg-[#191A15] border border-[#2A2C23] rounded-3xl p-4 flex flex-col gap-3 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center">
                  <Tv className="w-5 h-5 text-[#B6AD83]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#F1EEE3] leading-snug">
                    {currentProfile.name}
                  </h4>
                  <p className="text-xs text-[#A8A69A] font-mono">
                    {currentProfile.ip}:{currentProfile.port || 3001}
                  </p>
                </div>
              </div>

              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${
                  isConnected
                    ? 'bg-[#8F9E6D]/15 text-[#D5CBA8] border border-[#8F9E6D]/30'
                    : 'bg-[#25261F] text-[#737267] border border-[#36382E]'
                }`}
              >
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#2A2C23]">
              <button
                type="button"
                onClick={() => connectTV(currentProfile)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#25261F] hover:bg-[#2F3127] text-xs text-[#F1EEE3] font-medium flex items-center justify-center gap-1.5 border border-[#36382E] transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#B6AD83]" />
                <span>Reconnect</span>
              </button>

              <button
                type="button"
                disabled={!isConnected}
                onClick={powerOff}
                className="py-2 px-3 rounded-xl bg-[#C95D53]/15 hover:bg-[#C95D53]/25 text-xs text-[#C95D53] font-medium flex items-center justify-center gap-1.5 border border-[#C95D53]/30 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Power Off</span>
              </button>

              <button
                type="button"
                onClick={forgetCurrentTV}
                className="py-2 px-3 rounded-xl bg-[#25261F] hover:bg-[#C95D53]/20 text-xs text-[#737267] hover:text-[#C95D53] flex items-center justify-center transition-colors border border-[#36382E] cursor-pointer"
                title="Forget TV Credentials"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#191A15] border border-dashed border-[#2A2C23] rounded-3xl p-6 text-center text-xs text-[#737267] flex flex-col items-center gap-2">
            <Tv className="w-8 h-8 opacity-40 text-[#B6AD83]" />
            <p>No active TV connected</p>
          </div>
        )}
      </div>

      {/* Local Bridge Runner & Transport Config */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-widest text-[#737267] font-semibold flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-[#B6AD83]" />
          <span>Local Bridge Relay (LAN Fallback)</span>
        </h3>

        <div className="bg-[#191A15] border border-[#2A2C23] rounded-2xl p-3.5 flex flex-col gap-2.5">
          <p className="text-[11px] text-[#A8A69A] leading-relaxed">
            When using the deployed web app on your phone or PC, run the secure local bridge on any computer on your Wi-Fi:
          </p>

          <div className="flex items-center justify-between bg-[#12130F] px-3 py-2 rounded-xl border border-[#25261F]">
            <code className="text-[#D5CBA8] font-mono text-[11px]">npm run bridge</code>
            <button
              type="button"
              onClick={handleCopyBridgeCmd}
              className="flex items-center gap-1 text-[10px] text-[#B6AD83] hover:text-[#F1EEE3] cursor-pointer"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-[#8F9E6D]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <input
              type="text"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder="http://localhost:3005"
              className="flex-1 h-9 px-2.5 rounded-xl bg-[#12130F] border border-[#25261F] text-[#F1EEE3] text-xs font-mono focus:outline-none focus:border-[#B6AD83]"
            />
            <button
              type="button"
              onClick={handleSaveBridgeUrl}
              disabled={isTestingBridge}
              className="h-9 px-3 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-xs text-[#F1EEE3] font-medium cursor-pointer"
            >
              {isTestingBridge ? 'Testing...' : 'Save'}
            </button>
          </div>

          {bridgeStatus && (
            <span className="text-[10px] text-[#D5CBA8] pt-0.5">{bridgeStatus}</span>
          )}
        </div>
      </div>

      {/* Saved TVs List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-widest text-[#737267] font-semibold">
            Saved TVs ({profiles.length})
          </h3>
          <button
            type="button"
            onClick={onAddDevice}
            className="text-xs text-[#B6AD83] hover:text-[#D5CBA8] flex items-center gap-1 font-medium cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add TV</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-[#191A15] border border-[#2A2C23] rounded-2xl p-3 flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#F1EEE3]">{p.name}</span>
                <span className="text-[11px] text-[#737267] font-mono">{p.ip}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => connectTV(p)}
                  className="px-3 py-1.5 rounded-xl bg-[#B6AD83]/15 hover:bg-[#B6AD83]/25 text-[#D5CBA8] text-xs font-medium border border-[#B6AD83]/30 transition-colors cursor-pointer"
                >
                  Connect
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(p.id)}
                  className="p-1.5 text-[#737267] hover:text-[#C95D53] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network & Security Architecture Note */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] uppercase tracking-widest text-[#737267] font-semibold flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-[#B6AD83]" />
          <span>Local Security Architecture</span>
        </h3>
        <div className="bg-[#191A15] border border-[#2A2C23] rounded-2xl p-3.5 text-xs text-[#A8A69A] space-y-2 shadow-sm">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-[#8F9E6D] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong className="text-[#F1EEE3]">Direct Local Wi-Fi Connection:</strong> All TV commands run directly between your phone and your television over secure local SSAP WebSocket. Your keys remain stored safely on your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
