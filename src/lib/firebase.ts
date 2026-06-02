import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
}

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
)

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null

const getFirebaseApp = () => {
  if (!hasFirebaseConfig) {
    return null
  }
  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
  }
  return firebaseApp
}

export const getFirebaseAuth = () => {
  if (!hasFirebaseConfig) {
    return null
  }
  if (!firebaseAuth) {
    const app = getFirebaseApp()
    firebaseAuth = app ? getAuth(app) : null
  }
  return firebaseAuth
}
