// src/components/SplashScreen.jsx
import React from 'react';

export default function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-blue-500/30">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-7xl font-black text-white tracking-tight mb-4 animate-fade-in drop-shadow-2xl">
          Plan<span className="text-yellow-400">it</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-2xl text-gray-300 font-bold tracking-wide mb-8 animate-fade-in-delay">
          Your perfect day out, planned just for you
        </p>

        {/* Loading animation */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            { icon: '🎯', title: 'Personalized', desc: 'Tailored to your preferences' },
            { icon: '💰', title: 'Budget-friendly', desc: 'Smart cost optimization' },
            { icon: '🚀', title: 'Instant', desc: 'Generated in seconds' }
          ].map((feature, index) => (
            <div key={index} className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 animate-fade-in-up" style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="text-white font-black text-sm">{feature.title}</div>
              <div className="text-gray-400 text-xs font-medium">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom text */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-gray-500 text-sm font-bold">
        Made with ❤️ for amazing experiences
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-delay {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in-delay 0.8s ease-out 0.3s both;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out both;
        }
      `}</style>
    </div>
  );
}
