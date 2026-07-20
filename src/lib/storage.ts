import type { Movement, Parcel, Preparation, Product, Treatment } from '../types'
const K={products:'sp_products_v1',movements:'sp_movements_v1',preparations:'sp_preparations_v1',treatments:'sp_treatments_v1',parcels:'sp_parcels_v1'}
const read=<T,>(k:string,fallback:T):T=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback}catch{return fallback}}
const write=(k:string,v:unknown)=>localStorage.setItem(k,JSON.stringify(v))
export const storage={
 getProducts:()=>read<Product[]>(K.products,[]), setProducts:(v:Product[])=>write(K.products,v),
 getMovements:()=>read<Movement[]>(K.movements,[]), setMovements:(v:Movement[])=>write(K.movements,v),
 getPreparations:()=>read<Preparation[]>(K.preparations,[]), setPreparations:(v:Preparation[])=>write(K.preparations,v),
 getTreatments:()=>read<Treatment[]>(K.treatments,[]), setTreatments:(v:Treatment[])=>write(K.treatments,v),
 getParcels:()=>read<Parcel[]>(K.parcels,[]), setParcels:(v:Parcel[])=>write(K.parcels,v),
 clear:()=>Object.values(K).forEach(k=>localStorage.removeItem(k))
}
