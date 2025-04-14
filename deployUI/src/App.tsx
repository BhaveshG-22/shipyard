import React, { useState, useCallback, useEffect } from 'react';
import {
  GitBranch,
  Building,
  Check,
  Upload,
  Globe,
  Loader2,
  ListEnd,
  Folder,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Manager } from "socket.io-client";
import TerminalUI from "../components/terminalUI";

const manager = new Manager(import.meta.env.VITE_API_SERVER_URL);
const socket = manager.socket("/");

interface DeploymentStage {
  name: string;
  icon: React.ElementType;
  description: string;
  stage: number;
}

interface StageStatus {
  name: string;
  status: 'pending' | 'in-progress' | 'success' | 'failed';
}

interface DeploymentStatus {
  status: 'pending' | 'success' | 'failed';
  currentStage: number;
  stages: StageStatus[];
  deployedLink?: string;
}

const DEPLOYMENT_STAGES: DeploymentStage[] = [
  { name: 'Request in queue', icon: ListEnd, description: 'Request received and currently in queue', stage: 1 },
  { name: 'Cloning Repository', icon: GitBranch, description: 'Fetching latest code from GitHub', stage: 2 },
  { name: 'Building Project', icon: Building, description: 'Compiling and preparing build', stage: 3 },
  { name: 'Checking Build Output', icon: Check, description: 'Validating build artifacts', stage: 4 },
  { name: 'Uploading to Storage', icon: Upload, description: 'Transferring files to hosting platform', stage: 5 },
  { name: 'Assigning Domain', icon: Globe, description: 'Configuring network and DNS', stage: 6 }
];

const createInitialDeploymentStatus = (): DeploymentStatus => ({
  status: 'pending',
  currentStage: 0,
  stages: DEPLOYMENT_STAGES.map(stage => ({ name: stage.name, status: 'pending' }))
});

