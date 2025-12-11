
import React, { useEffect, useMemo, useRef } from 'react';
import { TOOL_CATEGORIES } from '../constants';
import { useStore } from '../store';
import { getSuppressedCommands, isCommandSuppressed, mapMcpToolsToUi } from '../lib/mcpUtils';

interface ToolsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCommand: (tool: { id: string, title: string, command: string }) => void;
  anchorElement: HTMLButtonElement | null;
  onAttachFile?: () => void;
}

const ToolItem: React.FC<{ tool: { id: string, title: string, command: string }, onSelect: (tool: { id: string, title: string, command: string }) => void }> = ({ tool, onSelect }) => (
    <button 
        onClick={() => onSelect(tool)}
        className="w-full flex items-center gap-3 text-left text-sm px-3 py-2 rounded-md transition-colors hover:bg-base-300"
    >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-base-content/70 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
        <span className="flex-1 truncate">{tool.title}</span>
    </button>
);

const Section: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <div>
        <h3 className="px-3 pt-3 pb-1 text-xs font-semibold text-base-content/70 tracking-wider uppercase">{title}</h3>
        <div className="flex flex-col gap-0.5">
            {children}
        </div>
    </div>
);

export const ToolsPopover: React.FC<ToolsPopoverProps> = ({ isOpen, onClose, onSelectCommand, anchorElement, onAttachFile }) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const mcpTools = useStore(state => state.mcpTools);

  const suppressed = useMemo(() => getSuppressedCommands(mcpTools), [mcpTools]);
  const dynamicSections = useMemo(() => {
    const baseSections = Object.entries(TOOL_CATEGORIES)
      .map(([category, tools]) => ({
        category,
        tools: tools.filter(t => !isCommandSuppressed(t.command, suppressed)),
      }))
      .filter(section => section.tools.length > 0);

    const mappedMcp = mapMcpToolsToUi(mcpTools);
    if (mappedMcp.length > 0) {
      baseSections.push({
        category: 'MCP (Auto-discovered)',
        tools: mappedMcp,
      });
    }
    return baseSections;
  }, [mcpTools, suppressed]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorElement &&
        !anchorElement.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorElement]);

  if (!isOpen || !anchorElement) return null;

  const rect = anchorElement.getBoundingClientRect();
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: `${window.innerHeight - rect.top + 8}px`, // position above the button with 8px margin
    left: `${rect.left}px`,
    zIndex: 40,
  };
  
  const handleSelect = (tool: { id: string, title: string, command: string }) => {
      onSelectCommand(tool);
      onClose();
  }

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="w-80 max-h-[50vh] overflow-y-auto rounded-xl bg-base-200 shadow-2xl border border-base-300 p-2"
    >
      {onAttachFile && (
        <Section title="Quick Actions">
            <button
                onClick={() => {
                    onAttachFile();
                    onClose();
                }}
                className="w-full flex items-center gap-3 text-left text-sm px-3 py-2 rounded-md transition-colors hover:bg-base-300"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-base-content/70 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                <span className="flex-1 truncate">Attach file</span>
            </button>
        </Section>
      )}
      {dynamicSections.map(({ category, tools }) => (
        <Section key={category} title={category}>
            {tools.map(tool => (
                <ToolItem 
                    key={tool.id}
                    tool={tool}
                    onSelect={handleSelect}
                />
            ))}
        </Section>
      ))}
    </div>
  );
};
