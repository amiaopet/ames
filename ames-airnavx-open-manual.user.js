// ==UserScript==
// @name         Juneyao AMES AirNav Toolbox Enhancer
// @namespace    https://juneyaoair.com/
// @version      1.16.19
// @description  AMES 工卡/工程评估/MEL备注/报文解析增强、AirNavX 手册翻译、Boeing Toolbox 自动继续与本机翻译
// @author       Codex
// @match        https://ames.juneyaoair.com/views/*
// @match        https://ames.juneyaoair.com/mnt/ftp/tdms/manual/*
// @match        http://172.29.92.15:8080/*
// @match        https://airnavx.juneyaoair.com/airnavx*
// @match        http://airnav.juneyaoair.com:8000/*
// @match        http://boeingtoolbox.juneyaoair.com:8080/toolboxremote.html*
// @match        https://boeingtoolbox.juneyaoair.com/*
// @updateURL    https://raw.githubusercontent.com/amiaopet/ames/main/ames-airnavx-open-manual.user.js
// @downloadURL  https://raw.githubusercontent.com/amiaopet/ames/main/ames-airnavx-open-manual.user.js
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_registerMenuCommand
// @connect      ames.juneyaoair.com
// @connect      172.29.92.15
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
  const RAW_MESSAGE_HEADER = '报文内容';
  const RAW_MESSAGE_AIRCRAFT_MODEL_HEADER = '机型';
  const RAW_MESSAGE_TYPE_HEADER = '类型';
  const RAW_MESSAGE_BUTTON_CLASS = 'xiaoma-raw-message-parse';
  const RAW_MESSAGE_BUTTON_WRAP_CLASS = 'xiaoma-raw-message-parse-wrap';
  const RAW_MESSAGE_IMPORT_PREFIX = 'xiaoma-raw-message-import:';
  const RAW_MESSAGE_PARSER_URL = 'http://172.29.92.15:8080/raw-message-parser';
  const RAW_MESSAGE_DETAIL_PATH = '/views/mc/technicalHandover/mc_fault_detail.shtml';
  const RAW_MESSAGE_VIEW_DETAIL_PATH = '/views/mc/technicalHandover/mc_acars_view_detail.shtml';
  const RAW_MESSAGE_DETAIL_FIELD_ID = 'rawMsg';
  const RAW_MESSAGE_DETAIL_LABEL = '原始报文';
  const RAW_MESSAGE_GRID_ID = 'acarsDg';
  const RAW_MESSAGE_SEARCH_FORM_ID = 'ffSearch6';
  const RAW_MESSAGE_START_DATE_ID = 'startSynDate';
  const RAW_MESSAGE_END_DATE_ID = 'endSynDate';
  const RAW_MESSAGE_LIST_FUNCTION_CODE = 'MC_ACARS_ALL_LIST';
  const RAW_MESSAGE_DATE_RANGE_KEY = '__xiaomaRawMessageDefaultDateRange';
  const RAW_MESSAGE_GRID_PATCH_KEY = '__xiaomaRawMessageInitialQueryGuard';
  const AMES_BASE = 'https://ames.juneyaoair.com';
  const SEARCH_BASE = 'https://airnavx.juneyaoair.com/airnavx/search/text?q=';
  const TOOLBOX_BASE = 'http://172.29.92.15:8080';
  const TOOLBOX_HOST = '172.29.92.15:8080';
  const MEL_REMARKS_API_BASE = `${TOOLBOX_BASE}/api/mel-remarks`;
  const MEL_REMARK_BOX_ID = 'xiaoma-mel-remark-box';
  const REFERENCE_HEADERS = ['参考资料', '参考手册'];
  const CMP_HEADER = 'CMP号';
  const CMP_REFERENCE_HEADER = '参考资料';
  const CMP_REFERENCE_COLUMN_WIDTH = 92;
  const AIRCRAFT_FSN_MIN_WIDTH = 44;
  const AIRCRAFT_FSN_MAX_WIDTH = 160;
  const AIRCRAFT_FSN_CELL_CLASS = 'airnavx-aircraft-fsn-cell';
  const AIRCRAFT_FSN_POPOVER_ID = 'airnavx-aircraft-fsn-summary-popover';
  const JOBCARD_NO_HEADER = '工卡号';
  const JOBCARD_VERSION_HEADER = '工卡版本';
  const SMJC_LIST_PATH = '/api/v1/plugins/TD_JC_SMJC_LIST';
  const SMJC_REFERENCE_HEADER = '参考资料';
  const SMJC_REFERENCE_COLUMN_WIDTH = 190;
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
  const TOOLBOX_ITEMS = [
    { text: '知识检索', path: '/knowledge-base', tone: 'knowledge' },
    { text: '件序号装机监控', path: '/part-serial-monitor', tone: 'monitor' },
    { text: '飞机主数据', path: '/aircraft-master-data', tone: 'data' },
    { text: '编卡相关', path: '/jobcard-forward', withAmesCookie: true, cookieTool: 'jobcard-tools', tone: 'jobcard' },
    { text: '工卡完工查询', path: '/jobcard-completion', tone: 'jobcard' },
    { text: '修理报告下载', path: '/repair-report-download', tone: 'report' },
    { text: '320MOD查询', path: '/a320-mod-search', tone: 'query' },
    { text: '原始报文解析', path: '/raw-message-parser', tone: 'report' },
    { text: 'MEL备注', path: '/mel-remarks', tone: 'report' },
    { text: 'TR下载', path: '/tr-download', tone: 'download' }
  ];
  const TOOLBOX_BRIDGE_ALLOWED_PATHS = new Set([
    '/api/v1/system/data/menu',
    '/api/v1/plugins/EM_MANUAL_LIST_TREE',
    '/api/v1/plugins/TD_MANUAL_TREE_LIST',
    '/api/v1/plugins/TD_JC_SMJC_LIST',
    '/api/v1/plugins/TD_JC_NRCJC_LIST',
    '/api/v1/plugins/FLOW_WORK_ACCOUNT',
    '/api/v1/plugins/TD_JC_ALL_ADD',
    '/api/v1/plugins/TD_JC_ALL_ADD_NRC'
  ]);
  const TOOLBOX_BRIDGE_ALLOWED_ORIGINS = new Set([AMES_BASE]);

  function encodeFormBody(data) {
    const params = new URLSearchParams();
    Object.entries(data || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      params.append(key, String(value));
    });
    return params.toString();
  }

  function defaultBridgeHeaders(origin, referer) {
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: origin,
      'X-Requested-With': 'XMLHttpRequest'
    };
    if (referer) {
      headers.Referer = referer;
    }
    return headers;
  }

  function installToolboxAmesBridge() {
    if (location.host !== TOOLBOX_HOST) {
      return false;
    }

    const bridgeWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const request = (options) => new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('Tampermonkey 跨域请求能力不可用，请更新脚本授权'));
        return;
      }

      const url = new URL((options && options.url) || '', AMES_BASE);
      if (!TOOLBOX_BRIDGE_ALLOWED_ORIGINS.has(url.origin) || !TOOLBOX_BRIDGE_ALLOWED_PATHS.has(url.pathname)) {
        reject(new Error('不允许的 AMES 请求'));
        return;
      }

      const method = String((options && options.method) || 'POST').toUpperCase();
      GM_xmlhttpRequest({
        method,
        url: url.href,
        data: method === 'GET' ? undefined : encodeFormBody(options && options.data),
        headers: {
          ...defaultBridgeHeaders(url.origin, options && options.referer),
          ...((options && options.headers) || {})
        },
        withCredentials: true,
        anonymous: false,
        timeout: Math.max(5000, Number(options && options.timeout) || 30000),
        onload(response) {
          const text = response.responseText || '';
          let data = text;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (error) {
            // Keep text payloads for AMES endpoints that do not return JSON.
          }
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText || '',
            data,
            text
          });
        },
        onerror() {
          reject(new Error('AMES 请求失败'));
        },
        ontimeout() {
          reject(new Error('AMES 请求超时'));
        }
      });
    });

    Object.defineProperty(bridgeWindow, 'AmesToolboxBridge', {
      value: {
        version: '1.15.2',
        request
      },
      configurable: true
    });
    window.dispatchEvent(new CustomEvent('ames-toolbox-bridge-ready'));
    return true;
  }

  function currentMelPageContext() {
    if (location.hostname !== 'ames.juneyaoair.com') {
      return null;
    }
    const pathname = decodeURIComponent(location.pathname || '');
    if (/\/A320\/MEL_ZH\//i.test(pathname) && /\/DATA\/HTML\/[^/]+\/[^/]+\.html?$/i.test(pathname)) {
      const filename = pathname.split('/').pop() || '';
      const duNumber = filename.replace(/\.html?$/i, '').trim().toUpperCase();
      if (/^[A-Z0-9_-]{1,32}(?:\.[A-Z0-9_-]{1,32})+$/.test(duNumber)) {
        return { aircraftModel: 'A320', matchValue: duNumber, queryName: 'du_number' };
      }
    }
    if (/\/B787\/MEL_ZH\//i.test(pathname) && /\.xml$/i.test(pathname)) {
      const matches = pathname.match(/\d{2}-\d{2}-\d{2}/g);
      if (matches?.length) {
        return { aircraftModel: 'B787', matchValue: matches[matches.length - 1], queryName: 'mel_item' };
      }
    }
    return null;
  }

  function isMelManualPage() {
    return Boolean(currentMelPageContext());
  }

  function toolboxRequest(options) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('Tampermonkey 跨域请求能力不可用'));
        return;
      }
      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url: options.url,
        headers: options.headers || {},
        responseType: options.responseType,
        timeout: options.timeout || 15000,
        onload: resolve,
        onerror: () => reject(new Error('小工具服务请求失败')),
        ontimeout: () => reject(new Error('小工具服务请求超时'))
      });
    });
  }

  async function downloadMelFile(file, button, labelPrefix) {
    if (button) {
      button.disabled = true;
      button.textContent = '正在下载…';
    }
    try {
      const url = new URL(file.download_url, TOOLBOX_BASE).href;
      const response = await toolboxRequest({ method: 'GET', url, responseType: 'blob', timeout: 60000 });
      if (response.status < 200 || response.status >= 300 || !response.response) {
        throw new Error(`文件下载失败（HTTP ${response.status || 0}）`);
      }
      const objectUrl = URL.createObjectURL(response.response);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.filename || 'MEL相关文件';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      window.alert(error.message || '文件下载失败');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = `${labelPrefix}：${file.filename || '点击下载'}`;
      }
    }
  }

  function createMelDownloadButton(file, labelPrefix, dataAttribute) {
    const download = document.createElement('button');
    download.type = 'button';
    download.dataset[dataAttribute] = '1';
    download.textContent = `${labelPrefix}：${file.filename}`;
    download.title = `点击下载${labelPrefix}`;
    download.style.cssText = [
      'display:inline-block',
      'margin:10px 8px 0 0',
      'padding:7px 12px',
      'border:1px solid #b91c1c',
      'border-radius:4px',
      'background:#fff',
      'color:#b91c1c',
      'font:inherit',
      'font-weight:600',
      'cursor:pointer'
    ].join(';');
    download.addEventListener('click', () => downloadMelFile(file, download, labelPrefix));
    return download;
  }

  function renderMelRemark(data) {
    if (!data || !data.matched || !data.remark || document.getElementById(MEL_REMARK_BOX_ID)) {
      return false;
    }

    const box = document.createElement('section');
    box.id = MEL_REMARK_BOX_ID;
    box.setAttribute('role', 'note');
    box.style.cssText = [
      'box-sizing:border-box',
      'width:calc(100% - 24px)',
      'margin:24px 12px 16px',
      'padding:16px 18px',
      'border:3px solid #d93025',
      'border-radius:6px',
      'background:#fff5f5',
      'color:#7f1d1d',
      'font-family:Arial,"Microsoft YaHei",sans-serif',
      'font-size:15px',
      'line-height:1.65',
      'box-shadow:0 2px 8px rgba(217,48,37,.16)'
    ].join(';');

    const title = document.createElement('div');
    const aircraftModel = data.aircraft_model || data.remark.aircraft_model || 'A320';
    title.textContent = `针对${aircraftModel}关键系统保留MEL项目运行限制要求的提示`;
    title.style.cssText = 'font-size:18px;font-weight:700;color:#b91c1c;margin-bottom:8px;';
    box.appendChild(title);

    const identity = document.createElement('div');
    identity.textContent = [
      data.remark.mel_item ? `MEL ${data.remark.mel_item}` : '',
      data.remark.item_name || '',
      data.remark.item_title || '',
      aircraftModel === 'A320'
        ? `DU ${data.du_number || data.match_value || ''}`
        : `MEL项目号 ${data.mel_item || data.match_value || ''}`
    ].filter(Boolean).join('　|　');
    identity.style.cssText = 'font-weight:600;margin-bottom:8px;';
    box.appendChild(identity);

    const restriction = document.createElement('div');
    restriction.textContent = data.remark.restriction;
    restriction.style.cssText = 'white-space:pre-wrap;color:#7f1d1d;';
    box.appendChild(restriction);

    if (data.mt && data.mt.filename) {
      box.appendChild(createMelDownloadButton(data.mt, `${aircraftModel}通用MT`, 'melMtDownload'));
    } else {
      const missingMt = document.createElement('div');
      missingMt.textContent = `${aircraftModel}当前未上传通用MT文件`;
      missingMt.style.cssText = 'margin-top:10px;font-size:13px;color:#991b1b;';
      box.appendChild(missingMt);
    }

    const relatedFiles = Array.isArray(data.remark.related_files) ? data.remark.related_files : [];
    if (relatedFiles.length) {
      const relatedHeading = document.createElement('div');
      relatedHeading.textContent = '本条目相关文件：';
      relatedHeading.style.cssText = 'margin-top:12px;font-weight:600;';
      box.appendChild(relatedHeading);
      relatedFiles.forEach(file => {
        if (file && file.filename && file.download_url) {
          box.appendChild(createMelDownloadButton(file, '相关文件', 'melRelatedDownload'));
        }
      });
    }

    (document.getElementById('contentContainer') || document.body || document.documentElement).appendChild(box);
    return true;
  }

  async function startMelRemarkInjection() {
    const context = currentMelPageContext();
    if (!context) {
      return;
    }
    try {
      const url = new URL(`${MEL_REMARKS_API_BASE}/lookup`);
      url.searchParams.set('aircraft_model', context.aircraftModel);
      url.searchParams.set(context.queryName, context.matchValue);
      url.searchParams.set('_', String(Date.now()));
      const response = await toolboxRequest({
        method: 'GET',
        url: url.href,
        headers: { Accept: 'application/json' }
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`MEL备注查询失败（HTTP ${response.status || 0}）`);
      }
      const data = JSON.parse(response.responseText || 'null');
      renderMelRemark(data);
    } catch (error) {
      console.warn('[MEL备注]', error.message || error);
    }
  }

  const isRawMessageImportPage = location.host === TOOLBOX_HOST &&
    location.pathname === '/raw-message-parser' &&
    new URL(window.location.href).searchParams.has('rawMessageImport');

  if (installToolboxAmesBridge() && !isRawMessageImportPage) {
    return;
  }

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

  function getRawMessageCellText(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll(`.${RAW_MESSAGE_BUTTON_WRAP_CLASS}, .${RAW_MESSAGE_BUTTON_CLASS}`).forEach((node) => node.remove());
    clone.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    clone.querySelectorAll('div, p, li, tr').forEach((node) => node.appendChild(clone.ownerDocument.createTextNode('\n')));
    return String(clone.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function createRawMessageImportId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function getRawMessageImportStorageKey(importId) {
    return `${RAW_MESSAGE_IMPORT_PREFIX}${importId}`;
  }

  function openRawMessageParser(rawMessage, targetDocument) {
    const raw = String(rawMessage || '').trim();
    if (!raw) {
      const targetWindow = targetDocument.defaultView || window;
      targetWindow.alert('当前没有可解析的原始报文');
      return false;
    }

    const importId = createRawMessageImportId();
    GM_setValue(getRawMessageImportStorageKey(importId), {
      id: importId,
      raw,
      createdAt: Date.now()
    });

    const parserUrl = new URL(RAW_MESSAGE_PARSER_URL);
    parserUrl.searchParams.set('rawMessageImport', importId);
    const targetWindow = targetDocument.defaultView || window;
    targetWindow.open(parserUrl.toString(), '_blank', 'noopener,noreferrer');
    return true;
  }

  function buildRawMessageParseButton(rawMessage, targetDocument, getCurrentRawMessage) {
    const wrapper = targetDocument.createElement('span');
    wrapper.className = RAW_MESSAGE_BUTTON_WRAP_CLASS;

    const button = targetDocument.createElement('button');
    button.type = 'button';
    button.className = RAW_MESSAGE_BUTTON_CLASS;
    button.textContent = '报文解析';
    button.title = '带入小马原始报文解析并自动解析';
    button.__xiaomaRawMessage = rawMessage;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const messageToParse = typeof getCurrentRawMessage === 'function'
        ? getCurrentRawMessage()
        : rawMessage;
      openRawMessageParser(messageToParse, targetDocument);
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  function enhanceRawMessageGrid(bodyTable, targetDocument) {
    const rawMessageColumnIndex = getColumnIndexByHeader(bodyTable, targetDocument, RAW_MESSAGE_HEADER);
    const aircraftModelColumnIndex = getColumnIndexByHeader(
      bodyTable,
      targetDocument,
      RAW_MESSAGE_AIRCRAFT_MODEL_HEADER
    );
    const messageTypeColumnIndex = getColumnIndexByHeader(
      bodyTable,
      targetDocument,
      RAW_MESSAGE_TYPE_HEADER
    );
    if (rawMessageColumnIndex < 0 || aircraftModelColumnIndex < 0 || messageTypeColumnIndex < 0) {
      return;
    }

    bodyTable.querySelectorAll('tbody tr').forEach((row) => {
      const contentNode = getCellContentNode(row.children[rawMessageColumnIndex]);
      if (!contentNode) {
        return;
      }

      const aircraftModel = getRowCellText(row, aircraftModelColumnIndex)
        .toUpperCase()
        .replace(/[\s-]+/g, '');
      const messageType = getRowCellText(row, messageTypeColumnIndex).toUpperCase().trim();
      const isA320 = aircraftModel === 'A320';
      const isB787Dfd = aircraftModel.startsWith('B787') && messageType === 'DFD';
      if (!isA320 && !isB787Dfd) {
        contentNode.querySelectorAll(`.${RAW_MESSAGE_BUTTON_WRAP_CLASS}`).forEach((node) => node.remove());
        return;
      }

      const rawMessage = getRawMessageCellText(contentNode);
      const existingButton = contentNode.querySelector(`.${RAW_MESSAGE_BUTTON_CLASS}`);
      if (!rawMessage) {
        contentNode.querySelectorAll(`.${RAW_MESSAGE_BUTTON_WRAP_CLASS}`).forEach((node) => node.remove());
        return;
      }
      if (existingButton && existingButton.__xiaomaRawMessage === rawMessage) {
        return;
      }

      contentNode.querySelectorAll(`.${RAW_MESSAGE_BUTTON_WRAP_CLASS}`).forEach((node) => node.remove());
      contentNode.insertBefore(buildRawMessageParseButton(rawMessage, targetDocument), contentNode.firstChild);
    });
  }

  function isRawMessageDetailDocument(targetDocument) {
    try {
      return targetDocument.defaultView &&
        targetDocument.defaultView.location.pathname === RAW_MESSAGE_DETAIL_PATH;
    } catch (error) {
      return false;
    }
  }

  function getRawMessageDetailText(targetDocument) {
    const field = targetDocument.getElementById(RAW_MESSAGE_DETAIL_FIELD_ID);
    if (!field) {
      return '';
    }

    const targetWindow = targetDocument.defaultView || window;
    const $ = targetWindow.jQuery || targetWindow.$;
    if ($ && $.fn && typeof $.fn.textbox === 'function') {
      try {
        const value = $(field).textbox('getValue');
        if (value) {
          return String(value).trim();
        }
      } catch (error) {
        // Fall back to the native textarea value.
      }
    }
    return String(field.value || '').trim();
  }

  function enhanceRawMessageDetail(targetDocument) {
    if (!isRawMessageDetailDocument(targetDocument)) {
      return;
    }

    const field = targetDocument.getElementById(RAW_MESSAGE_DETAIL_FIELD_ID);
    const container = field && field.parentElement;
    if (!field || !container) {
      return;
    }

    const label = Array.from(container.querySelectorAll('span')).find((node) => (
      cleanText(node.textContent) === RAW_MESSAGE_DETAIL_LABEL
    ));
    if (!label) {
      return;
    }

    const rawMessage = getRawMessageDetailText(targetDocument);
    const existingButton = container.querySelector(
      `.${RAW_MESSAGE_BUTTON_CLASS}[data-xiaoma-raw-message-detail="1"]`
    );
    if (existingButton && existingButton.__xiaomaRawMessage === rawMessage) {
      return;
    }

    container.querySelectorAll('[data-xiaoma-raw-message-detail-wrap="1"]').forEach((node) => node.remove());
    const wrapper = buildRawMessageParseButton(
      rawMessage,
      targetDocument,
      () => getRawMessageDetailText(targetDocument)
    );
    wrapper.dataset.xiaomaRawMessageDetailWrap = '1';
    wrapper.classList.add('xiaoma-raw-message-detail-parse-wrap');
    const button = wrapper.querySelector(`.${RAW_MESSAGE_BUTTON_CLASS}`);
    if (button) {
      button.dataset.xiaomaRawMessageDetail = '1';
      button.disabled = !rawMessage;
      if (!rawMessage) {
        button.title = '等待原始报文加载后即可解析';
      }
    }
    label.insertAdjacentElement('afterend', wrapper);
  }

  function isRawMessageViewDetailDocument(targetDocument) {
    try {
      return targetDocument.defaultView &&
        targetDocument.defaultView.location.pathname === RAW_MESSAGE_VIEW_DETAIL_PATH;
    } catch (error) {
      return false;
    }
  }

  function enhanceRawMessageViewDetail(targetDocument) {
    if (!isRawMessageViewDetailDocument(targetDocument)) {
      return;
    }

    const field = targetDocument.getElementById(RAW_MESSAGE_DETAIL_FIELD_ID);
    const container = field && field.parentElement;
    if (!field || !container) {
      return;
    }

    const rawMessage = getRawMessageDetailText(targetDocument);
    const existingButton = container.querySelector(
      `.${RAW_MESSAGE_BUTTON_CLASS}[data-xiaoma-raw-message-view-detail="1"]`
    );
    if (existingButton && existingButton.__xiaomaRawMessage === rawMessage) {
      return;
    }

    container.querySelectorAll('[data-xiaoma-raw-message-view-detail-wrap="1"]').forEach((node) => node.remove());
    const wrapper = buildRawMessageParseButton(
      rawMessage,
      targetDocument,
      () => getRawMessageDetailText(targetDocument)
    );
    wrapper.dataset.xiaomaRawMessageViewDetailWrap = '1';
    wrapper.classList.add('xiaoma-raw-message-view-detail-parse-wrap');
    const button = wrapper.querySelector(`.${RAW_MESSAGE_BUTTON_CLASS}`);
    if (button) {
      button.dataset.xiaomaRawMessageViewDetail = '1';
      button.disabled = !rawMessage;
      if (!rawMessage) {
        button.title = '等待原始报文加载后即可解析';
      }
    }
    container.insertBefore(wrapper, container.firstChild);
  }

  function runRawMessageParserImportRelay() {
    const importId = new URL(window.location.href).searchParams.get('rawMessageImport');
    if (!importId) {
      return;
    }

    const storageKey = getRawMessageImportStorageKey(importId);
    const pendingImport = GM_getValue(storageKey, null);
    if (!pendingImport || pendingImport.id !== importId || typeof pendingImport.raw !== 'string') {
      return;
    }

    let intervalId = null;
    let fallbackTimeoutId = null;
    let timeoutId = null;
    const stopRelay = (removeStoredImport) => {
      if (intervalId !== null) window.clearInterval(intervalId);
      if (fallbackTimeoutId !== null) window.clearTimeout(fallbackTimeoutId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      window.removeEventListener('message', handleAccepted);
      if (removeStoredImport) GM_deleteValue(storageKey);
    };
    const handleAccepted = (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== 'xiaoma-raw-message-import-accepted' || event.data.importId !== importId) return;
      stopRelay(true);
    };
    const sendImport = () => {
      window.postMessage({
        type: 'xiaoma-raw-message-import',
        importId,
        raw: pendingImport.raw
      }, window.location.origin);
    };
    const importAndParse = () => {
      const input = document.querySelector('.raw-input textarea, textarea[placeholder*="原始报文"]');
      const parseButton = Array.from(document.querySelectorAll('button')).find((button) => (
        cleanText(button.textContent) === '自动识别并解析'
      ));
      if (!input || !parseButton || parseButton.disabled) {
        return false;
      }

      setNativeInputValue(input, pendingImport.raw);
      input.focus();

      const cleanedUrl = new URL(window.location.href);
      cleanedUrl.searchParams.delete('rawMessageImport');
      window.history.replaceState(
        window.history.state,
        '',
        `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`
      );

      parseButton.click();
      stopRelay(true);
      return true;
    };

    window.addEventListener('message', handleAccepted);
    runWhenDomReady(() => {
      sendImport();
      fallbackTimeoutId = window.setTimeout(() => {
        if (importAndParse()) return;
        intervalId = window.setInterval(() => {
          if (!importAndParse()) sendImport();
        }, 300);
      }, 500);
      timeoutId = window.setTimeout(() => stopRelay(false), 15000);
    });
  }

  function encodeBase64Url(value) {
    try {
      return btoa(unescape(encodeURIComponent(value)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    } catch (error) {
      return '';
    }
  }

  function extractAmesLoginInfo(payload) {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const result = extractAmesLoginInfo(item);
        if (result.accountId || result.userName) {
          return result;
        }
      }
      return {};
    }

    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const loginUser = payload.loginUser || payload.LOGIN_USER || payload.user || payload.USER;
    if (loginUser && typeof loginUser === 'object') {
      const accountId = loginUser.accountId || loginUser.ACCOUNT_ID || loginUser.account_id || '';
      const userName = loginUser.userName || loginUser.USER_NAME || loginUser.user_name || '';
      if (accountId || userName) {
        return { accountId: String(accountId || ''), userName: String(userName || '') };
      }
    }

    const accountId = payload.accountId || payload.ACCOUNT_ID || payload.account_id || '';
    const userName = payload.userName || payload.USER_NAME || payload.user_name || '';
    if (accountId || userName) {
      return { accountId: String(accountId || ''), userName: String(userName || '') };
    }

    if (payload.data) {
      const result = extractAmesLoginInfo(payload.data);
      if (result.accountId || result.userName) {
        return result;
      }
    }

    return {};
  }

  async function fetchAmesLoginInfo() {
    try {
      const response = await fetch('/api/v1/system/data/menu', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) {
        return {};
      }
      return extractAmesLoginInfo(await response.json());
    } catch (error) {
      return {};
    }
  }

  function buildToolboxUrl(item, targetDocument, amesLoginInfo) {
    const url = new URL(item.path, TOOLBOX_BASE);

    if (item.withAmesCookie) {
      const cookie = targetDocument.cookie || document.cookie || '';
      const encodedCookie = encodeBase64Url(cookie);
      if (encodedCookie) {
        const params = new URLSearchParams({
          amesTool: item.cookieTool,
          amesCookie: encodedCookie,
          amesCookieEncoding: 'base64url',
          amesCookieAt: String(Date.now())
        });

        if (amesLoginInfo && amesLoginInfo.accountId) {
          params.set('amesAccountId', amesLoginInfo.accountId);
        }
        if (amesLoginInfo && amesLoginInfo.userName) {
          params.set('amesUserName', amesLoginInfo.userName);
        }

        url.hash = params.toString();
      }
    }

    return url.href;
  }

  function isTopDocument(targetDocument) {
    try {
      return targetDocument.defaultView && targetDocument.defaultView.top === targetDocument.defaultView;
    } catch (error) {
      return false;
    }
  }

  function findAmesManualAnchor(targetDocument) {
    const candidates = Array.from(targetDocument.querySelectorAll([
      'a',
      'button',
      'li',
      'span',
      'div',
      '.navbar-right > *',
      '.nav.navbar-top-links > *'
    ].join(',')));

    return candidates.find((node) => cleanText(node.textContent) === '用户手册' && isVisibleElement(node)) || null;
  }

  function buildAmesToolbox(targetDocument) {
    const wrap = targetDocument.createElement('span');
    wrap.className = 'airnavx-toolbox-wrap';

    const button = targetDocument.createElement('button');
    button.type = 'button';
    button.className = 'airnavx-toolbox-button';
    button.textContent = '工具箱';
    button.title = '打开马士航的工具箱';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      wrap.classList.toggle('airnavx-toolbox-open');
    });

    const panel = targetDocument.createElement('div');
    panel.className = 'airnavx-toolbox-panel';

    TOOLBOX_ITEMS.forEach((item) => {
      const link = targetDocument.createElement('a');
      link.href = buildToolboxUrl(item, targetDocument);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.dataset.tone = item.tone || 'default';
      link.textContent = item.text;
      link.addEventListener('click', async (event) => {
        event.stopPropagation();
        wrap.classList.remove('airnavx-toolbox-open');

        if (!item.withAmesCookie) {
          link.href = buildToolboxUrl(item, targetDocument);
          return;
        }

        event.preventDefault();
        const targetWindow = window.open('about:blank', '_blank');
        const amesLoginInfo = await fetchAmesLoginInfo();
        const targetUrl = buildToolboxUrl(item, targetDocument, amesLoginInfo);
        if (targetWindow) {
          targetWindow.opener = null;
          targetWindow.location.href = targetUrl;
        } else {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      });
      panel.appendChild(link);
    });

    wrap.appendChild(button);
    wrap.appendChild(panel);
    return wrap;
  }

  function getTopDocument(targetDocument) {
    try {
      return targetDocument.defaultView.top.document;
    } catch (error) {
      return document;
    }
  }

  function closeAmesToolboxFrom(targetDocument, event) {
    const topDocument = getTopDocument(targetDocument);
    if (topDocument === targetDocument) {
      const target = event && event.target;
      if (target && target.closest && target.closest('.airnavx-toolbox-wrap')) {
        return;
      }
    }

    topDocument.querySelectorAll('.airnavx-toolbox-open').forEach((node) => {
      node.classList.remove('airnavx-toolbox-open');
    });
  }

  function installAmesToolboxCloseListener(targetDocument) {
    if (!targetDocument || targetDocument.airnavxToolboxCloseInstalled) {
      return;
    }

    targetDocument.airnavxToolboxCloseInstalled = true;
    targetDocument.addEventListener('click', (event) => closeAmesToolboxFrom(targetDocument, event), true);
  }

  function enhanceAmesToolbox(targetDocument) {
    if (!isTopDocument(targetDocument) || targetDocument.querySelector('.airnavx-toolbox-wrap')) {
      return;
    }

    const manualAnchor = findAmesManualAnchor(targetDocument);
    if (manualAnchor && manualAnchor.parentNode) {
      manualAnchor.parentNode.insertBefore(buildAmesToolbox(targetDocument), manualAnchor);
      return;
    }

    const nav = targetDocument.querySelector('.navbar-right, .nav.navbar-top-links.navbar-right, .navbar-top-links');
    if (nav) {
      nav.insertBefore(buildAmesToolbox(targetDocument), nav.firstChild);
    }
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
    const gridView = bodyTable.closest('.datagrid-view2, .datagrid-view1, .datagrid-view');
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

  function getCmpColumnIndex(bodyTable, targetDocument) {
    return getColumnIndexByHeader(bodyTable, targetDocument, CMP_HEADER);
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

  const aircraftFsns = new Map();
  let aircraftFsnsLoadedAt = 0;
  let aircraftFsnsLoadPromise = null;
  let aircraftFsnsRetryAfter = 0;
  let aircraftFsnsLastError = '';
  const aircraftFsnGridSummaries = new WeakMap();

  function normalizeAircraftRegistration(value) {
    const text = normalizeDash(cleanText(value)).toUpperCase().replace(/\s+/g, '');
    const match = text.match(/^(?:B-?)?([A-Z0-9]{4,6})$/);
    return match ? `B-${match[1]}` : '';
  }

  function formatFsnRanges(values) {
    const numbers = Array.from(new Set(values.map(Number).filter(Number.isSafeInteger)))
      .sort((left, right) => left - right);
    const ranges = [];
    for (const value of numbers) {
      const last = ranges[ranges.length - 1];
      if (last && value === last[1] + 1) {
        last[1] = value;
      } else {
        ranges.push([value, value]);
      }
    }
    return ranges.map(([first, last]) => `${first}-${last}`).join(',');
  }

  function getAircraftFsnSummary(registrations) {
    return formatFsnRanges(registrations.map((registration) => {
      const record = aircraftFsns.get(normalizeAircraftRegistration(registration));
      return record && !record.retired ? record.fsn : '';
    }).filter((fsn) => /^\d+$/.test(fsn)));
  }

  function getAircraftGridData(bodyTable, targetDocument, registrationHeader) {
    const grid = bodyTable.closest('.datagrid-wrap');
    const source = grid?.querySelector('table.datagrid-f');
    const pageWindow = targetDocument === document && typeof unsafeWindow !== 'undefined'
      ? unsafeWindow : targetDocument.defaultView;
    const $ = pageWindow?.jQuery || pageWindow?.$;
    if (!source || !$?.fn?.datagrid) {
      return null;
    }
    try {
      const options = $(source).datagrid('options');
      const data = $(source).datagrid('getData');
      const field = registrationHeader.getAttribute('field');
      if (!field || !Array.isArray(data?.rows)) {
        return null;
      }
      return { options, data, field, pageWindow };
    } catch (error) {
      return null;
    }
  }

  function getAircraftGridRegistrations(bodyTable, targetDocument, registrationHeader) {
    const gridData = getAircraftGridData(bodyTable, targetDocument, registrationHeader);
    if (!gridData) {
      return null;
    }
    const { options, data, field, pageWindow } = gridData;
    const rows = data.rows;
    const total = Number(data.total);
    if (Number.isSafeInteger(total) && rows.length >= total) {
      return rows.map((row) => row?.[field]);
    }
    if (!options.url || !pageWindow?.fetch || !Number.isSafeInteger(total) || total < 0) {
      return null;
    }

    const scope = bodyTable.closest('.datagrid-view') || bodyTable;
    const pageSize = Math.max(1, Number(options.pageSize) || rows.length || 20);
    const fingerprint = JSON.stringify([options.url, options.method, options.queryParams,
      options.sortName, options.sortOrder, total, pageSize, field]);
    const previous = aircraftFsnGridSummaries.get(scope);
    if (previous?.fingerprint === fingerprint && Date.now() - previous.startedAt < 60000) {
      return previous.registrations || null;
    }
    const state = { fingerprint, startedAt: Date.now(), registrations: null };
    aircraftFsnGridSummaries.set(scope, state);
    const readPages = async () => {
      const allRows = [];
      const pages = Math.ceil(total / pageSize);
      for (let page = 1; page <= pages; page += 1) {
        const params = new URLSearchParams(options.queryParams || {});
        params.set('page', String(page));
        params.set('rows', String(pageSize));
        if (options.sortName) {
          params.set('sort', options.sortName);
          params.set('order', options.sortOrder || 'asc');
        }
        const method = String(options.method || 'post').toUpperCase();
        const url = new URL(options.url, targetDocument.location.href);
        if (method === 'GET') {
          params.forEach((value, key) => url.searchParams.set(key, value));
        }
        const response = await pageWindow.fetch(url.href, {
          method,
          credentials: 'same-origin',
          ...(method === 'GET' ? {} : {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params.toString()
          })
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        const pageRows = Array.isArray(result.data) ? result.data : result.data?.DG_ROWS;
        if (Number(result.code) !== 200 || !Array.isArray(pageRows)) {
          throw new Error('分页结果格式不正确');
        }
        allRows.push(...pageRows);
      }
      if (allRows.length < total) {
        throw new Error(`只取得 ${allRows.length}/${total} 条记录`);
      }
      if (aircraftFsnGridSummaries.get(scope) === state) {
        state.registrations = allRows.map((row) => row?.[field]);
        enhanceTables();
      }
    };
    void readPages().catch((error) => {
      state.error = String(error?.message || error);
      console.warn('读取 AMES 表格全部分页失败', error);
    });
    return null;
  }

  async function loadAircraftFsns() {
    if (aircraftFsnsLoadPromise || Date.now() < aircraftFsnsRetryAfter ||
        (aircraftFsnsLoadedAt && Date.now() - aircraftFsnsLoadedAt < 10 * 60 * 1000)) {
      return;
    }

    aircraftFsnsLoadPromise = (async () => {
      const nextFsns = new Map();
      let totalPages = 1;
      for (let page = 1; page <= totalPages; page += 1) {
        const url = new URL('/api/aircraft-master/search', TOOLBOX_BASE);
        url.searchParams.set('show_retired', 'true');
        url.searchParams.set('page_size', '1000');
        url.searchParams.set('page', String(page));
        const response = await toolboxRequest({ url: url.href });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`飞机主数据请求失败：HTTP ${response.status}`);
        }
        const result = JSON.parse(response.responseText || 'null');
        if (!result || result.success !== true || !Array.isArray(result.data?.aircraft)) {
          throw new Error('飞机主数据返回格式不正确');
        }
        result.data.aircraft.forEach((aircraft) => {
          const registration = normalizeAircraftRegistration(aircraft['机号']);
          const fsn = cleanText(String(aircraft.FSN ?? ''));
          if (registration && /^\d+$/.test(fsn)) {
            // Conflicting master records must not produce an arbitrary FSN.
            const previous = nextFsns.get(registration);
            nextFsns.set(registration, previous && previous.fsn !== fsn
              ? { fsn: '', retired: false }
              : { fsn, retired: Boolean(previous?.retired || cleanText(aircraft['实际退出时间'])) });
          }
        });
        totalPages = Math.max(1, Math.ceil(Number(result.data.pagination?.total_pages) || 1));
      }
      aircraftFsns.clear();
      nextFsns.forEach((record, registration) => aircraftFsns.set(registration, record));
      aircraftFsnsLoadedAt = Date.now();
      aircraftFsnsLastError = '';
      enhanceTables();
    })().catch((error) => {
      aircraftFsnsRetryAfter = Date.now() + 30000;
      aircraftFsnsLastError = String(error && error.message || error);
      console.warn('加载飞机主数据 FSN 失败', error);
    }).finally(() => {
      aircraftFsnsLoadPromise = null;
    });
    await aircraftFsnsLoadPromise;
  }

  async function copyAircraftFsnSummary(value, targetDocument) {
    const clipboard = targetDocument.defaultView?.navigator?.clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(value);
        return true;
      } catch (error) {
        // Some AMES browser profiles block the Clipboard API; try the selection fallback.
      }
    }
    const textarea = targetDocument.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    targetDocument.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
      copied = Boolean(targetDocument.execCommand('copy'));
    } catch (error) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  function showAircraftFsnCopyResult(targetDocument, anchor, message) {
    const toast = targetDocument.createElement('div');
    toast.className = 'airnavx-fsn-copy-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;z-index:2147483647;padding:6px 10px;'
      + 'border-radius:4px;background:#263c5a;color:#fff;font-size:12px;'
      + 'box-shadow:0 2px 8px #0003;pointer-events:none;max-width:260px;';
    const rect = anchor.getBoundingClientRect();
    toast.style.left = `${Math.max(8, rect.left)}px`;
    toast.style.top = `${rect.bottom + 6}px`;
    targetDocument.body.appendChild(toast);
    targetDocument.defaultView.setTimeout(() => toast.remove(), 1800);
  }

  function updateAircraftFsnPopover(popover, trigger) {
    const summary = trigger.__airnavxFsnSummary;
    popover.__airnavxSummary = summary;
    const text = summary || trigger.__airnavxFsnStatus;
    if (popover.__airnavxContent.textContent !== text) {
      popover.__airnavxContent.textContent = text;
    }
    const copyDisplay = summary ? '' : 'none';
    if (popover.__airnavxCopyButton.style.display !== copyDisplay) {
      popover.__airnavxCopyButton.style.display = copyDisplay;
    }
  }

  function closeAircraftFsnPopover(popover) {
    if (!popover) {
      return;
    }
    popover.__airnavxOutsideDocuments?.forEach((target) => {
      target.removeEventListener('click', popover.__airnavxOutsideClick, true);
    });
    popover.remove();
  }

  function bindAircraftFsnSummaryButton(trigger, targetDocument) {
    if (trigger.__airnavxFsnButtonBound) {
      return;
    }
    trigger.__airnavxFsnButtonBound = true;
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const existing = targetDocument.getElementById(AIRCRAFT_FSN_POPOVER_ID);
      if (existing) {
        closeAircraftFsnPopover(existing);
        if (existing.__airnavxSource === trigger) {
          return;
        }
      }

      const popover = targetDocument.createElement('div');
      popover.id = AIRCRAFT_FSN_POPOVER_ID;
      popover.__airnavxSource = trigger;
      popover.style.cssText = 'position:fixed;z-index:2147483646;width:min(420px,calc(100vw - 16px));'
        + 'box-sizing:border-box;padding:12px;border:1px solid #b7c7d8;border-radius:6px;'
        + 'background:#fff;color:#24364b;box-shadow:0 4px 16px #0003;font-size:13px;';
      const heading = targetDocument.createElement('div');
      heading.textContent = '未退租飞机 FSN 汇总';
      heading.style.cssText = 'font-weight:bold;margin-bottom:8px;';
      const content = targetDocument.createElement('div');
      content.style.cssText = 'max-height:240px;overflow:auto;user-select:text;'
        + 'white-space:normal;overflow-wrap:anywhere;line-height:1.5;';
      const actions = targetDocument.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:10px;';
      const copyButton = targetDocument.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = '复制汇总';
      const closeButton = targetDocument.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = '关闭';
      [copyButton, closeButton].forEach((button) => {
        button.style.cssText = 'cursor:pointer;padding:3px 10px;border:1px solid #9eafc2;'
          + 'border-radius:4px;background:#f5f8fb;color:#24364b;';
      });
      copyButton.addEventListener('click', async (clickEvent) => {
        clickEvent.stopPropagation();
        const summary = trigger.__airnavxFsnSummary;
        if (!summary) {
          return;
        }
        const copied = await copyAircraftFsnSummary(summary, targetDocument);
        showAircraftFsnCopyResult(targetDocument, copyButton,
          copied ? 'FSN 汇总已复制' : '复制失败，请检查剪贴板权限');
      });
      closeButton.addEventListener('click', () => closeAircraftFsnPopover(popover));
      actions.appendChild(copyButton);
      actions.appendChild(closeButton);
      popover.appendChild(heading);
      popover.appendChild(content);
      popover.appendChild(actions);
      popover.__airnavxContent = content;
      popover.__airnavxCopyButton = copyButton;
      updateAircraftFsnPopover(popover, trigger);
      targetDocument.body.appendChild(popover);

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = targetDocument.defaultView.innerWidth;
      popover.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - 428))}px`;
      popover.style.top = `${Math.max(8, Math.min(rect.bottom + 6,
        targetDocument.defaultView.innerHeight - popover.offsetHeight - 8))}px`;

      const outsideDocuments = [targetDocument];
      let ancestor = targetDocument.defaultView;
      while (ancestor) {
        try {
          const parent = ancestor.parent;
          if (!parent || parent === ancestor) {
            break;
          }
          if (parent.document) {
            outsideDocuments.push(parent.document);
          }
          ancestor = parent;
        } catch (error) {
          break;
        }
      }
      const onOutsideClick = (outsideEvent) => {
        if (!popover.contains(outsideEvent.target) && !trigger.contains(outsideEvent.target)) {
          closeAircraftFsnPopover(popover);
        }
      };
      popover.__airnavxOutsideDocuments = outsideDocuments;
      popover.__airnavxOutsideClick = onOutsideClick;
      outsideDocuments.forEach((target) => target.addEventListener('click', onOutsideClick, true));
    });
  }

  function enhanceAircraftFsnGrid(bodyTable, targetDocument) {
    const registrationIndex = getColumnIndexByHeader(bodyTable, targetDocument, '机号');
    if (registrationIndex < 0) {
      return;
    }

    const scope = getGridScope(bodyTable, targetDocument);
    const grid = bodyTable.closest('.datagrid-view') || scope;
    const hasNativeFsn = Array.from(grid.querySelectorAll('.datagrid-htable .datagrid-cell'))
      .some((cell) => /^(?:FSN|机队序号)$/i.test(cleanText(cell.textContent)) &&
        !cell.closest(`td.${AIRCRAFT_FSN_CELL_CLASS}`));
    if (hasNativeFsn) {
      return;
    }

    const headerRows = Array.from(scope.querySelectorAll('.datagrid-htable tr'));
    const headerRow = headerRows[headerRows.length - 1];
    if (!headerRow || !headerRow.children[registrationIndex]) {
      return;
    }
    const registrationHeader = headerRow.children[registrationIndex];

    let header = Array.from(headerRow.children)
      .find((cell) => cell.classList.contains(AIRCRAFT_FSN_CELL_CLASS));
    if (!header) {
      header = targetDocument.createElement('td');
      header.className = AIRCRAFT_FSN_CELL_CLASS;
      const label = targetDocument.createElement('div');
      label.className = 'datagrid-cell';
      label.textContent = 'FSN';
      header.appendChild(label);
      headerRow.insertBefore(header, headerRow.children[registrationIndex].nextSibling);
    }
    if (!targetDocument.getElementById('airnavx-aircraft-fsn-style')) {
      const style = targetDocument.createElement('style');
      style.id = 'airnavx-aircraft-fsn-style';
      style.textContent = `.${AIRCRAFT_FSN_CELL_CLASS} .datagrid-cell {
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        text-align:center;
      }
      .${AIRCRAFT_FSN_CELL_CLASS} .airnavx-aircraft-fsn-trigger {
        border:0;
        border-bottom:1px dotted currentColor;
        margin:0;
        padding:0;
        background:transparent;
        color:#0a65a2;
        cursor:pointer;
        font:inherit;
      }`;
      targetDocument.head.appendChild(style);
    }

    let hasRegistration = false;
    let contentWidth = AIRCRAFT_FSN_MIN_WIDTH;
    bodyTable.querySelectorAll('tbody tr').forEach((row) => {
      const registrationCell = row.children[registrationIndex];
      if (!registrationCell) {
        return;
      }
      const registration = normalizeAircraftRegistration(getRowCellText(row, registrationIndex));
      if (registration) {
        hasRegistration = true;
      }
      let cell = Array.from(row.children)
        .find((child) => child.classList.contains(AIRCRAFT_FSN_CELL_CLASS));
      if (!cell) {
        cell = targetDocument.createElement('td');
        cell.className = AIRCRAFT_FSN_CELL_CLASS;
        const content = targetDocument.createElement('div');
        content.className = 'datagrid-cell';
        cell.appendChild(content);
        row.insertBefore(cell, registrationCell.nextSibling);
      }
      const record = registration ? aircraftFsns.get(registration) : null;
      const fsn = record?.fsn || '';
      const displayText = fsn ? `${fsn}${record.retired ? ' 已退租' : ''}` : '';
      const content = cell.querySelector('.datagrid-cell');
      if (content.textContent !== displayText) {
        content.textContent = displayText;
      }
      contentWidth = Math.max(contentWidth, estimateTextWidth(displayText) + 16);
      cell.title = registration && !fsn && aircraftFsnsLoadedAt
        ? `飞机主数据中未匹配到 ${registration} 的 FSN` : '';
    });

    if (hasRegistration) {
      void loadAircraftFsns();
    }
    const allRegistrations = getAircraftGridRegistrations(bodyTable, targetDocument, registrationHeader);
    const summary = aircraftFsnsLoadedAt && allRegistrations
      ? getAircraftFsnSummary(allRegistrations) : '';
    const summaryState = aircraftFsnGridSummaries.get(bodyTable.closest('.datagrid-view') || bodyTable);
    const headerContent = header.querySelector('.datagrid-cell');
    let trigger = headerContent.querySelector('button.airnavx-aircraft-fsn-trigger');
    if (!trigger) {
      headerContent.textContent = '';
      trigger = targetDocument.createElement('button');
      trigger.type = 'button';
      trigger.className = 'airnavx-aircraft-fsn-trigger';
      trigger.textContent = 'FSN';
      trigger.title = '点击查看 FSN 汇总';
      headerContent.appendChild(trigger);
    }
    trigger.__airnavxFsnSummary = summary;
    trigger.__airnavxFsnStatus = aircraftFsnsLastError
      ? `飞机主数据暂不可用，将自动重试：${aircraftFsnsLastError}`
      : aircraftFsnsLoadedAt
        ? allRegistrations ? '当前结果中没有可汇总的未退租 FSN'
          : summaryState?.error ? `读取当前表格全部分页失败：${summaryState.error}；稍后重试`
            : '正在读取当前表格的全部分页'
        : '正在读取飞机主数据';
    bindAircraftFsnSummaryButton(trigger, targetDocument);
    headerContent.title = '';
    const popover = targetDocument.getElementById(AIRCRAFT_FSN_POPOVER_ID);
    if (popover?.__airnavxSource === trigger &&
        (popover.__airnavxSummary !== summary || !summary)) {
      updateAircraftFsnPopover(popover, trigger);
    }
    const width = clamp(Math.max(contentWidth, estimateTextWidth('FSN') + 16),
      AIRCRAFT_FSN_MIN_WIDTH, AIRCRAFT_FSN_MAX_WIDTH);
    headerContent.style.width = `${width}px`;
    headerContent.style.minWidth = `${width}px`;
    bodyTable.querySelectorAll(`td.${AIRCRAFT_FSN_CELL_CLASS} .datagrid-cell`).forEach((content) => {
      content.style.width = `${width}px`;
      content.style.minWidth = `${width}px`;
    });
  }

  function removeButtons(cell, selector) {
    const contentNode = getCellContentNode(cell);
    if (!contentNode) {
      return;
    }

    contentNode.querySelectorAll(selector).forEach((node) => node.remove());
  }

  function hasNativeReferenceHeader(bodyTable, targetDocument) {
    const scope = getGridScope(bodyTable, targetDocument);
    const headerRows = Array.from(scope.querySelectorAll('.datagrid-htable tr'));
    const lastHeaderRow = headerRows[headerRows.length - 1];
    if (!lastHeaderRow) {
      return false;
    }

    return Array.from(lastHeaderRow.children).some((cell) => {
      if (!REFERENCE_HEADERS.includes(cleanText(cell.textContent))) {
        return false;
      }

      const node = cell.querySelector && cell.querySelector('.datagrid-cell');
      const isScriptAdded = node && Array.from(node.classList).some((name) => name.includes('-airnavx-reference'));
      return !isScriptAdded;
    });
  }

  function looksLikeJobCardGrid(bodyTable, targetDocument) {
    const headerTexts = getHeaderTexts(bodyTable, targetDocument);

    return headerTexts.includes('工卡号') &&
      headerTexts.includes('机队') &&
      hasNativeReferenceHeader(bodyTable, targetDocument);
  }

  function isSmjcApprovalGrid(bodyTable, targetDocument) {
    const headerTexts = getHeaderTexts(bodyTable, targetDocument);

    return headerTexts.includes(JOBCARD_NO_HEADER) &&
      headerTexts.includes(JOBCARD_VERSION_HEADER) &&
      !hasNativeReferenceHeader(bodyTable, targetDocument);
  }

  function getJobCardNoColumnIndex(bodyTable, targetDocument) {
    return getColumnIndexByHeader(bodyTable, targetDocument, JOBCARD_NO_HEADER);
  }

  function getJobCardVersionColumnIndex(bodyTable, targetDocument) {
    return getColumnIndexByHeader(bodyTable, targetDocument, JOBCARD_VERSION_HEADER);
  }

  function normalizeJobCardNo(value) {
    return cleanText(value).replace(/^SMJC-/i, '');
  }

  function smjcRowMatches(row, jcNo, jobcardVersion) {
    if (!row || typeof row !== 'object') {
      return false;
    }

    const rowJcNo = normalizeJobCardNo(row.JC_NO || row.jcNo || row.jc_no);
    const targetJcNo = normalizeJobCardNo(jcNo);
    if (!rowJcNo || rowJcNo !== targetJcNo) {
      return false;
    }

    const targetVersion = cleanText(jobcardVersion);
    if (!targetVersion) {
      return true;
    }

    const rowVersions = [
      row.JC_VER,
      row.jcVer,
      row.JOBCARD_VER,
      row.jobcardVer
    ].map((value) => cleanText(value));

    return rowVersions.some((value) => value && value === targetVersion);
  }

  async function fetchSmjcReferenceData(jcNo, jobcardVersion) {
    const payload = {
      writer: '',
      status: '',
      fleet: '',
      jcNo: cleanText(jcNo),
      mark: '',
      jcStatus: '',
      cmpItemNo: '',
      changeFlag: '',
      ata: '',
      highlight: '',
      cepCheckout: '',
      subjectCn: '',
      jobcardVer: '',
      refData: '',
      ifOutsourcing: '',
      page: '1',
      rows: '100'
    };

    try {
      const response = await fetch(SMJC_LIST_PATH, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: encodeFormBody(payload)
      });
      if (!response.ok) {
        return '';
      }

      const result = await response.json();
      const rows = Array.isArray(result && result.data) ? result.data : [];
      const versionMatch = rows.find((row) => smjcRowMatches(row, jcNo, jobcardVersion));
      const targetJcNo = normalizeJobCardNo(jcNo);
      const jcNoMatch = rows.find((row) => {
        const rowJcNo = normalizeJobCardNo(row.JC_NO || row.jcNo || row.jc_no);
        return rowJcNo && rowJcNo === targetJcNo;
      });
      const match = versionMatch || jcNoMatch;
      if (!match) {
        return '';
      }

      return cleanText(match.REF_DATA || match.refData || match.ref_data);
    } catch (error) {
      return '';
    }
  }

  function getSmjcReferenceCache(targetWindow) {
    if (!targetWindow.__airnavxSmjcReferenceCache) {
      targetWindow.__airnavxSmjcReferenceCache = new Map();
    }
    return targetWindow.__airnavxSmjcReferenceCache;
  }

  function getSmjcReferenceCellClass(columnIndex) {
    return `datagrid-cell-c${columnIndex}-airnavx-reference`;
  }

  function installSmjcReferenceColumnStyle(targetDocument, cellClass) {
    const styleId = `airnavx-smjc-reference-style-${cellClass}`;
    if (targetDocument.getElementById(styleId)) {
      return;
    }

    const style = targetDocument.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${cellClass} {
        width: ${SMJC_REFERENCE_COLUMN_WIDTH}px !important;
        min-width: ${SMJC_REFERENCE_COLUMN_WIDTH}px !important;
      }
    `;
    targetDocument.head.appendChild(style);
  }

  function addSmjcReferenceColumn(bodyTable, targetDocument, jobcardVersionIndex) {
    const scope = getGridScope(bodyTable, targetDocument);
    const headerRows = Array.from(scope.querySelectorAll('.datagrid-htable tr'));
    const lastHeaderRow = headerRows[headerRows.length - 1];
    if (!lastHeaderRow) {
      return -1;
    }

    const existingCells = Array.from(lastHeaderRow.children);
    const existingIndex = existingCells.findIndex((cell) => {
      const node = cell.querySelector && cell.querySelector('.datagrid-cell');
      return node && Array.from(node.classList).some((name) => name.includes('-airnavx-reference'));
    });
    if (existingIndex >= 0) {
      return existingIndex;
    }

    const columnIndex = jobcardVersionIndex + 1;
    const cellClass = getSmjcReferenceCellClass(columnIndex);

    const headerTd = targetDocument.createElement('td');
    const headerCell = targetDocument.createElement('div');
    headerCell.className = `datagrid-cell ${cellClass}`;
    headerCell.textContent = SMJC_REFERENCE_HEADER;
    headerTd.appendChild(headerCell);

    const headerInsertAfter = lastHeaderRow.children[jobcardVersionIndex];
    if (headerInsertAfter && headerInsertAfter.nextSibling) {
      lastHeaderRow.insertBefore(headerTd, headerInsertAfter.nextSibling);
    } else {
      lastHeaderRow.appendChild(headerTd);
    }

    installSmjcReferenceColumnStyle(targetDocument, cellClass);
    return columnIndex;
  }

  function ensureSmjcReferenceCell(row, targetDocument, jobcardVersionIndex, referenceColumnIndex) {
    const existingCell = row.children[referenceColumnIndex];
    if (existingCell) {
      const existingNode = existingCell.querySelector && existingCell.querySelector('.datagrid-cell');
      const isReferenceCell = existingNode && Array.from(existingNode.classList).some((name) => name.includes('-airnavx-reference'));
      if (isReferenceCell) {
        return existingCell;
      }
    }

    const cellClass = getSmjcReferenceCellClass(referenceColumnIndex);
    const td = targetDocument.createElement('td');
    const cell = targetDocument.createElement('div');
    cell.className = `datagrid-cell ${cellClass}`;
    td.appendChild(cell);

    const rowInsertAfter = row.children[jobcardVersionIndex];
    if (rowInsertAfter && rowInsertAfter.nextSibling) {
      row.insertBefore(td, rowInsertAfter.nextSibling);
    } else {
      row.appendChild(td);
    }
    return td;
  }

  function getCmpReferenceCellClass(columnIndex) {
    return `datagrid-cell-c${columnIndex}-airnavx-cmp-reference`;
  }

  function installCmpReferenceColumnStyle(targetDocument, cellClass) {
    const styleId = `airnavx-cmp-reference-style-${cellClass}`;
    if (targetDocument.getElementById(styleId)) {
      return;
    }

    const style = targetDocument.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${cellClass} {
        width: ${CMP_REFERENCE_COLUMN_WIDTH}px !important;
        min-width: ${CMP_REFERENCE_COLUMN_WIDTH}px !important;
      }
    `;
    targetDocument.head.appendChild(style);
  }

  function addCmpReferenceColumn(bodyTable, targetDocument, cmpColumnIndex) {
    const scope = getGridScope(bodyTable, targetDocument);
    const headerRows = Array.from(scope.querySelectorAll('.datagrid-htable tr'));
    const lastHeaderRow = headerRows[headerRows.length - 1];
    if (!lastHeaderRow) {
      return -1;
    }

    const existingIndex = Array.from(lastHeaderRow.children).findIndex((cell) => {
      const node = cell.querySelector && cell.querySelector('.datagrid-cell');
      return node && Array.from(node.classList).some((name) => name.includes('-airnavx-cmp-reference'));
    });
    if (existingIndex >= 0) {
      return existingIndex;
    }

    const referenceColumnIndex = cmpColumnIndex + 1;
    const cellClass = getCmpReferenceCellClass(referenceColumnIndex);
    const headerTd = targetDocument.createElement('td');
    const headerCell = targetDocument.createElement('div');
    headerCell.className = `datagrid-cell ${cellClass}`;
    headerCell.textContent = CMP_REFERENCE_HEADER;
    headerTd.appendChild(headerCell);

    const insertAfter = lastHeaderRow.children[cmpColumnIndex];
    if (insertAfter && insertAfter.nextSibling) {
      lastHeaderRow.insertBefore(headerTd, insertAfter.nextSibling);
    } else {
      lastHeaderRow.appendChild(headerTd);
    }

    installCmpReferenceColumnStyle(targetDocument, cellClass);
    return referenceColumnIndex;
  }

  function ensureCmpReferenceCell(row, targetDocument, cmpColumnIndex, referenceColumnIndex) {
    const existingCell = row.children[referenceColumnIndex];
    const existingNode = existingCell && existingCell.querySelector && existingCell.querySelector('.datagrid-cell');
    if (existingNode && Array.from(existingNode.classList).some((name) => name.includes('-airnavx-cmp-reference'))) {
      return existingCell;
    }

    const td = targetDocument.createElement('td');
    const cell = targetDocument.createElement('div');
    cell.className = `datagrid-cell ${getCmpReferenceCellClass(referenceColumnIndex)}`;
    td.appendChild(cell);

    const insertAfter = row.children[cmpColumnIndex];
    if (insertAfter && insertAfter.nextSibling) {
      row.insertBefore(td, insertAfter.nextSibling);
    } else {
      row.appendChild(td);
    }
    return td;
  }

  function getCmpManualSearchKeyword(cmpNo) {
    const match = cleanText(cmpNo).match(/^A32-(.+-.+)-[^-]+$/i);
    return match ? match[1] : '';
  }

  function enhanceCmpReferenceGrid(bodyTable, targetDocument) {
    const cmpColumnIndex = getCmpColumnIndex(bodyTable, targetDocument);
    if (cmpColumnIndex < 0) {
      return;
    }

    const referenceColumnIndex = addCmpReferenceColumn(bodyTable, targetDocument, cmpColumnIndex);
    if (referenceColumnIndex < 0) {
      return;
    }

    bodyTable.querySelectorAll('tbody tr').forEach((row) => {
      const referenceCell = ensureCmpReferenceCell(row, targetDocument, cmpColumnIndex, referenceColumnIndex);
      const contentNode = getCellContentNode(referenceCell);
      if (!contentNode) {
        return;
      }

      const keyword = getCmpManualSearchKeyword(getRowCellText(row, cmpColumnIndex));
      contentNode.textContent = '';
      if (keyword) {
        contentNode.appendChild(buildButton(keyword, targetDocument));
      }
    });
  }

  async function enhanceSmjcReferenceRows(bodyTable, targetDocument, jcNoIndex, jobcardVersionIndex, referenceColumnIndex) {
    const targetWindow = targetDocument.defaultView || window;
    const cache = getSmjcReferenceCache(targetWindow);
    const rows = Array.from(bodyTable.querySelectorAll('tbody tr'));

    await Promise.all(rows.map(async (row) => {
      const referenceCell = ensureSmjcReferenceCell(row, targetDocument, jobcardVersionIndex, referenceColumnIndex);
      const jcNo = getRowCellText(row, jcNoIndex);
      const jobcardVersion = getRowCellText(row, jobcardVersionIndex);
      const contentNode = getCellContentNode(referenceCell);
      if (!jcNo || !contentNode) {
        return;
      }

      const cacheKey = `${jcNo}\u0000${jobcardVersion}`;
      let manualNoPromise = cache.get(cacheKey);
      if (!manualNoPromise) {
        manualNoPromise = fetchSmjcReferenceData(jcNo, jobcardVersion);
        cache.set(cacheKey, manualNoPromise);
      }

      const manualNo = await manualNoPromise;
      if (!row.isConnected || !contentNode.isConnected) {
        return;
      }

      contentNode.querySelectorAll(`.${BUTTON_WRAP_CLASS}, .${BUTTON_CLASS}`).forEach((node) => node.remove());
      if (manualNo) {
        contentNode.insertBefore(buildButton(manualNo, targetDocument), contentNode.firstChild);
      }
    }));
  }

  async function enhanceSmjcApprovalGrid(bodyTable, targetDocument) {
    const jcNoIndex = getJobCardNoColumnIndex(bodyTable, targetDocument);
    const jobcardVersionIndex = getJobCardVersionColumnIndex(bodyTable, targetDocument);
    if (jcNoIndex < 0 || jobcardVersionIndex < 0) {
      return;
    }

    const referenceColumnIndex = addSmjcReferenceColumn(bodyTable, targetDocument, jobcardVersionIndex);
    if (referenceColumnIndex < 0) {
      return;
    }

    await enhanceSmjcReferenceRows(bodyTable, targetDocument, jcNoIndex, jobcardVersionIndex, referenceColumnIndex);
  }

  function enhanceTablesInDocument(targetDocument) {
    const targetWindow = targetDocument.defaultView || window;

    if (!isVisibleFrameWindow(targetWindow)) {
      return;
    }

    targetDocument.querySelectorAll('table.datagrid-btable').forEach((bodyTable) => {
      // Each AMES iframe loads this userscript itself. Its own instance alone owns the FSN column.
      if (targetDocument === document) {
        enhanceAircraftFsnGrid(bodyTable, targetDocument);
      }
      enhanceRawMessageGrid(bodyTable, targetDocument);
      enhanceCmpReferenceGrid(bodyTable, targetDocument);

      if (!looksLikeJobCardGrid(bodyTable, targetDocument)) {
        if (isSmjcApprovalGrid(bodyTable, targetDocument)) {
          void enhanceSmjcApprovalGrid(bodyTable, targetDocument);
        }
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
      installAmesToolboxCloseListener(targetDocument);
      enhanceAmesToolbox(targetDocument);
      enhanceTablesInDocument(targetDocument);
      enhanceRawMessageDetail(targetDocument);
      enhanceRawMessageViewDetail(targetDocument);
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
      .${RAW_MESSAGE_BUTTON_WRAP_CLASS} {
        display: inline-flex;
        align-items: center;
        margin-right: 6px;
        vertical-align: middle;
      }
      .xiaoma-raw-message-detail-parse-wrap {
        margin-left: 8px;
        margin-right: 0;
      }
      .xiaoma-raw-message-view-detail-parse-wrap {
        display: flex;
        justify-content: flex-end;
        margin: 0 0 6px;
      }
      .${RAW_MESSAGE_BUTTON_CLASS} {
        display: inline-block;
        padding: 1px 7px;
        border: 1px solid #409eff;
        border-radius: 3px;
        background: #409eff;
        color: #fff !important;
        font: inherit;
        font-size: 12px;
        line-height: 18px;
        white-space: nowrap;
        cursor: pointer;
      }
      .${RAW_MESSAGE_BUTTON_CLASS}:hover {
        background: #337ecc;
        border-color: #337ecc;
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
      .airnavx-toolbox-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        margin: 0 8px 0 4px;
        vertical-align: middle;
        z-index: 9999;
      }
      .airnavx-toolbox-button {
        height: 28px;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 3px;
        background: rgb(116, 0, 60);
        color: #fff;
        font-size: 13px;
        line-height: 26px;
        cursor: pointer;
      }
      .airnavx-toolbox-button:hover {
        background: #8a0a4c;
      }
      .airnavx-toolbox-panel {
        position: absolute;
        top: 34px;
        right: 0;
        display: none;
        width: 188px;
        padding: 6px 0;
        border: 1px solid rgba(116, 0, 60, 0.22);
        border-top: 3px solid rgb(116, 0, 60);
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 8px 22px rgba(24, 39, 75, 0.18);
      }
      .airnavx-toolbox-open .airnavx-toolbox-panel {
        display: block;
      }
      .airnavx-toolbox-panel a {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 8px 14px 8px 12px;
        color: #24364f !important;
        font-size: 13px;
        line-height: 18px;
        text-align: left;
        text-decoration: none !important;
        white-space: nowrap;
      }
      .airnavx-toolbox-panel a::before {
        content: '';
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 2px;
        background: #7b8794;
        flex: 0 0 auto;
      }
      .airnavx-toolbox-panel a[data-tone="knowledge"]::before { background: #2f80ed; }
      .airnavx-toolbox-panel a[data-tone="monitor"]::before { background: #0f9f6e; }
      .airnavx-toolbox-panel a[data-tone="data"]::before { background: #5b6ee1; }
      .airnavx-toolbox-panel a[data-tone="jobcard"]::before { background: rgb(116, 0, 60); }
      .airnavx-toolbox-panel a[data-tone="xml"]::before { background: #dd7a01; }
      .airnavx-toolbox-panel a[data-tone="manual"]::before { background: #9b2fb3; }
      .airnavx-toolbox-panel a[data-tone="report"]::before { background: #607d8b; }
      .airnavx-toolbox-panel a[data-tone="eval"]::before { background: #c62828; }
      .airnavx-toolbox-panel a[data-tone="query"]::before { background: #00838f; }
      .airnavx-toolbox-panel a[data-tone="download"]::before { background: #546e7a; }
      .airnavx-toolbox-panel a:hover {
        background: rgba(116, 0, 60, 0.08);
        color: rgb(116, 0, 60) !important;
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

  function formatLocalDateTime(value) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ` +
      `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }

  function getRawMessageDefaultDateRange(targetWindow) {
    if (!targetWindow[RAW_MESSAGE_DATE_RANGE_KEY]) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      targetWindow[RAW_MESSAGE_DATE_RANGE_KEY] = {
        start: formatLocalDateTime(start),
        end: formatLocalDateTime(now)
      };
    }
    return targetWindow[RAW_MESSAGE_DATE_RANGE_KEY];
  }

  function getRawMessageDateFieldValue(targetDocument, fieldId) {
    const namedValue = targetDocument.querySelector(`input.textbox-value[name="${fieldId}"]`);
    const element = targetDocument.getElementById(fieldId);
    return String((namedValue && namedValue.value) || (element && element.value) || '').trim();
  }

  function setRawMessageDateFieldValue(targetDocument, targetWindow, fieldId, value) {
    const element = targetDocument.getElementById(fieldId);
    if (!element) {
      return false;
    }

    element.value = value;
    element.setAttribute('value', value);

    const $ = targetWindow.jQuery || targetWindow.$;
    if ($ && $.fn && typeof $.fn.datetimebox === 'function') {
      try {
        $(element).datetimebox('setValue', value);
      } catch (error) {
        // EasyUI may not have parsed this field yet; direct values below remain available.
      }
    }

    targetDocument.querySelectorAll(`input.textbox-value[name="${fieldId}"]`).forEach((input) => {
      input.value = value;
      input.setAttribute('value', value);
    });

    const visibleInput = element.nextElementSibling && element.nextElementSibling.querySelector('.textbox-text');
    if (visibleInput) {
      visibleInput.value = value;
    }
    return true;
  }

  function ensureRawMessageDefaultDateRange(targetDocument, targetWindow) {
    const form = targetDocument.getElementById(RAW_MESSAGE_SEARCH_FORM_ID);
    const grid = targetDocument.getElementById(RAW_MESSAGE_GRID_ID);
    if (!form || !grid) {
      return null;
    }

    const defaults = getRawMessageDefaultDateRange(targetWindow);
    const start = getRawMessageDateFieldValue(targetDocument, RAW_MESSAGE_START_DATE_ID) || defaults.start;
    const end = getRawMessageDateFieldValue(targetDocument, RAW_MESSAGE_END_DATE_ID) || defaults.end;
    setRawMessageDateFieldValue(targetDocument, targetWindow, RAW_MESSAGE_START_DATE_ID, start);
    setRawMessageDateFieldValue(targetDocument, targetWindow, RAW_MESSAGE_END_DATE_ID, end);
    return { start, end };
  }

  function installRawMessageInitialQueryGuard() {
    const targetWindow = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const range = ensureRawMessageDefaultDateRange(document, targetWindow);
    const $ = targetWindow.jQuery || targetWindow.$;
    if (!range || !$ || !$.fn || typeof $.fn.MyDataGrid !== 'function') {
      return false;
    }
    if ($.fn.MyDataGrid[RAW_MESSAGE_GRID_PATCH_KEY]) {
      return true;
    }

    const originalMyDataGrid = $.fn.MyDataGrid;
    const guardedMyDataGrid = function guardedMyDataGrid(options, ...args) {
      const element = this && this[0];
      const functionCode = options && options.columns && options.columns.param &&
        options.columns.param.FunctionCode;
      if (element && element.id === RAW_MESSAGE_GRID_ID && functionCode === RAW_MESSAGE_LIST_FUNCTION_CODE) {
        const currentRange = ensureRawMessageDefaultDateRange(document, targetWindow) || range;
        const accountNumber = targetWindow.logininfo && targetWindow.logininfo.accountNumber;
        options = {
          ...options,
          queryParams: {
            ...(options.queryParams || {}),
            startSynDate: currentRange.start,
            endSynDate: currentRange.end,
            nowDay: 'Y',
            ...(accountNumber ? { empNo: accountNumber } : {})
          }
        };
      }
      return originalMyDataGrid.call(this, options, ...args);
    };

    guardedMyDataGrid[RAW_MESSAGE_GRID_PATCH_KEY] = true;
    guardedMyDataGrid.__xiaomaOriginalMyDataGrid = originalMyDataGrid;
    $.fn.MyDataGrid = guardedMyDataGrid;
    return true;
  }

  function startRawMessageInitialQueryGuard() {
    const install = () => installRawMessageInitialQueryGuard();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
  }

  function startAmesEnhancements() {
    installRawMessageInitialQueryGuard();
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
    const password = '84510';
    let hasClickedContinue = false;

    async function run() {
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

  function runBoeingToolboxTranslatorHelper() {
    const session = location.hash.match(/^#xiaoma-translate\/([a-z0-9-]+)$/i);
    if (!session) {
      return;
    }

    const sessionId = session[1];
    const channel = 'xiaoma-boeing-translate';
    const inboxKey = `${channel}:${sessionId}:helper`;
    const outboxKey = `${channel}:${sessionId}:parent`;
    let translator = null;
    let creating = false;
    let needsActivation = false;
    let waiters = [];
    let queue = Promise.resolve();
    let status;
    let activate;
    let messageSequence = 0;

    function post(kind, data = {}) {
      GM_setValue(outboxKey, { channel, sessionId, kind, sequence: ++messageSequence, ...data });
    }

    function setStatus(message, kind = 'status') {
      if (status) {
        status.textContent = message;
      }
      post(kind, { message });
    }

    function settleWaiters(error) {
      const current = waiters;
      waiters = [];
      current.forEach(({ resolve, reject }) => error ? reject(error) : resolve(translator));
    }

    function waitForTranslator() {
      if (translator) {
        return Promise.resolve(translator);
      }
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    }

    function createTranslator() {
      if (creating || translator) {
        return;
      }
      const Api = window.Translator;
      if (!Api || typeof Api.create !== 'function') {
        const error = new Error('这个 Chrome 的 HTTPS 页面没有 Translator API。请检查桌面版 Chrome 版本和浏览器策略。');
        setStatus(error.message, 'error');
        settleWaiters(error);
        return;
      }
      creating = true;
      needsActivation = false;
      activate.disabled = true;
      setStatus('正在准备 Chrome 本机翻译');
      let creation;
      try {
        // Keep create() in the click task: Chrome may require user activation for model download.
        creation = Api.create({
          sourceLanguage: 'en',
          targetLanguage: 'zh',
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', (event) => {
              setStatus(`正在下载英译中语言包 ${Math.round(event.loaded * 100)}%`);
            });
          }
        });
      } catch (error) {
        creation = Promise.reject(error);
      }
      Promise.resolve(creation).then((instance) => {
        translator = instance;
        creating = false;
        activate.hidden = true;
        setStatus('本机翻译已就绪');
        settleWaiters();
      }, (error) => {
        creating = false;
        needsActivation = true;
        activate.disabled = false;
        const detail = `${error && error.name || 'Error'}: ${error && error.message || error}`;
        setStatus(`本机翻译启动失败：${detail}。点击重试。`, 'error');
        settleWaiters(error);
      });
    }

    async function handleBatch(data) {
      const instance = await waitForTranslator();
      const results = [];
      for (const item of data.items) {
        results.push({ id: item.id, text: await instance.translate(item.text) });
      }
      post('result', { requestId: data.requestId, results });
    }

    const listenerId = GM_addValueChangeListener(inboxKey, (_key, _oldValue, data, remote) => {
      if (!remote || !data || data.channel !== channel || data.sessionId !== sessionId) {
        return;
      }
      GM_deleteValue(inboxKey);
      if (data.kind === 'ping') {
        post('ready');
        if (needsActivation) {
          post('activation-required');
        }
      } else if (data.kind === 'batch' && Array.isArray(data.items)) {
        queue = queue.then(() => handleBatch(data)).catch((error) => {
          post('batch-error', {
            requestId: data.requestId,
            message: `${error && error.name || 'Error'}: ${error && error.message || error}`
          });
        });
      }
    });

    runWhenDomReady(() => {
      document.title = '787 工卡 · Chrome 本机翻译';
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:22px;font:14px/1.6 Arial,"Microsoft YaHei",sans-serif;color:#23364a';
      const heading = document.createElement('h2');
      heading.textContent = '787 工卡本机翻译';
      heading.style.cssText = 'margin:0 0 12px;font-size:20px';
      status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = '正在检查英译中语言包';
      activate = document.createElement('button');
      activate.type = 'button';
      activate.textContent = '启用本机翻译 / 重试';
      activate.style.cssText = 'padding:8px 14px;border:0;border-radius:4px;background:#1274b8;color:white;cursor:pointer';
      activate.addEventListener('click', createTranslator);
      const tip = document.createElement('p');
      tip.textContent = '翻译在 Chrome 本机完成。首次使用可能需要下载语言包。请在翻译期间保持此窗口打开。';
      tip.style.cssText = 'color:#617284;font-size:12px';
      document.body.append(heading, status, activate, tip);
      post('ready');

      const Api = window.Translator;
      if (!Api || typeof Api.create !== 'function') {
        createTranslator();
      } else if (typeof Api.availability === 'function') {
        Promise.resolve(Api.availability({ sourceLanguage: 'en', targetLanguage: 'zh' })).then((availability) => {
          if (availability === 'available') {
            createTranslator();
          } else if (availability === 'downloadable' || availability === 'downloading') {
            needsActivation = true;
            setStatus('语言包尚未就绪，请点击“启用本机翻译”');
            post('activation-required');
          } else {
            setStatus(`英译中当前不可用：${availability}`, 'error');
          }
        }).catch(() => setStatus('无法检查语言包，请点击“启用本机翻译”重试', 'error'));
      }
    });

    window.addEventListener('pagehide', () => {
      GM_removeValueChangeListener(listenerId);
      GM_deleteValue(inboxKey);
      if (translator && typeof translator.destroy === 'function') {
        translator.destroy();
      }
    });
  }

  function startBoeingToolboxTranslation() {
    const channel = 'xiaoma-boeing-translate';
    const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const inboxKey = `${channel}:${sessionId}:parent`;
    const outboxKey = `${channel}:${sessionId}:helper`;
    const helperOrigin = 'https://boeingtoolbox.juneyaoair.com';
    const helperUrl = `${helperOrigin}/#xiaoma-translate/${sessionId}`;
    const buttonId = 'xiaoma-boeing-translate-button';
    const statusId = 'xiaoma-boeing-translate-status';
    const noteClass = 'xiaoma-boeing-translation-note';
    const cache = new Map();
    let helper = null;
    let helperReady = false;
    let helperNeedsActivation = false;
    let helperForeground = false;
    let messageSequence = 0;
    let active = false;
    let root = null;
    let processing = false;
    let generation = 0;
    let requestNumber = 0;
    let pendingRequest = null;
    let processed = new WeakMap();
    let notesByNode = new WeakMap();

    function sendToHelper(kind, data = {}) {
      GM_setValue(outboxKey, { channel, sessionId, kind, sequence: ++messageSequence, ...data });
    }

    function setStatus(message, error = false) {
      const element = document.getElementById(statusId);
      if (element) {
        element.textContent = message;
        element.title = message;
        element.style.color = error ? '#ffd5d5' : '#fff';
        element.style.cursor = helperNeedsActivation && !helperForeground ? 'pointer' : 'default';
        element.style.textDecoration = helperNeedsActivation && !helperForeground ? 'underline' : 'none';
        element.tabIndex = helperNeedsActivation && !helperForeground ? 0 : -1;
      }
    }

    function clearTranslations() {
      generation += 1;
      active = false;
      helperNeedsActivation = false;
      GM_deleteValue(inboxKey);
      GM_deleteValue(outboxKey);
      processed = new WeakMap();
      notesByNode = new WeakMap();
      if (pendingRequest) {
        const request = pendingRequest;
        pendingRequest = null;
        window.clearTimeout(request.timer);
        request.reject(new Error('已取消翻译'));
      }
      document.querySelectorAll(`.${noteClass}`).forEach((note) => note.remove());
      const button = document.getElementById(buttonId);
      if (button) {
        button.textContent = '翻译';
        button.setAttribute('aria-pressed', 'false');
      }
      setStatus('');
    }

    function candidates(viewer) {
      const nodes = [];
      const walker = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const value = String(node.nodeValue || '').trim();
        const parent = node.parentElement;
        if (processed.has(node) && processed.get(node) !== node.nodeValue) {
          const oldNote = notesByNode.get(node);
          if (oldNote) {
            oldNote.remove();
          }
          processed.delete(node);
          notesByNode.delete(node);
        }
        if (!parent || !/[a-z]{3}/i.test(value) || processed.has(node) ||
            parent.closest(`.${noteClass}, a, button, script, style, noscript, svg, [aria-hidden="true"], .ng-hide`) ||
            /^\s*(?:AMM|TASK|SUBTASK|DMC-B787-A-)\s*[\d-]+\s*$/i.test(value) ||
            !parent.getClientRects().length) {
          continue;
        }
        nodes.push(node);
      }
      return nodes;
    }

    function addTranslation(node, original, translated) {
      if (!root || !root.contains(node) || node.nodeValue !== original) {
        return;
      }
      processed.set(node, original);
      if (!translated || translated.trim() === original.trim()) {
        return;
      }
      const note = document.createElement('span');
      note.className = noteClass;
      note.lang = 'zh-CN';
      note.textContent = `译：${translated}`;
      note.style.cssText = 'display:block;margin:2px 0 5px;color:#255477;font:normal 0.95em/1.45 Arial,"Microsoft YaHei",sans-serif;white-space:normal';
      node.parentNode.insertBefore(note, node.nextSibling);
      notesByNode.set(node, note);
    }

    function requestBatch(items) {
      return new Promise((resolve, reject) => {
        const requestId = ++requestNumber;
        const timer = window.setTimeout(() => {
          pendingRequest = null;
          reject(new Error('本机翻译等待超时。请检查辅助窗口中的语言包状态。'));
        }, 180000);
        pendingRequest = { requestId, items, resolve, reject, timer };
        sendToHelper('batch', { requestId, items });
      });
    }

    async function translatePending() {
      if (!active || !root || !helperReady || processing) {
        return;
      }
      processing = true;
      const currentGeneration = generation;
      let finished = 0;
      try {
        while (active && currentGeneration === generation && root.isConnected) {
          const nodes = candidates(root);
          if (!nodes.length) {
            setStatus(`翻译完成 · 中英对照${finished ? ` ${finished}` : ''}`);
            break;
          }
          const batch = nodes.slice(0, 10).map((node, id) => ({ id, node, original: node.nodeValue, text: node.nodeValue.trim() }));
          const missing = batch.filter((item) => !cache.has(item.text));
          if (missing.length) {
            setStatus(`翻译中 ${finished}/${finished + nodes.length}`);
            const results = await requestBatch(missing.map(({ id, text }) => ({ id, text })));
            if (!active || currentGeneration !== generation) {
              break;
            }
            results.forEach((result) => {
              const item = batch.find((entry) => entry.id === result.id);
              if (item && typeof result.text === 'string') {
                cache.set(item.text, result.text);
              }
            });
          }
          if (!active || currentGeneration !== generation) {
            break;
          }
          batch.forEach((item) => {
            if (cache.has(item.text)) {
              addTranslation(item.node, item.original, cache.get(item.text));
              finished += 1;
            }
          });
        }
      } catch (error) {
        if (currentGeneration === generation) {
          clearTranslations();
          setStatus(`翻译失败：${error && error.message || error}`, true);
        }
      } finally {
        processing = false;
      }
    }

    function openHelper(foreground = false) {
      if (foreground && helper && !helper.closed) {
        helper.close();
        helper = null;
      }
      if (!helper || helper.closed) {
        helperReady = false;
        helperNeedsActivation = false;
        helperForeground = foreground;
        try {
          helper = GM_openInTab(helperUrl, { active: foreground, insert: true, setParent: true });
        } catch (error) {
          clearTranslations();
          setStatus(`无法打开翻译标签：${error && error.message || error}`, true);
          return;
        }
      }
      if (!helper) {
        clearTranslations();
        setStatus('Tampermonkey 未能打开翻译标签，请检查扩展权限。', true);
        return;
      }
      sendToHelper('ping');
      setStatus(foreground ? '请在新标签点击“启用本机翻译”' : '等待后台翻译标签');
    }

    const listenerId = GM_addValueChangeListener(inboxKey, (_key, _oldValue, data, remote) => {
      if (!remote || !data || data.channel !== channel || data.sessionId !== sessionId) {
        return;
      }
      GM_deleteValue(inboxKey);
      if (data.kind === 'ready') {
        helperReady = true;
        if (pendingRequest) {
          sendToHelper('batch', { requestId: pendingRequest.requestId, items: pendingRequest.items });
        } else {
          translatePending();
        }
      } else if (data.kind === 'activation-required') {
        if (active) {
          helperNeedsActivation = true;
          setStatus(helperForeground
            ? '请在翻译标签点击“启用本机翻译”'
            : '语言包未就绪 · 点击这里打开翻译标签启用');
        }
      } else if (data.kind === 'status' || data.kind === 'error') {
        if (!active) {
          return;
        }
        if (data.kind === 'status' && data.message === '本机翻译已就绪') {
          helperNeedsActivation = false;
        }
        if (data.kind === 'error' && active && !pendingRequest) {
          clearTranslations();
        }
        setStatus(helperNeedsActivation && data.kind === 'status'
          ? (helperForeground ? '请在翻译标签点击“启用本机翻译”' : '语言包未就绪 · 点击这里打开翻译标签启用')
          : data.message, data.kind === 'error');
      } else if (pendingRequest && data.requestId === pendingRequest.requestId) {
        const request = pendingRequest;
        pendingRequest = null;
        window.clearTimeout(request.timer);
        if (data.kind === 'result') {
          request.resolve(data.results);
        } else if (data.kind === 'batch-error') {
          request.reject(new Error(data.message));
        }
      }
    });

    function ensureButton() {
      const viewer = document.querySelector('#tb_documentContent #WkwebScrollStyle');
      const toolbar = document.querySelector('#tbToolbar .toolbar_color_white');
      if (viewer !== root) {
        generation += 1;
        document.querySelectorAll(`.${noteClass}`).forEach((note) => note.remove());
        root = viewer;
        processed = new WeakMap();
        notesByNode = new WeakMap();
        if (active && root) {
          setStatus('正在翻译新工卡');
        }
      }
      if (!toolbar || !viewer || document.getElementById(buttonId)) {
        if (active && helperReady) {
          translatePending();
        }
        return;
      }
      const button = document.createElement('button');
      button.id = buttonId;
      button.type = 'button';
      button.textContent = active ? '原文' : '翻译';
      button.title = '中英对照显示工卡正文；再次点击恢复英文原文';
      button.setAttribute('aria-pressed', String(active));
      button.style.cssText = 'float:right;margin:4px 8px 0 0;padding:3px 13px;height:28px;border:1px solid #fff;border-radius:3px;background:transparent;color:#fff;font:600 14px Arial,"Microsoft YaHei",sans-serif;cursor:pointer;position:relative;z-index:2';
      button.addEventListener('click', () => {
        if (active) {
          clearTranslations();
        } else {
          active = true;
          generation += 1;
          button.textContent = '原文';
          button.setAttribute('aria-pressed', 'true');
          openHelper();
          if (helperReady) {
            translatePending();
          }
        }
      });
      const status = document.createElement('span');
      status.id = statusId;
      status.setAttribute('role', 'status');
      status.tabIndex = -1;
      status.style.cssText = 'float:right;margin:10px 8px 0 0;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px';
      const activateHelperTab = () => {
        if (active && helperNeedsActivation && !helperForeground) {
          openHelper(true);
        }
      };
      status.addEventListener('click', activateHelperTab);
      status.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activateHelperTab();
        }
      });
      toolbar.append(button, status);
      if (active && helperReady) {
        translatePending();
      }
    }

    runWhenDomReady(() => {
      ensureButton();
      window.setInterval(() => {
        ensureButton();
        if (active && helper && helper.closed) {
          clearTranslations();
          setStatus('后台翻译标签已关闭，点击翻译可重试。', true);
        } else if (active && helper && !helperReady) {
          sendToHelper('ping');
        }
      }, 1000);
    });
    window.addEventListener('pagehide', () => {
      clearTranslations();
      GM_removeValueChangeListener(listenerId);
      GM_deleteValue(inboxKey);
      GM_deleteValue(outboxKey);
      if (helper && !helper.closed) {
        helper.close();
      }
    });
  }

  function runAirNavEnhancements() {
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const pnTag = '[AirNav PN]';
    const patchedFlag = Symbol('airnavPnPatched');
    const accessCode = '73409';
    const accessCodeSelector = 'input.access-code[name="access-code"], input[name="access-code"]';
    const accessCodeAutoLoginKey = 'airnav-access-code-auto-login-enabled';
    const accessCodeAutoLoginToggleId = 'airnav-access-code-auto-login-toggle';
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

    function isAccessCodeAutoLoginEnabled() {
      try {
        if (typeof GM_getValue === 'function') {
          const savedValue = GM_getValue(accessCodeAutoLoginKey, null);
          if (savedValue !== null && savedValue !== undefined) {
            return savedValue !== false;
          }

          const legacyValue = localStorage.getItem(accessCodeAutoLoginKey);
          if (legacyValue === '0' || legacyValue === '1') {
            const enabled = legacyValue !== '0';
            if (typeof GM_setValue === 'function') {
              GM_setValue(accessCodeAutoLoginKey, enabled);
            }
            return enabled;
          }
          return true;
        }

        return localStorage.getItem(accessCodeAutoLoginKey) !== '0';
      } catch (error) {
        // Keep the existing automatic behavior if storage is unavailable.
        return true;
      }
    }

    function setAccessCodeAutoLoginEnabled(enabled) {
      try {
        if (typeof GM_setValue === 'function') {
          GM_setValue(accessCodeAutoLoginKey, Boolean(enabled));
        }
        localStorage.setItem(accessCodeAutoLoginKey, enabled ? '1' : '0');
      } catch (error) {
        // The page can still use the default behavior if storage is unavailable.
      }
    }

    function registerAccessCodeAutoLoginMenu() {
      if (typeof GM_registerMenuCommand !== 'function') {
        return;
      }

      const enabled = isAccessCodeAutoLoginEnabled();
      GM_registerMenuCommand(
        `73409 自动登录：${enabled ? '开启' : '关闭'}（点击切换）`,
        () => {
          setAccessCodeAutoLoginEnabled(!isAccessCodeAutoLoginEnabled());
          window.location.reload();
        }
      );
    }

    function ensureAccessCodeAutoLoginToggle(input) {
      const form = input && (input.form || document.querySelector('form[action*="set-access-code"]'));
      if (!form) {
        return;
      }

      let toggle = document.getElementById(accessCodeAutoLoginToggleId);
      const updateToggle = () => {
        const enabled = isAccessCodeAutoLoginEnabled();
        toggle.textContent = `73409 自动登录：${enabled ? '开启' : '关闭'}`;
        toggle.style.background = enabled ? '#1677ff' : '#6b7280';
        toggle.setAttribute('aria-pressed', String(enabled));
      };

      if (!toggle) {
        toggle = document.createElement('button');
        toggle.id = accessCodeAutoLoginToggleId;
        toggle.type = 'button';
        toggle.style.cssText = [
          'display:block',
          'margin:12px auto 0',
          'padding:7px 12px',
          'border:0',
          'border-radius:4px',
          'color:#fff',
          'font-size:13px',
          'line-height:1.25',
          'cursor:pointer'
        ].join(';');
        toggle.addEventListener('click', () => {
          const enabled = !isAccessCodeAutoLoginEnabled();
          setAccessCodeAutoLoginEnabled(enabled);
          if (!enabled && input.value === accessCode) {
            setNativeInputValue(input, '');
          }
          updateToggle();
          if (enabled) {
            fillAccessCode();
          }
        });
        form.insertAdjacentElement('afterend', toggle);
      }

      updateToggle();
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

      ensureAccessCodeAutoLoginToggle(input);
      if (!isAccessCodeAutoLoginEnabled()) {
        return true;
      }

      if (input.value !== accessCode) {
        setNativeInputValue(input, accessCode);
      }

      if (!hasSubmittedAccessCode && !hasAccessCodeError()) {
        window.setTimeout(() => {
          if (!hasSubmittedAccessCode && isAccessCodeAutoLoginEnabled() && document.contains(input)) {
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

    function startDocumentTranslation() {
      const buttonId = 'airnavx-translate-document';
      const statusId = 'airnavx-translate-status';
      const cache = new Map();
      let originals = new Map();
      let annotations = new Set();
      let notesByNode = new Map();
      let translatorPromise = null;
      let translatorCreation = null;
      let translatorInstance = null;
      let observedViewer = null;
      let observer = null;
      let runId = 0;
      let translationActive = false;
      let translationRunning = false;
      let rescanNeeded = false;
      let rescanTimer = null;

      const statusDetailId = 'airnavx-translate-status-detail';

      function removeStatusDetail() {
        const panel = document.getElementById(statusDetailId);
        if (panel) {
          panel.remove();
        }
      }

      function positionStatusDetail(panel) {
        if (!panel || !panel.isConnected) {
          return;
        }
        const anchor = document.getElementById(buttonId) || document.getElementById(statusId);
        if (!anchor) {
          return;
        }
        const gap = 8;
        const margin = 12;
        const anchorRect = anchor.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        let left = anchorRect.right - panelRect.width;
        left = Math.max(margin, Math.min(left, window.innerWidth - panelRect.width - margin));
        let top = anchorRect.bottom + gap;
        if (top + panelRect.height > window.innerHeight - margin) {
          top = Math.max(margin, anchorRect.top - panelRect.height - gap);
        }
        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
      }

      function showStatusDetail(message, detail) {
        removeStatusDetail();
        if (!detail) {
          return;
        }

        const panel = document.createElement('div');
        panel.id = statusDetailId;
        panel.setAttribute('role', 'alert');
        panel.style.cssText = [
          'position:fixed',
          'z-index:2147483647',
          'box-sizing:border-box',
          'width:min(560px,calc(100vw - 24px))',
          'max-height:min(50vh,380px)',
          'overflow:auto',
          'padding:12px 38px 12px 14px',
          'border:1px solid #d92d20',
          'border-radius:6px',
          'background:#fff7f6',
          'color:#7a271a',
          'box-shadow:0 6px 24px rgba(0,0,0,.20)',
          'font:13px/1.55 Arial,"Microsoft YaHei",sans-serif',
          'white-space:normal',
          'word-break:break-word',
          'overflow-wrap:anywhere',
          'user-select:text'
        ].join(';');

        const title = document.createElement('div');
        title.textContent = message || '本机翻译提示';
        title.style.cssText = 'margin-bottom:5px;font-size:14px;font-weight:700;color:#b42318;';
        panel.appendChild(title);

        const body = document.createElement('div');
        body.textContent = detail;
        panel.appendChild(body);

        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.title = '关闭提示';
        close.setAttribute('aria-label', '关闭本机翻译提示');
        close.style.cssText = 'position:absolute;right:9px;top:6px;border:0;background:transparent;color:#7a271a;font-size:22px;line-height:1;cursor:pointer;padding:2px 5px;';
        close.addEventListener('click', removeStatusDetail);
        panel.appendChild(close);

        document.body.appendChild(panel);
        positionStatusDetail(panel);
        window.requestAnimationFrame(() => positionStatusDetail(panel));
      }

      function setStatus(message, error) {
        const status = document.getElementById(statusId);
        if (status) {
          status.textContent = message;
          status.style.color = error ? '#b42318' : '#35516d';
          status.title = error || message;
        }
        if (error) {
          showStatusDetail(message, error);
        } else {
          removeStatusDetail();
        }
      }

      const MIN_TRANSLATOR_CHROME_MAJOR = 138;
      let translatorPlatformInfo = null;
      let translatorPlatformInfoPromise = null;

      function getChromeMajorVersion() {
        const ua = String(navigator.userAgent || '');
        const match = ua.match(/(?:Chrome|Chromium)\/(\d+)/i);
        return match ? Number(match[1]) : null;
      }

      function loadTranslatorPlatformInfo() {
        if (translatorPlatformInfoPromise) {
          return translatorPlatformInfoPromise;
        }

        const userAgentData = navigator.userAgentData;
        const basicInfo = {
          platform: String((userAgentData && userAgentData.platform) || navigator.platform || ''),
          architecture: '',
          bitness: ''
        };

        if (userAgentData && typeof userAgentData.getHighEntropyValues === 'function') {
          translatorPlatformInfoPromise = Promise.resolve(
            userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platformVersion'])
          ).then((info) => {
            translatorPlatformInfo = {
              ...basicInfo,
              ...info,
              platform: String(info.platform || basicInfo.platform || ''),
              architecture: String(info.architecture || ''),
              bitness: String(info.bitness || '')
            };
            return translatorPlatformInfo;
          }).catch(() => {
            translatorPlatformInfo = basicInfo;
            return translatorPlatformInfo;
          });
        } else {
          translatorPlatformInfo = basicInfo;
          translatorPlatformInfoPromise = Promise.resolve(basicInfo);
        }

        return translatorPlatformInfoPromise;
      }

      function isWindowsArm64(info) {
        const target = info || translatorPlatformInfo;
        if (!target) {
          return false;
        }
        const platform = String(target.platform || '').toLowerCase();
        const architecture = String(target.architecture || '').toLowerCase();
        const bitness = String(target.bitness || '').toLowerCase();
        return platform.includes('windows') &&
          (architecture === 'arm' || architecture === 'arm64' || architecture === 'aarch64') &&
          (!bitness || bitness === '64');
      }

      function windowsArm64Hint(extra) {
        return [
          '检测到 Windows ARM64。',
          'Chrome 当前未提供可用的 Windows ARM64 TranslateKit 核心翻译组件；即使 en-zh 语言包显示 Installed，也可能无法创建本机翻译器。',
          '可改用 macOS Chrome 或 Windows x64 Chrome 环境。',
          '可在 chrome://components/ 查看 Chrome TranslateKit；核心版本 0.0.0.0 表示没有实际安装版本。',
          extra || ''
        ].filter(Boolean).join(' ');
      }

      function setWindowsArm64Unsupported(extra) {
        setStatus('Windows ARM64 暂不支持本机翻译', windowsArm64Hint(extra));
      }

      function getTranslatorPermissionsPolicyState() {
        try {
          if (window.top === window) {
            return 'top';
          }
          const policy = document.permissionsPolicy || document.featurePolicy;
          if (policy && typeof policy.allowsFeature === 'function') {
            return policy.allowsFeature('translator') ? 'allowed' : 'blocked';
          }
          return 'iframe-unknown';
        } catch (_error) {
          return 'iframe-unknown';
        }
      }

      function translatorEnvironmentHint(extra) {
        if (isWindowsArm64()) {
          return windowsArm64Hint(extra);
        }
        const chromeMajor = getChromeMajorVersion();
        return [
          chromeMajor ? `当前 Chrome 主版本：${chromeMajor}。` : '未能识别当前 Chrome 版本。',
          `Translator API 需要桌面版 Chrome ${MIN_TRANSLATOR_CHROME_MAJOR} 或更高版本。`,
          '此功能与“Chrome 设置 → 语言 → 使用 Google 翻译”开关无关。',
          '如版本已满足，请检查 chrome://on-device-translation-internals/ 的语言包状态，以及 chrome://policy 中是否有限制本机 AI/模型下载的策略。',
          extra || ''
        ].filter(Boolean).join(' ');
      }

      function setTranslatorCreateError(error) {
        const name = String(error && error.name || '').trim();
        const detail = String(error && error.message || error || '未知错误');
        const chromeMajor = getChromeMajorVersion();

        if (isWindowsArm64()) {
          setWindowsArm64Unsupported(`${name || 'Error'}: ${detail}`);
          return;
        }

        if (chromeMajor && chromeMajor < MIN_TRANSLATOR_CHROME_MAJOR) {
          setStatus(
            `Chrome ${chromeMajor} · 请升级至 ${MIN_TRANSLATOR_CHROME_MAJOR}+`,
            translatorEnvironmentHint(`${name || 'Error'}: ${detail}`)
          );
          return;
        }

        if (name === 'NotSupportedError') {
          const availability = error && error.airnavTranslatorAvailability;
          const availabilityText = availability ? `；availability=${availability}` : '';
          setStatus(
            '本机翻译不可用 · 检查环境',
            translatorEnvironmentHint(`Chrome 返回 NotSupportedError${availabilityText}：${detail}`)
          );

          // Platform high-entropy values may not have finished loading when the error arrives.
          // Upgrade the message once Windows ARM64 is confirmed.
          loadTranslatorPlatformInfo().then((info) => {
            if (isWindowsArm64(info)) {
              setWindowsArm64Unsupported(`Chrome 返回 NotSupportedError${availabilityText}：${detail}`);
            }
          });
          return;
        }

        const label = name && name !== 'Error' ? `本机翻译失败 · ${name}` : '本机翻译未就绪 · 点击重试';
        setStatus(label, translatorEnvironmentHint(`${name && name !== 'Error' ? `${name}: ` : ''}${detail}`));
      }

      function destroyTranslator(translator) {
        try {
          if (translator && typeof translator.destroy === 'function') {
            translator.destroy();
          }
        } catch (_error) {
          // A failed cleanup must not prevent restoring the English text.
        }
      }

      function releaseTranslator() {
        translatorCreation = null;
        translatorPromise = null;
        const translator = translatorInstance;
        translatorInstance = null;
        destroyTranslator(translator);
      }

      function restoreOriginal() {
        runId += 1;
        translationActive = false;
        releaseTranslator();
        removeStatusDetail();
        rescanNeeded = false;
        if (rescanTimer) {
          window.clearTimeout(rescanTimer);
          rescanTimer = null;
        }
        annotations.forEach((annotation) => annotation.remove());
        if (observedViewer) {
          observedViewer.querySelectorAll('.airnavx-translation-note').forEach((annotation) => annotation.remove());
        }
        annotations = new Set();
        notesByNode = new Map();
        originals = new Map();
        const button = document.getElementById(buttonId);
        if (button) {
          button.textContent = '翻译';
          button.setAttribute('aria-pressed', 'false');
        }
        setStatus('');
      }

      function textNodesToTranslate(viewer) {
        const nodes = [];
        const walker = document.createTreeWalker(viewer, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const value = node.nodeValue || '';
          const parent = node.parentElement;
          if (!/[a-z]{3}/i.test(value) || !parent ||
              parent.closest('.airnavx-translation-note, .link, [role="link"], a, button, script, style, noscript, svg, [aria-hidden="true"]') ||
              /^\s*(?:TASK|SUBTASK)\s+\d{2}-\d{2}-/i.test(value) ||
              !parent.getClientRects().length) {
            continue;
          }
          const range = document.createRange();
          range.selectNodeContents(node);
          if (range.getClientRects().length) {
            nodes.push(node);
          }
          range.detach();
        }
        return nodes;
      }

      async function translatePending(viewer, currentRun) {
        if (translationRunning) {
          rescanNeeded = true;
          return;
        }
        translationRunning = true;
        let translatorReady = false;
        try {
          const translator = await translatorPromise;
          translatorReady = true;
          if (currentRun === runId && translationActive) {
            setStatus('语言包就绪 · 开始翻译');
          }
          let finished = 0;
          do {
            rescanNeeded = false;
            for (const annotation of annotations) {
              if (!annotation.isConnected) {
                annotations.delete(annotation);
              }
            }
            for (const node of originals.keys()) {
              const annotation = notesByNode.get(node);
              if (!viewer.contains(node) || (annotation && !annotation.isConnected)) {
                if (!viewer.contains(node) && annotation) {
                  annotation.remove();
                  annotations.delete(annotation);
                }
                originals.delete(node);
                notesByNode.delete(node);
              }
            }
            const nodes = textNodesToTranslate(viewer).filter((node) => !originals.has(node));
            for (const node of nodes) {
              if (currentRun !== runId || !translationActive) {
                return;
              }
              if (!viewer.contains(node)) {
                continue;
              }
              const original = node.nodeValue;
              originals.set(node, original);
              const source = original.trim();
              let translated = cache.get(source);
              if (!translated) {
                translated = await translator.translate(source);
                cache.set(source, translated);
              }
              if (currentRun !== runId || !translationActive) {
                return;
              }
              if (!viewer.contains(node) || node.nodeValue !== original) {
                originals.delete(node);
                rescanNeeded = true;
                continue;
              }
              const annotation = document.createElement('span');
              annotation.className = 'airnavx-translation-note';
              annotation.lang = 'zh-CN';
              annotation.textContent = `译：${translated}`;
              annotation.style.cssText = 'display:block;color:#234e73;font-size:0.96em;line-height:1.5;margin:3px 0 7px;white-space:normal';
              node.parentNode.insertBefore(annotation, node.nextSibling);
              annotations.add(annotation);
              notesByNode.set(node, annotation);
              finished += 1;
              setStatus(`翻译中 ${finished}`);
            }
          } while (rescanNeeded && currentRun === runId && translationActive);
          if (currentRun === runId && translationActive) {
            setStatus('翻译完成 · 中英对照');
          }
        } catch (error) {
          if (currentRun === runId) {
            restoreOriginal();
            const detail = String(error && error.message || error);
            const message = translatorReady ? '翻译失败，已恢复原文' :
              error && error.code === 'AIRNAV_TRANSLATOR_TIMEOUT' ? '语言包超时，点击重试' : null;
            if (message) {
              setStatus(message, detail);
            } else {
              setTranslatorCreateError(error);
            }
          }
        } finally {
          translationRunning = false;
          if (rescanNeeded && translationActive) {
            requestRescan();
          }
        }
      }

      function requestRescan() {
        if (!translationActive || rescanTimer) {
          return;
        }
        rescanNeeded = true;
        if (translationRunning) {
          return;
        }
        rescanTimer = window.setTimeout(() => {
          rescanTimer = null;
          if (translationActive && observedViewer) {
            translatePending(observedViewer, runId);
          }
        }, 120);
      }

      function translateDocument(button, viewer) {
        if (!viewer) {
          setStatus('右侧暂无可翻译文字');
          return;
        }
        if (isWindowsArm64()) {
          setWindowsArm64Unsupported('当前环境不调用 Translator.create()，避免重复出现 NotSupportedError。');
          return;
        }

        const chromeMajor = getChromeMajorVersion();
        if (chromeMajor && chromeMajor < MIN_TRANSLATOR_CHROME_MAJOR) {
          setStatus(
            `Chrome ${chromeMajor} · 请升级至 ${MIN_TRANSLATOR_CHROME_MAJOR}+`,
            translatorEnvironmentHint('当前版本低于 Translator API 的稳定版最低版本。')
          );
          return;
        }

        const TranslatorApi = win.Translator || window.Translator;
        if (!TranslatorApi || typeof TranslatorApi.create !== 'function') {
          if (window.isSecureContext === false) {
            setStatus(
              '当前页面非安全环境 · 请使用 HTTPS',
              [
                '当前页面不是安全上下文（window.isSecureContext = false），Chrome 不会在这里开放 Translator API。',
                '请改用 HTTPS 版 AirNav/AirNavX 页面后再试。',
                '这个问题与“Chrome 设置 → 语言 → 使用 Google 翻译”开关无关。',
                `当前地址：${location.href}`
              ].join(' ')
            );
            return;
          }

          const permissionState = getTranslatorPermissionsPolicyState();
          if (permissionState === 'blocked') {
            setStatus(
              '当前页面未获翻译权限',
              [
                '当前页面位于 iframe 中，并且 Permissions Policy 未允许 translator 功能。',
                '需要由上层页面显式允许 translator 权限，或直接在顶层 HTTPS 页面中打开手册。',
                '这个问题与“Chrome 设置 → 语言 → 使用 Google 翻译”开关无关。'
              ].join(' ')
            );
            return;
          }

          const contextHint = permissionState === 'iframe-unknown'
            ? '当前页面位于 iframe 中，且无法确认 translator 权限状态；可尝试在顶层 HTTPS 页面打开后重试。'
            : '';
          setStatus(
            'Chrome Translator API 不可用',
            translatorEnvironmentHint([
              '当前页面未检测到 Translator.create()。',
              contextHint,
              '如果 Chrome 已是 138 或更高版本，请优先检查浏览器策略、组件状态，并完全退出 Chrome 后重新启动。'
            ].filter(Boolean).join(' '))
          );
          return;
        }
        const nodes = textNodesToTranslate(viewer);
        if (!nodes.length) {
          setStatus('右侧暂无可翻译文字');
          return;
        }

        const currentRun = ++runId;
        translationActive = true;
        button.textContent = '原文';
        button.setAttribute('aria-pressed', 'true');
        setStatus(`准备翻译 0/${nodes.length}`);

        // Probe availability without awaiting it here: create() should stay in the original click task
        // so Chrome can download a language pack when user activation is required.
        let availabilityPromise = null;
        if (typeof TranslatorApi.availability === 'function') {
          try {
            availabilityPromise = Promise.resolve(TranslatorApi.availability({
              sourceLanguage: 'en',
              targetLanguage: 'zh'
            })).catch(() => null);
          } catch (_error) {
            availabilityPromise = Promise.resolve(null);
          }
        }

        // create() starts in the click handler so Chrome can download a language pack when needed.
        if (!translatorPromise) {
          try {
            let downloadPercent = null;
            const creation = Promise.resolve(TranslatorApi.create({
              sourceLanguage: 'en',
              targetLanguage: 'zh',
              monitor(monitor) {
                monitor.addEventListener('downloadprogress', (event) => {
                  downloadPercent = Math.round(event.loaded * 100);
                  if (currentRun === runId) {
                    setStatus(`下载中文语言包 ${downloadPercent}%`);
                  }
                });
              }
            }));
            const diagnosedCreation = creation.catch(async (error) => {
              if (error && error.name === 'NotSupportedError' && availabilityPromise) {
                const availability = await availabilityPromise;
                if (availability) {
                  error.airnavTranslatorAvailability = availability;
                  if (!error.message) {
                    error.message = `Translator availability: ${availability}`;
                  }
                }
              }
              throw error;
            });
            translatorCreation = diagnosedCreation;
            diagnosedCreation.then((translator) => {
              if (translatorCreation === diagnosedCreation) {
                translatorInstance = translator;
              } else {
                destroyTranslator(translator);
              }
            }, () => {});
            const hintTimer = window.setTimeout(() => {
              if (currentRun === runId && translationActive) {
                setStatus(downloadPercent === null ? '等待 Chrome 加载语言包' : `语言包下载中 ${downloadPercent}%`,
                  '首次使用需下载；如长时间无进度，请检查 Chrome 的语言包下载状态');
              }
            }, 10000);
            let timeoutTimer;
            const timeout = new Promise((_, reject) => {
              timeoutTimer = window.setTimeout(() => {
                const error = new Error('Chrome 翻译语言包 2 分钟内未就绪。请检查网络与 chrome://on-device-translation-internals/ 中的语言包状态，然后重试。');
                error.code = 'AIRNAV_TRANSLATOR_TIMEOUT';
                reject(error);
              }, 120000);
            });
            translatorPromise = Promise.race([diagnosedCreation, timeout]).finally(() => {
              window.clearTimeout(hintTimer);
              window.clearTimeout(timeoutTimer);
            });
          } catch (error) {
            restoreOriginal();
            setTranslatorCreateError(error);
            return;
          }
        } else {
          setStatus('等待 Chrome 本机翻译');
        }
        translatePending(viewer, currentRun);
      }

      function findRightPane() {
        const panes = ['#tocRightPanel', '#rightPanel'].map((selector) => ({
          toolbar: document.querySelector(`${selector} #toolbar #tool`),
          viewer: document.querySelector(`${selector} #bindHtmlViewer`)
        })).filter((pane) => pane.toolbar && pane.viewer);
        return panes.find((pane) => pane.toolbar.getClientRects().length &&
          pane.viewer.getClientRects().length) || panes[0] || null;
      }

      function ensureButton() {
        const pane = findRightPane();
        const toolbar = pane && pane.toolbar;
        const viewer = pane && pane.viewer;
        if (!toolbar || !viewer) {
          if (observedViewer && !observedViewer.isConnected) {
            runId += 1;
            annotations = new Set();
            notesByNode = new Map();
            originals = new Map();
            rescanNeeded = translationActive;
            if (translationActive) {
              setStatus('等待右侧正文加载');
            }
            observer.disconnect();
            observedViewer = null;
            observer = null;
          }
          return;
        }
        if (viewer !== observedViewer) {
          const continueTranslation = translationActive;
          if (continueTranslation) {
            runId += 1;
            annotations.forEach((annotation) => annotation.remove());
            annotations = new Set();
            notesByNode = new Map();
            originals = new Map();
            rescanNeeded = true;
            setStatus('正在翻译新正文');
          } else {
            restoreOriginal();
          }
          if (observer) {
            observer.disconnect();
          }
          observedViewer = viewer;
          observer = new MutationObserver((mutations) => {
            const contentChanged = mutations.some((mutation) => mutation.type === 'childList' &&
              (mutation.removedNodes.length || [...mutation.addedNodes].some((node) =>
                node.nodeType !== 1 || !node.classList.contains('airnavx-translation-note'))));
            for (const mutation of mutations) {
              if (mutation.type === 'characterData' && originals.has(mutation.target) &&
                  mutation.target.nodeValue !== originals.get(mutation.target)) {
                const annotation = notesByNode.get(mutation.target);
                if (annotation) {
                  annotation.remove();
                  annotations.delete(annotation);
                  notesByNode.delete(mutation.target);
                }
                originals.delete(mutation.target);
                requestRescan();
              }
            }
            if (contentChanged) {
              requestRescan();
            }
          });
          observer.observe(viewer, { childList: true, characterData: true, subtree: true });
          if (continueTranslation) {
            requestRescan();
          }
        }
        const existingButton = document.getElementById(buttonId);
        const existingStatus = document.getElementById(statusId);
        if (existingButton && existingStatus) {
          if (existingButton.parentElement !== toolbar || existingStatus.parentElement !== toolbar) {
            toolbar.prepend(existingStatus);
            toolbar.prepend(existingButton);
          }
          return;
        }

        const button = existingButton || document.createElement('button');
        button.id = buttonId;
        button.type = 'button';
        button.textContent = translationActive ? '原文' : '翻译';
        button.title = '显示右侧正文的中英文对照；再点一次仅显示英文原文';
        button.setAttribute('aria-label', '翻译右侧正文');
        button.setAttribute('aria-pressed', String(translationActive));
        button.style.cssText = 'margin:0 8px 0 0;padding:5px 9px;border:1px solid #173b68;border-radius:3px;background:#fff;color:#173b68;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap';
        if (!existingButton) {
          button.addEventListener('click', () => {
            if (translationActive) {
              restoreOriginal();
            } else {
              const currentPane = findRightPane();
              translateDocument(button, currentPane && currentPane.viewer);
            }
          });
        }

        const status = existingStatus || document.createElement('span');
        status.id = statusId;
        status.setAttribute('role', 'status');
        status.style.cssText = 'display:inline-block;max-width:min(360px,42vw);margin-right:7px;overflow:visible;text-overflow:clip;white-space:normal;word-break:break-word;line-height:1.35;font-size:12px;vertical-align:middle';
        toolbar.prepend(status);
        toolbar.prepend(button);
      }

      loadTranslatorPlatformInfo();
      ensureButton();
      window.setInterval(ensureButton, 1000);
      window.addEventListener('resize', () => {
        const panel = document.getElementById(statusDetailId);
        if (panel) {
          positionStatusDetail(panel);
        }
      });
      window.addEventListener('pagehide', restoreOriginal);
    }

    patchDomEvents();
    patchHistory();
    patchNetwork();
    waitForAngular();
    registerAccessCodeAutoLoginMenu();
    runWhenDomReady(startAccessCodeAutoFill);
    runWhenDomReady(startDocumentTranslation);
  }

  if (location.host === TOOLBOX_HOST && location.pathname === '/raw-message-parser') {
    runRawMessageParserImportRelay();
  } else if (location.hostname === 'ames.juneyaoair.com') {
    if (isMelManualPage()) {
      runWhenDomReady(startMelRemarkInjection);
    } else {
      startRawMessageInitialQueryGuard();
      runWhenDomReady(startAmesEnhancements);
    }
  } else if (location.hostname === 'boeingtoolbox.juneyaoair.com' && location.protocol === 'https:') {
    runBoeingToolboxTranslatorHelper();
  } else if (location.hostname === 'boeingtoolbox.juneyaoair.com') {
    runBoeingToolboxAutoContinue();
    startBoeingToolboxTranslation();
  } else if (location.hostname === 'airnavx.juneyaoair.com' || location.host === 'airnav.juneyaoair.com:8000') {
    runAirNavEnhancements();
  }
})();
