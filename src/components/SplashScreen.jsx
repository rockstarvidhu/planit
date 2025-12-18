import React, { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);

  // Friendly loading steps
  const steps = [
    "Starting PlanIt...",
    "Connecting to server...",
    "Loading maps...",
    "Checking local weather...",
    "Finding best routes...",
    "Ready to go!"
  ];

  useEffect(() => {
    // Progress Bar Animation (0% to 100% over ~4 seconds)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Randomize speed slightly for realism
        return prev + Math.random() * 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Text Cycling Animation
    if (progress < 100) {
      const stepIndex = Math.min(
        Math.floor((progress / 100) * (steps.length - 1)),
        steps.length - 2
      );
      setLoadingStep(stepIndex);
    } else {
      setLoadingStep(steps.length - 1);
    }
  }, [progress]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black bg-grid-pattern relative overflow-hidden font-sans">
      
      {/* Background Spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black/0 to-black pointer-events-none"></div>

      {/* Center Content */}
      <div className="relative z-10 w-full max-w-md px-6 text-center">
        
        {/* Animated Logo */}
        <div className="mb-10 relative inline-block group">
          <div className="absolute inset-0 bg-blue-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl mx-auto transform transition-transform duration-700 hover:scale-105 hover:rotate-3">
            <svg className="w-12 h-12 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-black text-white mb-2 tracking-tighter animate-fade-in-up">
          Plan<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">it</span>
        </h1>
        <p className="text-gray-400 font-medium tracking-wide text-sm mb-12 uppercase opacity-80 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Your AI Travel Planner
        </p>

        {/* Progress Bar Container */}
        <div className="relative w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-4">
          {/* Moving Bar */}
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 transition-all duration-75 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Dynamic Loading Text */}
        <div className="flex justify-between items-center text-xs font-display tracking-wider">
          <span className="text-blue-400 min-w-[150px] text-left">
            {steps[loadingStep]}
          </span>
          <span className="text-gray-500">
            {Math.floor(progress)}%
          </span>
        </div>

      </div>

      {/* Footer Version */}
      <div className="absolute bottom-6 text-gray-700 text-xs font-mono">
        v1.0.3 // Beta
      </div>
    </div>
  );
}