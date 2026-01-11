import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "@/components/SettingsSidebar";
import System from "@/models/system";
import showToast from "@/utils/toast";
import CTAButton from "@/components/lib/CTAButton";
import { isMobile } from "react-device-detect";

export default function TranslationPreference() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKeys() {
      const _settings = await System.keys();
      setSettings(_settings);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    // Map form data explicitly if needed, or just iterate
    const data = {};
    const formData = new FormData(form);
    for (var [key, value] of formData.entries()) data[key] = value;

    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`Failed to save settings: ${error}`, "error");
    } else {
      showToast("Translation preferences saved successfully.", "success");
    }
    setSaving(false);
    setHasChanges(!!error);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      {loading ? (
        <div style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }} className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0">
          <div className="w-full h-full flex justify-center items-center">
            <p className="text-white">Loading...</p>
          </div>
        </div>
      ) : (
        <div style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }} className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0">
          <form onSubmit={handleSubmit} className="flex w-full">
            <div className="flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
              <div className="w-full flex flex-col gap-y-1 pb-6 border-white light:border-theme-sidebar-border border-b-2 border-opacity-10">
                <div className="flex gap-x-4 items-center">
                  <p className="text-lg leading-6 font-bold text-white">
                    Translation Preference
                  </p>
                </div>
                <p className="text-xs leading-[18px] font-base text-white text-opacity-60">
                  Configure the translation model used by the system for translation tasks.
                </p>
              </div>
              
              <div className="w-full justify-end flex">
                {hasChanges && (
                  <CTAButton onClick={() => handleSubmit()} className="mt-3 mr-0 -mb-14 z-10">
                    {saving ? "Saving..." : "Save changes"}
                  </CTAButton>
                )}
              </div>

              <div className="flex flex-col gap-y-4 mt-8">
                <div className="flex flex-col w-60">
                  <label className="text-white text-sm font-semibold block mb-3">
                    Translation Model
                  </label>
                  <select
                    name="TranslationModelPref"
                    className="border-none bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
                    defaultValue={settings?.TranslationModelPref || "Xenova/nllb-200"}
                    onChange={() => setHasChanges(true)}
                  >
                    <option value="Xenova/nllb-200">Xenova/nllb-200 (Native)</option>
                  </select>
                  <p className="text-xs text-white text-opacity-60 mt-2">
                    Currently only the native NLLB-200 model is supported. It runs locally on your machine.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
