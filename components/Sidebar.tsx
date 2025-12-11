

import React, { useMemo } from 'react';
import { TOOL_CATEGORIES } from '../constants';
import { useStore, type ActiveView } from '../store';
import { getSuppressedCommands, isCommandSuppressed, mapMcpToolsToUi } from '../lib/mcpUtils';

// --- Heroicon Components ---
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
const ArchiveBoxIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4" /><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5v-1.5A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v1.5Z" /></svg>);
const ArrowUpTrayIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>);
const ChevronDoubleLeftIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>);
const ChevronDoubleRightIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" /></svg>);
const PencilSquareIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>);
const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const CircleStackIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5-3.75l-8.25 4.125-8.25-4.125" /></svg>);
const ChatBubbleLeftIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>);
const Cog6ToothIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 0 1 0 1.885c-.008.379.137.752.43.992l1.003.827c.424.35.534.954.26 1.431l-1.296 2.247a1.125 1.125 0 0 1-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 0 1-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 0 1 0 1.885c.008-.379-.137-.752-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.431l1.296-2.247a1.125 1.125 0 0 1 1.37.49l1.217.456c.355.133.75.072 1.076.124.072-.044.146-.087.22-.127.332-.183.582-.495-.645-.87l.213-1.281Z" /></svg>);
// FIX: Add CpuChipIcon definition.
const CpuChipIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5M15.75 3v1.5M15.75 21v-1.5M12 4.5v-1.5M12 21v-1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75h1.5v4.5h-1.5v-4.5zM6.75 9.75h1.5v4.5h-1.5v-4.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.375 6.75h5.25a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25h-5.25a2.25 2.25 0 01-2.25-2.25v-6a2.25 2.25 0 012.25-2.25z" /></svg>);
// Tool Icons
const ArrowsPointingOutIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>);
const CodeBracketSquareIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V5.75A2.25 2.25 0 0 0 18 3.5H6A2.25 2.25 0 0 0 3.75 5.75v12.25A2.25 2.25 0 0 0 6 20.25Z" /></svg>);
const AcademicCapIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" /></svg>);
const ArrowDownTrayIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
const ChatBubbleLeftRightIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.72.372a3.75 3.75 0 01-3.696-3.696V12.5a3.75 3.75 0 013.75-3.75h5.25zM12 15v-3.75A3.75 3.75 0 008.25 7.5h-1.5a3.75 3.75 0 00-3.75 3.75v3.75m0 0h1.5m-1.5 0v-3.75m0 3.75a3.75 3.75 0 01-3.75-3.75H4.5" /></svg>);
const DocumentPlusIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3h-6m-1.125-6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" /></svg>);
const MinusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>);
const DocumentMagnifyingGlassIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5 4.5l-1.5-1.5m0 0l-1.5 1.5m-1.5-1.5l1.5-1.5m3 3l-1.5-1.5m-1.5 1.5l1.5-1.5m-1.5-1.5a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.773 4.773z" /></svg>);
const MagnifyingGlassIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>);
const InboxArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);
const EnvelopeOpenIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18V9m19.5 0a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 9m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 11.16a2.25 2.25 0 01-1.07-1.916V9" /></svg>);
const PaperAirplaneIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const CalendarDaysIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M-4.5 12h22.5" /></svg>);
const GlobeAltIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A11.953 11.953 0 0112 13.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 003 12c0 .778.099 1.533.284 2.253m18.232-4.5A11.953 11.953 0 0012 6c-2.998 0-5.74 1.1-7.843 2.918m15.686 0A8.959 8.959 0 0121 12" /></svg>);
const ChartPieIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" /></svg>);
const ArrowDownCircleIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const DocumentArrowUpIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m6-9H9m4.5 6H9m4.5 3H9m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>);
const CodeBracketIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>);
const CommandLineIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" /></svg>);
const InformationCircleIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const WrenchScrewdriverIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.472-2.472a3.375 3.375 0 00-4.773-4.773L6.75 21A2.652 2.652 0 009 21h1.42z" /></svg>);
const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" /></svg>);
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const ViewfinderCircleIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const ChatBubbleBottomCenterTextIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12.75h1.5m-6.75 0h1.5m-6.75 0h1.5m-6.75 0h1.5m-1.5 3h13.5m-13.5 0v-3m13.5 3v-3m0 0a3 3 0 10-3-3H6.75a3 3 0 100 6h9.75a3 3 0 003-3z" /></svg>);
const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>);
const UserGroupIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.952a4.5 4.5 0 01-6.364-6.364v-.007A4.5 4.5 0 0110.5 9h.008a4.5 4.5 0 016.364 6.364v.007a4.5 4.5 0 01-6.364 6.364z" /></svg>);
const ChatBubbleOvalLeftEllipsisIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>);
const MegaphoneIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0h9.75M15 12h.008v.008H15V12zm0 3h.008v.008H15V15zm0 3h.008v.008H15V18z" /></svg>);
const ShoppingCartIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.328 1.095-.826l.383-1.437M7.5 14.25h11.218M15 14.25a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>);
const QueueListIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>);
const DocumentMinusIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m-1.125 9h-3m-1.125 0h1.125m-1.125 0H3m2.25 0h1.125m-1.125 0h1.125m-1.125 0h9.75m-9.75 0h1.125" /></svg>);
const ListBulletIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-1.018zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>);
const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const LightBulbIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.311V21m-3.75-2.311V21m-3.75 0h7.5M12 15.75a3.75 3.75 0 01-7.5 0V12a3.75 3.75 0 015.026-3.42A3.75 3.75 0 0112 15.75z" /></svg>);
const IdentificationIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>);
const SignalIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>);
// FIX: Add SparklesIcon definition.
const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456Z" /></svg>);
const ShieldCheckIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.602-3.751m-.223-1.024a12.023 12.023 0 00-3.352-2.149l-2.022-1.012a2.25 2.25 0 00-2.24 0l-2.022 1.012A12.023 12.023 0 005.15 4.976m11.698-.016A11.959 11.959 0 0012 2.75a11.959 11.959 0 00-3.848.91M18.902 15.75c-.223.146-.46.284-.7.414m-14.404 0c.24.13.477.268.7.414M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const GlobeEuropeAfricaIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664l.143.258a1.107 1.107 0 001.664.57l.143-.048a2.25 2.25 0 011.161.886l.51.766c.319.48.126 1.121-.216 1.49l-1.068.89a1.125 1.125 0 00-.405.864v.568m-6 0v-.568c0-.334-.148-.65-.405-.864l-1.068-.89a1.125 1.125 0 01-.216-1.49l.51-.766a2.25 2.25 0 001.161-.886l.143-.048a1.107 1.107 0 01.57-1.664l-.143-.258a1.107 1.107 0 01-1.664-.57l-.143.048a2.25 2.25 0 00-1.161-.886l-.51-.766a1.125 1.125 0 01.216-1.49l1.068-.89a1.125 1.125 0 00.405-.864v-.568m0 0a9 9 0 103.935 2.126M12 12a3 3 0 110-6 3 3 0 010 6z" /></svg>);
const ServerStackIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5H6A2.25 2.25 0 013.75 8.25V6zM3.75 15A2.25 2.25 0 016 12.75h12A2.25 2.25 0 0120.25 15v2.25A2.25 2.25 0 0118 19.5H6A2.25 2.25 0 013.75 17.25V15z" /></svg>);
// --- End Heroicon Components ---

