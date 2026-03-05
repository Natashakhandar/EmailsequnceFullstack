import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Crown,
  Shield,
  User as UserIcon,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX
} from "lucide-react";
import { toast } from "sonner";
import { api, User } from "@/lib/api";

const AdminManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "USER" as "USER" | "ADMIN" | "SUPERADMIN"
  });

  // Check if current user is superadmin
  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const response = await api.getCurrentUser();
        setCurrentUser(response.user);

        if (response.user.role !== 'SUPERADMIN') {
          setError('Access denied. Only superadmins can view this page.');
          return;
        }

        await fetchUsers();
      } catch (error) {
        console.error('Failed to check user role:', error);
        setError('Failed to verify user permissions');
      } finally {
        setLoading(false);
      }
    };

    checkUserRole();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Failed to load users');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(formData);
      toast.success('Admin user created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      await fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updateData = {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
      };

      await api.updateUser(editingUser.id, updateData);
      toast.success('Admin user updated successfully');
      setIsEditDialogOpen(false);
      setEditingUser(null);
      resetForm();
      await fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (currentUser?.id === userId) {
      toast.error('You cannot delete your own account');
      return;
    }

    if (confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      try {
        await api.deleteUser(userId);
        toast.success('User deleted successfully');
        await fetchUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to delete user');
      }
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (currentUser?.id === userId) {
      toast.error('You cannot deactivate your own account');
      return;
    }

    try {
      await api.updateUser(userId, { isActive: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      await fetchUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update user status');
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "USER"
    });
    setShowPassword(false);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role
    });
    setIsEditDialogOpen(true);
  };

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return { label: 'Super Admin', icon: Crown, color: 'bg-yellow-100 text-yellow-800', badgeVariant: 'default' as const };
      case 'ADMIN':
        return { label: 'Admin', icon: Shield, color: 'bg-blue-100 text-blue-800', badgeVariant: 'secondary' as const };
      default:
        return { label: 'User', icon: UserIcon, color: 'bg-gray-100 text-gray-800', badgeVariant: 'outline' as const };
    }
  };

  const getUserInitials = (user: User) => {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    return user.email[0].toUpperCase();
  };

  const getFullName = (user: User) => {
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    return `${firstName} ${lastName}`.trim() || user.email;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading admin management...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (currentUser?.role !== 'SUPERADMIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. Only superadmins can access this page.
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      <Navbar />

      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">User Management</h1>
              <p className="text-muted-foreground">Manage user accounts and permissions</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-white rounded-xl shadow-luxury">
                  <Plus className="w-4 h-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as "USER" | "ADMIN" | "SUPERADMIN" })}
                      className="w-full p-2 border border-border rounded-md bg-background"
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SUPERADMIN">Super Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">Create User</Button>
                    <Button type="button" variant="outline" onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Admin Users Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {users.map((user) => {
            const roleInfo = getRoleInfo(user.role);
            const IconComponent = roleInfo.icon;

            return (
              <Card key={user.id} className="glass hover-lift">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="gradient-primary text-white font-semibold">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{getFullName(user)}</CardTitle>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconComponent className={`w-5 h-5 ${roleInfo.color.includes('yellow') ? 'text-yellow-600' : roleInfo.color.includes('blue') ? 'text-blue-600' : 'text-gray-600'}`} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={roleInfo.badgeVariant} className={roleInfo.color}>
                        {roleInfo.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs text-muted-foreground">
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <p>Created: {new Date(user.createdAt).toLocaleDateString()}</p>
                      <p>Updated: {new Date(user.updatedAt).toLocaleDateString()}</p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(user)}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleUserStatus(user.id, user.isActive)}
                        disabled={currentUser?.id === user.id}
                      >
                        {user.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        disabled={currentUser?.id === user.id}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <UserIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Users Found</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first user.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First User
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFirstName">First Name</Label>
                  <Input
                    id="editFirstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLastName">Last Name</Label>
                  <Input
                    id="editLastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Role</Label>
                <select
                  id="editRole"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "USER" | "ADMIN" | "SUPERADMIN" })}
                  className="w-full p-2 border border-border rounded-md bg-background"
                  disabled={editingUser?.id === currentUser?.id}
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Super Admin</option>
                </select>
                {editingUser?.id === currentUser?.id && (
                  <p className="text-xs text-muted-foreground">You cannot change your own role</p>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">Update User</Button>
                <Button type="button" variant="outline" onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingUser(null);
                  resetForm();
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminManagement;
