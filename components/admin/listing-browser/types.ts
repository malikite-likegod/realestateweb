export interface ResoListing {
  id:                    string
  listingKey:            string
  streetNumber:          string | null
  streetName:            string | null
  streetSuffix:          string | null
  unitNumber:            string | null
  city:                  string | null
  listPrice:             number | null
  bedroomsTotal:         number | null
  bathroomsTotalInteger: number | null
  garageSpaces:          number | null
  livingArea:            number | null
  propertyType:          string | null
  propertySubType:       string | null
  transactionType:       string | null
  media:                 string | null
  standardStatus:        string | null
}
