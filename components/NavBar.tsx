import React from 'react';
import { AppIcon } from './icons';
import { useStore } from '../store';

const NavLink: React.FC<{
  viewName: 'home' | 'features' | 'about' | 'mission' | 'proposals' | 'investors' | 'contact' | 'chat';
  children: React.ReactNode;
}> = ({ viewName, children }) => {
  const activeView = useStore(state => state.activeView);
  const setActiveView = useStore(state => state.setActiveView);

  const isActive = activeView === viewName;

  return (
    <li>
      <button 
        onClick={() => setActiveView(viewName)}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive ? 'text-primary' : 'text-base-content hover:bg-base-200'
        }`}
      >
        {children}
      </button>
    </li>
  );
};


export const NavBar: React.FC = () => {
    const setActiveView = useStore(state => state.setActiveView);
    const newChat = useStore(state => state.newChat);
    
    const handleLaunchApp = () => {
        newChat(); // This already sets the view to 'chat'
    };

    return (
        <header className="navbar bg-base-100/80 backdrop-blur-sm border-b border-base-300 sticky top-0 z-40 flex-shrink-0">
            <div className="navbar-start">
                 <div className="dropdown">
                    <label tabIndex={0} className="btn btn-ghost lg:hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" /></svg>
                    </label>
                    <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
                        <NavLink viewName="features">Features</NavLink>
                        <NavLink viewName="about">About LlamaHub</NavLink>
                        <NavLink viewName="mission">Our Mission</NavLink>
                        <NavLink viewName="proposals">Proposals</NavLink>
                        <NavLink viewName="investors">Investors</NavLink>
                        <NavLink viewName="contact">Contact</NavLink>
                    </ul>
                </div>
        <div className="flex items-center space-x-2">
          <AppIcon className="w-6 h-6" />
          <span className="font-bold">LlamaHub</span>
        </div>
            </div>
            <div className="navbar-center hidden lg:flex">
                <ul className="menu menu-horizontal px-1">
                    <NavLink viewName="features">Features</NavLink>
                    <NavLink viewName="about">About LlamaHub</NavLink>
                    <NavLink viewName="mission">Our Mission</NavLink>
                    <NavLink viewName="proposals">Proposals</NavLink>
                    <NavLink viewName="investors">Investors</NavLink>
                    <NavLink viewName="contact">Contact</NavLink>
                </ul>
            </div>
            <div className="navbar-end">
                <button onClick={handleLaunchApp} className="btn btn-primary">Launch App</button>
            </div>
        </header>
    );
};