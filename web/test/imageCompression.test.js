import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dataUrlByteLength,
  LOCATION_IMAGE_MAX_DATA_URL_BYTES,
  MAIN_IMAGE_MAX_DATA_URL_BYTES
} from '../src/imageCompression.js';

test('image upload limits keep publish payloads bounded', () => {
  assert.equal(MAIN_IMAGE_MAX_DATA_URL_BYTES, 1_200_000);
  assert.equal(LOCATION_IMAGE_MAX_DATA_URL_BYTES, 180_000);
  assert.equal(dataUrlByteLength('data:image/jpeg;base64,abc'), 26);
});
