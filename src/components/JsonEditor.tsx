import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { getLocation, type JSONPath } from 'jsonc-parser';

export interface JsonEditorRef {
  beautify: () => void;
  clear: () => void;
  getValue: () => string;
  setValue: (val: string) => void;
  copyToClipboard: () => Promise<void>;
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
  const [isValid, setIsValid] = useState(true);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string>('root');

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

    ed.onDidChangeModelContent(() => {
      const val = ed.getValue();
      try {
        JSON.parse(val);
        setIsValid(true);
        updateMeta(val);
      } catch (e) {
        setIsValid(false);
      }
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
        // Valid JSON pasted! Auto format
        ed.getAction('editor.action.formatDocument')?.run().then(() => {
          if (onPasteFormat) {
             const newVal = ed.getValue();
             onPasteFormat(newVal);
          }
        });
      } catch (e) {
        // Not valid JSON, do nothing special
      }
    });

    // Initial meta compute
    updateMeta(ed.getValue());
  };

  useImperativeHandle(ref, () => ({
    beautify: () => {
      if (editorRef.current) {
        editorRef.current.getAction('editor.action.formatDocument')?.run();
      }
    },
    clear: () => {
      if (editorRef.current) {
        editorRef.current.setValue('');
      }
    },
    getValue: () => {
      return editorRef.current?.getValue() || '';
    },
    setValue: (val: string) => {
      if (editorRef.current) {
        editorRef.current.setValue(val);
      }
    },
    copyToClipboard: async () => {
      const val = editorRef.current?.getValue() || '';
      try {
        await navigator.clipboard.writeText(val);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  }));

  return (
    <div className="editor-card">
      <div className="editor-header">
        <div className="breadcrumbs" title={breadcrumb}>
          {breadcrumb}
        </div>
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
      </div>
      <div className="editor-content">
        <Editor
          height="100%"
          defaultLanguage="json"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            showFoldingControls: 'always',
            formatOnPaste: false, // We handle it manually to trigger side effects safely
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            fontFamily: 'var(--font-mono)'
          }}
          defaultValue={`{\n  "server": "jv-production-01",\n  "status": "online",\n  "uptime": 1284592,\n  "metrics": {\n    "cpuLoad": 42.5,\n    "memoryUsed": "12GB",\n    "activeConnections": 1042\n  },\n  "endpoints": [\n    { "path": "/api/users", "latency": "42ms" },\n    { "path": "/api/auth", "latency": "120ms" }\n  ],\n  "message": "Paste your JSON payload here to start inspecting!"\n}`}
        />
      </div>
    </div>
  );
});

JsonEditor.displayName = 'JsonEditor';
