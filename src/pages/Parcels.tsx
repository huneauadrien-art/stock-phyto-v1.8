import { useMemo, useRef, useState } from 'react'
import { Check, LocateFixed, Map as MapIcon, MapPin, Pencil, Play, Save, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Polygon, Popup, TileLayer, useMap } from 'react-leaflet'
import L, { type LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Parcel } from '../types'

const fmt=(v:number)=>v.toLocaleString('fr-FR',{maximumFractionDigits:2})

const cultureColors:Record<string,string>={VRC:'#7c3aed',BTH:'#d97706',MIS:'#16a34a',JAC:'#64748b',PPH:'#0f766e',SNE:'#94a3b8'}
const colorFor=(p:Parcel)=>cultureColors[p.cultureCode]||'#2563eb'

function FitParcels({parcels}:{parcels:Parcel[]}){
  const map=useMap()
  const signature=parcels.map(p=>p.id).join('|')
  useMemo(()=>{
    const points=parcels.flatMap(p=>p.geometry.flatMap(r=>r.map(([lat,lng])=>L.latLng(lat,lng))))
    if(points.length)setTimeout(()=>map.fitBounds(L.latLngBounds(points),{padding:[18,18]}),0)
  },[map,signature])
  return null
}

function LocateButton(){
  const map=useMap();const[busy,setBusy]=useState(false)
  function locate(){
    if(!navigator.geolocation){alert("La localisation n'est pas disponible sur cet appareil.");return}
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      pos=>{map.flyTo([pos.coords.latitude,pos.coords.longitude],16);setBusy(false)},
      ()=>{alert("Impossible d'obtenir ta position. Vérifie l'autorisation de localisation.");setBusy(false)},
      {enableHighAccuracy:true,timeout:12000}
    )
  }
  return <button className="map-locate" onClick={locate} title="Me localiser"><LocateFixed size={20}/>{busy?' Localisation…':' Me localiser'}</button>
}

