export interface Party {
  id: string                    // ULID with pty_ prefix
  type: 'party'
  partyType: 'individual' | 'organization' | 'household'
  role: 'customer' | 'prospect' | 'partner' | 'vendor' | 'salesperson' | 'manager' | 'executive' | 'support'
  name: string
  displayName?: string
  email?: string
  phone?: string

  // Extended fields
  profilePicture?: string
  title?: string
  department?: string
  timezone?: string
  language?: string
  preferredContactMethod?: 'Email' | 'Phone' | 'SMS' | 'Chat'

  // Salesperson-specific
  quota?: number
  territory?: string
  isActive?: boolean
  startDate?: string

  // Timestamps
  createdAt: string
  updatedAt?: string
  lastContactedAt?: string

  // Metadata
  tags?: string[]
  owner?: string
  source?: string
}

export interface ContactPointEmail {
  id: string
  partyId: string
  email: string
  type: 'Work' | 'Personal' | 'Other'
  isPrimary: boolean
  verified: boolean
  createdAt: string
}

export interface ContactPointPhone {
  id: string
  partyId: string
  number: string
  type: 'Mobile' | 'Work' | 'Home' | 'Fax' | 'Other'
  isPrimary: boolean
  extension?: string
  createdAt: string
}

export interface ContactPointAddress {
  id: string
  partyId: string
  street: string
  city: string
  state: string
  postalCode: string
  country: string
  type: 'Billing' | 'Shipping' | 'Mailing' | 'Other'
  isPrimary: boolean
  createdAt: string
}
