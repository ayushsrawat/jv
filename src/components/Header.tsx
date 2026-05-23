import React, { useState } from 'react';
import { Sun, Moon, Wand2, Copy, Trash2, Download, History } from 'lucide-react';
import type { HistoryItem } from '../hooks/useHistory';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onBeautify: () => void;
  onClear: () => void;
  onCopy: () => void;
  onDownload: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  theme, toggleTheme, onBeautify, onClear, onCopy, onDownload, history, onSelectHistory 
}) => {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <header className="header-card">
      <div className="header-brand">
        <div className="logo-container">
          {'{ }'}
        </div>
        <div className="brand-text">
          <h1 className="brand-title">jv</h1>
          <span className="brand-subtitle">JSON Viewer</span>
        </div>
      </div>
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <button 
            className={`btn ${showHistory ? 'active' : ''}`} 
            onClick={() => setShowHistory(!showHistory)} 
            title="History"
          >
            <History size={16} />
            <span className="btn-text">Payloads</span>
          </button>
          
          {showHistory && (
            <div className="history-dropdown">
              <div className="history-header">Recent Payloads</div>
              {history.length === 0 ? (
                <div className="history-empty">No history yet</div>
              ) : (
                <ul className="history-list">
                  {history.map(item => (
                    <li key={item.id} onClick={() => { onSelectHistory(item); setShowHistory(false); }}>
                      <div className="history-time">{new Date(item.timestamp).toLocaleTimeString()}</div>
                      <div className="history-snippet">{item.snippet}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button className="btn" onClick={onDownload} title="Download JSON">
          <Download size={16} />
          <span className="btn-text">Export</span>
        </button>
        <button className="btn" onClick={onCopy} title="Copy JSON">
          <Copy size={16} />
          <span className="btn-text">Copy</span>
        </button>
        <button className="btn" onClick={onClear} title="Clear Editor">
          <Trash2 size={16} />
          <span className="btn-text">Clear</span>
        </button>
        <button className="btn btn-primary" onClick={onBeautify} title="Format JSON">
          <Wand2 size={16} />
          <span className="btn-text">Beautify</span>
        </button>
        <button className="btn btn-icon" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
};
