import { useState, useCallback, useEffect } from "react";
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
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

export default function ShopifyFilePicker({ open, onClose, onSelect }) {
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [files, setFiles] = useState([]);
  const [pageInfo, setPageInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

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
      title="Bild aus Shopify-Dateien wählen"
      primaryAction={{
        content: "Auswählen",
        onAction: handleSelect,
        disabled: !selectedFile,
      }}
      secondaryActions={[
        {
          content: "Abbrechen",
          onAction: onClose,
        },
      ]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          <TextField
            value={search}
            onChange={setSearch}
            placeholder="Dateinamen suchen..."
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
              heading="Keine Bilder gefunden"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Es wurden keine Bilder in deinen Shopify-Dateien gefunden.</p>
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
                      alt={file.alt || "Shopify Datei"}
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
                    Mehr laden
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
                  alt={selectedFile.alt || "Ausgewählt"}
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "cover",
                    borderRadius: "4px",
                  }}
                />
                <BlockStack gap="050">
                  <Text variant="bodyMd" fontWeight="semibold">Ausgewählt</Text>
                  <Text variant="bodySm" tone="subdued" truncate>
                    {selectedFile.width && selectedFile.height
                      ? `${selectedFile.width} × ${selectedFile.height} px`
                      : "Bild"}
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
