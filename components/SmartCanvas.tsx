
import React, { useRef } from 'react';
import { type Settings } from '../services/settings';
import { type CanvasFile } from '../types';
import { useStore } from '../store';

declare const pdfjsLib: any;
declare const mammoth: any;
declare const JSZip: any;

// --- Helper Functions ---
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};


// --- Icon Components ---
const FileIcon: React.FC<{ type: CanvasFile['type'] }> = ({ type }) => {
    let icon;
    switch (type) {
        case 'pdf': icon = '📄'; break;
        case 'docx': icon = '📄'; break;
        case 'txt': icon = '📄'; break;
        case 'md': icon = '📄'; break;
        case 'py': icon = '🐍'; break;
        case 'img': icon = '🖼️'; break;
        default: icon = '❓';
    }
    return <span className="text-lg">{icon}</span>;
};
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
);
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);


// --- Renderer Components ---

const PdfRenderer: React.FC<{ file: CanvasFile }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        let isCancelled = false;
        const renderTasks: any[] = [];
        let pdfDoc: any = null;

        const renderPdf = async () => {
            if (!containerRef.current) return;
            containerRef.current.innerHTML = ''; // Clear previous renders

            try {
                const arrayBuffer = base64ToArrayBuffer(file.content);
                pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                for (let i = 1; i <= pdfDoc.numPages; i++) {
                    if (isCancelled) break;
                    const page = await pdfDoc.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    
                    const canvas = document.createElement('canvas');
                    canvas.className = 'mb-4 shadow-lg';
                    canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    containerRef.current.appendChild(canvas);

                    const renderTask = page.render({ canvasContext: canvas.getContext('2d')!, viewport: viewport });
                    renderTasks.push(renderTask);
                    await renderTask.promise;
                    if (isCancelled) {
                        renderTask.cancel();
                        break;
                    }
                }
            } catch (error) {
                console.error("Error rendering PDF:", error);
                if (containerRef.current) {
                    containerRef.current.innerHTML = '<div class="text-red-500">Error rendering PDF. The file may be corrupted.</div>';
                }
            }
        };

        renderPdf();
        return () => {
            isCancelled = true;
            renderTasks.forEach(task => {
                try { task.cancel(); } catch { /* ignore */ }
            });
            if (pdfDoc && typeof pdfDoc.destroy === 'function') {
                pdfDoc.destroy();
            }
        };
    }, [file]);

    return <div ref={containerRef} />;
};


const DocxRenderer: React.FC<{ file: CanvasFile }> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const renderDocx = async () => {
            if (!containerRef.current) return;
            try {
                const arrayBuffer = base64ToArrayBuffer(file.content);
                const result = await mammoth.convertToHtml({ arrayBuffer });
                containerRef.current.innerHTML = result.value;
            } catch (error) {
                console.error("Error rendering DOCX:", error);
                if (containerRef.current) {
                    containerRef.current.innerHTML = '<div class="text-red-500">Error rendering DOCX file.</div>';
                }
            }
        };
        renderDocx();
    }, [file]);

    return <div ref={containerRef} className="prose prose-sm dark:prose-invert max-w-none" />;
};


const ImageRenderer: React.FC<{ file: CanvasFile }> = ({ file }) => {
    const src = `data:image;base64,${file.content}`;
    return <img src={src} alt={file.name} className="max-w-full h-auto rounded-lg shadow-md" />;
};


const TextRenderer: React.FC<{ file: CanvasFile, onContentChange: (newContent: string) => void }> = ({ file, onContentChange }) => {
    return (
        <textarea
            value={file.content}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full h-full bg-base-100 border-none focus:outline-none focus:ring-0 resize-none font-mono text-sm"
        />
    );
};

const UnsupportedRenderer: React.FC<{ file: CanvasFile }> = ({ file }) => {
    return (
        <div className="text-center p-8 bg-base-200 rounded-lg">
            <h3 className="text-lg font-semibold">Unsupported File Type</h3>
            <p className="text-sm text-base-content/70 mt-2">Cannot display a preview for "{file.name}". You can still chat with the AI about it or download it.</p>
        </div>
    );
};

interface SmartCanvasProps {
  settings: Settings;
}

