import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Edit, Save, Mail, User as UserIcon, Briefcase, Shield, Crown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api, User } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  const [targets, setTargets] = useState({
    dailyTarget: 50,
    emailsSentToday: 38,
    conversionRate: 15.2,
  });

  const [editTargets, setEditTargets] = useState({ ...targets });
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  // Fetch current user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const response = await api.getCurrentUser();
        setUser(response.user);
        setProfileData({
          firstName: response.user.firstName || "",
          lastName: response.user.lastName || "",
          email: response.user.email,
        });
        setError("");
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleSaveProfile = () => {
    setIsEditing(false);
    toast.success("Profile updated successfully");
  };

  const handleSaveTargets = () => {
    setTargets(editTargets);
    setIsEditingTargets(false);
    toast.success("Targets updated successfully");
  };

  const progressPercentage = (targets.emailsSentToday / targets.dailyTarget) * 100;

  // Helper function to get role display info
  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return { label: 'Super Administrator', icon: Crown, color: 'text-yellow-500' };
      case 'ADMIN':
        return { label: 'Administrator', icon: Shield, color: 'text-blue-500' };
      case 'USER':
      default:
        return { label: 'User', icon: UserIcon, color: 'text-gray-500' };
    }
  };

  // Helper function to get user initials
  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    if (user.email) return user.email[0].toUpperCase();
    return 'U';
  };

  // Helper function to get full name
  const getFullName = () => {
    if (!user) return '';
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
              <p className="text-muted-foreground">Loading profile...</p>
            </div>
          </div>
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
          <h1 className="text-4xl font-bold mb-2">Profile</h1>
          <p className="text-muted-foreground">Manage your account and performance targets</p>
        </motion.div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-8 shadow-card hover-lift"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">Profile Information</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-xl"
              >
                <Edit className="w-5 h-5" />
              </Button>
            </div>

            {/* Avatar */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <Avatar className="h-32 w-32 border-4 border-primary/20">
                  <AvatarFallback className="gradient-primary text-white text-4xl font-bold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {user && (
                  <div className="absolute -bottom-2 -right-2 bg-background rounded-full p-2 border-2 border-primary/20">
                    {(() => {
                      const roleInfo = getRoleInfo(user.role);
                      const IconComponent = roleInfo.icon;
                      return <IconComponent className={`w-6 h-6 ${roleInfo.color}`} />;
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Profile Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) =>
                      setProfileData({ ...profileData, firstName: e.target.value })
                    }
                    disabled={!isEditing}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) =>
                      setProfileData({ ...profileData, lastName: e.target.value })
                    }
                    disabled={!isEditing}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                  disabled={!isEditing}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Role
                </Label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/50">
                  {user && (() => {
                    const roleInfo = getRoleInfo(user.role);
                    const IconComponent = roleInfo.icon;
                    return (
                      <>
                        <IconComponent className={`w-5 h-5 ${roleInfo.color}`} />
                        <span className="font-medium">{roleInfo.label}</span>
                        {user.role === 'SUPERADMIN' && (
                          <span className="ml-auto text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                            Full Access
                          </span>
                        )}
                        {user.role === 'ADMIN' && (
                          <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Admin Access
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Account Information */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="text-lg font-semibold mb-3">Account Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Account Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${user?.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="font-medium">{user?.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Member Since:</span>
                    <p className="font-medium mt-1">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {isEditing && (
                <Button
                  onClick={handleSaveProfile}
                  className="w-full gradient-primary text-white rounded-xl shadow-luxury mt-4"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              )}
            </div>
          </motion.div>

          {/* Daily Targets */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-8 shadow-card hover-lift"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">Daily Targets</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingTargets(!isEditingTargets)}
                className="rounded-xl"
              >
                <Edit className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Daily Target */}
              <div className="space-y-2">
                <Label htmlFor="dailyTarget">Daily Email Target</Label>
                <Input
                  id="dailyTarget"
                  type="number"
                  value={
                    isEditingTargets ? editTargets.dailyTarget : targets.dailyTarget
                  }
                  onChange={(e) =>
                    setEditTargets({
                      ...editTargets,
                      dailyTarget: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditingTargets}
                  className="rounded-xl text-lg font-semibold"
                />
              </div>

              {/* Progress Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Today's Progress</Label>
                  <span className="text-sm font-semibold text-primary">
                    {progressPercentage.toFixed(0)}% – {targets.emailsSentToday} of {targets.dailyTarget}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3 rounded-full" />
                <p className="text-xs text-muted-foreground text-center">
                  {targets.dailyTarget - targets.emailsSentToday} emails remaining to reach daily goal
                </p>
              </div>

              {/* Emails Sent Today */}
              <div className="space-y-2">
                <Label htmlFor="emailsSent">Emails Sent Today</Label>
                <Input
                  id="emailsSent"
                  type="number"
                  value={
                    isEditingTargets
                      ? editTargets.emailsSentToday
                      : targets.emailsSentToday
                  }
                  onChange={(e) =>
                    setEditTargets({
                      ...editTargets,
                      emailsSentToday: parseInt(e.target.value),
                    })
                  }
                  disabled={!isEditingTargets}
                  className="rounded-xl text-lg font-semibold"
                />
              </div>

              {/* Conversion Rate */}
              <div className="space-y-2">
                <Label htmlFor="conversionRate">Conversion Rate (%)</Label>
                <Input
                  id="conversionRate"
                  type="number"
                  step="0.1"
                  value={
                    isEditingTargets
                      ? editTargets.conversionRate
                      : targets.conversionRate
                  }
                  onChange={(e) =>
                    setEditTargets({
                      ...editTargets,
                      conversionRate: parseFloat(e.target.value),
                    })
                  }
                  disabled={!isEditingTargets}
                  className="rounded-xl text-lg font-semibold"
                />
              </div>

              {isEditingTargets && (
                <Button
                  onClick={handleSaveTargets}
                  className="w-full gradient-primary text-white rounded-xl shadow-luxury"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Targets
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
