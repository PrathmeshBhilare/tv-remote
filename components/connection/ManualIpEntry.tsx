'use client';

import React, { useState, useEffect } from 'react';
import {
  Tv,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
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

  // Manual IP toggle
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
      const res = await connectTV(profile, 'PIN');
      if (res.success) {
        onSuccess?.();
      } else if (res.requiresPin || res.requiresPrompt) {
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
        <div className="w-16 h-16 rounded-3xl bg-[#191A15] border border-[#2A2C23] shadow-card flex items-center justify-center relative">
          <Tv className="w-8 h-8 text-[#B6AD83]" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#8F9E6D] border-2 border-[#10110E]" />
        </div>

        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold text-[#F1EEE3] tracking-tight">Connect to LG TV</h2>
          <p className="text-xs text-[#A8A69A]">
            Select your TV on the local Wi-Fi network
          </p>
        </div>
      </div>

      {/* Discovered TV Card */}
      <div className="w-full bg-[#191A15] border border-[#2A2C23] rounded-3xl p-4 flex flex-col gap-3.5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center">
              <Tv className="w-5 h-5 text-[#B6AD83]" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[#F1EEE3]">
                  {selectedDevice?.name || 'LG webOS Smart TV'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#8F9E6D]/15 text-[#D5CBA8] border border-[#8F9E6D]/30">
                  Ready
                </span>
              </div>
              <span className="text-xs text-[#737267] font-mono">
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
            className="p-2 rounded-xl text-[#737267] hover:text-[#B6AD83] hover:bg-[#25261F] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-[#B6AD83]' : ''}`} />
          </button>
        </div>

        {/* Pairing Instructions */}
        <div className="bg-[#12130F] border border-[#25261F] rounded-2xl p-3 flex items-start gap-2.5 text-xs text-[#A8A69A]">
          <Sparkles className="w-4 h-4 text-[#B6AD83] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Tap below to send a pairing request. An <strong className="text-[#F1EEE3]">8-digit code will appear on your TV</strong> screen.
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#C95D53]/15 border border-[#C95D53]/30 text-[#C95D53] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#C95D53]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1-Click Browser TV Certificate Authorization for Deployed HTTPS apps */}
        {(showCertHelp || isHttps) && (
          <div className="bg-[#25261F]/70 border border-[#36382E] rounded-2xl p-3 flex flex-col gap-2.5 text-left animate-fadeIn">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#B6AD83] shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#F1EEE3]">First-Time Browser Authorization</span>
                <p className="text-[11px] text-[#A8A69A] mt-0.5 leading-relaxed">
                  LG TVs use a local self-signed certificate on port 3001. Allow it once in your browser:
                </p>
              </div>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-[#737267] text-[10px] pl-1">
              <li>Tap <strong>Authorize TV</strong> below (opens new tab)</li>
              <li>Tap <strong>&ldquo;Advanced&rdquo;</strong> &rarr; <strong>&ldquo;Proceed to {selectedDevice.ip} (unsafe)&rdquo;</strong></li>
              <li>Return here and tap <strong>&ldquo;Connect &amp; Show Code on TV&rdquo;</strong></li>
            </ol>

            <a
              href={`https://${selectedDevice.ip}:3001`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-xl bg-[#191A15] hover:bg-[#20221B] border border-[#B6AD83]/30 text-[#D5CBA8] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#B6AD83]" />
              <span>Authorize TV in Browser (Tap to Allow)</span>
            </a>
          </div>
        )}

        {/* Primary Connect Button */}
        <button
          type="button"
          disabled={isConnecting}
          onClick={() => handleStartPairing(selectedDevice.ip, selectedDevice.name)}
          className="w-full h-12 rounded-2xl bg-[#B6AD83] hover:bg-[#C4BB91] active:bg-[#9E956C] text-[#10110E] font-bold text-sm flex items-center justify-center gap-2 shadow-card transition-all disabled:opacity-40 cursor-pointer"
        >
          {isConnecting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-[#10110E]/30 border-t-[#10110E] rounded-full animate-spin" />
              <span>Connecting to TV...</span>
            </div>
          ) : (
            <span>Connect &amp; Show Code on TV</span>
          )}
        </button>
      </div>

      {/* Multiple TVs selector if more than 1 found */}
      {discoveredDevices.length > 1 && (
        <div className="w-full flex flex-col gap-1.5 p-3 bg-[#191A15] border border-[#2A2C23] rounded-2xl">
          <span className="text-[10px] text-[#737267] uppercase font-semibold">Other TVs found:</span>
          {discoveredDevices.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDevice(d)}
              className={`p-2.5 rounded-xl text-xs text-left transition-colors flex justify-between items-center cursor-pointer ${
                selectedDevice.ip === d.ip ? 'bg-[#25261F] text-[#F1EEE3] border border-[#36382E]' : 'hover:bg-[#20221B] text-[#A8A69A]'
              }`}
            >
              <span>{d.name}</span>
              <span className="font-mono text-[11px] text-[#737267]">{d.ip}</span>
            </button>
          ))}
        </div>
      )}

      {/* Manual IP Toggle */}
      <div className="w-full flex flex-col items-center pt-1">
        <button
          type="button"
          onClick={() => setShowManualIp(!showManualIp)}
          className="text-xs text-[#737267] hover:text-[#A8A69A] flex items-center gap-1 transition-colors cursor-pointer"
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
              className="flex-1 h-10 px-3 rounded-xl bg-[#191A15] border border-[#2A2C23] text-[#F1EEE3] text-xs font-mono focus:outline-none focus:border-[#B6AD83]"
            />
            <button
              type="submit"
              disabled={isConnecting || !manualIp.trim()}
              className="h-10 px-4 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-[#F1EEE3] text-xs font-medium cursor-pointer"
            >
              Connect
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
