import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Editor, { DiffEditor, type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { getLocation, type JSONPath } from 'jsonc-parser';
import ReactJson from '@microlink/react-json-view';
import type { ViewMode } from './Header';

export interface JsonEditorRef {
  beautify: () => void;
  clear: () => void;
  getValue: () => string;
  setValue: (val: string) => void;
  copyToClipboard: () => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
}

interface JsonEditorProps {
  theme: 'light' | 'dark';
  minimap?: boolean;
  initialValue?: string;
  onPasteFormat?: (val: string) => void;
}

interface MetaInfo {
  size: number;
  keys: number;
  depth: number;
}

function getJsonMeta(jsonString: string): MetaInfo | null {
  try {
    const parsed = JSON.parse(jsonString);
    const size = new Blob([jsonString]).size;
    let keysCount = 0;
    let maxDepth = 0;

    function walk(obj: any, currentDepth: number) {
      if (currentDepth > maxDepth) maxDepth = currentDepth;
      if (obj !== null && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            walk(obj[i], currentDepth + 1);
          }
        } else {
          const keys = Object.keys(obj);
          keysCount += keys.length;
          for (const key of keys) {
            walk(obj[key], currentDepth + 1);
          }
        }
      }
    }
    walk(parsed, 0);
    return { size, keys: keysCount, depth: maxDepth };
  } catch (e) {
    return null;
  }
}

function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatPath(path: JSONPath) {
  if (!path || path.length === 0) return 'root';
  return ['root', ...path.map(p => (typeof p === 'number' ? `[${p}]` : p))].join(' > ');
}

