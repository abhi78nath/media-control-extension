// utils.js

/**
 * Extracts the dominant color from an image element.
 * @param {HTMLImageElement} imgEl - The image element to analyze (must have crossOrigin="Anonymous" if external).
 * @returns {Object|null} - The dominant color as {r, g, b}, or null if failed.
 */
function getDominantColor(imgEl) {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    
    // Resize to smaller dimensions for performance
    canvas.width = 50;
    canvas.height = 50;
    
    // Draw the image
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    
    // Get image data - this will fail if CORS is not handled correctly
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch(e) {
      console.error("Canvas security error (CORS):", e);
      return null;
    }
    const data = imageData.data;
    
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      // Skip transparent pixels
      if (data[i + 3] < 128) continue;
      
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    
    if (count === 0) return null;
    
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);
    
    return { r, g, b };
  } catch (e) {
    console.error("Error extracting color:", e);
    return null;
  }
}

/**
 * Calculates a contrasting text color (black or white) for a given background color.
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} - "#000000" or "#ffffff"
 */
function getContrastingTextColor(r, g, b) {
  // YIQ equation
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

/**
 * Returns a semi-transparent version of the contrasting color for secondary text.
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} - "rgba(0,0,0,0.7)" or "rgba(255,255,255,0.7)"
 */
function getSecondaryTextColor(r, g, b) {
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';
}
