# Mobile App Login Troubleshooting

**Issue**: Login fails with "Login failed. Check your credentials."

---

## ✅ Verified Working

The backend API is working correctly:
- ✅ Django backend running on port 8083
- ✅ Login endpoint `/api/v1/login/` is accessible
- ✅ Test credentials work: `admin@cmam.com` / `admin123`
- ✅ API returns valid JWT token

**Test Result**:
```bash
python -c "import requests; r = requests.post('http://localhost:8083/api/v1/login/', json={'email': 'admin@cmam.com', 'password': 'admin123'}); print(r.status_code); print(r.json())"
```
**Response**: `200 OK` with valid token

---

## 🔍 Root Cause

The mobile app is configured to connect to:
```
http://192.168.0.101:8083/api/v1
```

**Possible Issues**:
1. Mobile device can't reach `192.168.0.101` (network issue)
2. Firewall blocking port 8083
3. Mobile device on different network
4. IP address changed

---

## 🛠️ Solutions

### **Solution 1: Verify Network Connectivity** (Recommended)

**Step 1: Check if mobile device can reach the backend**

On your mobile device:
1. Open browser
2. Navigate to: `http://192.168.0.101:8083/api/v1/`
3. You should see a Django API page (not 404)

**If you can't access it**:
- Mobile device is on a different network
- Try Solution 2 or 3

---

### **Solution 2: Use Production API Instead**

Update the mobile app to use the production API:

**File**: `c:\wamp64\www\cmam\cmam_tracker_mobile\lib\config.ts`

**Change**:
```typescript
const USE_LOCAL_API = true;  // Change to false
```

**To**:
```typescript
const USE_LOCAL_API = false;  // Use production API
```

**Then**:
1. Save the file
2. Expo will auto-reload
3. Try login again with production credentials

---

### **Solution 3: Update Local IP Address**

If your computer's IP changed:

**Step 1: Find your current IP**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., `192.168.0.105`)

**Step 2: Update mobile app config**

**File**: `c:\wamp64\www\cmam\cmam_tracker_mobile\lib\config.ts`

**Change**:
```typescript
const LOCAL_IP = '192.168.0.101';  // Old IP
```

**To**:
```typescript
const LOCAL_IP = '192.168.0.105';  // Your new IP
```

**Step 3: Restart Expo**
```bash
# Press Ctrl+C in terminal
# Then restart
npx expo start --clear
```

---

### **Solution 4: Use Localhost (Web Browser Only)**

If testing in web browser:

**File**: `c:\wamp64\www\cmam\cmam_tracker_mobile\lib\config.ts`

**Change**:
```typescript
const LOCAL_API = `http://${LOCAL_IP}:8083/api/v1`;
```

**To**:
```typescript
const LOCAL_API = `http://localhost:8083/api/v1`;
```

**Note**: This only works for web browser testing, not for physical devices or emulators.

---

### **Solution 5: Test with Expo Go on Same Network**

**Requirements**:
- Mobile device must be on same WiFi as computer
- Computer firewall must allow port 8083

**Steps**:
1. Connect mobile device to same WiFi as computer
2. Disable Windows Firewall temporarily (for testing)
3. Try login again

**Windows Firewall**:
```
Settings → Update & Security → Windows Security → Firewall & network protection → Turn off
```

---

## 🧪 Quick Test

### **Test 1: Backend is Running**
```bash
curl http://localhost:8083/api/v1/
```
**Expected**: Django API page (HTML)

### **Test 2: Login Endpoint Works**
```bash
python -c "import requests; r = requests.post('http://localhost:8083/api/v1/login/', json={'email': 'admin@cmam.com', 'password': 'admin123'}); print(r.status_code)"
```
**Expected**: `200`

### **Test 3: Mobile App Can Reach Backend**
On mobile device browser:
```
http://192.168.0.101:8083/api/v1/
```
**Expected**: Django API page

If Test 3 fails → Use Solution 2 (production API) or Solution 3 (update IP)

---

## 📱 Recommended Approach

**For Quick Testing** (Easiest):
1. Use **Solution 2** - Switch to production API
2. Login with production credentials
3. Test the automation features

**For Full Local Development**:
1. Verify mobile device on same WiFi
2. Find computer's IP: `ipconfig`
3. Update `LOCAL_IP` in config.ts
4. Restart Expo
5. Test login

---

## ✅ Test Credentials

### **Local Backend**:
- Email: `admin@cmam.com`
- Password: `admin123`

### **Production API** (if using):
- Check with your admin for production credentials
- Or use the same credentials if synced

---

## 🔧 Current Configuration

**Mobile App API Config**:
```typescript
// lib/config.ts
const LOCAL_IP = '192.168.0.101';
const LOCAL_API = `http://${LOCAL_IP}:8083/api/v1`;
const PROD_API = 'https://nutri.pharn.org/api/v1';
const USE_LOCAL_API = true;  // Currently using local API
```

**Backend**:
- URL: `http://localhost:8083`
- API: `http://localhost:8083/api/v1/`
- Status: ✅ Running
- Login: ✅ Working

---

## 🎯 Next Steps

1. **Choose a solution** from above
2. **Apply the fix**
3. **Restart Expo** (if needed)
4. **Try login again**
5. **Test automation features** once logged in

---

## 📞 Quick Commands

**Check backend status**:
```bash
docker ps
```

**Restart backend**:
```bash
cd c:\wamp64\www\cmam\cmam-tracker-django
docker-compose restart web
```

**Restart Expo**:
```bash
cd c:\wamp64\www\cmam\cmam_tracker_mobile
# Press Ctrl+C
npx expo start --clear
```

**Find your IP**:
```bash
ipconfig
```

---

**The backend is working perfectly. The issue is just network connectivity between the mobile device and your computer. Choose the solution that works best for your setup!** 🚀
