/* ═══════════════════════════════════════════════════════════
   MARKET SIMULATOR — MiroFish Swarm Intelligence UI
   ═══════════════════════════════════════════════════════════
   Four sub-views:
   1. Trigger Panel  — configure and launch simulations
   2. Live Progress  — real-time rounds + sentiment tracking
   3. Report View    — structured narrative with persona analysis
   4. History        — past simulations (placeholder for v2)
   ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import {
  Zap, Clock, DollarSign, Users, TrendingUp, TrendingDown,
  Minus, Play, RotateCcw, ChevronDown, ChevronUp, MessageCircle,
  Send, AlertCircle, CheckCircle2, Loader2, Brain,
  BarChart3, AlertTriangle
} from 'lucide-react';
import { GlowingEffect } from '../components/ui/glowing-effect';
import { useSimulation } from '../hooks/useSimulation';
import { useMarket } from '../stores/marketStore';
import { SparklesCore } from '../components/ui/sparkles';
import { GlobeDemo } from '../components/GlobeDemo';
// ── Tier Metadata (mirrors backend) ────────────────────────────
const TIERS = [
  { id: 'quick_pulse',     label: 'Quick Pulse',     agents: 10, rounds: 10, minutes: '~10 sec', cost: '$0.06', icon: Zap,         color: 'emerald' },
  { id: 'market_analysis', label: 'Market Analysis',  agents: 20, rounds: 15, minutes: '~20 sec', cost: '$0.12', icon: BarChart3,   color: 'blue' },
  { id: 'deep_scenario',   label: 'Deep Scenario',    agents: 30, rounds: 20, minutes: '~30 sec', cost: '$0.20', icon: Brain,       color: 'violet' },
] as const;

export default function MarketSimulator() {
  const { currentMarket } = useMarket();
  const {
    simulation, report, estimate, loading, error,
    fetchEstimate, startSimulation, chatWithAgent, reset,
    activeJob, deactivateJob,
  } = useSimulation();

  const [selectedTier, setSelectedTier] = useState('quick_pulse');
  const [eventText, setEventText] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [inputError, setInputError] = useState('');
  const [showRunningDialog, setShowRunningDialog] = useState(false);

  // Agent chat state
  const chatAgent = 'Lead Analyst'; // Hardcoded team leader
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Hydration happens automatically in useSimulation via simulationStore.hydrate()

  // Fetch estimate when tier changes
  useEffect(() => { fetchEstimate(selectedTier); }, [selectedTier, fetchEstimate]);

  const handleStart = async () => {
    if (!eventText.trim()) return;

    // Check if a simulation is already running
    if (activeJob && (activeJob.status === 'queued' || activeJob.status === 'running')) {
      setShowRunningDialog(true);
      return;
    }

    await _launchSimulation();
  };

  const _launchSimulation = async () => {
    const ctx = currentMarket ? {
      city: currentMarket.city,
      state: currentMarket.state_province,
      displayName: currentMarket.displayName,
    } : {};
    await startSimulation(selectedTier, eventText, ctx);
  };

  const handleConfirmReplace = async () => {
    if (activeJob) {
      await deactivateJob(activeJob.id);
    }
    setShowRunningDialog(false);
    await _launchSimulation();
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChat = async () => {
    if (!chatMessage.trim() || !simulation?.id || !chatAgent) return;
    
    const currentMessage = chatMessage;
    setChatMessage('');
    setChatLoading(true);
    
    // Cap chat history at 100 messages to prevent unbounded memory growth
    setChatHistory(prev => [...prev.slice(-98), { role: 'user', content: currentMessage }]);
    const result = await chatWithAgent(simulation.id, chatAgent, currentMessage);
    if (result) {
      setChatHistory(prev => [...prev.slice(-99), { role: 'agent', content: result.response }]);
    }
    setChatLoading(false);
  };

  // ── Determine current view ──
  const isRunning = simulation && (simulation.status === 'queued' || simulation.status === 'running');
  const isCompleted = simulation?.status === 'completed';

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="h-80 w-full bg-black flex flex-col items-center justify-center overflow-hidden rounded-xl relative mb-6">
        <h1 className="md:text-5xl text-3xl lg:text-7xl font-bold text-center text-white relative z-20">
          Market Predictions
        </h1>
        <div className="w-160 h-40 relative">
          {/* Gradients */}
          <div className="absolute inset-x-20 top-0 bg-linear-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
          <div className="absolute inset-x-20 top-0 bg-linear-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
          <div className="absolute inset-x-60 top-0 bg-linear-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
          <div className="absolute inset-x-60 top-0 bg-linear-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

          {/* Core component */}
          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={1200}
            className="w-full h-full"
            particleColor="#FFFFFF"
          />

          {/* Radial Gradient to prevent sharp edges */}
          <div className="absolute inset-0 w-full h-full bg-black mask-[radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
        </div>

        {simulation && (
          <button
            onClick={reset}
            className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all backdrop-blur-md"
          >
            <RotateCcw size={12} /> New Simulation
          </button>
        )}
      </div>

      {/* ── MiroFish Availability Warning ── */}
      {error && (error.includes('503') || error.includes('Service Unavailable') || error.includes('circuit breaker')) && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-600">Market Simulator Unavailable</p>
            <p className="text-xs text-text-secondary mt-1">The prediction engine (MiroFish) is not currently enabled. Please ensure <code className="bg-bg-elevated px-1 rounded">MIROFISH_ENABLED=true</code> is set in your environment configuration.</p>
          </div>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && !(error.includes('503') || error.includes('Service Unavailable') || error.includes('circuit breaker')) && (
        <div className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 rounded-xl">
          <AlertCircle size={16} className="text-error mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-error">Simulation Error</p>
            <p className="text-xs text-text-secondary mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         VIEW 1: TRIGGER PANEL (no active simulation)
         ══════════════════════════════════════════════════════════ */}
      {!simulation && (
        <div className="space-y-5">
          {/* Event Input */}
          <div className="bg-bg-surface border border-border rounded-xl p-4">
            <label className="block text-xs font-semibold text-text-primary mb-2">
              Market Event to Simulate
            </label>
            <textarea
              value={eventText}
              onChange={(e) => {
                setEventText(e.target.value);
                setInputError('');
              }}
              placeholder="Interest rate hike, new zoning policy, economic data release, corporate expansion, natural disaster impact..."
              className={`w-full h-20 px-3 py-2 text-sm bg-bg-primary border rounded-lg resize-none focus:outline-none focus:ring-2 transition-all placeholder:text-text-tertiary ${
                inputError ? 'border-error focus:ring-error/30 focus:border-error' : 'border-border focus:ring-accent/30 focus:border-accent'
              }`}
              maxLength={3000}
            />
            <div className="flex justify-between items-start mt-2">
              <div>
                <p className="text-[10px] text-text-tertiary">Real or hypothetical market scenario</p>
                {inputError && <p className="text-[10px] text-error mt-0.5">{inputError}</p>}
              </div>
              <span className="text-[10px] text-text-tertiary">{eventText.length}/3000</span>
            </div>
          </div>

          {/* Tier Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-2">
              Simulation Depth
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TIERS.map((tier) => {
                const Icon = tier.icon;
                const isSelected = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`relative p-1.5 md:p-2 rounded-2xl md:rounded-3xl border transition-all duration-200 text-left cursor-pointer group ${
                      isSelected
                        ? 'border-accent shadow-[0_0_12px_rgba(232,115,58,0.15)]'
                        : 'border-border bg-bg-surface hover:border-accent/30 hover:bg-bg-surface-hover'
                    }`}
                  >
                    <GlowingEffect
                      blur={0}
                      borderWidth={2}
                      spread={60}
                      glow={true}
                      disabled={false}
                      proximity={64}
                      inactiveZone={0.01}
                    />
                    <div className="relative h-full flex flex-col bg-bg-surface rounded-xl overflow-hidden p-3 md:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-accent/15' : 'bg-bg-elevated'
                        }`}>
                          <Icon size={16} className={isSelected ? 'text-accent' : 'text-text-secondary'} />
                        </div>
                        <span className="text-sm font-semibold text-text-primary">{tier.label}</span>
                      </div>
                      <div className="space-y-1 text-[10px] text-text-secondary">
                        <div className="flex items-center gap-1"><Users size={10} /> {tier.agents} agents</div>
                        <div className="flex items-center gap-1"><Clock size={10} /> {tier.minutes}</div>
                        <div className="flex items-center gap-1"><DollarSign size={10} /> {tier.cost}</div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cost Estimate + Launch */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-xs text-text-secondary space-y-0.5">
              {estimate && (
                <>
                  <div>Est. tokens: <span className="font-mono font-semibold text-text-primary">{estimate.token_breakdown.total.toLocaleString()}</span></div>
                  <div>Est. cost: <span className="font-mono font-semibold text-text-primary">${estimate.estimated_cost_usd.toFixed(2)}</span></div>
                  <div>Est. time: <span className="font-semibold text-text-primary">~{estimate.estimated_minutes} min</span></div>
                </>
              )}
            </div>
            <button
              onClick={handleStart}
              disabled={!eventText.trim() || loading}
              title={!eventText.trim() ? 'Describe a market event to simulate' : ''}
              className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-neutral-900 to-black text-white font-semibold text-sm rounded-xl border border-neutral-800 shadow-[0_2px_10px_rgba(0,0,0,0.5)] hover:shadow-[0_4px_24px_rgba(232,115,58,0.3)] hover:border-[#E8733A]/50 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Running...
                </>
              ) : (
                <>
                  <Play size={14} /> Run Simulation
                </>
              )}
            </button>
          </div>

          {/* Globe Demo Section — Enhanced Interactive Globe */}
          <GlobeDemo />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         VIEW 2: LIVE PROGRESS (simulation running)
         ══════════════════════════════════════════════════════════ */}
      {isRunning && simulation && (
        <div className="space-y-4">
          <div className="bg-bg-surface border border-border rounded-xl p-5">
            {/* Progress Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="text-accent animate-spin" />
                <span className="text-sm font-semibold text-text-primary">Simulation Running</span>
              </div>
              <span className="text-xs text-text-tertiary font-mono">
                {simulation.tier.replace('_', ' ')} • {simulation.agent_count} agents
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                <span>Round {simulation.current_round} / {simulation.max_rounds}</span>
                <span>{Math.round((simulation.current_round / simulation.max_rounds) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-[#FFB28B] to-[#E8733A] rounded-full transition-all duration-500"
                  style={{ width: `${(simulation.current_round / simulation.max_rounds) * 100}%` }}
                />
              </div>
            </div>

            {/* Live Sentiment */}
            <div>
              <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wide">Live Sentiment</span>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <div>
                    <div className="text-sm font-bold text-emerald-600">{simulation.sentiment.bullish}</div>
                    <div className="text-[9px] text-text-tertiary">Bullish</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Minus size={14} className="text-gray-400" />
                  <div>
                    <div className="text-sm font-bold text-gray-500">{simulation.sentiment.neutral}</div>
                    <div className="text-[9px] text-text-tertiary">Neutral</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={14} className="text-red-500" />
                  <div>
                    <div className="text-sm font-bold text-red-600">{simulation.sentiment.bearish}</div>
                    <div className="text-[9px] text-text-tertiary">Bearish</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event Context */}
            <div className="mt-4 pt-3 border-t border-border">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wide font-semibold">Event Context</span>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{eventText || 'Simulation in progress...'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         VIEW 3: REPORT (simulation completed)
         ══════════════════════════════════════════════════════════ */}
      {isCompleted && simulation && (
        <div className="space-y-4">
          {/* Status Banner */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-sm font-medium text-emerald-800">
              Simulation Complete — {simulation.agent_count} agents, {simulation.max_rounds} rounds
            </span>
          </div>

          {/* Final Sentiment */}
          <div className="bg-bg-surface border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-text-primary mb-3">Final Sentiment Distribution</h3>
            <div className="flex gap-4">
              {[
                { key: 'bullish', label: 'Bullish', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500' },
                { key: 'neutral', label: 'Neutral', icon: Minus, color: 'text-gray-400', bg: 'bg-gray-400' },
                { key: 'bearish', label: 'Bearish', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500' },
              ].map(({ key, label, icon: Icon, color, bg }) => {
                const count = simulation.sentiment[key as keyof typeof simulation.sentiment] || 0;
                const total = Object.values(simulation.sentiment).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={key} className="flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      <Icon size={12} className={color} />
                      <span className="text-[10px] text-text-secondary">{label}</span>
                    </div>
                    <div className="text-lg font-bold text-text-primary">{count} <span className="text-xs font-normal text-text-tertiary">({pct}%)</span></div>
                    <div className="w-full h-1.5 bg-bg-elevated rounded-full mt-1">
                      <div className={`h-full ${bg} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Report Sections */}
          {report && (
            <>
              {/* Executive Summary */}
              <div className="bg-bg-surface border border-border rounded-xl p-4">
                <h3 className="text-xs font-semibold text-text-primary mb-2">Executive Summary</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{report.executive_summary}</p>
              </div>

              {/* Scenarios */}
              {report.scenarios?.length > 0 && (
                <div className="bg-bg-surface border border-border rounded-xl p-4">
                  <button onClick={() => toggleSection('scenarios')} className="w-full flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-primary">Potential Scenarios</h3>
                    {expandedSections.scenarios ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedSections.scenarios && (
                    <div className="mt-3 space-y-3">
                      {report.scenarios.map((s, i) => (
                        <div key={i} className="p-3 bg-bg-elevated rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-text-primary">{s.name}</span>
                            <span className="text-xs font-mono text-accent">{Math.round(s.probability * 100)}%</span>
                          </div>
                          <p className="text-xs text-text-secondary">{s.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Key Dynamics */}
              {report.key_dynamics?.length > 0 && (
                <div className="bg-bg-surface border border-border rounded-xl p-4">
                  <button onClick={() => toggleSection('dynamics')} className="w-full flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-primary">Key Dynamics</h3>
                    {expandedSections.dynamics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedSections.dynamics && (
                    <ul className="mt-3 space-y-1.5">
                      {report.key_dynamics.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Actionable Insights */}
              {report.actionable_insights && Object.keys(report.actionable_insights).length > 0 && (
                <div className="bg-bg-surface border border-border rounded-xl p-4">
                  <button onClick={() => toggleSection('actions')} className="w-full flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-primary">Actionable Insights</h3>
                    {expandedSections.actions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedSections.actions && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {Object.entries(report.actionable_insights).map(([group, items]) => (
                        <div key={group} className="p-3 bg-bg-elevated rounded-lg">
                          <h4 className="text-[10px] font-semibold text-text-primary uppercase tracking-wide mb-2">{group}</h4>
                          <ul className="space-y-1">
                            {Array.isArray(items) && items.map((item, i) => (
                              <li key={i} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                                <span className="text-accent mt-0.5">→</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Persona Group Analysis */}
              {report.persona_group_analysis && Object.keys(report.persona_group_analysis).length > 0 && (
                <div className="bg-bg-surface border border-border rounded-xl p-4">
                  <button onClick={() => toggleSection('personas')} className="w-full flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-primary">Persona Group Analysis</h3>
                    {expandedSections.personas ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {expandedSections.personas && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(report.persona_group_analysis).map(([group, analysis]) => (
                        <div key={group} className="p-3 bg-bg-elevated rounded-lg border-l-2 border-accent">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[11px] font-semibold text-text-primary uppercase tracking-wide">{group}</h4>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                              analysis.sentiment === 'bullish' ? 'bg-emerald-500/10 text-emerald-500' :
                              analysis.sentiment === 'bearish' ? 'bg-red-500/10 text-red-500' :
                              'bg-gray-500/10 text-gray-500'
                            }`}>
                              {analysis.sentiment}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary">{analysis.narrative}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Risk Factors */}
              {report.risk_factors?.length > 0 && (
                <div className="bg-error/5 border border-error/20 rounded-xl p-4">
                  <button onClick={() => toggleSection('risks')} className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-error" />
                      <h3 className="text-xs font-semibold text-error">Risk Factors</h3>
                    </div>
                    {expandedSections.risks ? <ChevronUp size={14} className="text-error" /> : <ChevronDown size={14} className="text-error" />}
                  </button>
                  {expandedSections.risks && (
                    <ul className="mt-3 space-y-1.5">
                      {report.risk_factors.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-error/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-error mt-1.5 shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}

          {/* Agent Chat */}
          <div className="bg-bg-surface border border-border rounded-xl p-4">
            <h3 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-1.5">
              <MessageCircle size={12} className="text-accent" />
              Chat with Lead Analyst
            </h3>
            {chatHistory.length > 0 && (
              <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`text-xs p-2 rounded-lg ${msg.role === 'user' ? 'bg-accent/10 text-text-primary ml-8' : 'bg-bg-elevated text-text-secondary mr-8'}`}>
                    {msg.content}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask the Lead Analyst about the simulation reasoning..."
                className="flex-1 px-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <button
                onClick={handleChat}
                disabled={chatLoading || !chatMessage.trim() || !chatAgent}
                className="px-3 py-1.5 bg-accent text-white rounded-lg disabled:opacity-40 transition-opacity"
              >
                {chatLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── "Already Running" Confirmation Dialog ── */}
      {showRunningDialog && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-bg-elevated border border-border rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-text-primary">Simulation Already Running</h3>
            </div>
            <p className="text-xs text-text-secondary mb-1">
              A simulation is currently {activeJob?.status === 'queued' ? 'queued' : 'in progress'} ({activeJob?.progress_pct ?? 0}% complete).
            </p>
            <p className="text-xs text-text-secondary mb-5">
              Starting a new simulation will cancel the current one. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRunningDialog(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary bg-bg-surface border border-border rounded-lg hover:bg-bg-surface-hover transition-colors"
              >
                Keep Current
              </button>
              <button
                onClick={handleConfirmReplace}
                className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                Replace Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
