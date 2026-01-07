const ort = require('onnxruntime-node');

async function test() {
    try {
        console.log("Creating session with default options...");
        // We need a dummy model used in tests or we can just try to create a session with empty path (will fail) or create a dummy onnx file.
        // Let's rely on the error message change.
        
        // Actually, let's just use one of the existing model files we know exists
        const modelPath = "/home/sean/projects/anything-llm/server/storage/models/efficient-speech/lite-whisper-large-v3/onnx/encoder_model_quantized.onnx";
        
        console.log("Attempting to load:", modelPath);
        
        const session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ["CPUExecutionProvider"] 
        });
        console.log("Session created successfully with CPU!");
    } catch(e) {
        console.log("Failed with CPU:", e.message);
    }

    try {
        const modelPath = "/home/sean/projects/anything-llm/server/storage/models/efficient-speech/lite-whisper-large-v3/onnx/encoder_model_quantized.onnx";
        console.log("Attempting to load with CUDA+CPU...");
        const session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ["CUDAExecutionProvider", "CPUExecutionProvider"] 
        });
        console.log("Session created successfully with CUDA+CPU!");
    } catch(e) {
        console.log("Failed with CUDA+CPU:", e.message);
    }
    try {
        const modelPath = "/home/sean/projects/anything-llm/server/storage/models/efficient-speech/lite-whisper-large-v3/onnx/encoder_model_quantized.onnx";
        console.log("Attempting to load with NO options (defaults)...");
        const session = await ort.InferenceSession.create(modelPath);
        console.log("Session created successfully with defaults!");
    } catch(e) {
        console.log("Failed with defaults:", e.message);
    }
}

test();