const TOOL_ICON_MAP: { [key: string]: React.ReactNode } = {
    'action_open_canvas': <ArrowsPointingOutIcon className="w-5 h-5 text-base-content/70" />,
    'tool_canvas_open': <ArrowsPointingOutIcon className="w-5 h-5 text-base-content/70" />,
    'tool_canvas_new_file': <DocumentPlusIcon className="w-5 h-5 text-base-content/70" />,
    'tool_canvas_edit_file': <PencilIcon className="w-5 h-5 text-base-content/70" />,
    'tool_canvas_list_files': <QueueListIcon className="w-5 h-5 text-base-content/70" />,
    'tool_canvas_read_file': <DocumentMagnifyingGlassIcon className="w-5 h-5 text-base-content/70" />,
    'tool_run_python': <CodeBracketSquareIcon className="w-5 h-5 text-base-content/70" />,
    'tool_mcp_submit_research': <ServerStackIcon className="w-5 h-5 text-base-content/70" />,
    'tool_mcp_list': <QueueListIcon className="w-5 h-5 text-base-content/70" />,
    'tool_mcp_status': <InformationCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_mcp_cancel': <XCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_mcp_results': <ArrowDownTrayIcon className="w-5 h-5 text-base-content/70" />,
    'tool_deep_research': <AcademicCapIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gen_search_queries': <MagnifyingGlassIcon className="w-5 h-5 text-base-content/70" />,
    'tool_save_memory': <ArrowDownTrayIcon className="w-5 h-5 text-base-content/70" />,
    'tool_query_memory': <ChatBubbleLeftRightIcon className="w-5 h-5 text-base-content/70" />,
    'tool_embed_file': <DocumentPlusIcon className="w-5 h-5 text-base-content/70" />,
    'tool_export_memory': <ArrowUpTrayIcon className="w-5 h-5 text-base-content/70" />,
    'tool_delete_memory': <MinusCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gdrive_list': <FolderIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gdrive_analyze': <DocumentMagnifyingGlassIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gmail_search': <MagnifyingGlassIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gmail_latest': <InboxArrowDownIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gmail_read': <EnvelopeOpenIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gmail_delete': <TrashIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gmail_send': <PaperAirplaneIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gcal_list': <CalendarDaysIcon className="w-5 h-5 text-base-content/70" />,
    'tool_search': <MagnifyingGlassIcon className="w-5 h-5 text-base-content/70" />,
    'tool_curl': <GlobeAltIcon className="w-5 h-5 text-base-content/70" />,
    'tool_analyze': <ChartPieIcon className="w-5 h-5 text-base-content/70" />,
    'tool_analyze_links': <DocumentMagnifyingGlassIcon className="w-5 h-5 text-base-content/70" />,
    'tool_download': <ArrowDownCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_read_file_local': <DocumentArrowUpIcon className="w-5 h-5 text-base-content/70" />,
    'tool_webscrape': <GlobeEuropeAfricaIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gen_bash': <CommandLineIcon className="w-5 h-5 text-base-content/70" />,
    'tool_explain_code': <InformationCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_refactor_code': <WrenchScrewdriverIcon className="w-5 h-5 text-base-content/70" />,
    'tool_gen_image': <PhotoIcon className="w-5 h-5 text-base-content/70" />,
    'tool_analyze_image': <EyeIcon className="w-5 h-5 text-base-content/70" />,
    'tool_ocr_image': <ViewfinderCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_post_twitter': <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-base-content/70" />,
    'tool_post_facebook': <ChatBubbleBottomCenterTextIcon className="w-5 h-5 text-base-content/70" />,
    'tool_post_instagram': <CameraIcon className="w-5 h-5 text-base-content/70" />,
    'tool_post_linkedin': <UserGroupIcon className="w-5 h-5 text-base-content/70" />,
    'tool_read_reddit': <ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5 text-base-content/70" />,
    'tool_send_discord': <MegaphoneIcon className="w-5 h-5 text-base-content/70" />,
    'tool_send_telegram': <PaperAirplaneIcon className="w-5 h-5 text-base-content/70" />,
    'tool_list_shopify': <ShoppingCartIcon className="w-5 h-5 text-base-content/70" />,
    'tool_create_file': <DocumentPlusIcon className="w-5 h-5 text-base-content/70" />,
    'tool_edit_file': <PencilIcon className="w-5 h-5 text-base-content/70" />,
    'tool_list_files_local': <QueueListIcon className="w-5 h-5 text-base-content/70" />,
    'tool_delete_file': <DocumentMinusIcon className="w-5 h-5 text-base-content/70" />,
    'tool_sys_status': <CpuChipIcon className="w-5 h-5 text-base-content/70" />,
    'tool_disk_usage': <CircleStackIcon className="w-5 h-5 text-base-content/70" />,
    'tool_list_procs': <ListBulletIcon className="w-5 h-5 text-base-content/70" />,
    'tool_kill_proc': <XCircleIcon className="w-5 h-5 text-base-content/70" />,
    'tool_think': <LightBulbIcon className="w-5 h-5 text-base-content/70" />,
    'tool_ask_cloud': <SparklesIcon className="w-5 h-5 text-base-content/70" />,
    'tool_whoami': <IdentificationIcon className="w-5 h-5 text-base-content/70" />,
    'tool_ping': <SignalIcon className="w-5 h-5 text-base-content/70" />,
    'tool_report': <ShieldCheckIcon className="w-5 h-5 text-base-content/70" />,
};

