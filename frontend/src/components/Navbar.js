import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, User, LogOut, Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="glass fixed top-0 left-0 right-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="logo-link">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#06B6D4] flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight font-['Outfit']">
              Bid<span className="text-[#06B6D4]">Blitz</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link 
              to="/auctions" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium"
              data-testid="nav-auctions"
            >
              Auktionen
            </Link>
            <Link 
              to="/buy-bids" 
              className="text-[#94A3B8] hover:text-white transition-colors font-medium"
              data-testid="nav-buy-bids"
            >
              Gebote kaufen
            </Link>
            {isAuthenticated && (
              <Link 
                to="/dashboard" 
                className="text-[#94A3B8] hover:text-white transition-colors font-medium"
                data-testid="nav-dashboard"
              >
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link 
                to="/admin" 
                className="text-[#F59E0B] hover:text-[#FCD34D] transition-colors font-medium flex items-center gap-1"
                data-testid="nav-admin"
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#181824] border border-white/10">
                  <Zap className="w-4 h-4 text-[#06B6D4]" />
                  <span className="font-mono font-bold text-[#06B6D4]" data-testid="bids-balance">
                    {user?.bids_balance || 0}
                  </span>
                  <span className="text-[#94A3B8] text-sm">Gebote</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#94A3B8]" data-testid="user-name">{user?.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="text-[#94A3B8] hover:text-white hover:bg-white/10"
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" className="text-[#94A3B8] hover:text-white" data-testid="login-btn">
                    Anmelden
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="btn-primary" data-testid="register-btn">
                    Registrieren
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0F0F16] border-t border-white/10">
          <div className="px-4 py-4 space-y-3">
            <Link 
              to="/auctions" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Auktionen
            </Link>
            <Link 
              to="/buy-bids" 
              className="block text-[#94A3B8] hover:text-white py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Gebote kaufen
            </Link>
            {isAuthenticated && (
              <>
                <Link 
                  to="/dashboard" 
                  className="block text-[#94A3B8] hover:text-white py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    className="block text-[#F59E0B] hover:text-[#FCD34D] py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
                <div className="flex items-center gap-2 py-2">
                  <Zap className="w-4 h-4 text-[#06B6D4]" />
                  <span className="font-mono font-bold text-[#06B6D4]">{user?.bids_balance || 0}</span>
                  <span className="text-[#94A3B8] text-sm">Gebote</span>
                </div>
                <button 
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="block text-[#EF4444] py-2"
                >
                  Abmelden
                </button>
              </>
            )}
            {!isAuthenticated && (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="text-white">Anmelden</Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="btn-primary">Registrieren</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
