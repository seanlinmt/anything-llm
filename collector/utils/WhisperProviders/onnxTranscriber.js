/**
 * ONNX-based transcription for wav2vec2 and lite-whisper models
 * 
 * This module provides inference for models that have been converted to ONNX format
 * using the tools/convert_wav2vec2_to_ONNX.py or tools/convert_lite_whisper_to_ONNX.py scripts.
 */

const fs = require("fs");
const path = require("path");

/**
 * Load ONNX Runtime - lazy load to avoid issues if not installed
 */
function getOnnxRuntime() {
  try {
    return require("onnxruntime-node");
  } catch (e) {
    throw new Error(
      "onnxruntime-node is not installed. Please run: yarn add onnxruntime-node"
    );
  }
}

/**
 * WAV2VEC2 ONNX Transcriber
 * Handles CTC-based models like wav2vec2
 */
class Wav2Vec2OnnxTranscriber {
  constructor(modelPath) {
    this.modelPath = modelPath;
    this.onnxPath = path.join(modelPath, "onnx");
    this.encoderPath = path.join(this.onnxPath, "encoder_model_quantized.onnx");
    this.session = null;
    this.vocab = null;
  }

  async initialize() {
    const ort = getOnnxRuntime();
    
    if (!fs.existsSync(this.encoderPath)) {
      throw new Error(
        `ONNX encoder model not found at ${this.encoderPath}. ` +
        `Please run: python tools/convert_wav2vec2_to_ONNX.py ${this.modelPath}`
      );
    }

    console.log(`[Wav2Vec2ONNX] Loading model from ${this.encoderPath}`);
    
    // Create session with CUDA provider if available, otherwise CPU
    const sessionOptions = {
      executionProviders: ["CUDAExecutionProvider", "CPUExecutionProvider"],
      graphOptimizationLevel: "all",
    };

    try {
      this.session = await ort.InferenceSession.create(
        this.encoderPath,
        sessionOptions
      );
    } catch (e) {
      console.log("[Wav2Vec2ONNX] CUDA not available/failed, falling back to default provider");
      // Fallback to default options (usually CPU) if explicit providers fail
      this.session = await ort.InferenceSession.create(this.encoderPath);
    }

    // Load vocabulary for CTC decoding
    await this.loadVocab();
    
    console.log("[Wav2Vec2ONNX] Model loaded successfully");
  }