export const JsonEditor = forwardRef<JsonEditorRef, JsonEditorProps>(({ theme, minimap = false, initialValue, onPasteFormat }, ref) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  
  const [isValid, setIsValid] = useState(true);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string>('root');
  
  const [diffOriginal, setDiffOriginal] = useState('{\n  "version": 1\n}');
  const [diffModified, setDiffModified] = useState('{\n  "version": 2\n}');
  const [diffLanguage, setDiffLanguage] = useState('json');
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const [viewMode, setViewModeInternal] = useState<ViewMode>('code');
  const [parsedTreeData, setParsedTreeData] = useState<any>({});

  const [isEmpty, setIsEmpty] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleBeforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('jv-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '7dd3fc' },
        { token: 'string.value.json', foreground: 'a7f3d0' },
        { token: 'number', foreground: 'fde047' },
        { token: 'keyword.json', foreground: 'c084fc' }
      ],
      colors: {
        'editor.background': '#0a0a0a',
        'editor.lineHighlightBackground': '#ffffff0a',
      }
    });

    monaco.editor.defineTheme('jv-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '0284c7' },
        { token: 'string.value.json', foreground: '059669' },
        { token: 'number', foreground: 'd97706' },
        { token: 'keyword.json', foreground: '9333ea' }
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#0000000a',
      }
    });
  };

  const updateMeta = (val: string) => {
    const newMeta = getJsonMeta(val);
    setMeta(newMeta);
  };

  const handleEditorDidMount: OnMount = (ed, monaco) => {
    editorRef.current = ed;

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: true,
    });

    setIsEmpty(ed.getValue().trim() === '');
    
    if (initialValue) {
      try {
        const parsed = JSON.parse(initialValue);
        ed.setValue(JSON.stringify(parsed, null, 2));
      } catch (e) {
        // Leave as is if invalid
      }
    }

    let debounceTimeout: ReturnType<typeof setTimeout>;

    ed.onDidChangeModelContent(() => {
      const val = ed.getValue();
      setIsEmpty(val.trim() === '');
      
      if (viewMode === 'diff') return; 
      
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        try {
          const parsed = JSON.parse(val);
          setIsValid(true);
          updateMeta(val);
          setParsedTreeData(parsed);
        } catch (e) {
          setIsValid(false);
        }
      }, 400);
    });

    ed.onDidChangeCursorPosition((e) => {
      try {
        const model = ed.getModel();
        if (!model) return;
        const offset = model.getOffsetAt(e.position);
        const text = model.getValue();
        const location = getLocation(text, offset);
        setBreadcrumb(formatPath(location.path));
      } catch (err) {
        // Ignore out of bounds position events during massive model replacements
      }
    });

    ed.onDidPaste(() => {
      setTimeout(() => {
        if (!editorRef.current) return;
        const val = editorRef.current.getValue();
        try {
          const parsed = JSON.parse(val);
          const formatted = JSON.stringify(parsed, null, 2);
          editorRef.current.setValue(formatted);
          if (onPasteFormat) {
             onPasteFormat(formatted);
          }
        } catch (e) {
          editorRef.current.getAction('editor.action.formatDocument')?.run();
        }
      }, 10);
    });

    updateMeta(ed.getValue());
  };

  const handleDiffMount = (ed: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = ed;
  };

  useImperativeHandle(ref, () => ({
    beautify: () => {
      const tryFormat = (ed: editor.IStandaloneCodeEditor) => {
        try {
          const val = ed.getValue();
          if (!val.trim()) return;
          const parsed = JSON.parse(val);
          ed.setValue(JSON.stringify(parsed, null, 2));
        } catch (e) {
          // Fallback to Monaco formatter if JSON has syntax errors
          ed.getAction('editor.action.formatDocument')?.run();
        }
      };

      if (viewMode === 'diff' && diffEditorRef.current) {
        tryFormat(diffEditorRef.current.getOriginalEditor());
        tryFormat(diffEditorRef.current.getModifiedEditor());
      } else if (editorRef.current) {
        tryFormat(editorRef.current);
      }
    },
    clear: () => {
      if (viewMode === 'diff') {
        setDiffOriginal('');
        setDiffModified('');
      } else if (editorRef.current) {
        editorRef.current.setValue('');
      }
    },
    getValue: () => {
      if (viewMode === 'diff') {
        return diffEditorRef.current?.getModifiedEditor().getValue() || '';
      }
      return editorRef.current?.getValue() || '';
    },
    setValue: (val: string) => {
      if (viewMode === 'diff' && diffEditorRef.current) {
        diffEditorRef.current.getModifiedEditor().setValue(val);
      } else if (editorRef.current) {
        editorRef.current.setValue(val);
      }
    },
    copyToClipboard: async () => {
      const val = viewMode === 'diff' 
        ? diffEditorRef.current?.getModifiedEditor().getValue() || ''
        : editorRef.current?.getValue() || '';
      try {
        await navigator.clipboard.writeText(val);
      } catch (err) {}
    },
    setViewMode: (mode: ViewMode) => {
      if (mode === 'diff' && viewMode !== 'diff') {
        const val = editorRef.current?.getValue() || '';
        setDiffOriginal(val);
        setDiffModified(val);
      }
      if (mode === 'tree') {
        try {
          const val = editorRef.current?.getValue() || '';
          setParsedTreeData(JSON.parse(val));
        } catch (e) {}
      }
      setViewModeInternal(mode);
    }
  }));

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content && editorRef.current && viewMode !== 'diff') {
          try {
            const parsed = JSON.parse(content);
            editorRef.current.setValue(JSON.stringify(parsed, null, 2));
          } catch (e) {
            editorRef.current.setValue(content);
            editorRef.current.getAction('editor.action.formatDocument')?.run();
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="editor-card">
      <div className="editor-header">
        <div className="breadcrumbs" title={breadcrumb}>
          {viewMode === 'diff' ? 'Diff Mode (Original vs Modified)' : breadcrumb}
        </div>
        {viewMode === 'diff' && (() => {
          const LANGUAGES = [
            { id: 'json', name: 'JSON' },
            { id: 'javascript', name: 'JavaScript' },
            { id: 'typescript', name: 'TypeScript' },
            { id: 'python', name: 'Python' },
            { id: 'java', name: 'Java' },
            { id: 'go', name: 'Go' },
            { id: 'html', name: 'HTML' },
            { id: 'css', name: 'CSS' },
            { id: 'yaml', name: 'YAML' },
            { id: 'xml', name: 'XML' },
            { id: 'sql', name: 'SQL' },
            { id: 'markdown', name: 'Markdown' },
            { id: 'plaintext', name: 'Plain Text' }
          ];
          return (
            <div className="diff-lang-selector" style={{ position: 'relative' }}>
              <button 
                className="seg-btn" 
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                onBlur={() => setTimeout(() => setShowLangDropdown(false), 200)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
              >
                {LANGUAGES.find(l => l.id === diffLanguage)?.name}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              {showLangDropdown && (
                <div className="history-dropdown" style={{ right: 0, left: 'auto', width: '200px', top: '100%', marginTop: '4px' }}>
                  <ul className="history-list" style={{ maxHeight: '250px' }}>
                    {LANGUAGES.map(lang => (
                      <li 
                        key={lang.id} 
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDiffLanguage(lang.id);
                          setShowLangDropdown(false);
                        }}
                        style={{ 
                          padding: '8px 16px',
                          backgroundColor: diffLanguage === lang.id ? 'var(--btn-hover)' : 'transparent',
                          fontWeight: diffLanguage === lang.id ? 600 : 400,
                          fontSize: '13px'
                        }}
                      >
                        {lang.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}
        {viewMode !== 'diff' && (
          <div className="meta-info">
            {meta ? (
              <>
                <span>Size: {formatBytes(meta.size)}</span>
                <span>Keys: {meta.keys.toLocaleString()}</span>
                <span>Depth: {meta.depth}</span>
              </>
            ) : (
              <span>Invalid JSON</span>
            )}
            <div className="editor-status" style={{ marginLeft: '8px' }}>
              <span className={`status-dot ${!isValid ? 'error' : ''}`}></span>
            </div>
          </div>
        )}
      </div>
      <div 
        className={`editor-content ${isDragging ? 'dragging' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {(!viewMode.includes('diff') && isEmpty) && (
          <div className="empty-state">
            <div className="empty-state-content">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <h3>Drop your JSON here</h3>
              <p>Paste text, or drag and drop a .json file directly into this window</p>
            </div>
          </div>
        )}
        
        <div 
          style={{ 
            position: 'absolute', inset: 0, 
            zIndex: viewMode === 'tree' ? 1 : -1, 
            opacity: viewMode === 'tree' ? 1 : 0, 
            pointerEvents: viewMode === 'tree' ? 'auto' : 'none',
            visibility: viewMode === 'tree' ? 'visible' : 'hidden',
            overflow: 'auto',
            padding: '24px',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          {viewMode === 'tree' && isValid && (
            <ReactJson 
              src={parsedTreeData} 
              theme={theme === 'dark' ? 'twilight' : 'rjv-default'} 
              style={{ backgroundColor: 'transparent', fontFamily: 'var(--font-mono)', fontSize: '14px' }}
              displayDataTypes={false}
              displayObjectSize={true}
              enableClipboard={true}
              collapsed={2}
            />
          )}
          {viewMode === 'tree' && !isValid && (
            <div className="empty-state" style={{ pointerEvents: 'auto' }}>
              <div className="empty-state-content">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5, color: '#ef4444' }}>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 style={{ color: '#ef4444' }}>Invalid JSON</h3>
                <p>Please fix syntax errors in Code mode before viewing the tree.</p>
              </div>
            </div>
          )}
        </div>

        <div 
          style={{ 
            position: 'absolute', inset: 0, 
            zIndex: viewMode === 'diff' ? 1 : -1, 
            opacity: viewMode === 'diff' ? 1 : 0, 
            pointerEvents: viewMode === 'diff' ? 'auto' : 'none',
            visibility: viewMode === 'diff' ? 'visible' : 'hidden'
          }}
        >
          <DiffEditor
            height="100%"
            language={diffLanguage}
            theme={theme === 'dark' ? 'jv-dark' : 'jv-light'}
            original={diffOriginal}
            modified={diffModified}
            onMount={handleDiffMount}
            beforeMount={handleBeforeMount}
            options={{
              originalEditable: true,
              minimap: { enabled: minimap },
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              padding: { top: 16, bottom: 16 }
            }}
          />
        </div>
        
        <div 
          style={{ 
            position: 'absolute', inset: 0, 
            zIndex: viewMode === 'code' ? 1 : -1, 
            opacity: viewMode === 'code' ? 1 : 0, 
            pointerEvents: viewMode === 'code' ? 'auto' : 'none',
            visibility: viewMode === 'code' ? 'visible' : 'hidden'
          }}
        >
          <Editor
            path="standard-editor.json"
            height="100%"
            defaultLanguage="json"
            theme={theme === 'dark' ? 'jv-dark' : 'jv-light'}
            onMount={handleEditorDidMount}
            beforeMount={handleBeforeMount}
            options={{
              minimap: { enabled: minimap },
              fontSize: 14,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
              showFoldingControls: 'always',
              formatOnPaste: false,
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              fontFamily: 'var(--font-mono)'
            }}
            defaultValue={initialValue || `{\n  "server": "jv-production-01",\n  "status": "online",\n  "uptime": 1284592,\n  "metrics": {\n    "cpuLoad": 42.5,\n    "memoryUsed": "12GB",\n    "activeConnections": 1042\n  },\n  "endpoints": [\n    { "path": "/api/users", "latency": "42ms" },\n    { "path": "/api/auth", "latency": "120ms" }\n  ],\n  "message": "Paste your JSON payload here to start inspecting!"\n}`}
          />
        </div>
      </div>
    </div>
  );
});

JsonEditor.displayName = 'JsonEditor';
