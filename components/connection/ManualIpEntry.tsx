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
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfile } from '../../src/integrations/tv/types';
import { TVProfileStorage } from '../../src/storage/tv-store';

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

  // Manual IP toggle
  const [showManualIp, setShowManualIp] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.10');

  // Local Bridge State & Probe
  const [bridgeUrl, setBridgeUrl] = useState('http://127.0.0.1:3005');
  const [bridgeState, setBridgeState] = useState<BridgeState>('checking');
  const [bridgeVersion, setBridgeVersion] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showBridgeConfig, setShowBridgeConfig] = useState(false);
  const [showArchInfo, setShowArchInfo] = useState(false);

  // Check bridge status
  const checkBridgeHealth = useCallback(async (targetUrlOverride?: string) => {
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
        // Detect possible Chrome Private Network Access / mixed content restriction
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
    const saved = TVProfileStorage.getBridgeUrl() || 'http://127.0.0.1:3005';
    setBridgeUrl(saved);
    checkBridgeHealth(saved);
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

    // If bridge is not running, warn the user
    if (bridgeState !== 'connected') {
      const isOk = await checkBridgeHealth();
      if (!isOk) {
        setIsConnecting(false);
        setErrorMsg('Local bridge is not running. Please run "npm run bridge" in your terminal first.');
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
              bridgeState === 'connected' ? 'bg-[#8F9E6D]' : 'bg-[#D5CBA8]'
            }`}
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold text-[#F1EEE3] tracking-tight">Connect to LG TV</h2>
          <p className="text-xs text-[#A8A69A]">Local network control for LG webOS Smart TVs</p>
        </div>
      </div>

      {/* Bridge Status Indicator Card */}
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

            {/* Bridge Host URL Input for Mobile vs Desktop */}
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#737267] uppercase font-semibold">Bridge Address:</span>
                <button
                  type="button"
                  onClick={() => setShowBridgeConfig(!showBridgeConfig)}
                  className="text-[10px] text-[#B6AD83] hover:text-[#D5CBA8] transition-colors cursor-pointer"
                >
                  {showBridgeConfig ? 'Hide Settings' : 'Using a phone?'}
                </button>
              </div>

              {showBridgeConfig ? (
                <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-[#12130F] border border-[#25261F] text-[11px] text-[#A8A69A]">
                  <p className="leading-relaxed">
                    <strong className="text-[#F1EEE3]">Notice for Mobile Phones:</strong> &ldquo;localhost&rdquo; refers to your phone. If you started the bridge on your PC, enter your PC&apos;s Wi-Fi IP address below (e.g. <code className="text-[#D5CBA8]">http://192.168.1.5:3005</code>):
                  </p>
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
            <span>Connect &amp; Pair with TV</span>
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

      {/* Accurate Capability & Setup Details */}
      <div className="w-full flex flex-col items-center pt-1">
        <button
          type="button"
          onClick={() => setShowArchInfo(!showArchInfo)}
          className="text-[11px] text-[#737267] hover:text-[#A8A69A] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Why is a local bridge required?</span>
        </button>

        {showArchInfo && (
          <div className="w-full mt-2.5 p-3.5 rounded-2xl bg-[#191A15] border border-[#2A2C23] text-[11px] text-[#A8A69A] flex flex-col gap-2 text-left animate-fadeIn">
            <span className="font-bold text-[#F1EEE3]">Browser Security Boundaries</span>
            <p className="leading-relaxed">
              1. <strong>Untrusted TLS Certificate:</strong> LG TVs generate a self-signed SSL certificate for port 3001. Web browsers on public HTTPS (Vercel) automatically abort WebSockets with untrusted certificates (ERR_CERT_AUTHORITY_INVALID).
            </p>
            <p className="leading-relaxed">
              2. <strong>Private Network Access:</strong> Chrome restricts public internet websites from opening direct connections to private LAN devices (RFC 1918) without explicit preflight headers.
            </p>
            <p className="leading-relaxed">
              3. <strong>The Bridge Solution:</strong> Running <code className="text-[#D5CBA8]">npm run bridge</code> on your computer handles the TV&apos;s TLS handshake securely via Trust-on-First-Use fingerprint verification and relays commands with zero browser security errors.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
