import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { campusMapMeta, locationAliases, locations } from '../data.js';
import { compressLocationImageFile } from '../imageCompression.js';
import { sanitizeFoundItemPrivacy } from '../privacy.js';
import { classifyByText, findPotentialMatches, getLocation } from '../utils.js';
import { recognizeImageFile } from '../vision.js';
import CategoryBar from '../components/CategoryBar.jsx';
import SensitivityBadge from '../components/SensitivityBadge.jsx';

const LazyCampusLocationMap = lazy(() => import('../components/CampusLocationMap.jsx'));
const LOCATION_DETAIL_HINT = '可补充入口、楼层、靠窗/靠路侧、附近标志物等细节。';

function locationImageHint(location) {
  return [
    `${location?.name || ''} ${location?.area || ''}`.trim(),
    '这是失物招领发布页的方位补充图片。',
    '请只描述图片中可帮助定位的空间线索，例如入口、楼层、门牌、靠窗/靠路侧、桌椅、楼梯、电梯、附近标志物。',
    '不要重复地点名称和地点区域，用一句简体中文概括。'
  ].filter(Boolean).join(' ');
}

function locationDetailFromRecognition(data = {}, location) {
  const source = [
    data.visualDescription,
    data.description,
    data.caption,
    data.title,
    ...(data.tags || []),
    ...(data.semanticTags || [])
  ].filter(Boolean).join('，').trim();
  if (!source) return '';

  const prefixes = [
    `${location.name}，${location.area}；`,
    `${location.name}，${location.area}。`,
    `${location.name}，${location.area}`,
    `${location.name}，`,
    `${location.name}；`,
    `${location.name}。`,
    location.name
  ].filter(Boolean);

  const matchedPrefix = prefixes.find((prefix) => source.startsWith(prefix));
  const text = (matchedPrefix ? source.slice(matchedPrefix.length) : source)
    .replace(/^(图片中|画面中|图中|这是一张|这张图片显示|图片显示|可以看到)/, '')
    .replace(/^[，,；;。、\s]+/, '')
    .trim();
  if (!text || ['其他', '待识别物品', '待确认'].includes(text)) return '';
  return /[。.!！?？]$/.test(text) ? text : `${text}。`;
}

function knownLocationById(locationId) {
  const id = String(locationId || '').trim();
  if (!id) return null;
  const resolvedId = locationAliases[id] || id;
  return locations.find((location) => location.id === resolvedId) || null;
}

function locationText(item = {}) {
  const known = knownLocationById(item.locationId);
  if (known) return known.name;
  return String(item.locationName || '').trim();
}

function RecognitionPanel({ classifying, stage, extractedText, error }) {
  const steps = stage === 'error'
    ? [{ key: 'error', text: '图片识别失败，可手动填写或重新上传', status: 'error' }]
    : [
      {
        key: 'recognize',
        text: '正在识别物品特征',
        status: classifying || stage === 'recognizing' ? 'active' : 'done'
      },
      {
        key: 'extract',
        text: extractedText ? `已提取：${extractedText}` : '等待提取颜色、类别和细节',
        status: extractedText ? 'done' : 'pending'
      }
    ];

  return (
    <div className="recognition-panel">
      <div className="ai-process-head">
        <span>识别建议</span>
        <span>{classifying ? '处理中' : stage === 'error' ? '需手动确认' : '已更新'}</span>
      </div>
      {steps.map((step) => (
        <div key={step.key} className={`ai-process-step ${step.status}`}>
          <span className="ai-step-dot" />
          <span className="ai-step-text">{step.text}</span>
        </div>
      ))}
      {error && <p className={stage === 'error' ? 'model-error' : 'model-warning'}>{error}</p>}
    </div>
  );
}

function extractedText(data = {}) {
  return [data.category, ...(data.tags || [])]
    .filter((entry) => entry && !['其他', '待确认'].includes(entry))
    .slice(0, 4)
    .join('、') || '物品特征待确认';
}

function suggestedTitle(data = {}) {
  if (data.title || data.name) return data.title || data.name;

  const tags = [
    ...(data.colors || []),
    ...(data.tags || []),
    ...(data.semanticTags || []),
    ...(data.yoloObjects || []),
    data.category
  ].filter(Boolean);
  const uniqueTags = Array.from(new Set(tags.map((entry) => String(entry).trim()).filter(Boolean)));
  const title = uniqueTags
    .filter((entry) => !['其他', '待确认'].includes(entry))
    .slice(0, 3)
    .join('');
  return title || data.category || '';
}

