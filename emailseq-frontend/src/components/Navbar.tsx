import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, BarChart3, Mail, Users, FileText, Layers, Shield, Target, ArrowLeft, Menu, X, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { api, User as UserType } from "@/lib/api";
import { toast } from "sonner";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isImpersonating = api.isImpersonating();

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.getCurrentUser();
        setCurrentUser(response.user);
      } catch (error) {
        console.error('Failed to fetch current user:', error);
      }
    };

    fetchCurrentUser();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const handleStopImpersonating = () => {
    api.stopImpersonating();
    toast.success("Back to Admin account");
    window.location.href = "/admin-management";
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      navigate("/login");
    }
  };

  const getUserInitials = () => {
    if (!currentUser) return 'U';
    const firstName = currentUser.firstName || '';
    const lastName = currentUser.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    return currentUser.email[0].toUpperCase();
  };

  const navLinks = isImpersonating 
    ? [
        { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
        { to: "/reports", label: "Reports", icon: BarChart3 },
        { to: "/email-activity", label: "Email Activity", icon: Layers },
      ]
    : (() => {
        const base = [
          { to: "/smtp-settings", label: "SMTP Settings", icon: Mail },
          { to: "/templates", label: "Templates", icon: FileText },
          { to: "/campaigns", label: "Campaigns", icon: Target },
          { to: "/sequences", label: "Sequences", icon: Mail },
          { to: "/leads", label: "Leads", icon: Users },
          { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
          { to: "/email-activity", label: "Email Activity", icon: Layers },
          { to: "/reports", label: "Reports", icon: BarChart3 },
          { to: "/profile", label: "Profile", icon: User },
        ];

        if (currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'MANAGER') {
          const links = [...base];
          const profileItem = links.pop();
          links.push({ 
            to: "/admin-management", 
            label: currentUser.role === 'SUPERADMIN' ? "Admin Management" : "My Team", 
            icon: currentUser.role === 'SUPERADMIN' ? Shield : Users 
          });
          if (profileItem) links.push(profileItem);
          return links;
        }
        return base;
      })();

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40 shadow-card"
      >
        <div className="container mx-auto px-4 md:px-6 py-2">
          <div className="flex items-center justify-between h-12">
            {/* Mobile Menu Button - Left Side */}
            <div className="flex md:hidden flex-none">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-muted/50 rounded-lg"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent whitespace-nowrap cursor-pointer flex-1 md:flex-none ml-2 md:ml-0"
              onClick={() => navigate("/dashboard")}
            >
              BN Mail
            </motion.div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center justify-end space-x-1 flex-1 pr-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `relative px-3 py-1.5 rounded-lg transition-smooth flex items-center gap-2 ${isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <link.icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{link.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="navbar-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 gradient-primary rounded-full"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Profile Dropdown & Impersonation Alert */}
            <div className="flex items-center justify-end gap-2 md:gap-4 flex-none">
              {currentUser && isImpersonating && currentUser.role !== 'SUPERADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopImpersonating}
                  className="flex items-center gap-2 border-yellow-500/50 hover:bg-yellow-50 text-yellow-700 bg-yellow-50/50 h-8 text-xs md:text-sm"
                >
                  <ArrowLeft className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="focus:outline-none"
                  >
                    <Avatar className="h-8 w-8 border-2 border-primary/20 cursor-pointer">
                      <AvatarFallback className="gradient-primary text-white font-semibold text-xs">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 glass-dark">
                  {!isImpersonating && (
                    <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                  )}
                  {!isImpersonating && (
                    <DropdownMenuItem onClick={() => navigate("/unsubscribed-contacts")} className="cursor-pointer">
                      <UserX className="mr-2 h-4 w-4" />
                      Unsubscribed Contacts
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="md:hidden glass border-t border-border/40 overflow-hidden shadow-xl max-h-[calc(100vh-64px)] overflow-y-auto"
            >
              <div className="flex flex-col p-4 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-4 mb-2">
                  Navigation
                </div>
                {navLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`
                    }
                  >
                    <link.icon className="w-5 h-5 shadow-sm" />
                    <span className="text-[15px]">{link.label}</span>
                  </NavLink>
                ))}
                
                <div className="h-px bg-border/40 my-2 mx-4" />
                
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all text-left w-full"
                >
                  <div className="w-5 h-5 flex items-center justify-center">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <span className="text-[15px]">Logout</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Backdrop for mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-background/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
