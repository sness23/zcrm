import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import doibioLogo from '../assets/doibio.png'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name)
        if (error) throw error
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#000040] via-purple-900 to-violet-900 p-5">
      <div className="bg-[#0a0050] border border-[#2a0070] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="text-center p-10 bg-gradient-to-b from-[#1a0060] to-[#0a0040] border-b border-[#2a0070]">
          <img src={doibioLogo} alt="WWW Logo" className="h-20 w-20 rounded-full mx-auto mb-5 shadow-lg" />
          <h1 className="text-3xl font-semibold text-gray-200 mb-2">WWW</h1>
          <p className="text-sm text-gray-400">{isSignUp ? 'Create your account' : 'Sign in to your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-10">
          {error && <div className="p-3 mb-5 bg-red-500/10 border border-red-500 rounded text-red-400 text-sm">{error}</div>}

          {isSignUp && (
            <div className="mb-5">
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                disabled={loading}
                className="w-full p-3 text-sm text-gray-200 bg-[#000040] border border-[#2a0070] rounded outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 disabled:opacity-60 disabled:cursor-not-allowed placeholder-gray-600"
              />
            </div>
          )}

          <div className="mb-5">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              className="w-full p-3 text-sm text-gray-200 bg-[#000040] border border-[#2a0070] rounded outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 disabled:opacity-60 disabled:cursor-not-allowed placeholder-gray-600"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              className="w-full p-3 text-sm text-gray-200 bg-[#000040] border border-[#2a0070] rounded outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 disabled:opacity-60 disabled:cursor-not-allowed placeholder-gray-600"
            />
          </div>

          <button
            type="submit"
            className="w-full p-3.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 rounded hover:from-purple-700 hover:to-violet-700 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none mb-4"
            disabled={loading}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>

          <button
            type="button"
            className="w-full p-3 text-sm text-gray-400 bg-transparent border border-[#2a0070] rounded hover:text-gray-200 hover:border-[#4a1a70] hover:bg-purple-600/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            disabled={loading}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  )
}
