const path = require("path");
const fs = require("fs");
const { v4 } = require("uuid");
const { SUPPORTED_NATIVE_TRANSLATION_MODELS } = require("./constants");

class NativeTranslator {
    static defaultModel = "Xenova/nllb-200-distilled-600M";

    static supportedModels = SUPPORTED_NATIVE_TRANSLATION_MODELS;

    // This is a folder that Mintplex Labs hosts for those who cannot capture the HF model download
    // endpoint for various reasons.
    #fallbackHost = "https://cdn.anythingllm.com/support/models/";

    constructor() {
        this.className = "NativeTranslator";
        this.model = this.getTranslationModel();
        this.modelInfo = this.getTranslatorInfo();
        this.cacheDir = path.resolve(
            process.env.STORAGE_DIR
                ? path.resolve(process.env.STORAGE_DIR, `models`)
                : path.resolve(__dirname, `../../../storage/models`)
        );
        this.modelPath = path.resolve(this.cacheDir, ...this.model.split("/"));
        this.modelDownloaded = fs.existsSync(this.modelPath);

        // Make directory when it does not exist in existing installations
        if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir);
        this.log(`Initialized ${this.model}`);
    }

    log(text, ...args) {
        console.log(`\x1b[36m[${this.className}]\x1b[0m ${text}`, ...args);
    }

    static availableModels() {
        return Object.values(NativeTranslator.supportedModels).map(
            (model) => model.apiInfo
        );
    }

    getTranslationModel() {
        // For now we only support one model, but structure is here for future
        const envModel =
            process.env.TRANSLATION_MODEL_PREF ?? NativeTranslator.defaultModel;
        if (NativeTranslator.supportedModels?.[envModel]) return envModel;
        return NativeTranslator.defaultModel;
    }

    getTranslatorInfo() {
        const model = this.getTranslationModel();
        return NativeTranslator.supportedModels[model];
    }

    async #fetchWithHost(hostOverride = null) {
        try {
            const pipeline = (...args) =>
                import("@xenova/transformers").then(({ pipeline, env }) => {
                    if (!this.modelDownloaded) {
                        if (hostOverride) {
                            env.remoteHost = hostOverride;
                            env.remotePathTemplate = "{model}/";
                        }
                        this.log(`Downloading ${this.model} from ${env.remoteHost}`);
                    }
                    return pipeline(...args);
                });

            return {
                pipeline: await pipeline("translation", this.model, {
                    cache_dir: this.cacheDir,
                    ...(!this.modelDownloaded
                        ? {
                            progress_callback: (data) => {
                                if (!data.hasOwnProperty("progress")) return;
                                console.log(
                                    `\x1b[36m[NativeTranslator - Downloading model]\x1b[0m ${data.file
                                    } ${~~data?.progress}%`
                                );
                            },
                        }
                        : {}),
                }),
                retry: false,
                error: null,
            };
        } catch (error) {
            return {
                pipeline: null,
                retry: hostOverride === null ? this.#fallbackHost : false,
                error,
            };
        }
    }

    async translatorClient() {
        if (!this.modelDownloaded)
            this.log(
                "The native translation model has never been run and will be downloaded right now. This may take a while."
            );

        let fetchResponse = await this.#fetchWithHost();
        if (fetchResponse.pipeline !== null) {
            this.modelDownloaded = true;
            return fetchResponse.pipeline;
        }

        this.log(
            `Failed to download model from primary URL. Using fallback ${fetchResponse.retry}`
        );
        if (!!fetchResponse.retry)
            fetchResponse = await this.#fetchWithHost(fetchResponse.retry);
        if (fetchResponse.pipeline !== null) {
            this.modelDownloaded = true;
            return fetchResponse.pipeline;
        }

        throw fetchResponse.error;
    }

    /**
     * Translate text
     * @param {string} text - The text to translate
     * @param {string} source_lang - source language code (e.g., 'eng_Latn')
     * @param {string} target_lang - target language code (e.g., 'fra_Latn')
     * @returns {Promise<string>}
     */
    async translate(text, source_lang = "eng_Latn", target_lang = "fra_Latn") {
        const pipeline = await this.translatorClient();
        try {
            const output = await pipeline(text, {
                src_lang: source_lang,
                tgt_lang: target_lang,
            });

            // Release memory if possible? Transformers.js caches pipelines usually.
            return output?.[0]?.translation_text || "";
        } catch (e) {
            console.error(e);
            throw e;
        }
    }
}

module.exports = {
    NativeTranslator,
};
