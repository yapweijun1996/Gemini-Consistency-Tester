# TNO AI OCR Add Rows – JS Library

This repository contains a browser-native JavaScript library that:
- Injects an OCR modal/UI dynamically (no external CSS file needed)
- Sends images to an LLM for line-item extraction
- Adds and fills table rows in the host page using a single source of truth (SSOT) schema

Key modules:
- [tno-loader.js](tno-loader.js) – single-entry loader that loads schema.js, add_rows.js, ocr.js with version policies ('daily' | 'realtime' | 'fixed')
- [schema.js](schema.js) – SSOT for fields, DOM naming, transactions, and fill order
- [add_rows.js](add_rows.js) – row creation and form-filling engine
- [ocr.js](ocr.js) – OCR UI, image compression, LLM prompt/parse pipeline

OCR UI styling and interactions are injected at runtime by [javascript.injectAiOcrStyles()](ocr.js:61) and [javascript.injectAiOcrUi()](ocr.js:246). No standalone CSS is shipped.

---

## Why there is no style.css

This is a library intended to embed into arbitrary host pages. To avoid CSS collisions and host-side setup complexity, the OCR UI:
- Injects all required styles dynamically via [javascript.injectAiOcrStyles()](ocr.js:61)
- Namespaces classes with `ai-ocr-...` to minimize interference
- Requires zero external CSS files

Result: integrators only add scripts in the correct order; styling is fully self-contained.

---

## Single-Entry Loader (Recommended)

Include only the loader and call it with your policy:

```html
<script src="tno-loader.js"></script>
<script>
  // Optional: set your Gemini API key and transaction type before load
  // window.gemini_api_key = 'YOUR_GEMINI_API_KEY';
  // window.TNO_TXN_TYPE = 'default'; // or 'sales' | 'inventory'
  TNO.load({ versionPolicy: 'daily' }); // 'daily' | 'realtime' | 'fixed'
</script>
```

Version policies:
- daily → appends v=YYYYMMDD
- realtime → appends v=timestamp (forces fresh load every time)
- fixed → provide an explicit versions map:
```html
<script>
  TNO.load({
    versionPolicy: 'fixed',
    versions: { schema: '2025.09.10.1', add_rows: '2025.09.10.1', ocr: '2025.09.10.1' }
  });
</script>
```

### Advanced: Manual Script Order (if not using the loader)

Include scripts in this exact order so both OCR and Add Rows can read the SSOT:

1. [schema.js](schema.js)
2. [add_rows.js](add_rows.js)
3. [ocr.js](ocr.js)

Example (simplified):

```html
<!-- 1) Schema first -->
<script src="schema.js"></script>
<!-- 2) Row engine next -->
<script src="add_rows.js"></script>
<!-- 3) OCR last -->
<script>
  // Optionally set your Gemini API key (or supply via sessionStorage/prompt)
  window.gemini_api_key = 'YOUR_GEMINI_API_KEY';
</script>
<script src="ocr.js"></script>
```

If `schema.js` is missing, [add_rows.js](add_rows.js) will throw a clear error to enforce the single source of truth.

---

## Quick Start

1) Provide a trigger element to open the OCR modal (for example a button):
```html
<button id="ai-ocr-UploadBtn">OCR Upload</button>
```
- [ocr.js](ocr.js) attaches click handlers to `#ai-ocr-UploadBtn`. Alternatively, you can trigger the modal programmatically by clicking that element in your own code.

2) Ensure your table markup and inputs follow the SSOT DOM naming that [schema.js](schema.js) defines (base + row index + optional suffix like `_disp` or `_conv`). The row engine computes exact input `name` attributes at runtime via [javascript.getColumnName()](add_rows.js:413).

3) Optionally set the transaction type to control which fields are used:
```html
<script>
  // 'default' | 'sales' | 'inventory' (extendable in schema.transactions)
  window.TNO_TXN_TYPE = 'default';
</script>
```