const SidebarItem: React.FC<{
  icon: React.ReactNode;
  title: string;
  isActive?: boolean;
  onClick?: () => void;
  onArchiveToggle?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
  isOpen: boolean;
}> = ({ icon, title, isActive, onClick, onArchiveToggle, onDelete, isArchived, isOpen }) => {
    
    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    return (
    <div className={`group relative w-full flex items-center ${isOpen ? 'pr-12' : ''}`}>
        <button 
            onClick={onClick}
            className={`w-full flex items-center text-left text-sm px-3 py-2 rounded-md transition-colors truncate ${isActive ? 'bg-base-300' : 'hover:bg-base-300'} ${!isOpen && 'justify-center'}`}
        >
            <span className="w-5 h-5 flex-shrink-0">{icon}</span>
            <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'w-full ml-3' : 'w-0'}`}>
                <span className="truncate">{title}</span>
            </div>
        </button>
        <div className={`absolute right-0 top-1/2 -translate-y-1/2 flex items-center transition-opacity duration-200 focus-within:opacity-100 ${isOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
            {onDelete && (
                <button
                    onClick={handleDeleteClick}
                    className="p-1 rounded-md hover:bg-base-content/10 text-base-content/70 hover:text-error"
                    aria-label="Delete chat"
                    title="Delete chat"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            )}
            {onArchiveToggle && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onArchiveToggle(); }}
                    className="p-1 rounded-md hover:bg-base-content/10 text-base-content/70"
                    aria-label={isArchived ? 'Unarchive chat' : 'Archive chat'}
                    title={isArchived ? 'Unarchive chat' : 'Archive chat'}
                >
                    {isArchived ? <ArrowUpTrayIcon className="w-4 h-4" /> : <ArchiveBoxIcon className="w-4 h-4" />}
                </button>
            )}
        </div>
    </div>
);
};


