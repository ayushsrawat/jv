import { useState, useEffect } from 'react';

export interface HistoryItem {
  id: string;
  timestamp: number;
  data: string;
  snippet: string;
}

const HISTORY_KEY = 'jv-history';
const MAX_HISTORY = 10;

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load initial history
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const saveToHistory = (jsonData: string) => {
    // Only save if it's actually valid JSON and not empty
    if (!jsonData.trim()) return;
    
    try {
      // Validate it parses correctly
      JSON.parse(jsonData);
      
      setHistory(prev => {
        // Prevent saving exact duplicates consecutively
        if (prev.length > 0 && prev[0].data === jsonData) {
          return prev;
        }

        const newItem: HistoryItem = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          data: jsonData,
          snippet: jsonData.substring(0, 50).replace(/\n/g, '') + '...'
        };

        const newHistory = [newItem, ...prev].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
        return newHistory;
      });
    } catch (e) {
      // Not valid JSON, do not save
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return { history, saveToHistory, clearHistory };
}
