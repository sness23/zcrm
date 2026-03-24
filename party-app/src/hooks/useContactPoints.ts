import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { ContactPointEmail, ContactPointPhone, ContactPointAddress } from '../types/party'

export function useContactPointEmails(partyId: string | null) {
  return useQuery<ContactPointEmail[]>({
    queryKey: ['contact-points', 'emails', partyId],
    queryFn: async () => {
      if (!partyId) throw new Error('Party ID is required')
      const response = await api.get(`/parties/${partyId}/contact-points/emails`)
      return response.data
    },
    enabled: !!partyId,
    staleTime: 30000,
  })
}

export function useContactPointPhones(partyId: string | null) {
  return useQuery<ContactPointPhone[]>({
    queryKey: ['contact-points', 'phones', partyId],
    queryFn: async () => {
      if (!partyId) throw new Error('Party ID is required')
      const response = await api.get(`/parties/${partyId}/contact-points/phones`)
      return response.data
    },
    enabled: !!partyId,
    staleTime: 30000,
  })
}

export function useContactPointAddresses(partyId: string | null) {
  return useQuery<ContactPointAddress[]>({
    queryKey: ['contact-points', 'addresses', partyId],
    queryFn: async () => {
      if (!partyId) throw new Error('Party ID is required')
      const response = await api.get(`/parties/${partyId}/contact-points/addresses`)
      return response.data
    },
    enabled: !!partyId,
    staleTime: 30000,
  })
}
