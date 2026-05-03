# NexTube 🎥

NexTube is a premium, beautifully designed YouTube downloader built with Python (Flask) and a modern Glassmorphism frontend interface. It leverages `yt-dlp` and `FFmpeg` to seamlessly fetch and download high-resolution videos (up to 4K) as well as extract high-quality audio (MP3).

## ✨ Features

- **Premium UI/UX:** A sleek, responsive dark mode design with glassmorphism effects and fluid micro-animations.
- **High-Quality Video:** Automatically merges separated high-res video and audio tracks (1080p, 1440p, 4K) using an embedded FFmpeg binary.
- **Audio Extraction (MP3):** Dedicated one-click option to download videos purely as MP3 audio files.
- **Real-Time Progress Bar:** Tracks the background download and merging process asynchronously with zero page reloads.
- **Local Download History:** Automatically saves your 5 most recent downloads to your browser's local storage. Click on any past item to instantly repopulate and fetch it!
- **Auto-Cleanup:** A silent server-side routine routinely removes files older than an hour from the `downloads/` folder to preserve hard drive space.
- **Toast Notifications:** Elegant, non-intrusive alert popups for successes and errors.

## 🚀 Installation & Usage

1. Clone the repository:
   ```bash
   git clone https://github.com/Escgot/NexTube.git
   cd NexTube
   ```

2. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the Flask application:
   ```bash
   python app.py
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## 🛠️ Tech Stack

- **Backend:** Python, Flask, yt-dlp, imageio-ffmpeg
- **Frontend:** Vanilla JS, HTML5, CSS3 (Glassmorphism)
