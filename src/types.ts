export type Unit = 'L'|'mL'|'kg'|'g'|'unité'|'pack'
export type MovementType = 'entry'|'exit'|'adjustment'|'preparation'|'treatment'
export type Product = {
  id:string
  name:string
  stock:number
  unit:Unit
  threshold:number
  cultures:string[]
  amm?:string
  ephyUrl?:string
  packaging?:string
  activeIngredient?:string
  family?:string
  supplier?:string
  purchasePrice?:number
  lotNumber?:string
  purchaseDate?:string
  notes?:string
  createdAt:string
  updatedAt:string
}
export type Movement = { id:string; productId:string; type:MovementType; quantity:number; date:string; culture?:string; reason?:string; note?:string; preparationId?:string }
export type PreparationLine = { id:string; productId:string; dose:number; doseUnit:'L'|'mL'|'kg'|'g' }
export type Preparation = { id:string; name:string; culture:string; area:number; waterVolume:number; date:string; lines:PreparationLine[] }

export type TreatmentProduct = { id:string; productId:string; referenceDose:number; doseUnit:Unit }
export type TreatmentTankProduct = { id:string; productId:string; quantity:number; unit:Unit }
export type ParcelGeometry = number[][][]
export type Parcel = {
  id:string
  islandNumber:number
  parcelNumber:number
  usualName:string
  culture:string
  cultureCode:string
  area:number
  communeCode?:string
  campaign:number
  geometry:ParcelGeometry
  createdAt:string
  updatedAt:string
}
export type TreatmentParcel = { id:string; parcelId?:string; name:string; area:number; totalArea?:number; fraction?:number }
export type TreatmentTank = { id:string; date:string; waterPerHa:number; waterLoaded:number; theoreticalArea:number; products:TreatmentTankProduct[]; parcels:TreatmentParcel[] }
export type Treatment = { id:string; name:string; culture:string; date:string; notes?:string; products:TreatmentProduct[]; tanks:TreatmentTank[]; status:'open'|'completed'; createdAt:string; updatedAt:string }
