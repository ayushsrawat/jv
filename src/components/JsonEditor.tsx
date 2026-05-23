import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Editor, { DiffEditor, type OnMount, type BeforeMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { getLocation, type JSONPath } from 'jsonc-parser';

export interface JsonEditorRef {
  beautify: () => void;
  clear: () => void;
  getValue: () => string;
  setValue: (val: string) => void;
  copyToClipboard: () => Promise<void>;
  toggleDiffMode: (diffMode: boolean) => void;
}

interface JsonEditorProps {
  theme: 'light' | 'dark';
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

export const JsonEditor = forwardRef<JsonEditorRef, JsonEditorProps>(({ theme, onPasteFormat }, ref) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  
  const [isValid, setIsValid] = useState(true);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string>('root');
  
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [diffOriginal, setDiffOriginal] = useState('{\n  "version": 1\n}');
  const [diffModified, setDiffModified] = useState('{\n  "version": 2\n}');

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

    let debounceTimeout: ReturnType<typeof setTimeout>;

    ed.onDidChangeModelContent(() => {
      const val = ed.getValue();
      setIsEmpty(val.trim() === '');
      
      if (isDiffMode) return; 
      
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        try {
          JSON.parse(val);
          setIsValid(true);
          updateMeta(val);
        } catch (e) {
          setIsValid(false);
        }
      }, 400);
    });

    ed.onDidChangeCursorPosition((e) => {
      const model = ed.getModel();
      if (!model) return;
      const offset = model.getOffsetAt(e.position);
      const text = model.getValue();
      const location = getLocation(text, offset);
      setBreadcrumb(formatPath(location.path));
    });

    ed.onDidPaste(() => {
      const val = ed.getValue();
      try {
        JSON.parse(val);
        ed.getAction('editor.action.formatDocument')?.run().then(() => {
          if (onPasteFormat) {
             const newVal = ed.getValue();
             onPasteFormat(newVal);
          }
        });
      } catch (e) {}
    });

    updateMeta(ed.getValue());
  };

  const handleDiffMount = (ed: editor.IStandaloneDiffEditor) => {
    diffEditorRef.current = ed;
  };

  useImperativeHandle(ref, () => ({
    beautify: () => {
      if (isDiffMode && diffEditorRef.current) {
        diffEditorRef.current.getOriginalEditor().getAction('editor.action.formatDocument')?.run();
        diffEditorRef.current.getModifiedEditor().getAction('editor.action.formatDocument')?.run();
      } else if (editorRef.current) {
        editorRef.current.getAction('editor.action.formatDocument')?.run();
      }
    },
    clear: () => {
      if (isDiffMode) {
        setDiffOriginal('');
        setDiffModified('');
      } else if (editorRef.current) {
        editorRef.current.setValue('');
      }
    },
    getValue: () => {
      if (isDiffMode) {
        return diffEditorRef.current?.getModifiedEditor().getValue() || '';
      }
      return editorRef.current?.getValue() || '';
    },
    setValue: (val: string) => {
      if (isDiffMode && diffEditorRef.current) {
        diffEditorRef.current.getModifiedEditor().setValue(val);
      } else if (editorRef.current) {
        editorRef.current.setValue(val);
      }
    },
    copyToClipboard: async () => {
      const val = isDiffMode 
        ? diffEditorRef.current?.getModifiedEditor().getValue() || ''
        : editorRef.current?.getValue() || '';
      try {
        await navigator.clipboard.writeText(val);
      } catch (err) {}
    },
    toggleDiffMode: (diff: boolean) => {
      if (diff) {
        const val = editorRef.current?.getValue() || '';
        setDiffOriginal(val);
        setDiffModified(val);
      }
      setIsDiffMode(diff);
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
        if (content && editorRef.current && !isDiffMode) {
          editorRef.current.setValue(content);
          editorRef.current.getAction('editor.action.formatDocument')?.run();
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="editor-card">
      <div className="editor-header">
        <div className="breadcrumbs" title={breadcrumb}>
          {isDiffMode ? 'Diff Mode (Original vs Modified)' : breadcrumb}
        </div>
        {!isDiffMode && (
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
        {(!isDiffMode && isEmpty) && (
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
            zIndex: isDiffMode ? 1 : -1, 
            opacity: isDiffMode ? 1 : 0, 
            pointerEvents: isDiffMode ? 'auto' : 'none',
            visibility: isDiffMode ? 'visible' : 'hidden'
          }}
        >
          <DiffEditor
            height="100%"
            language="json"
            theme={theme === 'dark' ? 'jv-dark' : 'jv-light'}
            original={diffOriginal}
            modified={diffModified}
            onMount={handleDiffMount}
            beforeMount={handleBeforeMount}
            options={{
              originalEditable: true,
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              padding: { top: 16, bottom: 16 }
            }}
          />
        </div>
        
        <div 
          style={{ 
            position: 'absolute', inset: 0, 
            zIndex: !isDiffMode ? 1 : -1, 
            opacity: !isDiffMode ? 1 : 0, 
            pointerEvents: !isDiffMode ? 'auto' : 'none',
            visibility: !isDiffMode ? 'visible' : 'hidden'
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
              minimap: { enabled: false },
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
            defaultValue={`{\n  "server": "jv-production-01",\n  "status": "online",\n  "uptime": 1284592,\n  "metrics": {\n    "cpuLoad": 42.5,\n    "memoryUsed": "12GB",\n    "activeConnections": 1042\n  },\n  "endpoints": [\n    { "path": "/api/users", "latency": "42ms" },\n    { "path": "/api/auth", "latency": "120ms" }\n  ],\n  "message": "Paste your JSON payload here to start inspecting!"\n}`}
          />
        </div>
      </div>
    </div>
  );
});

JsonEditor.displayName = 'JsonEditor';
