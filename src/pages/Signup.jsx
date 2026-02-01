import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { Link, useNavigate } from 'react-router-dom';

export default function Signup() {
  const [username, setUsername] = useState(''); // ADD THIS
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);  
  const navigate = useNavigate();
  
  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // ADD THIS: Set the username as displayName
      await updateProfile(userCredential.user, {
        displayName: username
      });
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInWithPopup(auth, googleProvider);
      // Google users already have a displayName from their Google account
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      backgroundColor: '#f3f4f6' 
    }}>
      <div style={{ 
        backgroundColor: 'teal-100', 
        padding: '32px', 
        borderRadius: '8px', 
        width: '384px' 
      }}>
        <p style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          marginBottom: '24px', 
          textAlign: 'center' 
        }}>
          Sign Up
        </p>
        
        {error && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            color: '#b91c1c', 
            padding: '12px', 
            borderRadius: '4px', 
            marginBottom: '16px' 
          }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSignup}>
          <div className='flex flex-col gap-4'>
          <div className="w-90 bg-gray-200 rounded">
              <label className="block text-xs font-semibold px-2 gap-1">USERNAME</label>
              <input type="text" className=" w-full rounded-xl px-2 text-lg focus:outline-none" value={username} onChange={(e) => setUsername(e.target.value)} required/>
            </div>

          <div className="w-90 bg-gray-200 rounded">
              <label className="block text-xs font-semibold px-2 gap-1">EMAIL</label>
              <input type="email" className=" w-full rounded-xl px-2 text-lg focus:outline-none" value={email} onChange={(e) => setEmail(e.target.value)} required/>
            </div>
          <div className="w-90 bg-gray-200 rounded">
              <label className="block text-xs font-semibold px-2 gap-1">PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className=" w-full rounded-xl px-2 text-lg focus:outline-none"/>
            </div>
          <div className="w-90 bg-gray-200 rounded">
              <label className="block text-xs font-semibold px-2 gap-1">CONFIRM PASSWORD</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className=" w-full rounded-xl px-2 text-lg focus:outline-none"/>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="my-4 w-90 rounded bg-black text-white p-3 hover:scale-101 transition-all"
          >
            {'Create Account'}
          </button>
        </form>

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="mb-3 w-90 rounded bg-black text-white p-3 hover:scale-101 transition-all"
        >
          <span>🔍</span> Sign up with Google
        </button>

        <p style={{ 
          textAlign: 'center', 
          color: '#6b7280',
          fontSize: '14px'
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ 
            color: '#3b82f6', 
            textDecoration: 'none' 
          }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}