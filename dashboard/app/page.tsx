'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredAuth } from '@/lib/auth';

export default function HeroPage() {
    const router = useRouter();
    const heroRef = useRef<HTMLDivElement>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isManual, setIsManual] = useState(true);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        // Trigger entrance animation
        const timer = setTimeout(() => setEntered(true), 100);

        // Mouse parallax
        const handleMouse = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 2;
            const y = (e.clientY / window.innerHeight - 0.5) * 2;
            setMousePos({ x, y });
        };
        window.addEventListener('mousemove', handleMouse);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('mousemove', handleMouse);
        };
    }, []);

    const goToLogin = () => router.push('/login');
    const goToDashboard = () => {
        const auth = getStoredAuth();
        if (auth) {
            router.push('/dashboard');
        } else {
            router.push('/login');
        }
    };

    return (
        <div className="hero-page" ref={heroRef}>
            {/* Background Grid */}
            <div className="hero-bg-grid" />

            {/* Floating ambient shapes */}
            <div className="hero-ambient-shapes">
                <div className="ambient-shape shape-1" style={{ transform: `translate(${mousePos.x * -8}px, ${mousePos.y * -8}px)` }} />
                <div className="ambient-shape shape-2" style={{ transform: `translate(${mousePos.x * 5}px, ${mousePos.y * 5}px)` }} />
                <div className="ambient-shape shape-3" style={{ transform: `translate(${mousePos.x * -12}px, ${mousePos.y * 12}px)` }} />
            </div>

            {/* Navigation */}
            <nav className={`hero-nav ${entered ? 'entered' : ''}`}>
                <div className="hero-nav-logo">
                    <div className="hero-nav-icon">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M14 2L2 8v12l12 6 12-6V8L14 2z" stroke="#1D4ED8" strokeWidth="2" fill="rgba(29,78,216,0.1)" />
                            <circle cx="14" cy="14" r="4" fill="#1D4ED8" />
                        </svg>
                    </div>
                    <span className="hero-nav-brand">HIMT</span>
                </div>
                <div className="hero-nav-actions">
                    <button className="hero-btn-ghost" onClick={goToLogin}>Sign In</button>
                    <button className="hero-btn-primary" onClick={goToLogin}>Get Started</button>
                </div>
            </nav>

            {/* Main Content */}
            <div className="hero-content">
                {/* Text Block */}
                <div className={`hero-text-block ${entered ? 'entered' : ''}`}>
                    <div className="hero-badge">Privacy Intelligence Platform</div>
                    <h1 className="hero-headline">
                        See exactly who<br />
                        <span className="hero-headline-accent">tracks you online</span>
                    </h1>
                    <p className="hero-subtext">
                        How I Met Your Tracker uses machine learning to detect, classify, and block
                        invisible trackers across every site you visit. Get actionable intelligence,
                        not just numbers.
                    </p>
                    <div className="hero-cta-group">
                        <button className="hero-btn-primary hero-btn-lg" onClick={goToLogin}>
                            Get Started Free
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ marginLeft: '8px' }}>
                                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                        <button className="hero-btn-outline hero-btn-lg" onClick={goToDashboard}>
                            View Dashboard
                        </button>
                    </div>
                </div>

                {/* Orchestration Diagram */}
                <div className={`hero-diagram ${entered ? 'entered' : ''}`} style={{ transform: `translate(${mousePos.x * 3}px, ${mousePos.y * 3}px)` }}>
                    {/* SVG Connection Paths */}
                    <svg className="hero-svg-connections" viewBox="0 0 600 400" fill="none" preserveAspectRatio="xMidYMid meet">
                        {/* Input to Hub paths */}
                        <path className="hero-path path-1" d="M80 80 Q200 80 280 200" stroke="#E2E8F0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <path className="hero-path path-2" d="M60 200 Q170 200 280 200" stroke="#E2E8F0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <path className="hero-path path-3" d="M80 320 Q200 320 280 200" stroke="#E2E8F0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        {/* Hub to Output paths */}
                        <path className="hero-path path-4" d="M320 200 Q420 80 520 90" stroke="#E2E8F0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <path className="hero-path path-5" d="M320 200 Q420 200 520 200" stroke="#E2E8F0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                        <path className="hero-path path-6" d="M320 200 Q420 320 520 310" stroke="#E2E8F0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />

                        {/* Traveling data pulses */}
                        <circle className="hero-pulse pulse-1" r="4" fill="#1D4ED8">
                            <animateMotion dur="3s" repeatCount="indefinite" path="M80 80 Q200 80 280 200" />
                        </circle>
                        <circle className="hero-pulse pulse-2" r="4" fill="#10b981">
                            <animateMotion dur="3.5s" repeatCount="indefinite" path="M60 200 Q170 200 280 200" />
                        </circle>
                        <circle className="hero-pulse pulse-3" r="4" fill="#f59e0b">
                            <animateMotion dur="4s" repeatCount="indefinite" path="M80 320 Q200 320 280 200" />
                        </circle>
                        <circle className="hero-pulse pulse-4" r="3" fill="#1D4ED8">
                            <animateMotion dur="3s" repeatCount="indefinite" begin="1.5s" path="M320 200 Q420 80 520 90" />
                        </circle>
                        <circle className="hero-pulse pulse-5" r="3" fill="#10b981">
                            <animateMotion dur="3.5s" repeatCount="indefinite" begin="1.5s" path="M320 200 Q420 200 520 200" />
                        </circle>
                        <circle className="hero-pulse pulse-6" r="3" fill="#f59e0b">
                            <animateMotion dur="4s" repeatCount="indefinite" begin="1.5s" path="M320 200 Q420 320 520 310" />
                        </circle>
                    </svg>

                    {/* Input Nodes (Left) */}
                    <div className="hero-input-cluster" style={{ transform: `translate(${mousePos.x * -6}px, ${mousePos.y * -6}px)` }}>
                        <div className="hero-node node-input node-1">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 2a6 6 0 110 12 6 6 0 010-12zm-1 3v6l5-3-5-3z" fill="#1D4ED8" /></svg>
                            <span>Network</span>
                        </div>
                        <div className="hero-node node-input node-2">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.1)" /><path d="M2 8h16" stroke="#10b981" strokeWidth="1.5" /></svg>
                            <span>Browsing</span>
                        </div>
                        <div className="hero-node node-input node-3">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 4h12v12H4z" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(245,158,11,0.1)" /><path d="M7 8h6M7 12h4" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" /></svg>
                            <span>Scripts</span>
                        </div>
                    </div>

                    {/* Central Hub */}
                    <div className="hero-hub" style={{ transform: `translate(${mousePos.x * 2}px, ${mousePos.y * 2}px)` }}>
                        <div className="hero-hub-ring ring-outer" />
                        <div className="hero-hub-ring ring-inner" />
                        <div className="hero-hub-core">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                <path d="M16 4L4 10v12l12 6 12-6V10L16 4z" stroke="white" strokeWidth="2" />
                                <circle cx="16" cy="16" r="5" fill="white" fillOpacity="0.9" />
                            </svg>
                        </div>
                        <div className="hero-hub-label">ML Engine</div>
                    </div>

                    {/* Output Cards (Right) */}
                    <div className="hero-output-cluster" style={{ transform: `translate(${mousePos.x * 6}px, ${mousePos.y * 6}px)` }}>
                        <div className="hero-card-output card-out-1">
                            <div className="hero-card-out-header">
                                <div className="hero-card-dot dot-green" />
                                <span>Privacy Score</span>
                            </div>
                            <div className="hero-card-out-value">87<span>/100</span></div>
                        </div>
                        <div className="hero-card-output card-out-2">
                            <div className="hero-card-out-header">
                                <div className="hero-card-dot dot-amber" />
                                <span>Threats Found</span>
                            </div>
                            <div className="hero-card-out-value">3<span> active</span></div>
                        </div>
                        <div className="hero-card-output card-out-3">
                            <div className="hero-card-out-header">
                                <div className="hero-card-dot dot-blue" />
                                <span>Blocked</span>
                            </div>
                            <div className="hero-card-out-value">24<span> trackers</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Metrics */}
            <div className={`hero-comparison ${entered ? 'entered' : ''}`}>
                <div className="hero-comparison-toggle">
                    <button className={`hero-toggle-btn ${isManual ? 'active' : ''}`} onClick={() => setIsManual(true)}>
                        Without HIMT
                    </button>
                    <button className={`hero-toggle-btn ${!isManual ? 'active' : ''}`} onClick={() => setIsManual(false)}>
                        With HIMT
                    </button>
                </div>
                <div className="hero-comparison-metrics">
                    <div className="hero-metric">
                        <div className="hero-metric-label">Trackers Detected</div>
                        <div className={`hero-metric-value ${isManual ? 'bad' : 'good'}`}>
                            {isManual ? '0' : '47'}
                        </div>
                    </div>
                    <div className="hero-metric">
                        <div className="hero-metric-label">Threats Blocked</div>
                        <div className={`hero-metric-value ${isManual ? 'bad' : 'good'}`}>
                            {isManual ? 'None' : '24'}
                        </div>
                    </div>
                    <div className="hero-metric">
                        <div className="hero-metric-label">Privacy Score</div>
                        <div className={`hero-metric-value ${isManual ? 'bad' : 'good'}`}>
                            {isManual ? '12%' : '87%'}
                        </div>
                    </div>
                    <div className="hero-metric">
                        <div className="hero-metric-label">Response Time</div>
                        <div className={`hero-metric-value ${isManual ? 'bad' : 'good'}`}>
                            {isManual ? 'N/A' : '<2ms'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Row */}
            <div className={`hero-features ${entered ? 'entered' : ''}`}>
                <div className="hero-feature-card">
                    <div className="hero-feature-icon icon-blue">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#1D4ED8" strokeWidth="2" /><path d="M12 6v6l4 2" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" /></svg>
                    </div>
                    <h3>Real-time Detection</h3>
                    <p>Every network request analyzed instantly using trained ML classifiers</p>
                </div>
                <div className="hero-feature-card">
                    <div className="hero-feature-icon icon-green">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7l9 5 9-5-9-5z" stroke="#10b981" strokeWidth="2" /><path d="M3 12l9 5 9-5" stroke="#10b981" strokeWidth="2" /><path d="M3 17l9 5 9-5" stroke="#10b981" strokeWidth="2" /></svg>
                    </div>
                    <h3>Deep Classification</h3>
                    <p>Neural networks categorize unknown trackers with 85%+ accuracy</p>
                </div>
                <div className="hero-feature-card">
                    <div className="hero-feature-icon icon-amber">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#f59e0b" strokeWidth="2" /><path d="M9 12l2 2 4-4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                    <h3>Smart Blocking</h3>
                    <p>Context-aware enforcement that adapts to your browsing patterns</p>
                </div>
            </div>

            {/* Footer */}
            <footer className="hero-footer">
                <p>Built for privacy. Open source.</p>
            </footer>
        </div>
    );
}
