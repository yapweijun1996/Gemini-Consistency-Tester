/**
 * @file AI OCR Library
 * @description A self-contained library for adding OCR functionality to a webpage.
 * It injects its own UI (modal, button) and styles to prevent conflicts.
 */
(function initOcrAuto() {
  function init() {
    // Ensure OCR UI and styles are injected into the page to make this script self-contained.
    injectAiOcrStyles();
    injectAiOcrUi();

    const aiOcrModal = document.getElementById('ai-ocr-modal');
    const aiOcrUploadBtn = document.getElementById('ai-ocr-UploadBtn');
    const aiOcrCloseButton = aiOcrModal?.querySelector('.ai-ocr-close-button');
    const aiOcrDropZone = document.getElementById('ai-ocr-drop-zone');
    const aiOcrFileInput = document.getElementById('ai-ocr-file-input');
    const aiOcrPreviewContainer = document.getElementById('ai-ocr-preview-container');
    const aiOcrSubmitBtn = document.getElementById('ai-ocr-submit');
    const aiOcrLoadingOverlay = document.getElementById('ai-ocr-loading-overlay');

    let uploadedFiles = [];
    let geminiApiKey = ''; // To hold the key once resolved
    // Accessibility and interaction state for the loader overlay
    let loaderClosable = false; // true when user can dismiss overlay (complete/error/empty)
    let previousActiveElement = null; // element to restore focus to on close
    // Tunable: default compression target per image (KB). Can be overridden by window.TNO_COMPRESS_TARGET_KB.
    const COMPRESS_TARGET_KB = Number(window.TNO_COMPRESS_TARGET_KB || 350);

    /**
     * Resolves the Gemini API key from various sources in a specific order.
     * 1. Checks for a global `window.gemini_api_key` variable.
     * 2. Checks for a key in `sessionStorage`.
     * 3. Prompts the user to enter a key.
     * @returns {string|null} The API key or null if not found.
     */
    function resolveGeminiApiKey() {
        // Priority 1: Global variable (for developers to set in HTML)
        if (window.gemini_api_key && window.gemini_api_key !== 'YOUR_GEMINI_API_KEY') {
            return window.gemini_api_key;
        }

        // Priority 2: SessionStorage (for user-provided key during the session)
        let key = sessionStorage.getItem('gemini_api_key');
        if (key && key !== 'YOUR_GEMINI_API_KEY') {
            return key;
        }

        // Priority 3: Prompt user and store in sessionStorage
        key = prompt('Please enter your Gemini API key:');
        if (key && key.trim() !== '') {
            sessionStorage.setItem('gemini_api_key', key);
            return key;
        }
        
        // If no key is provided, alert the user.
        alert('A valid Gemini API key is required to proceed.');
        return null;
    }

    // ==========================================================================================
    // SECTION: Style and UI Injection (to make the script a self-contained library)
    // ==========================================================================================
    
    function injectAiOcrStyles() {
        const styleId = 'ai-ocr-modal-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            .ai-ocr-modal {
                position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%;
                overflow: auto; background-color: rgba(0,0,0,0.4);
            }
            .ai-ocr-modal-content {
                background-color: #fefefe; margin: 15% auto; padding: 20px;
                border: 1px solid #888; width: 80%; max-width: 600px;
            }
            .ai-ocr-close-button {
                color: #aaa; float: right; font-size: 28px; font-weight: bold;
            }
            .ai-ocr-close-button:hover, .ai-ocr-close-button:focus {
                color: black; text-decoration: none; cursor: pointer;
            }
            #ai-ocr-drop-zone {
                border: 2px dashed #ccc; border-radius: 5px; padding: 25px;
                text-align: center; cursor: pointer;
            }
            #ai-ocr-drop-zone.ai-ocr-dragover {
                background-color: #f0f0f0;
            }
            #ai-ocr-file-input {
                display: none;
            }
            #ai-ocr-preview-container {
                margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px;
            }
            .ai-ocr-preview-image {
                width: 100px; height: 100px; object-fit: cover; cursor: pointer;
                transition: transform 0.2s;
            }
            .ai-ocr-preview-image:hover {
                transform: scale(1.05);
            }
            #ai-ocr-image-preview-lightbox {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.8); display: flex;
                justify-content: center; align-items: center; z-index: 1001; cursor: pointer;
            }
            #ai-ocr-image-preview-lightbox img {
                max-width: 90vw; max-height: 90vh; object-fit: contain;
            }
            #ai-ocr-image-preview-lightbox .ai-ocr-close-lightbox {
                position: absolute; top: 20px; right: 35px; color: #fff;
                font-size: 40px; font-weight: bold; cursor: pointer;
            }
            .ai-ocr-controls {
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px solid #eee;
            }
            .ai-ocr-controls label {
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
            }
            .ai-ocr-controls select {
                width: 100%;
                padding: 8px;
                margin-bottom: 10px;
                border-radius: 4px;
                border: 1px solid #ccc;
            }
            .ai-ocr-disclaimer {
                font-size: 0.8em;
                color: #666;
                text-align: center;
                margin-top: 10px;
            }
            #ai-ocr-loading-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.6); display: flex;
                justify-content: center; align-items: center; z-index: 1000;
                /* backdrop-filter: blur(5px); */ /* Disabled for performance testing */
            }
            .ai-ocr-loader-container {
                display: flex; flex-direction: column; align-items: center;
                background: white; padding: 25px; border-radius: 12px;
                box-shadow: 0 5px 25px rgba(0,0,0,0.2);
                width: 300px;
            }
            .ai-ocr-loader-icon {
                width: 48px; height: 48px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #4CAF50;
                border-radius: 50%;
                margin-bottom: 15px;
                animation: ai-ocr-spin 1s linear infinite;
            }
            @keyframes ai-ocr-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .ai-ocr-progress-bar {
                width: 100%; height: 8px; background: #e0e0e0;
                border-radius: 4px; margin: 15px 0; overflow: hidden;
            }
            .ai-ocr-progress-fill {
                height: 100%; width: 0%;
                background: linear-gradient(90deg, #4CAF50, #81C784);
                transition: width 0.3s ease-in-out;
            }
            .ai-ocr-progress-fill.error {
                background: linear-gradient(90deg, #f44336, #e57373);
            }
            .ai-ocr-status-text {
                font-size: 16px; text-align: center; color: #333;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Additional state-driven and theme styles
        const stateStyles = `
            :root {
                --ai-ocr-overlay-bg: rgba(0,0,0,0.6);
                --ai-ocr-surface: #ffffff;
                --ai-ocr-text: #333333;
                --ai-ocr-brand: #4CAF50;
                --ai-ocr-brand-2: #81C784;
                --ai-ocr-error: #f44336;
                --ai-ocr-border: rgba(0,0,0,0.08);
                --ai-ocr-shadow: 0 5px 25px rgba(0,0,0,0.2);
            }
            @media (prefers-color-scheme: dark) {
                :root {
                    --ai-ocr-overlay-bg: rgba(0,0,0,0.7);
                    --ai-ocr-surface: #1e1f22;
                    --ai-ocr-text: #eaeaea;
                    --ai-ocr-brand: #66bb6a;
                    --ai-ocr-brand-2: #a5d6a7;
                    --ai-ocr-border: rgba(255,255,255,0.12);
                    --ai-ocr-shadow: 0 8px 30px rgba(0,0,0,0.5);
                }
            }
            
            #ai-ocr-loading-overlay { background-color: var(--ai-ocr-overlay-bg); }
            .ai-ocr-loader-container {
                background: var(--ai-ocr-surface);
                color: var(--ai-ocr-text);
                box-shadow: var(--ai-ocr-shadow);
                border: 1px solid var(--ai-ocr-border);
            }
            .ai-ocr-loader-icon { border-top-color: var(--ai-ocr-brand); }
            .ai-ocr-progress-fill {
                background: linear-gradient(90deg, var(--ai-ocr-brand), var(--ai-ocr-brand-2));
            }
            .ai-ocr-progress-fill.error {
                background: linear-gradient(90deg, var(--ai-ocr-error), #e57373);
            }
            /* State-driven visibility */
            .ai-ocr-loader-container [data-role="spinner"],
            .ai-ocr-loader-container [data-role="progress"],
            .ai-ocr-loader-container [data-role="done"] { display: none; }
            .ai-ocr-loader-container[data-state="progress"] [data-role="spinner"],
            .ai-ocr-loader-container[data-state="progress"] [data-role="progress"] { display: block; }
            .ai-ocr-loader-container[data-state="complete"] [data-role="done"],
            .ai-ocr-loader-container[data-state="empty"] [data-role="done"],
            .ai-ocr-loader-container[data-state="error"] [data-role="done"] { display: inline-block; }
            .ai-ocr-primary-btn {
                margin-top: 10px;
                padding: 8px 14px;
                border-radius: 8px;
                border: 0;
                background: var(--ai-ocr-brand);
                color: white;
                cursor: pointer;
            }
            .ai-ocr-primary-btn:disabled { opacity: 0.6; cursor: default; }
        `;
        const stateSheet = document.createElement('style');
        stateSheet.textContent = stateStyles;
        document.head.appendChild(stateSheet);

        // Extra UI styles for preview cards and remove button
        const extraStyles = `
            .ai-ocr-preview-item {
                position: relative;
                width: 110px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            .ai-ocr-preview-item img.ai-ocr-preview-image {
                width: 100px; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid var(--ai-ocr-border);
                box-shadow: var(--ai-ocr-shadow);
            }
            .ai-ocr-remove-btn {
                position: absolute;
                top: -6px; right: -6px;
                width: 22px; height: 22px;
                border-radius: 50%;
                background: var(--ai-ocr-error);
                color: #fff;
                border: none;
                cursor: pointer;
                line-height: 22px;
                text-align: center;
                font-weight: bold;
            }
            .ai-ocr-preview-meta {
                font-size: 11px;
                color: var(--ai-ocr-text);
                text-align: center;
                white-space: pre-line;
                word-break: break-word;
                max-width: 100px;
            }
        `;
        const extraSheet = document.createElement('style');
        extraSheet.textContent = extraStyles;
        document.head.appendChild(extraSheet);
    }
    function injectAiOcrUi() {
        const body = document.body;

        if (!document.getElementById('ai-ocr-modal')) {
            const modal = document.createElement('div');
            modal.id = 'ai-ocr-modal';
            modal.className = 'ai-ocr-modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="ai-ocr-modal-content">
                    <span class="ai-ocr-close-button">&times;</span>
                    <h2>Upload Images for OCR</h2>
                    <div id="ai-ocr-drop-zone">
                        <p>Drag & drop files here or click to select files</p>
                        <input type="file" id="ai-ocr-file-input" multiple accept="image/*, application/pdf">
                    </div>
                    <div id="ai-ocr-preview-container"></div>
                    <div class="ai-ocr-controls">
                        <label for="ai-ocr-model-select">Select AI Model:</label>
                        <select id="ai-ocr-model-select">
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                            <option value="gemini-2.5-flash-lite" selected>Gemini 2.5 Flash Lite (Fastest)</option>
                            <option value="gemma-3-27b-it">Gemma 3 27B (Quality)</option>
                            <option value="gemma-3-12b-it">Gemma 3 12B (Balanced)</option>
                        </select>
                        <p class="ai-ocr-disclaimer">Disclaimer: AI may make mistakes. Please verify the extracted data.</p>
                    </div>
                    <button id="ai-ocr-submit">Submit for OCR</button>
                </div>
            `;
            body.appendChild(modal);
        }

        if (!document.getElementById('ai-ocr-loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.id = 'ai-ocr-loading-overlay';
            overlay.style.display = 'none';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'ai-ocr-status-text');
            overlay.setAttribute('aria-describedby', 'ai-ocr-status-text');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = `
                <div class="ai-ocr-loader-container" data-state="idle" tabindex="-1">
                    <div class="ai-ocr-loader-icon" data-role="spinner"></div>
                    <div id="ai-ocr-status-text" class="ai-ocr-status-text" aria-live="polite" role="status">Processing...</div>
                    <div id="ai-ocr-progress" class="ai-ocr-progress-bar" data-role="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="OCR progress">
                        <div id="ai-ocr-progress-fill" class="ai-ocr-progress-fill"></div>
                    </div>
                    <button id="ai-ocr-done-btn" class="ai-ocr-primary-btn" data-role="done">OK</button>
                </div>
            `;
            body.appendChild(overlay);
        }

        if (!document.getElementById('ai-ocr-image-preview-lightbox')) {
            const lightbox = document.createElement('div');
            lightbox.id = 'ai-ocr-image-preview-lightbox';
            lightbox.style.display = 'none';
            lightbox.innerHTML = `
                <span class="ai-ocr-close-lightbox">&times;</span>
                <img src="" alt="Image Preview">
            `;
            body.appendChild(lightbox);

            lightbox.addEventListener('click', () => {
                lightbox.style.display = 'none';
            });
        }
    }

    // ==========================================================================================
    // SECTION: Modal Handling
    // ==========================================================================================

    aiOcrUploadBtn?.addEventListener('click', () => {
        aiOcrModal.style.display = 'block';
    });
    
    aiOcrCloseButton?.addEventListener('click', () => {
        aiOcrModal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === aiOcrModal) {
            aiOcrModal.style.display = 'none';
        }
    });

    // Fallback delegation: ensure modal opens even if the button is injected later or a prior error blocked binding
    document.addEventListener('click', (e) => {
        const t = e.target;
        // Match the button by id or if a child inside the button was clicked
        if (t && (t.id === 'ai-ocr-UploadBtn' || (typeof t.closest === 'function' && t.closest('#ai-ocr-UploadBtn')))) {
            const m = document.getElementById('ai-ocr-modal');
            if (m) m.style.display = 'block';
        }
    });

    // Lightweight programmatic control API (no-op if elements missing)
    window.TNO = window.TNO || {};
    window.TNO.openOcr = function () {
        const m = document.getElementById('ai-ocr-modal');
        if (m) m.style.display = 'block';
    };
    window.TNO.closeOcr = function () {
        const m = document.getElementById('ai-ocr-modal');
        if (m) m.style.display = 'none';
    };

    // ==========================================================================================
    // SECTION: Drag and Drop Functionality
    // ==========================================================================================

    aiOcrDropZone.addEventListener('dragover', (event) => {
        event.preventDefault();
        aiOcrDropZone.classList.add('ai-ocr-dragover');
    });

    aiOcrDropZone.addEventListener('dragleave', () => {
        aiOcrDropZone.classList.remove('ai-ocr-dragover');
    });

    aiOcrDropZone.addEventListener('drop', (event) => {
        event.preventDefault();
        aiOcrDropZone.classList.remove('ai-ocr-dragover');
        const files = event.dataTransfer.files;
        handleFiles(files);
    });

    aiOcrDropZone.addEventListener('click', () => {
        aiOcrFileInput.click();
    });

    aiOcrFileInput.addEventListener('change', () => {
        const files = aiOcrFileInput.files;
        handleFiles(files);
    });

    // ==========================================================================================
    // SECTION: File Handling and Preview
    // ==========================================================================================
    
    // Helpers and state for file previews and PDF processing
    let TNO_FILE_UID = 1;
    const previewMetaById = new Map();
    const MAX_IMAGES = Number(window.TNO_MAX_IMAGES || 50);
    /**
     * Create a preview card (thumbnail + meta + remove) for a given image File.
     * @param {File} file
     */
    function createPreviewCard(file) {
        const id = file.__tnoId;
        const wrapper = document.createElement('div');
        wrapper.className = 'ai-ocr-preview-item';
        wrapper.dataset.tnoId = String(id);

        const img = document.createElement('img');
        img.className = 'ai-ocr-preview-image';

        const meta = document.createElement('div');
        meta.className = 'ai-ocr-preview-meta';
        const sizeKb = Math.round((file.size || 0) / 1024);
        const displayName = (file.name || 'image').slice(0, 16);
        meta.dataset.baseName = displayName;
        meta.textContent = `${displayName}\n${sizeKb} KB`;
        previewMetaById.set(id, meta);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'ai-ocr-remove-btn';
        removeBtn.type = 'button';
        removeBtn.title = 'Remove';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            const idx = uploadedFiles.findIndex(f => f && f.__tnoId === id);
            if (idx !== -1) {
                uploadedFiles.splice(idx, 1);
            }
            previewMetaById.delete(id);
            wrapper.remove();
        });

        img.addEventListener('click', () => {
            const lightbox = document.getElementById('ai-ocr-image-preview-lightbox');
            const lightboxImg = lightbox?.querySelector('img');
            if (lightbox && lightboxImg) {
                lightboxImg.src = img.src;
                lightbox.style.display = 'flex';
            }
        });

        // Load thumbnail
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        wrapper.appendChild(meta);
        aiOcrPreviewContainer.appendChild(wrapper);
    }

    /**
     * Push a File into uploadedFiles and render its preview card.
     * @param {File} file
     */
    function addImageFile(file) {
        if (!file) return;
        if (uploadedFiles.length >= MAX_IMAGES) {
            try { alert(`Maximum ${MAX_IMAGES} images per upload reached. Extra files are ignored.`); } catch (_) {}
            return;
        }
        if (!('__tnoId' in file)) {
            Object.defineProperty(file, '__tnoId', { value: TNO_FILE_UID++, enumerable: false, configurable: true });
        }
        uploadedFiles.push(file);
        createPreviewCard(file);
    }

    function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas toBlob returned null'));
                }, type, quality);
            } catch (err) {
                reject(err);
            }
        });
    }

    async function ensurePdfJs() {
        if (window.pdfjsLib) return;
        // Fallback lazy-load if loader didn't pre-load pdf.js
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load pdf.js'));
            document.head.appendChild(s);
        });
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        } else {
            throw new Error('pdfjsLib not available after load');
        }
    }

    /**
     * Convert a PDF File to an array of JPEG image Files, one per page.
     * @param {File} file - PDF file
     * @param {{maxPages?:number, scale?:number, onProgress?:(i:number,total:number)=>void}} [options]
     * @returns {Promise<Array<File>>}
     */
    async function processPdf(file, options = {}) {
        const maxPages = Number(options.maxPages ?? (window.TNO_PDF_MAX_PAGES || 88));
        const scale = Number(options.scale ?? (window.TNO_PDF_SCALE || 1.5));
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

        await ensurePdfJs();
        const pdfjs = window.pdfjsLib;
        const buf = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: buf });
        const pdf = await loadingTask.promise;
        const pageCount = Math.min(pdf.numPages || 0, maxPages);

        const out = [];
        const baseName = (file.name || 'document').replace(/\.pdf$/i, '');

        for (let i = 1; i <= pageCount; i++) {
            try {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: scale });
                const canvas = document.createElement('canvas');
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                const ctx = canvas.getContext('2d', { alpha: false });
                await page.render({ canvasContext: ctx, viewport }).promise;
                const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
                const imgFile = new File([blob], `${baseName}_page${i}.jpg`, { type: 'image/jpeg' });
                out.push(imgFile);
                if (onProgress) onProgress(i, pageCount);
                // help GC
                canvas.width = 0; canvas.height = 0;
            } catch (err) {
                console.error(`Render failure on page ${i}:`, err);
            }
        }
        return out;
    }
    async function handleFiles(files) {
        const list = Array.from(files || []);
        const images = list.filter(f => f && f.type && f.type.startsWith('image/'));
        const pdfs = list.filter(f => f && ((f.type === 'application/pdf') || /\.pdf$/i.test(f.name || '')));

        // Add images immediately
        for (const img of images) {
            addImageFile(img);
        }

        if (pdfs.length > 0) {
            try {
                openLoader('Rendering PDF pages...', 5);
            } catch (_) {}
            for (const pdf of pdfs) {
                try {
                    const pages = await processPdf(pdf, {
                        maxPages: Number(window.TNO_PDF_MAX_PAGES || 88),
                        scale: Number(window.TNO_PDF_SCALE || 1.5),
                        onProgress: (i, total) => {
                            const pct = Math.min(25, Math.floor((i / Math.max(1, total)) * 25));
                            updateOcrLoader(`Rendering ${pdf.name}: page ${i} of ${total}...`, pct);
                        }
                    });
                    for (const imgFile of pages) {
                        addImageFile(imgFile);
                    }
                } catch (err) {
                    console.error('PDF processing error:', err);
                }
            }
            try { setLoaderState('complete'); } catch(_) {}
            setTimeout(() => { try { closeLoader(); } catch(_) {} }, 300);
        }
    }

    // ==========================================================================================
    // SECTION: Image Compression and API Submission
    // ==========================================================================================

    /**
     * Updates the loading overlay with a message and progress percentage.
     * @param {string} text - The message to display.
     * @param {number} percent - The progress percentage (0-100).
     * @param {boolean} isError - If true, displays the progress bar in an error state.
     */
    function updateOcrLoader(text, percent, isError = false) {
        const statusText = document.getElementById('ai-ocr-status-text');
        const progressFill = document.getElementById('ai-ocr-progress-fill');
        const progress = document.getElementById('ai-ocr-progress');

        if (statusText) statusText.textContent = text;
        if (typeof percent === 'number' && progress) {
            const p = Math.max(0, Math.min(100, Math.round(percent)));
            progress.setAttribute('aria-valuenow', String(p));
        }
        if (progressFill && typeof percent === 'number') {
            progressFill.style.width = `${percent}%`;
            progressFill.classList.toggle('error', isError);
        }
    }

    // Loader overlay state helpers (state-driven UI)
    function setLoaderState(state) {
        const container = document.querySelector('#ai-ocr-loading-overlay .ai-ocr-loader-container');
        if (!container) return;
        container.dataset.state = state;
        loaderClosable = ['complete', 'empty', 'error'].includes(state);
    }

    function openLoader(text = 'Processing...', percent = 0) {
        const overlay = document.getElementById('ai-ocr-loading-overlay');
        const container = overlay?.querySelector('.ai-ocr-loader-container');
        const doneBtn = document.getElementById('ai-ocr-done-btn');
        if (doneBtn) {
            // Default: close overlay only; callers may override handler for specific flows.
            doneBtn.onclick = () => closeLoader();
        }
        if (overlay && container) {
            previousActiveElement = document.activeElement;
            overlay.style.display = 'flex';
            overlay.setAttribute('aria-hidden', 'false');
            document.body.setAttribute('aria-busy', 'true');
            setLoaderState('progress');
            requestAnimationFrame(() => container.focus());
        }
        updateOcrLoader(text, percent);
        document.addEventListener('keydown', handleOverlayKeydown);
    }

    function closeLoader() {
        const overlay = document.getElementById('ai-ocr-loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.setAttribute('aria-hidden', 'true');
            document.body.removeAttribute('aria-busy');
        }
        document.removeEventListener('keydown', handleOverlayKeydown);
        if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
            try { previousActiveElement.focus(); } catch (_) {}
        }
        previousActiveElement = null;
        setLoaderState('idle');
    }

    function handleOverlayKeydown(e) {
        if (e.key === 'Escape' && loaderClosable) {
            closeLoader();
        }
    }

    /**
     * Local DOM stability helper (UI-side), used before hiding the loader to ensure
     * the table has settled. This complements the row-level stability in add_rows.js.
     * @param {HTMLElement} container
     * @param {number} [timeoutMs=5000]
     * @param {number} [stableMs=200]
     * @returns {Promise<boolean>}
     */
    async function waitForDomStableLocal(container, timeoutMs = 5000, stableMs = 200) {
        if (!container) return true;

        let lastMutation = Date.now();
        const observer = new MutationObserver(() => {
            lastMutation = Date.now();
        });

        try {
            observer.observe(container, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        } catch (_) {
            return true;
        }

        return await new Promise((resolve) => {
            const checkInterval = 50;
            const intervalId = setInterval(() => {
                if (Date.now() - lastMutation >= stableMs) {
                    clearInterval(intervalId);
                    observer.disconnect();
                    resolve(true);
                }
            }, checkInterval);

            setTimeout(() => {
                clearInterval(intervalId);
                observer.disconnect();
                resolve(false);
            }, timeoutMs);
        });
    }

    aiOcrSubmitBtn.addEventListener('click', async () => {
        if (uploadedFiles.length === 0) {
            alert('Please upload at least one image.');
            return;
        }

        geminiApiKey = resolveGeminiApiKey();
        if (!geminiApiKey) {
            return; // Stop if no API key is available
        }

        // Prevent duplicate submissions
        if (aiOcrSubmitBtn.dataset.processing === '1') return;
        aiOcrSubmitBtn.dataset.processing = '1';
        aiOcrSubmitBtn.disabled = true;

        openLoader('Preparing images...', 0);

        try {
            // 1. Compress Images (0% -> 30%)
            const targetKB = Number(window.TNO_IMAGE_TARGET_KB || 100);
            const compressedFiles = [];
            for (let i = 0; i < uploadedFiles.length; i++) {
                const orig = uploadedFiles[i];
                const id = orig && orig.__tnoId;
                const cf = await compressImage(orig, targetKB);
                compressedFiles.push(cf);

                // Update preview meta to show compressed size
                if (id && previewMetaById.has(id)) {
                    const meta = previewMetaById.get(id);
                    const sizeKb2 = Math.round((cf.size || 0) / 1024);
                    const baseName = (meta && meta.dataset && meta.dataset.baseName) ? meta.dataset.baseName : ((cf.name || 'image').slice(0, 16));
                    meta.textContent = `${baseName}\n${sizeKb2} KB`;
                }

                const progress = Math.floor(((i + 1) / Math.max(1, uploadedFiles.length)) * 30);
                updateOcrLoader(`Compressing image ${i + 1} of ${uploadedFiles.length}...`, progress);
            }

            // 2. Get OCR Results from AI (30% -> 70%)
            updateOcrLoader('Sending to AI for processing...', 30);
            // Determine transaction type (set window.TNO_TXN_TYPE = 'sales' | 'inventory' | 'default')
            const transactionType = window.TNO_TXN_TYPE || window.tnoTxnType || 'default';
            const ocrResults = await getOcrResults(compressedFiles, geminiApiKey, transactionType);
            
            if (ocrResults && ocrResults.length > 0) {
                updateOcrLoader('Adding rows...', 70);

                // Progress callback to update text and progress bar from 70% -> 100%
                const totalRows = ocrResults.length;
                const onRowProgress = (current, total) => {
                    const pct = 70 + Math.floor((current / (total || 1)) * 30);
                    updateOcrLoader(`Adding row ${current} of ${total}...`, pct);
                };

                // Use the same transactionType determined earlier
                await window.$addRows(ocrResults, onRowProgress, transactionType);

                // Wait for rows container to settle
                const rowsContainer = document.querySelector('#rowsTable tbody') || document.body;
                await waitForDomStableLocal(rowsContainer, 5000, 200);

                // Show completion message and wait for user confirmation
                updateOcrLoader('Completed', 100);
                setLoaderState('complete');
                const doneBtn = document.getElementById('ai-ocr-done-btn');
                if (doneBtn) {
                    doneBtn.onclick = () => {
                        closeLoader();
                        aiOcrModal.style.display = 'none';
                    };
                }
            } else {
                updateOcrLoader('No data extracted from images.', 100);
                setLoaderState('empty');
                const doneBtn2 = document.getElementById('ai-ocr-done-btn');
                if (doneBtn2) {
                    doneBtn2.onclick = () => {
                        closeLoader();
                        aiOcrModal.style.display = 'none';
                    };
                }
            }

            // Waiting for user to acknowledge completion via OK button.

        } catch (error) {
            console.error('An error occurred during the OCR process:', error);
            updateOcrLoader(`Error: ${error.message}`, 100, true);
            setLoaderState('error');
        } finally {
            // Re-enable submit and clear in-progress flag
            aiOcrSubmitBtn.dataset.processing = '0';
            aiOcrSubmitBtn.disabled = false;

            // Clear the uploaded files and preview
            uploadedFiles = [];
            aiOcrPreviewContainer.innerHTML = '';
            aiOcrFileInput.value = '';
        }
    });

    /**
     * 压缩图片到指定大小（默认 350KB，可通过 window.TNO_COMPRESS_TARGET_KB 覆盖）。
     * @param {File} file - 原始图片文件
     * @returns {Promise<File>} 压缩后的图片（JPEG）
     */
    function compressImage(file, targetKB = COMPRESS_TARGET_KB) {
        return new Promise((resolve) => {
            try {
                if (!file || !(file.type || '').startsWith('image/')) {
                    resolve(file);
                    return;
                }
                const img = new Image();
                img.onload = async () => {
                    try {
                        const targetBytes = Math.max(20, Number(targetKB || 100)) * 1024;
                        const minQuality = 0.25;
                        const minScale = 0.4;
                        const downscaleStep = 0.85;

                        let scale = 1.0;
                        let quality = 0.9;

                        let w = img.naturalWidth || img.width;
                        let h = img.naturalHeight || img.height;

                        let bestBlob = null;

                        for (let iter = 0; iter < 15; iter++) {
                            const cw = Math.max(1, Math.floor(w * scale));
                            const ch = Math.max(1, Math.floor(h * scale));
                            const canvas = document.createElement('canvas');
                            canvas.width = cw; canvas.height = ch;
                            const ctx = canvas.getContext('2d', { alpha: false });
                            ctx.drawImage(img, 0, 0, cw, ch);

                            const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
                            if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;

                            if (blob.size <= targetBytes) {
                                bestBlob = blob;
                                break;
                            }

                            // Adjust quality first, then scale if needed
                            if (quality > minQuality) {
                                quality = Math.max(minQuality, +(quality - 0.1).toFixed(2));
                            } else if (scale > minScale) {
                                scale = +(scale * downscaleStep).toFixed(3);
                            } else {
                                // Cannot reduce further
                                break;
                            }
                        }

                        const name = (file.name || 'image.jpg').replace(/\.(png|jpeg|jpg|webp|gif)$/i, '') + '.jpg';
                        const out = new File([bestBlob || file], name, { type: 'image/jpeg' });
                        resolve(out);
                    } catch (err) {
                        console.warn('compressImage failed, returning original file:', err);
                        resolve(file);
                    }
                };
                img.onerror = () => resolve(file);
                const fr = new FileReader();
                fr.onload = (e) => { img.src = e.target.result; };
                fr.readAsDataURL(file);
            } catch (e) {
                resolve(file);
            }
        });
    }

    // ==========================================================================================
    // SECTION: OCR Parsing & Normalization Helpers
    // ==========================================================================================
    // SSOT helpers: derive spec and prompt from window.TNO_SCHEMA when available
    function getAllowedKeysFromSchema(transactionType = 'default') {
        const s = window.TNO_SCHEMA;
        if (s && s.transactions && s.fields) {
            return s.transactions[transactionType] || s.transactions.default || Object.keys(s.fields);
        }
        return null;
    }

    function getFieldSpec(transactionType = 'default') {
        const s = window.TNO_SCHEMA;
        if (s && s.fields) {
            const allowed = new Set(getAllowedKeysFromSchema(transactionType) || Object.keys(s.fields));
            const spec = { string: [], number: [], boolean: [] };
            for (const [key, def] of Object.entries(s.fields)) {
                if (!allowed.has(key)) continue;
                const t = (def && def.type) || 'string';
                if (t === 'number') spec.number.push(key);
                else if (t === 'boolean') spec.boolean.push(key);
                else spec.string.push(key);
            }
            return spec;
        }
        // Fallback to legacy static spec
        return Object.freeze({
            string: ['code','brand','desc_short','desc_long','uom','uomstk','acct_disp','dept_disp','proj_disp','rqt_day','rqt_mth','rqt_yr','batchnum'],
            number: ['qty','unit_list','disc_pct','unit_price','amount','unit_w_gst','conv','qty_uomstk','uprice_uomstk'],
            boolean: ['gst']
        });
    }

    // Derive per-field max length from schema for allowed string fields
    function getFieldMaxLens(transactionType = 'default') {
        const s = window.TNO_SCHEMA;
        const allowed = new Set(getAllowedKeysFromSchema(transactionType) || Object.keys(s?.fields || {}));
        const map = {};
        if (s && s.fields) {
            for (const [k, def] of Object.entries(s.fields)) {
                const t = (def && def.type) || 'string';
                if (!allowed.has(k) || t !== 'string') continue;
                const ml = def && typeof def.maxLen === 'number' ? def.maxLen : null;
                if (ml && ml > 0) map[k] = ml;
            }
        }
        return map;
    }

    function buildOcrPrompt(transactionType = 'default') {
        const spec = getFieldSpec(transactionType);
        const fieldsList = [
            ...spec.string.map(k => `- ${k}: string`),
            ...spec.number.map(k => `- ${k}: number`),
            ...spec.boolean.map(k => `- ${k}: number (1 if true else 0)`)
        ];
        const limitsMap = getFieldMaxLens(transactionType);
        const limitLines = Object.entries(limitsMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => `  - ${k}: ${v}`);

        return [
            'Task: Extract structured line items from the provided image(s).',
            'Output must be RAW JSON ONLY: an array of objects. No explanations, no comments.',
            'DO NOT wrap in Markdown or code fences. Do not use ```.',
            'Fields and types:',
            ...fieldsList,
            'Rules:',
            '- If a field is unavailable or looks like placeholder/noise (e.g., long runs of the same character such as "zzzzzz" or "-----"), use empty string "" for strings and null for numbers.',
            '- Normalize numbers: remove symbols and thousand separators; use dot as decimal.',
            '- Only include the listed fields. Do not add extra fields.',
            '- String length limits (truncate if longer):',
            ...limitLines,
            `  - others: ${DEFAULT_STRING_MAXLEN}`,
            'Return ONLY the JSON array.'
        ].join('\n');
    }

    function normalizeNumber(value) {
        if (value == null) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const str = String(value)
            .replace(/[\s,]/g, '')
            .replace(/[$]/g, '')
            .replace(/[A-Za-z%]+/g, '');
        const num = parseFloat(str);
        return Number.isFinite(num) ? num : null;
    }

    function coerceBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        if (typeof value === 'string') {
            const s = value.trim().toLowerCase();
            if (['y','yes','true','t','1','gst','incl','included'].includes(s)) return true;
            const n = normalizeNumber(value);
            return n != null ? n > 0 : false;
        }
        return false;
    }

    function normalizeAndValidate(items, transactionType = 'default') {
        const spec = getFieldSpec(transactionType);
        const arr = Array.isArray(items) ? items : (items ? [items] : []);
        return arr.map((raw) => {
            const out = {};
            for (const k of spec.string) {
                let v = raw?.[k];
                if (v == null) v = '';
                v = Array.isArray(v) ? v.join(' ') : v;
                out[k] = String(v ?? '').replace(/\s+/g, ' ').trim();
            }
            for (const k of spec.number) {
                out[k] = normalizeNumber(raw?.[k]);
            }
            for (const k of spec.boolean) {
                out[k] = coerceBoolean(raw?.[k]);
            }
            // Ensure date parts are zero-padded 2-digit day/month and 4-digit year if present
            if ('rqt_day' in out) out.rqt_day = out.rqt_day ? String(out.rqt_day).padStart(2,'0') : '';
            if ('rqt_mth' in out) out.rqt_mth = out.rqt_mth ? String(out.rqt_mth).padStart(2,'0') : '';
            if ('rqt_yr' in out) out.rqt_yr = out.rqt_yr ? String(out.rqt_yr).padStart(4,'0') : '';
            
            return out;
        });
    }

    // Post-normalization sanitation to prevent junk/placeholder strings and oversize fields
    const DEFAULT_STRING_MAXLEN = 120;

    function isNoiseString(str) {
        const s = String(str || '');
        if (!s) return false;
        // Long runs of the same character (e.g., zzzzzzzzzzz or -----)
        if (s.length >= 10 && /(.)\1{9,}/.test(s)) return true;
        if (s.length >= 20) {
            const counts = {};
            for (const ch of s) counts[ch] = (counts[ch] || 0) + 1;
            const max = Math.max(...Object.values(counts));
            if (max / s.length >= 0.8) return true;
        }
        return false;
    }

    function cleanAndClampString(value, maxLen) {
        let s = String(value ?? '');
        // Remove zero-width chars and collapse whitespace
        s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
        s = s.replace(/\s+/g, ' ').trim();
        // Collapse excessive repeats to 3 in a row to avoid fence-like strings
        s = s.replace(/(.)\1{4,}/g, '$1$1$1');
        if (isNoiseString(s)) return '';
        const cap = Number.isFinite(maxLen) ? maxLen : DEFAULT_STRING_MAXLEN;
        return s.length > cap ? s.slice(0, cap) : s;
    }

    function sanitizeItems(items, transactionType = 'default') {
        const spec = getFieldSpec(transactionType);
        const limitsMap = getFieldMaxLens(transactionType);
        return (items || []).map((row) => {
            const out = { ...row };
            for (const k of spec.string) {
                const limit = (typeof limitsMap[k] === 'number' ? limitsMap[k] : DEFAULT_STRING_MAXLEN);
                out[k] = cleanAndClampString(out[k], limit);
            }
            return out;
        });
    }
    
    function safeJsonExtract(text, transactionType = 'default') {
        if (!text) return [];
        const cleaned = String(text)
            .replace(/\u0000/g, '')
            .replace(/```(?:json)?/g, '')
            .replace(/```/g, '')
            .trim();
        try {
            const parsed = JSON.parse(cleaned);
            const normalized = normalizeAndValidate(parsed, transactionType);
            return sanitizeItems(normalized, transactionType);
        } catch (_) {
            // Try to locate first '[' and last ']' and parse that segment.
            const start = cleaned.indexOf('[');
            const end = cleaned.lastIndexOf(']');
            if (start !== -1 && end !== -1 && end > start) {
                const slice = cleaned.slice(start, end + 1);
                try {
                    const parsed = JSON.parse(slice);
                    const normalized = normalizeAndValidate(parsed, transactionType);
                    return sanitizeItems(normalized, transactionType);
                } catch (_) {}
            }
        }
        return [];
    }

    /**
     * 将多张图片逐张发送到 Gemini，并聚合所有提取的行项目。
     * 单张图片一请求（更稳定，避免多图混淆/截断），失败继续下张，不整体失败。
     * @param {Array<File>} files - 压缩后的图片文件数组
     * @param {string} apiKey - Gemini API Key
     * @param {string} transactionType - 事务类型（影响字段清单与规范化）
     * @returns {Promise<Array<object>|null>} 聚合后的行项目数组（可能为空数组），致命错误时返回 null
     */
    async function getOcrResults(files, apiKey, transactionType = 'default') {
        const modelEl = document.getElementById('ai-ocr-model-select');
        const selectedModel = modelEl ? modelEl.value : 'gemini-2.5-flash-lite';
        const urlBase = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

        const allItems = [];
        const total = Array.isArray(files) ? files.length : 0;
        const prompt = buildOcrPrompt(transactionType);

        for (let i = 0; i < total; i++) {
            const file = files[i];

            // 读取单张图片为 inline_data
            const part = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Image = String(event.target.result).split(',')[1];
                    resolve({
                        inline_data: {
                            mime_type: file.type || 'image/jpeg',
                            data: base64Image
                        }
                    });
                };
                reader.readAsDataURL(file);
            });

            // 逐张图片独立请求，避免多图合并带来的上下文污染/令牌超限
            const payload = {
                contents: [{
                    parts: [{ text: prompt }, part]
                }],
                generationConfig: { temperature: 0.1, topK: 1, topP: 0.1, response_mime_type: 'text/plain' }
            };

            let retries = 3;
            while (retries > 0) {
                try {
                    // 可选：在 30%~70% 区间内显示按图片计的细分进度
                    const basePct = 30;
                    const spanPct = 40; // 30 -> 70
                    const pct = basePct + Math.floor(((i) / Math.max(1, total)) * spanPct);
                    updateOcrLoader(`Sending image ${i + 1} of ${total} to AI...`, pct);

                    const response = await fetch(urlBase, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (response.status === 503) {
                        retries--;
                        if (retries > 0) {
                            console.warn(`API 503（繁忙），重试中...（剩余 ${retries} 次）`);
                            await new Promise(res => setTimeout(res, 2000));
                            continue;
                        } else {
                            console.warn('模型当前过载，跳过该图片。');
                            break; // 放弃该图片，继续下一张
                        }
                    }

                    if (!response.ok) {
                        throw new Error(`API 请求失败，状态码 ${response.status}`);
                    }

                    const data = await response.json();
                    const parts = data?.candidates?.[0]?.content?.parts || [];
                    const text = parts.map(p => p.text || '').join('\n').trim();
                    const items = safeJsonExtract(text, transactionType);
                    if (Array.isArray(items) && items.length > 0) {
                        allItems.push(...items);
                    }
                    break; // 当前图片完成（无论是否解析出数据）
                } catch (err) {
                    console.error(`第 ${i + 1} 张图片 OCR 出错:`, err);
                    // 单张失败不弹阻断式 alert，不中断整个批次，继续下一张
                    break;
                }
            }
        }

        return allItems;
    }
  }

  // Run immediately if DOM is already ready (script loaded after DOMContentLoaded), else wait for it
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();