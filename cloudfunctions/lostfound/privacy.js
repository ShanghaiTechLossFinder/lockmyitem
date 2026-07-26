const SENSITIVE_CATEGORIES = ['证件', '校园卡'];
const IMPORTANT_CATEGORIES = ['电子产品', '钥匙'];
const PRIVACY_DOCUMENT_TYPE_VALUES = new Set([
  'campus_card',
  'national_id',
  'bank_card',
  'other_document'
]);

const SENSITIVE_WORDS = [
  '身份证',
  '护照',
  '银行卡',
  '信用卡',
  '借记卡',
  '医保卡',
  '社保卡',
  '驾驶证',
  '证件',
  '学生证',
  '工作证',
  '工卡',
  '校园卡',
  '一卡通',
  '饭卡',
  '门禁卡'
];

const IMPORTANT_WORDS = [
  '钱包',
  '手机',
  '耳机',
  'airpods',
  '平板',
  '电脑',
  '相机',
  '手表',
  '钥匙',
  '门禁卡',
  '车钥匙'
];

const PROTECTED_VISUAL_WORDS = [
  '银行卡',
  '信用卡',
  '借记卡',
  '医保卡',
  '社保卡',
  '证件',
  '储蓄卡',
  '身份证',
  '护照',
  '驾驶证',
  '学生证',
  '工作证',
  '工卡',
  '校园卡',
  '一卡通',
  '饭卡',
  '门禁卡',
  ...IMPORTANT_WORDS
];
const SENSITIVE_PLACEHOLDER_LABEL_PATTERN = '(?:身份证号|手机号|证件号|编号|姓名|卡号)';
const LEGACY_PLACEHOLDER_SUFFIX = [0x5df2, 0x9690, 0x85cf].map((code) => String.fromCharCode(code)).join('');
const LEGACY_BRACKETED_PLACEHOLDER_PATTERN = new RegExp(`\\s*[\\[【(（]\\s*${SENSITIVE_PLACEHOLDER_LABEL_PATTERN}${LEGACY_PLACEHOLDER_SUFFIX}\\s*[\\]】)）]`, 'g');
const LEGACY_BARE_PLACEHOLDER_PATTERN = new RegExp(`\\s*${SENSITIVE_PLACEHOLDER_LABEL_PATTERN}${LEGACY_PLACEHOLDER_SUFFIX}`, 'g');
const SENSITIVE_REASON_PATTERN = new RegExp('\\u9690\\u85cf|敏感|身份证号|手机号|编号|姓名|卡号');

function unique(values = []) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function sourceText(item = {}) {
  return [
    item.title,
    item.description,
    item.visualDescription,
    item.category,
    ...(item.tags || []),
    ...(item.aiTags || []),
    ...(item.semanticTags || []),
    ...(item.yoloObjects || [])
  ].filter(Boolean).join(' ');
}

function isFoundItem(item = {}) {
  return (item.type || item.itemType) === 'found';
}

