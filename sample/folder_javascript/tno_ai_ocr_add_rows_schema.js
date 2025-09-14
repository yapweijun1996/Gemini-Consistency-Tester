/**
 * Single Source of Truth schema for fields, DOM mapping, transactions, and fill order.
 * Loaded as window.TNO_SCHEMA for both OCR and Add Rows modules.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.TNO_SCHEMA = Object.freeze({
    fields: {
      // Minimal required fields only
      stkcode_code: { type: 'string', dom: { base: 'stkcode_code', suffix: '{i}' }, minLen: 3, maxLen: 64 },
      description: { type: 'string', dom: { base: 'stkcode_desc', suffix: '{i}' }, maxLen: 120 },
      remark:         { type: 'string', dom: { base: 'desc',          suffix: '{i}' }, maxLen: 500 },
      qnty_total:   { type: 'number', dom: { base: 'qnty_total',    suffix: '{i}' } },
      uom_trans_code: { type: 'string', dom: { base: 'uom_trans_code', suffix: '{i}_disp' }, maxLen: 16 },
      price_unitrate_forex: { type: 'number', dom: { base: 'fmi_aup', suffix: '{i}_disp' } }
    },
    transactions: {
      // Only default is defined; other txn types will fall back to default automatically.
      default: ['stkcode_code','description','remark','uom_trans_code','qnty_total','price_unitrate_forex']
    },
    fillOrder: ['stkcode_code','description','remark','uom_trans_code','qnty_total','price_unitrate_forex']
  });
})();