import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
// @ts-ignore
import { authAPI } from '../services/api';

interface User {
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

// Function to get initials from user profile
const getInitials = (user: User | null) => {
  if (!user) return 'U';

  if (user.first_name && user.last_name) {
    return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
  }

  if (user.first_name) {
    return user.first_name.charAt(0).toUpperCase();
  }

  if (user.email) {
    return user.email.charAt(0).toUpperCase();
  }

  return 'U';
};

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    setIsClient(true);
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    setUser(storedUser ? JSON.parse(storedUser) : null);
    setIsAuthenticated(!!token);
    // Fetch current profile data to get updated avatar
    if (token && isClient) {
      authAPI.getProfile()
        .then((profileData: User) => {
          setUser(profileData);
          localStorage.setItem('user', JSON.stringify(profileData));
        })
        .catch((error: any) => {
          console.error('Error fetching profile:', error);
        });
    }
  }, [isClient]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
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
      className={`${className} ${isActive(to)
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
            <div className="flex items-center justify-center space-x-4">
              {isAuthenticated ? (
              <>
                <NavLink to="/documents">My Documents</NavLink>
                <NavLink to="/trash" className='flex items-center space-x-3 gap-2'><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                  Trash
                </NavLink>
                <NavLink to="/archive" className='flex items-center space-x-3 gap-2'>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                  </svg>

                  Archives
                </NavLink>
                {/* User Menu */}
                <div className="flex items-center space-x-4 ml pl-3 border-l border-blue-500">
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex items-center space-x-2 hover:bg-blue-700 rounded-md px-2 py-1 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center overflow-hidden">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                          {getInitials(user)}
                        </div>
                      )}
                    </div>
                    <div className="text-blue-100 text-sm text-left">
                      <div className="font-medium">{user?.first_name || 'User'}</div>
                      <div className="text-xs text-blue-200">{user?.email}</div>
                    </div>
                  </button>
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

                  <NavLink to="/documents/create" className="block ">Upload Document</NavLink>
                  <div className="pt-4 mt-4 border-t border-blue-500">                    <button
                    onClick={() => {
                      navigate('/profile');
                      setMobileMenuOpen(false);
                    }} className="flex items-center space-x-3 px-3 py-2 hover:bg-blue-700 rounded-md transition-colors w-full text-left"
                  >
                    <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center overflow-hidden">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                          {getInitials(user)}
                        </div>
                      )}
                    </div>
                    <div className="text-blue-100 text-sm text-left">
                      <div className="font-medium">{user?.first_name || 'User'}</div>
                      <div className="text-xs text-blue-200">{user?.email}</div>
                    </div>
                  </button>
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
