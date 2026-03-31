export interface ResoPropertyRaw {
  ListingKey:            string
  StandardStatus:        string
  PropertyType?:         string
  PropertySubType?:      string
  ListPrice?:            number
  BedroomsTotal?:        number
  BedroomsAboveGrade?:   number
  BedroomsBelowGrade?:   number   // maps to bedroomsPlus
  BathroomsTotalInteger?: number
  BuildingAreaTotal?:    number
  LivingAreaRange?:      string   // maps to sqftRange e.g. "1500-2000"
  LotSizeArea?:          number
  LotSizeUnits?:         string
  LotWidth?:             number   // maps to lotFront
  LotDepth?:             number
  StreetNumber?:         string
  StreetName?:           string
  StreetSuffix?:         string
  UnitNumber?:           string
  UnparsedAddress?:      string
  TransactionType?:      string
  City?:                 string
  CityRegion?:           string   // maps to community
  CountyOrParish?:       string   // maps to municipality
  StateOrProvince?:      string
  PostalCode?:           string
  PublicRemarks?:        string
  ListOfficeKey?:        string
  ListOfficeName?:       string
  OriginalEntryTimestamp?: string  // maps to listingContractDate
  ModificationTimestamp?:  string
  // Interior — PropTx returns many of these as string arrays; sync.ts uses toStr() to flatten
  GarageParkingSpaces?:  number
  ParkingTotal?:         number
  ParkingFeatures?:      string | string[]
  KitchensTotal?:        number
  KitchensAboveGrade?:   number
  KitchensBelowGrade?:   number   // maps to kitchensPlusTotal
  Basement?:             string | string[]
  HeatSource?:           string | string[]
  HeatType?:             string | string[]
  Cooling?:              string | string[]  // maps to airConditioning
  DenFamilyroomYN?:      boolean            // maps to familyRoom as "Yes"/"No"
  FireplaceFeatures?:    string | string[]
  // Exterior
  ExteriorFeatures?:     string | string[]
  Roof?:                 string | string[]
  FoundationDetails?:    string | string[]
  PoolFeatures?:         string | string[]
  DirectionFaces?:       string | string[]  // maps to frontingOn
  WaterfrontFeatures?:   string | string[]  // maps to waterFrontType
  WaterfrontYN?:         boolean
  // Building
  ArchitecturalStyle?:   string | string[]
  LegalStories?:         number
  ApproximateAge?:       string
  ConstructionMaterials?: string | string[]
  Sewer?:                string | string[]
  WaterSource?:          string | string[]  // maps to water
  // Community
  CrossStreet?:          string
  AssociationAmenities?: string | string[]  // maps to amenities
  // Taxes & fees
  TaxAnnualAmount?:      number
  TaxYear?:              number
  AssociationFee?:       number
  AssociationFeeIncludes?: string | string[]
  AssessmentYear?:       number
  // DLA-enriched fields (not in IDX select, written by DLA sync)
  MlsStatus?:                string
  ContractStatus?:           string
  PhotosChangeTimestamp?:    string
  DocumentsChangeTimestamp?: string
  MediaChangeTimestamp?:     string
  ListAgentFullName?:        string
  MajorChangeTimestamp?:     string
}

export interface ResoMemberRaw {
  MemberKey:             string
  MemberFullName?:       string
  MemberEmail?:          string
  MemberMobilePhone?:    string
  MemberStatus?:         string
  OfficeKey?:            string
  OfficeName?:           string
  ModificationTimestamp?:  string
  PhotosChangeTimestamp?:  string
}

export interface ResoOfficeRaw {
  OfficeKey:             string
  OfficeName?:           string
  OfficeEmail?:          string
  OfficePhone?:          string
  ModificationTimestamp?:  string
  PhotosChangeTimestamp?:  string
}

export interface ResoMediaRaw {
  MediaKey:               string
  ResourceRecordKey:      string   // ListingKey of the parent property
  MediaURL?:              string
  Order?:                 number
  MediaType?:             string
  MediaStatus?:           string   // 'Deleted' = soft-deleted
  ImageSizeDescription?:  string   // e.g. 'Largest', 'Large'
  ModificationTimestamp?: string
}

export interface AmpreODataResponse<T> {
  '@odata.context'?:  string
  '@odata.count'?:    number
  '@odata.nextLink'?: string
  value:              T[]
}

/** @deprecated Use AmpreODataResponse */
export type ResoODataResponse<T> = AmpreODataResponse<T>

export interface ResoSyncResult {
  added:      number
  updated:    number
  removed:    number
  errors:     string[]
  durationMs: number
}