function replaceSensitivePattern(text, pattern, replacement, reason, reasons) {
  let changed = false;
  const nextText = String(text || '').replace(pattern, (...args) => {
    changed = true;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (changed) reasons.push(reason);
  return nextText;
}

function cleanupMaskedText(value = '') {
  return String(value || '')
    .replace(/\s+([，。！？；：、,.!?;:])/g, '$1')
    .replace(/([，。！？；：、,.!?;:])\s+/g, '$1')
    .replace(/[、,，;；:：]{2,}/g, '，')
    .replace(/[、,，;；:：]+([。.!！?？])/g, '$1')
    .replace(/^[\s,，;；:：、]+|[\s,，;；:：、]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function maskSensitiveText(value = '', options = {}) {
  const reasons = [];
  let text = String(value || '');
  const maskNames = options.maskNames !== false;

  text = replaceSensitivePattern(
    text,
    LEGACY_BRACKETED_PLACEHOLDER_PATTERN,
    '',
    '敏感信息',
    reasons
  );
  text = replaceSensitivePattern(
    text,
    LEGACY_BARE_PLACEHOLDER_PATTERN,
    '',
    '敏感信息',
    reasons
  );
  text = replaceSensitivePattern(
    text,
    /\b\d{6}(?:18|19|20)?\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
    '',
    '身份证号',
    reasons
  );
  text = replaceSensitivePattern(
    text,
    /(^|[^\d])1[3-9]\d{9}(?=$|[^\d])/g,
    (match, prefix) => prefix,
    '手机号',
    reasons
  );
  text = replaceSensitivePattern(
    text,
    /((?:身份证|学生证|工作证|工卡|校园卡|一卡通|饭卡|银行卡|信用卡|借记卡|护照|证件|卡)(?:号|号码|编号)?|工号|学号|证号)\s*(?:[:：#]|为|是)?\s*[A-Za-z0-9-]{6,24}/g,
    (match, label) => label,
    '编号',
    reasons
  );
  if (maskNames) {
    text = replaceSensitivePattern(
      text,
      /((?:持卡人|姓名|名字|姓名信息))\s*(?:[:：#]|为|是)?\s*(?!线索|字段|匹配|未见|一致|不一致|已处理)[\u4e00-\u9fa5]{2,4}/g,
      (match, label) => label,
      '姓名',
      reasons
    );
  }
  text = replaceSensitivePattern(
    text,
    /(?:\d[\s-]?){12,19}/g,
    '',
    '卡号',
    reasons
  );
  text = cleanupMaskedText(text);

  return {
    text,
    changed: text !== String(value || ''),
    reasons: unique(reasons)
  };
}

function hasSensitiveWord(text = '') {
  return SENSITIVE_WORDS.some((word) => text.includes(word));
}

function privacyDocumentTypeForItem(item = {}) {
  const text = sourceText(item).toLowerCase();
  if (/银行卡|信用卡|借记卡|储蓄卡|bank\s*card/.test(text)) return 'bank_card';
  if (/身份证|居民身份证|national\s*id/.test(text)) return 'national_id';
  if (/校园卡|一卡通|饭卡|学生证|工作证|工卡|门禁卡|campus\s*card/.test(text)) return 'campus_card';
  return 'other_document';
}

function hasProtectedVisualSurface(item = {}) {
  if (!isFoundItem(item)) return false;
  const text = sourceText(item);
  return PROTECTED_VISUAL_WORDS.some((word) => text.includes(word));
}

function sensitivityForItem(item = {}, maskReasons = []) {
  const text = sourceText(item);
  const normalizedText = text.toLowerCase();
  const reasons = [];
  const category = String(item.category || '').trim();
  const persistedLevel = String(item.sensitivityLevel || '').trim().toLowerCase();

  if (SENSITIVE_CATEGORIES.includes(category)) reasons.push(category);
  if (hasSensitiveWord(text) || persistedLevel === 'sensitive') reasons.push('重要证件或门禁物品');
  reasons.push(...maskReasons);
  if (reasons.length) {
    return { level: 'sensitive', reasons: unique(reasons) };
  }

  if (persistedLevel === 'important' || IMPORTANT_CATEGORIES.includes(category) || IMPORTANT_WORDS.some((word) => normalizedText.includes(word))) {
    return { level: 'important', reasons: ['贵重物品'] };
  }

  return { level: 'normal', reasons: [] };
}

function sanitizeFoundItemPrivacy(item = {}) {
  if (!isFoundItem(item)) return item;

  const title = maskSensitiveText(item.title);
  const description = maskSensitiveText(item.description);
  const visualDescription = maskSensitiveText(item.visualDescription);
  const persistedMaskReasons = (item.sensitivityReasons || []).filter((reason) => SENSITIVE_REASON_PATTERN.test(String(reason || '')));
  const maskReasons = unique([...title.reasons, ...description.reasons, ...visualDescription.reasons, ...persistedMaskReasons]);
  const sensitivity = sensitivityForItem(item, maskReasons);

  return {
    ...item,
    title: title.text,
    description: description.text,
    visualDescription: visualDescription.text,
    sensitivityLevel: sensitivity.level,
    sensitivityReasons: sensitivity.reasons
  };
}

function isProtectedFoundItem(item = {}) {
  if (!isFoundItem(item)) return false;
  const level = String(item.sensitivityLevel || '').trim().toLowerCase();
  return level === 'sensitive' || level === 'important' || hasProtectedVisualSurface(item);
}

function isSensitiveFoundItem(item = {}) {
  if (!isFoundItem(item)) return false;
  const level = String(item.sensitivityLevel || '').trim().toLowerCase();
  return level === 'sensitive'
    || SENSITIVE_CATEGORIES.includes(String(item.category || '').trim())
    || hasSensitiveWord(sourceText(item));
}

function cleanPrivacySearchValue(value = '', maxLength = 40) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePrivacySearchInput(value = {}) {
  const documentType = PRIVACY_DOCUMENT_TYPE_VALUES.has(value.documentType)
    ? value.documentType
    : '';
  return {
    documentType,
    name: cleanPrivacySearchValue(value.name, 30),
    identifierSuffix: cleanPrivacySearchValue(value.identifierSuffix, 32)
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase(),
    organization: cleanPrivacySearchValue(value.organization, 40),
    documentLabel: cleanPrivacySearchValue(value.documentLabel, 30)
  };
}

function validatePrivacySearchInput(value = {}) {
  const input = normalizePrivacySearchInput(value);
  if (!input.documentType) return '请选择证件类型';
  if (input.name.length < 2) return '请填写证件上的姓名';
  if (!/^[A-Za-z0-9]{4}$/.test(input.identifierSuffix)) {
    return '请填写证件号码后 4 位';
  }
  if (input.documentType === 'bank_card' && input.organization.length < 2) {
    return '请填写发卡银行名称';
  }
  if (input.documentType === 'other_document' && input.documentLabel.length < 2) {
    return '请填写证件名称';
  }
  return '';
}

function privacySearchDescription(value = {}) {
  const input = normalizePrivacySearchInput(value);
  const typeLabel = {
    campus_card: '校园卡或学生证',
    national_id: '身份证',
    bank_card: '银行卡',
    other_document: input.documentLabel || '其他证件'
  }[input.documentType] || '证件';
  const numberLabel = {
    campus_card: '学号后四位',
    national_id: '身份证号后四位',
    bank_card: '卡号后四位',
    other_document: '证件号后四位'
  }[input.documentType] || '编号后四位';
  return [
    `证件类型：${typeLabel}`,
    `姓名：${input.name}`,
    input.organization ? `发卡机构：${input.organization}` : '',
    `${numberLabel}：${input.identifierSuffix}`
  ].filter(Boolean).join('；');
}

function privacyPromptLines(itemType = '') {
  if (itemType !== 'found') return [];
  return [
    '这是招领帖，请保护失主隐私。',
    '不要输出完整卡号、身份证号、手机号、工号、学号、护照号或其他证件唯一编号。',
    '如果图片或用户描述中出现这些编号，只描述为证件、卡片类别或身份信息。',
    '不要抄录二维码、条码、证件上的完整姓名或唯一识别信息，也不要输出括号形式的脱敏说明。'
  ];
}

module.exports = {
  isSensitiveFoundItem,
  isProtectedFoundItem,
  maskSensitiveText,
  normalizePrivacySearchInput,
  privacyDocumentTypeForItem,
  privacySearchDescription,
  sanitizeFoundItemPrivacy,
  privacyPromptLines,
  validatePrivacySearchInput
};
