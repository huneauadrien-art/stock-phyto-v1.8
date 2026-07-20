import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Droplets, MapPin, Pencil, Plus, Save, Sprout, Trash2 } from 'lucide-react'
import { cultures } from '../data'
import type { Parcel, Product, Treatment, TreatmentProduct, TreatmentTank } from '../types'

const num=(v:string|number)=>typeof v==='number'?v:(Number(String(v).replace(',','.'))||0)
const fmt=(v:number,d=2)=>v.toLocaleString('fr-FR',{maximumFractionDigits:d})
const today=()=>new Date().toISOString().slice(0,10)
const isoDate=(d:string)=>new Date(`${d}T12:00:00`).toISOString()
const waterFor=(waterPerHa:number,theoreticalArea:number)=>Number((waterPerHa*theoreticalArea).toFixed(3))
const actualArea=(tank:TreatmentTank)=>tank.parcels.reduce((sum,parcel)=>sum+parcel.area,0)
// Avec 600 L prévus pour 4 ha et 6 ha réellement traités : 1 - (4 / 6) = 33,3 % récupérés.
const recoveryPercent=(theoretical:number,actual:number)=>actual>theoretical&&actual>0?Math.max(0,(1-theoretical/actual)*100):0

type Props={
  products:Product[]
  parcels:Parcel[]
  treatments:Treatment[]
  onCreate:(t:Treatment)=>void|Promise<void>
  onUpdate:(t:Treatment)=>void|Promise<void>
  onAddTank:(treatmentId:string,tank:TreatmentTank)=>void|Promise<void>
  onAddParcel:(treatmentId:string,tankId:string,parcel:{id:string;parcelId?:string;name:string;area:number;totalArea?:number;fraction?:number})=>void|Promise<void>
  onComplete:(treatmentId:string)=>void|Promise<void>
  onDelete:(treatmentId:string)=>void|Promise<void>
}

export default function PhytoRegister({products,parcels,treatments,onCreate,onUpdate,onAddTank,onAddParcel,onComplete,onDelete}:Props){
  const [editor,setEditor]=useState<Treatment|null>(null)
  const [creating,setCreating]=useState(false)
  const [openId,setOpenId]=useState<string|null>(treatments[0]?.id??null)
  const [tankFor,setTankFor]=useState<string|null>(null)
  const [parcelFor,setParcelFor]=useState<{treatmentId:string;tankId:string}|null>(null)
  const [message,setMessage]=useState('')

  function newTreatment(){
    const now=new Date().toISOString()
    setEditor({id:crypto.randomUUID(),name:'',culture:'Vigne',date:isoDate(today()),notes:'',products:[],tanks:[{id:crypto.randomUUID(),date:now,waterPerHa:0,waterLoaded:0,theoreticalArea:0,products:[],parcels:[]}],status:'open',createdAt:now,updatedAt:now})
    setCreating(true)
  }
  async function saveEditor(t:Treatment){
    if(creating)await onCreate(t);else await onUpdate(t)
    setEditor(null);setCreating(false);setOpenId(t.id);setMessage(creating?'Traitement créé et stock mis à jour.':'Traitement modifié et stock recalculé.')
  }

  return <section className="register-page">
    <div className="page-head"><header><p className="eyebrow">Préparation + registre</p><h1>Traitements</h1><p className="page-intro">Une seule saisie : tu prépares le pulvé, puis tu ajoutes les parcelles réellement traitées.</p></header><button className="primary" onClick={newTreatment}><Plus size={19}/> Nouveau traitement</button></div>
    {message&&<p className="success-message">{message}</p>}
    {treatments.length===0&&<div className="panel empty-register"><Sprout size={38}/><h2>Aucun traitement</h2><p>Crée ton premier traitement : l’eau, les produits et le premier plein seront enregistrés ensemble.</p><button className="primary" onClick={newTreatment}><Plus size={18}/> Commencer</button></div>}
    <div className="treatment-list">{treatments.map(t=><TreatmentCard key={t.id} treatment={t} products={products} open={openId===t.id} onToggle={()=>setOpenId(openId===t.id?null:t.id)} onEdit={()=>{setCreating(false);setEditor(structuredClone(t))}} onTank={()=>setTankFor(t.id)} onParcel={tankId=>setParcelFor({treatmentId:t.id,tankId})} onComplete={()=>onComplete(t.id)} onDelete={()=>confirm('Supprimer ce traitement ? Les produits seront remis en stock.')&&onDelete(t.id)}/>)}</div>
    {editor&&<TreatmentEditor treatment={editor} products={products} creating={creating} onClose={()=>{setEditor(null);setCreating(false)}} onSave={saveEditor}/>}    
    {tankFor&&<TankModal treatment={treatments.find(t=>t.id===tankFor)!} products={products} onClose={()=>setTankFor(null)} onSave={async tank=>{await onAddTank(tankFor,tank);setTankFor(null);setMessage('Nouveau plein enregistré.')}}/>}
    {parcelFor&&<ParcelModal parcels={parcels} culture={treatments.find(t=>t.id===parcelFor.treatmentId)?.culture??''} onClose={()=>setParcelFor(null)} onSave={async parcel=>{await onAddParcel(parcelFor.treatmentId,parcelFor.tankId,parcel);setParcelFor(null);setMessage('Parcelle ajoutée.')}}/>}
  </section>
}

