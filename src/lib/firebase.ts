import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
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

let cachedAuth: Auth | null = null

const getFirebaseApp = (): FirebaseApp | null => {
  if (!hasFirebaseConfig) {
    return null
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
}

export const getFirebaseAuth = (): Auth | null => {
  if (cachedAuth) {
    return cachedAuth
  }

  const app = getFirebaseApp()
  if (!app) {
    return null
  }

  cachedAuth = getAuth(app)
  return cachedAuth
}
