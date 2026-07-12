# Mobile App Testing Guide - Advanced Automation Features

**Date**: June 28, 2026  
**Status**: ✅ Ready to Test  
**Platform**: React Native (Expo) + TypeScript

---

## 🚀 Quick Start

### **1. Backend is Running**
✅ Django backend is running on port **8083**  
✅ API accessible at: `http://192.168.0.101:8083/api/v1/`  
✅ Mobile app configured to connect to local backend

### **2. Mobile App is Running**
✅ Expo dev server running on port **8086**  
✅ QR code available for scanning  
✅ All automation features implemented

---

## 📱 How to Test

### **Step 1: Open the Mobile App**

**Option A: Scan QR Code** (Recommended)
1. Open **Expo Go** app on your phone
2. Scan the QR code from the terminal
3. App will load

**Option B: Web Browser**
1. Press **`w`** in the terminal
2. Opens at http://localhost:8086

**Option C: Android Emulator**
1. Press **`a`** in the terminal

---

### **Step 2: Login**

Use these test credentials:
- **Email**: `admin@cmam.com`
- **Password**: `admin123`

This will authenticate you and load the dashboard with test data.

---

### **Step 3: Test the New Automation Features**

#### **Navigate to Registration Form**:
1. From Dashboard → Tap **"Cases"** or **"+"** button
2. Select **"Register New Case"**
3. Choose **"SAM"** case type

#### **Test Registration Source Auto-Selection**:
1. Fill in basic info:
   - Child's name: `Test Child`
   - Age: `18` months
   - Gender: Select any
2. Scroll down to **"Registration Source"**
3. **Select any source** (e.g., "Direct from community")

#### **✅ Expected Results**:

**Blue Badge Appears**:
```
┌─────────────────────────────────────┐
│ Auto-Selected Admission Type:       │
│ Direct from community               │
└─────────────────────────────────────┘
```

**Green Badge Appears**:
```
┌─────────────────────────────────────┐
│ Reporting Category:                 │
│ B2: New SAM case 6-59 months by    │
│ MUAC/WFLH                           │
└─────────────────────────────────────┘
```

---

## 🎯 Features to Test

### **1. Registration Source Options** (8 total)
- [ ] Direct from community
- [ ] Self referral
- [ ] CWC or outreach
- [ ] Health facility referral
- [ ] Inpatient care referral
- [ ] Other OPC transfer
- [ ] Returned defaulter
- [ ] Relapse after cure

### **2. Auto-Selected Admission Type**
- [ ] Changes based on selected source
- [ ] Displays in blue badge
- [ ] Updates in real-time

### **3. Reporting Category Classification**
- [ ] B1: New SAM case under 6 months at risk
- [ ] B2: New SAM case 6-59 months by MUAC/WFLH
- [ ] B3: New SAM case 6-59 months oedema/marasmic kwashiorkor
- [ ] C: Other new SAM case (5+ years)
- [ ] D: Old case (transfers, returned defaulters)

### **4. IPC Referral Alert** (Existing Feature)
- [ ] Red alert appears when:
  - Oedema = ++ or +++
  - Appetite Test = Poor or None

---

## 🔍 What Each Source Should Display

| Registration Source | Admission Type | Is New Case |
|---------------------|----------------|-------------|
| Direct from community | Direct from community | ✅ Yes |
| Self referral | Self referral | ✅ Yes |
| CWC or outreach | CWC or outreach | ✅ Yes |
| Health facility referral | Referred from health facility | ✅ Yes |
| Inpatient care referral | Referred from inpatient care | ✅ Yes |
| Other OPC transfer | Transfer from other OPC | ❌ No (Old) |
| Returned defaulter | Returned defaulter | ❌ No (Old) |
| Relapse after cure | Relapse after cure | ❌ No (Old) |

---

## 🎨 UI Elements to Verify

### **Registration Source Field**:
- **Type**: Chips selector (horizontal scrollable)
- **Label**: "Registration Source *"
- **Options**: 8 choices
- **Behavior**: Single selection

