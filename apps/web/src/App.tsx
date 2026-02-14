import { useEffect, useMemo, useState } from 'react';
import { getNextOpenSlot, parseYieldPaste } from '@pi-tracker/shared';

type Character = { id: string; name: string; slotsTotal: number; active: boolean };
type Assignment = {
  id: string; characterId: string; slot: number; region: string; constellation: string; system: string; planet: string; planetType: string; resource: string; active: boolean; notes?: string;
};
type Scan = { id: string; region: string; constellation: string; system: string; planet: string; planetType: string; resource: string; value: number };
type YieldEntry = { id: string; date: string; product: string; amount: number; notes?: string };

type CollapsibleKey = 'marketSettings' | 'explorerFilters' | 'assignmentForm' | 'heatmapFilters';
const tabs = ['Assignments', 'Explorer', 'Heatmap', 'Yields', 'Market'] as const;

const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error((await res.json()).error?.message ?? 'Request failed');
  return res.json();
};

export function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Assignments');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [yields, setYields] = useState<YieldEntry[]>([]);
  const [marketSettings, setMarketSettings] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [collapsed, setCollapsed] = useState<Record<CollapsibleKey, boolean>>(() => JSON.parse(localStorage.getItem('ui-collapsed') ?? '{"marketSettings":false}'));
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [marketRows, setMarketRows] = useState<any[]>([]);

  const load = async () => {
    const [c, a, s, y, m] = await Promise.all([
      api<Character[]>('/api/characters'),
      api<Assignment[]>('/api/assignments'),
      api<Scan[]>('/api/scans'),
      api<YieldEntry[]>('/api/yields'),
      api<any>('/api/market-settings'),
    ]);
    setCharacters(c); setAssignments(a); setScans(s); setYields(y); setMarketSettings(m);
    if (!selectedCharacterId && c[0]) setSelectedCharacterId(c[0].id);
  };
  useEffect(() => { load().catch((e) => setStatus(e.message)); }, []);
  useEffect(() => { localStorage.setItem('ui-collapsed', JSON.stringify(collapsed)); }, [collapsed]);

  const usedByCharacter = assignments.filter((a) => a.characterId === selectedCharacterId && a.active);
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId);

  const [newCharName, setNewCharName] = useState('');
  const [newCharSlots, setNewCharSlots] = useState(6);
  const [form, setForm] = useState<any>({ region: '', constellation: '', system: '', planet: '', planetType: '', resource: '' });

  const addCharacter = async () => { await api('/api/characters', { method: 'POST', body: JSON.stringify({ name: newCharName, slotsTotal: newCharSlots, active: true }) }); setNewCharName(''); await load(); };
  const addAssignment = async () => {
    const slot = selectedCharacter ? getNextOpenSlot(selectedCharacter.slotsTotal, usedByCharacter) : null;
    if (!selectedCharacter || !slot) return setStatus('No open slots available.');
    await api('/api/assignments', { method: 'POST', body: JSON.stringify({ ...form, characterId: selectedCharacter.id, slot, active: true }) });
    setForm({ region: '', constellation: '', system: '', planet: '', planetType: '', resource: '' }); await load();
  };

  const [yieldText, setYieldText] = useState('');
  const addYieldBulk = async () => {
    const out = parseYieldPaste(yieldText);
    if (out.errors.length) return setStatus(out.errors.join('; '));
    await Promise.all(out.parsed.map((row) => api('/api/yields', { method: 'POST', body: JSON.stringify(row) })));
    setYieldText(''); await load();
  };

  const refreshMarket = async () => {
    const products = Array.from(new Set(yields.map((y) => y.product))).slice(0, marketSettings.productLimit);
    const res = await api<any[]>('/api/market/refresh', { method: 'POST', body: JSON.stringify({ products }) });
    setMarketRows(res);
  };

  const explorerRows = useMemo(() => scans.filter((s) => !form.resource || s.resource === form.resource), [scans, form.resource]);

  return <div className="min-h-screen bg-slate-950 p-4 text-slate-200">
    <h1 className="text-2xl font-bold mb-4">PI Tracker</h1>
    <div className="flex gap-2 mb-4">{tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={tab===t ? 'bg-indigo-600 rounded px-3 py-1':'bg-slate-700 rounded px-3 py-1'}>{t}</button>)}</div>
    {status && <div className="mb-2 text-amber-400">{status}</div>}

    {tab === 'Assignments' && <div className="space-y-3">
      <div className="panel"><h2 className="font-semibold mb-2">Characters</h2>
        <div className="flex gap-2 items-center mb-2"><input placeholder="Name" value={newCharName} onChange={(e)=>setNewCharName(e.target.value)} />
        <input type="number" value={newCharSlots} onChange={(e)=>setNewCharSlots(Number(e.target.value))} /><button onClick={addCharacter}>Add Character</button></div>
        <select value={selectedCharacterId} onChange={(e)=>setSelectedCharacterId(e.target.value)}><option value="">Select character</option>{characters.map((c)=><option key={c.id} value={c.id}>{c.name} ({assignments.filter(a=>a.characterId===c.id&&a.active).length}/{c.slotsTotal})</option>)}</select>
      </div>
      <div className="panel"><button onClick={()=>setCollapsed({...collapsed, assignmentForm: !collapsed.assignmentForm})}>Add Assignment</button>
      {!collapsed.assignmentForm && <div className="grid grid-cols-2 gap-2 mt-2">{['region','constellation','system','planet','planetType','resource'].map((k)=><input key={k} placeholder={k} value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})} />)}<button onClick={addAssignment}>Save</button></div>}</div>
      <div className="panel overflow-auto"><table className="w-full text-sm"><thead><tr><th>Character</th><th>Slot</th><th>Region</th><th>System</th><th>Planet</th><th>Planet Type</th><th>Resource</th><th>Active</th><th></th></tr></thead>
      <tbody>{assignments.filter(a=>!selectedCharacterId || a.characterId===selectedCharacterId).map((a)=><tr key={a.id}><td>{characters.find(c=>c.id===a.characterId)?.name}</td><td>{a.slot}</td><td>{a.region}</td><td>{a.system}</td><td>{a.planet}</td><td>{a.planetType}</td><td>{a.resource}</td><td><input type="checkbox" checked={a.active} onChange={async()=>{await api(`/api/assignments/${a.id}`,{method:'PUT',body:JSON.stringify({active:!a.active})});load();}}/></td><td><button onClick={async()=>{await api(`/api/assignments/${a.id}`,{method:'DELETE'});load();}}>Delete</button></td></tr>)}</tbody></table></div>
    </div>}

    {tab === 'Explorer' && <div className="space-y-3"><div className="panel"><button onClick={()=>setCollapsed({...collapsed, explorerFilters: !collapsed.explorerFilters})}>Explorer Filters</button>
    {!collapsed.explorerFilters && <div className="mt-2 flex gap-2"><input placeholder="resource" value={form.resource} onChange={(e)=>setForm({...form, resource:e.target.value})} /><input placeholder="region" value={form.region} onChange={(e)=>setForm({...form, region:e.target.value})} /></div>}</div>
    <div className="panel"><table className="w-full text-sm"><thead><tr><th>System</th><th>Planet</th><th>Planet Type</th><th>Resource</th><th>Score</th><th></th></tr></thead><tbody>{explorerRows.slice(0,100).map((s)=><tr key={s.id} className={usedByCharacter.some((u)=>u.system===s.system&&u.planet===s.planet)?'bg-amber-900/30':''}><td>{s.system}</td><td>{s.planet}</td><td>{s.planetType}</td><td>{s.resource}</td><td>{s.value}</td><td><button disabled={!selectedCharacter||!getNextOpenSlot(selectedCharacter.slotsTotal, usedByCharacter)} onClick={()=>{setForm({region:s.region,constellation:s.constellation,system:s.system,planet:s.planet,planetType:s.planetType,resource:s.resource});setTab('Assignments');}}>Pick</button></td></tr>)}</tbody></table></div></div>}

    {tab === 'Heatmap' && <div className="space-y-3"><div className="panel"><button onClick={()=>setCollapsed({...collapsed, heatmapFilters: !collapsed.heatmapFilters})}>Heatmap Filters</button></div>
      <div className="panel overflow-auto"><table className="w-full text-sm"><thead><tr><th>Region</th><th>Constellation</th><th>System</th><th>Planet</th><th>Resource</th><th>Score</th><th>In Use</th></tr></thead><tbody>{scans.map((s)=><tr key={s.id} style={{backgroundColor:`rgba(59,130,246,${Math.min(s.value/100,0.7)})`}}><td>{s.region}</td><td>{s.constellation}</td><td>{s.system}</td><td>{s.planet}</td><td>{s.resource}</td><td>{s.value}</td><td>{assignments.some((a)=>a.system===s.system&&a.planet===s.planet&&a.active)?'Yes':'No'}</td></tr>)}</tbody></table></div>
      <button onClick={()=>{const region=scans[0]?.region??'all'; const data=JSON.stringify(scans.filter(s=>s.region===region),null,2); const blob=new Blob([data],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`heatmap-${region}.json`; a.click();}}>Export current region heatmap JSON</button>
    </div>}

    {tab === 'Yields' && <div className="space-y-3"><div className="panel"><textarea className="w-full h-24" value={yieldText} onChange={(e)=>setYieldText(e.target.value)} placeholder="date, product, amount" /><button onClick={addYieldBulk}>Parse + Insert</button></div>
    <div className="panel"><table className="w-full text-sm"><thead><tr><th>Date</th><th>Product</th><th>Amount</th><th></th></tr></thead><tbody>{yields.map((y)=><tr key={y.id}><td>{y.date}</td><td>{y.product}</td><td>{y.amount}</td><td><button onClick={async()=>{await api(`/api/yields/${y.id}`,{method:'DELETE'});load();}}>Delete</button></td></tr>)}</tbody></table></div></div>}

    {tab === 'Market' && marketSettings && <div className="space-y-3"><div className="panel"><button onClick={()=>setCollapsed({...collapsed, marketSettings: !collapsed.marketSettings})}>Settings</button>
      {!collapsed.marketSettings && <div className="grid grid-cols-2 gap-2 mt-2"><select value={marketSettings.source} onChange={(e)=>setMarketSettings({...marketSettings,source:e.target.value})}><option value='esi'>ESI</option><option value='janice'>Janice</option></select>
      <input value={marketSettings.hubAName} onChange={(e)=>setMarketSettings({...marketSettings,hubAName:e.target.value})} /><input value={marketSettings.hubBName} onChange={(e)=>setMarketSettings({...marketSettings,hubBName:e.target.value})} />
      <input type='number' value={marketSettings.productLimit} onChange={(e)=>setMarketSettings({...marketSettings,productLimit:Number(e.target.value)})}/>
      <input type='number' value={marketSettings.maxPages} onChange={(e)=>setMarketSettings({...marketSettings,maxPages:Number(e.target.value)})}/>
      <label><input type='checkbox' checked={marketSettings.rememberKey} onChange={(e)=>setMarketSettings({...marketSettings,rememberKey:e.target.checked})}/>Remember Key</label>
      <input value={marketSettings.janiceApiKey??''} onChange={(e)=>setMarketSettings({...marketSettings,janiceApiKey:e.target.value})}/>
      <button onClick={async()=>{await api('/api/market-settings',{method:'PUT',body:JSON.stringify(marketSettings)});setStatus('Saved settings');}}>Save</button></div>}</div>
      <button onClick={refreshMarket}>Manual Refresh</button>
      <div className='panel overflow-auto'><table className='w-full text-sm'><thead><tr><th>Product</th><th>A Buy</th><th>A Sell</th><th>B Buy</th><th>B Sell</th><th>Decision</th><th>Status</th></tr></thead><tbody>{marketRows.map((r)=><tr key={r.product}><td>{r.product}</td><td>{r.hubAHighestBuy}</td><td>{r.hubALowestSell}</td><td>{r.hubBHighestBuy}</td><td>{r.hubBLowestSell}</td><td>{r.decision}</td><td>{r.status}</td></tr>)}</tbody></table></div>
    </div>}
  </div>;
}
