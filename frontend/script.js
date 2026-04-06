document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const resultContainer = document.getElementById('result-container');
    const generatedImage = document.getElementById('generated-image');
    const emptyPreview = document.getElementById('empty-preview');
    const loadingOverlay = document.getElementById('loading-overlay');
    const imageActions = document.getElementById('image-actions');
    const downloadBtn = document.getElementById('download-btn');
    const clearPromptBtn = document.getElementById('clear-prompt-btn');
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
    const surpriseBtn = document.getElementById('surprise-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const btnSpinner = document.getElementById('btn-spinner');
    const historyFab = document.getElementById('history-fab');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // --- API Configuration ---
    const API_URL = 'http://localhost:5008';

    // --- Mobile: Swipe History Sidebar ---
    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    historyFab?.addEventListener('click', openSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Touch swipe: swipe right from left edge to open, swipe left to close
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', (e) => {
        const delta = e.changedTouches[0].clientX - touchStartX;
        if (touchStartX < 30 && delta > 60) openSidebar();
        else if (delta < -60 && sidebar.classList.contains('open')) closeSidebar();
    }, { passive: true });

    // --- Mobile: Tap-to-Expand (Fullscreen Modal) ---
    generatedImage?.addEventListener('click', () => {
        if (!generatedImage.src || generatedImage.classList.contains('hidden')) return;
        modalImage.src = generatedImage.src;
        imageModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });

    closeModalBtn?.addEventListener('click', () => {
        imageModal.classList.add('hidden');
        document.body.style.overflow = '';
    });

    imageModal?.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });

    // --- Theme Logic ---
    const savedTheme = localStorage.getItem('sparkai-theme') || 'light';
    if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('sparkai-theme', 'light');
            updateThemeIcon('light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('sparkai-theme', 'dark');
            updateThemeIcon('dark');
        }
    });

    function updateThemeIcon(theme) {
        themeIcon.className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    }

    // --- Toasts ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'ph-check-circle';
        if (type === 'error') icon = 'ph-warning-circle';
        else if (type === 'info') icon = 'ph-info';

        toast.innerHTML = `<i class="ph ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Utility tools ---
    clearPromptBtn.addEventListener('click', () => {
        promptInput.value = '';
        promptInput.focus();
    });

    copyPromptBtn.addEventListener('click', () => {
        if (!promptInput.value) return;
        navigator.clipboard.writeText(promptInput.value);
        showToast('Prompt copied to clipboard');
    });

    // --- Surprise Me Logic ---
    const surprisePrompts = [
        "A serene minimal landscape with a lone tree and a glowing moon, pastel colors",
        "A highly detailed portrait of a cyberpunk female bounty hunter with glowing eyes, raining",
        "A magical underwater city with floating glowing jellyfish and mermaids, concept art",
        "An impossibly huge medieval castle sitting atop a floating island, epic lighting",
        "A cute little rusty robot gardening on Mars, steampunk aesthetic, warm sunlight",
        "A cozy witch's cottage deep in an autumnal forest, glowing cauldrons and magic books"
    ];

    surpriseBtn.addEventListener('click', () => {
        const randomPrompt = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
        promptInput.value = randomPrompt;
        promptInput.focus();
        updatePromptQuality();
    });

    // --- Prompt Chips Logic ---
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const currentPrompt = promptInput.value.trim();
            const chipText = chip.innerText;
            if(currentPrompt.includes(chipText)) return;
            
            if(currentPrompt === '') {
                promptInput.value = chipText;
            } else {
                promptInput.value = `${currentPrompt}, ${chipText}`;
            }
            promptInput.focus();
            updatePromptQuality();
        });
    });

    // --- Prompt Quality Logic ---
    const qualityBadge = document.getElementById('quality-badge');
    const qualityBar = document.getElementById('quality-bar-fill');
    const qualityTip = document.getElementById('quality-tip');

    const powerWords = [
        'detailed', 'hyperrealistic', 'cinematic', 'lighting', '4k', '8k', 'masterpiece',
        'vibrant', 'mood', 'atmosphere', 'sharp', 'render', 'unreal engine', 'ghibli', 'neon',
        'photorealistic', 'portrait', 'landscape', 'highly', 'textured', 'soft', 'glowing'
    ];

    function updatePromptQuality() {
        const text = promptInput.value.trim().toLowerCase();
        let score = 0;
        
        if (text.length === 0) {
            qualityBadge.className = 'quality-badge';
            qualityBadge.textContent = 'Start typing...';
            qualityBar.style.width = '0%';
            qualityBar.className = 'quality-bar-fill';
            qualityTip.textContent = 'Add more detail, colors, styles or mood to improve quality.';
            return;
        }

        // Length score (up to 40 points)
        score += Math.min(text.length * 0.8, 40);

        // Word count score (up to 20 points)
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        score += Math.min(wordCount * 4, 20);

        // Keyword score (up to 40 points)
        let foundKeywords = 0;
        powerWords.forEach(word => {
            if (text.includes(word)) foundKeywords++;
        });
        score += Math.min(foundKeywords * 8, 40);

        // Cap score at 100
        score = Math.min(score, 100);
        qualityBar.style.width = `${score}%`;

        if (score < 30) {
            qualityBadge.textContent = 'Bad';
            qualityBadge.className = 'quality-badge bad';
            qualityBar.className = 'quality-bar-fill bad';
            qualityTip.textContent = 'Keep going! Try adding specific objects or a setting.';
        } else if (score < 60) {
            qualityBadge.textContent = 'Good';
            qualityBadge.className = 'quality-badge good';
            qualityBar.className = 'quality-bar-fill good';
            qualityTip.textContent = 'Getting better! Add lighting or style descriptors.';
        } else if (score < 85) {
            qualityBadge.textContent = 'Great';
            qualityBadge.className = 'quality-badge great';
            qualityBar.className = 'quality-bar-fill great';
            qualityTip.textContent = 'Great prompt! You will get some solid results now.';
        } else {
            qualityBadge.textContent = 'Excellent';
            qualityBadge.className = 'quality-badge excellent';
            qualityBar.className = 'quality-bar-fill excellent';
            qualityTip.textContent = 'Professional level! Your visual results will be stunning.';
        }
    }

    promptInput.addEventListener('input', updatePromptQuality);

    // --- History Logic ---
    async function loadHistory() {
        try {
            const res = await fetch(`${API_URL}/history`);
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            renderHistory(data);
        } catch (e) {
            console.error(e);
            showToast('Error loading history', 'error');
        }
    }

    function renderHistory(items) {
        // Clear except empty state block
        historyList.innerHTML = '<div class="empty-state" id="history-empty"><i class="ph ph-image"></i><p>No history yet</p></div>';
        const emptyState = document.getElementById('history-empty');

        if (!items || items.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        emptyState.style.display = 'none';

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';

            const thumb = item.imageUrl || '';
            const dt = new Date(item.createdAt).toLocaleString();

            el.innerHTML = `
                <img src="${thumb}" alt="thumb" class="history-item-thumb">
                <div class="history-item-details">
                    <p class="history-prompt" title="${item.prompt}">${item.prompt}</p>
                    <p class="history-date">${dt}</p>
                </div>
                <button class="icon-btn text-danger history-del-btn" data-id="${item._id}" title="Delete">
                    <i class="ph ph-trash"></i>
                </button>
            `;

            // Regenerate on click
            el.addEventListener('click', (e) => {
                if (e.target.closest('.history-del-btn')) return; // Ignore delete
                promptInput.value = item.prompt;
                showImagePreview(item.imageUrl, item.prompt);
                showToast('Loaded from history', 'info');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });

            // Delete
            const delBtn = el.querySelector('.history-del-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteHistoryItem(item._id);
            });

            historyList.appendChild(el);
        });
    }

    async function deleteHistoryItem(id) {
        try {
            const res = await fetch(`${API_URL}/history/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            showToast('Item deleted');
            loadHistory();
        } catch (e) {
            showToast('Failed to delete item', 'error');
        }
    }

    clearAllBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all history?')) return;
        try {
            const res = await fetch(`${API_URL}/history`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            showToast('All history cleared');

            // clear preview if active
            emptyPreview.style.display = 'flex';
            generatedImage.classList.add('hidden');
            imageActions.classList.add('hidden');
            resultContainer.classList.add('empty');
            generatedImage.src = '';

            loadHistory();
        } catch (e) {
            showToast('Failed to clear history', 'error');
        }
    });

    // --- Specifications Logic ---
    const ratioBtns = document.querySelectorAll('.ratio-btn');
    let currentWidth = 1024;
    let currentHeight = 1024;
    let currentSize = "1024x1024";

    ratioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ratioBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWidth = parseInt(btn.dataset.width);
            currentHeight = parseInt(btn.dataset.height);
            currentSize = btn.dataset.size;
            
            // Dynamically change the preview container's layout to match!
            resultContainer.style.aspectRatio = `${currentWidth} / ${currentHeight}`;
            
            // Re-apply hidden empty class cleanly if the image isn't loaded yet
            if (resultContainer.classList.contains('empty')) {
                // it just stretches the empty box beautifully
            }
        });
    });

    // --- Settings Setup ---
    const styleSelect = document.getElementById('style-select');

    // --- Generation Logic ---
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateImage();
        }
    });

    generateBtn.addEventListener('click', generateImage);
    
    regenerateBtn.addEventListener('click', generateImage);

    async function generateImage() {
        let prompt = promptInput.value.trim();
        if (!prompt) {
            showToast('Please enter a prompt', 'error');
            promptInput.focus();
            return;
        }

        // Apply style if selected
        const selectedStyle = styleSelect.value;
        if (selectedStyle !== 'none') {
            prompt = `${prompt}, ${selectedStyle}`;
        }

        // Set Loading state
        generateBtn.disabled = true;
        btnSpinner.classList.remove('hidden');
        document.querySelector('.btn-text').textContent = 'Generating...';

        resultContainer.classList.remove('empty');
        emptyPreview.style.display = 'none';
        loadingOverlay.classList.remove('hidden');
        imageActions.classList.add('hidden');

        try {
            const response = await fetch(`${API_URL}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt, 
                    width: currentWidth, 
                    height: currentHeight, 
                    size: currentSize
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate image');
            }

            showImagePreview(data.imageUrl, prompt);
            showToast('Image generated successfully!');
            loadHistory(); // refresh history

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
            // Revert preview state
            loadingOverlay.classList.add('hidden');
            if (!generatedImage.src || generatedImage.src === window.location.href) {
                resultContainer.classList.add('empty');
                emptyPreview.style.display = 'flex';
            } else {
                imageActions.classList.remove('hidden');
            }
        } finally {
            generateBtn.disabled = false;
            btnSpinner.classList.add('hidden');
            document.querySelector('.btn-text').textContent = 'Generate Image';
        }
    }

    function showImagePreview(url, promptStr) {
        // Build image and preloader
        const img = new Image();
        img.onload = () => {
            generatedImage.src = url;
            generatedImage.classList.remove('hidden');
            loadingOverlay.classList.add('hidden');
            imageActions.classList.remove('hidden');
            downloadBtn.dataset.url = url;
            downloadBtn.dataset.name = promptStr.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            resultContainer.classList.remove('empty');
            emptyPreview.style.display = 'none';
        };
        img.onerror = () => {
            generatedImage.src = url;
            generatedImage.classList.remove('hidden');
            loadingOverlay.classList.add('hidden');
            imageActions.classList.remove('hidden');
            downloadBtn.dataset.url = url;
            downloadBtn.dataset.name = promptStr.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
            resultContainer.classList.remove('empty');
            emptyPreview.style.display = 'none';
        };
        img.src = url;
    }

    downloadBtn.addEventListener('click', async () => {
        const url = downloadBtn.dataset.url;
        const name = downloadBtn.dataset.name || 'AI-Image';
        if (!url) return;

        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `SparkAI_${name}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);

            showToast('Download started');
        } catch (e) {
            // fallback
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.click();
        }
    });

    // --- Init ---
    loadHistory();
});
