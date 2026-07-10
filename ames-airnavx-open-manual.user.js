// ==UserScript==
// @name         AMES 自定义工卡打开手册
// @namespace    https://juneyaoair.com/
// @version      1.10.1
// @description  AMES 工卡手册打开、工程文件评估快捷查询增强
// @author       Codex
// @match        https://ames.juneyaoair.com/views/*
// @updateURL    https://raw.githubusercontent.com/amiaopet/ames/main/ames-airnavx-open-manual.user.js
// @downloadURL  https://raw.githubusercontent.com/amiaopet/ames/main/ames-airnavx-open-manual.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_CLASS = 'airnavx-open-manual';
  const BUTTON_WRAP_CLASS = 'airnavx-open-manual-wrap';
  const EVAL_PREVIOUS_BUTTON_CLASS = 'airnavx-eval-previous';
  const EVAL_TOOL_BUTTON_CLASS = 'airnavx-eval-tool-button';
  const EVAL_RETURN_STATE_KEY = '__airnavxEngineeringEvalReturnState';
  const SEARCH_BASE = 'https://airnavx.juneyaoair.com/airnavx/search/text?q=';
  const REFERENCE_HEADERS = ['参考资料', '参考手册'];
  const MIN_REFERENCE_WIDTH = 210;
  const MAX_REFERENCE_WIDTH = 320;
  const BUTTON_WIDTH_ALLOWANCE = 78;
  const EVAL_FILE_VERSION_WIDTH = 150;
  const EVAL_SEARCH_FIELD_IDS = [
    'fileNo',
    'evaModel',
    'wfStatus',
    'evaAta',
    'fileType',
    'hoIfOcAd',
    'evaNo',
    'dataTitle',
    'evaManName',
    'evaResult',
    'ifAgainEva'
  ];

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeDash(value) {
    return String(value || '').replace(/[‐‑‒–—−]/g, '-');
  }

  function isVisibleElement(element) {
    if (!element) {
      return true;
    }

    try {
      const ownerWindow = element.ownerDocument.defaultView || window;
      const style = ownerWindow.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0;
    } catch (error) {
      return true;
    }
  }

  function isVisibleFrameWindow(targetWindow) {
    try {
      if (!targetWindow.frameElement) {
        return true;
      }
      return isVisibleElement(targetWindow.frameElement);
    } catch (error) {
      return true;
    }
  }

  function getCandidateDocuments() {
    const documents = [document];

    if (window.top === window) {
      document.querySelectorAll('iframe, frame').forEach((frame) => {
        if (!isVisibleElement(frame)) {
          return;
        }

        try {
          if (frame.contentDocument) {
            documents.push(frame.contentDocument);
          }
        } catch (error) {
          // Ignore cross-origin frames.
        }
      });
    }

    return documents;
  }

  function normalizeManualNo(value) {
    const raw = normalizeDash(cleanText(value))
      .replace(/^AMM\s+/i, '')
      .replace(/[，,;；].*$/, '');

    const match = raw.match(/\b(\d{6}(?:-\d{3}){2}(?:-[A-Z]\d*)?)\b/i) ||
      raw.match(/\b(\d{2}-\d{2}-\d{2}(?:-\d{3}){2}(?:-[A-Z]\d*)?)\b/i);

    if (!match) {
      return '';
    }

    const manualNo = match[1].toUpperCase();
    return manualNo.replace(/^(\d{2})(\d{2})(\d{2})(?=-)/, '$1-$2-$3');
  }

  function getCellPlainText(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll(`.${BUTTON_WRAP_CLASS}, .${BUTTON_CLASS}`).forEach((node) => node.remove());
    return cleanText(clone.textContent);
  }

  function estimateTextWidth(text) {
    return Array.from(cleanText(text)).reduce((width, char) => {
      return width + (char.charCodeAt(0) > 255 ? 14 : 8);
    }, 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getGridScope(bodyTable, targetDocument) {
    const gridView = bodyTable.closest('.datagrid-view2, .datagrid-view');
    return gridView || targetDocument;
  }

  function getHeaderTexts(bodyTable, targetDocument) {
    const scope = getGridScope(bodyTable, targetDocument);
    const headerRows = Array.from(scope.querySelectorAll('.datagrid-htable tr'));
    const lastHeaderRow = headerRows[headerRows.length - 1];
    return lastHeaderRow
      ? Array.from(lastHeaderRow.children).map((cell) => cleanText(cell.textContent))
      : [];
  }

  function getColumnIndexByHeader(bodyTable, targetDocument, headerName) {
    const scope = getGridScope(bodyTable, targetDocument);
    const headerRows = Array.from(scope.querySelectorAll('.datagrid-htable tr'));

    for (let rowIndex = headerRows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const cells = Array.from(headerRows[rowIndex].children);
      const index = cells.findIndex((cell) => cleanText(cell.textContent) === headerName);
      if (index >= 0) {
        return index;
      }
    }

    return -1;
  }

  function getReferenceColumnIndex(bodyTable, targetDocument) {
    for (const headerName of REFERENCE_HEADERS) {
      const columnIndex = getColumnIndexByHeader(bodyTable, targetDocument, headerName);
      if (columnIndex >= 0) {
        return columnIndex;
      }
    }

    return -1;
  }

  function getFleetColumnIndex(bodyTable, targetDocument) {
    return getColumnIndexByHeader(bodyTable, targetDocument, '机队');
  }

  function getFileNoColumnIndex(bodyTable, targetDocument) {
    return getColumnIndexByHeader(bodyTable, targetDocument, '文件编号');
  }

  function getFileVersionColumnIndex(bodyTable, targetDocument) {
    return getColumnIndexByHeader(bodyTable, targetDocument, '文件版次');
  }

  function getColumnCellClass(bodyTable, targetDocument, columnIndex) {
    const headerRows = Array.from(getGridScope(bodyTable, targetDocument).querySelectorAll('.datagrid-htable tr'));
    const lastHeaderRow = headerRows[headerRows.length - 1];
    const headerCell = lastHeaderRow && lastHeaderRow.children[columnIndex];
    const cellNode = headerCell && headerCell.querySelector('.datagrid-cell');

    if (!cellNode) {
      return '';
    }

    return Array.from(cellNode.classList).find((className) => /^datagrid-cell-c\d+-/.test(className)) || '';
  }

  function getReferenceTargetWidth(bodyTable, referenceColumnIndex) {
    let maxTextWidth = estimateTextWidth('参考资料');

    bodyTable.querySelectorAll('tbody tr').forEach((row) => {
      const contentNode = getCellContentNode(row.children[referenceColumnIndex]);
      if (contentNode) {
        maxTextWidth = Math.max(maxTextWidth, estimateTextWidth(getCellPlainText(contentNode)));
      }
    });

    return clamp(maxTextWidth + BUTTON_WIDTH_ALLOWANCE, MIN_REFERENCE_WIDTH, MAX_REFERENCE_WIDTH);
  }

  function applyReferenceColumnWidth(bodyTable, targetDocument, referenceColumnIndex) {
    const cellClass = getColumnCellClass(bodyTable, targetDocument, referenceColumnIndex);
    if (!cellClass) {
      return;
    }

    const targetWidth = getReferenceTargetWidth(bodyTable, referenceColumnIndex);
    const styleId = `airnavx-width-${cellClass}`;
    let style = targetDocument.getElementById(styleId);

    if (!style) {
      style = targetDocument.createElement('style');
      style.id = styleId;
      targetDocument.head.appendChild(style);
    }

    style.textContent = `
      .${cellClass} {
        width: ${targetWidth}px !important;
        min-width: ${targetWidth}px !important;
      }
    `;
  }

  function applyFixedColumnWidth(bodyTable, targetDocument, columnIndex, width, styleKey) {
    const cellClass = getColumnCellClass(bodyTable, targetDocument, columnIndex);
    if (!cellClass) {
      return;
    }

    const styleId = `airnavx-${styleKey}-${cellClass}`;
    let style = targetDocument.getElementById(styleId);

    if (!style) {
      style = targetDocument.createElement('style');
      style.id = styleId;
      targetDocument.head.appendChild(style);
    }

    style.textContent = `
      .${cellClass} {
        width: ${width}px !important;
        min-width: ${width}px !important;
      }
    `;
  }

  function buildButton(manualNo, targetDocument) {
    const wrap = targetDocument.createElement('span');
    wrap.className = BUTTON_WRAP_CLASS;

    const button = targetDocument.createElement('a');
    button.className = BUTTON_CLASS;
    button.textContent = '打开手册';
    button.href = SEARCH_BASE + encodeURIComponent(manualNo);
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.title = `在 AirNavX 搜索 ${manualNo}`;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    wrap.appendChild(button);
    return wrap;
  }

  function removeManualButton(cell) {
    const contentNode = getCellContentNode(cell);
    if (!contentNode) {
      return;
    }

    contentNode.querySelectorAll(`.${BUTTON_WRAP_CLASS}, .${BUTTON_CLASS}`).forEach((node) => node.remove());
  }

  function enhanceReferenceCell(cell, targetDocument) {
    const contentNode = cell.querySelector('.datagrid-cell') || cell;
    const manualNo = normalizeManualNo(getCellPlainText(contentNode));
    if (!manualNo) {
      removeManualButton(cell);
      return;
    }

    removeManualButton(cell);
    contentNode.insertBefore(buildButton(manualNo, targetDocument), contentNode.firstChild);
  }

  function getCellContentNode(cell) {
    return cell && (cell.querySelector('.datagrid-cell') || cell);
  }

  function getRowCellText(row, columnIndex) {
    const contentNode = getCellContentNode(row.children[columnIndex]);
    return contentNode ? getCellPlainText(contentNode) : '';
  }

  function removeButtons(cell, selector) {
    const contentNode = getCellContentNode(cell);
    if (!contentNode) {
      return;
    }

    contentNode.querySelectorAll(selector).forEach((node) => node.remove());
  }

  function looksLikeJobCardGrid(bodyTable, targetDocument) {
    const headerTexts = getHeaderTexts(bodyTable, targetDocument);
    const hasReferenceHeader = REFERENCE_HEADERS.some((headerName) => headerTexts.includes(headerName));

    return headerTexts.includes('工卡号') &&
      headerTexts.includes('机队') &&
      hasReferenceHeader;
  }

  function enhanceTablesInDocument(targetDocument) {
    const targetWindow = targetDocument.defaultView || window;

    if (!isVisibleFrameWindow(targetWindow)) {
      return;
    }

    targetDocument.querySelectorAll('table.datagrid-btable').forEach((bodyTable) => {
      if (!looksLikeJobCardGrid(bodyTable, targetDocument)) {
        return;
      }

      const referenceColumnIndex = getReferenceColumnIndex(bodyTable, targetDocument);
      const fleetColumnIndex = getFleetColumnIndex(bodyTable, targetDocument);
      if (referenceColumnIndex < 0 || fleetColumnIndex < 0) {
        return;
      }

      applyReferenceColumnWidth(bodyTable, targetDocument, referenceColumnIndex);

      bodyTable.querySelectorAll('tbody tr').forEach((row) => {
        const cell = row.children[referenceColumnIndex];
        const fleet = getRowCellText(row, fleetColumnIndex);
        if (cell && fleet === 'A320') {
          enhanceReferenceCell(cell, targetDocument);
        } else if (cell) {
          removeManualButton(cell);
        }
      });
    });
  }

  function isEngineeringEvaluationDocument(targetDocument) {
    try {
      if (targetDocument.defaultView.location.href.includes('/em/emfileeva/emfileeva_list.shtml')) {
        return true;
      }
    } catch (error) {
      // Continue with header-based detection.
    }

    return Array.from(targetDocument.querySelectorAll('table.datagrid-btable')).some((bodyTable) => {
      const headers = getHeaderTexts(bodyTable, targetDocument);
      return headers.includes('文件编号') && headers.includes('文件版次') && headers.includes('评估单号');
    });
  }

  function isInitialFileVersion(versionText) {
    const version = cleanText(versionText).toUpperCase();
    return version === 'R00' || version === 'R0';
  }

  function getEasyuiFieldName(element, fallbackId) {
    return element.getAttribute('textboxname') ||
      element.getAttribute('comboname') ||
      element.getAttribute('name') ||
      fallbackId;
  }

  function getFieldValue(targetDocument, fieldId) {
    const element = targetDocument.getElementById(fieldId);
    if (!element) {
      const byName = targetDocument.querySelector(`input.textbox-value[name="${fieldId}"], input[name="${fieldId}"]`);
      return byName ? byName.value : '';
    }

    const fieldName = getEasyuiFieldName(element, fieldId);
    const hiddenValue = targetDocument.querySelector(`input.textbox-value[name="${fieldName}"]`);
    return hiddenValue ? hiddenValue.value : element.value;
  }

  function setFieldValue(targetDocument, fieldId, value) {
    const targetWindow = targetDocument.defaultView || window;
    const element = targetDocument.getElementById(fieldId);
    const fieldName = element ? getEasyuiFieldName(element, fieldId) : fieldId;

    if (element && targetWindow.jQuery) {
      const $ = targetWindow.jQuery;
      try {
        if ($(element).hasClass('combobox-f') && $.fn.combobox) {
          $(element).combobox('setValue', value);
        } else if ($.fn.textbox) {
          $(element).textbox('setValue', value);
        }
      } catch (error) {
        // Fall back to direct input updates below.
      }
    }

    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    targetDocument.querySelectorAll(`input.textbox-value[name="${fieldName}"], input[name="${fieldName}"]`).forEach((input) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    if (element) {
      const visibleInput = element.nextElementSibling && element.nextElementSibling.querySelector('.textbox-text');
      if (visibleInput) {
        visibleInput.value = value;
        visibleInput.dispatchEvent(new Event('input', { bubbles: true }));
        visibleInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  function captureEngineeringSearchState(targetDocument) {
    return EVAL_SEARCH_FIELD_IDS.reduce((state, fieldId) => {
      state[fieldId] = getFieldValue(targetDocument, fieldId);
      return state;
    }, {});
  }

  function restoreEngineeringSearchState(targetDocument, state) {
    EVAL_SEARCH_FIELD_IDS.forEach((fieldId) => {
      setFieldValue(targetDocument, fieldId, state && state[fieldId] ? state[fieldId] : '');
    });
  }

  function clickEngineeringClear(targetDocument) {
    const targetWindow = targetDocument.defaultView || window;
    if (typeof targetWindow.doClear_ === 'function') {
      targetWindow.doClear_();
      return;
    }

    const clearButton = Array.from(targetDocument.querySelectorAll('a, button'))
      .find((node) => cleanText(node.textContent) === '清空条件');
    if (clearButton) {
      clearButton.click();
    }
  }

  function clickEngineeringSearch(targetDocument) {
    const targetWindow = targetDocument.defaultView || window;
    if (typeof targetWindow.onSearchFor === 'function') {
      targetWindow.onSearchFor();
      return;
    }

    const searchButton = Array.from(targetDocument.querySelectorAll('a, button'))
      .find((node) => cleanText(node.textContent) === '查询');
    if (searchButton) {
      searchButton.click();
    }
  }

  function runEngineeringSearch(targetDocument, values, options = {}) {
    const targetWindow = targetDocument.defaultView || window;

    if (options.saveReturnState) {
      targetWindow[EVAL_RETURN_STATE_KEY] = captureEngineeringSearchState(targetDocument);
    }

    clickEngineeringClear(targetDocument);

    targetWindow.setTimeout(() => {
      Object.entries(values).forEach(([fieldId, value]) => {
        setFieldValue(targetDocument, fieldId, value);
      });
      targetWindow.setTimeout(() => clickEngineeringSearch(targetDocument), 80);
    }, 120);
  }

  function buildEngineeringActionButton(targetDocument, text, className) {
    const button = targetDocument.createElement('a');
    button.href = 'javascript:void(0);';
    button.className = `${className} ${EVAL_TOOL_BUTTON_CLASS}`;
    button.textContent = text;
    return button;
  }

  function addPreviousEvaluationButton(cell, targetDocument, fileNo) {
    const contentNode = getCellContentNode(cell);
    if (!contentNode) {
      return;
    }

    const existingButton = contentNode.querySelector(`.${EVAL_PREVIOUS_BUTTON_CLASS}`);
    if (existingButton) {
      existingButton.dataset.fileNo = fileNo;
      existingButton.title = `查询文件编号 ${fileNo} 的前序评估`;
      return;
    }

    const button = buildEngineeringActionButton(targetDocument, '前序评估', EVAL_PREVIOUS_BUTTON_CLASS);
    button.dataset.fileNo = fileNo;
    button.title = `查询文件编号 ${fileNo} 的前序评估`;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      runEngineeringSearch(targetDocument, { fileNo: event.currentTarget.dataset.fileNo || fileNo }, { saveReturnState: true });
    });

    contentNode.appendChild(button);
  }

  function enhanceEngineeringEvaluationRows(targetDocument) {
    targetDocument.querySelectorAll('table.datagrid-btable').forEach((bodyTable) => {
      const headers = getHeaderTexts(bodyTable, targetDocument);
      if (!headers.includes('文件编号') || !headers.includes('文件版次')) {
        return;
      }

      const fileNoColumnIndex = getFileNoColumnIndex(bodyTable, targetDocument);
      const fileVersionColumnIndex = getFileVersionColumnIndex(bodyTable, targetDocument);
      if (fileNoColumnIndex < 0 || fileVersionColumnIndex < 0) {
        return;
      }

      applyFixedColumnWidth(bodyTable, targetDocument, fileVersionColumnIndex, EVAL_FILE_VERSION_WIDTH, 'eval-file-version-width');

      bodyTable.querySelectorAll('tbody tr').forEach((row) => {
        const fileNoCell = row.children[fileNoColumnIndex];
        const fileVersionCell = row.children[fileVersionColumnIndex];
        const fileNo = getRowCellText(row, fileNoColumnIndex);
        const fileVersion = getRowCellText(row, fileVersionColumnIndex);

        if (fileNoCell) {
          removeButtons(fileNoCell, `.${EVAL_PREVIOUS_BUTTON_CLASS}`);
        }

        if (fileVersionCell && fileNo && fileVersion && !isInitialFileVersion(fileVersion)) {
          addPreviousEvaluationButton(fileVersionCell, targetDocument, fileNo);
        } else if (fileVersionCell) {
          removeButtons(fileVersionCell, `.${EVAL_PREVIOUS_BUTTON_CLASS}`);
        }
      });
    });
  }

  function addEngineeringToolbarButtons(targetDocument) {
    const exportButton = Array.from(targetDocument.querySelectorAll('a, button'))
      .find((node) => /导出\s*EXCEL/i.test(cleanText(node.textContent)));
    if (!exportButton || exportButton.dataset.airnavxEvalToolsInstalled === '1') {
      return;
    }

    const returnButton = buildEngineeringActionButton(targetDocument, '返回', 'airnavx-eval-return');
    returnButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const targetWindow = targetDocument.defaultView || window;
      const state = targetWindow[EVAL_RETURN_STATE_KEY];
      if (!state) {
        targetWindow.alert('没有可返回的查询状态');
        return;
      }

      clickEngineeringClear(targetDocument);
      targetWindow.setTimeout(() => {
        restoreEngineeringSearchState(targetDocument, state);
        targetWindow.setTimeout(() => clickEngineeringSearch(targetDocument), 80);
      }, 120);
    });

    const myEvaluationButton = buildEngineeringActionButton(targetDocument, '我的评估', 'airnavx-eval-mine');
    myEvaluationButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      runEngineeringSearch(targetDocument, { evaManName: '马士航' });
    });

    exportButton.insertAdjacentElement('afterend', myEvaluationButton);
    exportButton.insertAdjacentElement('afterend', returnButton);
    exportButton.dataset.airnavxEvalToolsInstalled = '1';
  }

  function enhanceEngineeringEvaluation(targetDocument) {
    if (!isEngineeringEvaluationDocument(targetDocument)) {
      return;
    }

    addEngineeringToolbarButtons(targetDocument);
    enhanceEngineeringEvaluationRows(targetDocument);
  }

  function enhanceTables() {
    getCandidateDocuments().forEach((targetDocument) => {
      installStyle(targetDocument);
      enhanceTablesInDocument(targetDocument);
      enhanceEngineeringEvaluation(targetDocument);
    });
  }

  function installStyle(targetDocument) {
    if (!targetDocument.head || targetDocument.getElementById('airnavx-open-manual-style')) {
      return;
    }

    const style = targetDocument.createElement('style');
    style.id = 'airnavx-open-manual-style';
    style.textContent = `
      .${BUTTON_WRAP_CLASS} {
        display: inline-flex;
        align-items: center;
        margin-right: 6px;
        vertical-align: middle;
      }
      .${BUTTON_CLASS} {
        display: inline-block;
        padding: 1px 7px;
        border: 1px solid #2f80ed;
        border-radius: 3px;
        background: #2f80ed;
        color: #fff !important;
        font-size: 12px;
        line-height: 18px;
        text-decoration: none !important;
        white-space: nowrap;
        cursor: pointer;
      }
      .${BUTTON_CLASS}:hover {
        background: #1f6fd1;
        border-color: #1f6fd1;
      }
      .${EVAL_TOOL_BUTTON_CLASS} {
        display: inline-block;
        margin-left: 6px;
        padding: 0 12px;
        border-radius: 3px;
        background: #2f80ed;
        color: #fff !important;
        font-size: 12px;
        line-height: 26px;
        text-decoration: none !important;
        white-space: nowrap;
        cursor: pointer;
      }
      .${EVAL_TOOL_BUTTON_CLASS}:hover {
        background: #1f6fd1;
      }
      .${EVAL_PREVIOUS_BUTTON_CLASS} {
        margin-left: 6px;
        padding: 0 6px;
        line-height: 18px;
      }
      .airnavx-eval-return {
        background: #4f6f9f;
      }
      .airnavx-eval-return:hover {
        background: #3d5d8c;
      }
    `;
    targetDocument.head.appendChild(style);
  }

  function debounce(fn, delay) {
    let timer = 0;
    return function debounced() {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, delay);
    };
  }

  function start() {
    enhanceTables();

    const scheduleEnhance = debounce(enhanceTables, 250);
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setInterval(enhanceTables, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