  async loadVocab() {
    // Try to load vocab.json from the model directory
    const vocabPath = path.join(this.modelPath, "vocab.json");
    if (fs.existsSync(vocabPath)) {
      const vocabData = JSON.parse(fs.readFileSync(vocabPath, "utf8"));
      // Convert vocab to id->char mapping
      this.vocab = {};
      for (const [char, id] of Object.entries(vocabData)) {
        this.vocab[id] = char;
      }
      return;
    }

    // Try tokenizer.json format
    const tokenizerPath = path.join(this.modelPath, "tokenizer.json");
    if (fs.existsSync(tokenizerPath)) {
      const tokenizer = JSON.parse(fs.readFileSync(tokenizerPath, "utf8"));
      if (tokenizer.model && tokenizer.model.vocab) {
        this.vocab = {};
        for (const [char, id] of Object.entries(tokenizer.model.vocab)) {
          this.vocab[id] = char;
        }
        return;
      }
    }

    // Default CTC vocabulary (basic for testing)
    console.log("[Wav2Vec2ONNX] Warning: No vocab file found, using default");
    this.vocab = {
      0: "<pad>",
      1: "<s>",
      2: "</s>",
      3: "<unk>",
      4: "|", // Word separator
    };
    // Add letters
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < alphabet.length; i++) {
      this.vocab[5 + i] = alphabet[i];
    }
  }

  /**
   * CTC greedy decoding
   */
  ctcDecode(logits) {
    const blankId = 0; // Usually <pad> is the blank token
    let result = [];
    let prevToken = -1;

    // Get argmax for each timestep
    for (let t = 0; t < logits.length; t++) {
      const frame = logits[t];
      let maxIdx = 0;
      let maxVal = frame[0];
      for (let i = 1; i < frame.length; i++) {
        if (frame[i] > maxVal) {
          maxVal = frame[i];
          maxIdx = i;
        }
      }

      // Skip blanks and repeated tokens
      if (maxIdx !== blankId && maxIdx !== prevToken) {
        const char = this.vocab[maxIdx] || "";
        if (char === "|") {
          result.push(" ");
        } else if (!char.startsWith("<")) {
          result.push(char);
        }
      }
      prevToken = maxIdx;
    }

    return result.join("").trim();
  }

  async transcribe(audioData) {
    if (!this.session) {
      await this.initialize();
    }

    const ort = getOnnxRuntime();
    
    // Create input tensor - wav2vec2 expects [batch, samples]
    const inputTensor = new ort.Tensor(
      "float32",
      Float32Array.from(audioData),
      [1, audioData.length]
    );

    // Run inference
    const feeds = { input_values: inputTensor };
    const results = await this.session.run(feeds);
    
    // Get logits output
    const logits = results.logits;
    const logitsData = logits.data;
    const [batch, seqLen, vocabSize] = logits.dims;

    // Reshape logits to [seqLen, vocabSize]
    const logitsArray = [];
    for (let t = 0; t < seqLen; t++) {
      const frame = [];
      for (let v = 0; v < vocabSize; v++) {
        frame.push(logitsData[t * vocabSize + v]);
      }
      logitsArray.push(frame);
    }

    // CTC decode
    const text = this.ctcDecode(logitsArray);
    return { text };
  }
}

/**
 * Lite-Whisper ONNX Transcriber
 * Handles encoder-decoder models like lite-whisper
 */
class LiteWhisperOnnxTranscriber {
  constructor(modelPath) {
    this.modelPath = modelPath;
    this.onnxPath = path.join(modelPath, "onnx");
    this.encoderPath = path.join(this.onnxPath, "encoder_model_quantized.onnx");
    this.decoderPath = path.join(this.onnxPath, "decoder_model_merged_quantized.onnx");
    this.encoderSession = null;
    this.decoderSession = null;
    this.tokenizer = null;
  }

  async initialize() {
    const ort = getOnnxRuntime();
    
    if (!fs.existsSync(this.encoderPath)) {
      throw new Error(
        `ONNX encoder model not found at ${this.encoderPath}. ` +
        `Please run: python tools/convert_lite_whisper_to_ONNX.py ${this.modelPath}`
      );
    }

    console.log(`[LiteWhisperONNX] Loading encoder from ${this.encoderPath}`);

    const sessionOptions = {
      executionProviders: ["CUDAExecutionProvider", "CPUExecutionProvider"],
      graphOptimizationLevel: "all",
    };

    try {
      this.encoderSession = await ort.InferenceSession.create(
        this.encoderPath,
        sessionOptions
      );
    } catch (e) {
      console.log("[LiteWhisperONNX] CUDA not available/failed, falling back to default provider");
      // Fallback to default options (usually CPU) if explicit providers fail
      this.encoderSession = await ort.InferenceSession.create(this.encoderPath);
    }

    // Note: Full decoder inference with autoregressive generation is complex
    // For now, we'll use a simplified approach or fall back to CTC-style decoding
    console.log("[LiteWhisperONNX] Model loaded successfully");
    console.log("[LiteWhisperONNX] Warning: Full autoregressive decoding not yet implemented");
    
    await this.loadTokenizer();
  }

