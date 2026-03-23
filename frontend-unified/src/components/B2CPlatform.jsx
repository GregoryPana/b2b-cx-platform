import React, { useState, useEffect } from 'react'
import { Users, MessageSquare, Star, TrendingUp, Plus, Send, Filter, Download } from 'lucide-react'

const B2CPlatform = () => {
  const [data, setData] = useState({
    customers: [],
    surveys: [],
    feedback: [],
    analytics: {
      totalCustomers: 1247,
      responseRate: 78,
      avgNPS: 8.1,
      satisfaction: 8.7
    }
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchB2CData()
  }, [])

  const fetchB2CData = async () => {
    try {
      // Mock B2C data for demonstration
      const mockData = {
        customers: [
          { id: 1, name: 'John Doe', email: 'john@example.com', segment: 'Premium', joinDate: '2024-01-15', lastPurchase: '2024-02-20', nps: 9 },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com', segment: 'Standard', joinDate: '2023-12-01', lastPurchase: '2024-02-18', nps: 8 },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com', segment: 'Premium', joinDate: '2024-01-20', lastPurchase: '2024-02-22', nps: 7 },
          { id: 4, name: 'Alice Brown', email: 'alice@example.com', segment: 'Basic', joinDate: '2023-11-15', lastPurchase: '2024-02-10', nps: 10 },
          { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', segment: 'Standard', joinDate: '2024-02-01', lastPurchase: '2024-02-25', nps: 8 }
        ],
        surveys: [
          { id: 1, name: 'Customer Satisfaction Survey', type: 'NPS', responses: 892, sentDate: '2024-02-01', status: 'active' },
          { id: 2, name: 'Product Feedback Survey', type: 'CSAT', responses: 654, sentDate: '2024-02-10', status: 'active' },
          { id: 3, name: 'Service Quality Survey', type: 'CES', responses: 423, sentDate: '2024-02-15', status: 'completed' }
        ],
        feedback: [
          { id: 1, customer: 'John Doe', rating: 5, comment: 'Excellent service! Very satisfied with the product quality.', date: '2024-02-25', category: 'Product' },
          { id: 2, customer: 'Jane Smith', rating: 4, comment: 'Good experience, but delivery could be faster.', date: '2024-02-24', category: 'Service' },
          { id: 3, customer: 'Bob Johnson', rating: 3, comment: 'Average experience. Room for improvement.', date: '2024-02-23', category: 'Service' }
        ]
      }
      
      setData(mockData)
    } catch (error) {
      console.error('Failed to fetch B2C data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  const getSegmentColor = (segment) => {
    switch (segment) {
      case 'Premium': return 'bg-purple-100 text-purple-800'
      case 'Standard': return 'bg-blue-100 text-blue-800'
      case 'Basic': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ))
  }

  const getSurveyStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">B2C CX Platform</h2>
        <p className="text-gray-600">Business-to-Consumer Customer Experience Management</p>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.totalCustomers.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Response Rate</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.responseRate}%</p>
            </div>
            <MessageSquare className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average NPS</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.avgNPS}</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Satisfaction</p>
              <p className="text-2xl font-bold text-gray-900">{data.analytics.satisfaction}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <nav className="ui-tablist" aria-label="B2C sections">
          {['overview', 'customers', 'surveys', 'feedback'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`ui-tab ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Customers</h3>
              <div className="space-y-3">
                {data.customers.slice(0, 5).map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSegmentColor(customer.segment)}`}>
                        {customer.segment}
                      </span>
                      <div className="flex mt-1">{getRatingStars(customer.nps)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Surveys</h3>
              <div className="space-y-3">
                {data.surveys.filter(s => s.status === 'active').map((survey) => (
                  <div key={survey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900">{survey.name}</p>
                      <p className="text-sm text-gray-600">{survey.responses} responses</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSurveyStatusColor(survey.status)}`}>
                      {survey.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Customers</h3>
              <div className="flex space-x-2">
                <button className="ui-btn flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                </button>
                <button className="ui-btn primary flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Customer</span>
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
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Join Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Purchase
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NPS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSegmentColor(customer.segment)}`}>
                          {customer.segment}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.joinDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.lastPurchase}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex">{getRatingStars(customer.nps)}</div>
                          <span className="ml-2 text-sm text-gray-600">{customer.nps}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'surveys' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Surveys</h3>
              <div className="flex space-x-2">
                <button className="ui-btn flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <button className="ui-btn primary flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Survey</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Survey Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Responses
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sent Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.surveys.map((survey) => (
                    <tr key={survey.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{survey.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {survey.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{survey.responses}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {survey.sentDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSurveyStatusColor(survey.status)}`}>
                          {survey.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="surface-card">
            <div className="section-toolbar px-1 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Customer Feedback</h3>
              <div className="flex space-x-2">
                <button className="ui-btn flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                </button>
                <button className="ui-btn primary flex items-center space-x-2">
                  <Send className="h-4 w-4" />
                  <span>Request Feedback</span>
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {data.feedback.map((item) => (
                <div key={item.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-sm font-medium text-gray-900">{item.customer}</h4>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {item.category}
                        </span>
                        <span className="text-sm text-gray-500">{item.date}</span>
                      </div>
                      <div className="flex items-center mb-2">{getRatingStars(item.rating)}</div>
                      <p className="text-sm text-gray-600">{item.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default B2CPlatform
