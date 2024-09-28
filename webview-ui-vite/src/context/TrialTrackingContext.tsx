'use client'
import { track as baseTrack, init } from '@amplitude/analytics-browser'
import type React from 'react'
import { createContext, useContext, useEffect } from 'react'

const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY

export const useTrialTracking = () => {
  function track(eventType: string, eventProperties?: object, userProperties?: object): void {
    baseTrack({
      event_type: eventType,
      event_properties: eventProperties,
      user_properties: userProperties,
    })
  }

  function trackOfferView(): void {
    track('TrialOfferView')
  }

  return {
    track,
    trackOfferView
  }
}

export const TrialTrackingContext = createContext<ReturnType<typeof useTrialTracking> | undefined>(undefined)

export const TrialTrackingProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const trackers = useTrialTracking()

  useEffect(() => {
    init(AMPLITUDE_API_KEY, {
      flushIntervalMillis: 0,
      autocapture: true,
    })
  }, [])

  return <TrialTrackingContext.Provider value={trackers}>{children}</TrialTrackingContext.Provider>
}

export const useTrialTrackingContext = () => {
  if (!AMPLITUDE_API_KEY) throw new Error('AMPLITUDE_API_KEY is not set')

  const context = useContext(TrialTrackingContext)

  if (context === undefined) throw new Error('Incorrect use of context')
  return context
}
