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
  Smartphone,
  Server,
  Copy,
  Check,
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfile } from '../../src/integrations/tv/types';
import { TransportErrorInfo } from '../../src/transport/transport';
import { TVProfileStorage } from '../../src/storage/tv-store';

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
  const [errorInfo, setErrorInfo] = useState<TransportErrorInfo | null>(null);
  const [activeFallbackTab, setActiveFallbackTab] = useState<'android' | 'bridge' | 'browser'>('android');
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Manual IP toggle
  const [showManualIp, setShowManualIp] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.10');

  // Local bridge configuration
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [isTestingBridge, setIsTestingBridge] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<string | null>(null);

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  useEffect(() => {
    setBridgeUrl(TVProfileStorage.getBridgeUrl());
  }, []);

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
    setErrorInfo(null);

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
        if (res.errorInfo) {
          setErrorInfo(res.errorInfo);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not connect to TV.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;
    handleStartPairing(manualIp.trim(), 'LG Smart TV');
  };

  const handleCopyBridgeCmd = () => {
    navigator.clipboard.writeText('npm run bridge');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleTestBridge = async () => {
    setIsTestingBridge(true);
    setBridgeStatus(null);
    const testUrl = (bridgeUrl.trim() || 'http://localhost:3005').replace(/\/+$/, '') + '/health';
    try {
      const res = await fetch(testUrl, { method: 'GET' });
      const data = await res.json();
      if (data.status === 'ok') {
        setBridgeStatus('Bridge connected successfully!');
        TVProfileStorage.setBridgeUrl(bridgeUrl.trim() || 'http://localhost:3005');
      } else {
        setBridgeStatus('Bridge returned unexpected response.');
      }
    } catch (err) {
      setBridgeStatus('Could not reach bridge server. Ensure "npm run bridge" is running.');
    } finally {
      setIsTestingBridge(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm px-4 select-none animate-fadeIn pb-8">
      {/* Header Icon */}
      <div className="flex flex-col items-center text-center gap-2 mt-2">
        <div className="w-16 h-16 rounded-3xl bg-[#191A15] border border-[#2A2C23] shadow-card flex items-center justify-center relative">
          <Tv className="w-8 h-8 text-[#B6AD83]" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#8F9E6D] border-2 border-[#10110E]" />
        </div>

        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold text-[#F1EEE3] tracking-tight">Connect to LG TV</h2>
          <p className="text-xs text-[#A8A69A]">Select your TV on the local Wi-Fi network</p>
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
            Tap below to connect. An <strong className="text-[#F1EEE3]">8-digit pairing code</strong> will appear on your TV screen.
          </p>
        </div>

        {/* Diagnostic Error Banner with Detailed Context */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#C95D53]/15 border border-[#C95D53]/30 text-xs flex flex-col gap-1.5 text-left animate-fadeIn">
            <div className="flex items-center gap-2 text-[#C95D53] font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#C95D53]" />
              <span>{errorInfo?.title || 'Connection Failed'}</span>
            </div>
            <p className="text-[11px] text-[#E0A09B] leading-relaxed">{errorMsg}</p>
            {errorInfo?.technicalDetails && (
              <span className="text-[10px] text-[#A8A69A] font-mono bg-[#12130F] p-2 rounded-xl mt-1 break-words">
                {errorInfo.technicalDetails}
              </span>
            )}
          </div>
        )}

        {/* Architecture Diagnostics & Reliable Fallback Selector */}
        {(errorMsg || isHttps) && (
          <div className="bg-[#12130F] border border-[#25261F] rounded-2xl p-3.5 flex flex-col gap-3 text-left animate-fadeIn">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-[#F1EEE3] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#B6AD83]" />
                Browser LAN Restrictions &amp; Solutions
              </span>
              <p className="text-[11px] text-[#A8A69A] leading-relaxed">
                Browsers on public HTTPS (Vercel) block direct LAN WebSockets due to self-signed TLS certificates (ERR_CERT_AUTHORITY_INVALID). Choose a reliable option:
              </p>
            </div>

            {/* Transport Fallback Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#191A15] border border-[#2A2C23] rounded-xl text-[11px]">
              <button
                type="button"
                onClick={() => setActiveFallbackTab('android')}
                className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeFallbackTab === 'android'
                    ? 'bg-[#B6AD83] text-[#10110E] font-bold shadow-sm'
                    : 'text-[#A8A69A] hover:text-[#F1EEE3]'
                }`}
              >
                1. Android App
              </button>
              <button
                type="button"
                onClick={() => setActiveFallbackTab('bridge')}
                className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeFallbackTab === 'bridge'
                    ? 'bg-[#B6AD83] text-[#10110E] font-bold shadow-sm'
                    : 'text-[#A8A69A] hover:text-[#F1EEE3]'
                }`}
              >
                2. Local Bridge
              </button>
              <button
                type="button"
                onClick={() => setActiveFallbackTab('browser')}
                className={`py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeFallbackTab === 'browser'
                    ? 'bg-[#B6AD83] text-[#10110E] font-bold shadow-sm'
                    : 'text-[#A8A69A] hover:text-[#F1EEE3]'
                }`}
              >
                3. Browser Auth
              </button>
            </div>

            {/* TAB 1: Native Android (Capacitor) */}
            {activeFallbackTab === 'android' && (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[#191A15] border border-[#2A2C23] text-xs">
                <div className="flex items-start gap-2">
                  <Smartphone className="w-4 h-4 text-[#8F9E6D] shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#F1EEE3]">Native Android Companion (Recommended)</span>
                    <p className="text-[11px] text-[#A8A69A] leading-relaxed">
                      Runs via native Android networking. Bypasses browser self-signed SSL restrictions completely with 100% reliable TV pairing.
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-[#737267] font-mono bg-[#12130F] p-2 rounded-lg">
                  Run: npx cap sync android &amp;&amp; npx cap open android
                </div>
              </div>
            )}

            {/* TAB 2: Local Bridge Runner */}
            {activeFallbackTab === 'bridge' && (
              <div className="flex flex-col gap-2.5 p-2.5 rounded-xl bg-[#191A15] border border-[#2A2C23] text-xs">
                <div className="flex items-start gap-2">
                  <Server className="w-4 h-4 text-[#B6AD83] shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[#F1EEE3]">Local Bridge Service</span>
                    <p className="text-[11px] text-[#A8A69A] leading-relaxed">
                      Run this on any laptop/computer on the same Wi-Fi. It bridges your TV commands securely:
                    </p>
                  </div>
                </div>

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

                <div className="flex gap-1.5 items-center mt-1">
                  <input
                    type="text"
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="http://localhost:3005"
                    className="flex-1 h-9 px-2.5 rounded-xl bg-[#12130F] border border-[#25261F] text-[#F1EEE3] text-xs font-mono focus:outline-none focus:border-[#B6AD83]"
                  />
                  <button
                    type="button"
                    onClick={handleTestBridge}
                    disabled={isTestingBridge}
                    className="h-9 px-3 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-xs text-[#F1EEE3] font-medium cursor-pointer"
                  >
                    {isTestingBridge ? 'Testing...' : 'Set Bridge'}
                  </button>
                </div>

                {bridgeStatus && (
                  <span className="text-[10px] text-[#D5CBA8] mt-0.5">{bridgeStatus}</span>
                )}
              </div>
            )}

            {/* TAB 3: Browser Certificate Exception */}
            {activeFallbackTab === 'browser' && (
              <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[#191A15] border border-[#2A2C23] text-xs">
                <p className="text-[11px] text-[#A8A69A] leading-relaxed">
                  To use direct browser mode on HTTPS, allow the TV&apos;s self-signed TLS cert once:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[#737267] text-[10px] pl-1">
                  <li>Tap <strong>Authorize TV</strong> below (opens new tab)</li>
                  <li>Tap <strong>Advanced</strong> &rarr; <strong>Proceed to {selectedDevice.ip} (unsafe)</strong></li>
                  <li>Return here and tap <strong>Connect Remote</strong></li>
                </ol>
                <a
                  href={`https://${selectedDevice.ip}:3001`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 h-9 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#B6AD83]/30 text-[#D5CBA8] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#B6AD83]" />
                  <span>Authorize TV in Browser (Tap to Allow)</span>
                </a>
              </div>
            )}
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
