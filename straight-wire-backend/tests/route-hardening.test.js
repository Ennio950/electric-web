'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

test('client jobs routes are consolidated into the main client router', () => {
    const indexContent = fs.readFileSync(path.join(backendRoot, 'src', 'index.js'), 'utf8');
    assert.equal(indexContent.includes("clientJobsRoutes"), false);

    const content = fs.readFileSync(path.join(backendRoot, 'src', 'routes', 'client.routes.js'), 'utf8');
    assert.equal(content.includes("router.get('/jobs'"), true);
    assert.equal(content.includes("router.post('/jobs'"), true);
});

test('uploads route applies a dedicated upload rate limiter', () => {
    const content = fs.readFileSync(path.join(backendRoot, 'src', 'routes', 'uploads.routes.js'), 'utf8');
    assert.equal(content.includes('const uploadImageLimiter = rateLimit({'), true);
    assert.equal(content.includes('uploadImageLimiter,'), true);
});
