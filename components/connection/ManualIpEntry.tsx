'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tv,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Server,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Smartphone,
  Download,
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfile } from '../../src/integrations/tv/types';
import { TVProfileStorage } from '../../src/storage/tv-store';
import { NativeAndroidTransport } from '../../src/transport/native-transport';

interface ManualIpEntryProps {
  onSuccess?: () => void;
  onPairingNeeded?: () => void;
}

type BridgeState = 'checking' | 'connected' | 'disconnected' | 'security_error';

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

  // Platform detection
  const [isNativeAndroid, setIsNativeAndroid] = useState(false);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);

  // Manual IP toggle
  const [showManualIp, setShowManualIp] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.10');

  // Local Bridge State & Probe (Desktop / Remote bridge mode)
  const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:3005');
  const [bridgeState, setBridgeState] = useState<BridgeState>('checking');
  const [bridgeVersion, setBridgeVersion] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showBridgeConfig, setShowBridgeConfig] = useState(false);
  const [showArchInfo, setShowArchInfo] = useState(false);

  // Detect platform on mount
  useEffect(() => {
    const native = NativeAndroidTransport.isAvailable();
    setIsNativeAndroid(native);
    if (typeof navigator !== 'undefined') {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobileBrowser(mobile && !native);
    }
  }, []);

  // Check bridge status (only needed in browser mode)
  const checkBridgeHealth = useCallback(async (targetUrlOverride?: string) => {
    if (NativeAndroidTransport.isAvailable()) {
      setBridgeState('connected');
      return true;
    }

    setBridgeState('checking');
    setErrorMsg(null);

    const baseUrl = (targetUrlOverride || bridgeUrl).trim().replace(/\/+$/, '');
    const healthUrl = `${baseUrl}/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok') {
          setBridgeState('connected');
          setBridgeVersion(data.version || '1.1.0');
          if (data.token) {
            TVProfileStorage.setBridgeToken(data.token);
          }
          TVProfileStorage.setBridgeUrl(baseUrl);
          return true;
        }
      }
      setBridgeState('disconnected');
      return false;
    } catch (err: unknown) {
      const errStr = String(err);
      if (errStr.includes('AbortError') || errStr.includes('aborted')) {
        setBridgeState('disconnected');
      } else if (errStr.includes('Failed to fetch') || errStr.includes('NetworkError')) {
        const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
        if (isHttpsPage && !baseUrl.includes('127.0.0.1') && !baseUrl.includes('localhost')) {
          setBridgeState('security_error');
        } else {
          setBridgeState('disconnected');
        }
      } else {
        setBridgeState('disconnected');
      }
      return false;
    }
  }, [bridgeUrl]);

  // Initial load: get saved bridge config & probe
  useEffect(() => {
    if (!NativeAndroidTransport.isAvailable()) {
      const saved = TVProfileStorage.getBridgeUrl() || 'http://127.0.0.1:3005';
      setBridgeUrl(saved);
      checkBridgeHealth(saved);
    } else {
      setBridgeState('connected');
    }
  }, [checkBridgeHealth]);

  // Auto-scan Wi-Fi for TVs on mount
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

    const isNative = NativeAndroidTransport.isAvailable();

    // If running in browser and bridge is disconnected, guide user appropriately
    if (!isNative && bridgeState !== 'connected') {
      const isOk = await checkBridgeHealth();
      if (!isOk) {
        setIsConnecting(false);
        if (isMobileBrowser) {
          setErrorMsg(
            'Mobile browsers cannot connect directly to TVs. Please install the standalone LG Control Android App, or enter your computer\'s Wi-Fi IP address for the bridge.'
          );
        } else {
          setErrorMsg('Local bridge is not running. Please run "npm run bridge" in your terminal first.');
        }
        return;
      }
    }

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

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm px-4 select-none animate-fadeIn pb-8">
      {/* Header Icon */}
      <div className="flex flex-col items-center text-center gap-2 mt-2">
        <div className="w-16 h-16 rounded-3xl bg-[#191A15] border border-[#2A2C23] shadow-card flex items-center justify-center relative">
          <Tv className="w-8 h-8 text-[#B6AD83]" />
          <span
            className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#10110E] ${
              isNativeAndroid || bridgeState === 'connected' ? 'bg-[#8F9E6D]' : 'bg-[#D5CBA8]'
            }`}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold text-[#F1EEE3] tracking-tight">Connect to LG TV</h2>
          <p className="text-xs text-[#A8A69A]">Local network control for LG webOS Smart TVs</p>
        </div>
      </div>

      {/* PLATFORM CARD 1: Native Android App Standalone Mode */}
      {isNativeAndroid ? (
        <div className="w-full bg-[#191A15] border border-[#8F9E6D]/30 rounded-3xl p-4 flex flex-col gap-2.5 shadow-card text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#8F9E6D]" />
              <span className="text-xs font-bold text-[#F1EEE3]">Standalone Android App</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#8F9E6D]/15 text-[#D5CBA8] border border-[#8F9E6D]/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8F9E6D] animate-pulse" />
              <span>Direct Wi-Fi Ready</span>
            </span>
          </div>
          <p className="text-[11px] text-[#A8A69A] leading-relaxed">
            Connected directly to your LG TV over local Wi-Fi. No laptop, computer, or bridge server required!
          </p>
        </div>
      ) : isMobileBrowser ? (
        /* PLATFORM CARD 2: Mobile Web Browser (Guides user to install APK or use host bridge) */
        <div className="w-full bg-[#191A15] border border-[#B6AD83]/30 rounded-3xl p-4 flex flex-col gap-3 shadow-card text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#B6AD83]" />
              <span className="text-xs font-bold text-[#F1EEE3]">Mobile Web Browser</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#B6AD83]/15 text-[#D5CBA8] border border-[#B6AD83]/30">
              Web Mode
            </span>
          </div>

          <p className="text-[11px] text-[#A8A69A] leading-relaxed">
            Mobile web browsers block direct local TV connections. To control your TV with your laptop closed, install the standalone Android App:
          </p>

          <a
            href="https://github.com/PrathmeshBhilare/tv-remote/releases/download/android-latest/LG-Control.apk"
            className="w-full py-2.5 px-3 rounded-2xl bg-[#D5CBA8] hover:bg-[#E3DAB9] text-[#10110E] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-[#10110E]" />
            <span>Install LG Control Android App (4.5 MB)</span>
          </a>

          <div className="flex flex-col gap-1.5 pt-1 border-t border-[#25261F]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#737267] uppercase font-semibold">Or use computer bridge:</span>
              <button
                type="button"
                onClick={() => setShowBridgeConfig(!showBridgeConfig)}
                className="text-[10px] text-[#B6AD83] hover:text-[#D5CBA8] transition-colors cursor-pointer"
              >
                {showBridgeConfig ? 'Hide' : 'Configure Bridge IP'}
              </button>
            </div>

            {showBridgeConfig && (
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="http://192.168.1.5:3005"
                    className="flex-1 h-8 px-2.5 rounded-xl bg-[#10110E] border border-[#2A2C23] text-[#F1EEE3] text-xs font-mono focus:outline-none focus:border-[#B6AD83]"
                  />
                  <button
                    type="button"
                    onClick={() => checkBridgeHealth()}
                    className="h-8 px-3 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-xs text-[#F1EEE3] font-medium cursor-pointer"
                  >
                    Test
                  </button>
                </div>
                <span className="text-[10px] text-[#737267]">
                  Enter your laptop/PC&apos;s local Wi-Fi IP running <code className="text-[#D5CBA8]">npm run bridge</code>.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* PLATFORM CARD 3: Desktop Browser (Bridge Status Indicator Card) */
        <div className="w-full bg-[#191A15] border border-[#2A2C23] rounded-3xl p-4 flex flex-col gap-3 shadow-card text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Server className="w-4 h-4 text-[#B6AD83]" />
              <span className="text-xs font-bold text-[#F1EEE3]">Local Bridge Service</span>
            </div>

            {/* Status Badge */}
            {bridgeState === 'checking' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#25261F] text-[#A8A69A] border border-[#36382E] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D5CBA8] animate-pulse" />
                <span>Detecting...</span>
              </span>
            )}

            {bridgeState === 'connected' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#8F9E6D]/15 text-[#D5CBA8] border border-[#8F9E6D]/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-[#8F9E6D]" />
                <span>Connected (v{bridgeVersion || '1.1'})</span>
              </span>
            )}

            {bridgeState === 'disconnected' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C95D53]/15 text-[#C95D53] border border-[#C95D53]/30 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-[#C95D53]" />
                <span>Not Running</span>
              </span>
            )}

            {bridgeState === 'security_error' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#C95D53]/15 text-[#C95D53] border border-[#C95D53]/30 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-[#C95D53]" />
                <span>Network Blocked</span>
              </span>
            )}
          </div>

          {/* Dynamic Bridge Guidance */}
          {bridgeState === 'connected' ? (
            <div className="bg-[#12130F] border border-[#8F9E6D]/20 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-[#A8A69A]">
              <CheckCircle2 className="w-4 h-4 text-[#8F9E6D] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Bridge is active on <strong className="text-[#F1EEE3] font-mono">{bridgeUrl}</strong>. Commands will be verified and relayed directly to your LG TV on Wi-Fi.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 pt-1">
              <p className="text-[11px] text-[#A8A69A] leading-relaxed">
                Web browsers on public HTTPS (Vercel) cannot reach private TV IP addresses directly. Start the local bridge on your computer to connect:
              </p>

              {/* Run Command Copy Box */}
              <div className="flex items-center justify-between bg-[#12130F] px-3 py-2.5 rounded-2xl border border-[#25261F]">
                <code className="text-[#D5CBA8] font-mono text-xs">npm run bridge</code>
                <button
                  type="button"
                  onClick={handleCopyBridgeCmd}
                  className="flex items-center gap-1 text-[11px] text-[#B6AD83] hover:text-[#F1EEE3] cursor-pointer transition-colors"
                >
                  {copiedCmd ? <Check className="w-3.5 h-3.5 text-[#8F9E6D]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Bridge Host URL Input */}
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#737267] uppercase font-semibold">Bridge Address:</span>
                  <button
                    type="button"
                    onClick={() => setShowBridgeConfig(!showBridgeConfig)}
                    className="text-[10px] text-[#B6AD83] hover:text-[#D5CBA8] transition-colors cursor-pointer"
                  >
                    {showBridgeConfig ? 'Hide Settings' : 'Change Port / IP'}
                  </button>
                </div>

                {showBridgeConfig ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={bridgeUrl}
                      onChange={(e) => setBridgeUrl(e.target.value)}
                      placeholder="http://127.0.0.1:3005"
                      className="flex-1 h-9 px-2.5 rounded-xl bg-[#191A15] border border-[#2A2C23] text-[#F1EEE3] text-xs font-mono focus:outline-none focus:border-[#B6AD83]"
                    />
                    <button
                      type="button"
                      onClick={() => checkBridgeHealth()}
                      className="h-9 px-3 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-xs text-[#F1EEE3] font-medium cursor-pointer"
                    >
                      Test
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#A8A69A]">{bridgeUrl}</span>
                    <button
                      type="button"
                      onClick={() => checkBridgeHealth()}
                      className="text-xs text-[#B6AD83] hover:text-[#D5CBA8] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry Probe</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Target TV Selection Card */}
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
            Tap below to pair. An <strong className="text-[#F1EEE3]">8-digit pairing code</strong> will appear on your TV screen.
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-[#C95D53]/15 border border-[#C95D53]/30 text-[#C95D53] text-xs flex items-center gap-2 text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#C95D53]" />
            <span>{errorMsg}</span>
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
            <>
              <span>Connect &amp; Pair with TV</span>
            </>
          )}
        </button>
      </div>

      {/* Manual IP / Custom TV Address toggle */}
      <div className="w-full flex flex-col items-center">
        <button
          type="button"
          onClick={() => setShowManualIp(!showManualIp)}
          className="text-xs text-[#A8A69A] hover:text-[#F1EEE3] flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Different TV IP address?</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManualIp ? 'rotate-180' : ''}`} />
        </button>

        {showManualIp && (
          <form
            onSubmit={handleManualSubmit}
            className="w-full mt-3 p-3 bg-[#191A15] border border-[#2A2C23] rounded-2xl flex flex-col gap-2.5 animate-fadeIn text-left"
          >
            <label className="text-[11px] text-[#A8A69A]">TV IP Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                placeholder="192.168.1.10"
                className="flex-1 h-10 px-3 rounded-xl bg-[#10110E] border border-[#2A2C23] text-xs font-mono text-[#F1EEE3] focus:outline-none focus:border-[#B6AD83]"
              />
              <button
                type="submit"
                disabled={isConnecting}
                className="h-10 px-4 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-xs font-semibold text-[#F1EEE3] cursor-pointer"
              >
                Connect
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Architecture Explainer toggle */}
      <div className="w-full flex flex-col items-center pt-2">
        <button
          type="button"
          onClick={() => setShowArchInfo(!showArchInfo)}
          className="text-[11px] text-[#737267] hover:text-[#A8A69A] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Why is a bridge or APK required?</span>
        </button>

        {showArchInfo && (
          <div className="w-full mt-3 p-3.5 bg-[#12130F] border border-[#25261F] rounded-2xl text-[11px] text-[#A8A69A] text-left leading-relaxed flex flex-col gap-2 animate-fadeIn">
            <p>
              <strong className="text-[#F1EEE3]">Browser Security vs Native Network:</strong>
            </p>
            <p>
              LG webOS TVs use private local IP addresses and internal self-signed TLS certificates on port 3001. Public HTTPS websites (like Vercel) are blocked by web browsers from establishing raw sockets to untrusted local certificates.
            </p>
            <p>
              The <strong className="text-[#D5CBA8]">LG Control Android App</strong> runs natively with raw socket permissions, allowing direct connection to your TV over Wi-Fi without needing a laptop or bridge server.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