4) Upload images via the modal and submit. The OCR pipeline drives:
- Prompt building from SSOT: [javascript.buildOcrPrompt()](ocr.js:721)
- Type normalization/validation: [javascript.normalizeAndValidate()](ocr.js:773)
- Row filling: [javascript.fillRow()](add_rows.js:539)

---

## Public API

- [javascript.$addRows()](add_rows.js:608)
  - Signature: `window.$addRows(rowsArray, onProgress?, transactionType?)`
  - Parameters:
    - `rowsArray`: Array<object> where keys match SSOT field ids
    - `onProgress?`: `(current:number, total:number) => void`
    - `transactionType?`: string – overrides global `window.TNO_TXN_TYPE`
  - Returns: `Promise<Array<number|null>>` of the new row indices

You can call this directly if you already have structured data (skipping OCR).

---

## Single Source of Truth (SSOT)

### Current Minimal Field Set
The default schema has been minimized to exactly the following fields. DOM names are computed as base + row index (+ optional suffix):

- stkcode_code (string)
  - DOM: base "stkcode_code" → examples: stkcode_code1, stkcode_code2
  - Spec: see [schema.js](schema.js:10)
- stkcode_desc (string)
  - DOM: base "stkcode_desc" → examples: stkcode_desc1, stkcode_desc2
  - Spec: see [schema.js](schema.js:11)
- desc (string)
  - DOM: base "desc" → examples: desc1, desc2
  - Spec: see [schema.js](schema.js:12)
- uom_trans_code (string)
  - DOM: base "uom_trans_code" with suffix "{i}_disp" → examples: uom_trans_code1_disp, uom_trans_code2_disp
  - Spec: see [schema.js](schema.js:14)
- qnty_total (number)
  - DOM: base "qnty_total" → examples: qnty_total1, qnty_total2
  - Spec: see [schema.js](schema.js:13)
- price_unitrate_forex (number)
  - DOM: base "fmi_aup" with suffix "{i}_disp" → examples: fmi_aup1_disp, fmi_aup2_disp
  - Spec: see [schema.js](schema.js)

- Fill order (default): ["stkcode_code","stkcode_desc","desc","uom_trans_code","qnty_total","price_unitrate_forex"] as defined in [schema.js](schema.js:21)
- Transactions: only "default" is currently defined; any other `window.TNO_TXN_TYPE` falls back to the default list in [schema.js](schema.js:19)

All fields and behavior are defined centrally in [schema.js](schema.js):

- `fields`: Each entry specifies:
  - `type`: `'string' | 'number' | 'boolean'` (drives OCR prompt and normalization)
  - `dom.base`: base input name (e.g., `uom_trans_code`)
  - `dom.suffix`: suffix template using `{i}` for row index (e.g., `'{i}_disp'` → `uom_trans_code1_disp`)
- `transactions`: Field whitelists per transaction type (e.g., `default`, `sales`, `inventory`)
- `fillOrder`: Default write order list of field ids

Add Rows reads SSOT via:
- [javascript.getAllowedKeys()](add_rows.js:28)
- [javascript.getColumnConfigs()](add_rows.js:41)
- [javascript.getFieldFillOrder()](add_rows.js:54)

OCR reads SSOT via:
- [javascript.getFieldSpec()](ocr.js:684) – derives types/keys
- [javascript.buildOcrPrompt()](ocr.js:721) – generates the model prompt with current transaction fields

---

## Field Naming and DOM Assumptions

The row engine builds names as:
```
name = fields[key].dom.base + rowIndex + computedSuffix
```

For example, with:
```
dom.base   = 'uom_trans_code'
dom.suffix = '{i}_disp'
```
The name for row 3 is `uom_trans_code3_disp`.

Add Rows uses:
- [javascript.getColumnName()](add_rows.js:413) to compute names
- [javascript.fillOneField()](add_rows.js:465) to write values safely (handles readonly/checkbox/list)

---

## OCR Pipeline

The modal and loader are injected dynamically by:
- [javascript.injectAiOcrStyles()](ocr.js:61)
- [javascript.injectAiOcrUi()](ocr.js:246)

