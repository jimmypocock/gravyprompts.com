'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAuthSession, signOut } from 'aws-amplify/auth'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    try {
      const session = await fetchAuthSession()
      
      if (!session.tokens?.idToken) {
        throw new Error('No valid session')
      }

      // Check if token is expired
      const idToken = session.tokens.idToken
      const payload = JSON.parse(atob(idToken.toString().split('.')[1]))
      const expirationTime = payload.exp * 1000
      const currentTime = Date.now()
      
      if (currentTime >= expirationTime) {
        console.log('Token expired, signing out...')
        await signOut()
        throw new Error('Token expired')
      }

      setIsAuthenticated(true)
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
      
      if (requireAuth) {
        router.push('/login')
      }
    } finally {
      setIsChecking(false)
    }
  }

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (requireAuth && !isAuthenticated) {
    return null
  }

  return <>{children}</>
}