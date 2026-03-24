import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { Party } from '../types/party'

export function useParty(partyId: string | null) {
  return useQuery<Party>({
    queryKey: ['party', partyId],
    queryFn: async () => {
      if (!partyId) throw new Error('Party ID is required')
      const response = await api.get(`/parties/${partyId}`)
      return response.data
    },
    enabled: !!partyId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2,
  })
}
