import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Gauge } from "@phosphor-icons/react";
import System from "@/models/system";

export default function NativeTranscriptionOptions({ settings }) {
  const { t } = useTranslation();
  const [model, setModel] = useState(settings?.WhisperModelPref);
  const [availableModels, setAvailableModels] = useState([
    { id: "Xenova/whisper-small", name: "Xenova/whisper-small" },
    { id: "Xenova/whisper-large", name: "Xenova/whisper-large" },
  ]);

  useEffect(() => {
    async function fetchModels() {
      const localModels = await System.fetchLocalTranscriptionModels();
      const defaults = [
        "Xenova/whisper-small",
        "Xenova/whisper-large",
      ];
      const merged = [...localModels];

      defaults.forEach((def) => {
        if (!merged.find((m) => m.id === def)) {
          merged.push({ id: def, name: def });
        }
      });
      setAvailableModels(merged);
    }
    fetchModels();
  }, []);

  return (
    <div className="w-full flex flex-col gap-y-4">
      <LocalWarning model={model} />
      <div className="w-full flex items-center gap-4">
        <div className="flex flex-col w-full max-w-[640px]">
          <label className="text-white text-sm font-semibold block mb-3">
            Transcription Model
          </label>
          <select
            name="WhisperModelPref"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="border-none bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
          >
            {availableModels.map((modelOption) => {
              return (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name}
                </option>
              );
            })}
          </select>
        </div>
      </div>
    </div>
  );
}

function LocalWarning({ model }) {
  switch (model) {
    case "Xenova/whisper-small":
      return <WhisperSmall />;
    case "Xenova/whisper-large":
      return <WhisperLarge />;
    default:
      return <WhisperSmall />;
  }
}

function WhisperSmall() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-x-2 text-white mb-4 bg-blue-800/30 w-fit rounded-lg px-4 py-2">
      <div className="gap-x-2 flex items-center">
        <Gauge size={25} />
        <p className="text-sm">
          {t("transcription.warn-start")}
          <br />
          {t("transcription.warn-recommend")}
          <br />
          <br />
          <i>{t("transcription.warn-end")} (250mb)</i>
        </p>
      </div>
    </div>
  );
}

function WhisperLarge() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-x-2 text-white mb-4 bg-blue-800/30 w-fit rounded-lg px-4 py-2">
      <div className="gap-x-2 flex items-center">
        <Gauge size={25} />
        <p className="text-sm">
          {t("transcription.warn-start")}
          <br />
          {t("transcription.warn-recommend")}
          <br />
          <br />
          <i>{t("transcription.warn-end")} (1.56GB)</i>
        </p>
      </div>
    </div>
  );
}
