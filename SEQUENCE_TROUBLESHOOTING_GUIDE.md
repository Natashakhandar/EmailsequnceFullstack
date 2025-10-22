# Email Sequence Troubleshooting Guide

## Issue: Empty Sequence Dropdown in "Enroll Contacts in Sequence"

### ✅ **Enhanced Debugging Features Added**

Your Leads page now includes comprehensive debugging and troubleshooting features:

### **1. Automatic Sequence Detection & Filtering**

The system now:
- ✅ Loads all sequences from database
- ✅ Filters sequences that are both **active** and have **active steps**
- ✅ Shows detailed console logs for debugging
- ✅ Provides user-friendly error messages

### **2. Common Issues & Solutions**

#### **Issue A: "No active sequences available"**
**Cause:** Sequences exist but are inactive or have no active steps

**Solution:**
1. Open browser console (F12) and check logs
2. Look for messages like: `Sequence "My Sequence": active=false, hasActiveSteps=true`
3. Go to your Sequences page and:
   - Set `isActive = true` for the sequence
   - Ensure at least one step has `isActive = true`

#### **Issue B: "No sequences found"**
**Cause:** No sequences exist in database

**Solution:**
1. Create sequences using your Sequence Builder
2. Save them to the database
3. Refresh the enrollment dialog

#### **Issue C: Database Connection Issues**
**Cause:** API endpoint not responding

**Solution:**
1. Check browser console for network errors
2. Verify backend server is running
3. Test API endpoint directly: `GET /api/sequences`

### **3. New Debugging Tools**

#### **Console Logging**
The system now logs detailed information:
```javascript
Loading sequences...
Raw sequences data: {sequences: [...]}
Found 3 total sequences
Sequence "Welcome Series": active=true, hasActiveSteps=true, stepCount=4
Sequence "Follow-up Campaign": active=false, hasActiveSteps=true, stepCount=3
Sequence "Onboarding": active=true, hasActiveSteps=false, stepCount=2
Filtered to 1 available sequences: ["Welcome Series"]
```

#### **UI Debugging Features**
- 🔄 **Refresh Button**: Reload sequences without page refresh
- 👁️ **Show All Sequences**: View inactive sequences for debugging
- ⚠️ **Status Badges**: Visual indicators for sequence issues
- 📊 **Detailed Messages**: Specific error descriptions

### **4. Sequence Requirements for Enrollment**

For a sequence to appear in the dropdown, it must:
1. ✅ `sequence.isActive = true`
2. ✅ Have at least one step with `step.isActive = true`
3. ✅ Have valid templates for all active steps

### **5. Database Structure Check**

Verify your database has the correct structure:

```sql
-- Check sequences
SELECT id, name, isActive, 
       (SELECT COUNT(*) FROM SequenceStep WHERE sequenceId = Sequence.id) as stepCount,
       (SELECT COUNT(*) FROM SequenceStep WHERE sequenceId = Sequence.id AND isActive = true) as activeSteps
FROM Sequence;

-- Check sequence steps
SELECT ss.id, ss.stepOrder, ss.isActive, s.name as sequenceName, t.name as templateName
FROM SequenceStep ss
JOIN Sequence s ON ss.sequenceId = s.id
JOIN Template t ON ss.templateId = t.id
ORDER BY s.name, ss.stepOrder;
```

### **6. API Endpoint Testing**

Test your API endpoints:

```bash
# Get all sequences
curl http://localhost:3000/api/sequences

# Get sequences with active filter
curl http://localhost:3000/api/sequences?isActive=true

# Get specific sequence with steps
curl http://localhost:3000/api/sequences/{sequence-id}
```

### **7. Activation Workflow**

To activate sequences:

1. **Via Database:**
   ```sql
   UPDATE Sequence SET isActive = true WHERE id = 'your-sequence-id';
   UPDATE SequenceStep SET isActive = true WHERE sequenceId = 'your-sequence-id';
   ```

2. **Via API:**
   ```bash
   curl -X PUT http://localhost:3000/api/sequences/{id} \
     -H "Content-Type: application/json" \
     -d '{"isActive": true}'
   ```

3. **Via UI:** Use your Sequence Builder to toggle active status

### **8. Email Sending Timing Options**

#### **Immediate Start** ✅
- First email sends right away
- Subsequent emails follow sequence delays
- Good for: Welcome emails, urgent campaigns

#### **Scheduled Start** ⏰
- All emails follow sequence timing
- Respects delays from the beginning
- Good for: Nurture campaigns, educational series

### **9. Troubleshooting Steps**

1. **Open Browser Console** (F12 → Console tab)
2. **Go to Leads page** and select contacts
3. **Click "Enroll in Sequence"**
4. **Check console logs** for detailed debugging info
5. **Use "Refresh" button** to reload sequences
6. **Use "Show All"** to see inactive sequences
7. **Check sequence status** in your database/admin panel

### **10. Expected Console Output**

**Successful Load:**
```
Loading sequences...
Raw sequences data: {sequences: [3 items]}
Found 3 total sequences
Sequence "Campaign 1": active=true, hasActiveSteps=true, stepCount=4
Filtered to 1 available sequences: ["Campaign 1"]
```

**No Active Sequences:**
```
Loading sequences...
Found 2 total sequences
Sequence "Campaign 1": active=false, hasActiveSteps=true, stepCount=4
Sequence "Campaign 2": active=true, hasActiveSteps=false, stepCount=3
Filtered to 0 available sequences: []
No available sequences found. Check if sequences are active and have active steps.
```

### **11. Quick Fix Commands**

If you need to quickly activate all sequences:

```sql
-- Activate all sequences
UPDATE Sequence SET isActive = true;

-- Activate all sequence steps
UPDATE SequenceStep SET isActive = true;
```

---

## ✅ **System Status**

Your email sequencing system now has:
- ✅ Enhanced sequence loading with debugging
- ✅ Comprehensive error messages
- ✅ Visual troubleshooting tools
- ✅ Detailed console logging
- ✅ Refresh and filtering options
- ✅ Clear timing explanations
- ✅ Database sync verification

The system will now clearly tell you exactly why sequences aren't appearing and how to fix it!
