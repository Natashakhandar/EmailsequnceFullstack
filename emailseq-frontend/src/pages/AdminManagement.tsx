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
  MoreVertical,
  Users as UsersIcon,
  UserX,
  CalendarDays,
  MessageSquare
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    role: "USER" as "USER" | "ADMIN" | "SUPERADMIN" | "MANAGER",
    isActive: true,
    managedUserIds: [] as string[]
  });

  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [activeTab, setActiveTab] = useState<"users" | "unsubscribed">("users");
  const [unsubscribedUsers, setUnsubscribedUsers] = useState<any[]>([]);
  const [unsubLoadError, setUnsubLoadError] = useState("");
  const [unsubLoading, setUnsubLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "USER" as "USER" | "ADMIN" | "SUPERADMIN" | "MANAGER",
    managedUserIds: [] as string[]
  });

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const response = await api.getCurrentUser();
        setCurrentUser(response.user);

        if (response.user.role !== 'SUPERADMIN' && response.user.role !== 'MANAGER') {
          setError('Access denied. Only superadmins and managers can view this page.');
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

  const fetchUnsubscribedUsers = async () => {
    setUnsubLoading(true);
    setUnsubLoadError("");
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(
        `${(await import('@/lib/api')).API_BASE_URL}/unsubscribe/admin/list?limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setUnsubscribedUsers(data.contacts || []);
    } catch (e: any) {
      setUnsubLoadError(e.message || 'Failed to load unsubscribed users');
    } finally {
      setUnsubLoading(false);
    }
  };

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
      role: "USER",
      managedUserIds: []
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
      isActive: user.isActive,
      managedUserIds: (user as any).managedUsers?.map((u: any) => u.id) || []
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

  const handlePasswordClick = (user: User) => {
    setPasswordUserId(user.id);
    setNewPassword("");
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUserId || !newPassword) return;

    try {
      await api.changeUserPassword(passwordUserId, newPassword);
      toast.success('Password updated successfully!');
      setIsPasswordDialogOpen(false);
      setNewPassword("");
      setPasswordUserId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    }
  };

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return { label: 'Super Admin', icon: Crown, color: 'bg-yellow-100 text-yellow-800', badgeVariant: 'default' as const };
      case 'ADMIN':
        return { label: 'Admin', icon: Shield, color: 'bg-blue-100 text-blue-800', badgeVariant: 'secondary' as const };
      case 'MANAGER':
        return { label: 'Manager', icon: UsersIcon, color: 'bg-green-100 text-green-800', badgeVariant: 'default' as const };
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

  if (currentUser?.role !== 'SUPERADMIN' && currentUser?.role !== 'MANAGER') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
        <Navbar />
        <main className="container mx-auto px-6 pt-24 pb-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Access denied. You do not have permission to access this page.
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
              <h1 className="text-4xl font-bold mb-2">
                {currentUser?.role === 'SUPERADMIN' ? 'User Management' : 'My Team'}
              </h1>
              <p className="text-muted-foreground">
                {currentUser?.role === 'SUPERADMIN' ? 'Create and manage user accounts' : 'View and monitor your managed users'}
              </p>
            </div>
            {currentUser?.role === 'SUPERADMIN' && (
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
                      <Select
                        value={formData.role}
                        onValueChange={(value: any) => setFormData({ ...formData, role: value, managedUserIds: [] })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">User</SelectItem>
                          <SelectItem value="MANAGER">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.role === "MANAGER" && (
                      <div className="space-y-2">
                        <Label>Assign Users to Manage</Label>
                        <ScrollArea className="h-32 w-full rounded-md border p-2">
                          {users.filter(u => u.role === "USER").length === 0 ? (
                            <p className="text-xs text-muted-foreground p-2">No regular users available to assign.</p>
                          ) : (
                            users.filter(u => u.role === "USER").map(user => (
                              <div key={user.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`user-${user.id}`}
                                  checked={formData.managedUserIds.includes(user.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFormData({ ...formData, managedUserIds: [...formData.managedUserIds, user.id] });
                                    } else {
                                      setFormData({ ...formData, managedUserIds: formData.managedUserIds.filter(id => id !== user.id) });
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`user-${user.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {getFullName(user)} ({user.email})
                                </label>
                              </div>
                            ))
                          )}
                        </ScrollArea>
                      </div>
                    )}
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
            )}

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
                    <Select
                      value={editFormData.role}
                      onValueChange={(value: any) => setEditFormData({ ...editFormData, role: value, managedUserIds: [] })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editFormData.role === "MANAGER" && (
                    <div className="space-y-2">
                      <Label>Manageable Users</Label>
                      <ScrollArea className="h-32 w-full rounded-md border p-2">
                        {users.filter(u => u.role === "USER" && u.id !== editingUserId).length === 0 ? (
                          <p className="text-xs text-muted-foreground p-2">No regular users available to assign.</p>
                        ) : (
                          users.filter(u => u.role === "USER" && u.id !== editingUserId).map(user => (
                            <div key={user.id} className="flex items-center space-x-2 py-1">
                              <Checkbox
                                id={`edit-user-${user.id}`}
                                checked={editFormData.managedUserIds.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setEditFormData({ ...editFormData, managedUserIds: [...editFormData.managedUserIds, user.id] });
                                  } else {
                                    setEditFormData({ ...editFormData, managedUserIds: editFormData.managedUserIds.filter(id => id !== user.id) });
                                  }
                                }}
                              />
                              <label
                                htmlFor={`edit-user-${user.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {getFullName(user)} ({user.email})
                              </label>
                            </div>
                          ))
                        )}
                      </ScrollArea>
                    </div>
                  )}
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

            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
              <DialogContent className="sm:max-w-md text-foreground">
                <DialogHeader>
                  <DialogTitle>Change User Password</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1 gradient-primary text-white">Update Password</Button>
                    <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
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

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm transition-colors ${
              activeTab === "users"
                ? "bg-primary text-white shadow"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Users
          </button>
          {currentUser?.role === 'SUPERADMIN' && (
            <button
              onClick={() => {
                setActiveTab("unsubscribed");
                fetchUnsubscribedUsers();
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm transition-colors ${
                activeTab === "unsubscribed"
                  ? "bg-primary text-white shadow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <UserX className="w-4 h-4" />
              Unsubscribed Users
            </button>
          )}
        </div>

        {/* Unsubscribed Users Tab */}
        {activeTab === "unsubscribed" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {unsubLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            )}
            {unsubLoadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{unsubLoadError}</AlertDescription>
              </Alert>
            )}
            {!unsubLoading && !unsubLoadError && (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {unsubscribedUsers.length} contact{unsubscribedUsers.length !== 1 ? 's' : ''} have unsubscribed from email sequences.
                </p>
                {unsubscribedUsers.length === 0 ? (
                  <div className="text-center py-16">
                    <UserX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Unsubscribed Users</h3>
                    <p className="text-muted-foreground">No contacts have unsubscribed yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-muted/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 text-left">
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">
                            <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Reason</span>
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Date</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {unsubscribedUsers.map((u, i) => (
                          <tr key={u.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                            <td className="px-4 py-3 font-medium">{u.email}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                            </td>
                            <td className="px-4 py-3">
                              {u.unsubscribeReason ? (
                                <span className="inline-block bg-orange-100 text-orange-700 text-xs rounded-full px-2 py-0.5">
                                  {u.unsubscribeReason}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {u.unsubscribedAt
                                ? new Date(u.unsubscribedAt).toLocaleDateString('en-IN', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })
                                : u.updatedAt
                                  ? new Date(u.updatedAt).toLocaleDateString('en-IN', {
                                      year: 'numeric', month: 'short', day: 'numeric'
                                    })
                                  : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* Users Grid */}
        {activeTab === "users" && (
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

                          {user.id !== currentUser?.id && currentUser?.role === 'SUPERADMIN' && (
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
                              <DropdownMenuItem
                                className="cursor-pointer flex items-center gap-2 text-yellow-600 focus:text-yellow-600 focus:bg-yellow-50"
                                onClick={() => handlePasswordClick(user)}
                              >
                                <AlertCircle className="w-4 h-4" />
                                <span>Change Password</span>
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
                    {(user as any).managedUsers?.length > 0 && (
                      <p className="text-xs text-primary font-medium">
                        Managing {(user as any).managedUsers.length} users
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
        )}

        {users.length === 0 && !loading && activeTab === "users" && (
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
