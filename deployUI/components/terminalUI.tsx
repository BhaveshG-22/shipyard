import React from "react";

 

interface TerminalUIProps {
  termLogs?: string[];
  

}

const TerminalUI: React.FC<TerminalUIProps> = ({ termLogs }) => {
  console.log(termLogs);

  return (
    <div className="w-1/2 bg-gray-900 text-green-400 p-4 rounded-lg overflow-y-auto ">
      <div>
        <div className="flex flex-col bg-gray-900 text-gray-200 font-mono">
          {/* <!-- Top bar --> */}
          <div className="flex items-center  h-10  px-4 bg-gray-800">
            <div className="h-3 w-3 mr-2 rounded-full bg-red-500"></div>
            <div className="h-3 w-3 mr-2 rounded-full bg-yellow-500"></div>
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
          </div>

          {/* <!-- CMD body --> */}
          <div className="flex-1 p-4">
            <div className="flex">
            </div>

            <div className="mt-2">
              <div className="bg-gray-800 p-2 mt-1">
                <span className="text-green-500">&gt; Output:</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>)

};

export default TerminalUI;
