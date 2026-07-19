import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Navbar() {
  const { currentUser, userData, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = currentUser
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
        { to: '/plan', label: 'Plan Route', icon: '🗺️' },
        { to: '/chargers', label: 'Find Chargers', icon: '⚡' },
        { to: '/chat', label: 'Chat', icon: '💬' },
      ]
    : [
        { to: '/login', label: 'Login', icon: '🔑' },
        { to: '/register', label: 'Register', icon: '📝' },
      ];

  return (
    <nav className="bg-[#1e293b] border-b border-[#334155] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to={currentUser ? '/dashboard' : '/login'} className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-[#10b981] text-lg">EV Route Planner</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'bg-[#10b981]/20 text-[#10b981]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#334155]'
                }`}
              >
                <span className="mr-1">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {currentUser && (
              <>
                <Link to="/profile" className="flex items-center gap-2 text-sm text-[#94a3b8] hover:text-white">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#334155] flex items-center justify-center text-xs">
                      {(userData?.displayName || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span>{userData?.displayName || 'User'}</span>
                </Link>
                <button onClick={handleLogout} className="text-sm text-[#94a3b8] hover:text-[#ef4444] transition-colors">
                  Logout
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-[#94a3b8] hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[#334155] bg-[#1e293b] slide-up">
          <div className="px-4 py-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === link.to
                    ? 'bg-[#10b981]/20 text-[#10b981]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#334155]'
                }`}
              >
                <span className="mr-2">{link.icon}</span>
                {link.label}
              </Link>
            ))}
            {currentUser && (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-[#334155]"
                >
                  👤 Profile
                </Link>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-sm text-[#ef4444] hover:bg-[#334155]"
                >
                  🚪 Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
