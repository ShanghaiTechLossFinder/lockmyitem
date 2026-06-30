const { CATEGORIES } = require('../../utils/constants');
const { createItem, searchLocations, classifyByText, findPotentialMatches } = require('../../utils/store');
const { nearestCampusLocation, nearestCampusLocations } = require('../../utils/locations');

function initialForm() {
  return {
    type: 'found',
    title: '',
    description: '',
    category: '',
    aiTags: [],
    imageUrls: [],
    locationId: '',
    locationDetail: ''
  };
}

Page({
  data: {
    categories: CATEGORIES,
    locationKeyword: '',
    locations: searchLocations(),
    locationCandidates: [],
    locating: false,
    locationTip: '正在定位到上科大校内地点...',
    potentialMatches: [],
    form: initialForm()
  },

  onLoad(options) {
    const nextForm = initialForm();
    if (options.type) nextForm.type = options.type;
    if (options.image) {
      nextForm.imageUrls = [decodeURIComponent(options.image)];
      nextForm.category = '其他';
      nextForm.aiTags = ['图片自动识别'];
    }
    this.setData({ form: nextForm }, () => this.detectCampusLocation());
  },

  setType(event) {
    this.setData({ 'form.type': event.currentTarget.dataset.type }, () => this.refreshPotentialMatches());
  },

  setCategory(event) {
    this.setData({
      'form.category': event.currentTarget.dataset.category,
      'form.aiTags': ['手动校正']
    }, () => this.refreshPotentialMatches());
  },

  clearCategory() {
    this.setData({
      'form.category': '',
      'form.aiTags': [],
      potentialMatches: []
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
    if (field === 'title' || field === 'description') {
      const result = classifyByText(`${this.data.form.title} ${this.data.form.description}`);
      if (result.confidence > 0 || event.detail.value.trim()) {
        this.setData({
          'form.category': result.category,
          'form.aiTags': result.aiTags
        }, () => this.refreshPotentialMatches());
      }
    }
  },

  detectCampusLocation() {
    this.setData({ locating: true, locationTip: '正在定位到上科大校内地点...' });
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res) => {
        const candidates = nearestCampusLocations(res, 3);
        const nearest = candidates[0];
        this.setData({ locationCandidates: candidates });
        this.setLocation(nearest, `已按当前位置匹配到 ${nearest.name}，可在下方切换候选地点`);
      },
      fail: () => {
        const nearest = nearestCampusLocation();
        this.setData({ locationCandidates: [nearest] });
        this.setLocation(nearest, `未获得定位权限，已默认填充 ${nearest.name}`);
      },
      complete: () => {
        this.setData({ locating: false });
      }
    });
  },

  setLocation(location, tip) {
    this.setData({
      'form.locationId': location._id,
      locationKeyword: location.name,
      locations: searchLocations(location.name),
      locationTip: tip
    }, () => this.refreshPotentialMatches());
  },

  searchLocation(event) {
    const keyword = event.detail.value;
    this.setData({
      locationKeyword: keyword,
      locations: searchLocations(keyword),
      locationCandidates: []
    });
  },

  selectLocation(event) {
    const location = searchLocations().find((entry) => entry._id === event.currentTarget.dataset.id);
    if (!location) return;
    this.setLocation(location, `已选择 ${location.name}`);
  },

  clearLocation() {
    this.setData({
      'form.locationId': '',
      locationKeyword: '',
      locationTip: '可重新定位或手动选择上科大校内地点',
      locationCandidates: [],
      locations: searchLocations()
    });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        this.setData({
          'form.imageUrls': [file.tempFilePath],
          'form.category': this.data.form.category || '其他',
          'form.aiTags': this.data.form.aiTags.length ? this.data.form.aiTags : ['图片自动识别']
        }, () => this.refreshPotentialMatches());
        wx.showToast({ title: '图片已选择', icon: 'success' });
      }
    });
  },

  refreshPotentialMatches() {
    if (this.data.form.type !== 'lost') {
      this.setData({ potentialMatches: [] });
      return;
    }
    this.setData({
      potentialMatches: findPotentialMatches(this.data.form)
    });
  },

  goMatchDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },

  submit() {
    if (!this.data.form.imageUrls.length && !this.data.form.category) {
      wx.showToast({ title: '请上传图片或选择分类', icon: 'none' });
      return;
    }
    const item = createItem(this.data.form);
    wx.showToast({ title: '发布成功', icon: 'success' });
    this.setData({
      form: initialForm(),
      locationKeyword: '',
      locations: searchLocations()
    });
    wx.navigateTo({ url: `/pages/detail/detail?id=${item._id}` });
  }
});
