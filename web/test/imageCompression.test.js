import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCATION_IMAGE_LONG_EDGE,
  LOCATION_IMAGE_QUALITY,
  MAIN_IMAGE_LONG_EDGE,
  MAIN_IMAGE_QUALITY
} from '../src/imageCompression.js';

test('image compression keeps the pre-QQ recognition quality strategy', () => {
  assert.equal(MAIN_IMAGE_LONG_EDGE, 960);
  assert.equal(MAIN_IMAGE_QUALITY, 0.72);
  assert.equal(LOCATION_IMAGE_LONG_EDGE, 960);
  assert.equal(LOCATION_IMAGE_QUALITY, 0.78);
});