  async loadTokenizer() {
    // Try to load Whisper tokenizer
    const tokenizerPath = path.join(this.modelPath, "tokenizer.json");
    if (fs.existsSync(tokenizerPath)) {
      this.tokenizer = JSON.parse(fs.readFileSync(tokenizerPath, "utf8"));
      return;
    }

    // Try vocab.json
    const vocabPath = path.join(this.modelPath, "vocab.json");
    if (fs.existsSync(vocabPath)) {
      this.tokenizer = { vocab: JSON.parse(fs.readFileSync(vocabPath, "utf8")) };
      return;
    }

    console.log("[LiteWhisperONNX] No tokenizer found, will use basic decoding");
  }

  /**
   * Compute mel spectrogram features from audio
   * Whisper expects 128 mel bins at 100 frames/second
   */
  computeMelSpectrogram(audioData, sampleRate = 16000) {
    // Parameters for Whisper's mel spectrogram
    const nMels = 128;
    const hopLength = 160; // 10ms at 16kHz
    const winLength = 400; // 25ms at 16kHz
    const nFft = 400;
    const maxDuration = 30; // 30 seconds max
    const maxSamples = maxDuration * sampleRate;
    
    // Pad or truncate audio to 30 seconds
    let audio = audioData;
    if (audio.length > maxSamples) {
      audio = audio.slice(0, maxSamples);
    } else if (audio.length < maxSamples) {
      const padded = new Float32Array(maxSamples);
      padded.set(audio);
      audio = padded;
    }

    // For simplicity, we'll create a placeholder mel spectrogram
    // In production, you'd use a proper mel spectrogram computation
    const numFrames = Math.floor(audio.length / hopLength);
    const melSpec = new Float32Array(nMels * numFrames);
    
    // Simple energy-based approximation (not accurate, but functional)
    for (let t = 0; t < numFrames; t++) {
      const start = t * hopLength;
      const end = Math.min(start + winLength, audio.length);
      
      // Compute frame energy
      let energy = 0;
      for (let i = start; i < end; i++) {
        energy += audio[i] * audio[i];
      }
      energy = Math.log(energy + 1e-10);
      
      // Distribute across mel bins (simplified)
      for (let m = 0; m < nMels; m++) {
        melSpec[t * nMels + m] = energy * (0.5 + 0.5 * Math.sin(m * Math.PI / nMels));
      }
    }

    return { data: melSpec, shape: [1, nMels, numFrames] };
  }

  async transcribe(audioData) {
    if (!this.encoderSession) {
      await this.initialize();
    }

    const ort = getOnnxRuntime();
    
    // Compute mel spectrogram
    const mel = this.computeMelSpectrogram(audioData);
    
    // Create input tensor for encoder
    const inputTensor = new ort.Tensor("float32", mel.data, mel.shape);

    // Run encoder
    const encoderFeeds = { input_features: inputTensor };
    
    try {
      const encoderResults = await this.encoderSession.run(encoderFeeds);
      const encoderOutput = encoderResults.last_hidden_state;
      
      // For now, return a placeholder since full autoregressive generation
      // requires the decoder loop with beam search
      console.log("[LiteWhisperONNX] Encoder output shape:", encoderOutput.dims);
      
      return { 
        text: "[Lite-Whisper encoder ran successfully, but full decoder generation is not yet implemented. " +
              "Please use a standard Whisper model for full transcription.]"
      };
    } catch (e) {
      console.error("[LiteWhisperONNX] Inference error:", e.message);
      throw new Error(`Lite-Whisper inference failed: ${e.message}`);
    }
  }
}

/**
 * Factory function to create the appropriate transcriber
 */
function createOnnxTranscriber(modelPath, modelType) {
  switch (modelType) {
    case "wav2vec2":
    case "mpm": // MPM models are wav2vec2-based CTC models
      return new Wav2Vec2OnnxTranscriber(modelPath);
    case "lite-whisper":
      return new LiteWhisperOnnxTranscriber(modelPath);
    default:
      throw new Error(`Unknown model type for ONNX inference: ${modelType}`);
  }
}

module.exports = {
  Wav2Vec2OnnxTranscriber,
  LiteWhisperOnnxTranscriber,
  createOnnxTranscriber,
};
