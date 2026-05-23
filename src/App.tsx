import { useRef } from 'react';
import { Header } from './components/Header';
import { JsonEditor, type JsonEditorRef } from './components/JsonEditor';
import { useTheme } from './hooks/useTheme';

function App() {
  const { theme, toggleTheme } = useTheme();
  const editorRef = useRef<JsonEditorRef>(null);

  const handleBeautify = () => {
    editorRef.current?.beautify();
  };

  const handleClear = () => {
    editorRef.current?.clear();
  };

  const handleCopy = async () => {
    await editorRef.current?.copyToClipboard();
  };

  return (
    <div className="app-container">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        onBeautify={handleBeautify}
        onClear={handleClear}
        onCopy={handleCopy}
      />
      <JsonEditor ref={editorRef} theme={theme} />
    </div>
  );
}

export default App;
