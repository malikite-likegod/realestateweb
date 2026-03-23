export interface ResoPropertyRaw {
  ListingKey:            string
  ListingId?:            string
  StandardStatus:        string
  PropertyType?:         string
  PropertySubType?:      string
  ListPrice?:            number
  OriginalListPrice?:    number
  ClosePrice?:           number
  BedroomsTotal?:        number
  BathroomsTotalInteger?: number
  LivingArea?:           number
  LotSizeAcres?:         number
  YearBuilt?:            number
  StreetNumber?:         string
  StreetName?:           string
  UnitNumber?:           string
  City?:                 string
  StateOrProvince?:      string
  PostalCode?:           string
  Latitude?:             number
  Longitude?:            number
  PublicRemarks?:        string
  Media?:                { url: string; order: number }[]
  ListAgentKey?:         string
  ListAgentFullName?:    string
  ListOfficeKey?:        string
  ListOfficeName?:       string
  ListingContractDate?:  string
  ModificationTimestamp?: string
  // DLA-enriched fields
  MlsStatus?:                string
  ContractStatus?:           string
  PhotosChangeTimestamp?:    string
  DocumentsChangeTimestamp?: string
  MediaChangeTimestamp?:     string
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
