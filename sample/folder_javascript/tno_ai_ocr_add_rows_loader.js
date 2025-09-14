/*!
 * TNO Single-Entry Loader (tno-loader.js)
 * Goal: include ONLY this file. It will load schema.js, add_rows.js, ocr.js
 * with cache-busting via version policy: 'daily' | 'realtime' | 'fixed'
 *
 * Usage (minimal):
 *   <script src="tno-loader.js"></script>
 *   <script>
 *     // Optional: set Gemini API key and transaction type
 *     // window.gemini_api_key = 'YOUR_GEMINI_API_KEY';
 *     // window.TNO_TXN_TYPE = 'default' | 'sales' | 'inventory';
 *
 *     // Load with daily refresh (v=YYYYMMDD)
 *     TNO.load({ versionPolicy: 'daily' });
 *
 *     // OR realtime (v=timestamp)
 *     // TNO.load({ versionPolicy: 'realtime' });
 *
 *     // OR fixed (explicit map)
 *     // TNO.load({ versionPolicy: 'fixed', versions: { schema: '2025.09.10.1', add_rows: '2025.09.10.1', ocr: '2025.09.10.1' } });
 *   </script>
 */
(function () {
  if (typeof window === 'undefined') return;

  // Internal helpers
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function todayKey() {
    const d = new Date();
    return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }
  function computeVersion(name, policy, fixedVersions) {
    if (policy === 'realtime') return String(Date.now());
    if (policy === 'daily') return todayKey();
    // fixed: use provided mapping only
    const map = fixedVersions || {};
    return map[name] || '1';
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      var s = document.createElement('script');
      s.src = src;
      s.async = false; // keep order
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function joinPath(base, file) {
    if (!base) return file;
    if (base.endsWith('/')) return base + file;
    return base + '/' + file;
  }

  // Public API
  window.TNO = window.TNO || {};
  /**
   * Load the library components with version-controlled cache-busting.
   * @param {Object} options
   * @param {'daily'|'realtime'|'fixed'} [options.versionPolicy='daily'] - daily = v=YYYYMMDD, realtime = v=timestamp, fixed = v=from mapping
   * @param {Object} [options.versions] - Mapping for 'fixed' mode: { schema, add_rows, ocr }
   * @param {string} [options.basePath='./'] - Optional base path or CDN prefix (e.g., '/assets/tno' or 'https://cdn.example.com/tno')
   * @param {string} [options.apiKey] - Optionally set Gemini API key before ocr.js is loaded
   * @param {string} [options.transactionType] - Optionally set window.TNO_TXN_TYPE before use
   * @param {Array<string>} [options.files] - Advanced: customize file list; default: ['schema.js','add_rows.js','ocr.js']
   * @returns {Promise<void>}
   */
  window.TNO.load = async function (options) {
    var opts = options || {};
    var policy = opts.versionPolicy || 'daily';
    var versions = opts.versions || null;
    var basePath;
    if (opts.basePath != null) {
      basePath = String(opts.basePath);
    } else {
      // Dynamically compute relative basePath from loader script's src (keeps relative to HTML)
      const loaderScript = Array.from(document.scripts).find(s => s.src && s.src.includes('tno_ai_ocr_add_rows_loader.js'));
      if (loaderScript && loaderScript.src) {
        const cleanSrc = loaderScript.src.split('?')[0];
        const dirIndex = cleanSrc.lastIndexOf('/');
        basePath = dirIndex !== -1 ? cleanSrc.substring(0, dirIndex + 1) : './';
      } else {
        basePath = './';
      }
    }
    var files = Array.isArray(opts.files) ? opts.files.slice() : ['https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js', 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js', 'tno_ai_ocr_add_rows_schema.js', 'tno_ai_ocr_add_rows_add_rows.js', 'tno_ai_ocr_add_rows_ocr.js'];

    // Optional runtime config
    if (opts.apiKey != null && !window.gemini_api_key) {
      window.gemini_api_key = String(opts.apiKey);
    }
    if (opts.transactionType != null) {
      window.TNO_TXN_TYPE = String(opts.transactionType);
    }

    // Map logical names to files for version lookup
    var nameByFile = {
      'tno_ai_ocr_add_rows_schema.js': 'schema',
      'tno_ai_ocr_add_rows_add_rows.js': 'add_rows',
      'tno_ai_ocr_add_rows_ocr.js': 'ocr'
    };

    // Load in sequence
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var isExternal = f.startsWith('http');
      var logical = isExternal ? f.split('/').pop().replace(/\.js$/, '') : (nameByFile[f] || f.replace(/\.js$/, ''));
      var v = isExternal ? '' : computeVersion(logical, policy, versions); // No version for external CDNs
      var url = isExternal ? f : (joinPath(basePath, f) + '?v=' + encodeURIComponent(v));
      await loadScript(url);

      // Set pdf.js worker after loading pdf.min.js
      if (f.includes('pdf.min.js') && typeof window.pdfjsLib !== 'undefined') {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      }
    }
  };

  // Zero-config autoload: enabled by default on DOMContentLoaded.
  // Set window.TNO_AUTOLOAD = false to disable.
  // Optional: window.TNO_AUTOPOLICY = 'realtime' | 'daily' | 'fixed' (default 'realtime')
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var auto = (window.TNO_AUTOLOAD !== false);
      if (!auto) return;
      var policy = window.TNO_AUTOPOLICY || 'realtime';
      window.TNO.load({ versionPolicy: policy }).catch(function (e) {
        console.error('TNO autoload failed:', e);
      });
    } catch (e) {
      console.error('TNO autoload init error:', e);
    }
  });
})();