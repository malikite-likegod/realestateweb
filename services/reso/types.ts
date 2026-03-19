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
}

export interface ResoMemberRaw {
  MemberKey:      string
  MemberFullName: string
  MemberEmail?:   string
  OfficeKey?:     string
}

export interface ResoOfficeRaw {
  OfficeKey:   string
  OfficeName:  string
  OfficeEmail?: string
}

export interface ResoODataResponse<T> {
  '@odata.context'?: string
  '@odata.count'?:   number
  value:             T[]
}

export interface ResoSyncResult {
  added:      number
  updated:    number
  removed:    number
  errors:     string[]
  durationMs: number
}
