'use client';

import React, { useState, useEffect } from 'react';
import {
  Tv,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';

interface PairingScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({ onBack, onSuccess }) => {
  const {
    currentProfile,
    connectionState,
    submitPairingPin,
    connectTV,
    runPostPairingSelfTest,
    forgetCurrentTV,
  } = useTV();

  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'pin' | 'prompt'>('pin');
  const [showCertHelp, setShowCertHelp] = useState(false);

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Sync mode with connectionState if TV requests PROMPT or PIN
  useEffect(() => {
    if (connectionState === 'pairing_prompt') {
      setMode('prompt');
    } else {
      setMode('pin');
    }
  }, [connectionState]);

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const ok = await submitPairingPin(cleanPin);
      if (ok) {
        onSuccess();
      } else {
        setErrorMessage('Incorrect code. Please check the code on your TV screen and try again.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'PIN submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-submit when exactly 8 digits entered
  const handlePinChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 8);
    setPin(digitsOnly);
    setErrorMessage(null);

    if (digitsOnly.length === 8 && !isSubmitting) {
      setTimeout(() => {
        setIsSubmitting(true);
        submitPairingPin(digitsOnly)
          .then((ok) => {
            if (ok) {
              onSuccess();
            } else {
              setErrorMessage('Incorrect code. Check TV screen.');
            }
          })
          .catch((err) => {
            setErrorMessage(err instanceof Error ? err.message : 'Verification failed');
          })
          .finally(() => setIsSubmitting(false));
      }, 150);
    }
  };

  const handleRequestNewCode = async () => {
    setPin('');
    setErrorMessage(null);
    if (currentProfile) {
      const res = await connectTV(currentProfile, 'PIN');
      if (!res.success && res.error) {
        setErrorMessage(res.error);
        setShowCertHelp(true);
      }
    }
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col items-center w-full max-w-sm px-4 select-none pb-6 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between w-full mb-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl text-tv-textSecondary hover:text-tv-textPrimary hover:bg-tv-surface transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-semibold uppercase tracking-wider text-tv-textMuted">
          LG TV Pairing
        </span>

        <div className="w-9" />
      </div>

      {/* Target TV Header */}
      <div className="flex items-center gap-3 p-3 bg-tv-surface border border-tv-border rounded-2xl w-full mb-4 shadow-remoteButton">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Tv className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex flex-col text-left">
          <h3 className="text-sm font-bold text-tv-textPrimary leading-tight">
            {currentProfile?.name || 'LG Smart TV'}
          </h3>
          <span className="text-xs text-tv-textSecondary font-mono">{currentProfile?.ip || '192.168.1.10'}</span>
        </div>
      </div>

      {/* SUCCESS STATE */}
      {isConnected ? (
        <div className="flex flex-col items-center text-center gap-4 w-full bg-tv-surface border border-emerald-500/30 rounded-2xl p-6 shadow-remoteButton animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-base font-bold text-tv-textPrimary">Connected Successfully!</h4>
            <p className="text-xs text-tv-textSecondary">
              Your remote is paired. TV credentials are saved.
            </p>
          </div>

          <button
            type="button"
            onClick={onSuccess}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors cursor-pointer mt-2"
          >
            Open Remote
          </button>
        </div>
      ) : mode === 'pin' ? (
        /* PIN CODE ENTRY */
        <form
          onSubmit={handlePinSubmit}
          className="flex flex-col gap-4 bg-tv-surface border border-tv-border rounded-2xl p-5 shadow-remoteButton w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex flex-col text-left">
              <h4 className="text-sm font-bold text-tv-textPrimary">Enter Code Shown on TV</h4>
              <p className="text-[11px] text-tv-textSecondary">
                Look at your TV screen for the 8-digit code.
              </p>
            </div>
          </div>

          {/* Large PIN Input */}
          <div className="flex flex-col gap-2 mt-1">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="••••••••"
              autoFocus
              disabled={isSubmitting}
              className="w-full h-14 text-center tracking-[0.4em] font-mono text-2xl font-bold bg-tv-bg border-2 border-tv-border focus:border-blue-500 focus:outline-none rounded-xl text-tv-textPrimary transition-all placeholder:tracking-widest placeholder:text-tv-textMuted"
            />
            <div className="flex justify-between items-center text-[10px] text-tv-textMuted px-1">
              <span>{pin.length} / 8 digits</span>
              <button
                type="button"
                onClick={handleRequestNewCode}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                Resend code to TV
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Certificate Authorization Helper for Deployed HTTPS apps */}
          {(showCertHelp || isHttps) && (
            <div className="bg-tv-bg border border-tv-border rounded-xl p-3 flex flex-col gap-2 w-full text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-tv-textPrimary flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                  Code not appearing on TV?
                </span>
                <button
                  type="button"
                  onClick={() => setShowCertHelp(!showCertHelp)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                >
                  {showCertHelp ? 'Hide' : 'Fix now'}
                </button>
              </div>

              {showCertHelp && (
                <div className="flex flex-col gap-2 pt-1 text-[11px] text-tv-textSecondary">
                  <p className="leading-relaxed">
                    On deployed web apps, your browser must allow the TV&apos;s self-signed security certificate once:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-tv-textMuted text-[10px]">
                    <li>Tap <strong>Authorize TV</strong> below (opens new tab)</li>
                    <li>Tap <strong>&ldquo;Advanced&rdquo;</strong> &rarr; <strong>&ldquo;Proceed to {currentProfile?.ip || '192.168.1.10'} (unsafe)&rdquo;</strong></li>
                    <li>Return here and tap <strong>&ldquo;Resend code to TV&rdquo;</strong></li>
                  </ol>
                  <a
                    href={`https://${currentProfile?.ip || '192.168.1.10'}:3001`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 h-9 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Authorize TV in Browser (Tap Once)</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pin.length < 4 || isSubmitting}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-remoteButton transition-all disabled:opacity-40 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Connect Remote</span>
            )}
          </button>

          {/* Switch to on-screen prompt mode if TV displays Yes/Allow prompt instead */}
          <button
            type="button"
            onClick={() => {
              setMode('prompt');
              if (currentProfile) connectTV(currentProfile, 'PROMPT');
            }}
            className="text-xs text-tv-textMuted hover:text-tv-textSecondary text-center pt-1 transition-colors cursor-pointer"
          >
            Did the TV show an &quot;Allow / Yes&quot; prompt instead?
          </button>
        </form>
      ) : (
        /* ON SCREEN PROMPT MODE */
        <div className="flex flex-col items-center text-center gap-4 bg-tv-surface border border-tv-border rounded-2xl p-5 shadow-remoteButton w-full">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center animate-pulse">
            <Tv className="w-7 h-7 text-blue-400" />
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="text-base font-bold text-tv-textPrimary">Check Your TV Screen</h4>
            <p className="text-xs text-tv-textSecondary leading-relaxed">
              An authorization prompt is showing on your TV screen.
            </p>
            <div className="bg-tv-bg border border-tv-border/80 rounded-xl p-3 text-xs text-blue-300 font-medium my-1">
              Select <strong className="text-white underline decoration-blue-500">Yes / Allow</strong> on your TV using the physical remote.
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode('pin');
              if (currentProfile) connectTV(currentProfile, 'PIN');
            }}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            Did TV show an 8-digit code? Switch to Code entry
          </button>
        </div>
      )}

      {/* Cancel */}
      <div className="flex justify-center w-full pt-4">
        <button
          type="button"
          onClick={() => {
            forgetCurrentTV();
            onBack();
          }}
          className="text-xs text-tv-textMuted hover:text-rose-400 transition-colors cursor-pointer"
        >
          Cancel &amp; Change TV
        </button>
      </div>
    </div>
  );
};
