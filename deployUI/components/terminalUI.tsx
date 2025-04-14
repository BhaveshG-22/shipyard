import React, { useRef, useEffect } from "react";

interface TerminalUIProps {
  termLogs?: string[];
}

const TerminalUI: React.FC<TerminalUIProps> = ({ termLogs = [] }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom whenever logs update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [termLogs]);

  const formatLogLine = (line: string) => {
    if (line.includes("✅")) {
      return <span className="text-green-500">{line}</span>;
    } else if (line.includes("❌")) {
      return <span className="text-red-500">{line}</span>;
    } else if (line.includes("transforming") || line.includes("building") || line.includes("computing")) {
      return <span className="text-blue-400">{line}</span>;
    } else if (line.includes("Visit http")) {
      return (
        <span>
          Visit{" "}
          <a 
            href={line.match(/http:\/\/[^\s]+/)?.[0]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-400 underline hover:text-blue-300"
          >
            {line.match(/http:\/\/[^\s]+/)?.[0]}
          </a>
        </span>
      );
    } else {
      return <span>{line}</span>;
    }
  };

  return (
    <div 
      ref={terminalRef}
      className="w-full h-full bg-gray-900 rounded-lg overflow-y-auto font-mono text-sm shadow-inner"
    >
      {/* Terminal header */}
      <div className="flex items-center h-8 px-4 bg-gray-800 border-b border-gray-700">
        <div className="h-3 w-3 mr-2 rounded-full bg-red-500"></div>
        <div className="h-3 w-3 mr-2 rounded-full bg-yellow-500"></div>
        <div className="h-3 w-3 rounded-full bg-green-500"></div>
        <div className="ml-2 text-gray-400 text-xs">deployment-logs</div>
      </div>

      {/* Terminal content */}
      <div className="p-4 text-gray-300">
        {termLogs.length === 0 ? (
          <div className="text-gray-500 italic">Waiting for deployment logs...</div>
        ) : (
          <div className="whitespace-pre-wrap">
            {termLogs.map((log, index) => (
              <div key={index} className="mb-1 leading-relaxed">
                {formatLogLine(log)}
              </div>
            ))}
          </div>
        )}
        <div className="text-gray-400 mt-1 animate-pulse">_</div>
      </div>
    </div>
  );
};

export default TerminalUI;