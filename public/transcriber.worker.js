/**
 * transcriber.worker.js
 * Runs Whisper inference off the main thread so the UI stays responsive.
 * 
 * We load @xenova/transformers from a CDN to avoid Vite pre-bundling issues
 * with onnxruntime-web's backend registration side effects.
 */

const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const MODEL_ID = 'Xenova/whisper-tiny.en';

let pipeline = null;
let transcriber = null;
let cancelled = false;

/**
 * Dynamically import transformers from CDN.
 */
async function getTransformers() {
  if (pipeline) return { pipeline };
  
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const module = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
  
  // Disable local model loading — always fetch from HuggingFace CDN
  module.env.allowLocalModels = false;
  
  pipeline = module.pipeline;
  return { pipeline };
}

/**
 * Load (or reuse) the ASR pipeline. Sends progress messages back to main thread.
 */
async function loadModel() {
  if (transcriber) return transcriber;

  const { pipeline: createPipeline } = await getTransformers();

  // Detect WebGPU capability in the worker scope
  const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const device = hasWebGpu ? 'webgpu' : 'cpu';
  
  console.log(`[EaziStudio Worker] Initializing Whisper model on device: ${device}`);

  try {
    transcriber = await createPipeline('automatic-speech-recognition', MODEL_ID, {
      device: device,
      progress_callback: (progress) => {
        self.postMessage({ type: 'model_progress', payload: progress });
      },
    });
  } catch (err) {
    if (device === 'webgpu') {
      console.warn('[EaziStudio Worker] WebGPU failed. Falling back to CPU...', err);
      transcriber = await createPipeline('automatic-speech-recognition', MODEL_ID, {
        device: 'cpu',
        progress_callback: (progress) => {
          self.postMessage({ type: 'model_progress', payload: progress });
        },
      });
    } else {
      throw err;
    }
  }

  return transcriber;
}

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  if (type === 'cancel') {
    cancelled = true;
    self.postMessage({ type: 'cancelled' });
    return;
  }

  if (type === 'transcribe') {
    cancelled = false;
    try {
      self.postMessage({ type: 'status', payload: 'loading_model' });

      const asr = await loadModel();

      if (cancelled) return;

      self.postMessage({ type: 'status', payload: 'transcribing' });

      // Calculate estimated audio duration from Float32Array at 16kHz
      const audioDurationSecs = payload.audioData.length / 16000;
      const totalChunks = Math.ceil(audioDurationSecs / 25); // chunk_length_s minus stride overlap
      let processedChunks = 0;

      // payload.audioData is a Float32Array at 16kHz
      const result = await asr(payload.audioData, {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        // Callback fires after each chunk is processed
        chunk_callback: (_chunk) => {
          if (cancelled) return;
          processedChunks++;
          const percent = Math.min(99, Math.round((processedChunks / Math.max(totalChunks, 1)) * 100));
          self.postMessage({ 
            type: 'transcribe_progress', 
            payload: { percent, processedChunks, totalChunks }
          });
        },
      });

      if (cancelled) return;

      self.postMessage({ type: 'result', payload: result });
    } catch (err) {
      self.postMessage({ type: 'error', payload: err.message || 'Unknown worker error' });
    }
  }
});
