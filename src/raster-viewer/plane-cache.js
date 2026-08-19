/**
 * Dataset-scoped cache for decoded, display-oriented channel planes.
 *
 * Entries intentionally remain for the lifetime of one loaded dataset because
 * the viewer targets in-memory scientific datasets that fit browser memory.
 * `RasterViewer.load()` calls `clear()` before every dataset replacement, which
 * aborts in-flight fetches and makes the prior dataset collectible.
 *
 * This CloudScope Web copy loads source-YX samples through an injected
 * `loadSourcePlane` callback (zarrita) instead of Python `data_url` HTTP.
 * The cache still applies the viewer's transpose-only display transform.
 */

import {transposePlane} from './orientation.js';

export class PlaneCache {
  /**
   * Create one cache whose lifetime matches one loaded descriptor.
   *
   * @param {object} descriptor Active versioned raster descriptor.
   * @param {Function|null} [onMetric=null] Optional completed-fetch metric callback.
   * @param {Function} loadSourcePlane Async source-YX plane loader.
   */
  constructor(descriptor, onMetric, loadSourcePlane) {
    if (typeof loadSourcePlane !== 'function') {
      throw new Error('PlaneCache requires loadSourcePlane');
    }
    this.descriptor = descriptor;
    this.onMetric = onMetric ?? null;
    this.loadSourcePlane = loadSourcePlane;
    this.entries = new Map();
    this.controller = new AbortController();
  }

  /** Return the dataset-local identity for one decoded plane or projection. */
  key(channelId, selection = {}) {
    return `${channelId}|t:${selection.t_index ?? 'plane'}|z:${selection.z_index ?? 'plane'}|r:${selection.plus_minus_z ?? 0}`;
  }

  /** Return one shared pending or completed decoded plane promise. */
  get(channel, selection = {}) {
    const key = this.key(channel.id, selection);
    if (!this.entries.has(key)) {
      const pending = this.fetch(channel, selection)
        .catch(error => {
          this.entries.delete(key);
          throw error;
        });
      this.entries.set(key, pending);
    }
    return this.entries.get(key);
  }

  /** Return whether a matching request or plane is already cached. */
  has(channel, selection = {}) {
    return this.entries.has(this.key(channel.id, selection));
  }

  /**
   * Load one source-YX plane, validate sample count, and transpose for display.
   *
   * @param {object} channel Channel resource from the active descriptor.
   * @param {object} [selection={}] T/Z/sliding-Z selection.
   * @returns {Promise<ArrayLike<number>>} Display-oriented plane samples.
   */
  async fetch(channel, selection = {}) {
    const started = performance.now();
    const source = await this.loadSourcePlane(channel, selection, this.controller.signal);
    const decoded = performance.now();
    const {height, width} = this.descriptor;
    if (!source || source.length !== width * height) {
      throw new Error('channel plane sample count mismatch');
    }
    const plane = transposePlane(source, height, width);
    const completed = performance.now();
    this.onMetric?.({
      channel_id: channel.id,
      t_index: selection.t_index ?? null,
      z_index: selection.z_index ?? null,
      plus_minus_z: selection.plus_minus_z ?? 0,
      sample_count: source.length,
      fetch_headers_ms: decoded - started,
      response_body_ms: 0,
      transpose_ms: completed - decoded,
      total_ms: completed - started,
    });
    return plane;
  }

  /** Abort pending requests and release every dataset-scoped entry. */
  clear() {
    this.controller.abort();
    this.entries.clear();
    this.controller = new AbortController();
  }
}
