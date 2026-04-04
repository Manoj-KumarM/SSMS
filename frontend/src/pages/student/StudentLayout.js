import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { QrCode, BookOpen, FileText, Megaphone, MessageSquare, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const StudentLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/student/dashboard', label: 'Dashboard', icon: BookOpen },
    { to: '/student/attendance', label: 'Attendance', icon: QrCode },
    { to: '/student/marks', label: 'Marks', icon: FileText },
    { to: '/student/notes', label: 'Notes', icon: FileText },
    { to: '/student/announcements', label: 'Announcements', icon: Megaphone },
    { to: '/student/feedback', label: 'Feedback', icon: MessageSquare }
  ];

  return (
    <div className="min-h-screen flex" data-testid="student-layout">
      <aside className="w-64 bg-[#09090B] text-white border-r border-zinc-800">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-black tracking-tight">STUDENT PORTAL</h1>
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

export default StudentLayout;
