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
          {/* Logo */}          <div className="flex items-center">
            <button 
              onClick={() => navigate('/')} 
              className="text-white text-xl font-bold hover:text-blue-200 transition-colors flex items-center"
            >
              <svg className="w-8 h-8 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Document Management
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
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="text-blue-100 text-sm">
                        <div className="font-medium">{user?.first_name || 'User'}</div>
                        <div className="text-xs text-blue-200">{user?.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
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
                    <div className="flex items-center space-x-3 px-3 py-2">
                      <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="text-blue-100 text-sm">
                        <div className="font-medium">{user?.first_name || 'User'}</div>
                        <div className="text-xs text-blue-200">{user?.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full text-left bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors mt-2"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
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
}