### **Auto-Selected Admission Type Badge**:
- **Color**: Blue (#3b82f6)
- **Border**: Left border (3px)
- **Background**: Light blue
- **Title**: "Auto-Selected Admission Type:"
- **Content**: Dynamic based on source
- **Visibility**: Shows when source selected

### **Reporting Category Badge**:
- **Color**: Green (#10b981)
- **Border**: Left border (3px)
- **Background**: Light green
- **Title**: "Reporting Category:"
- **Content**: Dynamic based on age, source, oedema
- **Visibility**: Shows when source and age available

---

## 🧪 Test Scenarios

### **Scenario 1: New Case - Direct from Community**
1. Select source: "Direct from community"
2. Age: 18 months
3. Oedema: None
4. **Expected**:
   - Admission Type: "Direct from community"
   - Category: "B2: New SAM case 6-59 months by MUAC/WFLH"

### **Scenario 2: Old Case - Returned Defaulter**
1. Select source: "Returned defaulter"
2. Age: 24 months
3. Oedema: None
4. **Expected**:
   - Admission Type: "Returned defaulter"
   - Category: "D: Old case"

### **Scenario 3: Oedema Case**
1. Select source: "Health facility referral"
2. Age: 12 months
3. Oedema: ++
4. **Expected**:
   - Admission Type: "Referred from health facility"
   - Category: "B3: New SAM case 6-59 months oedema/marasmic kwashiorkor"
   - **IPC Referral Alert** (red) should also appear

### **Scenario 4: Infant Case**
1. Select source: "CWC or outreach"
2. Age: 4 months
3. Oedema: None
4. **Expected**:
   - Admission Type: "CWC or outreach"
   - Category: "B1: New SAM case under 6 months at risk"

---

## 📊 Backend Integration Status

### **Currently Working** (Client-Side):
✅ Registration source selection  
✅ Admission type auto-selection  
✅ Reporting category classification  
✅ IPC referral alert  
✅ RUTF calculator  

### **Ready for Backend** (When API Updated):
⏳ Weight trend calculation  
⏳ Discharge criteria check  
⏳ Task generation  
⏳ Consecutive weight tracking  

---

## 🔧 Technical Details

### **Files Modified**:
1. **`lib/samOpcAutomation.ts`**
   - Added `getAdmissionType()` function
   - Added `getReportingCategory()` function
   - Added `checkDischargeCriteria()` function
   - Added `calculateWeightTrend()` function
   - Added `getTaskPriorityColor()` function

2. **`app/case/register.tsx`**
   - Added registration source field
   - Added auto-admission type display
   - Added reporting category display
   - Added state management for automation

3. **`lib/config.ts`**
   - Updated API URL to `http://192.168.0.101:8083/api/v1`
   - Enabled local API mode

### **API Configuration**:
- **Base URL**: `http://192.168.0.101:8083/api/v1`
- **Backend**: Django (Docker container)
- **Port**: 8083
- **Authentication**: JWT Bearer token

---

## ❌ Troubleshooting

### **Issue: "Dashboard fetch error: Network Error"**
**Solution**: This is normal before login. Just login with test credentials.

### **Issue: "Dashboard fetch error: 404"**
**Solution**: The endpoint exists but requires authentication. Login first.

### **Issue: App won't load data**
**Checklist**:
- [ ] Django backend running? (`docker ps`)
- [ ] Port 8083 accessible? (`curl http://localhost:8083/api/v1/`)
- [ ] Logged in with correct credentials?
- [ ] Mobile device on same network as computer?

### **Issue: Badges not appearing**
**Checklist**:
- [ ] Registration source selected?
- [ ] Age entered?
- [ ] Scroll down to see badges?

### **Issue: React version error**
**Solution**: Already fixed! React downgraded to 19.1.0 to match react-native-renderer.

---

## 📚 Documentation Files

1. **SAM_OPC_app_automation_spec.md** - Original specification
2. **SAM_OPC_AUTOMATION_IMPLEMENTED.md** - Basic automation (web)
3. **MOBILE_APP_AUTOMATION_IMPLEMENTED.md** - Basic automation (mobile)
4. **ADVANCED_AUTOMATION_IMPLEMENTATION.md** - Advanced features (backend)
5. **MOBILE_ADVANCED_AUTOMATION.md** - Advanced features (mobile)
6. **MOBILE_APP_TESTING_GUIDE.md** - This file

---

## ✅ Testing Checklist

### **Pre-Testing**:
- [ ] Django backend running on port 8083
- [ ] Expo dev server running on port 8086
- [ ] Mobile device/emulator ready
- [ ] Test credentials available

### **Login**:
- [ ] App opens successfully
- [ ] Login screen appears
- [ ] Can login with admin@cmam.com / admin123
- [ ] Dashboard loads with data

### **Registration Form**:
- [ ] Can navigate to registration form
- [ ] SAM case type selectable
- [ ] All form fields visible
- [ ] Registration source field present

### **Automation Features**:
- [ ] Registration source has 8 options
- [ ] Selecting source shows admission type badge
- [ ] Admission type badge is blue
- [ ] Reporting category badge appears
- [ ] Reporting category badge is green
- [ ] Badges update when changing selections
- [ ] IPC referral alert still works

### **Data Submission** (Optional):
- [ ] Can complete registration form
- [ ] Form submits successfully
- [ ] New case appears in cases list

---

## 🎉 Success Criteria

**The implementation is successful if**:

1. ✅ All 8 registration source options are visible
2. ✅ Blue admission type badge appears when source selected
3. ✅ Green reporting category badge appears
4. ✅ Badges update in real-time
5. ✅ Different sources show different admission types
6. ✅ Age affects reporting category (B1 vs B2 vs C)
7. ✅ Oedema affects reporting category (B2 vs B3)
8. ✅ Old cases show category D
9. ✅ IPC referral alert still works
10. ✅ No errors in console

---

## 📞 Support

**Test Credentials**:
- Email: `admin@cmam.com`
- Password: `admin123`

**Backend URL**: http://localhost:8083  
**Mobile API**: http://192.168.0.101:8083/api/v1  
**Expo Dev Server**: http://localhost:8086

**Commands**:
```bash
# Start Django backend
cd c:\wamp64\www\cmam\cmam-tracker-django
docker-compose up -d

# Start mobile app
cd c:\wamp64\www\cmam\cmam_tracker_mobile
npx expo start --clear

# Check backend status
docker ps

# View backend logs
docker-compose logs -f web
```

---

**All advanced automation features are now ready to test in the mobile app!** 🎉
