document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const loader = document.getElementById('loader');
    const videoCard = document.getElementById('video-card');
    const errorMsg = document.getElementById('error-msg');
    const errorText = document.getElementById('error-text');
    
    // Video Info Elements
    const videoTitle = document.getElementById('video-title');
    const videoUploader = document.getElementById('video-uploader');
    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoDuration = document.getElementById('video-duration');
    const formatSelect = document.getElementById('format-select');
    
    // Download Action Elements
    const downloadBtn = document.getElementById('download-btn');
    const downloadProgress = document.getElementById('download-progress');

    let currentUrl = '';
    const historyContainer = document.getElementById('history-container');
    const historyList = document.getElementById('history-list');

    loadHistory();

    fetchBtn.addEventListener('click', fetchVideoInfo);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchVideoInfo();
    });

    downloadBtn.addEventListener('click', downloadVideo);

    async function fetchVideoInfo() {
        const url = urlInput.value.trim();
        if (!url) return;

        // Reset UI
        videoCard.style.display = 'none';
        errorMsg.style.display = 'none';
        loader.style.display = 'flex';
        currentUrl = url;

        try {
            const response = await fetch('/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch video details');
            }

            populateVideoCard(data);
            loader.style.display = 'none';
            videoCard.style.display = 'block';
            
        } catch (error) {
            loader.style.display = 'none';
            showError(error.message);
        }
    }

    function populateVideoCard(data) {
        videoTitle.textContent = data.title;
        videoUploader.textContent = data.uploader || 'Unknown Channel';
        videoThumbnail.src = data.thumbnail;
        videoDuration.textContent = data.duration || '--:--';

        // Populate formats
        formatSelect.innerHTML = '';
        if (data.formats && data.formats.length > 0) {
            // Sort formats by resolution (basic sorting)
            data.formats.reverse().forEach(format => {
                const option = document.createElement('option');
                option.value = format.format_id;
                option.textContent = `${format.resolution} - ${format.ext.toUpperCase()} (${format.filesize})`;
                formatSelect.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = 'best';
            option.textContent = 'Best Available Quality';
            formatSelect.appendChild(option);
        }
    }

    async function downloadVideo() {
        const formatId = formatSelect.value;
        
        downloadBtn.style.display = 'none';
        downloadProgress.style.display = 'flex';
        errorMsg.style.display = 'none';

        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        const progressStatusText = document.getElementById('progress-status-text');

        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        progressStatusText.textContent = 'Starting download...';

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: currentUrl, format_id: formatId })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Download failed to start');
            }

            const taskId = data.task_id;
            
            // Poll for progress
            const pollInterval = setInterval(async () => {
                try {
                    const progRes = await fetch(`/progress/${taskId}`);
                    const progData = await progRes.json();
                    
                    if (!progRes.ok) throw new Error(progData.error || 'Error fetching progress');

                    if (progData.status === 'downloading') {
                        progressStatusText.textContent = 'Downloading video...';
                        progressBar.style.width = progData.progress;
                        progressPercent.textContent = progData.progress;
                    } else if (progData.status === 'processing') {
                        progressStatusText.textContent = 'Processing and merging...';
                        progressBar.style.width = '100%';
                        progressPercent.textContent = '100%';
                    } else if (progData.status === 'finished') {
                        clearInterval(pollInterval);
                        progressStatusText.textContent = 'Finished!';
                        
                        saveToHistory(videoTitle.textContent, videoThumbnail.src, formatSelect.options[formatSelect.selectedIndex].text, currentUrl);
                        showToast('Download completed successfully!', 'success');

                        setTimeout(() => {
                            downloadBtn.style.display = 'flex';
                            downloadProgress.style.display = 'none';
                            window.location.href = progData.download_url;
                        }, 1000);
                        
                    } else if (progData.status === 'error') {
                        clearInterval(pollInterval);
                        throw new Error(progData.error || 'An error occurred during download');
                    }
                } catch (err) {
                    clearInterval(pollInterval);
                    downloadBtn.style.display = 'flex';
                    downloadProgress.style.display = 'none';
                    showError(err.message);
                }
            }, 500);
            
        } catch (error) {
            downloadBtn.style.display = 'flex';
            downloadProgress.style.display = 'none';
            showError(error.message);
        }
    }

    function showError(message) {
        errorText.textContent = message;
        errorMsg.style.display = 'flex';
        showToast(message, 'error');
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-circle-info';
        if (type === 'success') icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-exclamation';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function saveToHistory(title, thumb, format, url) {
        let history = JSON.parse(localStorage.getItem('nextube_history') || '[]');
        history.unshift({ title, thumb, format, url, date: new Date().toLocaleDateString() });
        if (history.length > 5) history = history.slice(0, 5);
        localStorage.setItem('nextube_history', JSON.stringify(history));
        loadHistory();
    }

    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('nextube_history') || '[]');
        if (history.length === 0) {
            historyContainer.style.display = 'none';
            return;
        }

        historyContainer.style.display = 'block';
        historyList.innerHTML = history.map(item => `
            <div class="history-item" onclick="window.loadUrlFromHistory('${item.url}')" title="Click to fetch again">
                <img src="${item.thumb}" alt="thumbnail">
                <div class="history-item-info">
                    <div class="history-item-title">${item.title}</div>
                    <div class="history-item-format">${item.format} • ${item.date}</div>
                </div>
            </div>
        `).join('');
    }

    window.loadUrlFromHistory = function(url) {
        if (!url || url === 'undefined') {
            showToast('URL is not available for this older item.', 'error');
            return;
        }
        urlInput.value = url;
        fetchVideoInfo();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
});