const Section: React.FC<{title: string, children: React.ReactNode, isOpen: boolean}> = ({title, children, isOpen}) => (
    <div className="pt-2">
        {isOpen ? (
            <h3 className="px-3 pt-2 pb-1 text-xs font-semibold text-base-content/70 tracking-wider uppercase">{title}</h3>
        ) : (
            <hr className="mx-3 my-3 border-base-content/20" />
        )}
        <div className="flex flex-col gap-0.5">
            {children}
        </div>
    </div>
);

interface SidebarProps {
  onSelectCommand: (tool: { id: string, title: string, command: string }) => void;
}


export const Sidebar: React.FC<SidebarProps> = ({ onSelectCommand }) => {
  const isOpen = useStore(state => state.sidebarOpen);
  const setSidebarOpen = useStore(state => state.setSidebarOpen);
  const newChat = useStore(state => state.newChat);
  const chats = useStore(state => state.chats);
  const currentChatId = useStore(state => state.currentChatId);
  const selectChat = useStore(state => state.selectChat);
  const openSettingsModal = useStore(state => state.openSettingsModal);
  const sidebarWidth = useStore(state => state.settings.sidebarWidth);
  const archiveChat = useStore(state => state.archiveChat);
  const deleteChat = useStore(state => state.deleteChat);
  const activeView = useStore(state => state.activeView);
  const setActiveView = useStore(state => state.setActiveView);
  const openCanvas = useStore(state => state.openCanvas);
  const mcpTools = useStore(state => state.mcpTools);
  
  const recentChats = chats.filter(c => !c.isArchived);
  const archivedChats = chats.filter(c => c.isArchived);

  const suppressed = useMemo(() => getSuppressedCommands(mcpTools), [mcpTools]);
  const dynamicSections = useMemo(() => {
    const sections = Object.entries(TOOL_CATEGORIES)
      .map(([category, tools]) => ({
        category,
        tools: tools.filter(t => !isCommandSuppressed(t.command, suppressed)),
      }))
      .filter(section => section.tools.length > 0);

    const mappedMcp = mapMcpToolsToUi(mcpTools);
    if (mappedMcp.length > 0) {
      sections.push({ category: 'MCP (Auto-discovered)', tools: mappedMcp });
    }
    return sections;
  }, [mcpTools, suppressed]);

  const handleToolClick = (tool: { id: string, title: string, command: string }) => {
    // Legacy action ID. The new one is 'tool_canvas_open'.
    if (tool.id === 'action_open_canvas') { 
        openCanvas();
    } else {
        onSelectCommand(tool);
    }
  };

  const COLLAPSED_WIDTH = 72;
  const currentWidth = isOpen ? sidebarWidth : COLLAPSED_WIDTH;
  
  return (
    <div 
      className={`
        flex flex-col bg-base-200 border-r border-base-300
        transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
        transition-all duration-300 ease-in-out 
        fixed md:relative h-full z-30 flex-shrink-0
      `}
      style={{ width: `${currentWidth}px` }}
    >
      <div className="p-2 flex-shrink-0">
          <div className="flex items-center justify-between">
              <button onClick={newChat} className={`flex items-center w-full text-left text-sm px-3 py-2.5 rounded-md hover:bg-base-300 transition-colors ${!isOpen && 'justify-center'}`}>
                  <PencilSquareIcon className="w-5 h-5 flex-shrink-0" />
                  <div className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${isOpen ? 'w-auto ml-2' : 'w-0'}`}>
                    New Chat
                  </div>
              </button>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-md hover:bg-base-300 transition-colors md:hidden">
                  <XMarkIcon className="w-6 h-6" />
              </button>
          </div>
      </div>
      
      <div className="flex-1 px-2 space-y-1 overflow-y-auto">
        <div className="pt-2">
            <SidebarItem 
                icon={<CircleStackIcon className="w-5 h-5 text-base-content/70" />}
                title="Knowledge Base"
                isActive={activeView === 'knowledge'}
                onClick={() => setActiveView('knowledge')}
                isOpen={isOpen}
            />
        </div>
        
        <Section title="Recent Chats" isOpen={isOpen}>
            {recentChats.map(chat => (
                <SidebarItem 
                    key={chat.id} 
                    icon={<ChatBubbleLeftIcon className="w-5 h-5 text-base-content/70" />} 
                    title={chat.title} 
                    isActive={activeView === 'chat' && chat.id === currentChatId}
                    onClick={() => selectChat(chat.id)}
                    onArchiveToggle={() => archiveChat(chat.id, true)}
                    onDelete={() => deleteChat(chat.id)}
                    isArchived={false}
                    isOpen={isOpen}
                />
            ))}
        </Section>
        
        {archivedChats.length > 0 && (
            <Section title="Archived Chats" isOpen={isOpen}>
                {archivedChats.map(chat => (
                    <SidebarItem 
                        key={chat.id} 
                        icon={<ChatBubbleLeftIcon className="w-5 h-5 text-base-content/70" />}
                        title={chat.title} 
                        isActive={activeView === 'chat' && chat.id === currentChatId}
                        onClick={() => selectChat(chat.id)}
                        onArchiveToggle={() => archiveChat(chat.id, false)}
                        onDelete={() => deleteChat(chat.id)}
                        isArchived={true}
                        isOpen={isOpen}
                    />
                ))}
            </Section>
        )}

        {dynamicSections.map(({ category, tools }) => (
            <Section key={category} title={category} isOpen={isOpen}>
                {tools.map(tool => (
                    <SidebarItem 
                        key={tool.id} 
                        icon={TOOL_ICON_MAP[tool.id] || <WrenchScrewdriverIcon className="w-5 h-5 text-base-content/70" />}
                        title={tool.title} 
                        onClick={() => handleToolClick(tool)}
                        isOpen={isOpen}
                    />
                ))}
            </Section>
        ))}
      </div>
      
      <div className="p-2 border-t border-base-300 mt-auto">
          <SidebarItem 
              icon={<Cog6ToothIcon className="w-5 h-5" />}
              title="Settings"
              onClick={openSettingsModal} 
              isOpen={isOpen}
          />
          <div className="hidden md:block">
              <SidebarItem
                  icon={isOpen ? <ChevronDoubleLeftIcon className="w-5 h-5" /> : <ChevronDoubleRightIcon className="w-5 h-5" />}
                  title={isOpen ? "Collapse Sidebar" : ""}
                  onClick={() => setSidebarOpen(!isOpen)}
                  isOpen={isOpen}
              />
          </div>
      </div>
    </div>
  );
};
