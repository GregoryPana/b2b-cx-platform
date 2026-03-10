#!/usr/bin/env python3
"""
Network-accessible startup script for CX B2B Platform Backend
Run this script to make the backend accessible from other devices on your local network
"""

import uvicorn
import socket
from app.main import app

def get_local_ip():
    """Get the local IP address for network access"""
    try:
        # Create a socket to connect to an external address
        # This doesn't actually establish a connection, just gets the local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

def main():
    local_ip = get_local_ip()
    port = 8001
    
    print(f"🌐 Starting CX B2B Platform Backend")
    print(f"📡 Local access: http://127.0.0.1:{port}")
    print(f"🔗 Network access: http://{local_ip}:{port}")
    print(f"📱 Mobile devices can connect using: http://{local_ip}:{port}")
    print(f"🏠 Frontend URLs:")
    print(f"   - Survey: http://{local_ip}:5176")
    print(f"   - Dashboard: http://{local_ip}:5175")
    print(f"🚀 Server starting...")
    
    # Run with host=0.0.0.0 to bind to all network interfaces
    uvicorn.run(
        app,
        host="0.0.0.0",  # Bind to all interfaces
        port=port,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()
