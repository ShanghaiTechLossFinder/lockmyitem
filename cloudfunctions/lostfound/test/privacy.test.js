'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isProtectedFoundItem, sanitizeFoundItemPrivacy } = require('../privacy');

for (const sample of [
  { category: '校园卡', title: '蓝色校园卡' },
  { category: '其他', title: '黑色钱包' },
  { category: '电子产品', title: '白色 AirPods' },
  { category: '钥匙', title: '宿舍钥匙' },
  { category: '电子产品', title: '手机' }
]) {
  test(`found item is image-protected: ${sample.title}`, () => {
    const item = sanitizeFoundItemPrivacy({ ...sample, type: 'found' });
    assert.notEqual(item.sensitivityLevel, 'normal');
    assert.equal(isProtectedFoundItem(item), true);
  });
}

test('lost posts are not image-protected', () => {
  assert.equal(isProtectedFoundItem({ type: 'lost', category: '电子产品', title: '手机' }), false);
});

test('model-provided sensitivity can elevate but cannot be downgraded', () => {
  const elevated = sanitizeFoundItemPrivacy({ type: 'found', title: '物品', sensitivityLevel: 'sensitive' });
  assert.equal(elevated.sensitivityLevel, 'sensitive');
  const matched = sanitizeFoundItemPrivacy({ type: 'found', title: '银行卡', sensitivityLevel: 'normal' });
  assert.equal(matched.sensitivityLevel, 'sensitive');
});
