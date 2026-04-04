import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Users, BookOpen, GraduationCap, Megaphone, MessageSquare, BarChart3, LogOut, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { to: '/admin/students', label: 'Students', icon: GraduationCap },
    { to: '/admin/teachers', label: 'Teachers', icon: Users },
    { to: '/admin/subjects', label: 'Subjects', icon: BookOpen },
    { to: '/admin/attendance', label: 'Attendance', icon: BarChart3 },
    { to: '/admin/exams', label: 'Exams & Marks', icon: ClipboardList },
    { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare }
  ];

  return (
    <div className="min-h-screen flex" data-testid="admin-layout">
      <aside className="w-64 bg-[#09090B] text-white border-r border-zinc-800" data-testid="admin-sidebar">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">COLLEGE ADMIN</h1>
          <p className="text-xs text-zinc-400 mt-1 uppercase tracking-wider">{user?.name}</p>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-medium uppercase tracking-wider duration-150 border-l-4 ${
                    isActive
                      ? 'border-[#002FA7] bg-white/10 text-white'
                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-64 p-4 border-t border-zinc-800">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/5 rounded-none"
            data-testid="logout-button"
          >
            <LogOut size={18} strokeWidth={2} className="mr-3" />
            LOGOUT
          </Button>
        </div>
      </aside>
      <main className="flex-1 bg-white">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
