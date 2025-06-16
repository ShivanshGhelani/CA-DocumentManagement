import type { Route } from "./+types/home";
// @ts-ignore  
import Navigation from "../../src/components/Navigation";
import { useNavigate } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Document Management System" },
    { name: "description", content: "Secure document management and collaboration platform" },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const isAuthenticated = typeof window !== 'undefined' && !!localStorage.getItem('access_token');

  return (
    <>
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <h1 className="text-4xl font-bold mb-6">📄 Document Management</h1>
            <p className="text-xl text-gray-600 mb-8">
              Secure, organized, and collaborative document management made simple.
            </p>
            
            {isAuthenticated ? (
              <div>
                <p className="mb-6 text-gray-700">Welcome back! Manage your documents efficiently.</p>
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={() => navigate('/documents')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-md transition-colors"
                  >
                    View Documents
                  </button>
                  <button
                    onClick={() => navigate('/documents/create')}
                    className="px-6 py-3 border border-blue-600 text-blue-600 hover:bg-blue-50 text-lg font-medium rounded-md transition-colors"
                  >
                    Upload New Document
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-6 text-gray-700">Get started by creating an account or signing in.</p>
                <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={() => navigate('/signup')}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-md transition-colors"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={() => navigate('/signin')}
                    className="px-6 py-3 border border-blue-600 text-blue-600 hover:bg-blue-50 text-lg font-medium rounded-md transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}
            
            <hr className="my-8 border-gray-200" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h5 className="text-lg font-semibold mb-2">🔒 Secure</h5>
                <p className="text-gray-600 text-sm">End-to-end encryption and MFA support</p>
              </div>
              <div>
                <h5 className="text-lg font-semibold mb-2">📁 Organized</h5>
                <p className="text-gray-600 text-sm">Tag-based organization and powerful search</p>
              </div>
              <div>
                <h5 className="text-lg font-semibold mb-2">🤝 Collaborative</h5>
                <p className="text-gray-600 text-sm">Share documents with team members</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
