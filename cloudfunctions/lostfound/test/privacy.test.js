'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isProtectedFoundItem,
  isSensitiveFoundItem,
  normalizePrivacySearchInput,
  privacyDocumentTypeForItem,
  privacySearchDescription,
  sanitizeFoundItemPrivacy,
  validatePrivacySearchInput
} = require('../privacy');

for (const sample of [
  { category: '校园卡', title: '蓝色校园卡' },
  { category: '证件', title: '身份证' },
  { category: '其他', title: '上海银行卡' }
]) {
  test(`found card or document is image-protected: ${sample.title}`, () => {
    const item = sanitizeFoundItemPrivacy({ ...sample, type: 'found' });
    assert.equal(item.sensitivityLevel, 'sensitive');
    assert.equal(isProtectedFoundItem(item), true);
  });
}

for (const sample of [
  { category: '电子产品', title: '白色 AirPods' },
  { category: '电子产品', title: '手机' },
  { category: '电子产品', title: '黑色无线鼠标' },
  { category: '电子产品', title: '无线耳机盒' },
  { category: '钥匙', title: '宿舍钥匙' },
  { category: '其他', title: '黑色钱包' },
  { category: '电子产品', title: '旧重要耳机', sensitivityLevel: 'important', sensitivityReasons: ['贵重物品'] }
]) {
  test(`important valuables are image-protected: ${sample.title}`, () => {
    const item = sanitizeFoundItemPrivacy({ ...sample, type: 'found' });
    assert.equal(item.sensitivityLevel, 'important');
    assert.equal(isProtectedFoundItem(item), true);
  });
}

test('lost posts are not image-protected', () => {
  assert.equal(isProtectedFoundItem({ type: 'lost', category: '电子产品', title: '手机' }), false);
});

test('explicit sensitive classification is preserved', () => {
  const elevated = sanitizeFoundItemPrivacy({ type: 'found', title: '物品', sensitivityLevel: 'sensitive' });
  assert.equal(elevated.sensitivityLevel, 'sensitive');
  const matched = sanitizeFoundItemPrivacy({ type: 'found', title: '银行卡', sensitivityLevel: 'normal' });
  assert.equal(matched.sensitivityLevel, 'sensitive');
});

test('unified privacy search uses minimal type-specific fields', () => {
  const bank = normalizePrivacySearchInput({
    documentType: 'bank_card',
    name: ' 张三 ',
    identifierSuffix: ' 12-34 ',
    organization: ' 上海银行 '
  });
  assert.deepEqual(bank, {
    documentType: 'bank_card',
    name: '张三',
    identifierSuffix: '1234',
    organization: '上海银行',
    documentLabel: ''
  });
  assert.equal(validatePrivacySearchInput(bank), '');
  assert.match(privacySearchDescription(bank), /卡号后四位：1234/);
  assert.doesNotMatch(privacySearchDescription(bank), /完整|有效期|安全码/);
});

test('unified privacy search rejects incomplete or excessive identifiers', () => {
  assert.equal(
    validatePrivacySearchInput({ documentType: 'national_id', name: '张三', identifierSuffix: '12' }),
    '请填写证件号码后 4 位'
  );
  const normalized = normalizePrivacySearchInput({
    documentType: 'national_id',
    name: '张三',
    identifierSuffix: '310101199901011234'
  });
  assert.equal(normalized.identifierSuffix, '310101199901011234');
  assert.equal(validatePrivacySearchInput(normalized), '请填写证件号码后 4 位');
});

test('privacy item type routing distinguishes sensitive documents from important objects', () => {
  assert.equal(privacyDocumentTypeForItem({ title: '校园一卡通' }), 'campus_card');
  assert.equal(privacyDocumentTypeForItem({ title: '居民身份证' }), 'national_id');
  assert.equal(privacyDocumentTypeForItem({ title: '上海银行卡' }), 'bank_card');
  assert.equal(privacyDocumentTypeForItem({ title: '护照' }), 'other_document');
  assert.equal(isSensitiveFoundItem({ type: 'found', title: '护照' }), true);
  assert.equal(isSensitiveFoundItem({ type: 'found', title: '手机', sensitivityLevel: 'important' }), false);
});
