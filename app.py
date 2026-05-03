from flask import Flask, render_template, request, jsonify, send_file
import yt_dlp
import os
import uuid
import imageio_ffmpeg
import threading
import re
import time

download_tasks = {}

app = Flask(__name__)
DOWNLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'downloads')
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

def cleanup_old_files():
    try:
        now = time.time()
        for filename in os.listdir(DOWNLOAD_FOLDER):
            filepath = os.path.join(DOWNLOAD_FOLDER, filename)
            if os.path.isfile(filepath) and os.stat(filepath).st_mtime < now - 3600:
                os.remove(filepath)
    except Exception:
        pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/info', methods=['POST'])
def get_info():
    cleanup_old_files()
    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            formats = info.get('formats', [])
            
            available_formats = []
            available_formats.append({
                'format_id': 'bestaudio',
                'resolution': 'Audio Only (MP3)',
                'ext': 'mp3',
                'filesize': 'Varies'
            })
            
            seen_resolutions = set()
            for f in reversed(formats):
                # Get formats that contain video
                if f.get('vcodec') != 'none' and f.get('ext') == 'mp4':
                    res = f.get('resolution') or f.get('format_note', 'unknown')
                    if res in seen_resolutions or res == 'unknown':
                        continue
                    seen_resolutions.add(res)
                    
                    format_id = f.get('format_id')
                    filesize = f.get('filesize')
                    if filesize:
                        filesize = f"{filesize / (1024 * 1024):.2f} MB"
                    else:
                        filesize = "Unknown size"

                    available_formats.append({
                        'format_id': format_id,
                        'resolution': res,
                        'ext': 'mp4',
                        'filesize': filesize
                    })
            
            # If no combined formats found, fallback to just adding a generic best option
            if not available_formats:
                available_formats.append({
                    'format_id': 'best',
                    'resolution': 'Best Available',
                    'ext': 'mp4',
                    'filesize': 'Unknown'
                })

            return jsonify({
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration_string') or info.get('duration'),
                'uploader': info.get('uploader'),
                'formats': available_formats
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    format_id = data.get('format_id', 'best')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    task_id = str(uuid.uuid4())
    filename_uuid = task_id
    filepath_template = os.path.join(DOWNLOAD_FOLDER, f"{filename_uuid}.%(ext)s")

    download_tasks[task_id] = {
        'status': 'starting',
        'progress': '0%',
        'download_url': None,
        'error': None
    }

    thread = threading.Thread(target=download_video_thread, args=(task_id, url, format_id, filepath_template, filename_uuid))
    thread.start()

    return jsonify({'task_id': task_id})

def download_video_thread(task_id, url, format_id, filepath_template, filename_uuid):
    def progress_hook(d):
        if d['status'] == 'downloading':
            percent_str = d.get('_percent_str', '0%')
            percent = re.sub(r'\x1b\[[0-9;]*m', '', percent_str).strip()
            download_tasks[task_id]['progress'] = percent
            download_tasks[task_id]['status'] = 'downloading'
        elif d['status'] == 'finished':
            download_tasks[task_id]['progress'] = '100%'
            download_tasks[task_id]['status'] = 'processing'

    if format_id == 'bestaudio':
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': filepath_template,
            'quiet': True,
            'no_warnings': True,
            'ffmpeg_location': imageio_ffmpeg.get_ffmpeg_exe(),
            'progress_hooks': [progress_hook],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
    else:
        final_format = f"{format_id}+bestaudio[ext=m4a]/best" if format_id != 'best' else 'best'
        ydl_opts = {
            'format': final_format,
            'outtmpl': filepath_template,
            'quiet': True,
            'no_warnings': True,
            'ffmpeg_location': imageio_ffmpeg.get_ffmpeg_exe(),
            'merge_output_format': 'mp4',
            'progress_hooks': [progress_hook],
        }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if format_id == 'bestaudio':
                downloaded_filename = f"{filename_uuid}.mp3"
            else:
                downloaded_ext = info.get('ext', 'mp4')
                downloaded_filename = f"{filename_uuid}.{downloaded_ext}"
            
            download_tasks[task_id]['status'] = 'finished'
            download_tasks[task_id]['download_url'] = f'/get-file/{downloaded_filename}'
    except Exception as e:
        download_tasks[task_id]['status'] = 'error'
        download_tasks[task_id]['error'] = str(e)

@app.route('/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    task = download_tasks.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify(task)

@app.route('/get-file/<filename>')
def get_file(filename):
    filepath = os.path.join(DOWNLOAD_FOLDER, filename)
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True)
    return "File not found", 404

if __name__ == '__main__':
    app.run(debug=True, port=5000)
