import { useRef, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { JSONPath } from 'jsonpath-plus';
import LZString from 'lz-string';

import { Header } from './components/Header';
import { JsonEditor, type JsonEditorRef } from './components/JsonEditor';
import { CommandPalette } from './components/CommandPalette';
import { useTheme } from './hooks/useTheme';
import { useHistory } from './hooks/useHistory';

const QUERY_HISTORY_KEY = 'jv-query-history';

function extractPaths(obj: any, currentPath = '$', depth = 0): string[] {
  if (depth > 5) return []; // limit recursion
  let paths: string[] = [];
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      paths.push(currentPath + '[*]');
      if (obj.length > 0) {
        paths = paths.concat(extractPaths(obj[0], currentPath + '[*]', depth + 1));
      }
    } else {
      for (const key of Object.keys(obj)) {
        const newPath = currentPath + '.' + key;
        paths.push(newPath);
        paths = paths.concat(extractPaths(obj[key], newPath, depth + 1));
      }
    }
  }
  return paths;
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const { history, saveToHistory } = useHistory();
  const editorRef = useRef<JsonEditorRef>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showQueryDropdown, setShowQueryDropdown] = useState(false);
  const [originalData, setOriginalData] = useState<string | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [query, showQueryDropdown]);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[highlightIndex] as HTMLElement;
      if (activeItem && activeItem.scrollIntoView) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#data=')) {
      try {
        const compressed = hash.replace('#data=', '');
        const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
        if (decompressed) {
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.setValue(decompressed);
              editorRef.current.beautify();
              window.history.replaceState(null, '', window.location.pathname);
              showToast('Loaded shared JSON payload');
            }
          }, 500);
        }
      } catch (e) {
        console.error('Failed to parse shared data');
      }
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(QUERY_HISTORY_KEY);
      if (stored) setQueryHistory(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const saveQueryHistory = (newQuery: string) => {
    if (!newQuery.trim()) return;
    setQueryHistory(prev => {
      const filtered = prev.filter(q => q !== newQuery);
      const updated = [newQuery, ...filtered].slice(0, 5);
      localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleBeautify = () => {
    editorRef.current?.beautify();
    if (!isDiffMode) {
      setTimeout(() => {
        const val = editorRef.current?.getValue();
        if (val) saveToHistory(val);
      }, 100);
    }
  };

  const handleClear = () => {
    editorRef.current?.clear();
    setQuery('');
    setOriginalData(null);
  };

  const handleCopy = async () => {
    await editorRef.current?.copyToClipboard();
  };

  const handleDownload = () => {
    const val = editorRef.current?.getValue() || '';
    if (!val.trim()) return;

    const blob = new Blob([val], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jv-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    const val = editorRef.current?.getValue() || '';
    if (!val.trim()) return;
    
    const compressed = LZString.compressToEncodedURIComponent(val);
    const url = `${window.location.origin}${window.location.pathname}#data=${compressed}`;
    
    navigator.clipboard.writeText(url).then(() => {
      showToast('Shareable link copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy to clipboard.');
    });
  };

  const handleToggleDiff = () => {
    const nextMode = !isDiffMode;
    setIsDiffMode(nextMode);
    editorRef.current?.toggleDiffMode(nextMode);
  };

  const handleFocusQuery = () => {
    if (queryInputRef.current && !isDiffMode) {
      queryInputRef.current.focus();
    }
  };

  const handleQueryInputFocus = () => {
    setShowQueryDropdown(true);
    try {
      const val = originalData || editorRef.current?.getValue() || '';
      const parsed = JSON.parse(val);
      const paths = extractPaths(parsed);
      setSuggestions(Array.from(new Set(paths)));
    } catch (e) {
      setSuggestions([]);
    }
  };

  const handleApplyQuery = (qToApply?: string) => {
    const q = qToApply || query;
    if (!q.trim() || isDiffMode) return;
    
    try {
      const currentVal = originalData || editorRef.current?.getValue() || '';
      const parsed = JSON.parse(currentVal);
      const result = JSONPath({ path: q, json: parsed });
      
      if (!originalData) setOriginalData(currentVal);
      
      editorRef.current?.setValue(JSON.stringify(result, null, 2));
      saveQueryHistory(q);
      setShowQueryDropdown(false);
      setHighlightIndex(-1);
    } catch (err) {
      showToast('Invalid JSON payload or path.');
    }
  };

  const handleResetQuery = () => {
    if (originalData && !isDiffMode) {
      editorRef.current?.setValue(originalData);
      setOriginalData(null);
    }
    setQuery('');
  };

  return (
    <div className="app-container">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        onBeautify={handleBeautify}
        onClear={handleClear}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onShare={handleShare}
        isDiffMode={isDiffMode}
        onToggleDiff={handleToggleDiff}
        onOpenCmdk={() => setCmdkOpen(true)}
        history={history}
        onSelectHistory={(item) => !isDiffMode && editorRef.current?.setValue(item.data)}
      />
      
      {!isDiffMode && (() => {
        const displayList = query ? suggestions.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : queryHistory;

        const handleQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Escape') {
            setShowQueryDropdown(false);
            setHighlightIndex(-1);
            queryInputRef.current?.blur();
            return;
          }
          if (showQueryDropdown && displayList.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightIndex(prev => (prev < displayList.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightIndex(prev => (prev > 0 ? prev - 1 : displayList.length - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (highlightIndex >= 0 && highlightIndex < displayList.length) {
                const selected = displayList[highlightIndex];
                setQuery(selected);
                handleApplyQuery(selected);
              } else {
                handleApplyQuery();
              }
            }
          } else {
            if (e.key === 'Enter') handleApplyQuery();
          }
        };

        return (
          <div className="query-bar">
            <div className="query-input-wrapper">
              <Search size={16} className="query-icon" />
              <input 
                ref={queryInputRef}
                type="text" 
                className="query-input" 
                placeholder="JSON Path query (e.g. $.store.book[*].author)" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={handleQueryInputFocus}
                onBlur={() => setTimeout(() => setShowQueryDropdown(false), 200)}
                onKeyDown={handleQueryKeyDown}
              />
              {query && (
                <button className="btn btn-icon" onClick={handleResetQuery} style={{ width: 24, height: 24, background: 'none' }}>
                  <X size={14} />
                </button>
              )}

              {showQueryDropdown && displayList.length > 0 && (
                <div className="query-history-dropdown">
                  {!query && <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border-color)' }}>RECENT QUERIES</div>}
                  {query && <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border-color)' }}>AUTO-COMPLETE</div>}
                  <ul className="query-history-list" ref={listRef}>
                    {displayList.map((q, i) => (
                      <li 
                        key={i} 
                        style={{ 
                          backgroundColor: i === highlightIndex ? 'var(--text-main)' : 'transparent', 
                          color: i === highlightIndex ? 'var(--bg-card)' : 'var(--text-main)' 
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setQuery(q);
                          handleApplyQuery(q);
                        }}
                      >
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {originalData && (
              <button className="btn" onClick={handleResetQuery} title="Restore original JSON">
                Reset
              </button>
            )}
            <button className="btn btn-primary" onClick={() => handleApplyQuery()}>Apply</button>
          </div>
        );
      })()}

      <JsonEditor ref={editorRef} theme={theme} onPasteFormat={!isDiffMode ? saveToHistory : undefined} />

      <CommandPalette 
        open={cmdkOpen} 
        setOpen={setCmdkOpen} 
        theme={theme}
        isDiffMode={isDiffMode}
        actions={{
          beautify: handleBeautify,
          clear: handleClear,
          copy: handleCopy,
          download: handleDownload,
          share: handleShare,
          focusQuery: handleFocusQuery,
          toggleTheme: toggleTheme,
          toggleDiff: handleToggleDiff
        }} 
      />

      {toastMsg && (
        <div className="toast">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default App;
