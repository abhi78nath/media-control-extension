// youtube-extractor.js
// YouTube and YouTube Music song details extraction functionality

/**
 * Extracts song details from YouTube or YouTube Music
 * This function is injected into YouTube tabs to read the DOM
 * @returns {Object} Song details object with title, artist, album, image, duration, progress
 */
function extractYouTubeSongDetails() {
  const songDetails = {
    title: null,
    artist: null,
    album: null, // Often not available on standard YT
    image: null,
    duration: null,
    currentTime: null,
    progress: null,
    isPlaying: false
  };

  const isYouTubeMusic = window.location.hostname === 'music.youtube.com';

  if (isYouTubeMusic) {
    // --- YouTube Music Extraction ---
    const titleEl = document.querySelector('yt-formatted-string.title.style-scope.ytmusic-player-bar');
    const artistEl = document.querySelector('.byline.style-scope.ytmusic-player-bar');
    const imageEl = document.querySelector('.image.style-scope.ytmusic-player-bar');
    const timeInfo = document.querySelector('.time-info.style-scope.ytmusic-player-bar');
    const progressBar = document.querySelector('tp-yt-paper-progress.style-scope.ytmusic-player-bar'); // or slider

    if (titleEl) songDetails.title = titleEl.textContent || titleEl.title;
    if (artistEl) {
      // Artist text often includes " • Album • Year", we might need to parse it
      // Simple parse: grab the first part or the whole thing
      // The byline is complex structure, often links inside
      // Let's try to get text content and clean it up
      let text = artistEl.textContent;
      if (text) {
        // usually "Artist • Album • Year"
        const parts = text.split('•');
        songDetails.artist = parts[0]?.trim();
        if (parts.length > 1) songDetails.album = parts[1]?.trim();
      }
    }
    
    if (imageEl) {
        const img = imageEl.querySelector('img');
        if (img) songDetails.image = img.src;
    }

    if (timeInfo) {
      const timeParts = timeInfo.textContent.split('/');
      if (timeParts.length === 2) {
        songDetails.currentTime = timeParts[0].trim();
        songDetails.duration = timeParts[1].trim();
      }
    }

    if (progressBar) {
        songDetails.progress = progressBar.getAttribute('value');
    }
    
    const playButton = document.querySelector('#play-pause-button');
    if (playButton) {
        songDetails.isPlaying = playButton.getAttribute('aria-label') === 'Pause';
    }

  } else {
    // --- Standard YouTube Extraction ---
    // Note: Standard YT is trickier as it's not always music
    
    // Title
    const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer') || 
                    document.querySelector('#title h1 yt-formatted-string');
    
    // Channel (Artist proxy)
    const channelEl = document.querySelector('ytd-video-owner-renderer #channel-name a');
    
    // Description or metadata might contain "Music in this video" section, but that's hard to scrape accurately reliably
    // We'll fallback to Channel Name as artist
    
    // Player controls for time
    const videoElement = document.querySelector('video');
    const timeCurrentEl = document.querySelector('.ytp-time-current');
    const timeDurationEl = document.querySelector('.ytp-time-duration');
    const progressBar = document.querySelector('.ytp-play-progress');

    if (titleEl) songDetails.title = titleEl.textContent;
    if (channelEl) songDetails.artist = channelEl.textContent;
    
    // Valid thumbnail logic for YouTube
    // video id is in URL: v=VIDEO_ID
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    if (videoId) {
        songDetails.image = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    }

    if (timeCurrentEl) songDetails.currentTime = timeCurrentEl.textContent;
    if (timeDurationEl) songDetails.duration = timeDurationEl.textContent;
    
    if (progressBar) {
        // style width or aria-valuenow?
        // ytp-play-progress has style="transform: scaleX(0.5);" sometimes
        // easiest might be to use the video element itself if accessible
       const ariaValue = document.querySelector('.ytp-progress-bar')?.getAttribute('aria-valuenow');
       if (ariaValue) {
           // aria-valuenow is usually current time in seconds, aria-valuemax is total
           const max = document.querySelector('.ytp-progress-bar')?.getAttribute('aria-valuemax');
           if (max && max > 0) {
              songDetails.progress = (parseFloat(ariaValue) / parseFloat(max)) * 100;
           }
       }
    }
    
    // Better precision from video element if possible
    if (videoElement) {
        if (!songDetails.duration && videoElement.duration) {
            // format seconds to MM:SS
            const m = Math.floor(videoElement.duration / 60);
            const s = Math.floor(videoElement.duration % 60);
            songDetails.duration = `${m}:${s.toString().padStart(2, '0')}`;
        }
        if (videoElement.currentTime && videoElement.duration) {
             songDetails.progress = (videoElement.currentTime / videoElement.duration) * 100;
             // also update current time text if missing
             if (!songDetails.currentTime) {
                const m = Math.floor(videoElement.currentTime / 60);
                const s = Math.floor(videoElement.currentTime % 60);
                songDetails.currentTime = `${m}:${s.toString().padStart(2, '0')}`;
             }
        }
    }
  }

  return songDetails;
}

/**
 * Main function to get YouTube song details from a tab
 * @param {number} tabId - The ID of the YouTube tab
 */
function getYouTubeSongDetails(tabId) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      func: extractYouTubeSongDetails,
    },
    (results) => {
      if (chrome.runtime.lastError) {
        // Can fail if tab is restricted (e.g. chrome://) or not fully loaded
        return;
      }

      if (results && results[0] && results[0].result) {
        const details = results[0].result;
        
        // Basic validation: if no title, it's probably not a valid video page
        if (!details.title) return;

        console.log("📺 YouTube Details:", details);
        
        // Store in local storage
        chrome.storage.local.set({ [`youtubeDetails_${tabId}`]: details });
      }
    }
  );
}
