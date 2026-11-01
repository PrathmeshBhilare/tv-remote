'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Play,
  PlaySquare,
  Clock,
  Trash2,
  Info,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  ArrowLeft,
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
    launchApp,
    pressKey,
    sendTextToTV,
    connectionState,
    openConnectModal,
  } = useTV();

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<VideoResult[]>([]);
  const [statusResult, setStatusResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(TVProfileStorage.getSearchHistory());
  }, []);

  // 1. Search YouTube videos to play directly on TV
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

  // 2. Play a specific video directly in the YouTube TV app
  const handlePlayOnTV = async (video: VideoResult) => {
    if (connectionState !== 'connected') {
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

  // 3. Quick play top matching result
  const handleInstantPlayFirst = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setStatusResult(null);

    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (data.success && data.videos && data.videos.length > 0) {
        setSearchResults(data.videos);
        const topVideo = data.videos[0];
        await handlePlayOnTV(topVideo);
      } else {
        setStatusResult({ success: false, message: 'No matching videos found.' });
      }
    } catch {
      setStatusResult({ success: false, message: 'Failed to find video.' });
    } finally {
      setIsSearching(false);
    }
  };

  // 4. Send text to system apps (Browser, Search dialogs)
  const handleSendRawText = async () => {
    if (connectionState !== 'connected') {
      openConnectModal();
      return;
    }
    if (!query.trim()) return;

    setStatusResult(null);
    try {
      const res = await sendTextToTV(query.trim());
      if (res.success) {
        setStatusResult({
          success: true,
          message: `Sent "${query.trim()}" to active TV input field.`,
        });
      } else {
        setStatusResult({
          success: false,
          message: res.error?.message || 'Could not send text to TV.',
        });
      }
    } catch {
      setStatusResult({ success: false, message: 'Text input failed.' });
    }
  };

  const handleClearHistory = () => {
    TVProfileStorage.clearSearchHistory();
    setHistory([]);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm px-4 select-none pb-8 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-tv-textPrimary flex items-center gap-2">
          <Search className="w-5 h-5 text-red-500" />
          YouTube Search &amp; Play
        </h2>
        <p className="text-xs text-tv-textSecondary leading-relaxed">
          Search videos to play directly on your TV, or use TV navigation below.
        </p>
      </div>

      {/* Search Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearchVideos();
        }}
        className="flex flex-col gap-2.5"
      >
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Abu Dhabi gp 2021"
            disabled={isSearching}
            className="w-full h-12 pl-4 pr-12 rounded-2xl bg-tv-surface border border-tv-border text-tv-textPrimary placeholder-tv-textMuted text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tv-textMuted hover:text-tv-textSecondary p-1 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!query.trim() || isSearching}
            onClick={() => handleSearchVideos()}
            className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-remoteButton transition-all disabled:opacity-40 cursor-pointer"
          >
            {isSearching ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Search Videos</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={!query.trim() || isSearching}
            onClick={handleInstantPlayFirst}
            className="px-4 h-11 rounded-2xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border text-tv-textPrimary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
            title="Instantly play top matching video on TV"
          >
            <Play className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>Instant Play</span>
          </button>
        </div>
      </form>

      {/* Result Status Banner */}
      {statusResult && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 animate-fadeIn ${
            statusResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="leading-snug">{statusResult.message}</span>
        </div>
      )}

      {/* Search Results List (Tap to Play on TV) */}
      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-xs font-semibold text-tv-textSecondary flex items-center gap-1.5 px-1">
            <PlaySquare className="w-3.5 h-3.5 text-red-500" />
            Tap to Play on TV:
          </span>
          <div className="flex flex-col gap-2">
            {searchResults.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => handlePlayOnTV(video)}
                disabled={isPlaying === video.id}
                className="w-full p-2.5 rounded-2xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border text-left flex items-center gap-3 transition-all cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="relative w-20 h-12 rounded-lg bg-black/40 overflow-hidden shrink-0 border border-white/5">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-red-500 fill-red-500" />
                    </div>
                  )}
                  {video.duration && (
                    <span className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[9px] font-mono text-white/90">
                      {video.duration}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col flex-1 min-w-0 pr-1">
                  <span className="text-xs font-semibold text-tv-textPrimary line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                    {video.title}
                  </span>
                  <span className="text-[11px] text-tv-textMuted truncate mt-0.5">
                    {video.channel}
                  </span>
                </div>

                {/* Play Button Icon */}
                <div className="w-8 h-8 rounded-full bg-red-500/10 group-hover:bg-red-500 text-red-400 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                  {isPlaying === video.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TV Screen Navigation D-Pad (For In-App TV Keyboard) */}
      <div className="flex flex-col gap-2 mt-2 p-3.5 rounded-2xl bg-tv-surface/60 border border-tv-border/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-tv-textSecondary flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5 text-blue-400" />
            TV Keyboard D-Pad Controls
          </span>
          <span className="text-[10px] text-tv-textMuted">Navigate on TV</span>
        </div>

        <p className="text-[11px] text-tv-textMuted leading-relaxed">
          Use these directional keys to select letters on the TV screen's on-screen keyboard:
        </p>

        {/* Compact D-Pad Controller */}
        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
          {/* UP */}
          <button
            type="button"
            onClick={() => pressKey('UP')}
            className="w-12 h-10 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border flex items-center justify-center text-tv-textPrimary transition-all cursor-pointer shadow-sm"
            title="Up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {/* LEFT - OK - RIGHT */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => pressKey('LEFT')}
              className="w-12 h-10 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border flex items-center justify-center text-tv-textPrimary transition-all cursor-pointer shadow-sm"
              title="Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => pressKey('ENTER')}
              className="w-16 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-sm"
              title="OK / Select Letter on TV"
            >
              OK
            </button>

            <button
              type="button"
              onClick={() => pressKey('RIGHT')}
              className="w-12 h-10 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border flex items-center justify-center text-tv-textPrimary transition-all cursor-pointer shadow-sm"
              title="Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* DOWN */}
          <button
            type="button"
            onClick={() => pressKey('DOWN')}
            className="w-12 h-10 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border flex items-center justify-center text-tv-textPrimary transition-all cursor-pointer shadow-sm"
            title="Down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Helper Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => pressKey('BACK')}
            className="flex-1 h-9 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border text-tv-textSecondary hover:text-tv-textPrimary text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={() => pressKey('ENTER')}
            className="flex-1 h-9 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border text-tv-textSecondary hover:text-tv-textPrimary text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <CornerDownLeft className="w-3.5 h-3.5 text-emerald-400" />
            <span>Select / OK</span>
          </button>
        </div>
      </div>

      {/* Helpful Technical Explanation Card */}
      <div className="bg-tv-surface/40 border border-tv-border/60 rounded-xl p-3 flex flex-col gap-1.5 text-[11px] text-tv-textMuted leading-relaxed">
        <p className="flex items-center gap-1.5 font-medium text-tv-textSecondary">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          Why text input differs on YouTube:
        </p>
        <p>
          The YouTube TV app uses an internal locked on-screen keyboard that ignores external phone text typing (this is an intentional restriction by Google/YouTube on Smart TVs).
        </p>
        <p>
          • <strong>To play videos:</strong> Search above and tap any video to launch it directly on your TV.
        </p>
        <p>
          • <strong>To use the on-screen keyboard:</strong> Use the D-Pad above to move and select letters on the TV screen.
        </p>
      </div>

      {/* Recent Searches */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-tv-textMuted font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Recent Searches
            </span>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[11px] text-tv-textMuted hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(item);
                  handleSearchVideos(item);
                }}
                className="px-3 py-1.5 rounded-xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border text-xs text-tv-textSecondary hover:text-tv-textPrimary transition-all cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
