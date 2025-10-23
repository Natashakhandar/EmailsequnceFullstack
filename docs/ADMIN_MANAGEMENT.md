# Admin Management Guide

This guide explains how to manage administrator accounts using the command-line script and the web interface.

## Command Line Script

The `manage-admins.js` script provides command-line tools for managing admin users.

### Prerequisites

1. Ensure your `.env` file is properly configured with database connection
2. Run `npm install` to install dependencies
3. Make sure the database schema is up to date with `npx prisma db push`

### Available Commands

#### 1. Create New Admin User

```bash
node manage-admins.js create <email> <password> <firstName> <lastName> [role]
```

**Example:**
```bash
node manage-admins.js create admin@company.com Admin123! John Doe ADMIN
node manage-admins.js create superadmin@company.com SuperAdmin123! Jane Smith SUPERADMIN
```

**Parameters:**
- `email`: Admin's email address (must be unique)
- `password`: Strong password for the admin account
- `firstName`: Admin's first name
- `lastName`: Admin's last name
- `role`: Either `ADMIN` or `SUPERADMIN` (default: `ADMIN`)

#### 2. Update Existing Admin User

```bash
node manage-admins.js update <email> [password] <firstName> <lastName> [role]
```

**Example:**
```bash
node manage-admins.js update admin@company.com NewPassword123! John Smith ADMIN
node manage-admins.js update admin@company.com "" John Smith SUPERADMIN  # Update without changing password
```

**Note:** Leave password empty (`""`) if you don't want to change it.

#### 3. List All Admin Users

```bash
node manage-admins.js list
```

This command displays:
- All admin and superadmin users
- Their roles, status, and creation dates
- User IDs and contact information

#### 4. Activate Admin User

```bash
node manage-admins.js activate <email>
```

**Example:**
```bash
node manage-admins.js activate admin@company.com
```

#### 5. Deactivate Admin User

```bash
node manage-admins.js deactivate <email>
```

**Example:**
```bash
node manage-admins.js deactivate admin@company.com
```

### Script Output Examples

#### Creating a New Admin:
```
Creating admin user...
Email: admin@company.com
✅ Admin user created successfully!
User details: {
  id: 'clh1r2b5h0000ek6xsymwfr1s',
  email: 'admin@company.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'ADMIN',
  isActive: true
}

🔐 Login credentials:
Email: admin@company.com
Password: Admin123!
```

#### Listing All Admins:
```
Found 2 admin user(s):

1. 👑 SUPERADMIN
   Name: Super Admin
   Email: admin@arnavsales.com
   Status: 🟢 Active
   Created: 10/22/2025
   Updated: 10/22/2025
   ID: cmh1r2b5h0000ek6xsymwfr1s

2. 🛡️ ADMIN
   Name: John Doe
   Email: admin@company.com
   Status: 🟢 Active
   Created: 10/22/2025
   Updated: 10/22/2025
   ID: clh1r2b5h0000ek6xsymwfr2t
```

## Web Interface (Superadmin Only)

### Accessing Admin Management

1. Log in as a **SUPERADMIN** user
2. Navigate to **Admin Management** from:
   - The main navigation bar (if you're a superadmin)
   - The profile dropdown menu
   - Direct URL: `/admin-management`

### Features Available in Web Interface

#### 1. View All Admin Users
- See all admin and superadmin accounts
- View user details, roles, and status
- See account creation and update dates

#### 2. Create New Admin Users
- Click "Add Admin" button
- Fill in user details (name, email, password, role)
- Password visibility toggle available
- Choose between ADMIN and SUPERADMIN roles

#### 3. Edit Existing Admin Users
- Click "Edit" button on any user card
- Update name, email, and role
- Cannot change your own role (security measure)

#### 4. Activate/Deactivate Users
- Toggle user active status
- Cannot deactivate your own account

#### 5. Delete Admin Users
- Permanently delete admin accounts
- Cannot delete your own account
- Confirmation dialog prevents accidental deletions

### Security Features

- **Role-based Access**: Only superadmins can access admin management
- **Self-protection**: Users cannot delete or deactivate their own accounts
- **Role Protection**: Users cannot change their own role
- **Confirmation Dialogs**: Destructive actions require confirmation

## User Roles Explained

### SUPERADMIN
- **Full System Access**: Can manage all aspects of the system
- **User Management**: Can create, edit, and delete admin users
- **Role Assignment**: Can promote/demote users between roles
- **Icon**: 👑 Crown icon
- **Badge**: "Full Access" with yellow styling

### ADMIN
- **Limited Admin Access**: Can manage system content but not users
- **No User Management**: Cannot create or manage other admin accounts
- **Icon**: 🛡️ Shield icon
- **Badge**: "Admin Access" with blue styling

### USER
- **Standard Access**: Regular user with no administrative privileges
- **Icon**: 👤 User icon
- **No special badges**

## Best Practices

### Password Security
- Use strong passwords with at least 12 characters
- Include uppercase, lowercase, numbers, and special characters
- Change default passwords immediately after account creation

### Account Management
- Regularly review admin accounts using `node manage-admins.js list`
- Deactivate unused accounts instead of deleting them
- Keep a record of who has admin access

### Role Assignment
- Only assign SUPERADMIN role to trusted individuals
- Use ADMIN role for most administrative tasks
- Follow principle of least privilege

## Troubleshooting

### Common Issues

#### "User already exists" Error
- The email address is already registered
- Use the `update` command instead of `create`
- Or use a different email address

#### "User not found" Error
- Check the email address spelling
- Use `list` command to see all existing users
- Ensure the user exists in the database

#### Database Connection Issues
- Verify `.env` file configuration
- Check database server is running
- Ensure proper database permissions

#### Permission Denied in Web Interface
- Only superadmins can access admin management
- Check your user role in the profile page
- Contact a superadmin to upgrade your role if needed

### Getting Help

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify your database connection and schema
3. Ensure all environment variables are properly set
4. Review this documentation for proper command syntax

## Security Considerations

- **Environment Variables**: Keep `.env` file secure and never commit it to version control
- **Database Access**: Restrict database access to authorized personnel only
- **Admin Accounts**: Regularly audit admin accounts and remove unnecessary access
- **Password Policies**: Enforce strong password requirements
- **Session Management**: Implement proper session timeouts and security measures
