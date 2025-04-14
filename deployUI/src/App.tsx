import React, { useState, useCallback, useEffect } from 'react';
import {
  GitBranch,
  Building,
  Check,
  Upload,
  Globe,
  Loader2,
  ListEnd,
} from 'lucide-react';
import { Manager } from "socket.io-client";
import TerminalUI from "../components/terminalUI"
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
  const [currentStage, setCurrectStage] = useState<number>(0);
  const [termLogs, setTermLogs] = useState<string[]>([]);

  useEffect(() => {
    if (deploymentStatus) {
      setProgress((deploymentStatus.currentStage / DEPLOYMENT_STAGES.length) * 100);
    }
  }, [deploymentStatus]);


  //handel socket.io logs


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
      setCurrectStage(parsedMsg.stage);

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
    console.log(`Currect Stage ${currentStage}`);

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
  }, [currentStage])

  const handleDeploy = useCallback(async () => {


    if (!githubUrl.trim()) {
      alert('Please enter a valid GitHub repository URL');
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
        body: JSON.stringify({ gitURL: githubUrl }),
      });

      if (!deployReq.ok) {
        throw new Error(`Response status: ${deployReq.status}`);
      }

      const json = await deployReq.json();
      console.log("json");
      console.log(json);

      setProjectSlug(json.data.projectSlug)
      setDeployedLink(json.data.url)

      socket.emit('subscribe', `logs:${json.data.projectSlug}`)
      console.log('subscribe request sent');

    } catch (error) {
      console.error((error as Error).message);
    }
  }, [githubUrl]);

  return (
    <div className={`min-h-screen bg-gray-900 flex ${deploymentStatus ? 'items-center' : 'pt-20'} justify-center p-6`}>
      <div className={`bg-gray-800 rounded-lg shadow-xl ${deploymentStatus ? 'max-w-7xl ' : 'max-w-3xl  max-h-60'} w-full p-8 flex`}>
        {/* Left Side Form - Deployment UI */}
        <div className="flex-1 pr-6">
          <h1 className="text-3xl font-bold text-white text-center">GitHub Deployment</h1>
          <span className='flex space-x-1 w-full'>
            <input
              type="text"
              value={githubUrl}
              onChange={e => setGithubUrl(e.target.value)}
              placeholder="Enter GitHub Repository URL"
              className="w-2/3 px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 mt-4"
              disabled={isLoading}
            />
            <button
              onClick={() => handleDeploy()}
              disabled={!githubUrl || isLoading}
              className="w-1/3 py-3 mt-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center"
            >
              {isLoading && <Loader2 className="animate-spin w-5 h-5 mr-2" />}
              {isLoading ? 'Deploying...' : 'Deploy'}
            </button>

          </span>

          {deploymentStatus && (
            <div className="mt-6 bg-gray-700 p-4 rounded-lg">
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