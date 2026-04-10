'use strict';

const fs = require('fs/promises');
const path = require('path');
const { getCompanyConfig, mergeCompanyConfig } = require('./companyConfig.service');

let puppeteerInstance = null;
let browserPromise = null;
let cachedLogoDataUri = null;

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function money(value) {
    return toNumber(value).toFixed(2);
}

function normalizeItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
        const qty = toNumber(item?.qty, 0);
        const price = toNumber(item?.price, 0);
        const amount = Number.isFinite(Number(item?.amount)) ? toNumber(item?.amount, 0) : qty * price;
        const rawType = String(item?.type || '').toLowerCase();
        const type = rawType === 'material' ? 'Material' : 'Service';

        return {
            desc: String(item?.desc || ''),
            type,
            qty,
            price,
            amount
        };
    });
}

function buildBreakdown(items, taxRateInput, breakdownInput) {
    const taxRate = toNumber(taxRateInput, 0);

    let subtotal = 0;
    let serviceTotal = 0;
    let materialTotal = 0;

    items.forEach((item) => {
        subtotal += item.amount;
        if (String(item.type).toLowerCase() === 'material') materialTotal += item.amount;
        else serviceTotal += item.amount;
    });

    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    if (breakdownInput && typeof breakdownInput === 'object') {
        return {
            serviceTotal: toNumber(breakdownInput.serviceTotal, serviceTotal),
            materialTotal: toNumber(breakdownInput.materialTotal, materialTotal),
            subtotal: toNumber(breakdownInput.subtotal, subtotal),
            taxRate: toNumber(breakdownInput.taxRate, taxRate),
            taxAmount: toNumber(breakdownInput.taxAmount, taxAmount),
            total: toNumber(breakdownInput.total, total)
        };
    }

    return {
        serviceTotal,
        materialTotal,
        subtotal,
        taxRate,
        taxAmount,
        total
    };
}

async function getPuppeteer() {
    if (puppeteerInstance) return puppeteerInstance;
    // Lazy require so backend can boot even if package is missing.
    // Endpoint returns a clear error in that case.
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    puppeteerInstance = require('puppeteer');
    return puppeteerInstance;
}

async function getBrowser() {
    if (browserPromise) return browserPromise;

    const puppeteer = await getPuppeteer();
    browserPromise = puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=medium'
        ]
    });

    return browserPromise;
}

async function getLogoDataUri() {
    if (cachedLogoDataUri) return cachedLogoDataUri;
    const logoPath = path.resolve(__dirname, '../../../assets/images/logo.webp');
    try {
        const logoBuffer = await fs.readFile(logoPath);
        cachedLogoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        return cachedLogoDataUri;
    } catch (_) {
        cachedLogoDataUri = '';
        return cachedLogoDataUri;
    }
}