function TreatmentEditor({treatment,products,creating,onClose,onSave}:{treatment:Treatment;products:Product[];creating:boolean;onClose:()=>void;onSave:(t:Treatment)=>void|Promise<void>}){
  const [draft,setDraft]=useState<Treatment>(treatment)
  const [error,setError]=useState('')

  function updateTank(tankId:string,fn:(t:TreatmentTank)=>TreatmentTank){setDraft(current=>({...current,tanks:current.tanks.map(t=>t.id===tankId?fn(t):t)}))}
  function updateTankPlan(tankId:string,patch:{waterPerHa?:number;theoreticalArea?:number}){
    updateTank(tankId,t=>{
      const waterPerHa=patch.waterPerHa??t.waterPerHa
      const theoreticalArea=patch.theoreticalArea??t.theoreticalArea
      const tankProducts=t.products.map(line=>{
        const ref=draft.products.find(r=>r.productId===line.productId)
        return ref?{...line,quantity:Number((ref.referenceDose*theoreticalArea).toFixed(6))}:line
      })
      return {...t,waterPerHa,theoreticalArea,waterLoaded:waterFor(waterPerHa,theoreticalArea),products:tankProducts}
    })
  }
  function updateReferenceDose(refId:string,value:number){
    setDraft(current=>{
      const nextProducts=current.products.map(ref=>ref.id===refId?{...ref,referenceDose:value}:ref)
      const changed=nextProducts.find(ref=>ref.id===refId)
      return {...current,products:nextProducts,tanks:current.tanks.map(t=>({...t,products:t.products.map(line=>line.productId===changed?.productId?{...line,quantity:Number((value*t.theoreticalArea).toFixed(6))}:line)}))}
    })
  }
  function addProduct(){
    const product=products.find(p=>!draft.products.some(line=>line.productId===p.id))
    if(!product)return
    const ref:TreatmentProduct={id:crypto.randomUUID(),productId:product.id,referenceDose:0,doseUnit:product.unit}
    setDraft(current=>({...current,products:[...current.products,ref],tanks:current.tanks.map(t=>({...t,products:[...t.products,{id:crypto.randomUUID(),productId:product.id,quantity:0,unit:product.unit}]}))}))
  }
  function changeProduct(refId:string,oldProductId:string,newProductId:string){
    if(draft.products.some(ref=>ref.id!==refId&&ref.productId===newProductId)){setError('Ce produit est déjà dans le traitement.');return}
    const product=products.find(p=>p.id===newProductId)
    setError('')
    setDraft(current=>({...current,
      products:current.products.map(ref=>ref.id===refId?{...ref,productId:newProductId,doseUnit:product?.unit??ref.doseUnit}:ref),
      tanks:current.tanks.map(t=>({...t,products:t.products.map(line=>line.productId===oldProductId?{...line,productId:newProductId,unit:product?.unit??line.unit}:line)}))
    }))
  }
  function removeProduct(productId:string){setDraft(current=>({...current,products:current.products.filter(p=>p.productId!==productId),tanks:current.tanks.map(t=>({...t,products:t.products.filter(p=>p.productId!==productId)}))}))}
  function addParcel(tankId:string){updateTank(tankId,t=>({...t,parcels:[...t.parcels,{id:crypto.randomUUID(),name:'',area:0}]}))}
  function removeTank(tankId:string){if(draft.tanks.length===1)return;setDraft(current=>({...current,tanks:current.tanks.filter(t=>t.id!==tankId)}))}
  async function save(){
    if(!draft.name.trim()){setError('Donne un nom au traitement.');return}
    if(!draft.products.length){setError('Ajoute au moins un produit.');return}
    if(draft.products.some(p=>p.referenceDose<=0)){setError('Indique la dose/ha de chaque produit.');return}
    if(!draft.tanks.length||draft.tanks.some(t=>t.waterPerHa<=0||t.theoreticalArea<=0)){setError('Indique le litrage/ha et le nombre d’hectares théoriques de chaque plein.');return}
    if(draft.tanks.some(t=>t.products.some(p=>p.quantity<0))){setError('Une quantité produit ne peut pas être négative.');return}
    const cleaned={...draft,name:draft.name.trim(),tanks:draft.tanks.map(t=>({...t,waterLoaded:waterFor(t.waterPerHa,t.theoreticalArea),parcels:t.parcels.filter(p=>p.name.trim()&&p.area>0)})),updatedAt:new Date().toISOString()}
    await onSave(cleaned)
  }

  return <div className="modal"><div className="panel editor treatment-editor combined-editor"><div className="quick-title"><div><p className="eyebrow">{creating?'Nouveau traitement':'Correction du registre'}</p><h2>{creating?'Préparer le traitement':'Modifier le traitement'}</h2></div><button className="close-btn" onClick={onClose}>×</button></div>
    <div className="grid"><label>Nom<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Ex. Mildiou — passage 5"/></label><label>Culture<select value={draft.culture} onChange={e=>setDraft({...draft,culture:e.target.value})}>{cultures.map(c=><option key={c}>{c}</option>)}</select></label><label>Date<input type="date" value={draft.date.slice(0,10)} onChange={e=>setDraft({...draft,date:isoDate(e.target.value)})}/></label><label className="wide">Observations<textarea value={draft.notes??''} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label></div>
    <div className="prep-head"><div><h3>Produits du traitement</h3><small>Ajoute tous les produits du passage, avec leur dose prévue par hectare.</small></div><button className="primary" onClick={addProduct} disabled={draft.products.length>=products.length}><Plus size={17}/> Ajouter un produit</button></div>
    <div className="reference-products">{draft.products.map(ref=>{const p=products.find(x=>x.id===ref.productId);return <div className="reference-line" key={ref.id}><label>Produit<select value={ref.productId} onChange={e=>changeProduct(ref.id,ref.productId,e.target.value)}>{products.filter(x=>x.id===ref.productId||!draft.products.some(r=>r.productId===x.id)).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Dose / ha<DecimalInput value={ref.referenceDose} onValueChange={value=>updateReferenceDose(ref.id,value)}/></label><label>Unité<select value={ref.doseUnit} onChange={e=>setDraft({...draft,products:draft.products.map(x=>x.id===ref.id?{...x,doseUnit:e.target.value as TreatmentProduct['doseUnit']}:x)})}>{['L','mL','kg','g','unité','pack'].map(u=><option key={u}>{u}</option>)}</select></label><button className="remove-line" onClick={()=>removeProduct(ref.productId)} title={`Retirer ${p?.name??'le produit'}`}><Trash2 size={18}/></button></div>})}</div>
    {!draft.products.length&&<button className="add-first-product" onClick={addProduct}><Plus size={19}/> Ajouter le premier produit</button>}
    <div className="tank-edit-list">{draft.tanks.map((tank,index)=>{const actual=actualArea(tank);const recovery=draft.culture==='Vigne'?recoveryPercent(tank.theoreticalArea,actual):0;return <div className="tank-card editable-tank" key={tank.id}><div className="tank-heading"><div><p className="eyebrow">Plein n°{index+1}</p><h3><Droplets size={18}/> {fmt(tank.waterLoaded,0)} L d’eau à mettre</h3></div>{draft.tanks.length>1&&<button className="history-delete" onClick={()=>removeTank(tank.id)}><Trash2 size={17}/></button>}</div>
      <div className="grid tank-grid"><label>Litrage / ha<DecimalInput value={tank.waterPerHa} onValueChange={value=>updateTankPlan(tank.id,{waterPerHa:value})}/></label><label>Hectares théoriques à faire<DecimalInput value={tank.theoreticalArea} onValueChange={value=>updateTankPlan(tank.id,{theoreticalArea:value})}/></label><div className="tank-theoretical"><span>Eau à mettre dans le pulvé</span><b>{fmt(tank.waterLoaded,0)} L</b></div></div>
      <div className="tank-entry-lines">{tank.products.map(line=>{const ref=draft.products.find(r=>r.productId===line.productId);const p=products.find(x=>x.id===line.productId);const dose=tank.theoreticalArea?line.quantity/tank.theoreticalArea:0;const calculated=(ref?.referenceDose??0)*tank.theoreticalArea;return <div className="tank-entry-line" key={line.id}><div><b>{p?.name??'Produit'}</b><small>Calcul : {fmt(ref?.referenceDose??0,3)} {ref?.doseUnit}/ha × {fmt(tank.theoreticalArea,3)} ha = <strong>{fmt(calculated,3)} {line.unit}</strong> · Dose réelle : {fmt(dose,3)} {line.unit}/ha</small></div><DecimalInput value={line.quantity} onValueChange={value=>updateTank(tank.id,t=>({...t,products:t.products.map(x=>x.id===line.id?{...x,quantity:value}:x)}))}/><b>{line.unit}</b></div>})}</div>
      <div className="parcel-zone"><div className="prep-head"><div><h4>Parcelles réalisées</h4><small>Tu peux aussi les ajouter plus tard depuis la fiche.</small></div><button className="add-parcel" onClick={()=>addParcel(tank.id)}><Plus size={16}/> Parcelle</button></div>{tank.parcels.map(parcel=><div className="editable-parcel" key={parcel.id}><input placeholder="Nom de la parcelle" value={parcel.name} onChange={e=>updateTank(tank.id,t=>({...t,parcels:t.parcels.map(p=>p.id===parcel.id?{...p,name:e.target.value}:p)}))}/><DecimalInput placeholder="ha" value={parcel.area} onValueChange={value=>updateTank(tank.id,t=>({...t,parcels:t.parcels.map(p=>p.id===parcel.id?{...p,area:value}:p)}))}/><button className="history-delete" onClick={()=>updateTank(tank.id,t=>({...t,parcels:t.parcels.filter(p=>p.id!==parcel.id)}))}><Trash2 size={16}/></button></div>)}<div className="treatment-result"><span>Surface réalisée</span><b>{fmt(actual)} ha</b></div>{draft.culture==='Vigne'&&actual>0&&<div className="treatment-result recovery-result"><span>Récupération estimée de bouillie</span><b>{fmt(recovery,1)} %</b><small>Calculée à partir de {fmt(tank.theoreticalArea)} ha prévus et {fmt(actual)} ha réellement traités.</small></div>}</div>
    </div>})}</div>
    {error&&<p className="form-error">{error}</p>}<button className="primary large huge-prep-button" onClick={save}><Save size={20}/> {creating?'Enregistrer la préparation':'Enregistrer les modifications'}</button>
  </div></div>
}

function TreatmentCard({treatment,products,open,onToggle,onEdit,onTank,onParcel,onComplete,onDelete}:{treatment:Treatment;products:Product[];open:boolean;onToggle:()=>void;onEdit:()=>void;onTank:()=>void;onParcel:(tankId:string)=>void;onComplete:()=>void;onDelete:()=>void}){
  const totals=useMemo(()=>({water:treatment.tanks.reduce((s,t)=>s+t.waterLoaded,0),theoretical:treatment.tanks.reduce((s,t)=>s+t.theoreticalArea,0),actual:treatment.tanks.reduce((s,t)=>s+actualArea(t),0)}),[treatment])
  const totalRecovery=treatment.culture==='Vigne'?recoveryPercent(totals.theoretical,totals.actual):0
  return <article className={`panel treatment-card ${treatment.status}`}><button className="treatment-summary" onClick={onToggle}><div><div className="treatment-title"><b>{treatment.name}</b><span className={`status-badge ${treatment.status}`}>{treatment.status==='completed'?'Terminé':'En cours'}</span></div><small>{new Date(treatment.date).toLocaleDateString('fr-FR')} · {treatment.culture} · {treatment.tanks.length} plein(s)</small></div><div className="summary-numbers"><span>Prévu<b>{fmt(totals.theoretical)} ha</b></span><span>Réalisé<b>{fmt(totals.actual)} ha</b></span>{treatment.culture==='Vigne'&&totals.actual>0&&<span>Récupération<b>{fmt(totalRecovery,1)} %</b></span>}{open?<ChevronUp/>:<ChevronDown/>}</div></button>{open&&<div className="treatment-detail"><div className="reference-summary"><h3>Produits prévus</h3>{treatment.products.map(r=><div className="row" key={r.id}><b>{products.find(p=>p.id===r.productId)?.name??'Produit supprimé'}</b><strong>{fmt(r.referenceDose,3)} {r.doseUnit}/ha</strong></div>)}</div><div className="tank-list">{treatment.tanks.map((tank,i)=>{const actual=actualArea(tank);const recovery=treatment.culture==='Vigne'?recoveryPercent(tank.theoreticalArea,actual):0;return <div className="tank-card" key={tank.id}><div className="tank-heading"><div><p className="eyebrow">Plein n°{i+1}</p><h3><Droplets size={18}/>{fmt(tank.waterLoaded,0)} L · {fmt(tank.waterPerHa,0)} L/ha · {fmt(tank.theoreticalArea)} ha prévus</h3></div></div><div className="tank-products">{tank.products.map(line=><div className="row" key={line.id}><div><b>{products.find(p=>p.id===line.productId)?.name??'Produit'}</b><small>Dose réelle prévue : {fmt(tank.theoreticalArea?line.quantity/tank.theoreticalArea:0,3)} {line.unit}/ha</small></div><strong>{fmt(line.quantity,3)} {line.unit}</strong></div>)}</div><div className="parcel-zone"><div className="prep-head"><h4>Parcelles traitées</h4><button className="add-parcel" onClick={()=>onParcel(tank.id)}><MapPin size={16}/> Ajouter</button></div>{tank.parcels.length===0?<small>Aucune parcelle renseignée.</small>:tank.parcels.map(p=><div className="parcel-row" key={p.id}><span>{p.name}{p.totalArea&&p.area<p.totalArea?<small>Partie traitée sur {fmt(p.totalArea)} ha</small>:null}</span><b>{fmt(p.area)} ha</b></div>)}<div className="treatment-result"><span>Surface réalisée</span><b>{fmt(actual)} ha</b></div>{treatment.culture==='Vigne'&&actual>0&&<div className="treatment-result recovery-result"><span>Récupération estimée de bouillie</span><b>{fmt(recovery,1)} %</b></div>}</div></div>})}</div><div className="treatment-actions"><button className="complete-btn" onClick={onEdit}><Pencil size={18}/> Modifier</button><button className="primary" onClick={onTank}><Plus size={18}/> Ajouter un plein</button>{treatment.status==='open'&&<button className="complete-btn" onClick={onComplete}><CheckCircle2 size={18}/> Terminer</button>}<button className="delete-treatment" onClick={onDelete}><Trash2 size={18}/></button></div>{treatment.notes&&<p><b>Observations :</b> {treatment.notes}</p>}</div>}</article>
}

function TankModal({treatment,products,onClose,onSave}:{treatment:Treatment;products:Product[];onClose:()=>void;onSave:(tank:TreatmentTank)=>void|Promise<void>}){
  const [waterPerHa,setWaterPerHa]=useState(''),[theoreticalArea,setTheoreticalArea]=useState(''),[quantities,setQuantities]=useState<Record<string,string>>({}),[error,setError]=useState('')
  const waterLoaded=waterFor(num(waterPerHa),num(theoreticalArea))
  useEffect(()=>{
    const area=num(theoreticalArea)
    setQuantities(Object.fromEntries(treatment.products.map(r=>[r.productId,area>0?String(Number((r.referenceDose*area).toFixed(6))).replace('.',','):''])))
  },[theoreticalArea,treatment.products])
  async function save(){if(num(waterPerHa)<=0||num(theoreticalArea)<=0){setError('Indique le litrage/ha et les hectares théoriques à faire.');return}const lines=treatment.products.map(r=>{const p=products.find(x=>x.id===r.productId);return{id:crypto.randomUUID(),productId:r.productId,quantity:num(quantities[r.productId]),unit:p?.unit??r.doseUnit}});if(lines.some(l=>l.quantity<0)){setError('Quantité invalide.');return}await onSave({id:crypto.randomUUID(),date:new Date().toISOString(),waterPerHa:num(waterPerHa),waterLoaded,theoreticalArea:num(theoreticalArea),products:lines,parcels:[]})}
  return <div className="modal"><div className="panel quick-modal tank-editor"><div className="quick-title"><div><p className="eyebrow">{treatment.name}</p><h2>Nouveau plein</h2></div><button className="close-btn" onClick={onClose}>×</button></div><label>Litrage / ha<input inputMode="decimal" value={waterPerHa} onChange={e=>setWaterPerHa(e.target.value)}/></label><label>Hectares théoriques à faire<input className="quantity-input" inputMode="decimal" value={theoreticalArea} onChange={e=>setTheoreticalArea(e.target.value)}/></label><div className="tank-theoretical"><span>Eau à mettre dans le pulvé</span><b>{fmt(waterLoaded,0)} L</b></div>{treatment.products.map(r=>{const p=products.find(x=>x.id===r.productId);const calculated=r.referenceDose*num(theoreticalArea);return <label key={r.id}>{p?.name} — {fmt(r.referenceDose,3)} {r.doseUnit}/ha × {fmt(num(theoreticalArea),3)} ha = {fmt(calculated,3)} {p?.unit}<input inputMode="decimal" value={quantities[r.productId]??''} onChange={e=>setQuantities({...quantities,[r.productId]:e.target.value})}/></label>})}{error&&<p className="form-error">{error}</p>}<button className="primary large" onClick={save}><Droplets size={19}/> Enregistrer le plein</button></div></div>
}
function DecimalInput({value,onValueChange,placeholder}:{value:number;onValueChange:(value:number)=>void;placeholder?:string}){
  const [text,setText]=useState(value?String(value).replace('.',','):'')
  useEffect(()=>{setText(value?String(value).replace('.',','):'')},[value])
  return <input inputMode="decimal" placeholder={placeholder} value={text} onChange={e=>{const raw=e.target.value;if(!/^\d*([,.]\d*)?$/.test(raw))return;setText(raw);onValueChange(num(raw))}}/>
}

function ParcelModal({parcels,culture,onClose,onSave}:{parcels:Parcel[];culture:string;onClose:()=>void;onSave:(p:{id:string;parcelId?:string;name:string;area:number;totalArea?:number;fraction?:number})=>void|Promise<void>}){
  const [query,setQuery]=useState('')
  const [selectedId,setSelectedId]=useState('')
  const [mode,setMode]=useState<'full'|'half'|'third'|'twoThirds'|'custom'>('full')
  const [customArea,setCustomArea]=useState('')
  const [error,setError]=useState('')
  const filtered=parcels.filter(p=>{
    const q=query.trim().toLowerCase()
    const cultureOk=!culture||p.culture===culture
    const text=`${p.usualName} ${p.islandNumber} ${p.parcelNumber} ${p.culture}`.toLowerCase()
    return cultureOk&&(!q||text.includes(q))
  }).sort((a,b)=>a.islandNumber-b.islandNumber||a.parcelNumber-b.parcelNumber)
  const selected=parcels.find(p=>p.id===selectedId)
  const fraction=mode==='full'?1:mode==='half'?0.5:mode==='third'?1/3:mode==='twoThirds'?2/3:undefined
  const treatedArea=selected?(mode==='custom'?num(customArea):Number((selected.area*(fraction??1)).toFixed(3))):0
  async function save(){
    if(!selected){setError('Choisis une parcelle.');return}
    if(treatedArea<=0||treatedArea>selected.area+0.001){setError('La surface traitée doit être comprise entre 0 et la surface totale.');return}
    await onSave({id:crypto.randomUUID(),parcelId:selected.id,name:selected.usualName||`Îlot ${selected.islandNumber} — parcelle ${selected.parcelNumber}`,area:treatedArea,totalArea:selected.area,fraction})
  }
  return <div className="modal"><div className="panel quick-modal parcel-picker">
    <div className="quick-title"><div><p className="eyebrow">Réalisation</p><h2>Choisir une parcelle</h2></div><button className="close-btn" onClick={onClose}>×</button></div>
    <label>Rechercher<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, îlot ou parcelle…"/></label>
    <div className="parcel-choice-list">{filtered.map(p=><button key={p.id} className={selectedId===p.id?'parcel-choice selected':'parcel-choice'} onClick={()=>{setSelectedId(p.id);setMode('full');setCustomArea('');setError('')}}>
      <span><b>{p.usualName||`Îlot ${p.islandNumber} — parcelle ${p.parcelNumber}`}</b><small>{p.culture} · {fmt(p.area)} ha</small></span>
      <span>{selectedId===p.id?'✓':''}</span>
    </button>)}</div>
    {selected&&<div className="partial-area-box"><h3>Quelle partie a été traitée ?</h3><div className="fraction-buttons">
      <button className={mode==='full'?'selected':''} onClick={()=>setMode('full')}>Entière</button>
      <button className={mode==='half'?'selected':''} onClick={()=>setMode('half')}>1/2</button>
      <button className={mode==='third'?'selected':''} onClick={()=>setMode('third')}>1/3</button>
      <button className={mode==='twoThirds'?'selected':''} onClick={()=>setMode('twoThirds')}>2/3</button>
      <button className={mode==='custom'?'selected':''} onClick={()=>setMode('custom')}>Autre</button>
    </div>
    {mode==='custom'&&<label>Surface réellement traitée (ha)<input inputMode="decimal" value={customArea} onChange={e=>setCustomArea(e.target.value)}/></label>}
    <div className="tank-theoretical"><span>Surface enregistrée</span><b>{fmt(treatedArea,3)} ha sur {fmt(selected.area,3)} ha</b></div></div>}
    {error&&<p className="form-error">{error}</p>}
    <button className="primary large" onClick={save}><MapPin size={18}/> Ajouter cette parcelle</button>
  </div></div>
}
