import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, CircleHelp, Pause, Play, RotateCcw, Wind, Zap } from 'lucide-react';
import { baseline, interpolate, physiology, scenarios } from './model';
import type { Parameters, Sample } from './model';
import { ControlPanel } from './components/ControlPanel';
import { DigitalTwinLung } from './components/DigitalTwinLung';
import { AirwayCrossSection } from './components/AirwayCrossSection';
import { VitalMetrics } from './components/VitalMetrics';
import { LiveCharts } from './components/LiveCharts';
import { AIAnalysis } from './components/AIAnalysis';
import { AnomalyAlert } from './components/AnomalyAlert';
import { TwinComparison } from './components/TwinComparison';
type Transition = { from: Parameters; to: Parameters; elapsed: number; mode: 'attack' | 'recovery' };
export default function App() {
 const [parameters,setParameters]=useState<Parameters>({...scenarios.Healthy});
 const [selected,setSelected]=useState('Healthy');
 const [paused,setPaused]=useState(false);
 const [phase,setPhase]=useState(0);
 const [minutes,setMinutes]=useState(0);
 const [mode,setMode]=useState<'attack'|'recovery'|null>(null);
 const [showInfo,setShowInfo]=useState(false);
 const [samples,setSamples]=useState<Sample[]>([{time:0,airflow:baseline.airflow,spo2:baseline.spo2,resistance:baseline.resistance}]);
 const paramsRef=useRef(parameters); const pausedRef=useRef(paused); const transition=useRef<Transition|null>(null);
 const timeline=useRef<{from:Parameters;to:Parameters;mode:'attack'|'recovery'}|null>(null);
 const time=useRef(0); const breath=useRef(0);
 const metrics=physiology(parameters);
 paramsRef.current=parameters; pausedRef.current=paused;
 useEffect(()=>{let last=performance.now();let sampleElapsed=0;let frame:number;
 const tick=(now:number)=>{const dt=Math.min((now-last)/1000,.1);last=now;
 if(!pausedRef.current){time.current+=dt; const t=transition.current;
 if(t){t.elapsed=Math.min(8,t.elapsed+dt); const progress=t.elapsed/8; const eased=progress*progress*(3-2*progress); const p=interpolate(t.from,t.to,eased);paramsRef.current=p;setParameters(p);setMinutes(progress*20);if(progress>=1)transition.current=null;}
 const m=physiology(paramsRef.current); breath.current+=dt*m.rate/60*Math.PI*2;setPhase(breath.current);
 sampleElapsed+=dt;if(sampleElapsed>=.25){sampleElapsed=0;const sample={time:time.current,airflow:Math.max(0,m.airflow*(.91+.09*Math.sin(breath.current))),spo2:m.spo2,resistance:m.resistance};setSamples(prev=>[...prev.filter(s=>s.time>time.current-60),sample]);}}
 frame=requestAnimationFrame(tick);}; frame=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame);},[]);
 function scenario(name:string){transition.current=null;timeline.current=null;setMode(null);setMinutes(0);setSelected(name);setParameters({...scenarios[name]});setPaused(false);}
 function edit(key:keyof Parameters,value:number){transition.current=null;timeline.current=null;setMode(null);setMinutes(0);setSelected('Custom');setParameters(p=>({...p,[key]:value}));}
 function begin(next:'attack'|'recovery'){const to=next==='attack'?scenarios['Severe Attack']:scenarios.Healthy;const from={...paramsRef.current};transition.current={from,to,elapsed:0,mode:next};timeline.current={from,to,mode:next};setMode(next);setMinutes(0);setSelected(next==='attack'?'Severe Attack':'Healthy');setPaused(false);}
 function seek(value:number){if(!timeline.current)return;transition.current=null;setMinutes(value);const t=value/20;setParameters(interpolate(timeline.current.from,timeline.current.to,t*t*(3-2*t)));}
 const status=paused?'PAUSED':metrics.severity>=65?'ATTACK':mode==='recovery'&&minutes<20?'RECOVERING':'LIVE';
 return <div className="app-shell"><header className="topbar"><a className="brand" href="#"><div className="brand-symbol"><Activity size={23}/></div><div>ASTHMA<span>DIGITAL TWIN</span></div><small>RESPIRATORY INTELLIGENCE LAB</small></a><div className="header-right"><span className="prototype-tag">RESEARCH PROTOTYPE <span>v1.0</span></span><button className="icon-button" aria-label="About the simulation" onClick={()=>setShowInfo(v=>!v)}><CircleHelp size={19}/></button></div></header>
 <main><div className="page-heading"><div><div className="eyebrow">REAL-TIME RESPIRATORY SYSTEM SIMULATION</div><h1>Patient Respiratory <span>Digital Twin</span></h1><p>Explore the connection between airway structure and respiratory function.</p></div><div className="session-status"><span className="live-pip" style={{background:metrics.color}}/> Simulation status: <b style={{color:metrics.color}}>{status}</b><span className="session-id">SESSION DT-001</span></div></div>
 {showInfo&&<section className="panel info-panel"><strong>How this twin works</strong><p>A radius-based model links constriction, inflammation, mucus, activity and allergen exposure. Resistance follows a capped 1/r⁴ relationship. Airflow, oxygen saturation and lung function are illustrative normalized responses, not patient predictions. Respiratory rate is your base setting plus a small simulated compensatory response. Confidence is a demonstration score, not validated AI certainty.</p><p>Attack and recovery transitions take 8 real seconds, representing 20 illustrative minutes. Pause freezes data and breathing. The timeline scrubs the most recent transition.</p><button onClick={()=>setShowInfo(false)}>Close explanation</button></section>}
 <div className="dashboard"><ControlPanel parameters={parameters} selected={selected} onChange={edit} onScenario={scenario}/>
 <div className="twin-column"><section className="panel twin-panel"><div className="twin-heading"><div><span className="eyebrow">LIVE ANATOMICAL SIMULATION</span><h2>Respiratory digital twin</h2></div><div className="twin-tools"><button className="icon-button" aria-label={paused?'Resume simulation':'Pause simulation'} onClick={()=>setPaused(v=>!v)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button><button className="icon-button" aria-label="Reset simulation" onClick={()=>{scenario('Healthy');time.current=0;breath.current=0;setPhase(0);setSamples([{time:0,airflow:baseline.airflow,spo2:98,resistance:baseline.resistance}]);}}><RotateCcw size={16}/></button></div></div><DigitalTwinLung metrics={metrics} phase={phase} paused={paused}/><div className="twin-summary"><div><span>AIRFLOW SCORE</span><strong style={{color:metrics.color}}>{Math.round(metrics.airflow)}<small>/100</small></strong></div><div><span>ASTHMA SEVERITY</span><strong style={{color:metrics.color}}>{Math.round(metrics.severity)}<small>/100</small></strong></div><div><span>BREATHING EFFORT</span><strong>{metrics.work.toFixed(1)}<small>×</small></strong></div></div></section>
 <div className="interventions"><button className="attack-button" onClick={()=>begin('attack')}><Zap size={17}/> Trigger Asthma Attack <ArrowUpRight size={16}/></button><button className="recovery-button" onClick={()=>begin('recovery')}><Wind size={17}/> Administer Bronchodilator</button></div><p className="intervention-note">Simulated intervention only. No drug, dosage or treatment recommendation.</p>
 <section className="panel timeline-panel"><div className="section-title">SIMULATION TIMELINE <span style={{color:mode==='attack'?'#f6b563':'#49dba8'}}>{mode?mode==='attack'?'ATTACK PROGRESSION':'RECOVERY':'SELECT AN INTERVENTION'}</span></div><input type="range" aria-label="Simulation timeline" min="0" max="20" step="0.1" value={minutes} disabled={!mode} onChange={e=>seek(+e.target.value)}/><div className="timeline-labels">{[0,5,10,15,20].map(n=><span key={n}>{n} min</span>)}</div><p className="hint">{minutes.toFixed(1)} simulated min · 8 seconds = 20 illustrative minutes</p></section><div className="twin-bottom"><AirwayCrossSection metrics={metrics} mucus={parameters.mucus}/><TwinComparison metrics={metrics}/></div></div>
 <aside className="data-column"><div className="data-heading"><Activity size={16}/> PHYSIOLOGICAL METRICS <span className="live-pip"/></div><VitalMetrics metrics={metrics}/><LiveCharts samples={samples} metrics={metrics}/><AIAnalysis metrics={metrics} parameters={parameters}/><AnomalyAlert metrics={metrics}/></aside></div>
 <footer><span><span className="live-pip"/> FRONTEND SIMULATION ENGINE <b>·</b> No external API</span><span>Educational & demonstration use only. Not for clinical diagnosis or treatment.</span><span>DT / 001</span></footer></main></div>;
}
