import { useState } from "react";

export default function OpenAiWhisperOptions({ settings }) {
  const [inputValue, setInputValue] = useState(settings?.OpenAiKey);
  const [_openAIKey, setOpenAIKey] = useState(settings?.OpenAiKey);
  const [basePath, setBasePath] = useState(
    settings?.OpenAiTranscriptionBasePath
  );

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-4 mt-1.5">
      <div className="flex flex-col w-60">
        <label className="text-white text-sm font-semibold block mb-3">
          API Key
        </label>
        <input
          type="password"
          name="OpenAiKey"
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
          placeholder="OpenAI API Key"
          defaultValue={settings?.OpenAiKey ? "*".repeat(20) : ""}
          required={true}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={() => setOpenAIKey(inputValue)}
        />
      </div>

      <div className="flex flex-col w-60">
        <label className="text-white text-sm font-semibold block mb-3">
          API URL
        </label>
        <input
          type="text"
          name="OpenAiTranscriptionBasePath"
          className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
          placeholder="https://api.openai.com/v1"
          defaultValue={settings?.OpenAiTranscriptionBasePath}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setBasePath(e.target.value)}
        />
      </div>

      <div className="flex flex-col w-60">
        <label className="text-white text-sm font-semibold block mb-3">
          Whisper Model
        </label>
        <select
          name="WhisperModelPref"
          className="border-none flex-shrink-0 bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
          defaultValue={settings?.WhisperModelPref || "whisper-1"}
        >
          <option value="whisper-1">Whisper Large</option>
          <option value="nvidia/stt_rw_conformer_ctc_large">
            Nvidia Conformer CTC Large
          </option>
          <option value="nvidia/stt_rw_conformer_transducer_large">
            Nvidia Conformer Transducer Large
          </option>
        </select>
      </div>
    </div>
  );
}
