'use client';

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfile } from '../../src/integrations/tv/types';

interface ManualIpEntryProps {
  onSuccess?: () => void;
  onPairingNeeded?: () => void;
}

export const ManualIpEntry: React.FC<ManualIpEntryProps> = ({ onSuccess, onPairingNeeded }) => {
  const { connectTV } = useTV();

  const [discoveredDevices, setDiscoveredDevices] = useState<Array<{ ip: string; name: string }>>([
    { ip: '192.168.1.10', name: 'LG webOS Smart TV' },
  ]);
  const [selectedDevice, setSelectedDevice] = useState<{ ip: string; name: string }>({
    ip: '192.168.1.10',
    name: 'LG webOS Smart TV',
  });

  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCertHelp, setShowCertHelp] = useState(false);

  // Advanced manual IP toggle (hidden by default)
  const [showManualIp, setShowManualIp] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.10');

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Auto-scan Wi-Fi on mount
  useEffect(() => {
    let isMounted = true;
    const scan = async () => {
      setIsScanning(true);
      try {
        const res = await fetch('/api/tv/discover');
        const data = await res.json();
        if (isMounted && data.devices && data.devices.length > 0) {
          setDiscoveredDevices(data.devices);
          setSelectedDevice(data.devices[0]);
          setManualIp(data.devices[0].ip);
        }
      } catch {
        // keep default
      } finally {
        if (isMounted) setIsScanning(false);
      }
    };
    scan();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartPairing = async (ipToUse: string, nameToUse: string) => {
    setIsConnecting(true);
    setErrorMsg(null);

    const profile: TVProfile = {
      id: `tv-${ipToUse}`,
      name: nameToUse,
      ip: ipToUse,
      port: 3001,
      useSecureWs: true,
      pairingType: 'PIN',
    };

    try {
      // Connect to TV and request PIN
      const res = await connectTV(profile, 'PIN');
      if (res.success) {
        onSuccess?.();
      } else if (res.requiresPin || res.requiresPrompt) {
        // TV is now displaying the PIN code on screen!
        onPairingNeeded?.();
      } else {
        setErrorMsg(res.error || 'Could not connect to TV.');
        if (isHttps) setShowCertHelp(true);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not connect to TV.');
      if (isHttps) setShowCertHelp(true);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    handleStartPairing(manualIp.trim(), 'LG Smart TV');
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm px-4 select-none animate-fadeIn">
      {/* Header Icon */}
      <div className="flex flex-col items-center text-center gap-2 mt-2">
        <div className="w-16 h-16 rounded-3xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center relative shadow-lg shadow-blue-500/10">
          <Tv className="w-8 h-8 text-blue-400" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-tv-bg animate-pulse" />
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-tv-textPrimary tracking-tight">Connect to LG TV</h2>
          <p className="text-xs text-tv-textSecondary">
            Phone/PC and TV are connected to the same Wi-Fi.
          </p>
        </div>
      </div>

      {/* Discovered TV Card */}
      <div className="w-full bg-tv-surface border border-tv-border rounded-2xl p-4 flex flex-col gap-3.5 shadow-remoteButton">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Tv className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-tv-textPrimary">
                  {selectedDevice?.name || 'LG Smart TV'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">
                  Ready
                </span>
              </div>
              <span className="text-xs text-tv-textMuted font-mono">
                {selectedDevice?.ip || '192.168.1.10'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setIsScanning(true);
              try {
                const res = await fetch('/api/tv/discover');
                const data = await res.json();
                if (data.devices?.length) {
                  setDiscoveredDevices(data.devices);
                  setSelectedDevice(data.devices[0]);
                }
              } catch {}
              setIsScanning(false);
            }}
            disabled={isScanning}
            title="Scan Wi-Fi again"
            className="p-2 rounded-xl text-tv-textMuted hover:text-blue-400 hover:bg-tv-surfaceHover transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {/* Informative Step Notice */}
        <div className="bg-tv-bg/60 border border-tv-border/70 rounded-xl p-3 flex items-start gap-2.5 text-xs text-tv-textSecondary">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Click below. A <strong className="text-white">code will appear on your TV screen</strong>. Type that code here to pair.
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1-Click Browser TV Certificate Authorization for Deployed HTTPS apps */}
        {(showCertHelp || isHttps) && (
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 flex flex-col gap-2.5 text-left animate-fadeIn">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-tv-textPrimary">Browser Authorization (First Time Only)</span>
                <p className="text-[11px] text-tv-textSecondary mt-0.5 leading-relaxed">
                  LG TVs use a local self-signed certificate on port 3001. Allow it in your browser once:
                </p>
              </div>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-tv-textMuted text-[10px] pl-1">
              <li>Tap <strong>Authorize TV</strong> below (opens new tab)</li>
              <li>Tap <strong>&ldquo;Advanced&rdquo;</strong> &rarr; <strong>&ldquo;Proceed to {selectedDevice.ip} (unsafe)&rdquo;</strong></li>
              <li>Return here and tap <strong>&ldquo;Connect &amp; Show Code on TV&rdquo;</strong></li>
            </ol>

            <a
              href={`https://${selectedDevice.ip}:3001`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Authorize TV in Browser (Tap to Allow)</span>
            </a>
          </div>
        )}

        {/* Primary 1-Click Connect Button */}
        <button
          type="button"
          disabled={isConnecting}
          onClick={() => handleStartPairing(selectedDevice.ip, selectedDevice.name)}
          className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-remoteButton transition-all disabled:opacity-50 cursor-pointer"
        >
          {isConnecting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Requesting Code on TV...</span>
            </div>
          ) : (
            <span>Connect &amp; Show Code on TV</span>
          )}
        </button>
      </div>

      {/* Multiple TVs selector if more than 1 found */}
      {discoveredDevices.length > 1 && (
        <div className="w-full flex flex-col gap-1.5 p-3 bg-tv-surface border border-tv-border rounded-xl">
          <span className="text-[10px] text-tv-textMuted uppercase font-semibold">Other TVs found:</span>
          {discoveredDevices.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDevice(d)}
              className={`p-2 rounded-lg text-xs text-left transition-colors flex justify-between items-center ${
                selectedDevice.ip === d.ip ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-tv-surfaceHover text-tv-textSecondary'
              }`}
            >
              <span>{d.name}</span>
              <span className="font-mono text-[11px] text-tv-textMuted">{d.ip}</span>
            </button>
          ))}
        </div>
      )}

      {/* Optional Discreet Manual IP Toggle (Collapsed) */}
      <div className="w-full flex flex-col items-center pt-2">
        <button
          type="button"
          onClick={() => setShowManualIp(!showManualIp)}
          className="text-xs text-tv-textMuted hover:text-tv-textSecondary flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Different TV IP address?</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManualIp ? 'rotate-180' : ''}`} />
        </button>

        {showManualIp && (
          <form onSubmit={handleManualSubmit} className="w-full flex items-center gap-2 mt-2 animate-fadeIn">
            <input
              type="text"
              value={manualIp}
              onChange={(e) => setManualIp(e.target.value)}
              placeholder="192.168.1.10"
              className="flex-1 h-10 px-3 rounded-xl bg-tv-surface border border-tv-border text-tv-textPrimary text-xs font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={isConnecting || !manualIp.trim()}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
            >
              Connect
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
