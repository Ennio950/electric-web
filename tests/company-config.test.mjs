import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeCompanyConfig,
  normalizePortalCards,
  normalizeServiceCategories,
} from '../assets/js/company-config.js';

test('normalizeServiceCategories keeps unique normalized keys', () => {
  const categories = normalizeServiceCategories([
    { key: 'Electricidad', label: 'Electricidad', icon: '⚡' },
    { key: 'plomeria', label: 'Plomeria', icon: '🔧' },
    { key: 'plomeria', label: 'Duplicada', icon: '🧪' },
  ]);

  assert.deepEqual(
    categories.map((entry) => entry.key),
    ['electricidad', 'plomeria'],
  );
});

test('normalizePortalCards preserves defaults while allowing overrides', () => {
  const cards = normalizePortalCards({
    client: {
      title: 'Hogar',
      imageUrl: 'https://example.com/client.png',
    },
  });

  assert.equal(cards.client.title, 'Hogar');
  assert.equal(cards.client.imageUrl, 'https://example.com/client.png');
  assert.equal(cards.employee.title, 'Empleado');
  assert.equal(cards.boss.ctaLabel, 'Panel Jefe');
});

test('mergeCompanyConfig accepts service categories and portal cards', () => {
  const config = mergeCompanyConfig({
    serviceCategories: [
      { key: 'aire-acondicionado', label: 'Aire acondicionado', icon: '❄️' },
    ],
    portalCards: {
      boss: {
        title: 'Gerencia',
        ctaLabel: 'Entrar',
      },
    },
  });

  assert.equal(config.serviceCategories[0].key, 'aire-acondicionado');
  assert.equal(config.serviceCategories[0].label, 'Aire acondicionado');
  assert.equal(config.portalCards.boss.title, 'Gerencia');
  assert.equal(config.portalCards.boss.ctaLabel, 'Entrar');
  assert.equal(config.portalCards.client.title, 'Cliente');
});
