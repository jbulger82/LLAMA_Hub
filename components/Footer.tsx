
import React from 'react';
import { useStore } from '../store';
import { AppIcon } from './icons';

const FooterLink: React.FC<{
  viewName: 'home' | 'features' | 'about' | 'mission' | 'proposals' | 'investors' | 'contact';
  children: React.ReactNode;
}> = ({ viewName, children }) => {
    const setActiveView = useStore(state => state.setActiveView);
    return (
        <a className="link link-hover" onClick={() => setActiveView(viewName)}>
            {children}
        </a>
    );
};

export const Footer: React.FC = () => {
    return (
        <footer className="footer p-10 bg-base-200 text-base-content border-t border-base-300">
            <aside>
                <AppIcon className="w-10 h-10" />
                <p>LlamaHub<br/>Local AI Orchestration</p>
            </aside> 
            <nav>
                <h6 className="footer-title">Navigate</h6> 
                <FooterLink viewName="home">Home</FooterLink>
                <FooterLink viewName="features">Features</FooterLink>
                <FooterLink viewName="contact">Contact</FooterLink>
            </nav> 
            <nav>
                <h6 className="footer-title">Company</h6> 
                <FooterLink viewName="about">About LlamaHub</FooterLink>
                <FooterLink viewName="mission">Our Mission</FooterLink>
            </nav>  
            <nav>
                <h6 className="footer-title">Business</h6> 
                <FooterLink viewName="proposals">Proposals</FooterLink>
                <FooterLink viewName="investors">Investors</FooterLink>
            </nav>
        </footer>
    );
};
