# OpAuto Login Credentials

Test accounts for different subscription tiers with owners and staff members.

## 🔵 SOLO TIER (500 TND/year)
**Features**: 1 user, 50 cars, basic reports, no photos, no inventory, no SMS

### Owner Account
- **Email**: `solo@opauto.tn`
- **Password**: `solo123`
- **Name**: Mohammed Karim
- **Garage**: Garage Solo Mécanique
- **Access**: Full owner access with Solo tier limitations

---

## 🟢 STARTER TIER (2,000 TND/year) ⭐ Most Popular
**Features**: 3 users, 200 cars, email notifications, internal approvals, no photos, no inventory, no SMS

### Owner Account
- **Email**: `starter@opauto.tn`
- **Password**: `starter123`
- **Name**: Ahmed Ben Salah
- **Garage**: Garage Starter Auto
- **Access**: Full owner access with Starter tier features

### Staff Account 1
- **Username**: `starter_staff1`
- **Password**: `staff123`
- **Name**: Sara Mansouri
- **Garage**: Garage Starter Auto
- **Access**: Staff level access (no owner features)

### Staff Account 2
- **Username**: `starter_staff2`
- **Password**: `staff123`
- **Name**: Youssef Trabelsi
- **Garage**: Garage Starter Auto
- **Access**: Staff level access (no owner features)

---

## 🟣 PROFESSIONAL TIER (6,000 TND/year)
**Features**: Unlimited users/cars, photos, inventory, SMS, advanced reports, data export

### Owner Account
- **Email**: `pro@opauto.tn`
- **Password**: `pro123`
- **Name**: Karim Gharbi
- **Garage**: Garage Professional Motors
- **Access**: Full owner access with all Professional features

### Staff Account 1 - Senior Mechanic
- **Username**: `pro_mechanic1`
- **Password**: `staff123`
- **Name**: Fatma Slimani
- **Garage**: Garage Professional Motors
- **Access**: Staff level access

### Staff Account 2 - Mechanic
- **Username**: `pro_mechanic2`
- **Password**: `staff123`
- **Name**: Ali Bouzid
- **Garage**: Garage Professional Motors
- **Access**: Staff level access

### Staff Account 3 - Mechanic
- **Username**: `pro_mechanic3`
- **Password**: `staff123`
- **Name**: Leila Mabrouk
- **Garage**: Garage Professional Motors
- **Access**: Staff level access

### Staff Account 4 - Receptionist
- **Username**: `pro_receptionist`
- **Password**: `staff123`
- **Name**: Nadia Hamdi
- **Garage**: Garage Professional Motors
- **Access**: Staff level access

### Staff Account 5 - Inventory Manager
- **Username**: `pro_inventory`
- **Password**: `staff123`
- **Name**: Hichem Louati
- **Garage**: Garage Professional Motors
- **Access**: Staff level access (with inventory access)

---

## 📝 Testing Notes

### Subscription Feature Access by Tier

| Feature | Solo | Starter | Professional |
|---------|------|---------|--------------|
| Users | 1 | 3 | Unlimited |
| Cars in Database | 50 | 200 | Unlimited |
| Service Bays | 1 | 2 | Unlimited |
| Appointments | Unlimited | Unlimited | Unlimited |
| Cash Invoicing | ✅ | ✅ | ✅ |
| Basic Reports | ✅ | ✅ | ✅ |
| Browser Notifications | ✅ | ✅ | ✅ |
| Multi-User Support | ❌ | ✅ | ✅ |
| Email Notifications | ❌ | ✅ | ✅ |
| Internal Approvals | ❌ | ✅ | ✅ |
| Customer History | ❌ | ✅ | ✅ |
| Photo Documentation | ❌ | ❌ | ✅ |
| Parts Inventory | ❌ | ❌ | ✅ |
| SMS Notifications | ❌ | ❌ | ✅ |
| Advanced Reports | ❌ | ❌ | ✅ |
| Data Export | ❌ | ❌ | ✅ |
| Employee Tracking | ❌ | ❌ | ✅ |

### Key Differences to Test

1. **Solo Tier**: 
   - **Employees menu HIDDEN** (cannot add users)
   - **Approvals menu HIDDEN** (no internal approvals)
   - **Inventory menu HIDDEN** (no inventory management)
   - Photo upload component shows upgrade prompt
   - SMS settings disabled
   - Single owner account only

2. **Starter Tier**:
   - Can add up to 3 users total
   - Photo upload still shows upgrade prompt
   - SMS settings disabled
   - Inventory menu hidden

3. **Professional Tier**:
   - All features unlocked
   - Unlimited users
   - Photo upload fully functional
   - SMS settings enabled
   - Inventory management available

### Staff vs Owner Access

**Owners** (login with email):
- See subscription settings
- Can manage users/employees (Starter/Professional only)
- Access garage settings  
- View reports
- Access approvals (Starter/Professional only)
- Manage inventory (Professional only)

**Staff** (login with username):
- Limited to operational features
- Cannot see subscription settings
- Cannot manage other users
- Cannot access garage settings
- Basic reporting only

---

## 🔐 Security Notes

- All passwords are for **DEMO/TESTING purposes only**
- In production, implement proper password policies
- Staff accounts use usernames (no email required)
- Owner accounts use email addresses
- Subscription tier is tied to the user account