async function readLogoFileAsDataUri(filePath) {
    try {
        const logoBuffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.png'
                    ? 'image/png'
                    : 'image/webp';
        return `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
    } catch (_) {
        return '';
    }
}

async function resolveLogoSource(company = {}) {
    const customLogo = String(company.logoUrl || '').trim();
    if (!customLogo) return getLogoDataUri();
    if (/^data:/i.test(customLogo) || /^https?:\/\//i.test(customLogo)) return customLogo;

    const normalizedPath = customLogo.replace(/^\/+/, '');
    const absolutePath = path.resolve(__dirname, '../../../', normalizedPath);
    return readLogoFileAsDataUri(absolutePath);
}

function buildHtml(payload, logoSource) {
    const items = normalizeItems(payload?.items);
    const breakdown = buildBreakdown(items, payload?.taxRate, payload?.breakdown);
    const notesText = String(payload?.notes || '').trim();
    const quoteNumber = String(payload?.quoteNumber || '-');
    const quoteDate = String(payload?.quoteDate || '-');

    const company = payload?.company && typeof payload.company === 'object' ? payload.company : {};
    const estimateSettings = company.estimate && typeof company.estimate === 'object' ? company.estimate : {};
    const notes = notesText || String(estimateSettings.defaultNotes || 'Estimate valid for 30 days.\n50% deposit required, balance due upon completion.\nThank you for your business!');
    const estimateTitle = String(estimateSettings.title || 'Quote');
    const companyDisplayName = String(company.displayName || 'Straight Wire Electric');
    const companyAddress = String(company.address || '3828 S Grand Ave Apt 207, Los Angeles, CA 90037');
    const companyEin = String(company.ein || '39-4757804');
    const companyPhone = String(company.phone || '3236142546');
    const companyEmail = String(company.email || 'straightwireelectric@gmail.com');

    const clientName = String(payload?.client || 'N/A');
    const fallbackContact = String(payload?.contact || '').trim();
    const clientPhone = String(payload?.phone || '').trim() || (fallbackContact || 'N/A');
    const clientEmail = String(payload?.email || '').trim();
    const billingAddress = String(payload?.billingAddress || payload?.address || 'N/A');
    const serviceAddress = String(
        payload?.serviceAddress || payload?.shippingAddress || payload?.address || billingAddress || 'N/A'
    );
    const createdBy = payload?.createdBy && typeof payload.createdBy === 'object' ? payload.createdBy : {};
    const creatorUid = String(createdBy.uid || '').trim();
    const creatorEmail = String(createdBy.email || '').trim();
    const creatorName = String(createdBy.name || '').trim();
    const creatorInputCode = String(payload?.quoteCreatorId || createdBy.employeeCode || '').trim().toUpperCase();
    const creatorCode = /^EMP-[A-Z0-9]{6,}$/.test(creatorInputCode)
        ? creatorInputCode
        : `EMP-${String((creatorUid || creatorEmail || creatorName).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6) || '000000').padStart(6, '0')}`;
    const creatorShortName = creatorName
        ? (creatorName.length > 32 ? `${creatorName.slice(0, 32).trim()}...` : creatorName)
        : '';
    const creatorDisplay = creatorShortName ? `${creatorCode} (${creatorShortName})` : creatorCode;

    const rowsHtml = items.length
        ? items.map((item) => `
            <tr>
              <td>${escapeHtml(item.desc)}</td>
              <td>${escapeHtml(item.type)}</td>
              <td>${escapeHtml(item.qty)}</td>
              <td>$${money(item.price)}</td>
              <td>$${money(item.amount)}</td>
            </tr>
          `).join('')
        : `
          <tr>
            <td>-</td>
            <td>-</td>
            <td>0</td>
            <td>$0.00</td>
            <td>$0.00</td>
          </tr>
        `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page {
      size: Letter;
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 12px;
    }
    .paper {
      width: 100%;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
    }
    .header-left {
      width: 44%;
      vertical-align: bottom;
      padding-right: 10px;
    }
    .header-middle {
      width: 26%;
      vertical-align: bottom;
      text-align: center;
      padding: 0 8px;
    }
    .header-right {
      width: 30%;
      vertical-align: bottom;
      text-align: left;
      padding-left: 8px;
    }
    .header-left-wrap,
    .header-middle-wrap,
    .header-right-wrap {
      min-height: 122px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .header-middle-wrap {
      align-items: center;
      justify-content: flex-end;
    }
    .header-right-wrap {
      align-items: flex-start;
      padding-bottom: 2px;
    }
    .logo-wrap {
      min-height: 76px;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      margin-bottom: 0;
    }
    .logo {
      display: block;
      width: 150px;
      height: auto;
      margin: 0;
    }
    .company-line {
      margin: 0;
      line-height: 1.25;
      font-size: 12px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .quote-title {
      margin: 0 0 3px 0;
      font-size: 52px;
      line-height: 1;
      font-weight: 800;
    }
    .quote-row {
      margin: 1px 0;
      font-size: 12px;
      line-height: 1.2;
      white-space: normal;
    }
    .quote-label {
      display: inline-block;
      width: 72px;
      color: #444;
      font-weight: 600;
    }
    .quote-value {
      display: inline-block;
      font-weight: 700;
      margin-left: 8px;
      overflow-wrap: anywhere;
    }
    .divider {
      border: none;
      border-top: 1px solid #111;
      margin: 2px 0 8px;
    }
    .address-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .address-table td {
      width: 50%;
      border: 1px solid #111;
      vertical-align: top;
      padding: 0;
    }
    .card-title {
      font-weight: 700;
      padding: 3px 6px;
      border-bottom: 1px solid #111;
      background: #efefef;
      font-size: 12px;
    }
    .card-body {
      padding: 6px;
      min-height: 86px;
    }
    .card-line {
      margin: 0 0 2px 0;
      line-height: 1.25;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 12px;
    }
    .items-table thead {
      display: table-header-group;
    }
    .items-table th,
    .items-table td {
      border: 1px solid #111;
      padding: 5px 6px;
      vertical-align: top;
      word-wrap: break-word;
      word-break: break-word;
    }
    .items-table th {
      background: #efefef;
      font-weight: 700;
      text-align: center;
    }
    .items-table th:nth-child(1) { width: 40%; text-align: center; }
    .items-table th:nth-child(2) { width: 14%; }
    .items-table th:nth-child(3) { width: 8%; }
    .items-table th:nth-child(4) { width: 16%; }
    .items-table th:nth-child(5) { width: 22%; }
    .items-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .notes-box {
      margin-top: 10px;
      border: 1px solid #111;
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      line-height: 1.35;
    }
    .notes-title {
      margin: 0 0 6px 0;
      font-size: 12px;
      font-weight: 700;
    }
    .notes-content {
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }
    .totals-box {
      margin-top: 8px;
      margin-left: auto;
      width: 320px;
      border: 1px solid #111;
      border-radius: 6px;
      padding: 6px 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .totals-table td {
      padding: 5px 2px;
      font-weight: 700;
    }
    .totals-label { text-align: left; }
    .totals-value { text-align: right; }
    .grand-total td {
      background: #00bfff;
      color: #000;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <div class="paper">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="header-left-wrap">
            <p class="company-line"><strong>${escapeHtml(companyDisplayName)}</strong></p>
            <p class="company-line">${escapeHtml(companyAddress)}</p>
            <p class="company-line"><strong>EIN:</strong> ${escapeHtml(companyEin)}</p>
            <p class="company-line"><strong>Tel:</strong> ${escapeHtml(companyPhone)}</p>
            <p class="company-line"><strong>Email:</strong> ${escapeHtml(companyEmail)}</p>
          </div>
        </td>
        <td class="header-middle">
          <div class="header-middle-wrap">
            <div class="logo-wrap">
              ${logoSource ? `<img src="${logoSource}" class="logo" alt="Logo" />` : ''}
            </div>
          </div>
        </td>
        <td class="header-right">
          <div class="header-right-wrap">
            <h1 class="quote-title">${escapeHtml(estimateTitle)}</h1>
            <p class="quote-row"><span class="quote-label">Quote No</span><span class="quote-value">${escapeHtml(quoteNumber)}</span></p>
            <p class="quote-row"><span class="quote-label">Quote date</span><span class="quote-value">${escapeHtml(quoteDate)}</span></p>
            <p class="quote-row"><span class="quote-label">Created by</span><span class="quote-value">${escapeHtml(creatorDisplay)}</span></p>
          </div>
        </td>
      </tr>
    </table>

    <hr class="divider" />

    <table class="address-table">
      <tr>
        <td>
          <div class="card-title">Billing address</div>
          <div class="card-body">
            <p class="card-line"><strong>Client:</strong> ${escapeHtml(clientName)}</p>
            <p class="card-line"><strong>Phone:</strong> ${escapeHtml(clientPhone)}</p>
            ${clientEmail ? `<p class="card-line"><strong>Email:</strong> ${escapeHtml(clientEmail)}</p>` : ''}
            <p class="card-line">${escapeHtml(billingAddress)}</p>
          </div>
        </td>
        <td>
          <div class="card-title">Service address / Job site</div>
          <div class="card-body">
            <p class="card-line">${escapeHtml(serviceAddress)}</p>
          </div>
        </td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Type</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="notes-box">
      <p class="notes-title">Notes / Terms</p>
      <p class="notes-content">${escapeHtml(notes)}</p>
    </div>

    <div class="totals-box">
      <table class="totals-table">
        <tr>
          <td class="totals-label">SUBTOTAL:</td>
          <td class="totals-value">$${money(breakdown.subtotal)}</td>
        </tr>
        <tr>
          <td class="totals-label">TAX (${toNumber(breakdown.taxRate).toFixed(0)}%):</td>
          <td class="totals-value">$${money(breakdown.taxAmount)}</td>
        </tr>
        <tr class="grand-total">
          <td class="totals-label">TOTAL DUE (USD):</td>
          <td class="totals-value">$${money(breakdown.total)}</td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

async function renderEstimatePdf(payload) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        const companyConfig = await getCompanyConfig();
        const mergedPayload = {
            ...(payload || {}),
            company: mergeCompanyConfig(companyConfig, payload?.company || {}),
        };
        const logoSource = await resolveLogoSource(mergedPayload.company);
        const html = buildHtml(mergedPayload, logoSource);

        await page.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });

        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '10mm',
                right: '10mm',
                bottom: '10mm',
                left: '10mm'
            }
        });

        return pdfBuffer;
    } finally {
        await page.close();
    }
}

async function closeBrowser() {
    if (!browserPromise) return;
    try {
        const browser = await browserPromise;
        await browser.close();
    } catch (_) {
        // ignore close errors
    } finally {
        browserPromise = null;
    }
}

module.exports = {
    renderEstimatePdf,
    closeBrowser
};
