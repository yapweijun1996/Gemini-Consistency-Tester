/**
 * @file TNO AI OCR Add Rows Demo Script
 * @description This script provides functionality to automate the addition of multiple non-stock rows in a web form.
 * It defines a global function `window.$addRows` and immediately invokes it to add 10 sample rows.
 *
 * Supported keys for each row object:
 *  - code, brand, desc_short, desc_long, uom, qty, unit_list, disc_pct,
 *  - unit_price, amount, unit_w_gst, conv, qty_uomstk, uprice_uomstk, uomstk,
 *  - gst, acct_disp, dept_disp, proj_disp, rqt_day, rqt_mth, rqt_yr, batchnum
 */
(() => {
    // ==========================================================================================
    // SECTION: Configuration
    // ==========================================================================================

    /**
     * @description Set to true to simulate human-like typing, false to set values instantly.
     * This can be configured by a developer for demonstration purposes.
     */
    const ENABLE_TYPING_ANIMATION = false;
    
    /**
     * Runtime tuning for waits. You can override by defining window.TNO_WAIT_CONFIG
     * before this script loads, e.g.:
     *   window.TNO_WAIT_CONFIG = { rowTimeout: 5000 };
     */
    const TNO_WAIT_CONFIG = (() => {
        const defaults = {
            rowTimeout: 2500,
            pollInterval: 25,
            domStablePre: 400,
            domStablePost: 600,
            stableMsPre: 100,
            stableMsPost: 150
        };
        const cfg = (window.TNO_WAIT_CONFIG && typeof window.TNO_WAIT_CONFIG === 'object')
            ? window.TNO_WAIT_CONFIG
            : {};
        return Object.assign({}, defaults, cfg);
    })();
    
    // fill order: now严格来自 TNO_SCHEMA.fillOrder（见 getFieldFillOrder），不再保留本地兜底常量
    
    // 字段 DOM 映射规则: 现在100%从 TNO_SCHEMA.fields 读取（见 getColumnConfigs），不再保留本地兜底常量
    
    // 交易白名单: 现在100%从 TNO_SCHEMA.transactions 读取（见 getAllowedKeys），不再保留本地兜底常量

    function getAllowedKeys(transactionType = 'default') {
        const schema = window.TNO_SCHEMA;
        if (!schema || !schema.transactions || !schema.fields) {
            throw new Error('TNO_SCHEMA missing: ensure schema.js is loaded BEFORE add_rows.js');
        }
        return schema.transactions[transactionType] || schema.transactions.default || Object.keys(schema.fields);
    }

    // Schema helpers (SSOT)
    function makeSuffixFn(pattern) {
        if (typeof pattern !== 'string') return (i) => i;
        return (i) => String(pattern).replace(/\{i\}/g, String(i));
    }
    function getColumnConfigs() {
        const schema = window.TNO_SCHEMA;
        if (!schema || !schema.fields) {
            throw new Error('TNO_SCHEMA missing: ensure schema.js is loaded BEFORE add_rows.js');
        }
        const out = {};
        for (const [key, def] of Object.entries(schema.fields)) {
            const base = def?.dom?.base;
            const pat = def?.dom?.suffix ?? '{i}';
            if (base) out[key] = { base, suffix: makeSuffixFn(pat) };
        }
        return out;
    }
    function getFieldFillOrder(transactionType = 'default') {
        const schema = window.TNO_SCHEMA;
        if (!schema || !schema.fields) {
            throw new Error('TNO_SCHEMA missing: ensure schema.js is loaded BEFORE add_rows.js');
        }
        const allowed = new Set(getAllowedKeys(transactionType));
        const order = Array.isArray(schema.fillOrder) ? schema.fillOrder : [];
        const fallback = Object.keys(schema.fields);
        const seq = order.length ? order : fallback;
        return seq.filter(k => allowed.has(k));
    }


    // ==========================================================================================
    // SECTION: DOM and Event Helpers
    // ==========================================================================================

    /**
     * Finds an element by its name attribute.
     * @param {string} name - The name of the element.
     * @returns {HTMLElement|null} The found element or null.
     */
    const getElementByName = (name) => document.getElementsByName(name)[0] || null;

    /**
     * Finds an element using a CSS selector.
     * @param {string} selector - The CSS selector.
     * @returns {HTMLElement|null} The found element or null.
     */
    const querySelector = (selector) => document.querySelector(selector);

    /**
     * Checks if an element is currently visible in the DOM.
     * @param {HTMLElement} element - The element to check.
     * @returns {boolean} True if the element is visible.
     */
    const isElementVisible = (element) => element && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';

    /**
     * Pauses execution for a specified duration.
     * @param {number} milliseconds - The time to sleep in milliseconds.
     * @returns {Promise<void>}
     */
    const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

    /**
     * Abortable sleep that can exit early when isAborted() becomes true.
     * Uses short ticks to periodically check abort flag.
     * @param {number} milliseconds
     * @param {() => boolean} [isAborted]
     * @returns {Promise<void>}
     */
    async function sleepAbortable(milliseconds, isAborted) {
        if (typeof isAborted === 'function' && isAborted()) return;
        const step = 20;
        let waited = 0;
        while (waited < milliseconds) {
            if (typeof isAborted === 'function' && isAborted()) return;
            const slice = Math.min(step, milliseconds - waited);
            await new Promise(r => setTimeout(r, slice));
            waited += slice;
        }
    }

    /**
     * Simulates focus events on an element.
     * @param {HTMLElement} element - The target element.
     */
    const fireFocusEvent = (element) => {
        element.focus();
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    };

    /**
     * Simulates blur events on an element.
     * @param {HTMLElement} element - The target element.
     */
    const fireBlurEvent = (element) => {
        element.blur();
        element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    };

    /**
     * Simulates a keyboard event on an element.
     * @param {HTMLElement} element - The target element.
     * @param {string} eventType - The type of key event (e.g., 'keydown').
     * @param {string} character - The character to simulate.
     */
    const fireKeyEvent = (element, eventType, character) => {
        const keyCode = (character && character.length === 1) ? character.toUpperCase().charCodeAt(0)
            : character === '.' ? 190
                : character === '-' ? 189
                    : 0;
        const keyEvent = new KeyboardEvent(eventType, { bubbles: true, cancelable: true, key: character, code: `Key${character}`, keyCode: keyCode, which: keyCode });
        try {
            Object.defineProperty(keyEvent, 'keyCode', { value: keyCode });
            Object.defineProperty(keyEvent, 'which', { value: keyCode });
        } catch (error) {
            // This may fail in some environments, but the event should still work.
        }
        element.dispatchEvent(keyEvent);
    };

    // ==========================================================================================
    // SECTION: Form Interaction Logic
    // ==========================================================================================

    /**
     * Simulates a user typing text into an input field, including focus and blur events.
     * @param {HTMLInputElement} element - The input element.
     * @param {string} text - The text to type.
     */
    async function typeFocusBlur(element, text, isAborted) {
        if (!element) return;
        try {
            element.readOnly = false;
            element.disabled = false;
        } catch (error) {
            // Element might be in a state that prevents modification.
        }
        if (typeof isAborted === 'function' && isAborted()) return;

        if (!ENABLE_TYPING_ANIMATION) {
            // Always simulate focus/blur even on fast path to mimic human interaction
            fireFocusEvent(element);
            setValueDirectly(element, text);
            fireBlurEvent(element);
            return;
        }

        // Inputs that do not support selection/typing should be set directly
        const type = (element.type || '').toLowerCase();
        const nonTextTypes = [
            'number','checkbox','radio','file',
            'date','datetime-local','month','week','time',
            'range','color'
        ];
        if (nonTextTypes.includes(type)) {
            // For non-text inputs (number, date, etc.), still mimic human focus/blur on fast path
            fireFocusEvent(element);
            setValueDirectly(element, text);
            await sleepAbortable(5, isAborted);
            fireBlurEvent(element);
            await sleepAbortable(5, isAborted);
            return;
        }
        if (!isElementVisible(element)) {
            // Safety: if called here for invisible elements, still dispatch focus/blur to trigger host logic
            fireFocusEvent(element);
            setValueDirectly(element, text);
            fireBlurEvent(element);
            return;
        }

        fireFocusEvent(element);
        await sleepAbortable(5, isAborted);

        // Some browsers expose selection APIs but throw on unsupported types.
        try { element.select?.(); } catch (_) {}
        try {
            element.setRangeText?.('', 0, element.value?.length ?? 0, 'end');
        } catch (_) {}
        element.value = '';
        element.setAttribute?.('value', element.value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await sleepAbortable(4, isAborted);

        for (const character of String(text)) {
            if (typeof isAborted === 'function' && isAborted()) break;
            fireKeyEvent(element, 'keydown', character);
            fireKeyEvent(element, 'keypress', character);
            element.value += character;
            element.setAttribute?.('value', element.value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            fireKeyEvent(element, 'keyup', character);
            await sleepAbortable(6, isAborted);
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        await sleepAbortable(8, isAborted);
        fireBlurEvent(element);
        await sleepAbortable(10, isAborted);
    }

    /**
     * Sets the value of an input element directly, bypassing user simulation.
     * @param {HTMLInputElement} element - The input element.
     * @param {string|number} value - The value to set.
     */
    function setValueDirectly(element, value) {
        if (!element) return;
        try {
            element.readOnly = false;
            element.disabled = false;
        } catch (error) {
            // Element might be in a state that prevents modification.
        }

        const type = (element.type || '').toLowerCase();

        // Handle checkbox/radio safely
        if (type === 'checkbox' || type === 'radio') {
            const desired = !!value;
            if (element.checked !== desired) {
                element.checked = desired;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                // Still emit change to mimic user interaction chains
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }

        // Default for text-like fields
        element.value = String(value ?? '');
        element.setAttribute?.('value', element.value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Simulates a human-like click on a checkbox to set its state.
     * @param {HTMLInputElement} checkbox - The checkbox element.
     * @param {boolean} isChecked - The desired checked state.
     */
    function clickCheckboxLikeHuman(checkbox, isChecked) {
        if (!checkbox) return;
        const needsToggle = (!!checkbox.checked !== !!isChecked);
        if (needsToggle) {
            checkbox.click(); // Toggles and fires change event
        }
        // If no state change is needed, avoid dispatching extra events
    }

    /**
     * Gets the index of the last visible row on the form.
     * @returns {number|null} The index of the last row, or null if not found.
     */
    const getCurrentRowIndex = () => {
        const hiddenMaxRow = getElementByName('HddenMaxRowAdded');
        if (hiddenMaxRow && hiddenMaxRow.value && !isNaN(hiddenMaxRow.value)) {
            return parseInt(hiddenMaxRow.value, 10);
        }
        const visibleRows = [...document.querySelectorAll('tr[id^="rowtr"]')].filter(isElementVisible);
        const rowNumbers = visibleRows.map(row => parseInt(row.id.replace('rowtr', ''), 10)).filter(num => !isNaN(num));
        return rowNumbers.length ? Math.max(...rowNumbers) : null;
    };

    /**
     * Waits for a new row to become visible in the DOM.
     * @param {number} rowIndex - The index of the row to wait for.
     * @param {number} [timeoutMs=8000] - The maximum time to wait.
     * @returns {Promise<boolean>} True if the row becomes visible, false if it times out.
     */
    const waitForRowToBeShown = async (rowIndex, timeoutMs = TNO_WAIT_CONFIG.rowTimeout, isAborted) => {
        const rowsContainer = document.querySelector('#rowsTable tbody') || document.body;
        const hiddenMaxRowEl = getElementByName('HddenMaxRowAdded');
        const pollInterval = (TNO_WAIT_CONFIG && TNO_WAIT_CONFIG.pollInterval) || 25;
    
        function check() {
            if (typeof isAborted === 'function' && isAborted()) return 'aborted';
            const hiddenVal = hiddenMaxRowEl && !isNaN(hiddenMaxRowEl.value) ? parseInt(hiddenMaxRowEl.value, 10) : null;
            if (hiddenVal != null && hiddenVal >= rowIndex) return true;
            const rowEl = document.getElementById(`rowtr${rowIndex}`);
            if (rowEl && isElementVisible(rowEl)) return true;
            return false;
        }
    
        const initial = check();
        if (initial === true) return true;
        if (initial === 'aborted') return false;
    
        return await new Promise((resolve) => {
            let done = false;
            let observer1 = null;
            let observer2 = null;
    
            const finish = (result) => {
                if (done) return;
                done = true;
                try { observer1 && observer1.disconnect(); } catch {}
                try { observer2 && observer2.disconnect(); } catch {}
                clearInterval(poller);
                clearTimeout(timer);
                resolve(result);
            };
    
            try {
                observer1 = new MutationObserver(() => {
                    const r = check();
                    if (r === true) return finish(true);
                    if (r === 'aborted') return finish(false);
                });
                observer1.observe(rowsContainer, { childList: true, subtree: true, attributes: true });
            } catch {}
    
            if (hiddenMaxRowEl) {
                try {
                    observer2 = new MutationObserver(() => {
                        const r = check();
                        if (r === true) return finish(true);
                        if (r === 'aborted') return finish(false);
                    });
                    observer2.observe(hiddenMaxRowEl, { attributes: true, attributeFilter: ['value'] });
                } catch {}
            }
    
            const poller = setInterval(() => {
                const r = check();
                if (r === true) return finish(true);
                if (r === 'aborted') return finish(false);
            }, pollInterval);
    
            const timer = setTimeout(() => finish(false), timeoutMs);
        });
    };

    /**
     * Waits until the container stops mutating for a continuous period (stableMs) or until timeout.
     * Helps ensure all async side-effects from input/change handlers are done before reporting progress.
     * @param {HTMLElement} container
     * @param {number} [timeoutMs=8000]
     * @param {number} [stableMs=250]
     * @returns {Promise<boolean>} true if stable observed, false if timed out
     */
    async function waitForDomStable(container, timeoutMs = 8000, stableMs = 250, isAborted) {
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
            // If observing fails (very old env), consider it stable.
            return true;
        }

        return await new Promise((resolve) => {
            const checkInterval = 50;
            const intervalId = setInterval(() => {
                if (typeof isAborted === 'function' && isAborted()) {
                    clearInterval(intervalId);
                    observer.disconnect();
                    resolve(false);
                    return;
                }
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

    /**
     * Ensures a hidden select list for prices exists for a given row.
     * @param {number} rowIndex - The index of the row.
     */
    function ensurePriceListExists(rowIndex) {
        const priceListName = `fmi_aup${rowIndex}_list`;
        if (getElementByName(priceListName)) return;
        const selectElement = document.createElement('select');
        selectElement.name = priceListName;
        selectElement.size = 7;
        selectElement.style.position = 'absolute';
        selectElement.style.visibility = 'hidden';
        (getElementByName(`fmi_aup${rowIndex}_disp`)?.form || document.forms[0] || document.body).appendChild(selectElement);
    }

    /**
     * Ensures a hidden select list for UOM exists for a given row.
     * @param {number} rowIndex - The index of the row.
     */
    function ensureUomListExists(rowIndex) {
        const uomListName = `uom_trans_code${rowIndex}_list`;
        if (getElementByName(uomListName)) return;
        const selectElement = document.createElement('select');
        selectElement.name = uomListName;
        selectElement.size = 7;
        selectElement.style.position = 'absolute';
        selectElement.style.visibility = 'hidden';
        (getElementByName(`uom_trans_code${rowIndex}_disp`)?.form || document.forms[0] || document.body).appendChild(selectElement);
    }

    /**
     * Temporarily suppresses inline event handlers on an element while executing a function.
     * @param {HTMLElement} element - The element with inline handlers.
     * @param {Function} callback - The function to execute.
     */
    function withSuppressedInlineHandlers(element, callback) {
        if (!element) return;
        const originalAttributes = {};
        ['onfocus', 'onblur', 'onkeyup', 'onchange'].forEach(attr => {
            originalAttributes[attr] = element.getAttribute(attr);
            if (originalAttributes[attr] != null) {
                element.setAttribute(attr, '');
            }
        });
        try {
            callback();
        } finally {
            Object.entries(originalAttributes).forEach(([attr, value]) => {
                if (value == null) {
                    element.removeAttribute(attr);
                } else {
                    element.setAttribute(attr, value);
                }
            });
        }
    }

    /**
     * Gets the name of a form field for a specific row and key.
     * @param {number} rowIndex - The index of the row.
     * @param {string} key - The key identifying the field.
     * @returns {string|undefined} The name of the form field.
     */
    function getColumnName(rowIndex, key, transactionType = 'default') {
        const allowedKeys = getAllowedKeys(transactionType);
        if (!allowedKeys.includes(key)) return undefined;
        const cfg = getColumnConfigs()[key];
        if (!cfg) return undefined;
        const suffix = typeof cfg.suffix === 'function' ? cfg.suffix(rowIndex) : (cfg.suffix ?? '');
        return `${cfg.base}${suffix}`;
    }

    // ==========================================================================================
    // SECTION: Core Application Logic
    // ==========================================================================================

    /**
     * Trap window.alert during a batch add operation. If any alert() occurs,
     * stop further processing and throw an error so upstream can react (loader/catch).
     *
     * Usage:
     *   await withAlertTrap(async (isAborted) => {
     *     // do work in loops; check isAborted() to stop early between steps
     *   });
     *
     * @param {(isAborted: () => boolean) => Promise<any>} executor
     */
    async function withAlertTrap(executor) {
        const originalAlert = window.alert;
        let aborted = false;
        let lastMsg = '';
        window.alert = function (msg) {
            try { originalAlert.call(window, msg); } catch (_) {}
            aborted = true;
            lastMsg = String(msg ?? '');
        };
        try {
            const result = await executor(() => aborted);
            if (aborted) {
                const err = new Error('Aborted by alert: ' + lastMsg);
                err.code = 'TNO_ALERT_ABORT';
                throw err;
            }
            return result;
        } finally {
            window.alert = originalAlert;
        }
    }

    /**
     * Fills a single field in a row with a given value.
     * @param {number} rowIndex - The index of the row.
     * @param {string} key - The key identifying the field.
     * @param {*} value - The value to fill.
     */
    async function fillOneField(rowIndex, key, value, transactionType = 'default', isAborted) {
        const fieldName = getColumnName(rowIndex, key, transactionType);
        if (!fieldName) return;
        if (typeof isAborted === 'function' && isAborted()) return;

        if (key === 'gst') {
            const cb = getElementByName(fieldName);
            if (cb) {
                // Mimic human interaction for checkbox: focus -> click/toggle -> blur
                fireFocusEvent(cb);
                clickCheckboxLikeHuman(cb, !!value);
                fireBlurEvent(cb);
            }
            return;
        }

        if (key === 'unit_list' || key === 'price_unitrate_forex') {
            const flag = getElementByName(`fmi_unit_price_editable${rowIndex}`);
            if (flag) flag.value = 'y';
            if (typeof window.UnitPriceEditable === 'function') {
                try {
                    UnitPriceEditable(rowIndex);
                } catch (error) {
                    // Ignore errors from legacy functions.
                }
            } else {
                try {
                    getElementByName(fieldName)?.click();
                } catch (error) {
                    // Ignore errors from legacy functions.
                }
            }
            ensurePriceListExists(rowIndex);
        }
        if (key === 'uom' || key === 'uom_trans_code') {
            ensureUomListExists(rowIndex);
        }

        const element = getElementByName(fieldName);
        if (!element) return;

        // Skip typing into readonly/calculated fields, but set directly if invisible/hidden
        if ((key === 'unit_price' || key === 'amount') && (element.readOnly || element.hasAttribute('readonly'))) {
            // Read-only/calculated fields: still trigger focus/blur to mimic user
            try { fireFocusEvent(element); } catch (_) {}
            try { fireBlurEvent(element); } catch (_) {}
            return;
        }

        if (!isElementVisible(element) || element.type === 'hidden') {
            // Even for hidden/invisible fields, dispatch synthetic focus/blur to trigger host logic
            fireFocusEvent(element);
            setValueDirectly(element, value);
            fireBlurEvent(element);
            return;
        }

        const isSmartBox = (key === 'acct_disp' || key === 'dept_disp' || key === 'proj_disp');
        if (isSmartBox) {
            withSuppressedInlineHandlers(element, () => setValueDirectly(element, value));
            fireFocusEvent(element);
            await sleepAbortable(5, isAborted);
            fireBlurEvent(element);
            await sleepAbortable(5, isAborted);
            return;
        }

        await typeFocusBlur(element, String(value), isAborted);
    }

    /**
     * Fills all the fields in a single row with data.
     * @param {number} rowIndex - The index of the row.
     * @param {object} data - An object containing the data for the row.
     */
    async function fillRow(rowIndex, data, transactionType = 'default', isAborted, isStockItem = false) {
        const order = getFieldFillOrder(transactionType);
        const fieldsToSkip = new Set();

        // If it was a stock item found via search, the system populates some fields.
        // We should not overwrite them.
        if (isStockItem) {
            fieldsToSkip.add('stkcode_code');
            fieldsToSkip.add('stkcode_desc');
            fieldsToSkip.add('desc'); // Often populated as well
        }

        // Fill fields based on the fill order
        for (const key of order) {
            if (typeof isAborted === 'function' && isAborted()) break;
            if (fieldsToSkip.has(key)) continue;
            if (!(key in data)) continue;

            const value = data[key];
            if (value == null || (typeof value === 'string' && value.trim() === '')) continue;

            await fillOneField(rowIndex, key, value, transactionType, isAborted);
        }

        try {
            if (typeof fixNumberDecimal === 'function') {
                fixNumberDecimal('number', 'all');
                fixNumberDecimal('text', 'all');
            }
        } catch (error) {
            // Ignore errors from legacy functions.
        }
    }

    /**
     * Adds a new non-stock row and fills it with the provided data.
     * @param {object} payload - The data for the new row.
     * @returns {Promise<number|null>} The index of the new row, or null on failure.
     */
    async function addOneRowAndFill(payload, transactionType = 'default', isAborted) {
        const initialRowIndex = getCurrentRowIndex() || 0;
        const stockCodeValue = payload['stkcode_code'];
        let newRowIndex = null;
        let isStockItem = false;

        // Step 1: Try to find an existing stock item IF a stock code is provided.
        if (stockCodeValue && String(stockCodeValue).trim() !== '') {
            try {
                await window.autoSearchStockCode(stockCodeValue, {
                    rowIndex: initialRowIndex + 1, // Pass the potential next row index
                    onLog: (msg, ...args) => console.log(`Row ${initialRowIndex + 1} stkcode: ${msg}`, ...args),
                    isAborted: isAborted
                });
                // A successful search creates a new row via side-effect.
                // We need to wait and see if a new row was actually added.
                const latestRowIndex = await new Promise(resolve => {
                    let attempts = 0;
                    const interval = setInterval(() => {
                        const currentIndex = getCurrentRowIndex() || 0;
                        if (currentIndex > initialRowIndex || attempts > 50) { // 5s timeout
                            clearInterval(interval);
                            resolve(currentIndex);
                        }
                        attempts++;
                    }, 100);
                });

                if (latestRowIndex > initialRowIndex) {
                    newRowIndex = latestRowIndex;
                    isStockItem = true;
                }
            } catch (error) {
                console.warn(`Stock code search failed for "${stockCodeValue}", treating as non-stock.`, error);
            }
        }

        // Step 2: If no stock item was found/selected, add a new non-stock row.
        if (!isStockItem) {
            const addButton = querySelector('#gononstockbtn');
            if (!addButton) {
                console.warn('Non-stock button #gononstockbtn not found.');
                return null;
            }
            addButton.click();
            const expectedRowIndex = initialRowIndex + 1;
            const isRowShown = await waitForRowToBeShown(expectedRowIndex, TNO_WAIT_CONFIG.rowTimeout, isAborted);
            if (!isRowShown) {
                console.warn('Timed out waiting for new non-stock row', expectedRowIndex);
                return null;
            }
            newRowIndex = expectedRowIndex;
        }

        if (newRowIndex === null) {
            console.warn('Failed to create or find a new row.');
            return null;
        }

        // Step 3: Fill the row with data.
        const rowsContainer = document.querySelector('#rowsTable tbody') || document.body;
        // Wait for stability before filling, with tuned (faster) timeouts.
        await waitForDomStable(rowsContainer, TNO_WAIT_CONFIG.domStablePre, TNO_WAIT_CONFIG.stableMsPre, isAborted);

        await fillRow(newRowIndex, payload || {}, transactionType, isAborted, isStockItem);

        // Wait for stability after filling, with tuned (faster) timeouts.
        await waitForDomStable(rowsContainer, TNO_WAIT_CONFIG.domStablePost, TNO_WAIT_CONFIG.stableMsPost, isAborted);

        console.log('✅ Added & filled row', newRowIndex);
        return newRowIndex;
    }

    // ==========================================================================================
    // SECTION: Public API and Execution
    // ==========================================================================================

    /**
     * Public API to add multiple rows to the form.
     * @param {Array<object>} rows - An array of row data objects.
     * @returns {Promise<Array<number|null>>} A list of the new row IDs.
     */
    window.$addRows = async function (rows, onProgress = null, transactionType = 'default') {
        if (!Array.isArray(rows) || rows.length === 0) {
            console.warn('Pass an array of row objects to $addRows([...]).');
            return [];
        }
        return await withAlertTrap(async (isAborted) => {
            const newRowIds = [];
            const totalRows = rows.length;
            for (let i = 0; i < totalRows; i++) {
                if (isAborted()) break;

                const payload = rows[i];
                const newRowId = await addOneRowAndFill(payload || {}, transactionType, isAborted);
                newRowIds.push(newRowId);

                if (isAborted()) break;

                // If a progress callback is provided, call it.
                if (onProgress) {
                    // current is 1-based for display
                    onProgress(i + 1, totalRows);
                }

            }
            return newRowIds;
        });
    };


    /**
     * Automates the stock code search modal: enters a key, triggers search, waits for results,
     * selects the best match, and closes the modal.
     * @param {string} key The search term (e.g., a stock code).
     * @param {object} [options] Configuration for the search process.
     * @param {string} [options.inputSelector='#stkquery'] The CSS selector for the search input field.
     * @param {number} [options.timeout=20000] Maximum time to wait for results, in milliseconds.
     * @param {number} [options.interval=120] Polling interval to check for results, in milliseconds.
     * @param {number} [options.afterSelectionCloseDelay=400] Delay after selecting an item before closing the modal.
     * @param {function} [options.onLog] A callback for logging progress and errors.
     * @param {function} [options.isAborted] A function that returns true if the operation should be cancelled.
     * @returns {Promise<string|true>} A promise that resolves with the selected item's text or true on success, and rejects on failure or timeout.
     */
    window.autoSearchStockCode = function(key, options = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!key || typeof key !== 'string') {
                    return reject(new Error('Key must be a non-empty string'));
                }

                const {
                    inputSelector = '#general_stk_query',
                    timeout = 20000,
                    interval = 120,
                    afterSelectionCloseDelay = 400,
                    onLog = (msg, ...args) => {
                        if (msg.startsWith('✅') || msg.startsWith('ℹ️')) console.log(msg, ...args);
                        else console.error(msg, ...args);
                    },
                    isAborted = () => false,
                    rowIndex
                } = options;

                if (isAborted()) return reject(new Error('Aborted before starting'));

                // Helper to wait for an element to appear
                const waitForElement = (selector, timeoutMs = 5000) => {
                    return new Promise((res, rej) => {
                        const t0 = Date.now();
                        const timer = setInterval(() => {
                            const el = document.querySelector(selector);
                            if (el) {
                                clearInterval(timer);
                                return res(el);
                            }
                            if (Date.now() - t0 > timeoutMs) {
                                clearInterval(timer);
                                return rej(new Error(`Element ${selector} not found within ${timeoutMs}ms`));
                            }
                        }, 100);
                    });
                };

                // Trigger the search modal by interacting with the row's input field first
                const rowInputName = `stkcode_code${rowIndex}`;
                const rowInput = document.getElementsByName(rowInputName)[0];
                if (rowInput && typeof rowInput.click === 'function') {
                    rowInput.click();
                }

                const input = await waitForElement(inputSelector);

                // ================= Helpers (scoped inside promise) =================
                const visible = el => !!el && el.offsetParent !== null;

                function collectDocs(win = window, acc = new Set()) {
                    try { if (win.document) acc.add(win.document); } catch {}
                    const n = (win.frames && win.frames.length) || 0;
                    for (let i = 0; i < n; i++) {
                        try {
                            const f = win.frames[i];
                            if (f && f.document && !acc.has(f.document)) collectDocs(f, acc);
                        } catch {}
                    }
                    return [...acc];
                }

                function findBestItemLink(docs, searchKey) {
                    for (const d of docs) {
                        const all = Array.from(d.querySelectorAll('a[onclick*="itemselectedpart"]'));
                        if (!all.length) continue;
                        const vis = all.filter(visible);
                        const byTextVis = vis.find(a => (a.textContent || '').replace(/\s+/g, '').startsWith(searchKey));
                        if (byTextVis) return byTextVis;
                        const byTextAny = all.find(a => (a.textContent || '').replace(/\s+/g, '').startsWith(searchKey));
                        if (byTextAny) return byTextAny;
                        if (vis[0]) return vis[0];
                        return all[0];
                    }
                    return null;
                }

                function robustClick(el) {
                    const w = el.ownerDocument?.defaultView || window;
                    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(type =>
                        el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, view: w }))
                    );
                }

                function forceRunOnclick(a) {
                    const w = a.ownerDocument?.defaultView || window;
                    const oc = a.getAttribute('onclick') || '';
                    if (!oc) return false;
                    try { w.eval(oc); return true; } catch { return false; }
                }

                function explicitEmptyDetected(docs) {
                    for (const d of docs) {
                        try {
                            const t = d.querySelector('table.results-table');
                            if (t && /no record found/i.test(t.textContent || '')) return true;
                        } catch {}
                    }
                    return false;
                }

                function overlayStillVisible() {
                    const div = document.querySelector('#showrecdiv');
                    if (!div) return false;
                    const cs = getComputedStyle(div);
                    return cs.display !== 'none' && cs.visibility !== 'hidden' && div.offsetParent !== null;
                }

                function clickClose() {
                    const icon = document.querySelector('#showrecdiv i.fa-window-close') || document.querySelector('#showrectable i.fa-window-close') || document.querySelector('#showrectablesor i.fa-window-close');
                    const clickableContainer = icon?.closest('[onclick]');
                    if (clickableContainer) robustClick(clickableContainer);
                    else if (icon) robustClick(icon);
                    if (typeof window.hideRecordEvent === 'function') window.hideRecordEvent();
                    if (typeof window.resetSort === 'function') window.resetSort();
                    onLog('✅ Close attempted');
                }

                // ================= Main flow =================
                input.value = key;
                input.focus();
                setTimeout(() => {
                    if (isAborted()) return reject(new Error('Aborted during input'));
                    if (typeof input.onkeypress === 'function') {
                        input.onkeypress.call(input, { keyCode: 13, which: 13, charCode: 13, key: 'Enter' });
                    } else {
                        const evt = new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter' });
                        try { Object.defineProperty(evt, 'keyCode', { get: () => 13 }); } catch {}
                        try { Object.defineProperty(evt, 'which', { get: () => 13 }); } catch {}
                        input.dispatchEvent(evt);
                    }
                    setTimeout(() => {
                        input.blur();
                        if (isAborted()) return reject(new Error('Aborted during blur'));
                        watchAndSelectThenClose();
                    }, 120);
                }, 40);

                function watchAndSelectThenClose() {
                    const t0 = Date.now();
                    (function poll() {
                        if (isAborted()) return reject(new Error('Aborted during polling'));
                        const docs = collectDocs();
                        const link = findBestItemLink(docs, key);
                        if (link) {
                            robustClick(link);
                            const onclickSuccess = forceRunOnclick(link);
                            const selectedText = (link.textContent || '').trim();
                            onLog('✅ Selected item:', selectedText);
                            setTimeout(() => {
                                // Always attempt to close as a fallback, in case the native close fails.
                                // The clickClose() function is safe to call even if the modal is already gone.
                                clickClose();
                                if (onclickSuccess) resolve(selectedText || true);
                                else reject(new Error('Failed to execute onclick after selection'));
                            }, afterSelectionCloseDelay);
                            return;
                        }
                        if (explicitEmptyDetected(docs)) {
                            onLog('ℹ️ Empty state detected → closing overlay');
                            clickClose();
                            return resolve(true);
                        }
                        if (Date.now() - t0 < timeout) {
                            setTimeout(poll, interval);
                        } else {
                            const err = new Error('Timeout: no item link found and no empty-state detected.');
                            onLog(err.message);
                            reject(err);
                        }
                    })();
                }
            } catch (err) {
                reject(err);
            }
        });
    };
})();