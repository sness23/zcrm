import { useEffect, useRef, useState } from 'react';
import GridLayout from './components/GridLayout';
import { loadGridConfig, resolveGridConfig } from './utils/gridParser';
import type { ResolvedColumn, GridPosition } from './types/GridConfig';

interface Video {
  id: string;
  title: string;
  filename: string;
  created: string;
  tags?: string[];
  type?: 'file' | 'youtube';
  url?: string;
}

interface VideoPlayerProps {
  videos: Video[];
}

// Helper function to extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // youtube.com/watch?v=ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }

    // youtu.be/ID
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1);
    }

    return null;
  } catch (error) {
    console.error('[extractYouTubeId] Error parsing URL:', error);
    return null;
  }
}

// Helper function to convert YouTube URL to embed URL
function getYouTubeEmbedUrl(url: string): string {
  const videoId = extractYouTubeId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}

export default function VideoPlayer({ videos }: VideoPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showHUD, setShowHUD] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [viewMode, setViewMode] = useState<'player' | 'list'>('list');
  const [gridColumns, setGridColumns] = useState<ResolvedColumn[]>([]);
  const [gridPosition, setGridPosition] = useState<GridPosition>({ column: 0, row: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const hudTimeoutRef = useRef<number | null>(null);

  console.log('[VideoPlayer] Initialized with videos:', videos);

  // Load grid configuration
  useEffect(() => {
    async function loadGrid() {
      console.log('[VideoPlayer] Loading grid configuration...');
      const config = await loadGridConfig();
      const resolved = resolveGridConfig(config, videos);
      setGridColumns(resolved);
      console.log('[VideoPlayer] Grid loaded:', resolved);
    }

    if (videos.length > 0) {
      loadGrid();
    }
  }, [videos]);

  // Handle grid navigation
  const handleGridNavigate = (direction: 'up' | 'down' | 'left' | 'right') => {
    setGridPosition(prev => {
      const newPos = { ...prev };

      switch (direction) {
        case 'up':
          newPos.row = Math.max(0, prev.row - 1);
          break;
        case 'down':
          if (gridColumns[prev.column]) {
            newPos.row = Math.min(gridColumns[prev.column].videos.length - 1, prev.row + 1);
          }
          break;
        case 'left':
          newPos.column = Math.max(0, prev.column - 1);
          // Adjust row if new column has fewer videos
          if (gridColumns[newPos.column]) {
            newPos.row = Math.min(prev.row, gridColumns[newPos.column].videos.length - 1);
          }
          break;
        case 'right':
          newPos.column = Math.min(gridColumns.length - 1, prev.column + 1);
          // Adjust row if new column has fewer videos
          if (gridColumns[newPos.column]) {
            newPos.row = Math.min(prev.row, gridColumns[newPos.column].videos.length - 1);
          }
          break;
      }

      console.log(`[VideoPlayer] Grid navigation: ${direction}, position:`, newPos);
      return newPos;
    });
  };

  // Handle video selection from grid
  const handleGridVideoSelect = (video: Video, position: GridPosition) => {
    console.log('[VideoPlayer] Video selected from grid:', video.title, position);
    setGridPosition(position);

    // Find the video index in the all-videos array
    const videoIndex = videos.findIndex(v => v.id === video.id);
    if (videoIndex !== -1) {
      setCurrentIndex(videoIndex);
    }

    // Switch to player mode
    setViewMode('player');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to toggle between player and list view (works in both modes)
      if (e.key === 'Escape') {
        e.preventDefault();
        setViewMode(prev => prev === 'player' ? 'list' : 'player');
        console.log(`[VideoPlayer] ESC pressed, switching to ${viewMode === 'player' ? 'list' : 'player'} view`);
        return;
      }

      // Ctrl+/ to toggle keyboard shortcuts help (works in both modes)
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        console.log(`[VideoPlayer] Ctrl+/ pressed, shortcuts help ${!showShortcuts ? 'shown' : 'hidden'}`);
        return;
      }

      // All remaining keys only work in player mode
      if (viewMode === 'list') return;

      // Alt+Left/Right to navigate between columns in player mode
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        console.log('[VideoPlayer] Alt+Left pressed, moving to previous column');

        // Calculate new position
        const newColumn = Math.max(0, gridPosition.column - 1);
        if (newColumn !== gridPosition.column && gridColumns[newColumn]) {
          const newRow = Math.min(gridPosition.row, gridColumns[newColumn].videos.length - 1);
          const newPosition = { column: newColumn, row: newRow };
          setGridPosition(newPosition);

          // Find and play the video at new position
          const video = gridColumns[newColumn].videos[newRow];
          if (video) {
            const videoIndex = videos.findIndex(v => v.id === video.id);
            if (videoIndex !== -1) {
              setCurrentIndex(videoIndex);
              console.log('[VideoPlayer] Switched to column', newColumn, 'row', newRow, ':', video.title);
            }
          }
        }
        return;
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        console.log('[VideoPlayer] Alt+Right pressed, moving to next column');

        // Calculate new position
        const newColumn = Math.min(gridColumns.length - 1, gridPosition.column + 1);
        if (newColumn !== gridPosition.column && gridColumns[newColumn]) {
          const newRow = Math.min(gridPosition.row, gridColumns[newColumn].videos.length - 1);
          const newPosition = { column: newColumn, row: newRow };
          setGridPosition(newPosition);

          // Find and play the video at new position
          const video = gridColumns[newColumn].videos[newRow];
          if (video) {
            const videoIndex = videos.findIndex(v => v.id === video.id);
            if (videoIndex !== -1) {
              setCurrentIndex(videoIndex);
              console.log('[VideoPlayer] Switched to column', newColumn, 'row', newRow, ':', video.title);
            }
          }
        }
        return;
      }

      // Navigate to next/previous video with Up/Down arrows
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        console.log('[VideoPlayer] Arrow Down pressed, moving to next video');
        setCurrentIndex((prev) => (prev + 1) % videos.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        console.log('[VideoPlayer] Arrow Up pressed, moving to previous video');
        setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
      }
      // Seek forward/backward with Left/Right arrows (like YouTube)
      else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (videoRef.current) {
          const seekAmount = 5; // 5 seconds forward
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + seekAmount,
            videoRef.current.duration
          );
          console.log(`[VideoPlayer] Seeking forward ${seekAmount}s to ${videoRef.current.currentTime.toFixed(2)}s`);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (videoRef.current) {
          const seekAmount = 5; // 5 seconds backward
          videoRef.current.currentTime = Math.max(
            videoRef.current.currentTime - seekAmount,
            0
          );
          console.log(`[VideoPlayer] Seeking backward ${seekAmount}s to ${videoRef.current.currentTime.toFixed(2)}s`);
        }
      }
      // Number keys 0-9 jump to 0%-90% of video (like YouTube)
      // Don't interfere with browser shortcuts like Ctrl+0 (zoom reset)
      else if (e.key >= '0' && e.key <= '9' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (videoRef.current && videoRef.current.duration) {
          const percent = parseInt(e.key) * 10; // 0 -> 0%, 1 -> 10%, ..., 9 -> 90%
          const targetTime = (videoRef.current.duration * percent) / 100;
          videoRef.current.currentTime = targetTime;
          console.log(`[VideoPlayer] Number ${e.key} pressed, jumping to ${percent}% (${targetTime.toFixed(2)}s)`);
        }
      }
      // Spacebar to play/pause (like YouTube)
      else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        console.log('[VideoPlayer] Spacebar pressed, toggling play/pause');
        if (videoRef.current) {
          if (videoRef.current.paused) {
            console.log('[VideoPlayer] Video paused, playing...');
            videoRef.current.play().catch(err => {
              console.error('[VideoPlayer] Play failed:', err);
            });
          } else {
            console.log('[VideoPlayer] Video playing, pausing...');
            videoRef.current.pause();
          }
        }
      }
      // J/K/L keys (YouTube shortcuts)
      else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          console.log('[VideoPlayer] J pressed, seeking -10s');
        }
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        console.log('[VideoPlayer] K pressed, toggling play/pause');
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(err => console.error('[VideoPlayer] Play failed:', err));
          } else {
            videoRef.current.pause();
          }
        }
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.currentTime = Math.min(
            videoRef.current.currentTime + 10,
            videoRef.current.duration
          );
          console.log('[VideoPlayer] L pressed, seeking +10s');
        }
      }
      // M to mute/unmute (YouTube shortcut)
      else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (videoRef.current) {
          videoRef.current.muted = !videoRef.current.muted;
          console.log(`[VideoPlayer] M pressed, ${videoRef.current.muted ? 'muted' : 'unmuted'}`);
        }
      }
      // F for fullscreen (YouTube shortcut)
      else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (videoRef.current) {
          if (!document.fullscreenElement) {
            videoRef.current.requestFullscreen().catch(err => {
              console.error('[VideoPlayer] Fullscreen failed:', err);
            });
            console.log('[VideoPlayer] F pressed, entering fullscreen');
          } else {
            document.exitFullscreen();
            console.log('[VideoPlayer] F pressed, exiting fullscreen');
          }
        }
      }
    };

    const handleMouseMove = () => {
      // Show HUD on mouse movement
      setShowHUD(true);

      // Only auto-hide if video is playing
      if (videoRef.current && !videoRef.current.paused) {
        if (hudTimeoutRef.current) {
          clearTimeout(hudTimeoutRef.current);
        }
        hudTimeoutRef.current = setTimeout(() => {
          setShowHUD(false);
          console.log('[VideoPlayer] HUD auto-hidden after mouse movement');
        }, 2000); // Hide after 2 seconds of no movement
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [videos, viewMode, gridPosition, gridColumns, showShortcuts]);

  useEffect(() => {
    console.log('[VideoPlayer] Current index changed to:', currentIndex);
    console.log('[VideoPlayer] Current video:', videos[currentIndex]);

    // Auto-play when video changes
    if (videoRef.current) {
      const videoElement = videoRef.current;
      const videoSrc = `/vault/assets/videos/${videos[currentIndex].filename}`;

      console.log('[VideoPlayer] Loading video source:', videoSrc);

      // Add event listeners for debugging
      const handleLoadStart = () => console.log('[Video Event] loadstart');
      const handleLoadedMetadata = () => console.log('[Video Event] loadedmetadata');
      const handleLoadedData = () => console.log('[Video Event] loadeddata');
      const handleCanPlay = () => console.log('[Video Event] canplay');
      const handleCanPlayThrough = () => console.log('[Video Event] canplaythrough');
      const handlePlay = () => {
        console.log('[Video Event] play');
        // Show HUD briefly, then hide after 1 second
        setShowHUD(true);
        if (hudTimeoutRef.current) {
          clearTimeout(hudTimeoutRef.current);
        }
        hudTimeoutRef.current = setTimeout(() => {
          setShowHUD(false);
          console.log('[VideoPlayer] HUD auto-hidden after 1 second');
        }, 1000);
      };
      const handlePlaying = () => console.log('[Video Event] playing');
      const handlePause = () => {
        console.log('[Video Event] pause');
        // Show HUD when paused
        setShowHUD(true);
        if (hudTimeoutRef.current) {
          clearTimeout(hudTimeoutRef.current);
        }
      };
      const handleError = (e: Event) => {
        console.error('[Video Event] error:', e);
        if (videoElement.error) {
          console.error('[Video Error Details]', {
            code: videoElement.error.code,
            message: videoElement.error.message,
            MEDIA_ERR_ABORTED: videoElement.error.MEDIA_ERR_ABORTED,
            MEDIA_ERR_NETWORK: videoElement.error.MEDIA_ERR_NETWORK,
            MEDIA_ERR_DECODE: videoElement.error.MEDIA_ERR_DECODE,
            MEDIA_ERR_SRC_NOT_SUPPORTED: videoElement.error.MEDIA_ERR_SRC_NOT_SUPPORTED,
          });
        }
      };

      videoElement.addEventListener('loadstart', handleLoadStart);
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.addEventListener('loadeddata', handleLoadedData);
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('canplaythrough', handleCanPlayThrough);
      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('playing', handlePlaying);
      videoElement.addEventListener('pause', handlePause);
      videoElement.addEventListener('error', handleError);

      videoRef.current.load();
      console.log('[VideoPlayer] Called video.load()');

      videoRef.current.play()
        .then(() => {
          console.log('[VideoPlayer] ✓ video.play() succeeded');
        })
        .catch(err => {
          console.error('[VideoPlayer] ✗ video.play() failed:', err.message || err);
        });

      // Cleanup listeners
      return () => {
        videoElement.removeEventListener('loadstart', handleLoadStart);
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('canplaythrough', handleCanPlayThrough);
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('playing', handlePlaying);
        videoElement.removeEventListener('pause', handlePause);
        videoElement.removeEventListener('error', handleError);
        if (hudTimeoutRef.current) {
          clearTimeout(hudTimeoutRef.current);
        }
      };
    }
  }, [currentIndex, videos]);

  if (videos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl mb-4">No videos found</h1>
          <p className="text-gray-400">Add video files to vault/videos/</p>
        </div>
      </div>
    );
  }

  const currentVideo = videos[currentIndex];

  // List View with Grid Layout
  if (viewMode === 'list') {
    return (
      <GridLayout
        columns={gridColumns}
        selectedPosition={gridPosition}
        onVideoSelect={handleGridVideoSelect}
        onNavigate={handleGridNavigate}
      />
    );
  }

  // Player View
  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      {/* Video or YouTube Embed */}
      {currentVideo.type === 'youtube' && currentVideo.url ? (
        <iframe
          className="h-full w-full"
          src={getYouTubeEmbedUrl(currentVideo.url)}
          title={currentVideo.title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <video
          ref={videoRef}
          className="h-full w-auto max-w-full object-contain"
          loop
          playsInline
          controls={showHUD}
          muted
          src={`/vault/assets/videos/${currentVideo.filename}`}
        >
          Your browser does not support the video tag.
        </video>
      )}

      {/* Video Info Overlay */}
      <div className={`absolute bottom-20 left-0 right-0 px-6 py-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${showHUD ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <h2 className="text-white text-xl font-semibold mb-2">
          {currentVideo.title}
        </h2>
        {currentVideo.tags && currentVideo.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentVideo.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm text-white/80 bg-white/20 px-2 py-1 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Indicators */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 transition-opacity duration-300 ${showHUD ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length)}
          className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white transition"
          aria-label="Previous video"
        >
          ↑
        </button>
        <div className="text-white/60 text-sm text-center">
          {currentIndex + 1} / {videos.length}
        </div>
        <button
          onClick={() => setCurrentIndex((prev) => (prev + 1) % videos.length)}
          className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white transition"
          aria-label="Next video"
        >
          ↓
        </button>
      </div>

      {/* List View Button */}
      <button
        onClick={() => setViewMode('list')}
        className={`absolute top-4 left-4 px-3 py-2 bg-black/50 hover:bg-black/70 text-white/80 hover:text-white text-xs rounded transition-all ${showHUD ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-label="View all videos"
      >
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
            <div className="bg-white/60 rounded-sm"></div>
            <div className="bg-white/60 rounded-sm"></div>
            <div className="bg-white/60 rounded-sm"></div>
            <div className="bg-white/60 rounded-sm"></div>
          </div>
          <span>List View (ESC)</span>
        </div>
      </button>

      {/* Instructions */}
      {showShortcuts && (
        <div className="absolute top-4 right-4 text-white/80 text-xs bg-black/80 px-4 py-3 rounded transition-opacity duration-300">
          <div className="space-y-0.5">
            <div className="font-semibold text-white mb-1">Keyboard Shortcuts</div>
            <div>ESC list view</div>
            <div>↑↓ next/prev video</div>
            <div>Alt+←→ prev/next column</div>
            <div>←→ seek ±5s • J/L ±10s</div>
            <div>0-9 jump to 0-90%</div>
            <div>Space/K play/pause</div>
            <div>M mute • F fullscreen</div>
            <div className="border-t border-white/20 mt-2 pt-2 text-white/60">Ctrl+/ to hide</div>
          </div>
        </div>
      )}
    </div>
  );
}
