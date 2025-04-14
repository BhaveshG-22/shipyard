import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  ChevronUp,
  Github,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Terminal,
  Info,
  X,
  Link as LinkIcon
} from 'lucide-react';
import { Manager } from "socket.io-client";
import TerminalUI from "../components/terminalUI";
import WelcomeModal from "../components/WelcomeModal";

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
  // State variables
  const [githubUrl, setGithubUrl] = useState<string>('https://github.com/piyushgarg-dev/piyush-vite-app');
  const [projectSlug, setProjectSlug] = useState<string>('');
  const [deployedLink, setDeployedLink] = useState<string>('');
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [termLogs, setTermLogs] = useState<string[]>([]);

  // Repo folders state
  const [repoFolders, setRepoFolders] = useState<string[]>([]);
  const [repoBranches, setRepoBranches] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('/');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [isFetchingFolders, setIsFetchingFolders] = useState<boolean>(false);
  const [isFetchingBranches, setIsFetchingBranches] = useState<boolean>(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState<boolean>(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState<boolean>(false);

  // Error handling state
  const [folderError, setFolderError] = useState<string>('');
  const [branchError, setBranchError] = useState<string>('');
  const [urlError, setUrlError] = useState<string>('');

  // New state for welcome modal
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(false);

  // New state for toggling between deployment status and build logs
  const [activeTab, setActiveTab] = useState<'status' | 'logs'>('status');

  // Add refs for the dropdowns to handle outside clicks
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Check if the welcome modal should be shown when the app loads
  useEffect(() => {
    const dontShowWelcomeAgain = localStorage.getItem('dontShowWelcomeAgain');
    if (!dontShowWelcomeAgain) {
      setShowWelcomeModal(true);
    }
  }, []);

  useEffect(() => {
    if (deploymentStatus) {
      // Ensure progress is always a valid number (prevent NaN)
      const calculatedProgress = (deploymentStatus.currentStage / DEPLOYMENT_STAGES.length) * 100;
      setProgress(isNaN(calculatedProgress) ? 0 : calculatedProgress);
    }
  }, [deploymentStatus]);

  // Reset to default if repo url chnages
  useEffect(() => {
    const resetStates = async () => {
      setProjectSlug('');
      setDeployedLink('');
      setDeploymentStatus(null);
      setIsLoading(false);
      setProgress(0);
      setShowModal(false);
      setCurrentStage(0);
      setTermLogs([]);

      fetchRepoFolders()
      fetchRepoBranches()
 
      setIsFetchingFolders(false);
      setIsFetchingBranches(false);
      setShowFolderDropdown(false);
      setShowBranchDropdown(false);

      setFolderError('');
      setBranchError('');
      setUrlError('');

      setShowWelcomeModal(false);
      setActiveTab('status');
    };

    resetStates();
  }, [githubUrl]);




  // Add click outside handler to close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(event.target as Node)) {
        setShowFolderDropdown(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false);
      }
    }

    // Add event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Remove event listener on cleanup
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  interface socketMessage {
    stage: number;
    termLogs?: string;
    msg?: string;
  }

  type SocketMessage = string | socketMessage;

  const api_server = import.meta.env.VITE_API_SERVER_URL;

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
        console.log(parsedMsg.termLogs);
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

  // Function to validate GitHub URL
  const validateGithubUrl = (url: string): boolean => {
    if (!url) {
      setUrlError('GitHub URL is required');
      return false;
    }

    const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-._]+\/?$/;
    if (!githubRegex.test(url)) {
      setUrlError('Please enter a valid GitHub repository URL');
      return false;
    }

    setUrlError('');
    return true;
  };

  // Function to fetch repository folders
  const fetchRepoFolders = useCallback(async () => {
    if (!validateGithubUrl(githubUrl)) {
      return;
    }

    setFolderError('');
    setIsFetchingFolders(true);
    try {
      const response = await fetch(`${api_server}/repo-folders?repoUrl=${encodeURIComponent(githubUrl)}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch folders: ${response.status}`);
      }

      const data = await response.json();

      if (!data.folders || data.folders.length === 0) {
        setFolderError('No folders found in this repository');
        setRepoFolders([]);
        setSelectedFolder('/');
        return;
      }

      setRepoFolders(data.folders || []);
    } catch (error) {
      console.error('Error fetching repo folders:', error);
      setFolderError('Failed to load repository folders. Please check the URL and try again.');
      setRepoFolders([]);
      setSelectedFolder('/');
    } finally {
      setIsFetchingFolders(false);
    }
  }, [githubUrl, api_server]);

  // Function to fetch repository branches
  const fetchRepoBranches = useCallback(async () => {
    if (!validateGithubUrl(githubUrl)) {
      return;
    }

    setBranchError('');
    setIsFetchingBranches(true);
    try {
      const response = await fetch(`${api_server}/repo-branches?repoUrl=${encodeURIComponent(githubUrl)}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch branches: ${response.status}`);
      }

      const data = await response.json();

      if (!data.branches || data.branches.length === 0) {
        setBranchError('No branches found in this repository');
        setRepoBranches([]);
        setSelectedBranch('main');
        return;
      }

      setRepoBranches(data.branches || []);
      // If the previously selected branch is not in the new list, default to the first one
      if (data.branches.length > 0 && !data.branches.includes(selectedBranch)) {
        setSelectedBranch(data.branches[0]);
      }

    } catch (error) {
      console.error('Error fetching repo branches:', error);
      setBranchError('Failed to load repository branches. Please check the URL and try again.');
      setRepoBranches([]);
      setSelectedBranch('main');
    } finally {
      setIsFetchingBranches(false);
    }
  }, [githubUrl, api_server, selectedBranch]);

  // Fetch folders and branches when GitHub URL changes and is valid
  useEffect(() => {
    if (githubUrl.trim() && validateGithubUrl(githubUrl)) {
      fetchRepoFolders();
      fetchRepoBranches();
    }
  }, [githubUrl, fetchRepoFolders, fetchRepoBranches]);

  const handleGithubUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setGithubUrl(url);

    // Clear error when user starts typing again
    if (urlError) {
      setUrlError('');
    }
  };

  const handleDeploy = useCallback(async () => {
    // Validate inputs
    if (!validateGithubUrl(githubUrl)) {
      return;
    }

    if (!selectedFolder) {
      setFolderError('Please select a folder to deploy');
      return;
    }

    setFolderError('');
    setUrlError('');
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
          folder: selectedFolder,
          branch: selectedBranch
        }),
      });

      if (!deployReq.ok) {
        throw new Error(`Response status: ${deployReq.status}`);
      }

      const json = await deployReq.json();

      setProjectSlug(json.data.projectSlug);
      setDeployedLink(json.data.url);

      socket.emit('subscribe', `logs:${json.data.projectSlug}`);
    } catch (error) {
      console.error((error as Error).message);
      setIsLoading(false);
      setDeploymentStatus(null);
      alert(`Deployment failed: ${(error as Error).message}`);
    }
  }, [githubUrl, selectedFolder, selectedBranch, api_server]);

  // Function to get status icon based on deployment stage status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in-progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-6">
      {/* Welcome Modal */}
      <WelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
      />

      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-7xl w-full p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Github className="w-8 h-8 text-blue-400 mr-3" />
            <h1 className="text-3xl font-bold text-white">GitHub Deployment</h1>
          </div>

          {/* Info button to show welcome modal again */}
          <button
            onClick={() => setShowWelcomeModal(true)}
            className="flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
            title="Show project support information"
          >
            <Info className="w-4 h-4 mr-1.5" />
            <span className="text-sm">Project Support Info</span>
          </button>
        </div>

        <div className="flex flex-row gap-8">
          {/* Repository Configuration */}
          <div className="bg-gray-750 rounded-lg p-5 border border-gray-700 shadow-lg max-w-4xl mx-auto w-full">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <GitBranch className="w-5 h-5 mr-2 text-blue-400" />
              Repository Configuration
            </h2>

            {/* GitHub URL Input */}
            <div className="mb-4">
              <label className="text-gray-300 text-sm font-medium mb-1.5 block">Repository URL</label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Github className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={githubUrl}
                    onChange={handleGithubUrlChange}
                    placeholder="https://github.com/username/repo"
                    className={`w-full pl-10 pr-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition ${urlError ? 'border border-red-500' : 'border border-gray-600'}`}
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={() => {
                    fetchRepoFolders();
                    fetchRepoBranches();
                  }}
                  disabled={!githubUrl || isFetchingFolders || isFetchingBranches || isLoading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 flex items-center"
                  title="Refresh repository data"
                >
                  {isFetchingFolders || isFetchingBranches ? (
                    <Loader2 className="animate-spin w-5 h-5" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              </div>
              {urlError && <p className="mt-1 text-sm text-red-400">{urlError}</p>}
            </div>

            {/* Folder Selection Dropdown */}
            <div className="mb-5" ref={folderDropdownRef}>
              <label className="text-gray-300 text-sm font-medium mb-1.5 block">Project Folder</label>
              <div className="relative">
                <button
                  type="button"
                  className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg flex justify-between items-center transition-colors ${folderError ? 'border border-red-500' : 'border border-gray-600'} ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-650'}`}
                  onClick={() => {
                    if (!isLoading) {
                      setShowFolderDropdown(!showFolderDropdown);
                      setShowBranchDropdown(false); // Close other dropdown
                    }
                  }}
                  disabled={isLoading}
                >
                  <div className="flex items-center">
                    <Folder className="w-5 h-5 mr-2 text-gray-400" />
                    {selectedFolder || "Select a folder"}
                  </div>
                  {showFolderDropdown ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {showFolderDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 rounded-lg shadow-xl border border-gray-600 max-h-60 overflow-y-auto">
                    {repoFolders.length > 0 ? (
                      repoFolders.map((folder, index) => (
                        <div
                          key={index}
                          className="px-4 py-2.5 hover:bg-gray-600 cursor-pointer flex items-center transition-colors duration-150"
                          onClick={() => {
                            setSelectedFolder(folder);
                            setShowFolderDropdown(false);
                            setFolderError('');
                          }}
                        >
                          <Folder className="w-4 h-4 mr-2 text-gray-400" />
                          <span className={selectedFolder === folder ? 'font-medium text-blue-400' : 'text-white'}>
                            {folder}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-400 text-center">
                        No folders available
                      </div>
                    )}
                  </div>
                )}
              </div>
              {folderError && <p className="mt-1 text-sm text-red-400">{folderError}</p>}

              {/* Maintain consistent spacing with placeholder even when not fetching */}
              <div className="h-6">
                {isFetchingFolders && (
                  <div className="flex items-center mt-2 text-sm text-gray-400">
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    <span>Fetching folders...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Branch Selection Dropdown */}
            <div className="mb-5" ref={branchDropdownRef}>
              <label className="text-gray-300 text-sm font-medium mb-1.5 block">Project Branch</label>
              <div className="relative">
                <button
                  type="button"
                  className={`w-full px-4 py-3 bg-gray-700 text-white rounded-lg flex justify-between items-center transition-colors ${branchError ? 'border border-red-500' : 'border border-gray-600'} ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-650'}`}
                  onClick={() => {
                    if (!isLoading) {
                      setShowBranchDropdown(!showBranchDropdown);
                      setShowFolderDropdown(false); // Close other dropdown
                    }
                  }}
                  disabled={isLoading}
                >
                  <div className="flex items-center">
                    <GitBranch className="w-5 h-5 mr-2 text-gray-400" />
                    {selectedBranch || "Select a branch"}
                  </div>
                  {showBranchDropdown ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {showBranchDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 rounded-lg shadow-xl border border-gray-600 max-h-60 overflow-y-auto">
                    {repoBranches.length > 0 ? (
                      repoBranches.map((branch, index) => (
                        <div
                          key={index}
                          className="px-4 py-2.5 hover:bg-gray-600 cursor-pointer flex items-center transition-colors duration-150"
                          onClick={() => {
                            setSelectedBranch(branch);
                            setShowBranchDropdown(false);
                            setBranchError('');
                          }}
                        >
                          <GitBranch className="w-4 h-4 mr-2 text-gray-400" />
                          <span className={selectedBranch === branch ? 'font-medium text-blue-400' : 'text-white'}>
                            {branch}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-400 text-center">
                        No branches available
                      </div>
                    )}
                  </div>
                )}
              </div>
              {branchError && <p className="mt-1 text-sm text-red-400">{branchError}</p>}

              {/* Maintain consistent spacing with placeholder even when not fetching */}
              <div className="h-6">
                {isFetchingBranches && (
                  <div className="flex items-center mt-2 text-sm text-gray-400">
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    <span>Fetching branches...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Deploy Button */}
            <div className="mt-6">
              <button
                onClick={handleDeploy}
                disabled={isLoading || !githubUrl || !!urlError}
                className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center transition-colors ${isLoading
                  ? 'bg-blue-700 text-blue-100 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <GitBranch className="w-5 h-5 mr-2" />
                    Deploy Project
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel with Toggle */}
          {deploymentStatus && (
            <div className="bg-gray-750 rounded-lg border border-gray-700 shadow-lg max-w-4xl mx-auto w-full">
              {/* Toggle Bar */}
              <div className="flex border-b border-gray-700">
                <button
                  className={`flex-1 py-3 px-4 flex items-center justify-center ${activeTab === 'status'
                    ? 'bg-gray-700 text-white'
                    : 'bg-transparent text-gray-400 hover:text-gray-300'
                    } transition-colors`}
                  onClick={() => setActiveTab('status')}
                >
                  <Building className="w-4 h-4 mr-2" />
                  <span className="font-medium">Deployment Status</span>
                </button>
                <button
                  className={`flex-1 py-3 px-4 flex items-center justify-center ${activeTab === 'logs'
                    ? 'bg-gray-700 text-white'
                    : 'bg-transparent text-gray-400 hover:text-gray-300'
                    } transition-colors`}
                  onClick={() => setActiveTab('logs')}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  <span className="font-medium">Build Logs</span>
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-5">
                {activeTab === 'status' ? (
                  /* Deployment Status Content */
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                      <Building className="w-5 h-5 mr-2 text-blue-400" />
                      Deployment Status
                    </h2>

                    {/* Progress Bar */}
                    <div className="mb-5">
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-400">
                        <span>Build Started</span>
                        <span>{Math.round(progress)}% Complete</span>
                      </div>
                    </div>

                    {/* Deploy Stages */}
                    <div className="space-y-3 mb-4">
                      {deploymentStatus.stages.map((stage, index) => (
                        <div key={index} className="flex items-center">
                          <div className="mr-3">
                            {getStatusIcon(stage.status)}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <span className={`font-medium ${stage.status === 'success' ? 'text-green-400' :
                                stage.status === 'in-progress' ? 'text-blue-400' :
                                  stage.status === 'failed' ? 'text-red-400' : 'text-gray-400'
                                }`}>
                                {stage.name}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              {DEPLOYMENT_STAGES[index].description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Permanent Deployed Link Display */}
                    {deployedLink && deploymentStatus.status === 'success' && (
                      <div className="mt-5 p-3 bg-gray-700 rounded-lg border border-gray-600">
                        <h3 className="flex items-center text-white text-md font-medium mb-2">
                          <LinkIcon className="w-4 h-4 mr-2 text-green-400" />
                          Deployed URL
                        </h3>
                        <div className="flex items-center">
                          <a
                            href={deployedLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 truncate flex-1"
                          >
                            {deployedLink}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(deployedLink);
                              alert('Copied to clipboard!');
                            }}
                            className="ml-2 p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white transition-colors"
                            title="Copy to clipboard"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Build Logs Content */
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
                      <Terminal className="w-5 h-5 mr-2 text-blue-400" />
                      Build Logs
                    </h2>

                    <div className="bg-gray-900 rounded-lg p-3 h-96 overflow-y-auto font-mono text-xs text-gray-300">
                      {termLogs.length > 0 ? (
                        <TerminalUI termLogs={termLogs} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          <p>Deployment logs will appear here when the process starts</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deployment Success Modal */}
          {showModal && deploymentStatus?.status === 'success' && deployedLink && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-md w-full p-6 animate-fadeIn">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
                    <h2 className="text-xl font-bold text-white">Deployment Successful!</h2>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-gray-300 mb-4">
                  Your project has been successfully deployed and is now live at:
                </p>

                <div className="bg-gray-700 p-3 rounded-lg mb-5 flex items-center">
                  <a
                    href={deployedLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 truncate flex-1"
                  >
                    {deployedLink}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(deployedLink);
                      alert('Copied to clipboard!');
                    }}
                    className="ml-2 p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Close Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;