const fs = require("fs");

class OpenAiWhisper {
  constructor({ options }) {
    const { OpenAI: OpenAIApi } = require("openai");
    const modelPref = options.WhisperModelPref || "whisper-1";
    // Check if the model is one of our custom supported ones that needs the local backend
    const shouldUseCustomBase = !!options.whisperBasePath;
    if (!shouldUseCustomBase && !options.openAiKey)
      throw new Error("No OpenAI API key was set.");

    this.openai = new OpenAIApi({
      apiKey: options.openAiKey || "sk-placeholder",
      baseURL: shouldUseCustomBase
        ? options.whisperBasePath
        : "https://api.openai.com/v1",
    });
    this.model = modelPref;
    this.temperature = 0;
    this.#log("Initialized.");
  }

  #log(text, ...args) {
    console.log(`\x1b[32m[OpenAiWhisper]\x1b[0m ${text}`, ...args);
  }

  async processFile(fullFilePath) {
    return await this.openai.audio.transcriptions
      .create({
        file: fs.createReadStream(fullFilePath),
        model: this.model,
        temperature: this.temperature,
      })
      .then((response) => {
        if (!response) {
          return {
            content: "",
            error: "No content was able to be transcribed.",
          };
        }

        return { content: response.text, error: null };
      })
      .catch((error) => {
        this.#log(
          `Could not get any response from openai whisper`,
          error.message
        );
        return { content: "", error: error.message };
      });
  }
}

module.exports = {
  OpenAiWhisper,
};
