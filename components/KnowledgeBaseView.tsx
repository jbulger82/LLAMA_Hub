import React, { useState, useEffect, useMemo } from 'react';
import * as knowledgeStore from '../services/knowledgeStore';
import { type ParentDocument } from '../services/knowledgeStore';
import ReactMarkdown from 'https://esm.sh/react-markdown@8?bundle';
import remarkGfm from 'https://esm.sh/remark-gfm@3?bundle';

const ActionButton: React.FC<{ onClick: (e: React.MouseEvent) => void; children: React.ReactNode; title: string; }> = ({ onClick, children, title }) => (
    <button onClick={onClick} title={title} className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-content/10 transition-colors">
        {children}
    </button>
);

const ViewIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
const ExportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>;


const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-base-200 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-semibold text-base-content truncate">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-base-200">
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </header>
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-base-200">
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{children as string}</ReactMarkdown>
                    </div>
                </main>
            </div>
        </div>
    );
};

export const KnowledgeBaseView: React.FC = () => {
    const [documents, setDocuments] = useState<ParentDocument[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingDoc, setViewingDoc] = useState<ParentDocument | null>(null);

    const loadItems = async () => {
        try {
            const docs = await knowledgeStore.getAllParentDocuments();
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to load knowledge documents:', error);
            setDocuments([]);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete "${name}" and all its chunks? This cannot be undone.`)) {
            knowledgeStore.deleteParentById(id);
            loadItems(); // Refresh list
        }
    };
    
    const handleExport = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        knowledgeStore.exportParentDocument(id);
    };

    const handleView = async (doc: ParentDocument) => {
        const fullDoc = await knowledgeStore.getParentDocument(doc.id);
        setViewingDoc(fullDoc);
    };

    const filteredDocuments = useMemo(() => {
        if (!searchTerm.trim()) return documents;
        const lowercasedTerm = searchTerm.toLowerCase();
        // A full-text search would be slow here. This is a basic name filter.
        // For content search, the user should query the AI.
        return documents.filter(doc =>
            doc.name.toLowerCase().includes(lowercasedTerm)
        );
    }, [documents, searchTerm]);

    return (
        <div className="flex flex-col h-full bg-base-100 transition-colors duration-300">
            <header className="flex-shrink-0 p-4 border-b border-base-300 flex items-center justify-between gap-4">
                <h1 className="text-xl font-semibold text-base-content">Knowledge Base</h1>
                <div className="relative w-full max-w-md">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/70">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                    </svg>
                    <input
                        type="search"
                        placeholder="Search documents by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 rounded-md bg-base-200 border border-base-300 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </header>

            <main className="flex-1 overflow-y-auto">
                {filteredDocuments.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-base-content/50 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" /></svg>
                        <h3 className="mt-2 text-lg font-medium text-base-content">No documents found</h3>
                         <p className="mt-1 text-sm text-base-content/70">
                            {searchTerm ? "Try a different search term." : "Use 'embed file' or 'save to memory' to add knowledge."}
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-base-300">
                        {filteredDocuments.map(doc => (
                            <li key={doc.id} className="p-4 group hover:bg-base-200/50 flex items-start justify-between gap-4 cursor-pointer" onClick={() => handleView(doc)}>
                                <div className="flex-1 overflow-hidden">
                                     <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/70 bg-base-200 px-2 py-0.5 rounded-full">{doc.type}</span>
                                        <h3 className="font-semibold text-base-content truncate">{doc.name}</h3>
                                    </div>
                                    <p className="text-xs text-base-content/70 mt-1">
                                        Added {new Date(doc.createdAt).toLocaleDateString()} &bull; {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                                    <ActionButton onClick={(e) => { e.stopPropagation(); handleView(doc); }} title="View full content"><ViewIcon /></ActionButton>
                                    <ActionButton onClick={(e) => handleExport(e, doc.id)} title="Export document"><ExportIcon /></ActionButton>
                                    <ActionButton onClick={(e) => handleDelete(e, doc.id, doc.name)} title="Delete document"><DeleteIcon /></ActionButton>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
            
            <Modal isOpen={!!viewingDoc} onClose={() => setViewingDoc(null)} title={viewingDoc?.name || ''}>
                {viewingDoc?.content || ''}
            </Modal>
        </div>
    );
};
