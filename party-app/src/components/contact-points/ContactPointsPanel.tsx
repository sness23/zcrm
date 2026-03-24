import { Mail, Phone, MapPin, Star } from 'lucide-react'
import { useContactPointEmails, useContactPointPhones, useContactPointAddresses } from '../../hooks/useContactPoints'
import type { ContactPointEmail, ContactPointPhone, ContactPointAddress } from '../../types/party'

interface ContactPointsPanelProps {
  partyId: string
}

function EmailItem({ email }: { email: ContactPointEmail }) {
  return (
    <div className="flex items-start space-x-3 p-3 bg-purple-950/30 border border-purple-900/50 rounded-lg hover:bg-purple-950/40 transition-colors">
      <Mail className="w-5 h-5 mt-0.5 text-purple-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-base text-white font-medium">{email.email}</span>
          {email.isPrimary && (
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          )}
        </div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-sm text-gray-400">{email.type}</span>
          {email.verified && (
            <span className="px-2 py-0.5 text-xs bg-green-900/50 text-green-300 rounded border border-green-700/50">
              Verified
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function PhoneItem({ phone }: { phone: ContactPointPhone }) {
  return (
    <div className="flex items-start space-x-3 p-3 bg-purple-950/30 border border-purple-900/50 rounded-lg hover:bg-purple-950/40 transition-colors">
      <Phone className="w-5 h-5 mt-0.5 text-blue-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-base text-white font-medium">
            {phone.number}
            {phone.extension && <span className="text-gray-400"> ext. {phone.extension}</span>}
          </span>
          {phone.isPrimary && (
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          )}
        </div>
        <span className="text-sm text-gray-400">{phone.type}</span>
      </div>
    </div>
  )
}

function AddressItem({ address }: { address: ContactPointAddress }) {
  return (
    <div className="flex items-start space-x-3 p-3 bg-purple-950/30 border border-purple-900/50 rounded-lg hover:bg-purple-950/40 transition-colors">
      <MapPin className="w-5 h-5 mt-0.5 text-green-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-sm font-medium text-purple-300">{address.type}</span>
          {address.isPrimary && (
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          )}
        </div>
        <div className="text-base text-white">
          <div>{address.street}</div>
          <div>
            {address.city}, {address.state} {address.postalCode}
          </div>
          <div>{address.country}</div>
        </div>
      </div>
    </div>
  )
}

export default function ContactPointsPanel({ partyId }: ContactPointsPanelProps) {
  const { data: emails, isLoading: emailsLoading } = useContactPointEmails(partyId)
  const { data: phones, isLoading: phonesLoading } = useContactPointPhones(partyId)
  const { data: addresses, isLoading: addressesLoading } = useContactPointAddresses(partyId)

  const isLoading = emailsLoading || phonesLoading || addressesLoading

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-purple-900/20 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Emails Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Mail className="w-5 h-5 text-purple-400" />
            <span>Email Addresses</span>
          </h3>
          <span className="text-sm text-gray-400">
            {emails?.length || 0} email{emails?.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-2">
          {emails && emails.length > 0 ? (
            emails.map(email => <EmailItem key={email.id} email={email} />)
          ) : (
            <div className="p-4 text-center text-gray-400 bg-purple-950/20 border border-purple-900/30 rounded-lg">
              No email addresses on file
            </div>
          )}
        </div>
      </div>

      {/* Phones Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Phone className="w-5 h-5 text-blue-400" />
            <span>Phone Numbers</span>
          </h3>
          <span className="text-sm text-gray-400">
            {phones?.length || 0} phone{phones?.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="space-y-2">
          {phones && phones.length > 0 ? (
            phones.map(phone => <PhoneItem key={phone.id} phone={phone} />)
          ) : (
            <div className="p-4 text-center text-gray-400 bg-purple-950/20 border border-purple-900/30 rounded-lg">
              No phone numbers on file
            </div>
          )}
        </div>
      </div>

      {/* Addresses Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-green-400" />
            <span>Addresses</span>
          </h3>
          <span className="text-sm text-gray-400">
            {addresses?.length || 0} address{addresses?.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <div className="space-y-2">
          {addresses && addresses.length > 0 ? (
            addresses.map(address => <AddressItem key={address.id} address={address} />)
          ) : (
            <div className="p-4 text-center text-gray-400 bg-purple-950/20 border border-purple-900/30 rounded-lg">
              No addresses on file
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