export const SmartCanvas: React.FC<SmartCanvasProps> = ({ settings }) => {
    const canvasFiles = useStore(state => state.canvasFiles);
    const canvasActiveFileId = useStore(state => state.canvasActiveFileId);
    const { 
        addCanvasFile, 
        deleteCanvasFile, 
        clearCanvas, 
        updateCanvasFileContent, 
        setCanvasActiveFileId,
        closeCanvas
    } = useStore.getState();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeFile = canvasFiles.find(f => f.id === canvasActiveFileId);

    const handleFileUpload = async (files: FileList | null) => {
        if (!files) return;
        for (const file of Array.from(files)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (!e.target?.result) return;
                
                const getFileType = (ext: string): CanvasFile['type'] => {
                    if (['pdf'].includes(ext)) return 'pdf';
                    if (['docx'].includes(ext)) return 'docx';
                    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'img';
                    if (['txt', 'log'].includes(ext)) return 'txt';
                    if (['py'].includes(ext)) return 'py';
                    if (['md', 'markdown'].includes(ext)) return 'md';
                    return 'unsupported';
                };

                const extension = file.name.split('.').pop()?.toLowerCase() || '';
                const type = getFileType(extension);

                let content: string;
                if (type === 'pdf' || type === 'docx' || type === 'img') {
                    content = (e.target.result as string).split(',')[1]; // Base64
                } else {
                    content = e.target.result as string; // Raw text
                }
                
                const newFile: CanvasFile = {
                    id: crypto.randomUUID(),
                    name: file.name,
                    type,
                    content
                };
                addCanvasFile(newFile);
                if (!activeFile) {
                    setCanvasActiveFileId(newFile.id);
                }
            };

            if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.includes('wordprocessingml')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        }
    };

    const handleDownloadCanvas = () => {
        const zip = new JSZip();
        canvasFiles.forEach(file => {
            if (file.type === 'pdf' || file.type === 'docx' || file.type === 'img') {
                zip.file(file.name, file.content, { base64: true });
            } else {
                zip.file(file.name, file.content);
            }
        });
        zip.generateAsync({ type: 'blob' }).then(content => {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `llamahub_canvas_${new Date().toISOString()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    };
    
    const handleDownloadFile = (file: CanvasFile) => {
        let blob: Blob;
        let mimeType = 'application/octet-stream'; // Default MIME type

        // Determine MIME type and create blob
        switch (file.type) {
            case 'pdf':
                mimeType = 'application/pdf';
                blob = new Blob([base64ToArrayBuffer(file.content)], { type: mimeType });
                break;
            case 'docx':
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                blob = new Blob([base64ToArrayBuffer(file.content)], { type: mimeType });
                break;
            case 'img':
                const extension = file.name.split('.').pop()?.toLowerCase();
                if (extension === 'jpg' || extension === 'jpeg') {
                    mimeType = 'image/jpeg';
                } else if (extension === 'png') {
                    mimeType = 'image/png';
                } else if (extension === 'gif') {
                    mimeType = 'image/gif';
                } else if (extension === 'webp') {
                    mimeType = 'image/webp';
                } else {
                    mimeType = 'image/png'; // A reasonable default
                }
                blob = new Blob([base64ToArrayBuffer(file.content)], { type: mimeType });
                break;
            case 'txt':
            case 'py':
            case 'md':
            case 'unsupported':
            default:
                mimeType = 'text/plain;charset=utf-8';
                blob = new Blob([file.content], { type: mimeType });
                break;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-2/5 h-full bg-base-200/50 flex flex-col border-r border-base-300 flex-shrink-0">
             {/* Header */}
            <header className="p-2 border-b border-base-300 flex-shrink-0 flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-semibold text-lg px-2">Smart Canvas</h2>
                <div className="flex items-center">
                    <input type="file" multiple ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files)} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="btn btn-sm btn-ghost" title="Add File">Add</button>
                    <button onClick={handleDownloadCanvas} className="btn btn-sm btn-ghost" title="Download all files as ZIP">Download</button>
                    <button onClick={clearCanvas} className="btn btn-sm btn-ghost text-error" title="Remove all files">Clear</button>
                    <button onClick={closeCanvas} className="btn btn-sm btn-ghost" title="Close Canvas">Close</button>
                </div>
            </header>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* File list panel */}
                <div className="w-full md:w-1/3 h-1/3 md:h-full bg-base-200/50 flex flex-col border-b md:border-b-0 md:border-r border-base-300 overflow-y-auto">
                    <div className="flex-1 p-2 space-y-2">
                        {canvasFiles.map(file => (
                            <button
                                key={file.id}
                                onClick={() => setCanvasActiveFileId(file.id)}
                                className={`w-full flex items-center justify-between text-left p-2 rounded-md transition-colors group ${file.id === canvasActiveFileId ? 'bg-primary text-primary-content' : 'hover:bg-base-300'}`}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileIcon type={file.type} />
                                    <span className="truncate text-sm">{file.name}</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(file); }} className="p-1 rounded-full hover:bg-base-content/20 text-base-content/70 opacity-0 group-hover:opacity-100 transition-opacity" title={`Download ${file.name}`}>
                                        <DownloadIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); deleteCanvasFile(file.id); }} className="p-1 rounded-full hover:bg-error/20 text-error opacity-0 group-hover:opacity-100 transition-opacity" title={`Delete ${file.name}`}>
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main content panel */}
                <div className="flex-1 h-2/3 md:h-full flex flex-col">
                    <main className="flex-1 overflow-y-auto p-4 bg-base-100">
                        {activeFile ? (
                            (() => {
                                switch (activeFile.type) {
                                    case 'pdf': return <PdfRenderer file={activeFile} />;
                                    case 'docx': return <DocxRenderer file={activeFile} />;
                                    case 'img': return <ImageRenderer file={activeFile} />;
                                    case 'txt':
                                    case 'py':
                                    case 'md':
                                        return <TextRenderer file={activeFile} onContentChange={(newContent) => updateCanvasFileContent(activeFile.id, newContent)} />;
                                    default: return <UnsupportedRenderer file={activeFile} />;
                                }
                            })()
                        ) : (
                            <div className="text-center text-base-content/70 h-full flex flex-col items-center justify-center">
                                <p>Select a file to view or add a new one.</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};
