#!/usr/bin/env python3
"""
Check valid visit status values
"""

import psycopg2

def check_visit_status_values():
    """Check valid visit status values"""
    print("🔍 CHECKING VISIT STATUS VALUES")
    print("=" * 40)
    
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            database='b2b',
            user='b2b',
            password='b2b'
        )
        cursor = conn.cursor()
        
        # Check current status values in database
        cursor.execute("SELECT DISTINCT status FROM visits ORDER BY status")
        current_statuses = cursor.fetchall()
        print(f"   Current statuses in database: {[s[0] for s in current_statuses]}")
        
        # Check enum definition
        cursor.execute("""
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (
                SELECT oid 
                FROM pg_type 
                WHERE typname = 'visit_status'
            )
            ORDER BY enumlabel
        """)
        
        enum_values = cursor.fetchall()
        print(f"   Valid enum values: {[v[0] for v in enum_values]}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_visit_status_values()
