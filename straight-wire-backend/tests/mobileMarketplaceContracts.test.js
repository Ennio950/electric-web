'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  decorateMarketplaceRequest,
  decorateMarketplaceEmergencyCall,
  decorateBossReviewQueueItem,
  buildMobileEmployeeHomeResponse,
  buildMobileBossHomeResponse,
} = require('../src/utils/mobileContracts');

test('decorateMarketplaceRequest preserves extra fields while normalizing the mobile contract', () => {
  const request = decorateMarketplaceRequest({
    id: 'req-123',
    status: 'negociando',
    description: ' Replace panel ',
    address: ' 742 Evergreen Terrace ',
    clientEmail: 'client@example.com',
    assignedEmployeeId: 'emp-1',
    assignedEmployeeEmail: 'tech@example.com',
    finalAmount: '175.5',
    paymentProofAt: '2026-03-19T10:00:00-06:00',
    updatedAt: 1760000000000,
    employeePhone: '+1-555-0100',
  });

  assert.equal(request.id, 'req-123');
  assert.equal(request.status, 'NEGOCIANDO');
  assert.equal(request.description, 'Replace panel');
  assert.equal(request.address, '742 Evergreen Terrace');
  assert.equal(request.employeeEmail, 'tech@example.com');
  assert.equal(request.finalAmount, 175.5);
  assert.equal(request.paymentProofAt, '2026-03-19T16:00:00.000Z');
  assert.equal(request.updatedAt, '2025-10-09T08:53:20.000Z');
  assert.equal(request.employeePhone, '+1-555-0100');
});

test('decorateMarketplaceRequest preserves null for empty records', () => {
  assert.equal(decorateMarketplaceRequest(null), null);
});

test('decorateMarketplaceEmergencyCall normalizes schedule and derived timestamp fields', () => {
  const call = decorateMarketplaceEmergencyCall({
    id: 'em-1',
    status: 'AWAITING_PAYMENT_PROOF',
    dispatchMode: 'SCHEDULED',
    issue: ' Power outage ',
    location: ' Zone 4 ',
    assignedEmployeeEmail: 'crew@example.com',
    createdAt: '2026-03-20T01:30:00-06:00',
    scheduledFor: '2026-03-21T09:15:00-06:00',
  });

  assert.equal(call.status, 'awaiting_payment_proof');
  assert.equal(call.dispatchMode, 'scheduled');
  assert.equal(call.issue, 'Power outage');
  assert.equal(call.location, 'Zone 4');
  assert.equal(call.assignedEmployeeEmail, 'crew@example.com');
  assert.equal(call.createdAt, '2026-03-20T07:30:00.000Z');
  assert.equal(call.createdAtMs, Date.parse('2026-03-20T07:30:00.000Z'));
  assert.equal(call.scheduledFor, '2026-03-21T15:15:00.000Z');
});

test('decorateBossReviewQueueItem derives proof timestamps and keeps queue identity stable', () => {
  const row = decorateBossReviewQueueItem({
    sourceType: 'EMERGENCY',
    sourceLabel: 'Emergencia',
    recordId: 'em-1',
    queueId: 'emergency:em-1',
    status: 'payment_pending_review',
    amount: '225.75',
    paymentProofAt: '2026-03-20T12:34:00-06:00',
  });

  assert.deepEqual(row, {
    sourceType: 'emergency',
    sourceLabel: 'Emergencia',
    recordId: 'em-1',
    queueId: 'emergency:em-1',
    status: 'payment_pending_review',
    amount: 225.75,
    paymentProofAt: '2026-03-20T18:34:00.000Z',
    paymentProofAtMs: Date.parse('2026-03-20T18:34:00.000Z'),
    paymentProofUrl: null,
    employeeId: null,
    employeeName: null,
    employeeEmail: null,
    clientId: null,
    clientName: null,
    clientEmail: null,
    description: null,
    address: null,
    createdAt: null,
    updatedAt: null,
  });
});

test('buildMobileEmployeeHomeResponse counts marketplace request states instead of legacy jobs', () => {
  const home = buildMobileEmployeeHomeResponse({
    employeeUid: 'emp-1',
    availableRequests: [
      { id: 'req-open-1', status: 'EN_ESPERA' },
      { id: 'req-open-2', status: 'EN_ESPERA' },
    ],
    myRequests: [
      { id: 'req-assigned', status: 'ASIGNADO' },
      { id: 'req-negotiating', status: 'NEGOCIANDO' },
      { id: 'req-payment', status: 'PAGO_PENDIENTE_REVISION' },
      { id: 'req-done', status: 'COMPLETADO' },
    ],
    emergencyCalls: [
      { id: 'em-active', status: 'accepted', assignedEmployeeId: 'emp-1' },
      { id: 'em-other', status: 'accepted', assignedEmployeeId: 'emp-2' },
      { id: 'em-pending', status: 'pending', assignedEmployeeId: null },
    ],
  });

  assert.deepEqual(home, {
    role: 'employee',
    summary: {
      openRequests: 2,
      assignedRequests: 1,
      inProgressRequests: 2,
      activeEmergencyCount: 1,
    },
  });
});

test('buildMobileBossHomeResponse keeps payments and queue counts aligned with marketplace contracts', () => {
  const home = buildMobileBossHomeResponse({
    requests: [
      { id: 'req-open', status: 'EN_ESPERA' },
      { id: 'req-review', status: 'PAGO_PENDIENTE_REVISION' },
      { id: 'req-done', status: 'COMPLETADO' },
    ],
    emergencyCalls: [
      { id: 'em-active', status: 'accepted' },
      { id: 'em-done', status: 'completed' },
    ],
    pendingPayments: [
      { id: 'req-review', status: 'PAGO_PENDIENTE_REVISION' },
    ],
    reviewQueue: [
      { sourceType: 'request', recordId: 'req-review', queueId: 'request:req-review', status: 'PAGO_PENDIENTE_REVISION', amount: 100 },
      { sourceType: 'emergency', recordId: 'em-active', queueId: 'emergency:em-active', status: 'payment_pending_review', amount: 200 },
    ],
  });

  assert.deepEqual(home, {
    role: 'boss',
    summary: {
      pendingRequests: 2,
      activeEmergencies: 1,
      pendingPayments: 1,
      reviewQueue: 2,
    },
  });
});