On submit:
- Images are compressed
- Prompt is built from SSOT
- Request is sent to the configured Gemini model
- Response is parsed and normalized
- Rows are added and filled via [javascript.$addRows()](add_rows.js:608)

To set API key:
- Prefer `window.gemini_api_key` (or the library will read from `sessionStorage` or prompt)

---

## Transactions (Runtime Switch)

Set at runtime:
```js
window.TNO_TXN_TYPE = 'sales'; // or 'inventory', 'default'
```

This updates:
- OCR prompt fields and normalization
- Row write whitelist and order

---

## Extending the Schema

1) Add a new field
- Edit [schema.js](schema.js) → `fields[key] = { type, dom: { base, suffix } }`
- Add `key` to `transactions.default` or specific transactions
- Optionally add `key` to `fillOrder`

2) Remove or rename field
- Update or remove `fields[key]`
- Synchronize in `transactions` and `fillOrder`

No changes are needed in [add_rows.js](add_rows.js) or [ocr.js](ocr.js).

---

## Accessibility and Performance

- Loader and modal use appropriate ARIA roles/labels
- Loader animation is always visible (reduced-motion override disabled by default)
- DOM mutation stability checks after filling rows

---

## Focus/Blur (Human-like Interaction)

- The row filler simulates human interaction for all inputs to ensure host validators/formatters fire:
  - Fast path: focus → set value → change → blur via [javascript.typeFocusBlur()](add_rows.js:149) and [javascript.setValueDirectly()](add_rows.js:224), coordinated inside [javascript.fillOneField()](add_rows.js:465).
  - Checkboxes: focus → click/toggle → blur via [javascript.clickCheckboxLikeHuman()](add_rows.js:261).
  - Readonly/calculated fields (e.g., unit_price, amount): focus → blur still fires to trigger host blur-handlers; values are not overwritten inside [javascript.fillOneField()](add_rows.js:465).
  - Typing animation is optional; with [javascript.ENABLE_TYPING_ANIMATION](add_rows.js:20) = false, it still emits focus/blur for performance while preserving host logic. When true, it emits per-keystroke keyboard events.

## Background/Inactive Tab Behavior

- The pipeline continues in background tabs or when switching apps, but browser timer throttling makes short waits look “paused”:
  - Micro-waits and stability checks use timers and polling: [javascript.sleep()](add_rows.js:97), [javascript.waitForRowToBeShown()](add_rows.js:290), [javascript.waitForDomStable()](add_rows.js:312), [javascript.waitForDomStableLocal()](ocr.js:498). In inactive tabs, these can be clamped to ~1000ms+ per tick.
  - Network/OCR is unaffected by visibility throttling: requests run via [javascript.getOcrResults()](ocr.js:876).
  - Image compression runs on the main thread: [javascript.compressImage()](ocr.js:632); large images can cause UI jank.

Tips to keep it responsive under throttling:
- Prefer MutationObserver-first stability (already in use) with a single timeout fallback, and minimize setInterval polling windows.
- Consider skipping micro-waits when `document.hidden === true` and increasing timeouts for row detection to avoid false timeouts in background.
- For heavy images, move compression to a Web Worker to reduce main-thread contention.

## Changelog

- 2025-09-10: Ensure all inputs trigger focus/blur to mimic human interaction across text, number, hidden, checkbox, and readonly fields. See [javascript.fillOneField()](add_rows.js:465) and [javascript.typeFocusBlur()](add_rows.js:149).

## Troubleshooting

- If using the loader, ensure [javascript.TNO.load()](tno-loader.js:68) has executed before calling [javascript.$addRows()](add_rows.js:608). If using manual order, ensure [schema.js](schema.js) is included before the other scripts (the library enforces SSOT and throws if missing).
- Verify your page inputs’ `name` attributes conform to the SSOT mapping (base + rowIndex + suffix)
- Use console logs to see added row indices and any warnings

---

## License

MIT (or adapt to your project’s license policy)