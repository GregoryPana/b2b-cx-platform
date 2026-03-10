import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { TrendingUp, Users, Building2, Wrench, Activity, DollarSign, Star, ArrowUp } from 'lucide-react'

const UnifiedDashboard = () => {
  const [data, setData] = useState({
    programs: [],
    crossProgramMetrics: [],
    npsTrends: [],
    customerJourney: [],
    performanceMetrics: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUnifiedData()
  }, [])

  const fetchUnifiedData = async () => {
    try {
      // Fetch programs
      const programsResponse = await fetch('/api/core/programs')
      const programs = await programsResponse.json()
      
      // Fetch B2B data
      const b2bResponse = await fetch('/api/b2b/businesses')
      const b2bBusinesses = await b2bResponse.json()
      
      const b2bAEResponse = await fetch('/api/b2b/account-executives')
      const b2bAEs = await b2bAEResponse.json()
      
      // Mock data for demonstration
      const mockData = {
        programs: programs,
        crossProgramMetrics: [
          { program: 'B2B', customers: 45, nps: 7.2, satisfaction: 8.1, revenue: '$2.5M' },
          { program: 'B2C', customers: 1247, nps: 8.1, satisfaction: 8.7, revenue: '$1.8M' },
          { program: 'Installation', customers: 89, nps: 6.8, satisfaction: 7.9, revenue: '$3.2M' }
        ],
        npsTrends: [
          { month: 'Jan', B2B: 6.8, B2C: 7.9, Installation: 6.2 },
          { month: 'Feb', B2B: 7.0, B2C: 8.0, Installation: 6.5 },
          { month: 'Mar', B2B: 7.2, B2C: 8.1, Installation: 6.8 }
        ],
        customerJourney: [
          { stage: 'Awareness', B2B: 85, B2C: 92, Installation: 78 },
          { stage: 'Consideration', B2B: 72, B2C: 88, Installation: 71 },
          { stage: 'Purchase', B2B: 68, B2C: 79, Installation: 85 },
          { stage: 'Service', B2B: 81, B2C: 86, Installation: 82 },
          { stage: 'Loyalty', B2B: 74, B2C: 83, Installation: 76 }
        ],
        performanceMetrics: [
          { metric: 'Response Rate', B2B: 94, B2C: 78, target: 85 },
          { metric: 'Completion Rate', B2B: 89, B2C: 82, target: 85 },
          { metric: 'Quality Score', B2B: 92, B2C: 88, target: 90 },
          { metric: 'Retention', B2B: 87, B2C: 91, target: 85 }
        ]
      }
      
      setData(mockData)
    } catch (error) {
      console.error('Failed to fetch unified data:', error)
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

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Unified CX Dashboard</h2>
        <p className="text-gray-600">Cross-program insights and analytics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900">1,381</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                +12% from last month
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average NPS</p>
              <p className="text-2xl font-bold text-gray-900">7.4</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                +0.3 from last month
              </p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">$7.5M</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUp className="h-3 w-3 mr-1" />
                +8% from last month
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Programs</p>
              <p className="text-2xl font-bold text-gray-900">{data.programs.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                All programs operational
              </p>
            </div>
            <Activity className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Program Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.crossProgramMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="program" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="nps" fill="#3B82F6" name="NPS Score" />
              <Bar dataKey="satisfaction" fill="#10B981" name="Satisfaction" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.crossProgramMetrics}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ program, customers }) => `${program}: ${customers}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="customers"
              >
                {data.crossProgramMetrics.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NPS Trends */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">NPS Trends Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.npsTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="B2B" stroke="#3B82F6" strokeWidth={2} />
            <Line type="monotone" dataKey="B2C" stroke="#10B981" strokeWidth={2} />
            <Line type="monotone" dataKey="Installation" stroke="#F59E0B" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance vs Targets</h3>
        <div className="space-y-4">
          {data.performanceMetrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{metric.metric}</span>
                  <span className="text-sm text-gray-500">Target: {metric.target}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${metric.B2B}%` }}
                    ></div>
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${metric.B2C}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="ml-4 text-right">
                <div className="text-sm text-gray-600">B2B: {metric.B2B}%</div>
                <div className="text-sm text-gray-600">B2C: {metric.B2C}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="program-card">
          <div className="flex items-center space-x-3">
            <Building2 className="h-8 w-8 text-blue-500" />
            <div>
              <h4 className="font-semibold text-gray-900">B2B Platform</h4>
              <p className="text-sm text-gray-600">45 businesses, 3 AEs</p>
            </div>
          </div>
        </div>

        <div className="program-card">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <h4 className="font-semibold text-gray-900">B2C Platform</h4>
              <p className="text-sm text-gray-600">1,247 customers</p>
            </div>
          </div>
        </div>

        <div className="program-card">
          <div className="flex items-center space-x-3">
            <Wrench className="h-8 w-8 text-orange-500" />
            <div>
              <h4 className="font-semibold text-gray-900">Installation</h4>
              <p className="text-sm text-gray-600">89 service calls</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnifiedDashboard
