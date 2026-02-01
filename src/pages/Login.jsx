import google_logo from "../images/google_logo.png"
import {useState} from "react"
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { Link, useNavigate } from 'react-router-dom';
import logo from "../images/logo.png";


const LoginPage = () => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


    return (
      <div className="flex flex-col min-h-screen bg-slate-100">  
        <img className = "pl-2 pt-2 h-10 w-10" src = {logo}/>
        <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-3xl font-semibold">Sign in</p>

            <div className="flex flex-col items-center justify-center bg-slate-70 border mt-8 border-black rounded w-90 text-center">
              <button className="flex py-1 px-6" onClick={handleGoogleLogin} disabled={loading}>
                <img src={google_logo} className="h-6"/>
                <p className="font-light text-xl pl-2"> Continue with Google</p>
              </button>
            </div>

            <p className="py-3">or</p>

            <div className="w-90 bg-gray-200 rounded">
              <label className="block text-xs font-semibold px-2 gap-1">EMAIL</label>
              <input type="email" className=" w-full rounded-xl px-2 text-lg focus:outline-none" value={email} onChange={(e) => setEmail(e.target.value)} required/>
            </div>

            <div className="w-90 bg-gray-200 rounded m-3">
              <label className="block text-xs font-semibold px-2 gap-1">PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className=" w-full rounded-xl px-2 text-lg focus:outline-none"/>
            </div>

            <button className="m-4 w-90 rounded bg-black text-white p-3 hover:scale-101 transition-all" onClick={handleEmailLogin} disabled={loading} >
              Log In
            </button>

            <div className="flex gap-1">
              <p className="text-xs">No account?</p>
              <a className="text-blue-500 text-xs" href="/signup">Create one</a>
            </div>
        </div>
      </div>
    );
};  

export default LoginPage;