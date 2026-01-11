const SUPPORTED_NATIVE_TRANSLATION_MODELS = {
    "Xenova/nllb-200": {
        apiInfo: {
            id: "Xenova/nllb-200",
            name: "nllb-200",
            description:
                "No Language Left Behind (NLLB) model. Supports 200+ languages.",
            lang: "200+ languages",
            size: "~1.2GB",
            modelCard: "https://huggingface.co/Xenova/nllb-200",
        },
    },
};

module.exports = {
    SUPPORTED_NATIVE_TRANSLATION_MODELS,
};
