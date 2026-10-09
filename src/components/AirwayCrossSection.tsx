import { useId } from 'react';
import { Layers3 } from 'lucide-react';
import { airwayProfile, layerInfo, regions } from '../anatomy/airway';
import type { AirwayProfile, Region } from '../anatomy/airway';
import type { Parameters } from '../model';
import { scenarios } from '../model';

function contour(radius: (theta: number) => number) {
  return Array.from({ length: 160 }, (_, i) => {
    const theta = i / 160 * Math.PI * 2;
    return `${i ? 'L' : 'M'}${(120 + Math.cos(theta) * radius(theta) * 66).toFixed(2)},${(120 + Math.sin(theta) * radius(theta) * 66).toFixed(2)}`;
  }).join(' ') + 'Z';
}
function Section({ profile, current = false }: { profile: AirwayProfile; current?: boolean }) {
  const id = useId().replaceAll(':', '');
  const ring = (r: number) => contour(() => r);
  return <svg viewBox="0 0 240 240" className="layered-section" role="img" aria-label={`${current ? 'Current' : 'Healthy'} bronchial section, open area ${Math.round(profile.area * 100)} percent`}>
    <defs>
      <radialGradient id={`${id}-tissue`}><stop stopColor="#f0b89e"/><stop offset=".65" stopColor="#c96e72"/><stop offset="1" stopColor="#724d67"/></radialGradient>
      <radialGradient id={`${id}-mucus`} cx="35%" cy="28%"><stop stopColor="#f6db86"/><stop offset=".6" stopColor="#b99443"/><stop offset="1" stopColor="#806326"/></radialGradient>
      <radialGradient id={`${id}-lumen`}><stop stopColor="#06111a"/><stop offset="1" stopColor="#18272b"/></radialGradient>
      <filter id={`${id}-shadow`}><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".5"/></filter>
    </defs>
    <circle cx="120" cy="120" r="105" fill="none" stroke="#2b4353" strokeDasharray="2 5"/>
    <path d={ring(profile.outer)} fill={`url(#${id}-tissue)`} stroke="#bd94aa" strokeWidth="1" filter={`url(#${id}-shadow)`}/>
    <path d={ring(profile.muscle)} fill="#a84f5d" stroke="#ce7e86" strokeWidth="2"/>
    {Array.from({ length: 46 }, (_, i) => {
      const a = i / 46 * Math.PI * 2, r = (profile.muscle + profile.mucosa) / 2 * 66;
      return <ellipse key={i} cx={120 + Math.cos(a) * r} cy={120 + Math.sin(a) * r} rx="1.5" ry="4.2" transform={`rotate(${a * 180 / Math.PI} ${120 + Math.cos(a) * r} ${120 + Math.sin(a) * r})`} fill="#dc8b92" opacity=".55"/>;
    })}
    <path d={ring(profile.mucosa)} fill="#df8b87" stroke="#edaaa0" strokeWidth="1"/>
    {Array.from({ length: 24 }, (_, i) => {
      const a = i / 24 * Math.PI * 2, r = (profile.mucosa + profile.lining) / 2 * 66;
      return <circle key={i} cx={120 + Math.cos(a) * r} cy={120 + Math.sin(a) * r} r="1.4" fill="#b25968" opacity=".55"/>;
    })}
    <path d={contour(t => profile.epithelialRadius(t) + .032)} fill="#f4c5ae"/>
    <path d={contour(profile.epithelialRadius)} fill={`url(#${id}-mucus)`}/>
    <path data-testid={current ? 'current-lumen-path' : undefined} d={contour(profile.lumenRadius)} fill={`url(#${id}-lumen)`} stroke="#e2c278" strokeWidth={profile.film > .02 ? 1.4 : .4}/>
    {Array.from({ length: 32 }, (_, i) => {
      const a = i / 32 * Math.PI * 2, r = profile.epithelialRadius(a) * 66;
      return <path key={i} d={`M${120 + Math.cos(a) * r} ${120 + Math.sin(a) * r} l${-Math.cos(a) * 2} ${-Math.sin(a) * 2}`} stroke="#f6dab9" strokeWidth=".65" opacity=".7"/>;
    })}
    <path d={`M${120 - profile.metrics.radius * 48} 120 H${120 + profile.metrics.radius * 48}`} stroke="#8fb6ba" strokeDasharray="2 3" opacity=".65"/>
    <text x="120" y="114" textAnchor="middle" fill="#cfe8eb" fontSize="9" letterSpacing="1">LUMEN</text>
  </svg>;
}
export function AirwayCrossSection({ parameters, region }: { parameters: Parameters; region: Region }) {
  const baseline = airwayProfile(scenarios.Healthy, region);
  const current = airwayProfile(parameters, region);
  const area = Math.round(current.area / baseline.area * 100);
  return <section className="panel airway-panel detailed-airway">
    <div className="section-title"><Layers3 size={15}/> TISSUE LAYERS & LUMEN <span className="tag">LIVE TRANSVERSE SECTION</span></div>
    <div className="airway-intro"><h3>See what restricts the breath.</h3><p>{regions[region].label} · synchronized with the 3D view</p></div>
    <div className="cross-sections">
      <div><Section profile={baseline}/><span>HEALTHY BASELINE</span><small>Relaxed muscle · thin mucus film</small></div>
      <div><Section profile={current} current/><span>CURRENT AIRWAY</span><small><b data-testid="section-open-area">{area}%</b> of baseline open area</small></div>
    </div>
    <div className="tissue-legend">{Object.entries(layerInfo).map(([key, layer]) => <span key={key}><i style={{ background: layer.color }}/>{layer.label}</span>)}</div>
    <div className="mechanism-grid">
      <div><span>Muscle contraction</span><strong>{Math.round(current.local.constriction)}<small>%</small></strong><p>Tightens the airway wall</p></div>
      <div><span>Inflammation</span><strong>{Math.round(current.local.inflammation)}<small>%</small></strong><p>Thickens the submucosa</p></div>
      <div><span>Mucus burden</span><strong>{Math.round(parameters.mucus)}<small>%</small></strong><p>Occupies the open lumen</p></div>
    </div>
    <p className="section-note">Folded lining and uneven mucus are shown at an illustrative scale. Bronchioles have no cartilage; the trachea has supporting cartilage rings.</p>
  </section>;
}
