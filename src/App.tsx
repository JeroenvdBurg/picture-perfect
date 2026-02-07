import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { uploadFileToEvroc } from "./evroc-upload";
import "./App.css";
import { postBlurImage, postSegmentImage } from "./lib/image_ai";

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "uploading" | "success" | "error";
}

interface BucketFile {
  key: string;
  size: number;
  lastModified: string;
  url: string;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info" | "confirm";
  onConfirm?: () => void;
  onCancel?: () => void;
}

type TabType = "upload" | "gallery";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<
    Map<string, UploadProgress>
  >(new Map());
  const [files, setFiles] = useState<BucketFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastCounter, setToastCounter] = useState(0);

  const addToast = useCallback(
    (
      message: string,
      type: Toast["type"],
      onConfirm?: () => void,
      onCancel?: () => void,
    ) => {
      const id = toastCounter;
      setToastCounter(id + 1);
      setToasts((prev) => [
        ...prev,
        { id, message, type, onConfirm, onCancel },
      ]);

      // Auto-remove non-confirm toasts after 5 seconds
      if (type !== "confirm") {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
      }
    },
    [toastCounter],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    console.log("[App] 📂 Loading files from bucket");
    try {
      const response = await fetch("/api/files");
      if (!response.ok) throw new Error("Failed to load files");
      const data = await response.json();
      setFiles(data.files);
      console.log(`[App] ✅ Loaded ${data.files.length} file(s)`);
    } catch (error) {
      console.error("[App] ❌ Error loading files:", error);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      console.log(`[App] 📁 Files dropped: ${acceptedFiles.length} file(s)`);
      acceptedFiles.forEach((file) => {
        console.log(
          `[App]   - ${file.name} (${file.type}, ${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        );
      });

      setUploading(true);
      const newProgress = new Map<string, UploadProgress>();

      // Initialize progress for all files
      acceptedFiles.forEach((file) => {
        newProgress.set(file.name, {
          fileName: file.name,
          progress: 0,
          status: "uploading",
        });
      });
      setUploadProgress(newProgress);

      for (const file of acceptedFiles) {
        try {
          await uploadFileToEvroc(file, (progress) => {
            setUploadProgress((prev) => {
              const updated = new Map(prev);
              const current = updated.get(file.name);
              if (current) {
                updated.set(file.name, { ...current, progress });
              }
              return updated;
            });
          });

          setUploadProgress((prev) => {
            const updated = new Map(prev);
            const current = updated.get(file.name);
            if (current) {
              updated.set(file.name, {
                ...current,
                status: "success",
                progress: 100,
              });
            }
            return updated;
          });
          addToast(`Uploaded: ${file.name}`, "success");
        } catch (error) {
          console.error(error);
          setUploadProgress((prev) => {
            const updated = new Map(prev);
            const current = updated.get(file.name);
            if (current) {
              updated.set(file.name, { ...current, status: "error" });
            }
            return updated;
          });
          addToast(`Failed: ${file.name}`, "error");
        }
      }

      setUploading(false);
      console.log(`[App] 🏁 All uploads completed`);
      // Clear progress after 2 seconds
      setTimeout(() => setUploadProgress(new Map()), 2000);
      // Refresh gallery if on that tab
      if (activeTab === "gallery") {
        loadFiles();
      }
    },
    [activeTab, addToast, loadFiles],
  );

  const deleteFile = useCallback(
    async (fileKey: string) => {
      const fileName = fileKey.split("/").pop() || "file";

      addToast(`Delete "${fileName}"?`, "confirm", async () => {
        console.log(`[App] 🗑️ Deleting file: ${fileKey}`);
        try {
          const response = await fetch(`/api/files/${fileKey}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete file");
          console.log(`[App] ✅ File deleted: ${fileKey}`);
          addToast(`Deleted: ${fileName}`, "success");
          // Refresh the gallery
          loadFiles();
        } catch (error) {
          console.error("[App] ❌ Error deleting file:", error);
          addToast(`Failed to delete: ${fileName}`, "error");
        }
      });
    },
    [loadFiles, addToast],
  );

  useEffect(() => {
    if (activeTab === "gallery") {
      loadFiles();
    }
  }, [activeTab, loadFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  return (
    <div className="container">
      <div className="header">
        <div className="logo">
          <span className="logo-icon">📸</span>
          <h1 className="logo-text">Picture Perfect</h1>
        </div>
        <p className="tagline">Powered by European Cloud Infrastructure 🇪🇺</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          <span className="tab-icon">📤</span>
          <span>Upload</span>
        </button>
        <button
          className={`tab ${activeTab === "gallery" ? "active" : ""}`}
          onClick={() => setActiveTab("gallery")}
        >
          <span className="tab-icon">🖼️</span>
          <span>Gallery</span>
        </button>
      </div>

      {activeTab === "upload" && (
        <>
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? "active" : ""}`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <p className="dropzone-text">
                <span className="dropzone-icon">✨</span>
                Drop your images now...
              </p>
            ) : (
              <p className="dropzone-text">
                <span className="dropzone-icon">☁️</span>
                Drag & drop images here, or click to browse
                <span className="dropzone-subtext">
                  Securely stored in European data centers
                </span>
              </p>
            )}
          </div>

          {uploading && uploadProgress.size > 0 && (
            <div className="upload-progress-container">
              {Array.from(uploadProgress.values()).map((item) => (
                <div key={item.fileName} className="progress-item">
                  <div className="progress-info">
                    <span className="progress-filename">{item.fileName}</span>
                    <span className="progress-percent">{item.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-bar-fill ${item.status}`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "gallery" && (
        <div className="gallery-container">
          <div className="gallery-header">
            <div>
              <h2 className="gallery-title">Your Collection</h2>
              <p className="gallery-subtitle">All your images in one place</p>
            </div>
            <button
              className="refresh-btn"
              onClick={loadFiles}
              disabled={loadingFiles}
            >
              <span className="btn-icon">{loadingFiles ? "⏳" : "🔄"}</span>
              {loadingFiles ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loadingFiles && files.length === 0 ? (
            <div className="state-message">
              <span className="state-icon">⏳</span>
              <p>Loading your images...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="state-message">
              <span className="state-icon">📦</span>
              <p>No images yet</p>
              <p className="state-subtext">
                Upload your first image to get started!
              </p>
            </div>
          ) : (
            <div className="gallery-grid">
              {files.map((file) => (
                <div key={file.key} className="gallery-item">
                  <div className="gallery-image-container">
                    <img
                      src={file.url}
                      alt={file.key.split("/").pop()}
                      className="gallery-image"
                      loading="lazy"
                    />
                  </div>
                  <div className="gallery-info">
                    <div className="gallery-filename">
                      {file.key.split("/").pop()}
                    </div>
                    <div className="gallery-meta">
                      <span className="gallery-size">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <span className="gallery-date">
                        {new Date(file.lastModified).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="gallery-actions">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gallery-link"
                    >
                      🔗 Open
                    </a>
                    <button
                      onClick={() => deleteFile(file.key)}
                      className="gallery-delete-btn"
                      title="Delete image"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                  <BlurItem file={file} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-content">
              <span className="toast-icon">
                {toast.type === "success" && "✅"}
                {toast.type === "error" && "❌"}
                {toast.type === "info" && "ℹ️"}
                {toast.type === "confirm" && "⚠️"}
              </span>
              <span className="toast-message">{toast.message}</span>
            </div>
            {toast.type === "confirm" ? (
              <div className="toast-actions">
                <button
                  className="toast-btn toast-btn-confirm"
                  onClick={() => {
                    toast.onConfirm?.();
                    removeToast(toast.id);
                  }}
                >
                  Delete
                </button>
                <button
                  className="toast-btn toast-btn-cancel"
                  onClick={() => {
                    toast.onCancel?.();
                    removeToast(toast.id);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="toast-close"
                onClick={() => removeToast(toast.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

function BlurItem({ file }: { file: BucketFile }) {
  const [visualizationImage, setVisualizationImage] = useState<string>("");
  const [blurImage, setBlurImage] = useState<string>("");
  const [isBlurring, setIsBlurring] = useState<boolean>(false);
  const [blurPrompt, setBlurPrompt] = useState<string>("");

  const handleClickBlur = async () => {
    const segmentResponse = await postSegmentImage({
      imageUrl: window.location.origin + file.url,
      textPrompt: blurPrompt,
    });

    console.log("segment response", segmentResponse);
    if (!segmentResponse.ok) {
      throw new Error(segmentResponse.error);
    }

    const segmentData = segmentResponse.data as {
      visualization: string;
      maskData: string;
    };
    setVisualizationImage(segmentData.visualization);

    const blurResponse = await postBlurImage({
      imageUrl: window.location.origin + file.url,
      maskData: segmentData.maskData,
    });

    console.log("blur response", blurResponse);

    if (!blurResponse.ok) {
      throw new Error(blurResponse.error);
    }

    const blurData = blurResponse.data as { image: string };
    setBlurImage(blurData.image);
  };

  return (
    <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
      <div className="radio-group">
        <label
          className={`radio-label ${blurPrompt === "face" ? "active" : ""}`}
        >
          <input
            type="radio"
            name={`blurOption-${file.key}`}
            value="face"
            checked={blurPrompt === "face"}
            onChange={() => setBlurPrompt("face")}
            className="radio-input"
          />
          👤 Face
        </label>
        <label
          className={`radio-label ${blurPrompt !== "face" && blurPrompt !== "" ? "active" : ""}`}
        >
          <input
            type="radio"
            name={`blurOption-${file.key}`}
            value="object"
            checked={blurPrompt !== "face" && blurPrompt !== ""}
            onChange={() => setBlurPrompt("")}
            className="radio-input"
          />
          📦 Object
        </label>
      </div>
      <div>
        <label htmlFor={`blurPrompt-${file.key}`}>Blur Prompt</label>
        <input
          type="text"
          id={`blurPrompt-${file.key}`}
          value={blurPrompt}
          onChange={(e) => setBlurPrompt(e.target.value)}
        />
      </div>

      <button
        className="gallery-link"
        disabled={isBlurring || !blurPrompt}
        onClick={() => {
          setIsBlurring(true);
          handleClickBlur().finally(() => {
            setIsBlurring(false);
          });
        }}
      >
        🔄 Blur
      </button>

      {visualizationImage && (
        <div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#667eea",
              marginBottom: "0.5rem",
            }}
          >
            Segmentation
          </p>
          <a
            href={visualizationImage}
            download={`segmentation-${file.key.split("/").pop()}`}
          >
            <img
              src={visualizationImage}
              alt="Visualization"
              style={{ width: "100%", borderRadius: "8px", cursor: "pointer" }}
            />
          </a>
        </div>
      )}

      {blurImage && (
        <div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#667eea",
              marginBottom: "0.5rem",
            }}
          >
            Blurred
          </p>
          <a href={blurImage} download={`blurred-${file.key.split("/").pop()}`}>
            <img
              src={blurImage}
              alt="Blurred"
              style={{ width: "100%", borderRadius: "8px", cursor: "pointer" }}
            />
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
