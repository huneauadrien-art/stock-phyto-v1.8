import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Movement from './pages/Movement'
import History from './pages/History'
import Settings from './pages/Settings'
import PhytoRegister from './pages/PhytoRegister'
import Parcels from './pages/Parcels'
import Preparation from './pages/Preparation'
import Login from './pages/Login'
import { storage } from './lib/storage'
import { requiredInProductUnit } from './lib/units'
import { cloud, loadCloudData } from './lib/cloud'
import { supabase, supabaseEnabled } from './lib/supabase'
import type { Movement as M, Parcel, Preparation as P, Product, Treatment, TreatmentTank } from './types'
import { pac2026Parcels } from './parcelsData'

const DIRTY_KEY = 'sp_cloud_pending_v1'
const hasPendingChanges = () => localStorage.getItem(DIRTY_KEY) === '1'
const setPendingChanges = (value: boolean) => value ? localStorage.setItem(DIRTY_KEY, '1') : localStorage.removeItem(DIRTY_KEY)

export default function App(){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(supabaseEnabled)
  const [products,setProducts]=useState<Product[]>(storage.getProducts)
  const [movements,setMovements]=useState<M[]>(storage.getMovements)
  const [preps,setPreps]=useState<P[]>(storage.getPreparations)
  const [treatments,setTreatments]=useState<Treatment[]>(storage.getTreatments)
  const [parcels,setParcels]=useState<Parcel[]>(()=>{const saved=storage.getParcels();return saved.length?saved:pac2026Parcels})
  const [online,setOnline]=useState(navigator.onLine)
  const [syncState,setSyncState]=useState<'local'|'ok'|'syncing'|'error'|'offline'>(supabaseEnabled?'syncing':'local')
  const writing=useRef(false)
  const productsRef=useRef(products), movementsRef=useRef(movements), prepsRef=useRef(preps), treatmentsRef=useRef(treatments), parcelsRef=useRef(parcels)
  useEffect(()=>{productsRef.current=products},[products])
  useEffect(()=>{movementsRef.current=movements},[movements])
  useEffect(()=>{prepsRef.current=preps},[preps])
  useEffect(()=>{treatmentsRef.current=treatments},[treatments])
  useEffect(()=>{parcelsRef.current=parcels;storage.setParcels(parcels)},[parcels])

  useEffect(()=>{
    const onOnline=()=>setOnline(true), onOffline=()=>setOnline(false)
    window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline)
    return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline)}
  },[])

  useEffect(()=>{
    if(!supabase){setLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next))
    return()=>subscription.unsubscribe()
  },[])

  async function uploadSnapshot(){
    if(!session?.user||!supabase||!navigator.onLine)return
    writing.current=true;setSyncState('syncing')
    try{
      await Promise.all([
        cloud.saveProducts(session.user,productsRef.current),
        cloud.saveMovements(session.user,movementsRef.current),
        cloud.savePreparations(session.user,prepsRef.current),
        cloud.saveTreatments(session.user,treatmentsRef.current),
        cloud.saveParcels(session.user,parcelsRef.current),
      ])
      setPendingChanges(false);setSyncState('ok')
    }catch(error){console.error(error);setPendingChanges(true);setSyncState('error')}
    finally{window.setTimeout(()=>{writing.current=false},400)}
  }

  async function downloadSnapshot(){
    if(!session?.user||!supabase||!navigator.onLine||writing.current)return
    setSyncState('syncing')
    try{
      const remote=await loadCloudData()
      const hasRemote=Boolean(remote.products.length||remote.movements.length||remote.preparations.length||remote.treatments.length||remote.parcels.length)
      if(hasRemote){
        setProducts(remote.products);setMovements(remote.movements);setPreps(remote.preparations);setTreatments(remote.treatments);setParcels(remote.parcels.length?remote.parcels:pac2026Parcels)
        storage.setProducts(remote.products);storage.setMovements(remote.movements);storage.setPreparations(remote.preparations);storage.setTreatments(remote.treatments);storage.setParcels(remote.parcels.length?remote.parcels:pac2026Parcels)
}else if(productsRef.current.length||movementsRef.current.length||prepsRef.current.length||treatmentsRef.current.length||parcelsRef.current.length){
        await uploadSnapshot();return
      }
      setSyncState('ok')
    }catch(error){console.error(error);setSyncState('error')}
  }

  useEffect(()=>{
    if(!session?.user||!supabase)return
    let active=true, timer:number|undefined
    const initial=async()=>{
      if(!navigator.onLine){setSyncState('offline');return}
      if(hasPendingChanges())await uploadSnapshot();else await downloadSnapshot()
    }
    initial()
    const scheduleReload=()=>{
      if(!active||writing.current||hasPendingChanges())return
      window.clearTimeout(timer);timer=window.setTimeout(()=>downloadSnapshot(),350)
    }
    const client=supabase
    const channel=client.channel(`stock-${session.user.id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'products'},scheduleReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'movements'},scheduleReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'preparations'},scheduleReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'treatments'},scheduleReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'parcels'},scheduleReload)
      .subscribe()
    return()=>{active=false;window.clearTimeout(timer);client.removeChannel(channel)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[session?.user.id])

  useEffect(()=>{
    if(!supabaseEnabled)return
    if(!online){setSyncState('offline');return}
    if(session?.user){if(hasPendingChanges())uploadSnapshot();else downloadSnapshot()}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[online])

  async function persistCloud(){
    if(!session?.user)return
    setPendingChanges(true)
    if(!navigator.onLine){setSyncState('offline');return}
    await uploadSnapshot()
  }
  async function saveProducts(v:Product[]){setProducts(v);productsRef.current=v;storage.setProducts(v);await persistCloud()}
  async function saveMovements(v:M[]){setMovements(v);movementsRef.current=v;storage.setMovements(v);await persistCloud()}
  async function savePreparations(v:P[]){setPreps(v);prepsRef.current=v;storage.setPreparations(v);await persistCloud()}
  async function saveTreatments(v:Treatment[]){setTreatments(v);treatmentsRef.current=v;storage.setTreatments(v);await persistCloud()}
  async function saveParcels(v:Parcel[]){setParcels(v);parcelsRef.current=v;storage.setParcels(v);await persistCloud()}

  async function saveAll(nextProducts:Product[],nextMovements:M[],nextPreps:P[]){
    setProducts(nextProducts);productsRef.current=nextProducts;storage.setProducts(nextProducts)
    setMovements(nextMovements);movementsRef.current=nextMovements;storage.setMovements(nextMovements)
    setPreps(nextPreps);prepsRef.current=nextPreps;storage.setPreparations(nextPreps)
    await persistCloud()
  }

  async function addMovement(m:M){
    const next=productsRef.current.map(p=>p.id===m.productId?{...p,stock:Number((p.stock+(m.type==='entry'?m.quantity:-m.quantity)).toFixed(3)),updatedAt:new Date().toISOString()}:p)
    await saveAll(next,[m,...movementsRef.current],prepsRef.current)
  }

  async function validatePrep(prep:P){
    let next=[...productsRef.current];const ms:M[]=[]
    for(const l of prep.lines){const p=next.find(x=>x.id===l.productId);if(!p)continue;const q=requiredInProductUnit(l,prep.area,p);next=next.map(x=>x.id===p.id?{...x,stock:Number((x.stock-q).toFixed(3)),updatedAt:new Date().toISOString()}:x);ms.push({id:crypto.randomUUID(),productId:p.id,type:'preparation',quantity:q,date:prep.date,culture:prep.culture,reason:`Préparation ${prep.name}`,preparationId:prep.id})}
    await saveAll(next,[...ms,...movementsRef.current],[prep,...prepsRef.current])
  }

  async function deleteMovement(m:M){
    const product=productsRef.current.find(p=>p.id===m.productId)
    if(!product){await saveAll(productsRef.current,movementsRef.current.filter(x=>x.id!==m.id),prepsRef.current);return}
    const reversedStock=m.type==='entry'?product.stock-m.quantity:product.stock+m.quantity
    if(reversedStock<0)throw new Error('Impossible de supprimer cette entrée : le stock deviendrait négatif.')
    const nextProducts=productsRef.current.map(p=>p.id===m.productId?{...p,stock:Number(reversedStock.toFixed(3)),updatedAt:new Date().toISOString()}:p)
    await saveAll(nextProducts,movementsRef.current.filter(x=>x.id!==m.id),prepsRef.current)
  }

  async function createTreatment(t:Treatment){
    let nextProducts=[...productsRef.current]
    const newMovements:M[]=[]
    for(const tank of t.tanks)for(const line of tank.products){
      const product=nextProducts.find(p=>p.id===line.productId)
      if(!product)continue
      if(line.quantity>product.stock)throw new Error(`Stock insuffisant pour ${product.name}.`)
      nextProducts=nextProducts.map(p=>p.id===product.id?{...p,stock:Number((p.stock-line.quantity).toFixed(3)),updatedAt:new Date().toISOString()}:p)
      if(line.quantity>0)newMovements.push({id:crypto.randomUUID(),productId:product.id,type:'treatment',quantity:line.quantity,date:tank.date,culture:t.culture,reason:`Plein phyto — ${t.name}`,preparationId:t.id})
    }
    const nextTreatments=[t,...treatmentsRef.current]
    setProducts(nextProducts);productsRef.current=nextProducts;storage.setProducts(nextProducts)
    const nextMovements=[...newMovements,...movementsRef.current];setMovements(nextMovements);movementsRef.current=nextMovements;storage.setMovements(nextMovements)
    setTreatments(nextTreatments);treatmentsRef.current=nextTreatments;storage.setTreatments(nextTreatments)
    await persistCloud()
  }

  async function addTreatmentTank(treatmentId:string,tank:TreatmentTank){
    let nextProducts=[...productsRef.current]
    const newMovements:M[]=[]
    for(const line of tank.products){
      const product=nextProducts.find(p=>p.id===line.productId)
      if(!product)continue
      nextProducts=nextProducts.map(p=>p.id===product.id?{...p,stock:Number((p.stock-line.quantity).toFixed(3)),updatedAt:new Date().toISOString()}:p)
      newMovements.push({id:crypto.randomUUID(),productId:product.id,type:'treatment',quantity:line.quantity,date:tank.date,culture:treatmentsRef.current.find(t=>t.id===treatmentId)?.culture,reason:`Plein phyto — ${treatmentsRef.current.find(t=>t.id===treatmentId)?.name??'Traitement'}`,preparationId:treatmentId})
    }
    const nextTreatments=treatmentsRef.current.map(t=>t.id===treatmentId?{...t,tanks:[...t.tanks,tank],updatedAt:new Date().toISOString()}:t)
    setProducts(nextProducts);productsRef.current=nextProducts;storage.setProducts(nextProducts)
    const nextMovements=[...newMovements,...movementsRef.current];setMovements(nextMovements);movementsRef.current=nextMovements;storage.setMovements(nextMovements)
    setTreatments(nextTreatments);treatmentsRef.current=nextTreatments;storage.setTreatments(nextTreatments)
    await persistCloud()
  }

  async function addTreatmentParcel(treatmentId:string,tankId:string,parcel:{id:string;parcelId?:string;name:string;area:number;totalArea?:number;fraction?:number}){
    await saveTreatments(treatmentsRef.current.map(t=>t.id===treatmentId?{...t,tanks:t.tanks.map(tank=>tank.id===tankId?{...tank,parcels:[...tank.parcels,parcel]}:tank),updatedAt:new Date().toISOString()}:t))
  }
  async function completeTreatment(treatmentId:string){await saveTreatments(treatmentsRef.current.map(t=>t.id===treatmentId?{...t,status:'completed',updatedAt:new Date().toISOString()}:t))}
  async function deleteTreatment(treatmentId:string){
    const treatment=treatmentsRef.current.find(t=>t.id===treatmentId)
    if(!treatment)return
    let nextProducts=[...productsRef.current]
    for(const tank of treatment.tanks)for(const line of tank.products)nextProducts=nextProducts.map(p=>p.id===line.productId?{...p,stock:Number((p.stock+line.quantity).toFixed(3)),updatedAt:new Date().toISOString()}:p)
    const nextMovements=movementsRef.current.filter(m=>!(m.type==='treatment'&&m.preparationId===treatmentId))
    const nextTreatments=treatmentsRef.current.filter(t=>t.id!==treatmentId)
    setProducts(nextProducts);productsRef.current=nextProducts;storage.setProducts(nextProducts)
    setMovements(nextMovements);movementsRef.current=nextMovements;storage.setMovements(nextMovements)
    setTreatments(nextTreatments);treatmentsRef.current=nextTreatments;storage.setTreatments(nextTreatments)
    await persistCloud()
  }

  async function updateTreatment(updated:Treatment){
    const previous=treatmentsRef.current.find(t=>t.id===updated.id)
    if(!previous)return
    const totals=(t:Treatment)=>{const map=new Map<string,number>();for(const tank of t.tanks)for(const line of tank.products)map.set(line.productId,(map.get(line.productId)??0)+line.quantity);return map}
    const oldTotals=totals(previous), newTotals=totals(updated)
    const ids=new Set([...oldTotals.keys(),...newTotals.keys()])
    let nextProducts=[...productsRef.current]
    for(const id of ids){
      const delta=(newTotals.get(id)??0)-(oldTotals.get(id)??0)
      const product=nextProducts.find(p=>p.id===id)
      if(!product)continue
      const stock=product.stock-delta
      if(stock<0)throw new Error(`Stock insuffisant pour ${product.name}.`)
      nextProducts=nextProducts.map(p=>p.id===id?{...p,stock:Number(stock.toFixed(3)),updatedAt:new Date().toISOString()}:p)
    }
    const keptMovements=movementsRef.current.filter(m=>!(m.type==='treatment'&&m.preparationId===updated.id))
    const rebuilt:M[]=[]
    for(const tank of updated.tanks)for(const line of tank.products){
      const product=nextProducts.find(p=>p.id===line.productId)
      if(!product||line.quantity<=0)continue
      rebuilt.push({id:crypto.randomUUID(),productId:line.productId,type:'treatment',quantity:line.quantity,date:tank.date,culture:updated.culture,reason:`Plein phyto — ${updated.name}`,preparationId:updated.id})
    }
    const nextTreatments=treatmentsRef.current.map(t=>t.id===updated.id?updated:t)
    setProducts(nextProducts);productsRef.current=nextProducts;storage.setProducts(nextProducts)
    const nextMovements=[...rebuilt,...keptMovements];setMovements(nextMovements);movementsRef.current=nextMovements;storage.setMovements(nextMovements)
    setTreatments(nextTreatments);treatmentsRef.current=nextTreatments;storage.setTreatments(nextTreatments)
    await persistCloud()
  }

  async function reset(){
    setTreatments([]);treatmentsRef.current=[];storage.setTreatments([])
    await saveAll([],[],[])
  }

  if(loading)return <div className="center-screen">Chargement…</div>
  if(supabaseEnabled&&!session)return <Login/>
  const syncLabel=syncState==='local'?'Mode local':syncState==='offline'?'Hors connexion — sauvegarde en attente':syncState==='syncing'?'Synchronisation…':syncState==='error'?'Erreur de synchronisation':'Synchronisé'

  return <Layout>
    <div className={`sync-pill ${syncState}`}>{syncLabel}</div>
    <Routes>
      <Route path="/" element={<Dashboard products={products} movements={movements}/>}/>
      <Route path="/produits" element={<Products products={products} onChange={saveProducts} onAddMovement={addMovement}/>}/>
      <Route path="/mouvement" element={<Movement products={products} onAdd={addMovement}/>}/>
      <Route path="/traitements" element={<PhytoRegister products={products} parcels={parcels} treatments={treatments} onCreate={createTreatment} onUpdate={updateTreatment} onAddTank={addTreatmentTank} onAddParcel={addTreatmentParcel} onComplete={completeTreatment} onDelete={deleteTreatment}/>}/>
      <Route path="/preparation" element={<Preparation products={products} onValidate={validatePrep}/>}/>
      <Route path="/registre" element={<Navigate to="/traitements" replace/>}/>
      <Route path="/parcellaire" element={<Parcels parcels={parcels} onChange={saveParcels}/>}/>
      <Route path="/historique" element={<History products={products} movements={movements} onDelete={deleteMovement}/>}/>
      <Route path="/parametres" element={<Settings products={products} movements={movements} preparations={preps} onImport={p=>saveProducts([...productsRef.current,...p])} onReset={reset} onLogout={session?()=>supabase?.auth.signOut():undefined}/>}/>
    </Routes>
  </Layout>
}
