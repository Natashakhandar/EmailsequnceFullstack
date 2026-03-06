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
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { api, User } from "@/lib/api";

const AdminManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "USER" as "USER" | "ADMIN" | "SUPERADMIN",
    isActive: true
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "USER" as "USER" | "ADMIN" | "SUPERADMIN"
  });

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
      toast.success('User created successfully! They can now login.');
      setIsCreateDialogOpen(false);
      resetForm();
      await fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
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

  const handleEditClick = (user: User) => {
    setEditingUserId(user.id);
    setEditFormData({
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      isActive: user.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    try {
      await api.updateUser(editingUserId, editFormData);
      toast.success('User updated successfully!');
      setIsEditDialogOpen(false);
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.deleteUser(userId);
      toast.success('User deleted successfully!');
      await fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const handleImpersonate = async (user: User) => {
    try {
      const response = await api.impersonateUser(user.id);
      toast.success(`Viewing work for ${user.email}...`);

      // The api.impersonateUser method should store the token and return it
      // Redirect to dashboard
      window.location.href = "/dashboard";
    } catch (error) {
      console.error('Impersonation failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to view user work');
    }
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
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
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
              <p className="text-muted-foreground">Loading...</p>
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
              <p className="text-muted-foreground">Create and manage user accounts</p>
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
                    <Input
                      id="role"
                      value="User"
                      disabled
                      className="w-full bg-muted/50 cursor-not-allowed"
                    />
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
                        value={editFormData.firstName}
                        onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editLastName">Last Name</Label>
                      <Input
                        id="editLastName"
                        value={editFormData.lastName}
                        onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editEmail">Email</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editRole">Role</Label>
                    <Input
                      id="editRole"
                      value={editFormData.role === "USER" ? "User" : editFormData.role === "ADMIN" ? "Admin" : "Super Admin"}
                      disabled
                      className="w-full bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2 flex items-center justify-between">
                    <Label>Active Status</Label>
                    <input
                      type="checkbox"
                      className="w-4 h-4 cursor-pointer"
                      checked={editFormData.isActive}
                      onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">Update User</Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
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

        {/* Users Grid */}
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
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="gradient-primary text-white font-semibold">
                        {getUserInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{getFullName(user)}</CardTitle>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <IconComponent className={`w-5 h-5 flex-shrink-0 ${roleInfo.color.includes('yellow') ? 'text-yellow-600' : roleInfo.color.includes('blue') ? 'text-blue-600' : 'text-gray-600'}`} />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 shadow-luxury glass border-muted/20">
                          <DropdownMenuItem
                            className="cursor-pointer flex items-center gap-2 text-primary focus:text-primary focus:bg-primary/5"
                            onClick={() => handleImpersonate(user)}
                          >
                            <Eye className="w-4 h-4" />
                            <span>View User's Work</span>
                          </DropdownMenuItem>

                          {user.id !== currentUser?.id && (
                            <>
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-2 text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                                onClick={() => handleEditClick(user)}
                              >
                                <Edit2 className="w-4 h-4" />
                                <span>Edit User</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete User</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
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
      </main>
    </div>
  );
};

export default AdminManagement;
