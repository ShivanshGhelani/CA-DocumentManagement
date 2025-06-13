import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    navigate('/signin');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const NavLink = ({ 
    to, 
    children, 
    className = "",
    onClick 
  }: { 
    to: string; 
    children: React.ReactNode; 
    className?: string;
    onClick?: () => void;
  }) => (
    <button
      onClick={() => {
        if (onClick) onClick();
        navigate(to);
        setMobileMenuOpen(false);
      }}
      className={`${className} ${
        isActive(to) 
          ? 'bg-blue-700 text-white' 
          : 'text-blue-100 hover:text-white hover:bg-blue-700'
      } px-3 py-2 rounded-md text-sm font-medium transition-colors`}
    >
      {children}
    </button>
  );

  return (
    <nav className="bg-blue-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/')} 
              className="text-white text-xl font-bold hover:text-blue-200 transition-colors flex items-center"
            >
              📄 Document Management
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <NavLink to="/documents">My Documents</NavLink>
                  <NavLink to="/documents/create">Upload Document</NavLink>
                  
                  {/* User Menu */}
                  <div className="flex items-center space-x-4 ml-6 pl-6 border-l border-blue-500">
                    <div className="text-blue-100 text-sm">
                      Welcome, <span className="font-medium">{user?.first_name || user?.email}</span>!
                    </div>
                    <button
                      onClick={handleLogout}
                      className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <NavLink to="/signin">Sign In</NavLink>
                  <NavLink 
                    to="/signup"
                    className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Sign Up
                  </NavLink>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-blue-200 focus:outline-none focus:text-blue-200"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 border-t border-blue-500">
              {isAuthenticated ? (
                <>
                  <NavLink to="/documents" className="block">My Documents</NavLink>
                  <NavLink to="/documents/create" className="block">Upload Document</NavLink>
                  
                  <div className="pt-4 mt-4 border-t border-blue-500">
                    <div className="text-blue-100 text-sm px-3 py-2">
                      Welcome, {user?.first_name || user?.email}!
                    </div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors mt-2"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <NavLink to="/signin" className="block">Sign In</NavLink>
                  <NavLink to="/signup" className="block">Sign Up</NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}                <button
                  onClick={handleLogout}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/signin')}
                  className="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
