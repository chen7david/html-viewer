import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { HtmlDocument } from '../types/HtmlDocument';

const STORAGE_KEY = 'html-viewer-documents';

export function useHtmlStorage() {
  const [documents, setDocuments] = useState<HtmlDocument[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse HTML documents from localStorage', e);
      }
    }
    return [];
  });

  const saveDocuments = (newDocs: HtmlDocument[]) => {
    setDocuments(newDocs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
  };

  const createDocument = (name: string, content: string): HtmlDocument => {
    const newDoc: HtmlDocument = {
      id: uuidv4(),
      name,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveDocuments([...documents, newDoc]);
    return newDoc;
  };

  const getDocument = (id: string): HtmlDocument | undefined => {
    return documents.find(doc => doc.id === id);
  };

  const updateDocument = (id: string, name: string, content: string): HtmlDocument | undefined => {
    let updatedDoc: HtmlDocument | undefined;
    const newDocs = documents.map(doc => {
      if (doc.id === id) {
        updatedDoc = { ...doc, name, content, updatedAt: Date.now() };
        return updatedDoc;
      }
      return doc;
    });

    if (updatedDoc) {
      saveDocuments(newDocs);
    }
    return updatedDoc;
  };

  const deleteDocument = (id: string) => {
    saveDocuments(documents.filter(doc => doc.id !== id));
  };

  return {
    documents,
    createDocument,
    getDocument,
    updateDocument,
    deleteDocument,
  };
}
