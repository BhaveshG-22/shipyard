import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-xl w-full shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 p-5">
          <div className="flex items-center">
            <CheckCircle2 className="w-6 h-6 text-green-400 mr-3" />
            <h2 className="text-xl font-bold text-white">Project Support Information</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-5">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Currently Supported:</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full mt-2 mr-2"></span>
                Static websites built with React, Vite, or similar JavaScript frameworks
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full mt-2 mr-2"></span>
                Projects with npm-based build systems
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full mt-2 mr-2"></span>
                Single-page applications (SPAs)
              </li>
            </ul>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Coming in Shipyard 2.0:</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2"></span>
                Server-side rendering (SSR) applications
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2"></span>
                Backend APIs and services
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2"></span>
                Database-dependent applications
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2"></span>
                Additional framework support beyond JavaScript/npm ecosystems
              </li>
              <li className="flex items-start">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mt-2 mr-2"></span>
                Advanced build configuration options
              </li>
            </ul>
          </div>
          
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-amber-400 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-400 mb-1">IMPORTANT:</h4>
                <p className="text-amber-200">
                  The current build process assumes projects have a standard npm build configuration with a <code className="bg-gray-700 px-1.5 py-0.5 rounded text-xs">build</code> script defined in package.json. Make sure your project includes this before deployment!
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-700 p-5 flex justify-end">
          <label className="flex items-center text-gray-400 mr-auto cursor-pointer">
            <input 
              type="checkbox" 
              className="mr-2 h-4 w-4 rounded bg-gray-700 border-gray-600 focus:ring-blue-500 text-blue-500"
              onChange={(e) => {
                if (e.target.checked) {
                  localStorage.setItem('dontShowWelcomeAgain', 'true');
                } else {
                  localStorage.removeItem('dontShowWelcomeAgain');
                }
              }}
            />
            Don't show this again
          </label>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;