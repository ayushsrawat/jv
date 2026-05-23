import { useRef, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { JSONPath } from 'jsonpath-plus';
import { Header } from './components/Header';
import { JsonEditor, type JsonEditorRef } from './components/JsonEditor';
import { useTheme } from './hooks/useTheme';
import { useHistory } from './hooks/useHistory';

const QUERY_HISTORY_KEY = 'jv-query-history';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { history, saveToHistory } = useHistory();
  const editorRef = useRef<JsonEditorRef>(null);

  const [query, setQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [showQueryDropdown, setShowQueryDropdown] = useState(false);
  const [originalData, setOriginalData] = useState<string | null>(null);

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
    
    setTimeout(() => {
      const val = editorRef.current?.getValue();
      if (val) {
        saveToHistory(val);
      }
    }, 100);
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

  const handleApplyQuery = (qToApply?: string) => {
    const q = qToApply || query;
    if (!q.trim()) return;
    
    try {
      const currentVal = originalData || editorRef.current?.getValue() || '';
      const parsed = JSON.parse(currentVal);
      
      const result = JSONPath({ path: q, json: parsed });
      
      if (!originalData) {
        setOriginalData(currentVal);
      }
      
      editorRef.current?.setValue(JSON.stringify(result, null, 2));
      saveQueryHistory(q);
      setShowQueryDropdown(false);
    } catch (err) {
      console.error('Query Error:', err);
      alert('Invalid JSON payload for querying or invalid path.');
    }
  };

  const handleResetQuery = () => {
    if (originalData) {
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
        history={history}
        onSelectHistory={(item) => editorRef.current?.setValue(item.data)}
      />
      
      <div className="query-bar">
        <div className="query-input-wrapper">
          <Search size={16} className="query-icon" />
          <input 
            type="text" 
            className="query-input" 
            placeholder="JSON Path query (e.g. $.store.book[*].author)" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowQueryDropdown(true)}
            onBlur={() => setTimeout(() => setShowQueryDropdown(false), 200)}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyQuery()}
          />
          {query && (
            <button className="btn btn-icon" onClick={handleResetQuery} style={{ width: 24, height: 24, background: 'none' }}>
              <X size={14} />
            </button>
          )}

          {showQueryDropdown && queryHistory.length > 0 && (
            <div className="query-history-dropdown">
              <ul className="query-history-list">
                {queryHistory.map((q, i) => (
                  <li key={i} onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(q);
                    handleApplyQuery(q);
                  }}>
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

      <JsonEditor ref={editorRef} theme={theme} onPasteFormat={saveToHistory} />
    </div>
  );
}

export default App;
