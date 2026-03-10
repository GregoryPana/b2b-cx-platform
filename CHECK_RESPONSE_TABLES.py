#!/usr/bin/env python3
"""
Check what response tables exist
"""

import psycopg2

def check_response_tables():
    """Check response tables"""
    print("🔍 CHECKING RESPONSE TABLES")
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
        
        # Check all tables with 'response' in name
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%response%'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        print(f"   Response tables: {[table[0] for table in tables]}")
        
        # Check structure of each table
        for table in tables:
            table_name = table[0]
            cursor.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = '{table_name}'
                ORDER BY ordinal_position
            """)
            columns = cursor.fetchall()
            print(f"   {table_name}: {[col[0] for col in columns]}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_response_tables()