export default function Parcels({parcels,onChange}:{parcels:Parcel[];onChange:(v:Parcel[])=>void|Promise<void>}){
  const navigate=useNavigate()
  const[query,setQuery]=useState('');const[editing,setEditing]=useState<string|null>(null);const[name,setName]=useState('')
  const[activeId,setActiveId]=useState<string|null>(null);const[selectedIds,setSelectedIds]=useState<string[]>([]);const[view,setView]=useState<'map'|'list'>('map')
  const mapRef=useRef<L.Map|null>(null)

  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return parcels.filter(p=>!q||`${p.usualName} ${p.islandNumber} ${p.parcelNumber} ${p.culture}`.toLowerCase().includes(q)).sort((a,b)=>a.islandNumber-b.islandNumber||a.parcelNumber-b.parcelNumber)},[parcels,query])
  const selectedParcels=useMemo(()=>parcels.filter(p=>selectedIds.includes(p.id)),[parcels,selectedIds])
  const selectedArea=selectedParcels.reduce((sum,p)=>sum+p.area,0)
  const active=parcels.find(p=>p.id===activeId)||null
  const allPoints=parcels.flatMap(p=>p.geometry.flatMap(r=>r))
  const center:[number,number]=allPoints.length?[allPoints.reduce((s,p)=>s+p[0],0)/allPoints.length,allPoints.reduce((s,p)=>s+p[1],0)/allPoints.length]:[45.45,-0.04]

  async function save(p:Parcel){const next=parcels.map(x=>x.id===p.id?{...x,usualName:name.trim(),updatedAt:new Date().toISOString()}:x);await onChange(next);setEditing(null)}
  function startEdit(p:Parcel){setEditing(p.id);setName(p.usualName)}
  function toggle(p:Parcel){setActiveId(p.id);setSelectedIds(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):[...ids,p.id])}
  function focusParcel(p:Parcel){setActiveId(p.id);setView('map');const points=p.geometry.flatMap(r=>r.map(([lat,lng])=>L.latLng(lat,lng)));if(points.length)setTimeout(()=>mapRef.current?.fitBounds(L.latLngBounds(points),{padding:[55,55],maxZoom:17}),50)}
  function prepareTreatment(){
    const names=selectedParcels.map(p=>p.usualName||`Îlot ${p.islandNumber} - Parcelle ${p.parcelNumber}`)
    const cultures=[...new Set(selectedParcels.map(p=>p.culture))]
    navigate('/preparation',{state:{selectedParcels:selectedParcels.map(p=>({id:p.id,name:p.usualName||`Îlot ${p.islandNumber} - Parcelle ${p.parcelNumber}`,area:p.area,culture:p.culture})),area:selectedArea,name:names.join(', '),culture:cultures.length===1?cultures[0]:'Vigne'}})
  }

  return <section className={selectedIds.length?'parcels-has-selection':''}>
    <div className="page-head"><header><p className="eyebrow">PAC 2026</p><h1>Parcellaire</h1><p className="page-intro">Touche les parcelles à traiter. Elles passent en vert et leur surface s'additionne automatiquement.</p></header></div>
    <div className="parcel-toolbar"><div className="parcel-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un nom, un îlot, une culture…"/></div><div className="parcel-view-switch"><button className={view==='map'?'active':''} onClick={()=>setView('map')}><MapIcon size={18}/> Carte</button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><Search size={18}/> Liste</button></div></div>

    {view==='map'&&<div className="parcel-map-shell"><MapContainer center={center} zoom={13} className="parcel-map" ref={mapRef} zoomControl><TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><FitParcels parcels={filtered.length?filtered:parcels}/><LocateButton/>{filtered.map(p=>p.geometry.map((ring,index)=>{const isSelected=selectedIds.includes(p.id);return <Polygon key={`${p.id}-${index}`} positions={ring as LatLngBoundsExpression as any} pathOptions={{color:isSelected?'#14532d':activeId===p.id?'#111827':colorFor(p),weight:isSelected?4:activeId===p.id?3:2,fillColor:isSelected?'#22c55e':colorFor(p),fillOpacity:isSelected?.62:.32}} eventHandlers={{click:()=>toggle(p)}}><Popup><div className="parcel-popup"><strong>{p.usualName||`Îlot ${p.islandNumber} · Parcelle ${p.parcelNumber}`}</strong><span>{p.culture} · {fmt(p.area)} ha</span><button className={isSelected?'popup-selected':''} onClick={()=>toggle(p)}>{isSelected?<><X size={15}/> Retirer</>:<><Check size={15}/> Sélectionner</>}</button><button onClick={()=>startEdit(p)}><Pencil size={15}/> {p.usualName?'Modifier le nom':'Ajouter le nom habituel'}</button></div></Popup></Polygon>}))}</MapContainer><div className="map-legend"><span><i className="legend-selected"/>Sélectionnée</span><span><i className="legend-vigne"/>Vigne</span><span><i className="legend-cereal"/>Céréales</span></div>{active&&<aside className="map-parcel-card"><button className="map-card-close" onClick={()=>setActiveId(null)} aria-label="Fermer"><X size={18}/></button><p className="eyebrow">Îlot {active.islandNumber} · Parcelle {active.parcelNumber}</p><h3>{active.usualName||'Nom habituel à renseigner'}</h3><p>{active.culture} · <strong>{fmt(active.area)} ha</strong></p><button className={selectedIds.includes(active.id)?'parcel-toggle selected':'parcel-toggle'} onClick={()=>toggle(active)}>{selectedIds.includes(active.id)?<><X size={17}/> Retirer de la sélection</>:<><Check size={17}/> Ajouter au traitement</>}</button>{editing===active.id?<div className="parcel-name-edit"><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Les Chaumes"/><button className="primary" onClick={()=>save(active)}><Save size={17}/> Enregistrer</button></div>:<button className="complete-btn" onClick={()=>startEdit(active)}><Pencil size={17}/> {active.usualName?'Modifier le nom':'Ajouter le nom habituel'}</button>}</aside>}</div>}

    {view==='list'&&<div className="parcel-grid">{filtered.map(p=>{const isSelected=selectedIds.includes(p.id);return <article className={`panel parcel-card ${isSelected?'selected':''}`} key={p.id}><button className="parcel-card-select" onClick={()=>toggle(p)} aria-label="Sélectionner la parcelle"><span className="parcel-check">{isSelected&&<Check size={18}/>}</span><div><p className="eyebrow">Îlot {p.islandNumber} · Parcelle {p.parcelNumber}</p><h3>{p.usualName||'Nom habituel à renseigner'}</h3><small>{p.culture} · {fmt(p.area)} ha</small></div><MapPin size={22}/></button><button className="complete-btn" onClick={()=>focusParcel(p)}><MapIcon size={17}/> Voir sur la carte</button>{editing===p.id?<div className="parcel-name-edit"><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Ex. Les Chaumes"/><button className="primary" onClick={()=>save(p)}><Save size={17}/> Enregistrer</button></div>:<button className="complete-btn" onClick={()=>startEdit(p)}><Pencil size={17}/> {p.usualName?'Modifier le nom':'Ajouter le nom habituel'}</button>}</article>})}</div>}

    {selectedIds.length>0&&<div className="parcel-selection-bar"><div><span>{selectedIds.length} parcelle{selectedIds.length>1?'s':''} sélectionnée{selectedIds.length>1?'s':''}</span><strong>{fmt(selectedArea)} ha</strong></div><button className="clear-selection" onClick={()=>setSelectedIds([])}>Tout retirer</button><button className="primary" onClick={prepareTreatment}><Play size={19}/> Préparer le traitement</button></div>}
  </section>
}