const App: React.FC = () => {
  const [githubUrl, setGithubUrl] = useState<string>('https://github.com/piyushgarg-dev/piyush-vite-app');
  const [projectSlug, setProjectSlug] = useState<string>('');
  const [deployedLink, setDeployedLink] = useState<string>('');
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [termLogs, setTermLogs] = useState<string[]>([]);

  // New state for repo folders
  const [repoFolders, setRepoFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isFetchingFolders, setIsFetchingFolders] = useState<boolean>(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState<boolean>(false);

  useEffect(() => {
    if (deploymentStatus) {
      setProgress((deploymentStatus.currentStage / DEPLOYMENT_STAGES.length) * 100);
    }
  }, [deploymentStatus]);

  interface socketMessage {
    stage: number;
    termLogs?: string;
    msg?: string;
  }

  type SocketMessage = string | socketMessage;

  const api_server = import.meta.env.VITE_API_SERVER_URL;
  console.log(api_server);

  useEffect(() => {
    const handleMessage = (msg: SocketMessage) => {
      let parsedMsg: socketMessage;

      if (typeof msg === 'string') {
        try {
          parsedMsg = JSON.parse(msg);
        } catch (error) {
          console.error("Error parsing JSON:", error);
          return;
        }
      } else {
        parsedMsg = msg;
      }

      if (parsedMsg.termLogs) {
        setTermLogs((prevLogs) => [...prevLogs, parsedMsg.termLogs!]);
      }
      setCurrentStage(parsedMsg.stage);
    };

    socket.on("message", handleMessage);

    return () => {
      socket.off("message", handleMessage);
    };
  }, [socket]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit('disconnecting-client', {
        projectSlug,
        message: 'Client is disconnecting'
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket.emit('disconnecting-client', {
        projectSlug,
        message: 'Client manually unmounted'
      });
    };
  }, [projectSlug]);

  useEffect(() => {
    console.log(`Current Stage ${currentStage}`);

    setDeploymentStatus(prev => {
      if (!prev) return null;
      const newStages = prev.stages.map((stage, index) => ({
        ...stage,
        status:
          index < currentStage ? 'success' as const :
            index === currentStage ? 'in-progress' as const :
              'pending' as const
      }));

      if (currentStage == DEPLOYMENT_STAGES.length) {
        setIsLoading(false);
        setShowModal(true);
        return {
          status: 'success',
          currentStage: DEPLOYMENT_STAGES.length,
          stages: newStages.map(stage => ({ ...stage, status: 'success' })),
          deployedLink: deployedLink
        };
      }
      return { ...prev, currentStage, stages: newStages };
    });
  }, [currentStage, deployedLink]);

  // Function to fetch repository folders
  const fetchRepoFolders = useCallback(async () => {
    if (!githubUrl.trim()) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    setIsFetchingFolders(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_SERVER_URL}/repo-folders?repoUrl=${encodeURIComponent(githubUrl)}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch folders: ${response.status}`);
      }

      const data = await response.json();
      setRepoFolders(data.folders || []);

      // Set the first folder as default if available
      if (data.folders && data.folders.length > 0) {
        setSelectedFolder(data.folders[0]);
      }
    } catch (error) {
      console.error('Error fetching repo folders:', error);
      alert('Failed to load repository folders. Please check the URL and try again.');
    } finally {
      setIsFetchingFolders(false);
    }
  }, [githubUrl]);

  // Fetch folders when GitHub URL changes
  useEffect(() => {
    if (githubUrl.trim()) {
      fetchRepoFolders();
    }
  }, [githubUrl, fetchRepoFolders]);

  const handleDeploy = useCallback(async () => {
    if (!githubUrl.trim()) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    if (!selectedFolder) {
      alert('Please select a folder to deploy');
      return;
    }

    setIsLoading(true);
    setDeploymentStatus(createInitialDeploymentStatus());

    try {
      const deployReq = await fetch(api_server, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gitURL: githubUrl,
          folder: selectedFolder  // Include the selected folder in the request
        }),
      });

      if (!deployReq.ok) {
        throw new Error(`Response status: ${deployReq.status}`);
      }

      const json = await deployReq.json();
      console.log("json");
      console.log(json);

      setProjectSlug(json.data.projectSlug);
      setDeployedLink(json.data.url);

      socket.emit('subscribe', `logs:${json.data.projectSlug}`);
      console.log('subscribe request sent');

    } catch (error) {
      console.error((error as Error).message);
      setIsLoading(false);
    }
  }, [githubUrl, selectedFolder, api_server]);

  return (
    <div className={`min-h-screen bg-gray-900 flex ${deploymentStatus ? 'items-center' : 'pt-20'} justify-center p-6`}>
      <div className={`bg-gray-800 rounded-lg shadow-xl ${deploymentStatus ? 'max-w-7xl ' : 'max-w-3xl max-h-full'} w-full p-8 flex flex-col md:flex-row`}>
        {/* Left Side Form - Deployment UI */}
        <div className="flex-1 pr-0 md:pr-6">
          <h1 className="text-3xl font-bold text-white text-center">GitHub Deployment</h1>

          {/* GitHub URL Input */}
          <div className="mt-4">
            <label className="text-gray-300 text-sm mb-1 block">Repository URL</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={githubUrl}
                onChange={e => setGithubUrl(e.target.value)}
                placeholder="Enter GitHub Repository URL"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={fetchRepoFolders}
                disabled={!githubUrl || isFetchingFolders}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 flex items-center"
              >
                {isFetchingFolders ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-1" />
                ) : (
                  <GitBranch className="w-4 h-4 mr-1" />
                )}
                Fetch
              </button>
            </div>
          </div>

          {/* Folder Selection Dropdown */}
          <div className="mt-4">
            <label className="text-gray-300 text-sm mb-1 block">Project Folder</label>
            <div className="relative">
              <button
                type="button"
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg flex justify-between items-center"
                onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                disabled={isLoading || repoFolders.length === 0}
              >
                <div className="flex items-center">
                  <Folder className="w-5 h-5 mr-2 text-gray-400" />
                  {selectedFolder || "Select a folder"}
                </div>
                {showFolderDropdown ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {showFolderDropdown && repoFolders.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {repoFolders.map((folder, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center"
                      onClick={() => {
                        setSelectedFolder(folder);
                        setShowFolderDropdown(false);
                      }}
                    >
                      <Folder className="w-4 h-4 mr-2 text-gray-400" />
                      {folder}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={!githubUrl || !selectedFolder || isLoading}
            className="w-full py-3 mt-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center"
          >
            {isLoading && <Loader2 className="animate-spin w-5 h-5 mr-2" />}
            {isLoading ? 'Deploying...' : 'Deploy'}
          </button>

          {/* Deployment Status */}
          {deploymentStatus && (
            <div className="mt-6 bg-gray-700 p-4 rounded-lg">
              <h2 className="text-white font-semibold mb-2">Deployment Status</h2>
              {DEPLOYMENT_STAGES.map((stage, index) => (
                <div key={stage.name} className="flex items-center space-x-4 p-4 rounded-lg bg-gray-800 mt-2">
                  <stage.icon className="w-6 h-6 text-white" />
                  <div className="flex-grow">
                    <h3 className="text-white font-semibold">{stage.name}</h3>
                    <p className="text-gray-400 text-sm">{stage.description}</p>
                  </div>
                  <span className={`font-bold ${deploymentStatus.stages[index].status === 'in-progress' ? 'text-blue-500' : deploymentStatus.stages[index].status === 'success' ? 'text-green-500' : 'text-gray-400'}`}>
                    {deploymentStatus.stages[index].status === 'in-progress' ? '🟠 In Progress' : deploymentStatus.stages[index].status === 'success' ? '✅ Completed' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side - Terminal Logs */}
        {deploymentStatus && (
          <TerminalUI termLogs={termLogs} />
        )}
      </div>

      {/* Deployment Success Modal */}
      {showModal && deploymentStatus?.status === 'success' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center w-96">
            <h2 className="text-xl font-bold text-white">Deployment Successful! 🎉</h2>
            <p className="text-gray-400 mt-2">Your project has been deployed successfully.</p>
            <a
              href={deploymentStatus.deployedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-4 text-blue-400 hover:underline"
            >
              {deploymentStatus.deployedLink}
            </a>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;