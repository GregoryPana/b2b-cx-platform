"""
Simple test endpoints to verify database access
"""

from fastapi import APIRouter
import sqlite3

router = APIRouter(tags=["test"])

@router.get("/test/businesses")
async def test_get_businesses():
    """Test endpoint to directly query businesses from database."""
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM businesses')
        rows = cursor.fetchall()
        
        # Get column names
        cursor.execute('PRAGMA table_info(businesses)')
        columns = [col[1] for col in cursor.fetchall()]
        
        # Convert to list of dicts
        businesses = []
        for row in rows:
            business = dict(zip(columns, row))
            businesses.append(business)
        
        conn.close()
        
        return {
            "count": len(businesses),
            "businesses": businesses
        }
        
    except Exception as e:
        return {"error": str(e), "businesses": []}

@router.get("/test/account-executives")
async def test_get_account_executives():
    """Test endpoint to directly query account executives from database."""
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM account_executives')
        rows = cursor.fetchall()
        
        # Get column names
        cursor.execute('PRAGMA table_info(account_executives)')
        columns = [col[1] for col in cursor.fetchall()]
        
        # Convert to list of dicts
        aes = []
        for row in rows:
            ae = dict(zip(columns, row))
            aes.append(ae)
        
        conn.close()
        
        return {
            "count": len(aes),
            "account_executives": aes
        }
        
    except Exception as e:
        return {"error": str(e), "account_executives": []}

@router.get("/test/visits")
async def test_get_visits():
    """Test endpoint to directly query visits from database."""
    try:
        conn = sqlite3.connect('../dev_cx_platform.db')
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM visits')
        rows = cursor.fetchall()
        
        # Get column names
        cursor.execute('PRAGMA table_info(visits)')
        columns = [col[1] for col in cursor.fetchall()]
        
        # Convert to list of dicts
        visits = []
        for row in rows:
            visit = dict(zip(columns, row))
            visits.append(visit)
        
        conn.close()
        
        return {
            "count": len(visits),
            "visits": visits
        }
        
    except Exception as e:
        return {"error": str(e), "visits": []}
