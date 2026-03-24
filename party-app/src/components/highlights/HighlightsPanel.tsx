import { useParty } from '../../hooks/useParty'
import { User, Mail, Phone, Briefcase, Calendar, Tag } from 'lucide-react'

interface HighlightsPanelProps {
  partyId: string
}

export default function HighlightsPanel({ partyId }: HighlightsPanelProps) {
  const { data: party, isLoading, error } = useParty(partyId)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-purple-900/20 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        Error loading party highlights: {error.message}
      </div>
    )
  }

  if (!party) {
    return <div className="p-6 text-gray-400">No party data available</div>
  }

  const highlights = [
    {
      icon: User,
      label: 'Type',
      value: party.partyType,
      color: 'text-blue-400'
    },
    {
      icon: Briefcase,
      label: 'Role',
      value: party.role,
      color: 'text-green-400'
    },
    {
      icon: Mail,
      label: 'Email',
      value: party.email || 'Not set',
      color: 'text-purple-400'
    },
    {
      icon: Phone,
      label: 'Phone',
      value: party.phone || 'Not set',
      color: 'text-orange-400'
    },
    {
      icon: Calendar,
      label: 'Last Contacted',
      value: party.lastContactedAt
        ? new Date(party.lastContactedAt).toLocaleDateString()
        : 'Never',
      color: 'text-pink-400'
    },
    {
      icon: Tag,
      label: 'Tags',
      value: party.tags?.length ? party.tags.join(', ') : 'None',
      color: 'text-cyan-400'
    },
  ]

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-xl font-semibold text-white mb-4">
        Highlights
      </h3>

      <div className="space-y-3">
        {highlights.map((item, index) => {
          const Icon = item.icon
          return (
            <div
              key={index}
              className="flex items-start space-x-3 p-4 bg-purple-950/30 border border-purple-900/50 rounded-lg hover:bg-purple-950/40 transition-colors"
            >
              <Icon className={`w-5 h-5 mt-0.5 ${item.color}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-400">{item.label}</div>
                <div className="text-base text-white font-medium truncate">
                  {item.value}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-700/50 rounded-lg">
        <h4 className="text-sm font-semibold text-purple-300 mb-3">Quick Stats</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-xs text-gray-400">Opportunities</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-xs text-gray-400">Cases</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">0</div>
            <div className="text-xs text-gray-400">Activities</div>
          </div>
        </div>
      </div>
    </div>
  )
}
