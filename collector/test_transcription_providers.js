const path = require('path');
const fs = require('fs');
// Adjust import path based on where this script is located relative to source
const { LocalTranscription } = require('./utils/WhisperProviders/localTranscription');

// Mock environment to point to the correct storage dir
// We assume execution from 'collector' directory
process.env.STORAGE_DIR = path.resolve(__dirname, '../server/storage');

async function testModel(modelName) {
  console.log(`\n----------------------------------------`);
  console.log(`Testing model: ${modelName}`);
  try {
    const provider = new LocalTranscription({ 
      options: { WhisperModelPref: modelName } 
    });
    
    console.log(`Model type detected: ${provider.modelType}`);
    
    // Check client instantiation (throws if invalid or missing)
    console.log("Initializing client (loading ONNX files)...");
    const client = await provider.client();
    console.log("Client created successfully!");
    
    return true;
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    if (!e.message.includes("not found")) {
        console.error(e.stack);
    }
    return false;
  }
}

async function runTests() {
  console.log("Starting Transcription Provider Tests...");
  
  // Test 1: Lite-Whisper
  await testModel("efficient-speech/lite-whisper-large-v3");
  
  // Test 2: Wav2Vec2
  await testModel("eddiegulay/wav2vec2-large-xlsr-mvc-swahili");
}

runTests();
