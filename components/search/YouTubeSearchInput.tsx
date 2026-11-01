'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Play,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  CornerDownLeft,
  Tv,
  X,
  Keyboard,
} from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';
import { TVProfileStorage } from '../../src/storage/tv-store';

interface VideoResult {
  id: string;
  title: string;
  channel: string;
  duration?: string;
  thumbnailUrl?: string;
}

export const YouTubeSearchInput: React.FC = () => {
  const {
    currentProfile,
    launchApp,
    pressKey,
    sendTextToTV,
    sendEnterToTV,
    connectionState,
    openConnectModal,
  } = useTV();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSendingToTV, setIsSendingToTV] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<VideoResult[]>([]);
  const [statusResult, setStatusResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const isConnected = connectionState === 'connected';

  useEffect(() => {
    setHistory(TVProfileStorage.getSearchHistory());
  }, []);

  // 1. Submit text directly into YouTube on-screen search field on TV
  const handleSendTextToTV = async (targetQuery?: string) => {
    const q = targetQuery !== undefined ? targetQuery : query;
    if (!q.trim()) return;

    if (!isConnected) {
      openConnectModal();
      return;
    }

    setIsSendingToTV(true);
    setStatusResult(null);

    try {
      // Send text to active TV input
      const res = await sendTextToTV(q.trim());
      if (res.success) {
        TVProfileStorage.addSearchQuery(q.trim());
        setHistory(TVProfileStorage.getSearchHistory());
        setStatusResult({
          success: true,
          message: `Sent "${q.trim()}" to TV. Press Enter to search on TV.`,
        });
      } else {
        setStatusResult({
          success: false,
          message: res.error?.message || 'Could not send text to TV. Ensure search box is open.',
        });
      }
    } catch (err) {
      setStatusResult({
        success: false,
        message: err instanceof Error ? err.message : 'Text submission failed',
      });
    } finally {
      setIsSendingToTV(false);
    }
  };

  // 2. Send Enter key to submit on TV
  const handleSendEnter = async () => {
    if (!isConnected) {
      openConnectModal();
      return;
    }
    await sendEnterToTV();
    await pressKey('ENTER');
    setStatusResult({ success: true, message: 'Sent Enter key to TV.' });
  };

  // 3. Search and play directly
  const handleSearchVideos = async (targetQuery?: string) => {
    const q = targetQuery !== undefined ? targetQuery : query;
    if (!q.trim() || isSearching) return;

    setIsSearching(true);
    setStatusResult(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();

      if (data.success && data.videos) {
        setSearchResults(data.videos);
        TVProfileStorage.addSearchQuery(q.trim());
        setHistory(TVProfileStorage.getSearchHistory());

        if (data.videos.length === 0) {
          setStatusResult({ success: false, message: `No videos found for "${q.trim()}".` });
        }
      } else {
        setStatusResult({ success: false, message: data.error || 'Failed to search YouTube' });
      }
    } catch (err) {
      setStatusResult({
        success: false,
        message: err instanceof Error ? err.message : 'Search request failed',
      });
    } finally {
      setIsSearching(false);
    }
  };

  // 4. Play video on TV directly
  const handlePlayOnTV = async (video: VideoResult) => {
    if (!isConnected) {
      openConnectModal();
      return;
    }

    setIsPlaying(video.id);
    setStatusResult(null);

    try {
      const res = await launchApp('youtube.leanback.v4', {
        contentId: video.id,
      });

      if (res.success) {
        setStatusResult({
          success: true,
          message: `Now playing "${video.title}" on TV!`,
        });
      } else {
        setStatusResult({
          success: false,
          message: res.error?.message || 'Could not launch video on TV',
        });
      }
    } catch (err) {
      setStatusResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to play on TV',
      });
    } finally {
      setIsPlaying(null);
    }
  };

  const handleClearHistory = () => {
    TVProfileStorage.clearSearchHistory();
    setHistory([]);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm px-4 select-none pb-8 animate-fadeIn">
      {/* Connected TV Indicator Header */}
      <div className="flex items-center justify-between p-3 bg-[#191A15] border border-[#2A2C23] rounded-2xl shadow-card">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#25261F] border border-[#36382E] flex items-center justify-center">
            <Tv className="w-4 h-4 text-[#B6AD83]" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-[#F1EEE3]">
              {currentProfile?.name || 'LG Smart TV'}
            </span>
            <span className="text-[10px] text-[#737267] font-mono">
              {currentProfile?.ip || '192.168.1.10'}
            </span>
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

      {/* Title & Description */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-bold text-[#F1EEE3] flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-[#B6AD83]" />
          <span>YouTube Search &amp; Typing</span>
        </h2>
        <p className="text-xs text-[#A8A69A] leading-relaxed">
          Type on your phone to send text directly into the YouTube search field on your TV.
        </p>
      </div>

      {/* Large Luxury Search Input */}
      <div className="flex flex-col gap-2.5">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSendTextToTV();
              }
            }}
            placeholder="Type search query for TV..."
            disabled={isSearching || isSendingToTV}
            className="w-full h-13 pl-4 pr-12 rounded-2xl bg-[#191A15] border border-[#2A2C23] text-[#F1EEE3] placeholder-[#4A4B42] text-sm focus:outline-none focus:border-[#B6AD83] focus:ring-1 focus:ring-[#B6AD83]/30 transition-all font-medium shadow-card"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#737267] hover:text-[#F1EEE3] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Buttons Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Send text to active TV search box */}
          <button
            type="button"
            disabled={!query.trim() || isSendingToTV}
            onClick={() => handleSendTextToTV()}
            className="h-11 rounded-2xl bg-[#B6AD83] hover:bg-[#C4BB91] active:bg-[#9E956C] text-[#10110E] font-bold text-xs flex items-center justify-center gap-2 shadow-card transition-all disabled:opacity-40 cursor-pointer"
          >
            {isSendingToTV ? (
              <div className="w-4 h-4 border-2 border-[#10110E]/30 border-t-[#10110E] rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Send to TV</span>
              </>
            )}
          </button>

          {/* Search videos to play directly */}
          <button
            type="button"
            disabled={!query.trim() || isSearching}
            onClick={() => handleSearchVideos()}
            className="h-11 rounded-2xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-[#F1EEE3] font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer shadow-remoteButton"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-[#F1EEE3]/30 border-t-[#F1EEE3] rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-3.5 h-3.5 text-[#B6AD83]" />
                <span>Search Videos</span>
              </>
            )}
          </button>
        </div>

        {/* Enter Key Action Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendEnter}
            disabled={!isConnected}
            className="flex-1 h-9 rounded-xl bg-[#191A15] hover:bg-[#20221B] border border-[#2A2C23] text-xs font-medium text-[#F1EEE3] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <CornerDownLeft className="w-3.5 h-3.5 text-[#B6AD83]" />
            <span>Press Enter on TV</span>
          </button>
        </div>
      </div>

      {/* Result Status Banner */}
      {statusResult && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 animate-fadeIn ${
            statusResult.success
              ? 'bg-[#8F9E6D]/15 border-[#8F9E6D]/30 text-[#D5CBA8]'
              : 'bg-[#C95D53]/15 border-[#C95D53]/30 text-[#C95D53]'
          }`}
        >
          {statusResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-[#8F9E6D] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#C95D53] shrink-0" />
          )}
          <span className="leading-snug">{statusResult.message}</span>
        </div>
      )}

      {/* Recent Search History Chips */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wider text-[#737267] font-semibold flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#B6AD83]" />
              Recent Searches
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[10px] text-[#737267] hover:text-[#C95D53] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {history.slice(0, 8).map((term, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setQuery(term);
                  handleSendTextToTV(term);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#191A15] hover:bg-[#25261F] border border-[#2A2C23] text-xs text-[#A8A69A] hover:text-[#F1EEE3] transition-colors cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Direct Video Results List */}
      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-xs font-semibold text-[#A8A69A] px-1">
            Tap to Play on TV:
          </span>
          <div className="flex flex-col gap-2">
            {searchResults.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => handlePlayOnTV(video)}
                disabled={isPlaying === video.id}
                className="w-full p-2.5 rounded-2xl bg-[#191A15] hover:bg-[#20221B] active:bg-[#25261F] border border-[#2A2C23] text-left flex items-center gap-3 transition-all cursor-pointer group shadow-card"
              >
                <div className="relative w-18 h-12 rounded-xl bg-[#25261F] overflow-hidden shrink-0 border border-white/5">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-[#B6AD83]" />
                    </div>
                  )}
                  {video.duration && (
                    <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[8px] font-mono text-white/90">
                      {video.duration}
                    </span>
                  )}
                </div>

                <div className="flex flex-col flex-1 min-w-0 pr-1">
                  <span className="text-xs font-semibold text-[#F1EEE3] line-clamp-2 leading-snug group-hover:text-[#D5CBA8] transition-colors">
                    {video.title}
                  </span>
                  <span className="text-[10px] text-[#737267] truncate mt-0.5">
                    {video.channel}
                  </span>
                </div>

                <div className="w-8 h-8 rounded-full bg-[#25261F] group-hover:bg-[#B6AD83] text-[#B6AD83] group-hover:text-[#10110E] flex items-center justify-center shrink-0 transition-colors">
                  {isPlaying === video.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compact TV On-Screen Keyboard D-Pad Navigation */}
      <div className="flex flex-col gap-2 mt-2 p-3.5 rounded-3xl bg-[#191A15] border border-[#2A2C23] shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#F1EEE3] flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-[#B6AD83]" />
            On-Screen TV Keyboard D-Pad
          </span>
          <span className="text-[10px] text-[#737267]">Navigate on TV</span>
        </div>

        <p className="text-[11px] text-[#737267] leading-relaxed">
          If YouTube&apos;s on-screen keyboard is open on your TV, use these directional keys to select letters:
        </p>

        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
          <button
            type="button"
            onClick={() => pressKey('UP')}
            className="w-12 h-10 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] flex items-center justify-center text-[#F1EEE3] transition-colors cursor-pointer"
          >
            <ChevronUp className="w-5 h-5 text-[#B6AD83]" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => pressKey('LEFT')}
              className="w-12 h-10 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] flex items-center justify-center text-[#F1EEE3] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-[#B6AD83]" />
            </button>

            <button
              type="button"
              onClick={() => pressKey('ENTER')}
              className="w-14 h-10 rounded-xl bg-[#10110E] hover:bg-[#1C1D17] border border-[#B6AD83]/40 flex items-center justify-center text-xs font-bold text-[#F1EEE3] transition-colors cursor-pointer shadow-sm"
            >
              OK
            </button>

            <button
              type="button"
              onClick={() => pressKey('RIGHT')}
              className="w-12 h-10 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] flex items-center justify-center text-[#F1EEE3] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 text-[#B6AD83]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => pressKey('DOWN')}
            className="w-12 h-10 rounded-xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] flex items-center justify-center text-[#F1EEE3] transition-colors cursor-pointer"
          >
            <ChevronDown className="w-5 h-5 text-[#B6AD83]" />
          </button>
        </div>
      </div>
    </div>
  );
};
