import { useParty } from '../../hooks/useParty'
import {  User, Mail, Phone, Briefcase, MapPin, Calendar, Globe, Languages, Clock } from 'lucide-react'

interface ProfilePanelProps {
  partyId: string
}

interface ProfileFieldProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number | undefined | null
  placeholder?: string
}

function ProfileField({ icon: Icon, label, value, placeholder = 'Not set' }: ProfileFieldProps) {
  return (
    <div className="flex items-start space-x-3 p-3 hover:bg-purple-950/30 rounded-lg transition-colors">
      <Icon className="w-5 h-5 mt-0.5 text-purple-400" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-400">{label}</div>
        <div className="text-base text-white">
          {value || <span className="text-gray-500">{placeholder}</span>}
        </div>
      </div>
    </div>
  )
}

export default function ProfilePanel({ partyId }: ProfilePanelProps) {
  const { data: party, isLoading, error } = useParty(partyId)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-purple-900/20 rounded-lg"></div>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-purple-900/20 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Error loading profile: {error.message}
      </div>
    )
  }

  if (!party) {
    return <div className="p-6 text-gray-400">No profile data available</div>
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header with Avatar */}
      <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-900/40 to-pink-900/30 border border-purple-700/50 rounded-lg">
        <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-bold">
          {party.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{party.name}</h2>
          {party.displayName && party.displayName !== party.name && (
            <p className="text-gray-300">({party.displayName})</p>
          )}
          <div className="flex items-center space-x-2 mt-1">
            <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded">
              {party.partyType}
            </span>
            <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
              {party.role}
            </span>
            {party.isActive !== undefined && (
              <span className={`px-2 py-1 text-xs rounded ${
                party.isActive ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
              }`}>
                {party.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-purple-900/50 pb-2">
          Contact Information
        </h3>
        <ProfileField icon={Mail} label="Email" value={party.email} />
        <ProfileField icon={Phone} label="Phone" value={party.phone} />
        <ProfileField icon={User} label="Title" value={party.title} />
        <ProfileField icon={Briefcase} label="Department" value={party.department} />
      </div>

      {/* Preferences */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-purple-900/50 pb-2">
          Preferences
        </h3>
        <ProfileField
          icon={MapPin}
          label="Preferred Contact Method"
          value={party.preferredContactMethod}
        />
        <ProfileField icon={Globe} label="Timezone" value={party.timezone} />
        <ProfileField icon={Languages} label="Language" value={party.language} />
      </div>

      {/* Salesperson-Specific Fields */}
      {(party.role === 'salesperson' || party.role === 'manager' || party.role === 'executive') && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white border-b border-purple-900/50 pb-2">
            Sales Information
          </h3>
          {party.quota && (
            <ProfileField
              icon={Briefcase}
              label="Quota"
              value={`$${party.quota.toLocaleString()}`}
            />
          )}
          <ProfileField icon={MapPin} label="Territory" value={party.territory} />
          {party.startDate && (
            <ProfileField
              icon={Calendar}
              label="Start Date"
              value={new Date(party.startDate).toLocaleDateString()}
            />
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white border-b border-purple-900/50 pb-2">
          Metadata
        </h3>
        <ProfileField
          icon={Calendar}
          label="Created"
          value={new Date(party.createdAt).toLocaleString()}
        />
        {party.updatedAt && (
          <ProfileField
            icon={Clock}
            label="Last Updated"
            value={new Date(party.updatedAt).toLocaleString()}
          />
        )}
        {party.lastContactedAt && (
          <ProfileField
            icon={Calendar}
            label="Last Contacted"
            value={new Date(party.lastContactedAt).toLocaleString()}
          />
        )}
        <ProfileField icon={User} label="Owner" value={party.owner} />
        <ProfileField icon={MapPin} label="Source" value={party.source} />
        {party.tags && party.tags.length > 0 && (
          <div className="p-3 hover:bg-purple-950/30 rounded-lg transition-colors">
            <div className="text-sm text-gray-400 mb-2">Tags</div>
            <div className="flex flex-wrap gap-2">
              {party.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-sm bg-purple-900/50 text-purple-200 rounded border border-purple-700/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
