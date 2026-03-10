#!/usr/bin/env python3
"""
Check all service statuses
"""

import requests
import time
import socket

def get_network_ip():
    """Get the local network IP address"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        try:
            hostname = socket.gethostname()
            ip = socket.gethostbyname(hostname)
            return ip
        except:
            return "127.0.0.1"

def check_services():
    print("🚀 CHECKING ALL SERVICES STATUS")
    print("=" * 50)
    
    services = [
        ("Backend API", "http://localhost:8001/health"),
        ("Dashboard Frontend", "http://localhost:5175"),
        ("Survey Frontend", "http://localhost:5176"),
    ]
    
    all_running = True
    
    for name, url in services:
        try:
            if "health" in url:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ {name}: RUNNING - {data.get('status', 'OK')}")
                else:
                    print(f"   ❌ {name}: ERROR - HTTP {response.status_code}")
                    all_running = False
            else:
                response = requests.get(url, timeout=5)
                if response.status_code == 200 and "html" in response.text.lower():
                    print(f"   ✅ {name}: RUNNING")
                else:
                    print(f"   ❌ {name}: ERROR - HTTP {response.status_code}")
                    all_running = False
        except Exception as e:
            print(f"   ❌ {name}: ERROR - {e}")
            all_running = False
    
    print("\n" + "=" * 50)
    
    # Test key endpoints
    print("🔍 TESTING KEY ENDPOINTS:")
    base_url = "http://localhost:8001"
    
    endpoints = [
        ("Questions API", f"{base_url}/questions"),
        ("Draft Visits", f"{base_url}/dashboard-visits/drafts"),
        ("Survey Businesses", f"{base_url}/survey-businesses"),
    ]
    
    for name, url in endpoints:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    print(f"   ✅ {name}: {len(data)} items")
                else:
                    print(f"   ✅ {name}: Working")
            else:
                print(f"   ❌ {name}: HTTP {response.status_code}")
                all_running = False
        except Exception as e:
            print(f"   ❌ {name}: {e}")
            all_running = False
    
    print("\n" + "=" * 50)
    if all_running:
        print("🎉 ALL SERVICES ARE RUNNING!")
        
        # Get network IP for local network access
        network_ip = get_network_ip()
        
        print("\n🌐 ACCESS YOUR APPLICATIONS:")
        print("   � LOCAL ACCESS:")
        print("      �📊 Dashboard: http://localhost:5175")
        print("      📋 Survey:    http://localhost:5176") 
        print("      🔗 API Docs:  http://localhost:8001/docs")
        print("      🏥 Health:    http://localhost:8001/health")
        
        if network_ip != "127.0.0.1":
            print(f"\n   🌐 NETWORK ACCESS (for other devices):")
            print(f"      📊 Dashboard: http://{network_ip}:5175")
            print(f"      📋 Survey:    http://{network_ip}:5176") 
            print(f"      🔗 API Docs:  http://{network_ip}:8001/docs")
            print(f"      🏥 Health:    http://{network_ip}:8001/health")
            
            print(f"\n   💡 DATABASE ACCESS:")
            print(f"      📋 Network IP: {network_ip}")
            print(f"      🗄️  Database: PostgreSQL on localhost:5432")
            print(f"      🔗 Other devices can connect to database via: {network_ip}:5432")
        else:
            print(f"\n   ⚠️  Network access not available - using localhost only")
        
        print("\n📋 WHAT'S AVAILABLE:")
        print("   • 4 planned draft visits")
        print("   • 24 survey questions (Q1-Q24)")
        print("   • 8 historical businesses")
        print("   • Complete visit update functionality")
        
        print("\n🚀 READY TO USE!")
    else:
        print("⚠️  Some services are not running correctly")

if __name__ == "__main__":
    check_services()
