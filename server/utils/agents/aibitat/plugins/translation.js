let translator = null;

const translationPlugin = {
  name: "nllb-translation",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "Translate text from one language to another using the NLLB-200 model. This tool supports 200+ languages. You MUST provide the FLORES-200 language codes for both source and target languages (e.g., 'eng_Latn' for English, 'fra_Latn' for French, 'spa_Latn' for Spanish, 'deu_Latn' for German, etc.).",
          examples: [
            {
              prompt: "Translate 'Hello world' to French",
              call: JSON.stringify({
                text: "Hello world",
                source_lang: "eng_Latn",
                target_lang: "fra_Latn",
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The text content to be translated.",
              },
              source_lang: {
                type: "string",
                description:
                  "The FLORES-200 code for the source language (e.g., 'eng_Latn').",
              },
              target_lang: {
                type: "string",
                description:
                  "The FLORES-200 code for the target language (e.g., 'fra_Latn').",
              },
            },
            required: ["text", "source_lang", "target_lang"],
            additionalProperties: false,
          },
          handler: async function ({ text, source_lang, target_lang }) {
            try {
              if (!translator) {
                this.super.handlerProps.log(
                  "Initializing NLLB-200 translation pipeline... This may take a moment for the first run."
                );
                // Dynamically import the library to avoid import errors or heavy load at startup
                const { pipeline } = require("@xenova/transformers");
                translator = await pipeline(
                  "translation",
                  "Xenova/nllb-200"
                );
              }

              this.super.handlerProps.log(
                `Translating "${text.substring(0, 20)}${text.length > 20 ? "..." : ""
                }" from ${source_lang} to ${target_lang}`
              );

              const output = await translator(text, {
                src_lang: source_lang,
                tgt_lang: target_lang,
              });

              // Output is usually an array of objects: [{ translation_text: "..." }]
              if (output && output.length > 0 && output[0].translation_text) {
                return output[0].translation_text;
              }

              return JSON.stringify(output);
            } catch (error) {
              this.super.handlerProps.log(
                `Translation failed: ${error.message}`
              );
              return `Translation failed. Error: ${error.message}`;
            }
          },
        });
      },
    };
  },
};

module.exports = {
  translationPlugin,
};
