import React, { useState, useEffect } from 'react'
import { Building2, Users, Calendar, TrendingUp, Plus, Edit, Trash2, Eye } from 'lucide-react'

const B2BPlatform = () => {
  const [data, setData] = useState({
    businesses: [],
    accountExecutives: [],
    visits: [],
    analytics: {
      totalBusinesses: 0,
      totalVisits: 0,
      avgNPS: 0,
      completionRate: 0
    }
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchB2BData()
  }, [])

  const fetchB2BData = async () => {
    try {
      const [businessesRes, aesRes, visitsRes] = await Promise.all([
        fetch('/api/b2b/businesses'),
        fetch('/api/b2b/account-executives'),
        fetch('/api/b2b/visits')
      ])

      const businesses = await businessesRes.json()
      const accountExecutives = await aesRes.json()
      const visits = await visitsRes.json()

      setData({
        businesses,
        accountExecutives,
        visits,
        analytics: {
          totalBusinesses: businesses.length,
          totalVisits: visits.length,
          avgNPS: 7.2,
          completionRate: 94
        }
      })
    } catch (error) {
      console.error('Failed to fetch B2B data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">B2B CX Platform</h2>
        <p className="text-gray-600">Business-to-Business Customer Experience Management</p>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Businesses</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.totalBusinesses}</p>
            </div>
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Account Executives</p>
              <p className="text-2xl font-bold text-gray-900">{data.accountExecutives.length}</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Visits</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.totalVisits}</p>
            </div>
            <Calendar className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg NPS Score</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.avgNPS}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <nav className="ui-tablist" aria-label="B2B sections">
          {['overview', 'businesses', 'account-executives', 'visits'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`ui-tab ${activeTab === tab ? 'active' : ''}`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Businesses</h3>
              <div className="space-y-3">
                {data.businesses.slice(0, 5).map((business) => (
                  <div key={business.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{business.name}</p>
                      <p className="text-sm text-gray-600">{business.location}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(business.priority_level)}`}>
                      {business.priority_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Visits</h3>
              <div className="space-y-3">
                {data.visits.slice(0, 5).map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{visit.visit_type}</p>
                      <p className="text-sm text-gray-600">{visit.visit_date}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(visit.status)}`}>
                      {visit.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'businesses' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Businesses</h3>
              <button className="ui-btn primary flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Business</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.businesses.map((business) => (
                    <tr key={business.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{business.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{business.location}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(business.priority_level)}`}>
                          {business.priority_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${business.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {business.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="icon-button" title="View business">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="icon-button" title="Edit business">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="icon-button danger" title="Delete business">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'account-executives' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Account Executives</h3>
              <button className="ui-btn primary flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add AE</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.accountExecutives.map((ae) => (
                    <tr key={ae.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{ae.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{ae.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{ae.phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${ae.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {ae.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="icon-button" title="View account executive">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="icon-button" title="Edit account executive">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="icon-button danger" title="Delete account executive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Visits</h3>
              <button className="ui-btn primary flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Schedule Visit</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visit Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.visits.map((visit) => (
                    <tr key={visit.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {data.businesses.find(b => b.id === visit.business_id)?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{visit.visit_type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{visit.visit_date}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(visit.status)}`}>
                          {visit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="icon-button" title="View visit">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="icon-button" title="Edit visit">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="icon-button danger" title="Delete visit">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default B2BPlatform
