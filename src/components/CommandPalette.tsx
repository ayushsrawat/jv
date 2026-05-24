import { useEffect } from 'react';
import { Command } from 'cmdk';
import { FileJson, Trash2, Copy, Download, Share2, Search, Moon, Sun, SplitSquareHorizontal, Network } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  actions: {
    beautify: () => void;
    clear: () => void;
    copy: () => void;
    download: () => void;
    share: () => void;
    focusQuery: () => void;
    toggleTheme: () => void;
    toggleDiff: () => void;
    toggleTree: () => void;
  };
  theme: string;
  isDiffMode: boolean;
}

export function CommandPalette({ open, setOpen, actions, theme, isDiffMode }: CommandPaletteProps) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        actions.focusQuery();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [actions, setOpen, open]);

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk-dialog" onClick={(e) => e.stopPropagation()}>
        <Command loop>
          <Command.Input placeholder="Type a command or search..." autoFocus />
          <Command.List>
            <Command.Empty>No results found.</Command.Empty>

            <Command.Group heading="Editor Actions">
              <Command.Item onSelect={() => { actions.beautify(); setOpen(false); }}>
                <FileJson size={16} /> Format JSON
              </Command.Item>
              <Command.Item onSelect={() => { actions.toggleDiff(); setOpen(false); }}>
                <SplitSquareHorizontal size={16} /> Toggle Diff Mode
              </Command.Item>
              <Command.Item onSelect={() => { actions.toggleTree(); setOpen(false); }}>
                <Network size={16} /> Toggle Tree Mode
              </Command.Item>
              <Command.Item onSelect={() => { actions.clear(); setOpen(false); }}>
                <Trash2 size={16} /> Clear Editor
              </Command.Item>
              <Command.Item onSelect={() => { actions.copy(); setOpen(false); }}>
                <Copy size={16} /> Copy to Clipboard
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Data">
              <Command.Item onSelect={() => { actions.share(); setOpen(false); }}>
                <Share2 size={16} /> Create Shareable Link
              </Command.Item>
              <Command.Item onSelect={() => { actions.download(); setOpen(false); }}>
                <Download size={16} /> Export as File
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Navigation">
              {!isDiffMode && (
                <Command.Item onSelect={() => { actions.focusQuery(); setOpen(false); }}>
                  <Search size={16} /> Focus Query Bar (⌘/)
                </Command.Item>
              )}
              <Command.Item onSelect={() => { actions.toggleTheme(); setOpen(false); }}>
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} Toggle Theme
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
