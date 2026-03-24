import { useAuth } from '../contexts/LocalAuthContext';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#000040]">
      <div className="bg-gradient-to-br from-[#000040] via-[#1a0040] to-purple-700 text-white p-5 flex items-center gap-5 shadow-md">
        <button
          className="bg-purple-600/20 border border-purple-600/30 rounded px-4 py-2 text-sm cursor-pointer transition-all flex items-center gap-1.5 hover:bg-purple-600/30 hover:border-purple-600/50 hover:-translate-x-0.5"
          onClick={onBack}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold m-0">Settings</h1>
      </div>

      <div className="flex-1 p-8 max-w-4xl w-full mx-auto">
        <section className="bg-[#0a0050] border border-[#2a0070] rounded-lg mb-6 overflow-hidden shadow-md">
          <h2 className="text-base font-semibold text-gray-200 p-4 m-0 bg-gradient-to-b from-[#1a0060] to-[#0a0040] border-b border-[#2a0070]">
            Account Information
          </h2>
          <div className="p-0">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-[#2a0070]">
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Email
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">{user?.email}</td>
                </tr>
                <tr className="border-b border-[#2a0070]">
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Name
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">
                    {user?.name || 'Not set'}
                  </td>
                </tr>
                <tr className="border-b border-[#2a0070]">
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    User ID
                  </td>
                  <td className="p-4 text-xs text-gray-500 align-top font-mono break-all">
                    {user?.id}
                  </td>
                </tr>
                <tr>
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Account Created
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Unknown'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-[#0a0050] border border-[#2a0070] rounded-lg mb-6 overflow-hidden shadow-md">
          <h2 className="text-base font-semibold text-gray-200 p-4 m-0 bg-gradient-to-b from-[#1a0060] to-[#0a0040] border-b border-[#2a0070]">
            Preferences
          </h2>
          <div className="p-0">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-[#2a0070]">
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Theme
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">
                    <select
                      className="w-full max-w-xs p-2 text-sm text-gray-200 bg-[#000040] border border-[#2a0070] rounded outline-none cursor-pointer transition-all hover:border-purple-700 focus:border-purple-700 focus:ring-2 focus:ring-purple-700/20"
                      defaultValue="dark"
                    >
                      <option value="dark">Dark (Current)</option>
                      <option value="light" disabled>
                        Light (Coming Soon)
                      </option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Auto-save
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">
                    <select
                      className="w-full max-w-xs p-2 text-sm text-gray-200 bg-[#000040] border border-[#2a0070] rounded outline-none cursor-pointer transition-all hover:border-purple-700 focus:border-purple-700 focus:ring-2 focus:ring-purple-700/20"
                      defaultValue="enabled"
                    >
                      <option value="enabled">Enabled</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-[#0a0050] border border-[#2a0070] rounded-lg mb-6 overflow-hidden shadow-md">
          <h2 className="text-base font-semibold text-gray-200 p-4 m-0 bg-gradient-to-b from-[#1a0060] to-[#0a0040] border-b border-[#2a0070]">
            About
          </h2>
          <div className="p-0">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-[#2a0070]">
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Version
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">1.0.0</td>
                </tr>
                <tr className="border-b border-[#2a0070]">
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    Environment
                  </td>
                  <td className="p-4 text-sm text-gray-300 align-top">Development</td>
                </tr>
                <tr>
                  <td className="p-4 text-sm font-semibold text-gray-400 w-48 bg-[#0a0040] align-top">
                    API Endpoint
                  </td>
                  <td className="p-4 text-xs text-gray-500 align-top font-mono">
                    http://localhost:9600
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
