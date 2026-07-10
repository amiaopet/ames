// ==UserScript==
// @name         Juneyao AMES AirNav Toolbox Enhancer
// @namespace    https://juneyaoair.com/
// @version      1.12.0
// @description  AMES 工卡/工程评估增强、AirNavX 自动处理、Boeing Toolbox 自动继续
// @author       Codex
// @match        https://ames.juneyaoair.com/views/*
// @match        https://airnavx.juneyaoair.com/airnavx*
// @match        http://boeingtoolbox.juneyaoair.com:8080/toolboxremote.html*
// @updateURL    https://raw.githubusercontent.com/amiaopet/ames/main/ames-airnavx-open-manual.user.js
// @downloadURL  https://raw.githubusercontent.com/amiaopet/ames/main/ames-airnavx-open-manual.user.js
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_CLASS = 'airnavx-open-manual';
  const BUTTON_WRAP_CLASS = 'airnavx-open-manual-wrap';
  const EVAL_PREVIOUS_BUTTON_CLASS = 'airnavx-eval-previous';
  const EVAL_TOOL_BUTTON_CLASS = 'airnavx-eval-tool-button';
  const EVAL_RETURN_STATE_KEY = '__airnavxEngineeringEvalReturnState';
  const EVAL_CURRENT_USER_NAME_KEY = '__airnavxEngineeringEvalCurrentUserName';
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
  const USER_NAME_SELECTORS = [
    '#userName',
    '#username',
    '.J_userName',
    '.user-name',
    '.username',
    '.user-info',
    '.userInfo',
    '.dropdown-user',
    '.navbar-top-links .dropdown-toggle',
    '.navbar-right .dropdown-toggle',
    '.profile-element .block',
    '.login-user'
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

  function normalizePersonName(value) {
    const text = cleanText(value)
      .replace(/^(当前用户|登录人|用户|姓名|欢迎|您好|你好)[：:，,\s]*/, '')
      .replace(/(退出|注销|修改密码|个人中心).*$/, '')
      .trim();

    if (/^[\u4e00-\u9fa5·]{2,6}$/.test(text) &&
      !['首页', '用户', '个人中心', '工程文件评估'].includes(text)) {
      return text;
    }

    const labeledMatch = cleanText(value).match(/(?:当前用户|登录人|用户|姓名|欢迎|您好|你好)[：:，,\s]*([\u4e00-\u9fa5·]{2,6})/);
    return labeledMatch ? labeledMatch[1] : '';
  }

  function getLoggedInUserName(targetDocument) {
    try {
      const topDocument = targetDocument.defaultView.top.document;
      for (const selector of USER_NAME_SELECTORS) {
        const nodes = Array.from(topDocument.querySelectorAll(selector)).slice(0, 8);
        for (const node of nodes) {
          const name = normalizePersonName(node.textContent);
          if (name) {
            return name;
          }
        }
      }
    } catch (error) {
      // Fall back to the current page's default evaluator field.
    }

    return '';
  }

  function cacheEngineeringCurrentUserName(targetDocument) {
    const targetWindow = targetDocument.defaultView || window;
    if (targetWindow[EVAL_CURRENT_USER_NAME_KEY]) {
      return targetWindow[EVAL_CURRENT_USER_NAME_KEY];
    }

    const loggedInName = getLoggedInUserName(targetDocument);
    const defaultEvaluatorName = normalizePersonName(getFieldValue(targetDocument, 'evaManName'));
    const userName = loggedInName || defaultEvaluatorName;

    if (userName) {
      targetWindow[EVAL_CURRENT_USER_NAME_KEY] = userName;
    }

    return userName;
  }

  function getEngineeringCurrentUserName(targetDocument) {
    return cacheEngineeringCurrentUserName(targetDocument);
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
      const currentUserName = getEngineeringCurrentUserName(targetDocument);
      if (currentUserName) {
        runEngineeringSearch(targetDocument, { evaManName: currentUserName });
        return;
      }

      targetDocument.defaultView.alert('未能识别当前登录人');
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
    cacheEngineeringCurrentUserName(targetDocument);
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

  function waitForElement(selector, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const found = document.querySelector(selector);
      if (found) {
        resolve(found);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      window.setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  }

  function setNativeInputValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function startAmesEnhancements() {
    enhanceTables();

    const scheduleEnhance = debounce(enhanceTables, 250);
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setInterval(enhanceTables, 1500);
  }

  function runWhenDomReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function runBoeingToolboxAutoContinue() {
    const targetHash = '#/ap/64312';
    const password = '84510';
    let hasClickedContinue = false;

    async function run() {
      if (location.hash !== targetHash) {
        return;
      }
      if (hasClickedContinue) {
        return;
      }

      const acceptIcon = await waitForElement('#tb_btn_accpt_lic_agrmnt');
      if (!acceptIcon.className.includes('fa-check-square-o')) {
        acceptIcon.click();
      }

      const passwordInput = await waitForElement('.modal-footer-custom input');
      setNativeInputValue(passwordInput, password);

      const continueButton = await waitForElement('#button1');
      hasClickedContinue = true;
      continueButton.click();
    }

    runWhenDomReady(() => run().catch(console.error));

    window.addEventListener('hashchange', () => {
      hasClickedContinue = false;
      run().catch(console.error);
    });
  }

  function runAirNavEnhancements() {
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const pnTag = '[AirNav PN]';
    const patchedFlag = Symbol('airnavPnPatched');
    const accessCode = '73409';
    const accessCodeSelector = 'input.access-code[name="access-code"], input[name="access-code"]';
    let hasSubmittedAccessCode = false;

    function formatPN(value) {
      if (typeof value !== 'string') {
        return value;
      }
      if (/^\d{6}-\d{2}$/.test(value)) {
        return value;
      }
      return value.replace(/^(\d{2})(\d{2})(\d{2})(-.*)$/, '$1-$2-$3$4');
    }

    function formatSearchParams(params) {
      if (!params || !params.has('q')) {
        return false;
      }

      const oldValue = params.get('q');
      const newValue = formatPN(oldValue);
      if (newValue === oldValue) {
        return false;
      }

      params.set('q', newValue);
      return true;
    }

    function formatUrl(value) {
      if (typeof value !== 'string') {
        return value;
      }

      try {
        const url = new URL(value, win.location.href);
        if (!/\/airnavx\//.test(url.pathname)) {
          return value;
        }
        if (!formatSearchParams(url.searchParams)) {
          return value;
        }
        return url.href;
      } catch (error) {
        return value.replace(/([?&]q=)([^&#]*)/, (_, prefix, q) => {
          const decoded = decodeURIComponent(q.replace(/\+/g, ' '));
          const formatted = formatPN(decoded);
          return formatted === decoded ? prefix + q : prefix + encodeURIComponent(formatted);
        });
      }
    }

    const initialUrl = formatUrl(win.location.href);
    if (initialUrl !== win.location.href) {
      win.location.replace(initialUrl);
      return;
    }

    function normalizeInput(input) {
      if (!input || typeof input.value !== 'string') {
        return false;
      }

      const oldValue = input.value;
      const newValue = formatPN(oldValue);
      if (newValue === oldValue) {
        return false;
      }

      setNativeInputValue(input, newValue);
      console.log(pnTag, 'input:', oldValue, '=>', newValue);
      return true;
    }

    function findSearchInputs(root) {
      const doc = root && root.querySelectorAll ? root : document;
      return Array.from(doc.querySelectorAll([
        'input.searchBarFullWidth',
        'input[ng-model="SearchBarCtrl.searchText"]',
        'input[placeholder*="Search on your content"]',
        'input[placeholder*="Search by Part Number"]',
        'textarea'
      ].join(',')));
    }

    function normalizeActiveOrSearchInputs() {
      const active = document.activeElement;
      if (active && /^(INPUT|TEXTAREA)$/.test(active.tagName) && normalizeInput(active)) {
        return true;
      }
      return findSearchInputs(document).some(normalizeInput);
    }

    function patchDomEvents() {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.keyCode === 13) {
          normalizeActiveOrSearchInputs();
        }
      }, true);

      document.addEventListener('click', (event) => {
        const target = event.target;
        const button = target && target.closest && target.closest(
          'button.search-button, button[aria-label="Search"], .search-button button, md-button[aria-label="Search"]'
        );
        if (button) {
          normalizeActiveOrSearchInputs();
        }
      }, true);

      document.addEventListener('blur', (event) => {
        if (event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) {
          normalizeInput(event.target);
        }
      }, true);

      document.addEventListener('paste', (event) => {
        const target = event.target;
        if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) {
          window.setTimeout(() => normalizeInput(target), 0);
        }
      }, true);
    }

    function patchHistory() {
      ['pushState', 'replaceState'].forEach((name) => {
        const original = win.history && win.history[name];
        if (!original || original[patchedFlag]) {
          return;
        }

        win.history[name] = function patchedHistory(state, title, url) {
          if (typeof url === 'string') {
            url = formatUrl(url);
          }
          return original.call(this, state, title, url);
        };
        win.history[name][patchedFlag] = true;
      });
    }

    function patchNetwork() {
      if (win.fetch && !win.fetch[patchedFlag]) {
        const originalFetch = win.fetch;
        win.fetch = function patchedFetch(resource, init) {
          if (typeof resource === 'string') {
            resource = formatUrl(resource);
          } else if (resource && typeof resource.url === 'string') {
            const nextUrl = formatUrl(resource.url);
            if (nextUrl !== resource.url) {
              resource = new Request(nextUrl, resource);
            }
          }
          return originalFetch.call(this, resource, init);
        };
        win.fetch[patchedFlag] = true;
      }

      if (win.XMLHttpRequest && win.XMLHttpRequest.prototype.open && !win.XMLHttpRequest.prototype.open[patchedFlag]) {
        const originalOpen = win.XMLHttpRequest.prototype.open;
        win.XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
          if (typeof url === 'string') {
            arguments[1] = formatUrl(url);
          }
          return originalOpen.apply(this, arguments);
        };
        win.XMLHttpRequest.prototype.open[patchedFlag] = true;
      }
    }

    function patchFunction(object, key, wrapper) {
      if (!object || typeof object[key] !== 'function' || object[key][patchedFlag]) {
        return false;
      }

      const original = object[key];
      object[key] = wrapper(original);
      object[key][patchedFlag] = true;
      return true;
    }

    function patchAngular(injector) {
      try {
        const searchService = injector.get('SearchService');
        patchFunction(searchService, 'doSearch', (original) => {
          return function patchedDoSearch(page, mode, text, ...rest) {
            return original.call(this, page, mode, formatPN(text), ...rest);
          };
        });

        const searchModel = injector.get('SearchModel');
        if (searchModel && searchModel.searchText) {
          patchFunction(searchModel.searchText, 'set', (original) => {
            return function patchedSearchTextSet(value) {
              return original.call(this, formatPN(value));
            };
          });
        }

        const rootScope = injector.get('$rootScope');
        patchFunction(rootScope, '$broadcast', (original) => {
          return function patchedBroadcast(name, payload, ...rest) {
            if ((name === 'search-action' || name === 'clear-search-action') && Array.isArray(payload)) {
              payload = payload.map((item) => {
                return item && item.code === 'q'
                  ? Object.assign({}, item, { value: formatPN(item.value) })
                  : item;
              });
            }
            return original.call(this, name, payload, ...rest);
          };
        });

        return true;
      } catch (error) {
        return false;
      }
    }

    function getInjector() {
      const angular = win.angular;
      if (!angular || !angular.element) {
        return null;
      }

      const candidates = [
        document.body,
        document.documentElement,
        document.querySelector('[ng-app]'),
        document.querySelector('[data-ng-app]'),
        document.querySelector('.ng-scope')
      ].filter(Boolean);

      for (const element of candidates) {
        try {
          const injector = angular.element(element).injector && angular.element(element).injector();
          if (injector) {
            return injector;
          }
        } catch (error) {
          // Keep polling until Angular finishes booting.
        }
      }
      return null;
    }

    function waitForAngular() {
      const injector = getInjector();
      if (injector && patchAngular(injector)) {
        return;
      }
      window.setTimeout(waitForAngular, 100);
    }

    function hasAccessCodeError() {
      return new URL(window.location.href).searchParams.has('ace');
    }

    function submitAccessCodeForm(form) {
      hasSubmittedAccessCode = true;
      try {
        sessionStorage.clear();
        sessionStorage.setItem('airnav-access-code-autofill-submitted', '1');
      } catch (error) {
        // Ignore storage failures; the in-memory guard still prevents repeats on this page.
      }

      HTMLFormElement.prototype.submit.call(form);
    }

    function fillAccessCode() {
      const input = document.querySelector(accessCodeSelector);
      if (!input || input.type === 'hidden') {
        return false;
      }

      const form = input.form || document.querySelector('form[action*="set-access-code"]');
      if (!form) {
        return false;
      }

      if (input.value !== accessCode) {
        setNativeInputValue(input, accessCode);
      }

      if (!hasSubmittedAccessCode && !hasAccessCodeError()) {
        window.setTimeout(() => {
          if (!hasSubmittedAccessCode && document.contains(input)) {
            submitAccessCodeForm(form);
          }
        }, 300);
      }

      return true;
    }

    function startAccessCodeAutoFill() {
      if (fillAccessCode()) {
        return;
      }

      const observer = new MutationObserver(() => {
        if (fillAccessCode()) {
          observer.disconnect();
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.setTimeout(() => observer.disconnect(), 15000);
    }

    patchDomEvents();
    patchHistory();
    patchNetwork();
    waitForAngular();
    runWhenDomReady(startAccessCodeAutoFill);
  }

  if (location.hostname === 'ames.juneyaoair.com') {
    runWhenDomReady(startAmesEnhancements);
  } else if (location.hostname === 'boeingtoolbox.juneyaoair.com') {
    runBoeingToolboxAutoContinue();
  } else if (location.hostname === 'airnavx.juneyaoair.com') {
    runAirNavEnhancements();
  }
})();