export default function PublishPage({ initialType, initialDraft, items, currentUser, onCancel, onSubmit, onOpenMatch }) {
  const [form, setForm] = useState(() => ({
    type: initialDraft?.type || initialType,
    title: initialDraft?.title || '',
    description: initialDraft?.description || '',
    category: initialDraft?.category || '',
    tags: [...(initialDraft?.tags || [])],
    visualDescription: initialDraft?.visualDescription || '',
    locationId: initialDraft?.locationId || '',
    locationDetail: initialDraft?.locationDetail || '',
    locationImages: [...(initialDraft?.locationImages || [])],
    image: initialDraft?.image || '',
    ownerName: currentUser?.nickName || initialDraft?.ownerName || '网页用户'
  }));
  const [classifying, setClassifying] = useState(false);
  const [modelError, setModelError] = useState('');
  const [aiProcessStage, setAiProcessStage] = useState('idle');
  const [aiExtractedText, setAiExtractedText] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationImageStatus, setLocationImageStatus] = useState('');
  const [locationImageMessage, setLocationImageMessage] = useState('');
  const [privacyNotice, setPrivacyNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const classification = classifyByText(`${form.title} ${form.description}`);
    if (!form.image && (!form.category || classification.confidence > 0)) {
      setForm((current) => ({
        ...current,
        category: classification.category,
        tags: classification.tags
      }));
    }
  }, [form.title, form.description]);

  useEffect(() => {
    if (!form.image || form.title) return;
    const nextTitle = suggestedTitle(form);
    if (!nextTitle) return;
    setForm((current) => (current.title ? current : { ...current, title: nextTitle }));
  }, [form.image, form.title, form.category, form.visualDescription, form.tags]);

  const matches = useMemo(() => findPotentialMatches(form, items), [form, items]);
  const selectedLocation = form.locationId ? getLocation(form.locationId) : null;
  const hasSelectedLocation = Boolean(selectedLocation);
  const locationOptions = useMemo(() => {
    const query = locationQuery.trim().toLowerCase();
    const selected = form.locationId ? getLocation(form.locationId) : null;
    const filtered = query
      ? locations.filter((location) => (
        [location.name, location.area, location.category, location.guide, location.searchableText]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      ))
      : locations;

    if (!selected || filtered.some((location) => location.id === selected.id)) return filtered;
    return [selected, ...filtered];
  }, [form.locationId, locationQuery]);

  function update(field, value) {
    if (['title', 'description', 'type'].includes(field)) setPrivacyNotice('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectLocation(locationId) {
    setForm((current) => ({
      ...current,
      locationId,
      locationDetail: current.locationId === locationId
        ? current.locationDetail
        : ''
    }));
  }

  function recognitionHint(nextForm = form) {
    return [nextForm.title, nextForm.description, nextForm.category, ...(nextForm.tags || [])].join(' ').trim();
  }

  async function chooseImage(file) {
    if (!file) return;
    setClassifying(true);
    setModelError('');
    setAiProcessStage('recognizing');
    setAiExtractedText('');
    try {
      const result = await recognizeImageFile(file, recognitionHint(), { itemType: form.type });
      const data = result.data || {};
      const nextExtractedText = extractedText(data);
      const nextTitle = suggestedTitle(data);
      setForm((current) => ({
        ...current,
        image: result.image,
        title: current.title || nextTitle,
        description: current.description || data.description || data.visualDescription || '',
        category: data.category || current.category || '其他',
        tags: data.tags || [],
        visualDescription: data.visualDescription || data.description || ''
      }));
      setAiExtractedText(nextExtractedText);
      setAiProcessStage('done');
      if (form.type === 'found' && data.sensitivityLevel === 'sensitive') {
        setPrivacyNotice('识别结果中的敏感信息已自动处理');
      }
      if (result.warning) setModelError(result.warning);
    } catch (error) {
      setModelError(`图片识别失败：${error.message || '请手动填写或重新上传'}`);
      setAiProcessStage('error');
    } finally {
      setClassifying(false);
    }
  }

  async function addLocationImages(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type?.startsWith('image/'));
    if (!files.length) return;
    if (!selectedLocation) {
      setLocationImageStatus('error');
      setLocationImageMessage('请先选择地点，再添加方位图片');
      return;
    }
    setLocationImageStatus('loading');
    setLocationImageMessage('正在根据方位图片生成方位描述');
    try {
      const images = await Promise.all(files.slice(0, 6).map(compressLocationImageFile));
      setForm((current) => ({
        ...current,
        locationImages: [...(current.locationImages || []), ...images].slice(0, 6)
      }));
    } catch (error) {
      setLocationImageStatus('error');
      setLocationImageMessage(error?.message || '方位图片读取失败，请重新选择图片');
      return;
    }

    try {
      const result = await recognizeImageFile(files[0], locationImageHint(selectedLocation), { purpose: 'locationDetail' });
      const detail = locationDetailFromRecognition(result.data || {}, selectedLocation);
      if (!detail) throw new Error('没有识别到可用于定位的空间线索');
      const shouldFillDetail = !form.locationDetail.trim();
      setForm((current) => ({
        ...current,
        locationDetail: current.locationDetail.trim() ? current.locationDetail : detail
      }));
      setLocationImageStatus('done');
      setLocationImageMessage(shouldFillDetail ? '已根据方位图片生成方位描述' : '已识别方位图片；保留你已填写的方位描述');
    } catch (error) {
      setLocationImageStatus('error');
      setLocationImageMessage(`方位图片识别失败：${error.message || '可手动填写具体方位'}`);
    }
  }

  function removeLocationImage(index) {
    setForm((current) => ({
      ...current,
      locationImages: (current.locationImages || []).filter((_, imageIndex) => imageIndex !== index)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting || !hasSelectedLocation) return;
    const safeForm = sanitizeFoundItemPrivacy(form);
    const masked = safeForm.type === 'found' && (
      safeForm.title !== form.title
      || safeForm.description !== form.description
      || safeForm.visualDescription !== form.visualDescription
    );
    if (masked) {
      setForm(safeForm);
      setPrivacyNotice('已自动处理个人敏感信息');
    }
    setSubmitting(true);
    try {
      await onSubmit(safeForm);
    } catch (error) {
      setModelError(error?.message || '发布失败，请稍后重试');
      setAiProcessStage('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page publish-page">
      <div className="publish-hero">
        <button className="publish-back-button" type="button" onClick={onCancel} disabled={submitting} aria-label="返回上一页">
          <ChevronLeft size={17} strokeWidth={2.4} aria-hidden="true" />
          <span>返回</span>
        </button>
        <div className="hero-copy">
          <span className="surface-eyebrow">{form.type === 'lost' ? '寻物登记' : '招领登记'}</span>
          <h1 className="surface-title">{form.type === 'lost' ? '先把线索留下' : '捡到物品，先贴到公告栏'}</h1>
          <p className="surface-subtitle">
            {form.type === 'lost'
              ? '描述物品和最后出现的位置，方便同学帮你留意。'
              : '照片可以后补；地点和分类越具体，越容易找到主人。'}
          </p>
        </div>
        <div className="hero-pin" aria-hidden="true">
          <span className="hero-pin-plus">+</span>
          <span>发布</span>
        </div>
      </div>

      <form className="publish-card" onSubmit={submit}>
        <div className="segmented" aria-label="发布类型">
          <button type="button" className={form.type === 'found' ? 'active' : ''} onClick={() => update('type', 'found')}>我捡到了</button>
          <button type="button" className={form.type === 'lost' ? 'active' : ''} onClick={() => update('type', 'lost')}>我丢了</button>
        </div>

        <label className="image-picker">
          {form.image ? (
            <img src={form.image} alt="" />
          ) : (
            <span className="image-empty">
              <span className="image-plus">+</span>
              <span className="image-title">拍照或从相册选择</span>
              <span className="image-hint">没有照片也可以先发布</span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              chooseImage(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>

        {(classifying || modelError) && (
          <RecognitionPanel
            classifying={classifying}
            stage={aiProcessStage}
            extractedText={aiExtractedText}
            error={modelError}
          />
        )}

        <div className="form-section">
          <span className="section-kicker">物品信息</span>
          <input className="field" placeholder="物品标题，可不填" value={form.title} onChange={(event) => update('title', event.target.value)} />
          <textarea className="field textarea" placeholder="补充描述，可不填" value={form.description} onChange={(event) => update('description', event.target.value)} />
          {privacyNotice && <div className="privacy-notice">{privacyNotice}</div>}
        </div>

        <div className="form-section">
          <div className="section-head publish-section-head">
            <span className="section-kicker">物品分类</span>
            <span className="section-note">可自动识别，也可手动改</span>
          </div>
          {form.category && (
            <div className="ai-result">
              <span>当前分类：{form.category}</span>
              <button type="button" onClick={() => update('category', '')}>清除</button>
            </div>
          )}
          <CategoryBar
            value={form.category}
            onChange={(entry) => update('category', entry)}
            hideAll
            tone="found"
          />
        </div>

        <div className="form-section">
          <div className="section-head publish-section-head">
            <span className="section-kicker">地点</span>
            <span className="section-note">官方地图建筑 {campusMapMeta.buildingCount} 处，地点 {campusMapMeta.serviceCount} 处</span>
          </div>
          <div className="location-panel ok">
            <div className="location-head">
              <div>
                <strong className="location-title">{selectedLocation?.name || '请选择'}</strong>
                <span className="location-subtitle">{selectedLocation?.area || '选择发现或丢失的大致校内地点'}</span>
              </div>
            </div>
            <input
              className="field location-search-field"
              placeholder="搜索建筑、食堂、服务点"
              value={locationQuery}
              onChange={(event) => setLocationQuery(event.target.value)}
            />
            <select className="field select-field" value={form.locationId} onChange={(event) => selectLocation(event.target.value)}>
              <option value="">请选择</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
            <Suspense fallback={<div className="campus-map-shell campus-map-loading" role="status">地图加载中</div>}>
              <LazyCampusLocationMap selectedId={form.locationId} onSelect={selectLocation} />
            </Suspense>
            <div className="location-confirm">
              <div className="location-confirm-row">
                <span>已选择：</span>
                <strong>{selectedLocation?.name || '请选择'}</strong>
              </div>
              <div className="location-confirm-row">
                <span>地点区域：</span>
                <strong>{selectedLocation?.area || '选择后自动填充'}</strong>
              </div>
            </div>
            <div className="location-detail-wrap">
              <textarea
                className="field textarea location-detail-field"
                aria-label="补充具体方位"
                value={form.locationDetail}
                onChange={(event) => update('locationDetail', event.target.value)}
              />
              {!form.locationDetail.trim() && (
                <span className="location-detail-placeholder">{LOCATION_DETAIL_HINT}</span>
              )}
            </div>
            <div className="location-image-section">
              {(form.locationImages || []).length > 0 && (
                <div className="location-image-grid">
                  {form.locationImages.map((image, index) => (
                    <span className="location-image-thumb" key={`${image}-${index}`}>
                      <img src={image} alt="" />
                      <button type="button" aria-label="删除方位图片" onClick={() => removeLocationImage(index)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <label className="location-image-add">
                <span className="location-image-add-mark">+</span>
                <span>添加方位图片</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    addLocationImages(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>
              {locationImageMessage && (
                <p className={`location-image-status ${locationImageStatus}`}>{locationImageMessage}</p>
              )}
            </div>
          </div>
        </div>

        {form.type === 'lost' && matches.length > 0 && (
          <div className="match-panel">
            <h2 className="match-title">可能是这几件</h2>
            {matches.map((item) => (
              <div key={item.id} className="match-item">
                <div>
                  <strong className="match-name">{item.title}</strong>
                  <SensitivityBadge item={item} />
                  <span className="match-meta">{locationText(item)} · 相似度 {item.similarity}%</span>
                  <span className="match-reason">{item.reasons.join('、')}</span>
                </div>
                <button className="match-pill" type="button" onClick={() => onOpenMatch(item.id, form)}>查看</button>
              </div>
            ))}
          </div>
        )}

        <div className="publish-actions">
          <button className="button-secondary" type="button" onClick={onCancel} disabled={submitting}>取消</button>
          <button className="button-primary submit" type="submit" disabled={submitting || !hasSelectedLocation}>{submitting ? '发布中' : '发布'}</button>
        </div>
      </form>
    </section>
  );
}
