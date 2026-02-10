'use client';

// Chrome extension API type for runtime communication
declare const chrome: any;

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAnalytics, getDeviceId, formatNumber, getPrivacyGrade, AnalyticsData } from '@/lib/api';
import { getStoredAuth, logout, User } from '@/lib/auth';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export default function Dashboard() {
    const router = useRouter();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<'7d' | '30d'>('7d');
    const [currentDeviceId, setCurrentDeviceId] = useState('');
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        // Check auth
        const auth = getStoredAuth();
        if (!auth) {
            router.push('/login');
            return;
        }
        setUser(auth);

        // Wait a bit for content script to sync deviceId from extension
        // Content script runs on page load and writes deviceId to localStorage
        const initData = async () => {
            // Small delay to allow content script to sync deviceId
            await new Promise(resolve => setTimeout(resolve, 500));

            const currentDeviceId = getDeviceId();
            console.log('[Dashboard] DeviceId from localStorage:', currentDeviceId);
            setCurrentDeviceId(currentDeviceId);

            await loadData();
        };

        initData();
    }, [range]);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    async function loadData() {
        setLoading(true);
        console.log('[Dashboard] Loading data...');
        const analytics = await fetchAnalytics(range);
        console.log('[Dashboard] Analytics result:', analytics);
        setData(analytics);
        setLoading(false);
    }

    if (loading || !user) {
        return (
            <div className="container">
                <Header deviceId={currentDeviceId} user={user} onLogout={handleLogout} />
                <div className="loading">
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container">
                <Header deviceId={currentDeviceId} user={user} onLogout={handleLogout} />
                <div className="empty-state">
                    <div className="empty-state-icon"></div>
                    <div className="empty-state-text">
                        No data available yet. Browse some websites with the extension installed.
                    </div>
                    <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
                        Your Device ID: <code className="device-id">{currentDeviceId}</code>
                    </p>
                </div>
            </div>
        );
    }

    const { summary, topCompanies, topCategories, timeline, recentTrackers } = data;
    const { grade, color } = getPrivacyGrade(summary.privacyScore);

    return (
        <div className="container">
            <Header deviceId={currentDeviceId} user={user} onLogout={handleLogout} />

            {/* Range Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="section-title">Privacy Snapshot</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        className="refresh-btn"
                        onClick={() => loadData()}
                        title="Refresh data"
                    >
                        ↻ Refresh
                    </button>
                    <div className="range-toggle">
                        <button
                            className={`range-btn ${range === '7d' ? 'active' : ''}`}
                            onClick={() => setRange('7d')}
                        >
                            Last 7 Days
                        </button>
                        <button
                            className={`range-btn ${range === '30d' ? 'active' : ''}`}
                            onClick={() => setRange('30d')}
                        >
                            Last 30 Days
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="card" style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="card-title">Privacy Score</div>
                    <div className="privacy-score">
                        <div className="privacy-score-ring" style={{ borderColor: color }}></div>
                        <div className="privacy-score-value" style={{ color }}>{grade}</div>
                    </div>
                    <div className="privacy-score-label">{summary.privacyScore}% Protected</div>
                </div>

                <StatCard title="Total Requests" value={formatNumber(summary.totalRequests)} />
                <StatCard title="Unique Trackers" value={formatNumber(summary.totalTrackers)} />
                <StatCard title="Blocked" value={formatNumber(summary.blocked)} color="var(--danger)" />
                <StatCard title="Allowed" value={formatNumber(summary.allowed)} color="var(--success)" />
            </div>

            {/* Charts */}
            <div className="charts-grid">
                {/* Timeline Chart */}
                <div className="chart-card">
                    <div className="chart-title">Tracking Activity Over Time</div>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                            <YAxis stroke="#71717a" fontSize={12} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="requests" stroke="#6366f1" name="Requests" strokeWidth={2} />
                            <Line type="monotone" dataKey="blocked" stroke="#ef4444" name="Blocked" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Categories Pie Chart */}
                <div className="chart-card">
                    <div className="chart-title">Tracker Categories</div>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={topCategories}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={2}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {topCategories.map((entry, index) => (
                                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ background: '#1a1a21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Companies */}
            <div className="chart-card" style={{ marginBottom: '32px' }}>
                <div className="chart-title">Top Tracking Companies</div>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCompanies} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis type="number" stroke="#71717a" fontSize={12} />
                        <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={12} width={150} />
                        <Tooltip
                            contentStyle={{ background: '#1a1a21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ML Threat Analysis Section */}
            <MLThreatAnalysis />

            {/* Recent Trackers Table */}
            <h2 className="section-title">Recent Trackers</h2>
            <div className="table-card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Company</th>
                            <th>Category</th>
                            <th>Risk</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentTrackers.slice(0, 10).map((tracker, idx) => (
                            <tr key={`${tracker.domain}-${idx}`}>
                                <td style={{ fontWeight: 500 }}>{tracker.domain}</td>
                                <td>{tracker.owner}</td>
                                <td>{tracker.category}</td>
                                <td>
                                    <span style={{
                                        color: tracker.riskScore >= 60 ? 'var(--danger)' :
                                            tracker.riskScore >= 30 ? 'var(--warning)' : 'var(--success)'
                                    }}>
                                        {tracker.riskScore}/100
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge badge-${getBadgeClass(tracker.enforcementMode)}`}>
                                        {tracker.enforcementMode}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ML Threat Analysis Component
function MLThreatAnalysis() {
    const [insights, setInsights] = useState<any>(null);

    useEffect(() => {
        // Try to get ML insights from extension
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            try {
                chrome.runtime.sendMessage({ type: 'GET_ML_INSIGHTS' }, (response: any) => {
                    if (response?.success && response.data) {
                        setInsights(response.data);
                    } else {
                        setInsights(getDemoInsights());
                    }
                });
            } catch {
                setInsights(getDemoInsights());
            }
        } else {
            setInsights(getDemoInsights());
        }
    }, []);

    if (!insights) return null;

    const { crossSiteTracking, dataExposure, fingerprintingThreats, recommendations, privacyScore } = insights;

    return (
        <div style={{ marginBottom: '32px' }}>
            <h2 className="section-title">ML Threat Analysis</h2>

            <div className="charts-grid">
                {/* Cross-site Tracking */}
                <div className="chart-card">
                    <div className="chart-title">Who's Watching You</div>
                    <div style={{ padding: '8px 0' }}>
                        {crossSiteTracking?.companies?.length > 0 ? (
                            crossSiteTracking.companies.slice(0, 5).map((company: any, idx: number) => (
                                <div key={idx} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 12px', borderRadius: '8px', marginBottom: '6px',
                                    background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #f59e0b'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}>{company.owner}</div>
                                        <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '2px' }}>
                                            {company.trackerCount} tracker{company.trackerCount > 1 ? 's' : ''} across {company.siteCount} sites
                                        </div>
                                    </div>
                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d',
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600
                                    }}>
                                        {company.siteCount} sites
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '24px', color: '#71717a' }}>
                                No cross-site tracking detected
                            </div>
                        )}
                    </div>
                </div>

                {/* Data Exposure */}
                <div className="chart-card">
                    <div className="chart-title">Your Data Exposure</div>
                    <div style={{ padding: '8px 0' }}>
                        {dataExposure?.totalCompanies > 0 && (
                            <div style={{
                                padding: '10px 12px', borderRadius: '8px', marginBottom: '10px',
                                background: 'rgba(99, 102, 241, 0.1)', borderLeft: '3px solid #6366f1',
                                color: '#a5b4fc', fontSize: '13px', fontWeight: 500
                            }}>
                                {dataExposure.headline}
                            </div>
                        )}
                        {dataExposure?.exposedDataTypes?.slice(0, 6).map((dtype: any, idx: number) => (
                            <div key={idx} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 12px', borderRadius: '6px', marginBottom: '4px',
                                background: 'rgba(255,255,255,0.03)'
                            }}>
                                <span style={{ color: '#cbd5e1', textTransform: 'capitalize', fontSize: '13px' }}>
                                    {dtype.dataType}
                                </span>
                                <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '12px' }}>
                                    → {dtype.companyCount} {dtype.companyCount > 1 ? 'companies' : 'company'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            {recommendations?.length > 0 && (
                <div className="chart-card" style={{ marginTop: '16px' }}>
                    <div className="chart-title">Recommended Actions</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', padding: '8px 0' }}>
                        {recommendations.slice(0, 4).map((rec: any, idx: number) => {
                            const priColor = rec.priority === 'critical' ? '#ef4444' : rec.priority === 'high' ? '#f59e0b' : '#6366f1';
                            return (
                                <div key={idx} style={{
                                    padding: '12px 14px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${priColor}`
                                }}>
                                    <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '13px', marginBottom: '4px' }}>
                                        {rec.icon} {rec.title}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.4 }}>
                                        {rec.description}
                                    </div>
                                    <div style={{
                                        marginTop: '6px', display: 'inline-block',
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                                        background: `${priColor}22`, color: priColor, fontWeight: 600, textTransform: 'uppercase'
                                    }}>
                                        {rec.priority}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Fingerprinting */}
            {fingerprintingThreats?.threats?.length > 0 && (
                <div className="chart-card" style={{ marginTop: '16px' }}>
                    <div className="chart-title">Fingerprinting Threats</div>
                    <div style={{ padding: '8px 0' }}>
                        {fingerprintingThreats.threats.slice(0, 5).map((threat: any, idx: number) => {
                            const sevColor = threat.severity === 'critical' ? '#ef4444' : threat.severity === 'high' ? '#f59e0b' : '#6366f1';
                            return (
                                <div key={idx} style={{
                                    padding: '10px 12px', borderRadius: '8px', marginBottom: '6px',
                                    background: 'rgba(255,255,255,0.04)', borderLeft: `3px solid ${sevColor}`
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '13px' }}>{threat.domain}</span>
                                        <span style={{
                                            background: `${sevColor}22`, color: sevColor,
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600
                                        }}>
                                            {threat.severity}
                                        </span>
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                                        {threat.techniques.map((t: any) => t.id).join(', ')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// Demo insights for when extension is not connected
function getDemoInsights() {
    return {
        crossSiteTracking: {
            companies: [
                { owner: 'Google', trackerCount: 4, siteCount: 12, message: 'Google follows you across 12 sites' },
                { owner: 'Meta', trackerCount: 2, siteCount: 8, message: 'Meta follows you across 8 sites' },
                { owner: 'Amazon', trackerCount: 2, siteCount: 5, message: 'Amazon follows you across 5 sites' },
            ],
            totalCrossSiteTrackers: 8,
            headline: '8 trackers follow you across multiple sites'
        },
        dataExposure: {
            exposedDataTypes: [
                { dataType: 'browsing history', companyCount: 14 },
                { dataType: 'interests', companyCount: 8 },
                { dataType: 'page views', companyCount: 12 },
                { dataType: 'click behavior', companyCount: 6 },
                { dataType: 'demographics', companyCount: 4 },
            ],
            totalCompanies: 14,
            headline: 'Your data is potentially shared with 14 companies'
        },
        fingerprintingThreats: {
            threats: [
                { domain: 'tracker.example.com', severity: 'critical', techniques: [{ id: 'canvas' }, { id: 'webgl' }, { id: 'audio' }], message: 'Uses 3 techniques' },
                { domain: 'analytics.example.com', severity: 'high', techniques: [{ id: 'canvas' }, { id: 'navigator' }], message: 'Uses 2 techniques' },
            ],
            totalDomains: 2
        },
        recommendations: [
            { icon: '', title: 'Block Google Ads', description: 'Google tracks you across 12 sites. Blocking reduces cross-site tracking by ~60%', priority: 'high', action: { type: 'block', domain: 'doubleclick.net' } },
            { icon: '', title: 'Stop fingerprinting', description: 'tracker.example.com uses 3 fingerprinting techniques to identify your device.', priority: 'critical' },
            { icon: '', title: 'Your privacy score is 45/100', description: '18 trackers are still allowed. Blocking the riskiest ones could improve your score by ~25 points.', priority: 'medium' },
        ],
        privacyScore: { score: 45, grade: 'C', headline: 'Your privacy needs attention' }
    };
}
function Header({ deviceId, user, onLogout }: { deviceId: string; user: User | null; onLogout: () => void }) {
    return (
        <header className="header">
            <div className="logo">
                <img src="/icon.png" alt="HIMT" />
                <span className="logo-text">Privacy Dashboard</span>
            </div>
            <div className="user-header">
                {user && <span className="user-email">{user.email}</span>}
                <button className="logout-btn" onClick={onLogout}>Logout</button>
            </div>
        </header>
    );
}

// Stat Card Component
function StatCard({ title, value, color = 'var(--text-primary)' }: { title: string; value: string; color?: string }) {
    return (
        <div className="card">
            <div className="card-title">{title}</div>
            <div className="card-value" style={{ color }}>{value}</div>
        </div>
    );
}

// Get badge class based on enforcement mode
function getBadgeClass(mode: string): string {
    switch (mode) {
        case 'block': return 'danger';
        case 'sandbox': return 'warning';
        case 'restrict': return 'info';
        case 'allow': return 'success';
        default: return 'info';
    }
}
