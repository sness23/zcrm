interface Video {
  id: string;
  title: string;
  filename: string;
  created: string;
  tags?: string[];
  type?: 'file' | 'youtube';
  url?: string;
}

/**
 * Load video metadata from markdown files in vault/videos/
 * For now, returns hardcoded data. In a production app, this would:
 * 1. Fetch markdown files from the vault/videos directory
 * 2. Parse the YAML frontmatter
 * 3. Return the video metadata
 */
export async function loadVideos(): Promise<Video[]> {
  console.log('[loadVideos] Starting to load videos from API...');

  // YouTube video to show first
  const youtubeVideos: Video[] = [
    {
      id: 'youtube-1',
      title: 'How to Sell SAAS',
      filename: '',
      created: new Date().toISOString(),
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=LjbaTHoiBJs',
      tags: ['SAAS', 'Sales', 'Business']
    }
  ];

  try {
    const response = await fetch('http://localhost:9600/api/videos');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const fileVideos: Video[] = data.videos.map((v: Video) => ({
      ...v,
      type: 'file'
    }));

    const allVideos = [...youtubeVideos, ...fileVideos];
    console.log(`[loadVideos] Loaded ${allVideos.length} videos (${youtubeVideos.length} YouTube, ${fileVideos.length} files):`, allVideos);
    return allVideos;
  } catch (error) {
    console.error('[loadVideos] Error loading videos from API:', error);

    // Fallback to just YouTube videos if API fails
    console.log('[loadVideos] Returning YouTube videos only as fallback');
    return youtubeVideos;
  }
}
