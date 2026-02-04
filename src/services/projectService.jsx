import { db } from "../firebase/config";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

export async function createProject(uid) {
  const docRef = await addDoc(collection(db, "users", uid, "projects"), {
    name: "Untitled Project",
    objects: [],
    walls: [],
    shapes: [],
    symbols: [],
    textboxes: [],
    createdAt: Date.now(),
  });
  return docRef.id;
}

export async function getProjects(uid) {
  if (!uid) throw new Error("UID is required");

  const projectsRef = collection(db, "users", uid, "projects");
  const snapshot = await getDocs(projectsRef);

  const projects = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return projects;
}

export async function updateProject(uid, projectId, updates) {
  if (!uid || !projectId) {
    throw new Error("UID and projectId are required");
  }

  const projectRef = doc(db, "users", uid, "projects", projectId);

  await setDoc(projectRef, {
    ...updates,
    updatedAt: Date.now()
  }, { merge: true });
}

export const getProjectById = async (uid, projectId) => {
  const snap = await getDoc(doc(db, "users", uid, "projects", projectId));

  if (!snap.exists()) return {};

  return snap.data();   // may not have objects/walls/shapes yet
};

export const renameProject = async (uid, projectId, newName) => {
  const ref = doc(db, "users", uid, "projects", projectId);
  await updateDoc(ref, { name: newName });
};

export async function deleteProject(uid, projectId) {
  await deleteDoc(doc(db, "users", uid, "projects", projectId));
}

export async function enableSharing(uid, projectId) {
  const shareId = crypto.randomUUID();

  // Get original project
  const originalRef = doc(db, "users", uid, "projects", projectId);
  const snap = await getDoc(originalRef);
  const data = snap.data();

  // Copy ENTIRE canvas data
  await setDoc(doc(db, "sharedProjects", shareId), {
    objects: data.objects || [],
    walls: data.walls || [],
    shapes: data.shapes || [],
    symbols: data.symbols || [],
    textboxes: data.textboxes || [],
  });

  return shareId;
}

export async function getSharedProject(shareId) {
  const ref = doc(db, "sharedProjects", shareId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;

}
