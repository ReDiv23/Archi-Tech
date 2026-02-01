import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { getProjects } from "../services/projectService";
import { useEffect, useState } from "react";
import { createProject } from "../services/projectService";
import expand_icon from "../images/expand_icon.png";
import delete_icon from "../images/delete.png";
import rename_icon from "../images/rename.png";
import share_icon from "../images/share.png";
import { renameProject } from "../services/projectService";
import { deleteProject } from "../services/projectService";
import { enableSharing } from "../services/projectService";
import logo from "../images/logo.png";

function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [showProfile,setShowProfile] = useState(false);
  const [projects, setProjects] = useState([]);
  const [showFooter,setShowFooter] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getProjects(currentUser.uid);
      setProjects(data);
    }
    load();
  }, [currentUser]);

  const handleNewProject = async () => {
    const id = await createProject(currentUser.uid);
    navigate(`/editor/${id}`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to log out');
    }
  };

  const goToEditor = () => {
    navigate('/editor');
  };

return (
  <div className='bg-teal-100 min-h-screen'>
      <div className='flex p-3 justify-between bg-white'>
        <img className = "pl-2 pt-2 h-10 w-10" src = {logo}/>
        <div className='text-2xl font-semibold tracking-normal'>ArchiTech</div>
        <button onClick={() => {setShowProfile(!showProfile)}}>
          <img src={expand_icon} className='h-8'></img>
        </button>
        </div>
          {showProfile && (
            <div className="absolute right-0 top-14 bg-white w-72 rounded">
            <div className="p-3 font-semibold">
              User: {currentUser?.displayName || 'No username set'}
            </div>
            <div className="p-3 text-sm text-gray-600">
              {currentUser?.email}
            </div>
            <button
              onClick={handleLogout}
              className="w-full bg-black text-white p-3 rounded-b"
            >
            Log Out
            </button>
        </div>)}
        
        <div className='flex flex-col items-center'>
          <div className='mt-25 ml-10'>
            <p className='inline-block font-serif text-3xl bg-teal-100 p-3 rounded-xl'>Welcome, {currentUser.displayName} 👋</p>
          </div>

          <div className='mt-5   ml-10'>
            <button className='inline-block font-serif text-2xl bg-teal-500 p-3 rounded-xl hover:scale-102 transition-all' onClick={handleNewProject}>+ Create New Project</button>
          </div>
        </div>
        <div className="mt-15 w-full h-px bg-teal-500"></div>
        <div className='grid ml-35   mt-10 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 justify-between'>
            {
              projects.map((p) => (
                <div className='bg-teal-100 h-40 w-60 my-3 flex flex-col items-center rounded-xl border-3 border-teal-500 ' onMouseEnter = {() => {console.debug("yo");setShowFooter(true);}} onMouseLeave = {() => {console.debug("yo");setShowFooter(false);}}>
                  <div className='mt-2 text-base font-semibold truncate cursor-pointer' onClick={() => navigate(`/editor/${p.id}`)}>{p.name}</div>
                  <p className="text-sm text-gray-500 mt-5">Created: {new Date(p.createdAt).toLocaleDateString()}</p>
                  {showFooter &&
                  <div className='mt-auto  h-5 w-30 pb-6 flex justify-between'>
                    <img src = {rename_icon} className = 'h-5 w-5 cursor-pointer'
                      onClick={async () => {
                      const newName = prompt("Enter new project name:", p.name);
                      if (newName) {
                        await renameProject(currentUser.uid, p.id, newName);
                        const data = await getProjects(currentUser.uid);
                        setProjects(data);
                      }}}
                    />
                    <img src = {share_icon} className = 'h-5 w-5 cursor-pointer'
                      onClick={async () => {
                        const shareId = await enableSharing(currentUser.uid, p.id);
                        const link = `${window.location.origin}/view/${shareId}`;
                        navigator.clipboard.writeText(link);
                        alert("Share link copied!\n" + link);
                      }}
                    />
                    <img src = {delete_icon} className = 'h-5 w-5 cursor-pointer'
                      onClick={async () => {
                      const ok = window.confirm("Delete this project permanently?");
                      if (!ok) return;

                      await deleteProject(currentUser.uid, p.id);
                      const data = await getProjects(currentUser.uid);
                      setProjects(data);
                    }}
                    />
                  </div>
                  }
                </div>
              ))
            }
        </div>
    </div>
  );
}

export default Dashboard;