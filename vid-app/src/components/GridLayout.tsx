import { useEffect, useState, useRef } from 'react';
import type { Video, ResolvedColumn, GridPosition } from '../types/GridConfig';

interface GridLayoutProps {
  columns: ResolvedColumn[];
  selectedPosition: GridPosition;
  onVideoSelect: (video: Video, position: GridPosition) => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

// Helper function to get YouTube thumbnail
function getYouTubeThumbnail(url: string): string {
  try {
    const urlObj = new URL(url);
    let videoId = '';

    if (urlObj.hostname.includes('youtube.com')) {
      videoId = urlObj.searchParams.get('v') || '';
    } else if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1);
    }

    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  } catch {
    return '';
  }
}

export default function GridLayout({
  columns,
  selectedPosition,
  onVideoSelect,
  onNavigate
}: GridLayoutProps) {
  const [, setForceRender] = useState(0);
  const selectedVideoRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onNavigate('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate('right');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Get currently selected video
        const column = columns[selectedPosition.column];
        if (column && column.videos[selectedPosition.row]) {
          onVideoSelect(column.videos[selectedPosition.row], selectedPosition);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [columns, selectedPosition, onNavigate, onVideoSelect]);

  // Force re-render when selection changes (for highlighting)
  useEffect(() => {
    setForceRender(prev => prev + 1);
  }, [selectedPosition]);

  // Auto-scroll to keep selected video in view
  useEffect(() => {
    if (selectedVideoRef.current) {
      selectedVideoRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedPosition]);

  if (columns.length === 0) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-4">No columns configured</h2>
          <p className="text-gray-400">Create vault/videos/grid-layout.yaml</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black overflow-hidden">
      {/* Columns Grid */}
      <div className="h-full overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-4 max-w-7xl mx-auto">
          {columns.map((column, colIndex) => (
            <div key={colIndex} className="flex flex-col">
              {/* Column Header */}
              <div className="mb-4 px-2">
                <h2 className="text-white text-lg font-semibold mb-1">
                  {column.name}
                </h2>
                {column.description && (
                  <p className="text-gray-400 text-xs">{column.description}</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  {column.videos.length} video{column.videos.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Videos in Column */}
              <div className="flex flex-col gap-3">
                {column.videos.map((video, rowIndex) => {
                  const isSelected = selectedPosition.column === colIndex && selectedPosition.row === rowIndex;

                  return (
                    <div
                      key={video.id}
                      ref={isSelected ? selectedVideoRef : null}
                      onClick={() => onVideoSelect(video, { column: colIndex, row: rowIndex })}
                      className={`cursor-pointer bg-gray-900 rounded-lg overflow-hidden transition-all ${
                        isSelected
                          ? 'ring-4 ring-blue-500 shadow-lg shadow-blue-500/50'
                          : 'hover:ring-2 hover:ring-white/30'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-video bg-gray-800 flex items-center justify-center relative overflow-hidden">
                        {video.type === 'youtube' && video.url ? (
                          <img
                            src={getYouTubeThumbnail(video.url)}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = getYouTubeThumbnail(video.url!).replace('hqdefault', 'mqdefault');
                            }}
                          />
                        ) : video.filename ? (
                          <img
                            src={`/vault/assets/thumbnails/${video.filename.replace('.mp4', '.jpg')}`}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.parentElement!.innerHTML = '<div class="text-white/50 text-2xl">▶</div>';
                            }}
                          />
                        ) : (
                          <div className="text-white/50 text-2xl">▶</div>
                        )}

                        {/* Type Badge */}
                        {video.type === 'youtube' && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded">
                            YouTube
                          </div>
                        )}
                      </div>

                      {/* Video Info */}
                      <div className="p-3">
                        <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 leading-tight">
                          {video.title}
                        </h3>
                        <p className="text-gray-400 text-xs">
                          {new Date(video.created).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        {video.tags && video.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {video.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] text-white/60 bg-white/10 px-1.5 py-0.5 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Empty State */}
                {column.videos.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No videos in this column</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
