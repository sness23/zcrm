import axios from 'axios'
import type { Party, ContactPointEmail, ContactPointPhone, ContactPointAddress } from '../types/party'
import type { HistoryEvent } from '../types/history'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:9600/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Party endpoints
export const partyApi = {
  getAll: () => api.get<Party[]>('/parties'),
  getById: (id: string) => api.get<Party>(`/parties/${id}`),
  create: (party: Partial<Party>) => api.post<Party>('/parties', party),
  update: (id: string, updates: Partial<Party>) => api.put<Party>(`/parties/${id}`, updates),
  delete: (id: string) => api.delete(`/parties/${id}`),
}

// Contact points endpoints
export const contactPointsApi = {
  getEmails: (partyId: string) => api.get<ContactPointEmail[]>(`/parties/${partyId}/contact-points/emails`),
  getPhones: (partyId: string) => api.get<ContactPointPhone[]>(`/parties/${partyId}/contact-points/phones`),
  getAddresses: (partyId: string) => api.get<ContactPointAddress[]>(`/parties/${partyId}/contact-points/addresses`),

  addEmail: (partyId: string, email: Partial<ContactPointEmail>) =>
    api.post<ContactPointEmail>(`/parties/${partyId}/contact-points/emails`, email),
  addPhone: (partyId: string, phone: Partial<ContactPointPhone>) =>
    api.post<ContactPointPhone>(`/parties/${partyId}/contact-points/phones`, phone),
  addAddress: (partyId: string, address: Partial<ContactPointAddress>) =>
    api.post<ContactPointAddress>(`/parties/${partyId}/contact-points/addresses`, address),

  updateEmail: (partyId: string, emailId: string, updates: Partial<ContactPointEmail>) =>
    api.put<ContactPointEmail>(`/parties/${partyId}/contact-points/emails/${emailId}`, updates),
  updatePhone: (partyId: string, phoneId: string, updates: Partial<ContactPointPhone>) =>
    api.put<ContactPointPhone>(`/parties/${partyId}/contact-points/phones/${phoneId}`, updates),
  updateAddress: (partyId: string, addressId: string, updates: Partial<ContactPointAddress>) =>
    api.put<ContactPointAddress>(`/parties/${partyId}/contact-points/addresses/${addressId}`, updates),

  deleteEmail: (partyId: string, emailId: string) =>
    api.delete(`/parties/${partyId}/contact-points/emails/${emailId}`),
  deletePhone: (partyId: string, phoneId: string) =>
    api.delete(`/parties/${partyId}/contact-points/phones/${phoneId}`),
  deleteAddress: (partyId: string, addressId: string) =>
    api.delete(`/parties/${partyId}/contact-points/addresses/${addressId}`),
}

// History/timeline endpoint
export const historyApi = {
  getHistory: (partyId: string, options?: { type?: string, limit?: number, offset?: number }) =>
    api.get<HistoryEvent[]>(`/parties/${partyId}/history`, { params: options }),
}

export default api
