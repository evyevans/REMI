import { useState, useMemo } from 'react';
import { useAgentActivity } from '../hooks/useAgentActivity';
import { Bot, CheckCircle2, AlertTriangle, Calendar, Filter, Loader2, ShieldCheck, Zap } from 'lucide-react';

export default function AgentMemory() {
  const { tasks, loading } = useAgentActivity();
  
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all'); // all, 24h, 7d, 30d

  // Extract unique agents for filter dropdown
  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    tasks.forEach(t => { if (t.agent_name) agents.add(t.agent_name); });
    return Array.from(agents);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (filterAgent !== 'all') {
      result = result.filter(t => t.agent_name === filterAgent);
    }
    
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus);
    }

    if (dateRange !== 'all') {
      const now = new Date().getTime();
      const ranges: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - ranges[dateRange];
      result = result.filter(t => new Date(t.queued_at).getTime() >= cutoff);
    }

    return result;
  }, [tasks, filterAgent, filterStatus, dateRange]);

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary text-text-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-bold tracking-widest uppercase text-accent">
                System Ledger
              </span>
              {loading && <Loader2 size={14} className="animate-spin text-text-tertiary" />}
            </div>
            <h1 className="text-4xl font-light tracking-tight text-text-primary flex items-center gap-3">
              <Bot size={32} className="text-accent" />
              Agent Memory
            </h1>
            <p className="text-text-secondary mt-2">
              Immutable ledger of all AI fleet operations, property enrichments, and data parsing tasks.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 bg-bg-surface border border-border/60 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-text-tertiary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Filters:</span>
          </div>

          <label className="flex items-center gap-2 text-sm text-text-primary">
            Agent:
            <select
              title="Filter by Agent Name"
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map(ag => (
                <option key={ag} value={ag}>{ag}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-text-primary">
            Status:
            <select
              title="Filter by Task Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-text-primary">
            <Calendar size={14} className="text-text-tertiary" />
            <select
              title="Filter by Date Range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
            >
              <option value="all">Total History</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </label>
        </div>

        {/* Tasks Table */}
        <div className="rounded-2xl border border-border/80 bg-bg-surface overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-bg-elevated/80 border-b border-border/80 text-[10px] uppercase tracking-widest text-text-tertiary">
                <tr>
                  <th className="px-6 py-4 font-semibold">TID / Status</th>
                  <th className="px-6 py-4 font-semibold">Agent Unit</th>
                  <th className="px-6 py-4 font-semibold">Action Performed</th>
                  <th className="px-6 py-4 font-semibold text-right">Tokens / Cost</th>
                  <th className="px-6 py-4 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <ShieldCheck size={32} className="text-text-tertiary opacity-40" />
                        <span className="text-sm text-text-secondary">No memory records match the selected filters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-accent/5 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          {task.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500" />}
                          {task.status === 'failed' && <AlertTriangle size={14} className="text-red-500" />}
                          {task.status === 'running' && <Loader2 size={14} className="text-accent animate-spin" />}
                          <span className="text-text-secondary">#{task.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-accent opacity-70" />
                          <span className="font-medium text-text-primary">{task.agent_name ?? 'System Process'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-text-secondary group-hover:text-text-primary transition-colors max-w-md truncate inline-block">
                          {task.action_summary || task.task_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        <div className="flex flex-col items-end">
                          <span className="text-text-primary text-xs font-medium">{(task.tokens_used ?? 0).toLocaleString()} tkns</span>
                          <span className="text-[10px] text-text-tertiary">${(task.cost_usd ?? 0).toFixed(4)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        <span className="text-xs text-text-secondary">
                          {new Date(task.queued_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
