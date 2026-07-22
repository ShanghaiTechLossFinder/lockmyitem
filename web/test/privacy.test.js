import test from 'node:test';
import assert from 'node:assert/strict';
import { isProtectedFoundItem, sanitizeFoundItemPrivacy } from '../src/privacy.js';

test('web privacy policy matches protected campus valuables', () => {
  for (const title of ['校园卡', '钱包', 'AirPods', '手机', '宿舍钥匙']) {
    const item = sanitizeFoundItemPrivacy({ type: 'found', category: '其他', title });
    assert.equal(isProtectedFoundItem(item), true, title);
  }
});

test('web policy keeps explicit sensitive classification', () => {
  const item = sanitizeFoundItemPrivacy({ type: 'found', title: '未命名物品', sensitivityLevel: 'sensitive' });
  assert.equal(item.sensitivityLevel, 'sensitive');
  assert.equal(isProtectedFoundItem(item), true);
});
