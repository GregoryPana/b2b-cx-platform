import React, { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [programs, setPrograms] = useState([])
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch programs
      const programsResponse = await axios.get('/api/core/programs')
      setPrograms(programsResponse.data)
      
      // Fetch businesses
      const businessesResponse = await axios.get('/api/b2b/businesses')
      setBusinesses(businessesResponse.data)
      
      setError(null)
    } catch (err) {
      setError('Failed to fetch data. Backend may be starting up...')
      console.error('API Error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <h1>🚀 CX Assessment Platform</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 CX Assessment Platform</h1>
      <p>Unified Customer Experience Assessment System</p>
      
      {error && (
        <div style={{ 
          backgroundColor: '#ffebee', 
          padding: '10px', 
          borderRadius: '4px', 
          margin: '10px 0' 
        }}>
          <strong>⚠️ {error}</strong>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h2>📊 Available Programs</h2>
          {programs.length > 0 ? (
            <ul>
              {programs.map(program => (
                <li key={program.id}>
                  <strong>{program.name}</strong> ({program.code})
                  <br />
                  <small>{program.description}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No programs loaded</p>
          )}
        </div>
        
        <div>
          <h2>🏢 B2B Businesses</h2>
          {businesses.length > 0 ? (
            <ul>
              {businesses.map(business => (
                <li key={business.id}>
                  <strong>{business.name}</strong>
                  <br />
                  <small>{business.location} - Priority: {business.priority_level}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No businesses loaded</p>
          )}
        </div>
      </div>
      
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3>🌐 Network Access</h3>
        <p>This platform is accessible on your local network!</p>
        <ul>
          <li><strong>Backend API:</strong> <a href="http://localhost:8000/docs" target="_blank">http://localhost:8000/docs</a></li>
          <li><strong>Frontend:</strong> <a href="http://localhost:5173" target="_blank">http://localhost:5173</a></li>
        </ul>
        <p><small>Other devices can access using your IP address.</small></p>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button onClick={fetchData} style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          🔄 Refresh Data
        </button>
      </div>
    </div>
  )
}

export default App
