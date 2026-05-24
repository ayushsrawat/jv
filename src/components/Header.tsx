import React, { useState, useEffect, useRef } from "react";
import { Moon, Sun, Copy, Trash2, History, Download, Share2, Wand2 } from "lucide-react";
import type { HistoryItem } from "../hooks/useHistory";

export type ViewMode = "code" | "tree" | "diff";

interface HeaderProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  onBeautify: () => void;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onOpenCmdk: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  toggleTheme,
  onBeautify,
  onClear,
  onCopy,
  onDownload,
  onShare,
  viewMode,
  onChangeViewMode,
  onOpenCmdk,
  history,
  onSelectHistory,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEvents = (e: MouseEvent | KeyboardEvent) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key === "Escape") {
        setShowHistory(false);
      }
      if (e.type === "mousedown" && historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) {
      document.addEventListener("mousedown", handleEvents);
      document.addEventListener("keydown", handleEvents);
    }
    return () => {
      document.removeEventListener("mousedown", handleEvents);
      document.removeEventListener("keydown", handleEvents);
    };
  }, [showHistory]);

  return (
    <div className="header-card">
      <div className="header-brand">
        <div className="logo-container">{"{}"}</div>
        <div className="brand-text" style={{ marginRight: "16px" }}>
          <h1 className="brand-title">jv</h1>
          <span className="brand-subtitle">JSON Viewer</span>
        </div>

        <button
          className="btn btn-icon"
          onClick={toggleTheme}
          data-tooltip="Toggle Theme"
          style={{ width: 32, height: 32, marginRight: "4px" }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <button
          onClick={onOpenCmdk}
          className="btn"
          style={{
            height: 32,
            padding: "0 12px",
            fontSize: "13px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
            fontWeight: 600,
            background: "var(--bg-toolbar)",
            border: "1px solid var(--border-color)",
            boxShadow: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={`Open Command Palette (${navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘K" : "Ctrl+K"})`}
        >
          {navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘K" : "Ctrl+K"}
        </button>
      </div>

      <div className="toolbar">
        <div className="segmented-control" style={{ marginRight: "8px" }}>
          <button className={`seg-btn ${viewMode === "code" ? "active" : ""}`} onClick={() => onChangeViewMode("code")}>
            Code
          </button>
          <button className={`seg-btn ${viewMode === "tree" ? "active" : ""}`} onClick={() => onChangeViewMode("tree")}>
            Tree
          </button>
          <button className={`seg-btn ${viewMode === "diff" ? "active" : ""}`} onClick={() => onChangeViewMode("diff")}>
            Diff
          </button>
        </div>

        <button className="btn btn-expandable" onClick={onBeautify}>
          <Wand2 size={16} />
          <div className="btn-text-wrapper">
            <span className="btn-text">Beautify</span>
          </div>
        </button>

        <div ref={historyRef} style={{ position: "relative" }}>
          <button
            className={`btn btn-expandable ${showHistory ? "active" : ""}`}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={16} />
            <div className="btn-text-wrapper">
              <span className="btn-text">Payloads</span>
            </div>
          </button>

          {showHistory && (
            <div className="history-dropdown">
              <div className="history-header">Recent Payloads</div>
              {history.length === 0 ? (
                <div className="history-empty">No history yet</div>
              ) : (
                <ul className="history-list">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      onClick={() => {
                        onSelectHistory(item);
                        setShowHistory(false);
                      }}
                    >
                      <div className="history-time">{new Date(item.timestamp).toLocaleTimeString()}</div>
                      <div className="history-snippet">{item.data.substring(0, 40)}...</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-expandable" onClick={onShare}>
          <Share2 size={16} />
          <div className="btn-text-wrapper">
            <span className="btn-text">Share</span>
          </div>
        </button>

        <button className="btn btn-expandable" onClick={onDownload}>
          <Download size={16} />
          <div className="btn-text-wrapper">
            <span className="btn-text">Export</span>
          </div>
        </button>

        <button className="btn btn-expandable" onClick={onCopy}>
          <Copy size={16} />
          <div className="btn-text-wrapper">
            <span className="btn-text">Copy</span>
          </div>
        </button>

        <button className="btn btn-expandable" onClick={onClear}>
          <Trash2 size={16} />
          <div className="btn-text-wrapper">
            <span className="btn-text">Clear</span>
          </div>
        </button>
      </div>
    </div>
  );
};
