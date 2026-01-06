const { NativeEmbedder } = require("../../EmbeddingEngines/native");
const {
  LLMPerformanceMonitor,
} = require("../../helpers/chat/LLMPerformanceMonitor");
const {
  handleDefaultStreamResponseV2,
} = require("../../helpers/chat/responses");

class HuggingFaceLLM {
  constructor(embedder = null, _modelPreference = null) {
    if (!process.env.HUGGING_FACE_LLM_ENDPOINT)
      throw new Error("No HuggingFace Inference Endpoint was set.");
    if (!process.env.HUGGING_FACE_LLM_API_KEY)
      throw new Error("No HuggingFace Access Token was set.");
    const { OpenAI: OpenAIApi } = require("openai");

    this.openai = new OpenAIApi({
      baseURL: `${process.env.HUGGING_FACE_LLM_ENDPOINT}/v1`,
      apiKey: process.env.HUGGING_FACE_LLM_API_KEY,
    });
    // We set to 'tgi' so that endpoint for HF can accept message format
    this.model =
      _modelPreference || process.env.HUGGING_FACE_LLM_MODEL_PREF || "tgi";
    
    const endpoint = process.env.HUGGING_FACE_LLM_ENDPOINT;
    const baseURL = endpoint.endsWith("/v1") ? endpoint : `${endpoint}/v1`;
    
    this.log(`Endpoint: ${endpoint}`);
    this.log(`BaseURL: ${baseURL}`);

    this.openai = new OpenAIApi({
      baseURL,
      apiKey: process.env.HUGGING_FACE_LLM_API_KEY,
    });
    this.limits = {
      history: this.promptWindowLimit() * 0.15,
      system: this.promptWindowLimit() * 0.15,
      user: this.promptWindowLimit() * 0.7,
    };

    this.embedder = embedder ?? new NativeEmbedder();
    this.defaultTemp = 0.2;
  }

  #appendContext(contextTexts = []) {
    if (!contextTexts || !contextTexts.length) return "";
    return (
      "\nContext:\n" +
      contextTexts
        .map((text, i) => {
          return `[CONTEXT ${i}]:\n${text}\n[END CONTEXT ${i}]\n\n`;
        })
        .join("")
    );
  }

  async #retryable(fn, retries = 3) {
    let attempt = 0;
    while (attempt < retries) {
      try {
        return await fn();
      } catch (e) {
        if (
          attempt < retries - 1 &&
          (e.status === 504 || e?.response?.status === 504)
        ) {
          this.log(
            `Encountered 504 Gateway Timeout. Retrying... (${
              attempt + 1
            }/${retries})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 2000 * (attempt + 1))
          );
          attempt++;
          continue;
        }
        throw e;
      }
    }
  }

  streamingEnabled() {
    return "streamGetChatCompletion" in this;
  }

  static promptWindowLimit(_modelName) {
    const limit = process.env.HUGGING_FACE_LLM_TOKEN_LIMIT || 4096;
    if (!limit || isNaN(Number(limit)))
      throw new Error("No HuggingFace token context limit was set.");
    return Number(limit);
  }

  promptWindowLimit() {
    const limit = process.env.HUGGING_FACE_LLM_TOKEN_LIMIT || 4096;
    if (!limit || isNaN(Number(limit)))
      throw new Error("No HuggingFace token context limit was set.");
    return Number(limit);
  }

  async isValidChatCompletionModel(_ = "") {
    return true;
  }

  constructPrompt({
    systemPrompt = "",
    contextTexts = [],
    chatHistory = [],
    userPrompt = "",
  }) {
    // System prompt it not enabled for HF model chats
    const prompt = {
      role: "user",
      content: `${systemPrompt}${this.#appendContext(contextTexts)}`,
    };
    const assistantResponse = {
      role: "assistant",
      content: "Okay, I will follow those instructions",
    };
    return [
      prompt,
      assistantResponse,
      ...chatHistory,
      { role: "user", content: userPrompt },
    ];
  }

  async getChatCompletion(messages = null, { temperature = 0.7 }) {
    this.log(`Getting chat completion for model ${this.model} with temperature ${temperature}`);
    this.log(`Messages:`, JSON.stringify(messages, null, 2));

    let result;
    try {
      result = await this.#retryable(async () => {
        return await LLMPerformanceMonitor.measureAsyncFunction(
          this.openai.chat.completions.create({
            model: this.model,
            messages,
            temperature,
          })
        );
      });
    } catch (e) {
      this.log(`Error getting chat completion: ${e.message}`);
      throw new Error(e.message);
    }

    if (
      !result.output.hasOwnProperty("choices") ||
      result.output.choices.length === 0
    ) {
      this.log(`No choices in response`);
      return null;
    }

    this.log(`Response:`, result.output.choices[0].message.content);
    return {
      textResponse: result.output.choices[0].message.content,
      metrics: {
        prompt_tokens: result.output.usage?.prompt_tokens || 0,
        completion_tokens: result.output.usage?.completion_tokens || 0,
        total_tokens: result.output.usage?.total_tokens || 0,
        outputTps:
          (result.output.usage?.completion_tokens || 0) / result.duration,
        duration: result.duration,
        model: this.model,
        timestamp: new Date(),
      },
    };
  }

  async streamGetChatCompletion(messages = null, { temperature = 0.7 }) {
    this.log(`Streaming chat completion for model ${this.model} with temperature ${temperature}`);
    this.log(`Messages:`, JSON.stringify(messages, null, 2));

    const measuredStreamRequest = await this.#retryable(async () => {
      return await LLMPerformanceMonitor.measureStream({
        func: this.openai.chat.completions.create({
          model: this.model,
          stream: true,
          messages,
          temperature,
        }),
        messages,
        runPromptTokenCalculation: true,
        modelTag: this.model,
      });
    });
    return measuredStreamRequest;
  }

  async handleStream(response, stream, responseProps) {
    const fullText = await handleDefaultStreamResponseV2(
      response,
      stream,
      responseProps
    );
    this.log(`Streamed Response:`, fullText);
    return fullText;
  }

  // Simple wrapper for dynamic embedder & normalize interface for all LLM implementations
  async embedTextInput(textInput) {
    return await this.embedder.embedTextInput(textInput);
  }
  async embedChunks(textChunks = []) {
    return await this.embedder.embedChunks(textChunks);
  }

  async compressMessages(promptArgs = {}, rawHistory = []) {
    const { messageArrayCompressor } = require("../../helpers/chat");
    const messageArray = this.constructPrompt(promptArgs);
    return await messageArrayCompressor(this, messageArray, rawHistory);
  }

  log(text, ...args) {
    console.log(`\x1b[36m[HuggingFaceLLM]\x1b[0m ${text}`, ...args);
  }
}

module.exports = {
  HuggingFaceLLM,
};
