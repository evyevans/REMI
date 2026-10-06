import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarket } from '../stores/marketStore';
import MarketSelector from './layout/MarketSelector';
import { Bot, CheckCircle2, ChevronRight, Briefcase, Database, Zap } from 'lucide-react';
import { GlowingEffect } from './ui/glowing-effect';

const SplashScreen = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const navigate = useNavigate();
  const { isMarketSelected } = useMarket();

  // Step 1: Connect (Auto-advance after 1.5s to simulate credential binding)
  useEffect(() => {
    if (step === 1) {
      const t = setTimeout(() => setStep(2), 1500);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Step 3: Deploy (Auto-advance to dashboard after 2s)
  useEffect(() => {
    if (step === 3) {
      const t = setTimeout(() => navigate('/'), 2000);
      return () => clearTimeout(t);
    }
  }, [step, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#0F52BA]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full z-10">
        <div className="text-center mb-10 flex flex-col items-center">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">Deploy Your AI Workforce</h1>
          <p className="text-text-secondary text-sm">Centralized, Multi-Tenant Agent Orchestration</p>
        </div>

        <div className="space-y-4">
          {/* STEP 1: CONNECT */}
          <div className={`p-5 rounded-2xl border transition-all duration-500 bg-bg-surface ${step >= 1 ? 'border-border opacity-100' : 'border-transparent opacity-50'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step > 1 ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent animate-pulse'}`}>
                {step > 1 ? <CheckCircle2 size={20} /> : <Database size={20} />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">1. Secure Connection</h3>
                <p className="text-xs text-text-tertiary">Provisioning dedicated tenant database & encrypting credentials</p>
              </div>
            </div>
          </div>

          {/* STEP 2: CONFIGURE */}
          <div className={`p-5 rounded-2xl border transition-all duration-500 bg-bg-surface ${step >= 2 ? 'border-border opacity-100' : 'border-transparent opacity-50'}`}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-secondary">
                <Briefcase size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">2. Target Market & Fleet Config</h3>
                <p className="text-xs text-text-tertiary">Select your primary operational market.</p>
              </div>
            </div>

            {step === 2 && (
              <div className="pl-14 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="bg-bg-elevated border border-border rounded-xl p-4">
                  <MarketSelector />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-bg-elevated border border-border rounded-xl p-3 flex items-start gap-3 relative overflow-hidden">
                    <Bot size={16} className="text-accent mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-text-primary">Market Scout</h4>
                      <p className="text-[10px] text-text-secondary">Autonomous extraction</p>
                    </div>
                  </div>
                  <div className="bg-bg-elevated border border-border rounded-xl p-3 flex items-start gap-3 relative overflow-hidden">
                    <Zap size={16} className="text-accent mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-text-primary">Deal Scout</h4>
                      <p className="text-[10px] text-text-secondary">Predictive opportunity engine</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => isMarketSelected ? setStep(3) : undefined}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${isMarketSelected ? 'bg-accent text-white hover:bg-accent/90 shadow-lg' : 'bg-bg-elevated text-text-tertiary cursor-not-allowed'}`}
                  >
                    Deploy Fleet <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
            
            {step > 2 && (
              <div className="pl-14">
                <div className="text-xs text-success flex items-center gap-1"><CheckCircle2 size={12}/> Market securely locked.</div>
              </div>
            )}
          </div>

          {/* STEP 3: DEPLOY */}
          <div className={`p-px rounded-2xl transition-all duration-500 relative ${step === 3 ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
            {step === 3 && <GlowingEffect blur={0} borderWidth={1.5} spread={40} glow={true} disabled={false} proximity={64} inactiveZone={0.01} />}
            <div className="relative bg-bg-surface p-5 rounded-xl flex items-center justify-between">
               <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step === 3 ? 'bg-accent/10 text-accent animate-pulse' : 'bg-bg-elevated border border-border text-text-secondary'}`}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">3. Initializing First Contact</h3>
                  <p className="text-xs text-text-tertiary">Agents are currently scanning your market and populating memory vectors...</p>
                </div>
               </div>
               {step === 3 && <div className="text-xs font-mono text-accent animate-pulse">BOOTING...</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
