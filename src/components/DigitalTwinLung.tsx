import { useEffect, useRef, useState } from 'react';
import { Box, Focus, Layers3, Maximize2, Move3D, RotateCcw, ScanLine, Wind } from 'lucide-react';
import type { Metrics, Parameters } from '../model';
import { airwayProfile, allLayers, layerInfo, regions } from '../anatomy/airway';
import type { Layer, Region } from '../anatomy/airway';
import type { AnatomyOptions, AnatomyState, AnatomyView } from '../anatomy/renderer';

export function DigitalTwinLung({ metrics, parameters, phase, paused, region, onRegion }: {
  metrics: Metrics; parameters: Parameters; phase: number; paused: boolean;
  region: Region; onRegion: (region: Region) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<AnatomyView>('anatomy');
  const [layers, setLayers] = useState({ ...allLayers });
  const [tissue, setTissue] = useState(27);
  const [ribs, setRibs] = useState(true);
  const [airflow, setAirflow] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [reset, setReset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const options: AnatomyOptions = { view, region, layers, tissue, ribs, airflow, exploded, reset };
  const state = useRef<AnatomyState>({ metrics, parameters, phase, paused, options });
  const selectRegion = useRef(onRegion);
  state.current = { metrics, parameters, phase, paused, options };
  selectRegion.current = onRegion;
  const profile = airwayProfile(parameters, region);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const element = host.current!;
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); setReady(false); };
    element.addEventListener('webglcontextlost', contextLost, true);
    setReady(false); setFailed(false);
    import('../anatomy/renderer').then(({ createAnatomyRenderer }) => {
      if (cancelled) return;
      try {
        dispose = createAnatomyRenderer(element, () => state.current, value => selectRegion.current(value));
        setReady(true);
      } catch { setFailed(true); }
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; element.removeEventListener('webglcontextlost', contextLost, true); dispose?.(); };
  }, [retry]);

  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', escape); };
  }, [expanded]);

  const toggleLayer = (layer: Layer) => setLayers(value => ({ ...value, [layer]: !value[layer] }));
  return <div className={`anatomy-viewer ${expanded ? 'expanded' : ''}`} ref={viewer} data-phase={phase.toFixed(4)} data-view={view} data-ready={ready}>
    <div className="anatomy-toolbar">
      <div className="view-tabs" role="tablist" aria-label="Anatomy views">
        {([['anatomy', '3D anatomy', Box], ['cutaway', 'Wall cutaway', Layers3], ['endoscopy', 'Inside airway', ScanLine]] as const).map(([key, label, Icon]) =>
          <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)}><Icon size={14}/>{label}</button>)}
      </div>
      <button className="icon-button" aria-label={expanded ? 'Close expanded anatomy' : 'Expand anatomy'} onClick={() => setExpanded(value => !value)}><Maximize2 size={15}/></button>
    </div>
    <div className="anatomy-selector">
      <label><Focus size={13}/><span>Inspect</span><select aria-label="Inspect airway region" value={region} onChange={event => onRegion(event.target.value as Region)}>
        {Object.entries(regions).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
      </select></label>
      <button className="reset-camera" onClick={() => setReset(value => value + 1)}><RotateCcw size={12}/> Reset view</button>
    </div>
    <div className={`anatomy-stage ${view}`}>
      <div ref={host} className="anatomy-canvas"/>
      {!ready && !failed && <div className="anatomy-loading"><span className="loading-ring"/>Preparing the anatomical model…</div>}
      {failed && <div className="anatomy-loading error"><Box size={25}/><strong>3D rendering is unavailable</strong><p>Enable hardware acceleration in your browser. The live layer section below remains available.</p><button onClick={() => setRetry(value => value + 1)}>Retry 3D view</button></div>}
      <div className="anatomy-top-label"><span className="live-pip"/>{view === 'anatomy' ? 'VOLUMETRIC ANATOMY' : view === 'cutaway' ? 'BRONCHIAL WALL · CUTAWAY' : 'ENDOSCOPIC EXPLORATION'}<small>{view === 'anatomy' ? '1,205 branches · 9 illustrated generations' : regions[region].label}</small></div>
      {view === 'anatomy' ? <>
        <div className="anatomy-label right-lung">RIGHT LUNG<small>Upper · middle · lower lobes</small></div>
        <div className="anatomy-label left-lung">LEFT LUNG<small>Upper · lower lobes</small></div>
        <div className="anatomy-orientation"><span>R</span><i/><span>L</span></div>
      </> : <div className="lumen-readout"><span>OPEN LUMEN AREA</span><strong data-testid="lumen-area">{Math.round(profile.area * 100)}<small>%</small></strong><p>Relative to ideal open airway</p><div><i style={{ width: `${Math.min(100, profile.area * 100)}%`, background: metrics.color }}/></div></div>}
      <div className="anatomy-bottom-label"><span>{paused ? 'PAUSED' : Math.cos(phase) > 0 ? 'INHALATION' : 'EXHALATION'}</span><small>{metrics.rate.toFixed(0)} breaths / min</small><span className="camera-hint"><Move3D size={12}/>{view === 'endoscopy' ? 'View from inside the lumen' : 'Drag to rotate · scroll to zoom'}</span></div>
    </div>
    <div className="anatomy-controls">
      {view === 'anatomy' ? <>
        <label className="opacity-control">Lung opacity <input type="range" min="0" max="65" value={tissue} aria-label="Lung tissue opacity" onChange={e => setTissue(+e.target.value)}/><span>{tissue}%</span></label>
        <button className={ribs ? 'on' : ''} aria-pressed={ribs} onClick={() => setRibs(value => !value)}>Rib cage</button>
      </> : <button className={exploded ? 'on' : ''} disabled={view === 'endoscopy'} aria-pressed={exploded} onClick={() => setExploded(value => !value)}><Layers3 size={12}/> Separate layers</button>}
      <button className={airflow ? 'on' : ''} aria-pressed={airflow} onClick={() => setAirflow(value => !value)}><Wind size={12}/> Air particles</button>
    </div>
    {view !== 'anatomy' && <div className="layer-toggles" aria-label="Visible airway layers">{(Object.keys(layerInfo) as Layer[]).map(layer =>
      <button key={layer} aria-pressed={layers[layer]} title={layerInfo[layer].description} onClick={() => toggleLayer(layer)}><i style={{ background: layerInfo[layer].color }}/>{layerInfo[layer].label}</button>)}</div>}
    <div className="anatomy-disclaimer">{region === 'trachea' && view !== 'anatomy' ? 'Cartilage supports the trachea. Asthmatic constriction mainly affects bronchi and bronchioles.' : view === 'cutaway' && exploded ? 'Separated layers exaggerate spacing to reveal the wall structure.' : 'Illustrative anatomy · representative branching, not a patient scan or a complete microscopic airway tree.'}</div>
  </div>;
}
