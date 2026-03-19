import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { LanguageSwitcher } from '@/components/custom/LanguageSwitcher';
import { ThemeToggle } from '@/components/custom/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserCheck,
  Heart,
  ClipboardCheck,
  BookOpen,
  CreditCard,
  Bus,
  MessageSquare,
  Calendar,
  FileText,
  Settings,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';

interface NavChild {
  to: string;
  i18nKey: string;
}

interface NavItem {
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  i18nKey: string;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, i18nKey: 'nav.dashboard' },
  { to: '/students', icon: GraduationCap, i18nKey: 'nav.students' },
  { to: '/teachers', icon: Users, i18nKey: 'nav.teachers' },
  { to: '/staff', icon: UserCheck, i18nKey: 'nav.staff' },
  { to: '/parents', icon: Heart, i18nKey: 'nav.parents' },
  {
    icon: ClipboardCheck,
    i18nKey: 'nav.attendance',
    children: [
      { to: '/attendance', i18nKey: 'nav.attendance_daily' },
      { to: '/attendance/live', i18nKey: 'nav.attendance_live' },
      { to: '/attendance/reports', i18nKey: 'nav.attendance_reports' },
    ],
  },
  { to: '/exams', icon: BookOpen, i18nKey: 'nav.exams' },
  { to: '/finance', icon: CreditCard, i18nKey: 'nav.finance' },
  { to: '/transport', icon: Bus, i18nKey: 'nav.transport' },
  { to: '/communication', icon: MessageSquare, i18nKey: 'nav.communication' },
  { to: '/timetable', icon: Calendar, i18nKey: 'nav.timetable' },
  { to: '/homework', icon: FileText, i18nKey: 'nav.homework' },
  { to: '/reports', icon: FileText, i18nKey: 'nav.reports' },
  { to: '/settings', icon: Settings, i18nKey: 'nav.settings' },
];

export function DashboardLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Track which grouped nav sections are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'nav.attendance': location.pathname.startsWith('/attendance'),
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'U';

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 lg:relative lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-900">S</span>
            </div>
            <span className="font-semibold text-sidebar-foreground text-sm">SchoolSync</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* School name */}
        {user?.tenant && (
          <div className="px-4 py-2.5 border-b border-sidebar-border">
            <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider font-medium">School</p>
            <p className="text-sm font-medium text-sidebar-foreground truncate mt-0.5">{user.tenant.name}</p>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            // Group item with children (e.g. Attendance)
            if (item.children) {
              const isGroupActive = item.children.some((c) =>
                location.pathname === c.to || location.pathname.startsWith(c.to + '/'),
              );
              const isExpanded = expandedGroups[item.i18nKey] ?? isGroupActive;
              return (
                <div key={item.i18nKey} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.i18nKey)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isGroupActive
                        ? 'text-sidebar-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{t(item.i18nKey)}</span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform text-sidebar-foreground/50',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end
                          onClick={() => setIsSidebarOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                              isActive
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                            )
                          }
                        >
                          {t(child.i18nKey)}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Regular flat nav item
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-0.5',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t(item.i18nKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40 text-center">
            {user?.tenant?.plan} Plan
          </p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between px-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <Separator orientation="vertical" className="h-5 mx-1" />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-9 px-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:block">{fullName}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{fullName}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('auth.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 fade-in">
          <Outlet />
        </main>
      </div>

      <Toaster richColors position="top-right" />
    </div>
  );
}
