import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Edit, Save, Mail, User as UserIcon, Briefcase } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "Arnav Wasnik",
    email: "arnav@arnavsales.com",
    role: "Sales Executive",
  });

  const [targets, setTargets] = useState({
    dailyTarget: 50,
    emailsSentToday: 38,
    conversionRate: 15.2,
  });

  const [editTargets, setEditTargets] = useState({ ...targets });
  const [isEditingTargets, setIsEditingTargets] = useState(false);

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
                    {profileData.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                  disabled={!isEditing}
                  className="rounded-xl"
                />
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
                <Input
                  id="role"
                  value={profileData.role}
                  onChange={(e) =>
                    setProfileData({ ...profileData, role: e.target.value })
                  }
                  disabled={!isEditing}
                  className="rounded-xl"
                />
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
