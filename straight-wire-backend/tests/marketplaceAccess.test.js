'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { canDeleteEmergencyCall } = require('../src/services/marketplaceAccess');

test('boss can delete any emergency call', () => {
    assert.equal(canDeleteEmergencyCall({ assignedEmployeeId: 'emp-1' }, { uid: 'boss-1', role: 'boss' }), true);
});

test('assigned employee can delete their own emergency call', () => {
    assert.equal(canDeleteEmergencyCall({ assignedEmployeeId: 'emp-1' }, { uid: 'emp-1', role: 'employee' }), true);
});

test('different employee cannot delete another employees emergency call', () => {
    assert.equal(canDeleteEmergencyCall({ assignedEmployeeId: 'emp-1' }, { uid: 'emp-2', role: 'employee' }), false);
});

test('unassigned emergency call cannot be deleted by an employee', () => {
    assert.equal(canDeleteEmergencyCall({ assignedEmployeeId: null }, { uid: 'emp-1', role: 'employee' }), false);
});
