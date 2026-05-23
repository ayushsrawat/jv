import React from 'react';
import { Sun, Moon, Wand2, Copy, Trash2 } from 'lucide-react';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onBeautify: () => void;
  onClear: () => void;
  onCopy: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, onBeautify, onClear, onCopy }) => {
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
