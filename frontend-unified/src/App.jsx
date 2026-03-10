import React, { useState, useEffect } from 'react'
import { BarChart3, Users, Building2, Wrench, TrendingUp, Settings, LogOut } from 'lucide-react'
import UnifiedDashboard from './components/UnifiedDashboard'
import B2BPlatform from './components/B2BPlatform'
import B2CPlatform from './components/B2CPlatform'
import InstallationPlatform from './components/InstallationPlatform'
import './App.css'
import './index.css'

function App() {
  const [user, setUser] = useState({
    name: 'CX Manager',
    role: 'Manager',
    accessiblePrograms: ['B2B', 'B2C', 'INSTALL']
  })
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('unified')

  useEffect(() => {
    fetchPrograms()
  }, [])

  const fetchPrograms = async () => {
    try {
      const response = await fetch('/api/core/programs')
      const data = await response.json()
      setPrograms(data)
    } catch (error) {
      console.error('Failed to fetch programs:', error)
    } finally {
      setLoading(false)
    }
  }

  const programConfig = {
    unified: {
      name: 'Unified Dashboard',
      icon: BarChart3,
      color: 'purple',
      description: 'Cross-program analytics and insights'
    },
    b2b: {
      name: 'B2B CX Platform',
      icon: Building2,
      color: 'blue',
      description: 'Business-to-Business Customer Experience'
    },
    b2c: {
      name: 'B2C CX Platform',
      icon: Users,
      color: 'green',
      description: 'Business-to-Consumer Customer Experience'
    },
    installation: {
      name: 'Installation Assessment',
      icon: Wrench,
      color: 'orange',
      description: 'Installation Service Quality Assessment'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading CX Platform...</p>
        </div>
      </div>
    )
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'unified':
        return <UnifiedDashboard />
      case 'b2b':
        return <B2BPlatform />
      case 'b2c':
        return <B2CPlatform />
      case 'installation':
        return <InstallationPlatform />
      default:
        return <UnifiedDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">CX Assessment Platform</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.name} ({user.role})
              </span>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Settings className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Program Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 py-4">
            {Object.entries(programConfig).map(([key, config]) => {
              const Icon = config.icon
              const isAccessible = key === 'unified' || user.accessiblePrograms.includes(key.toUpperCase())
              
              if (!isAccessible) return null
              
              return (
                <button
                  key={key}
                  onClick={() => setCurrentView(key)}
                  className={`nav-button flex items-center space-x-2 ${
                    currentView === key ? 'active' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{config.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderCurrentView()}
      </main>
    </div>
  )
}

export default App
