/**
 * audioUtils.ts
 * Decodes an audio File or Blob to 16 kHz mono Float32Array using the Web Audio API.
 */

const TARGET_SAMPLE_RATE = 16000;

/**
 * @param {File | Blob} file  – the audio file or blob
 * @returns {Promise<Float32Array>} – mono 16 kHz PCM data
 */
export async function decodeAudioFile(file: File | Blob): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();

  // Create AudioContext with explicit sampleRate
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtxClass({
    sampleRate: TARGET_SAMPLE_RATE,
  });

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    // If we need to resample (browser may ignore sampleRate hint), do it offline
    if (decoded.sampleRate !== TARGET_SAMPLE_RATE) {
      const resampled = await resample(decoded, TARGET_SAMPLE_RATE);
      return resampled;
    }

    return decoded.getChannelData(0);
  } finally {
    audioCtx.close();
  }
}

/**
 * Resamples an AudioBuffer to a target sample rate using OfflineAudioContext.
 */
async function resample(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<Float32Array> {
  const duration = audioBuffer.duration;
  const offlineCtx = new OfflineAudioContext(
    1, // mono
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}
