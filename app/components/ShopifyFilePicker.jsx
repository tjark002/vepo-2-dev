import { useState, useCallback, useEffect, useRef } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Modal,
  TextField,
  Spinner,
  Text,
  Button,
  InlineStack,
  BlockStack,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { SearchIcon, UploadIcon } from "@shopify/polaris-icons";
import { useTranslation } from "../utils/i18n";

export default function ShopifyFilePicker({ open, onClose, onSelect }) {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [files, setFiles] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/app/api/files", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setUploadError(data.error);
      } else if (data.url) {
        const newFile = {
          id: data.id || `uploaded-${Date.now()}`,
          url: data.url,
          thumbnailUrl: data.url,
          alt: data.alt || "",
        };
        setFiles((prev) => [newFile, ...prev]);
        setSelectedFile(newFile);
      }
    } catch (e) {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (open) {
      setFiles([]);
      setPageInfo(null);
      setSelectedFile(null);
      const url = debouncedSearch
        ? `/app/api/files?search=${encodeURIComponent(debouncedSearch)}`
        : "/app/api/files";
      fetcher.load(url);
    }
  }, [open, debouncedSearch]);

  useEffect(() => {
    if (fetcher.data && !fetcher.data.error) {
      if (fetcher.data.files) {
        const newEndCursor = fetcher.data.pageInfo?.endCursor;
        const isLoadMore = pageInfo?.endCursor && newEndCursor !== pageInfo.endCursor;
        
        if (isLoadMore) {
          setFiles((prev) => [...prev, ...fetcher.data.files]);
        } else {
          setFiles(fetcher.data.files);
        }
        setPageInfo(fetcher.data.pageInfo);
      }
    }
  }, [fetcher.data]);

  const handleLoadMore = useCallback(() => {
    if (pageInfo?.hasNextPage && pageInfo?.endCursor) {
      const url = debouncedSearch
        ? `/app/api/files?after=${pageInfo.endCursor}&search=${encodeURIComponent(debouncedSearch)}`
        : `/app/api/files?after=${pageInfo.endCursor}`;
      fetcher.load(url);
    }
  }, [pageInfo, debouncedSearch, fetcher]);

  const handleSelect = useCallback(() => {
    if (selectedFile) {
      onSelect(selectedFile);
      onClose();
    }
  }, [selectedFile, onSelect, onClose]);

  const isLoading = fetcher.state === "loading";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("filePicker.title")}
      primaryAction={{
        content: t("common.select"),
        onAction: handleSelect,
        disabled: !selectedFile,
      }}
      secondaryActions={[
        {
          content: t("common.cancel"),
          onAction: onClose,
        },
      ]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleUpload(file);
            }}
            style={{
              padding: "20px",
              border: isDragOver
                ? "2px solid var(--p-color-border-interactive-active)"
                : "2px dashed var(--p-color-border)",
              borderRadius: "8px",
              background: isDragOver
                ? "var(--p-color-bg-surface-secondary-hover)"
                : "var(--p-color-bg-surface-secondary)",
              textAlign: "center",
              transition: "border-color 0.15s, background 0.15s",
              cursor: "pointer",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
            {uploading ? (
              <InlineStack gap="200" align="center" blockAlign="center">
                <Spinner size="small" />
                <Text variant="bodySm" tone="subdued">{t("filePicker.uploading")}</Text>
              </InlineStack>
            ) : (
              <BlockStack gap="100" inlineAlign="center">
                <span style={{ color: "var(--p-color-icon-secondary)" }}>
                  <UploadIcon width={24} height={24} />
                </span>
                <Text variant="bodySm" tone="subdued">{t("filePicker.dropOrClick")}</Text>
              </BlockStack>
            )}
          </div>

          {uploadError && (
            <Banner tone="critical" onDismiss={() => setUploadError(null)}>
              {uploadError}
            </Banner>
          )}

          <TextField
            value={search}
            onChange={setSearch}
            placeholder={t("filePicker.searchPlaceholder")}
            prefix={<span style={{ display: "flex" }}><SearchIcon /></span>}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch("")}
          />

          {isLoading && files.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
              <Spinner size="large" />
            </div>
          ) : files.length === 0 ? (
            <EmptyState
              heading={t("filePicker.noImages")}
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>{t("filePicker.noImagesDesc")}</p>
            </EmptyState>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: "12px",
                  maxHeight: "400px",
                  overflowY: "auto",
                  padding: "4px",
                }}
              >
                {files.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFile(file)}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      border: selectedFile?.id === file.id ? "3px solid var(--p-color-border-interactive-active)" : "1px solid var(--p-color-border)",
                      borderRadius: "8px",
                      overflow: "hidden",
                      cursor: "pointer",
                      padding: 0,
                      background: "var(--p-color-bg-surface-secondary)",
                      transition: "border-color 0.15s, transform 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedFile?.id !== file.id) {
                        e.currentTarget.style.borderColor = "var(--p-color-border-interactive-hover)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedFile?.id !== file.id) {
                        e.currentTarget.style.borderColor = "var(--p-color-border)";
                      }
                    }}
                  >
                    <img
                      src={file.thumbnailUrl}
                      alt={file.alt || t("filePicker.shopifyFile")}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                    {selectedFile?.id === file.id && (
                      <div
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: "var(--p-color-bg-fill-success)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="white">
                          <path d="M8.72 13.28a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l2.47 2.47 5.47-5.47a.75.75 0 0 1 1.06 1.06l-6 6Z" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {pageInfo?.hasNextPage && (
                <InlineStack align="center">
                  <Button onClick={handleLoadMore} loading={isLoading}>
                    {t("common.loadMore")}
                  </Button>
                </InlineStack>
              )}
            </>
          )}

          {selectedFile && (
            <div
              style={{
                padding: "12px",
                background: "var(--p-color-bg-surface-secondary)",
                borderRadius: "8px",
              }}
            >
              <InlineStack gap="300" blockAlign="center">
                <img
                  src={selectedFile.thumbnailUrl}
                  alt={selectedFile.alt || t("common.selected")}
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "cover",
                    borderRadius: "4px",
                  }}
                />
                <BlockStack gap="050">
                  <Text variant="bodyMd" fontWeight="semibold">{t("common.selected")}</Text>
                  <Text variant="bodySm" tone="subdued" truncate>
                    {selectedFile.width && selectedFile.height
                      ? `${selectedFile.width} × ${selectedFile.height} px`
                      : t("common.image")}
                  </Text>
                </BlockStack>
              </InlineStack>
            </div>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
