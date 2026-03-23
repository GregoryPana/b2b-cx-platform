import React, { useState, useEffect } from 'react'
import { Wrench, Users, Calendar, CheckCircle, AlertCircle, Clock, TrendingUp, Plus, Filter } from 'lucide-react'

const InstallationPlatform = () => {
  const [data, setData] = useState({
    serviceCalls: [],
    technicians: [],
    qualityScores: [],
    analytics: {
      totalCalls: 89,
      avgQualityScore: 6.8,
      completionRate: 92,
      customerSatisfaction: 7.9
    }
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchInstallationData()
  }, [])

  const fetchInstallationData = async () => {
    try {
      // Mock Installation data for demonstration
      const mockData = {
        serviceCalls: [
          { id: 1, customer: 'Acme Corp', technician: 'Mike Davis', date: '2024-02-25', status: 'completed', qualityScore: 8, type: 'Installation' },
          { id: 2, customer: 'Global Industries', technician: 'Sarah Chen', date: '2024-02-24', status: 'in-progress', qualityScore: null, type: 'Maintenance' },
          { id: 3, customer: 'Tech Solutions', technician: 'John Smith', date: '2024-02-23', status: 'scheduled', qualityScore: null, type: 'Repair' },
          { id: 4, customer: 'Innovation Labs', technician: 'Mike Davis', date: '2024-02-22', status: 'completed', qualityScore: 7, type: 'Installation' },
          { id: 5, customer: 'Enterprise Systems', technician: 'Sarah Chen', date: '2024-02-21', status: 'completed', qualityScore: 9, type: 'Installation' }
        ],
        technicians: [
          { id: 1, name: 'Mike Davis', email: 'mike@company.com', phone: '+1-555-0101', speciality: 'Installation', activeCalls: 3, completedCalls: 45, avgRating: 8.2 },
          { id: 2, name: 'Sarah Chen', email: 'sarah@company.com', phone: '+1-555-0102', speciality: 'Maintenance', activeCalls: 2, completedCalls: 38, avgRating: 8.7 },
          { id: 3, name: 'John Smith', email: 'john@company.com', phone: '+1-555-0103', speciality: 'Repair', activeCalls: 4, completedCalls: 52, avgRating: 7.9 }
        ],
        qualityScores: [
          { month: 'Jan', avgScore: 6.5, completionRate: 89 },
          { month: 'Feb', avgScore: 6.8, completionRate: 92 },
          { month: 'Mar', avgScore: 7.1, completionRate: 94 }
        ]
      }
      
      setData(mockData)
    } catch (error) {
      console.error('Failed to fetch Installation data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'scheduled': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'in-progress': return <Clock className="h-4 w-4" />
      case 'scheduled': return <Calendar className="h-4 w-4" />
      case 'cancelled': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getQualityColor = (score) => {
    if (score >= 8) return 'text-green-600'
    if (score >= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSpecialityColor = (speciality) => {
    switch (speciality) {
      case 'Installation': return 'bg-blue-100 text-blue-800'
      case 'Maintenance': return 'bg-green-100 text-green-800'
      case 'Repair': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Installation Assessment Platform</h2>
        <p className="text-gray-600">Installation Service Quality Management</p>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Service Calls</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.totalCalls}</p>
            </div>
            <Wrench className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Quality Score</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.avgQualityScore}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.completionRate}%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Customer Satisfaction</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.customerSatisfaction}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <nav className="ui-tablist" aria-label="Installation sections">
          {['overview', 'service-calls', 'technicians', 'quality'].map((tab) => (
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Service Calls</h3>
              <div className="space-y-3">
                {data.serviceCalls.slice(0, 5).map((call) => (
                  <div key={call.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{call.customer}</p>
                      <p className="text-sm text-gray-600">{call.technician} • {call.date}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(call.status)}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                          {call.status}
                        </span>
                      </div>
                      {call.qualityScore && (
                        <p className={`text-sm font-medium mt-1 ${getQualityColor(call.qualityScore)}`}>
                          Score: {call.qualityScore}/10
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Technician Performance</h3>
              <div className="space-y-3">
                {data.technicians.slice(0, 5).map((tech) => (
                  <div key={tech.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{tech.name}</p>
                      <p className="text-sm text-gray-600">{tech.speciality} • {tech.completedCalls} completed</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSpecialityColor(tech.speciality)}`}>
                        {tech.speciality}
                      </span>
                      <p className="text-sm font-medium mt-1">Rating: {tech.avgRating}/10</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'service-calls' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Service Calls</h3>
              <div className="flex space-x-2">
                <button className="ui-btn flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                </button>
                <button className="ui-btn primary flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Schedule Call</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Technician
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quality Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.serviceCalls.map((call) => (
                    <tr key={call.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{call.customer}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{call.technician}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {call.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {call.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(call.status)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                            {call.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {call.qualityScore ? (
                          <span className={`text-sm font-medium ${getQualityColor(call.qualityScore)}`}>
                            {call.qualityScore}/10
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'technicians' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Technicians</h3>
              <div className="flex space-x-2">
                <button className="ui-btn flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                </button>
                <button className="ui-btn primary flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Technician</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Technician
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Speciality
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active Calls
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed Calls
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.technicians.map((tech) => (
                    <tr key={tech.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{tech.name}</div>
                          <div className="text-sm text-gray-500">{tech.email}</div>
                          <div className="text-sm text-gray-500">{tech.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSpecialityColor(tech.speciality)}`}>
                          {tech.speciality}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{tech.activeCalls}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{tech.completedCalls}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getQualityColor(tech.avgRating)}`}>
                          {tech.avgRating}/10
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Trends</h3>
              <div className="space-y-4">
                {data.qualityScores.map((score, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{score.month}</p>
                      <p className="text-sm text-gray-600">Average Score</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getQualityColor(score.avgScore)}`}>
                        {score.avgScore}/10
                      </p>
                      <p className="text-sm text-gray-600">
                        Completion: {score.completionRate}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality Metrics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-gray-900">Current Month Score</p>
                    <p className="text-sm text-gray-600">Average quality rating</p>
                  </div>
                  <p className={`text-lg font-bold ${getQualityColor(data.analytics.avgQualityScore)}`}>
                    {data.analytics.avgQualityScore}/10
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-gray-900">Completion Rate</p>
                    <p className="text-sm text-gray-600">Service calls completed</p>
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    {data.analytics.completionRate}%
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-gray-900">Customer Satisfaction</p>
                    <p className="text-sm text-gray-600">Post-service satisfaction</p>
                  </div>
                  <p className={`text-lg font-bold ${getQualityColor(data.analytics.customerSatisfaction)}`}>
                    {data.analytics.customerSatisfaction}/10
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InstallationPlatform
