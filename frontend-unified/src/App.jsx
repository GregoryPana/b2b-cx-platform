import React, { useState, useEffect } from 'react'
import { BarChart3, Users, Building2, Wrench, LogOut } from 'lucide-react'
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./auth";
import UnifiedDashboard from './components/UnifiedDashboard'
import B2BPlatform from './components/B2BPlatform'
import B2CPlatform from './components/B2CPlatform'
import InstallationPlatform from './components/InstallationPlatform'
import './index.css'

function App() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [error, setError] = useState(null);

  const [user, setUser] = useState({
    name: 'CX Manager',
    role: 'Manager',
    accessiblePrograms: ['B2B', 'B2C', 'INSTALL']
  })
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('unified')

  useEffect(() => {
    if (!isAuthenticated) return
    fetchPrograms()
  }, [isAuthenticated])

  // Authentication effect
  useEffect(() => {
    // Only redirect if we're not in the middle of processing a redirect
    if (!isAuthenticated && inProgress === "none") {
      // Add a small delay to ensure redirect processing is complete
      const timer = setTimeout(() => {
        const loginAttempts = parseInt(sessionStorage.getItem('msal_login_attempts') || '0');
        if (loginAttempts > 3) {
          console.error('Too many login attempts detected. Clearing cache and stopping redirects.');
          setError('Too many login attempts. Please refresh the page and try again.');
          sessionStorage.clear();
          localStorage.clear();
          return;
        }

        sessionStorage.setItem('msal_login_attempts', (loginAttempts + 1).toString());

        try {
          console.log('Starting login redirect attempt:', loginAttempts + 1);
          instance.loginRedirect(loginRequest);
        } catch (error) {
          console.error('Login redirect error:', error);
          setError(`Authentication redirect failed: ${error.message}`);
          sessionStorage.removeItem('msal_login_attempts');
        }
      }, 100); // Small delay to ensure redirect processing is complete

      return () => clearTimeout(timer);
    } else if (isAuthenticated) {
      // Clear login attempts on successful authentication
      sessionStorage.removeItem('msal_login_attempts');
    }
  }, [instance, inProgress, isAuthenticated]);

  // Set user info from MSAL account
  useEffect(() => {
    if (isAuthenticated) {
      const accounts = instance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        const idTokenClaims = account.idTokenClaims || {};
        const roles = idTokenClaims.roles || [];
        
        // Determine accessible programs based on roles
        const accessiblePrograms = [];
        if (roles.includes('CX_SUPER_ADMIN') || roles.includes('B2B_ADMIN') || roles.includes('B2B_SURVEYOR')) {
          accessiblePrograms.push('B2B');
        }
        if (roles.includes('CX_SUPER_ADMIN') || roles.includes('MYSTERY_ADMIN') || roles.includes('MYSTERY_SURVEYOR')) {
          accessiblePrograms.push('B2C'); // Mystery Shopper
        }
        if (roles.includes('CX_SUPER_ADMIN') || roles.includes('INSTALL_ADMIN') || roles.includes('INSTALL_SURVEYOR')) {
          accessiblePrograms.push('INSTALL');
        }
        
        // Determine role display
        let role = 'Representative';
        if (roles.includes('CX_SUPER_ADMIN')) {
          role = 'Super Admin';
        } else if (roles.some(r => r.includes('_ADMIN'))) {
          role = 'Manager';
        }
        
        setUser({
          name: account.name || account.username || 'User',
          role,
          accessiblePrograms
        });
      }
    }
  }, [isAuthenticated, instance]);

  const fetchPrograms = async () => {
    try {
      if (!isAuthenticated) {
        setLoading(false)
        return
      }
      const token = await instance.acquireTokenSilent(loginRequest);
      const response = await fetch('/api/core/programs', {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json()
      setPrograms(data)
    } catch (error) {
      console.error('Failed to fetch programs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await instance.logoutRedirect();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  const programConfig = {
    unified: {
      name: 'Unified Dashboard',
      icon: BarChart3,
      description: 'Cross-program analytics and insights'
    },
    b2b: {
      name: 'B2B CX Platform',
      icon: Building2,
      description: 'Business-to-Business Customer Experience'
    },
    b2c: {
      name: 'B2C CX Platform',
      icon: Users,
      description: 'Business-to-Consumer Customer Experience'
    },
    installation: {
      name: 'Installation Assessment',
      icon: Wrench,
      description: 'Installation Service Quality Assessment'
    }
  }

  const currentConfig = programConfig[currentView] || programConfig.unified

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-red-800 font-semibold mb-2">Authentication Error</h2>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
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
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="h-full flex flex-col">
          <div className="sidebar-head">
            <h2 className="sidebar-title">CX Assessment Platform</h2>
            <p className="sidebar-subtitle">Unified operations workspace</p>
          </div>

          <nav className="sidebar-nav" aria-label="Program navigation">
            {Object.entries(programConfig).map(([key, config]) => {
              const Icon = config.icon
              const isAccessible = key === 'unified' || user.accessiblePrograms.includes(key.toUpperCase())
              if (!isAccessible) return null

              return (
                <button
                  key={key}
                  onClick={() => setCurrentView(key)}
                  className={`nav-button ${currentView === key ? 'active' : ''}`}
                  title={config.description}
                >
                  <Icon className="h-4 w-4" />
                  <span>{config.name}</span>
                </button>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <p className="sidebar-user">{user.name}</p>
            <p className="sidebar-user">{user.role}</p>
            <button
              onClick={handleLogout}
              className="ui-btn"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <section className="app-main">
        <header className="topbar">
          <div>
            <h1>{currentConfig.name}</h1>
            <p>{currentConfig.description}</p>
          </div>
          <div className="text-sm text-[var(--muted)]">
            {programs.length} active programs
          </div>
        </header>

        <main className="content-scroll">
          {renderCurrentView()}
        </main>
      </section>
    </div>
  )
}

export default App
