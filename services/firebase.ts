
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword as firebaseSignIn,
  createUserWithEmailAndPassword as firebaseCreateUser,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  User as FirebaseUser
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  arrayUnion,
  arrayRemove,
  where,
  collectionGroup,
  documentId,
  serverTimestamp
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAdqqFdgVyDfAeOYPRHoYG7li2D1xazlk",
  authDomain: "nexthorizoneduapp.firebaseapp.com",
  projectId: "nexthorizoneduapp",
  storageBucket: "nexthorizoneduapp.firebasestorage.app",
  messagingSenderId: "317590934798",
  appId: "1:317590934798:web:8e22d79cce771c5110b35f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export standard instances
export { auth, db, googleProvider };

// Export Firestore functions directly as they match the app's usage
export { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  deleteDoc, 
  where,
  collectionGroup,
  documentId,
  arrayUnion,
  arrayRemove,
  serverTimestamp
};

// Extended User Interface to match App's expectation (merging Auth + Firestore Data)
export interface User extends FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: 'teacher' | 'student';
  school?: string | null;
  joinedClassrooms?: string[];
}

/**
 * Custom Auth State Listener
 * Fetches additional user data (role, school) from Firestore when a user logs in.
 * Uses onSnapshot to ensure data is reactive, fixing race conditions during registration.
 */
export const onAuthStateChanged = (
  authInstance: any, 
  callback: (user: User | null) => void
) => {
  let firestoreUnsubscribe: (() => void) | null = null;

  const authUnsubscribe = firebaseOnAuthStateChanged(authInstance, (firebaseUser) => {
    // Clean up previous Firestore listener if auth user changes or logs out
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
      firestoreUnsubscribe = null;
    }

    if (firebaseUser) {
      const userDocRef = doc(db, "users", firebaseUser.uid);
      
      // Subscribe to live updates of the user profile
      firestoreUnsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as any;
          // Merge Firebase Auth object with Firestore data
          const mergedUser: User = {
            ...firebaseUser,
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            role: userData.role || 'student',
            school: userData.school || '',
            joinedClassrooms: userData.joinedClassrooms || []
          } as User;
          callback(mergedUser);
        } else {
          // Fallback if no firestore doc exists yet (e.g., immediate post-registration)
          // We return the basic user; once the doc is created, this listener will fire again with correct role.
          callback(firebaseUser as User);
        }
      }, (error) => {
        console.error("Error listening to user profile:", error);
        // Fallback on error
        callback(firebaseUser as User);
      });

    } else {
      callback(null);
    }
  });

  // Return a cleanup function that unsubscribes from both Auth and Firestore
  return () => {
    authUnsubscribe();
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
};

/**
 * Custom Sign In with Email/Password
 */
export const signInWithEmailAndPassword = async (authInstance: any, email: string, password?: string) => {
  if (!password) throw new Error("Password required");
  return firebaseSignIn(authInstance, email, password);
};

/**
 * Custom Create User
 * Creates Auth user AND a Firestore document with role/school info.
 */
export const createUserWithEmailAndPassword = async (
  authInstance: any, 
  email: string, 
  password?: string, 
  role: 'teacher' | 'student' = 'teacher',
  displayName: string = '',
  schoolName: string = ''
) => {
  if (!password) throw new Error("Password required");
  
  // 1. Create Auth User
  const userCredential = await firebaseCreateUser(authInstance, email, password);
  const user = userCredential.user;

  // 2. Update Auth Profile
  if (displayName) {
    await firebaseUpdateProfile(user, { displayName });
  }

  // 3. Create Firestore User Document
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: displayName,
    role: role,
    school: schoolName,
    joinedClassrooms: [],
    createdAt: new Date().toISOString()
  });

  return userCredential;
};

/**
 * Custom Google Sign In
 * Checks if Firestore doc exists; if not, creates a default one.
 */
export const signInWithPopupWrapper = async (authInstance: any, provider: any) => {
  const result = await signInWithPopup(authInstance, provider);
  const user = result.user;

  // Check if user exists in Firestore
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    // Create a default entry for Google users (Default to student if unknown)
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: 'student', // Default role for Google Sign In
      school: '',
      joinedClassrooms: [],
      createdAt: new Date().toISOString()
    });
  }

  return result;
};

// Export as signInWithPopup to match import
export { signInWithPopupWrapper as signInWithPopup };

/**
 * Update Profile Wrapper
 * Updates both Auth profile and Firestore document
 */
export const updateProfile = async (user: FirebaseUser, profile: { displayName?: string, school?: string }) => {
  if (!user) return;

  const updates: any = {};

  // Update Auth Profile
  if (profile.displayName) {
    await firebaseUpdateProfile(user, { displayName: profile.displayName });
    updates.displayName = profile.displayName;
  }

  // Update Firestore Profile
  if (profile.school !== undefined) {
    updates.school = profile.school;
  }

  if (Object.keys(updates).length > 0) {
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, updates);
  }
};

/**
 * Specific Helper: Update Student Joined Classes
 * Uses Firestore arrayUnion to add class ID
 */
export const updateStudentJoinedClasses = async (uid: string, classId: string) => {
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    joinedClassrooms: arrayUnion(classId)
  });
};

/**
 * Specific Helper: Remove Student Joined Class
 * Uses Firestore arrayRemove to remove class ID
 */
export const removeStudentJoinedClass = async (uid: string, classId: string) => {
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    joinedClassrooms: arrayRemove(classId)
  });
};

/**
 * Sign Out Wrapper
 */
export const signOut = async (authInstance: any) => {
  return firebaseSignOut(authInstance);
};
