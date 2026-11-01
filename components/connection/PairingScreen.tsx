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
  ShieldCheck,
  Server,
  Smartphone,
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
        setErrorMessage('Incorrect code. Please verify the 8-digit code on your TV screen.');
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
          className="p-2 -ml-2 rounded-xl text-[#A8A69A] hover:text-[#F1EEE3] hover:bg-[#191A15] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#737267]">
          LG TV Pairing
        </span>

        <div className="w-9" />
      </div>

      {/* Target TV Header */}
      <div className="flex items-center gap-3 p-3.5 bg-[#191A15] border border-[#2A2C23] rounded-3xl w-full mb-4 shadow-card">
        <div className="w-10 h-10 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center">
          <Tv className="w-5 h-5 text-[#B6AD83]" />
        </div>
        <div className="flex flex-col text-left">
          <h3 className="text-sm font-bold text-[#F1EEE3] leading-tight">
            {currentProfile?.name || 'LG Smart TV'}
          </h3>
          <span className="text-xs text-[#737267] font-mono">{currentProfile?.ip || '192.168.1.10'}</span>
        </div>
      </div>

      {/* SUCCESS STATE */}
      {isConnected ? (
        <div className="flex flex-col items-center text-center gap-4 w-full bg-[#191A15] border border-[#8F9E6D]/35 rounded-3xl p-6 shadow-card animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-[#8F9E6D]/15 border border-[#8F9E6D]/40 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-[#8F9E6D]" />
          </div>

          <div className="flex flex-col gap-1">
            <h4 className="text-base font-bold text-[#F1EEE3]">Paired Successfully!</h4>
            <p className="text-xs text-[#A8A69A]">
              Your remote is paired with your TV. Credentials are saved.
            </p>
          </div>

          <button
            type="button"
            onClick={onSuccess}
            className="w-full h-12 rounded-2xl bg-[#B6AD83] hover:bg-[#C4BB91] active:bg-[#9E956C] text-[#10110E] font-bold text-sm transition-colors cursor-pointer mt-2"
          >
            Open Remote
          </button>
        </div>
      ) : mode === 'pin' ? (
        /* PIN CODE ENTRY */
        <form
          onSubmit={handlePinSubmit}
          className="flex flex-col gap-4 bg-[#191A15] border border-[#2A2C23] rounded-3xl p-5 shadow-card w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-[#B6AD83]" />
            </div>
            <div className="flex flex-col text-left">
              <h4 className="text-sm font-bold text-[#F1EEE3]">Enter Code Shown on TV</h4>
              <p className="text-[11px] text-[#A8A69A]">
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
              className="w-full h-14 text-center tracking-[0.45em] font-mono text-2xl font-bold bg-[#12130F] border-2 border-[#2A2C23] focus:border-[#B6AD83] focus:outline-none rounded-2xl text-[#F1EEE3] transition-all placeholder:tracking-widest placeholder:text-[#4A4B42]"
            />
            <div className="flex justify-between items-center text-[10px] text-[#737267] px-1">
              <span>{pin.length} / 8 digits</span>
              <button
                type="button"
                onClick={handleRequestNewCode}
                className="text-[#B6AD83] hover:text-[#D5CBA8] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>Resend code to TV</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-[#C95D53]/15 border border-[#C95D53]/30 text-[#C95D53] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#C95D53]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Bridge Status & Help if Code Not Appearing */}
          {errorMessage && (
            <div className="bg-[#12130F] border border-[#25261F] rounded-2xl p-3 flex flex-col gap-2 w-full text-left">
              <span className="text-[11px] font-semibold text-[#F1EEE3] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#B6AD83]" />
                Pairing Troubleshooting
              </span>
              <p className="text-[11px] text-[#A8A69A] leading-relaxed">
                If the code is not appearing on your TV, ensure the local bridge is running with <code className="text-[#D5CBA8]">npm run bridge</code> and that your TV is powered on.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={pin.length < 4 || isSubmitting}
            className="w-full h-12 rounded-2xl bg-[#B6AD83] hover:bg-[#C4BB91] active:bg-[#9E956C] text-[#10110E] font-bold text-sm flex items-center justify-center gap-2 shadow-card transition-all disabled:opacity-40 cursor-pointer"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-[#10110E]/30 border-t-[#10110E] rounded-full animate-spin" />
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
            className="text-xs text-[#737267] hover:text-[#A8A69A] text-center pt-1 transition-colors cursor-pointer"
          >
            Did the TV show an &quot;Allow / Yes&quot; prompt instead?
          </button>
        </form>
      ) : (
        /* ON SCREEN PROMPT MODE */
        <div className="flex flex-col items-center text-center gap-4 bg-[#191A15] border border-[#2A2C23] rounded-3xl p-5 shadow-card w-full">
          <div className="w-14 h-14 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center">
            <Tv className="w-7 h-7 text-[#B6AD83]" />
          </div>

          <div className="flex flex-col gap-1.5">
            <h4 className="text-base font-bold text-[#F1EEE3]">Check Your TV Screen</h4>
            <p className="text-xs text-[#A8A69A] leading-relaxed">
              An authorization prompt is showing on your TV screen.
            </p>
            <div className="bg-[#12130F] border border-[#25261F] rounded-2xl p-3 text-xs text-[#D5CBA8] font-medium my-1">
              Select <strong className="text-[#F1EEE3] underline decoration-[#B6AD83]">Yes / Allow</strong> on your TV using the physical remote.
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode('pin');
              if (currentProfile) connectTV(currentProfile, 'PIN');
            }}
            className="text-xs text-[#B6AD83] hover:text-[#D5CBA8] transition-colors cursor-pointer"
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
          className="text-xs text-[#737267] hover:text-[#C95D53] transition-colors cursor-pointer"
        >
          Cancel &amp; Change TV
        </button>
      </div>
    </div>
  );
};
