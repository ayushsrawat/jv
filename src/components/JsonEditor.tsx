import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export interface JsonEditorRef {
  beautify: () => void;
  clear: () => void;
  getValue: () => string;
  copyToClipboard: () => Promise<void>;
}

interface JsonEditorProps {
  theme: 'light' | 'dark';
}

export const JsonEditor = forwardRef<JsonEditorRef, JsonEditorProps>(({ theme }, ref) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [isValid, setIsValid] = useState(true);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: true,
    });

    monaco.editor.onDidChangeMarkers((uris) => {
      const editorUri = editor.getModel()?.uri;
      if (editorUri) {
        const markers = monaco.editor.getModelMarkers({ resource: editorUri });
        const hasErrors = markers.some(marker => marker.severity === monaco.MarkerSeverity.Error);
        setIsValid(!hasErrors);
      }
    });
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
        <span className="editor-title">Editor</span>
        <div className="editor-status">
          <span className={`status-dot ${!isValid ? 'error' : ''}`}></span>
          {isValid ? 'Valid JSON' : 'Invalid JSON'}
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
            formatOnPaste: false,
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
          defaultValue={`{\n  "message": "Welcome to jv",\n  "description": "Paste your JSON here and click Beautify!"\n}`}
        />
      </div>
    </div>
  );
});

JsonEditor.displayName = 'JsonEditor';
