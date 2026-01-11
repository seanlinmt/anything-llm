import React, { useEffect, useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import PreLoader from "@/components/Preloader";
import CTAButton from "@/components/lib/CTAButton";
import Admin from "@/models/admin";
import System from "@/models/system";
import showToast from "@/utils/toast";
import { numberWithCommas } from "@/utils/numbers";
import { useTranslation } from "react-i18next";
import { useModal } from "@/hooks/useModal";
import ModalWrapper from "@/components/ModalWrapper";
import ChangeWarningModal from "@/components/ChangeWarning";

function isNullOrNaN(value) {
  if (value === null) return true;
  return isNaN(value);
}

export default function EmbeddingTextSplitterPreference() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileChunks, setSelectedFileChunks] = useState([]);
  const [fetchingChunks, setFetchingChunks] = useState(false);
  const { isOpen, openModal, closeModal } = useModal();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    if (
      Number(form.get("text_splitter_chunk_overlap")) >=
      Number(form.get("text_splitter_chunk_size"))
    ) {
      showToast(
        "Chunk overlap cannot be larger or equal to chunk size.",
        "error"
      );
      return;
    }

    openModal();
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const form = new FormData(
        document.getElementById("text-splitter-chunking-form")
      );
      await Admin.updateSystemPreferences({
        text_splitter_preference: form.get("text_splitter_preference"),
        text_splitter_chunk_size: isNullOrNaN(
          form.get("text_splitter_chunk_size")
        )
          ? 1000
          : Number(form.get("text_splitter_chunk_size")),
        text_splitter_chunk_overlap: isNullOrNaN(
          form.get("text_splitter_chunk_overlap")
        )
          ? 1000
          : Number(form.get("text_splitter_chunk_overlap")),
      });
      setHasChanges(false);
      closeModal();
      showToast("Chunking settings saved.", "success");
    } catch (error) {
      showToast("Failed to save chunking settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      const _settings = (await Admin.systemPreferences())?.settings;
      setSettings(_settings ?? {});
      setLoading(false);
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === "visualiser" && files.length === 0) {
      fetchFiles();
    }
  }, [activeTab]);

  const fetchFiles = async () => {
    const _files = await System.localFiles();
    if (_files) {
      const flat = [];
      if (_files.items) {
        for (const folder of _files.items) {
          if (folder.type !== "folder") continue;
          for (const file of folder.items) {
            flat.push({
              name: file.title || file.name,
              value: `${folder.name}/${file.name}`,
            });
          }
        }
      }
      setFiles(flat);
    }
  };

  const handleFileSelect = (e) => {
    const value = e.target.value;
    setSelectedFile(value);
  };

  const handlePreview = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (!selectedFile) return;
    setFetchingChunks(true);
    const form = new FormData(
      document.getElementById("text-splitter-chunking-form")
    );
    const data = {
      name: selectedFile,
      text_splitter_preference: form.get("text_splitter_preference"),
      text_splitter_chunk_size: form.get("text_splitter_chunk_size"),
      text_splitter_chunk_overlap: form.get("text_splitter_chunk_overlap"),
    };
    const chunks = await System.previewDocumentChunks(data);
    setSelectedFileChunks((prev) => [
      {
        timestamp: new Date().toISOString(),
        settings: {
          model: data.text_splitter_preference,
          chunkSize: data.text_splitter_chunk_size,
          overlap: data.text_splitter_chunk_overlap,
        },
        chunks,
      },
      ...prev,
    ]);
    setFetchingChunks(false);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      {loading ? (
        <div
          style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
          className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
        >
          <div className="w-full h-full flex justify-center items-center">
            <PreLoader />
          </div>
        </div>
      ) : (
        <div
          style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
          className="relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
        >
          <div className="flex w-full flex-col px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
            <div className="w-full flex flex-col gap-y-1 pb-4 border-white light:border-theme-sidebar-border border-b-2 border-opacity-10">
              <div className="flex gap-x-4 items-center">
                <p className="text-lg leading-6 font-bold text-white">
                  {t("text.title")}
                </p>
              </div>
              <p className="text-xs leading-[18px] font-base text-white text-opacity-60">
                {t("text.desc-start")} <br />
                {t("text.desc-end")}
              </p>
            </div>

            <div className="flex gap-x-4 mt-4 border-b border-white/10">
              <button
                onClick={() => setActiveTab("settings")}
                className={`pb-2 text-sm font-semibold ${
                  activeTab === "settings"
                    ? "text-primary-button border-b-2 border-primary-button"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab("visualiser")}
                className={`pb-2 text-sm font-semibold ${
                  activeTab === "visualiser"
                    ? "text-primary-button border-b-2 border-primary-button"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Visualiser
              </button>
            </div>

              <div
                style={{ display: activeTab === "settings" ? "block" : "none" }}
              >
                <form
                  onSubmit={handleSubmit}
                  onChange={() => setHasChanges(true)}
                  className="flex w-full flex-col"
                  id="text-splitter-chunking-form"
                >
                  <div className="w-full justify-end flex">
                    {hasChanges && (
                      <CTAButton className="mt-3 mr-0 -mb-14 z-10">
                        {saving ? t("common.saving") : t("common.save")}
                      </CTAButton>
                    )}
                  </div>

                  <div className="flex flex-col gap-y-4 mt-8">
                    <div className="flex flex-col max-w-[300px]">
                      <div className="flex flex-col gap-y-2 mb-4">
                        <label className="text-white text-sm font-semibold block">
                          Text Splitter Method
                        </label>
                        <p className="text-xs text-white/60">
                          Select the method used to split text documents into
                          chunks.
                        </p>
                      </div>
                      <select
                        name="text_splitter_preference"
                        defaultValue={
                          settings?.text_splitter_preference || "recursive"
                        }
                        className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                      >
                        <option value="recursive">
                          Recursive Character Text Splitter (Default)
                        </option>
                        <option value="structure">
                          Structure Aware (Markdown)
                        </option>
                        <option value="semantic">
                          Semantic Chunking (Experimental)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-4 mt-8">
                    <div className="flex flex-col max-w-[300px]">
                      <div className="flex flex-col gap-y-2 mb-4">
                        <label className="text-white text-sm font-semibold block">
                          {t("text.size.title")}
                        </label>
                        <p className="text-xs text-white/60">
                          {t("text.size.description")}
                        </p>
                      </div>
                      <input
                        type="number"
                        name="text_splitter_chunk_size"
                        min={1}
                        max={settings?.max_embed_chunk_size || 1000}
                        onWheel={(e) => e?.currentTarget?.blur()}
                        className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                        placeholder="maximum length of vectorized text"
                        defaultValue={
                          isNullOrNaN(settings?.text_splitter_chunk_size)
                            ? 1000
                            : Number(settings?.text_splitter_chunk_size)
                        }
                        required={true}
                        autoComplete="off"
                      />
                      <p className="text-xs text-white/40 mt-2">
                        {t("text.size.recommend")}{" "}
                        {numberWithCommas(
                          settings?.max_embed_chunk_size || 1000
                        )}
                        .
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-4 mt-8">
                    <div className="flex flex-col max-w-[300px]">
                      <div className="flex flex-col gap-y-2 mb-4">
                        <label className="text-white text-sm font-semibold block">
                          {t("text.overlap.title")}
                        </label>
                        <p className="text-xs text-white/60">
                          {t("text.overlap.description")}
                        </p>
                      </div>
                      <input
                        type="number"
                        name="text_splitter_chunk_overlap"
                        min={0}
                        onWheel={(e) => e?.currentTarget?.blur()}
                        className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                        placeholder="maximum length of vectorized text"
                        defaultValue={
                          isNullOrNaN(settings?.text_splitter_chunk_overlap)
                            ? 20
                            : Number(settings?.text_splitter_chunk_overlap)
                        }
                        required={true}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </form>
              </div>

            <div
              style={{ display: activeTab === "visualiser" ? "block" : "none" }}
            >
              <div className="flex flex-col w-full mt-8">
                <div className="flex flex-col max-w-[400px] gap-y-2">
                  <label className="text-white text-sm font-semibold block">
                    Select File to Visualize
                  </label>
                  <div className="flex gap-4 items-center">
                    <select
                      onChange={handleFileSelect}
                      className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                    >
                      <option value="">-- Select a file --</option>
                      {files.map((file) => (
                        <option key={file.value} value={file.value}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                    <CTAButton
                      onClick={handlePreview}
                      disabled={!selectedFile || fetchingChunks}
                      className="w-[200px]"
                    >
                      {fetchingChunks ? "Simulating..." : "Simulate"}
                    </CTAButton>
                  </div>
                </div>

                {fetchingChunks && (
                  <div className="mt-8 flex justify-center">
                    <PreLoader />
                  </div>
                )}

                {!fetchingChunks && selectedFileChunks.length > 0 && (
                  <div className="mt-8 flex flex-col gap-y-8">
                    {selectedFileChunks.map((result, resultIndex) => (
                      <div key={resultIndex} className="flex flex-col gap-y-4">
                        <div className="border-b border-white/20 pb-2">
                          <h3 className="text-white font-semibold">
                            Preview #{selectedFileChunks.length - resultIndex}
                          </h3>
                          <div className="flex gap-4 text-xs text-white/60 mt-1">
                            <span>
                              Model:{" "}
                              <span className="text-white">
                                {result.settings.model}
                              </span>
                            </span>
                            <span>
                              Chunk Size:{" "}
                              <span className="text-white">
                                {result.settings.chunkSize}
                              </span>
                            </span>
                            <span>
                              Overlap:{" "}
                              <span className="text-white">
                                {result.settings.overlap}
                              </span>
                            </span>
                             <span>
                              Chunks:{" "}
                              <span className="text-white">
                                {result.chunks.length}
                              </span>
                            </span>
                          </div>
                        </div>

                        {result.chunks.length === 0 ? (
                          <p className="text-white/60 italic">
                            No chunks generated with these settings.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-y-4">
                            {result.chunks.map((chunk, index) => (
                              <div
                                key={`${resultIndex}-${index}`}
                                className="bg-white/5 p-4 rounded-lg border border-white/10"
                              >
                                <div className="flex justify-between mb-2">
                                  <span className="text-xs text-primary-button font-bold">
                                    Chunk {index + 1}
                                  </span>
                                  <span className="text-xs text-white/40">
                                    {chunk.metadata?.text?.length || 0}{" "}
                                    characters
                                  </span>
                                </div>
                                <p className="text-sm text-white/80 whitespace-pre-wrap font-mono mb-4">
                                  {typeof chunk.metadata?.text === "string"
                                    ? chunk.metadata.text
                                    : JSON.stringify(chunk.metadata?.text) ||
                                      "No text content"}
                                </p>
                                <div className="flex flex-col gap-y-1 border-t border-white/10 pt-2 mt-2">
                                  <p className="text-xs font-semibold text-white/40 mb-1">Metadata</p>
                                  {Object.entries(chunk.metadata || {})
                                    .filter(([key]) => key !== "text")
                                    .map(([key, value]) => (
                                      <div key={key} className="flex gap-x-2 text-xs items-start">
                                        <span className="font-semibold text-white/60 min-w-[80px] shrink-0">{key}:</span>
                                        <span className="text-white/80 font-mono break-all whitespace-pre-wrap">
                                          {Array.isArray(value) 
                                            ? JSON.stringify(value, null, 2) 
                                            : typeof value === 'object' 
                                              ? JSON.stringify(value, null, 2)
                                              : String(value)
                                          }
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ModalWrapper isOpen={isOpen}>
        <ChangeWarningModal
          warningText="Changing text splitter settings will clear any previously cached documents.\n\nThese new settings will be applied to all documents when embedding them into a workspace."
          onClose={closeModal}
          onConfirm={handleSaveSettings}
        />
      </ModalWrapper>
    </div>
  );
}
