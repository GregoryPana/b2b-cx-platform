# Network Access Guide

This guide shows how to access the CX B2B Platform from other devices on your local network (mobile phones, tablets, other computers).

## Quick Start (Windows)

1. **Start all services for network access:**
   ```bash
   # Run this batch file
   start_network.bat
   ```

2. **Access from other devices:**
    - Survey: `http://YOUR_IP:5176`
    - Mystery Shopper: `http://YOUR_IP:5177`
    - Dashboard: `http://YOUR_IP:5175`
    - Backend API: `http://YOUR_IP:8001`

## Manual Startup

### Step 1: Start Backend (Network Accessible)
```bash
cd backend
python start_network.py
```

### Step 2: Start Frontend Services
```bash
# Terminal 1: Survey
cd frontend/survey
npm run dev

# Terminal 2: Mystery Shopper
cd frontend/mystery-shopper
npm run dev

# Terminal 3: Dashboard  
cd frontend/dashboard
npm run dev
```

### Step 3: Find Your IP Address
**Windows:**
```cmd
ipconfig
# Look for "IPv4 Address" under your active network adapter
```

**Mac/Linux:**
```bash
ipconfig getifaddr en0  # Mac
hostname -I | awk '{print $1}'  # Linux
```

## Access URLs

Replace `YOUR_IP` with your actual local IP address (e.g., 192.168.1.100, 10.0.0.50)

### From Other Devices
- **Survey Interface:** `http://YOUR_IP:5176`
- **Mystery Shopper Interface:** `http://YOUR_IP:5177`
- **Dashboard:** `http://YOUR_IP:5175`
- **API Health Check:** `http://YOUR_IP:8001/health`

### From This Computer
- **Survey Interface:** `http://localhost:5176`
- **Mystery Shopper Interface:** `http://localhost:5177`
- **Dashboard:** `http://localhost:5175`
- **API Health Check:** `http://localhost:8001/health`

## Network Configuration

### What's Already Configured
✅ **Frontend Vite Config:** Survey, mystery shopper, and dashboard have `host: true` enabled  
✅ **Backend CORS:** Allows all origins and local network ranges  
✅ **Backend Host Binding:** Binds to `0.0.0.0` (all interfaces)  

### Supported Network Ranges
- `10.x.x.x` - Private network
- `192.168.x.x` - Private network  
- `172.16-31.x.x` - Private network
- `localhost` and `127.0.0.1` - Local only

## Troubleshooting

### Firewall Issues
If you can't connect from other devices:

**Windows:**
1. Open Windows Defender Firewall
2. Allow Python/uvicorn through firewall for both Private and Public networks
3. Or temporarily disable for testing

**Mac:**
```bash
# Allow Python through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/python3
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /usr/bin/python3
```

### Port Conflicts
If ports are already in use:
```bash
# Check what's using the ports
netstat -an | findstr :8001
netstat -an | findstr :5176
netstat -an | findstr :5177
netstat -an | findstr :5175

# Kill processes if needed (Windows)
taskkill /PID <PID> /F
```

### Connection Refused
1. **Check if backend is running:** Visit `http://YOUR_IP:8001/health`
2. **Verify IP address:** Make sure you're using the correct local IP
3. **Check network:** Ensure devices are on the same WiFi/network
4. **Restart services:** Stop and restart all services

### Mobile Device Issues
1. **Use http:// not https://** - SSL certificates aren't configured for local development
2. **Check WiFi connection:** Make sure mobile device is on the same network
3. **Try a different browser:** Some browsers have stricter security policies

## Security Notes

⚠️ **Development Only:** This configuration is for development and testing only.

- **No authentication required** for basic endpoints
- **All origins allowed** via CORS
- **Network accessible** - anyone on your local network can access

For production deployment, always use:
- HTTPS/SSL certificates
- Proper authentication
- Restricted CORS origins
- Firewall rules

## Example Session

```bash
# Start network accessible backend
$ python start_network.py
🌐 Starting CX B2B Platform Backend
📡 Local access: http://127.0.0.1:8001
🔗 Network access: http://192.168.1.100:8001
📱 Mobile devices can connect using: http://192.168.1.100:8001
🏠 Frontend URLs:
   - Survey: http://192.168.1.100:5176
   - Mystery Shopper: http://192.168.1.100:5177
   - Dashboard: http://192.168.1.100:5175
🚀 Server starting...
```

Then from your phone/tablet:
1. Open browser
2. Go to `http://192.168.1.100:5176`
3. Use the survey interface normally
