import posthog from 'posthog-js'
import mixpanel from 'mixpanel-browser'

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, capture_pageview: false })
  }
  if (MIXPANEL_TOKEN) {
    mixpanel.init(MIXPANEL_TOKEN, { debug: import.meta.env.DEV })
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  try { posthog.capture(event, properties) } catch {}
  try { mixpanel.track(event, properties) } catch {}
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  try { posthog.identify(userId, traits) } catch {}
  try { mixpanel.identify(userId); if (traits) mixpanel.people.set(traits) } catch {}
}

export function trackPageView(path: string) {
  try { posthog.capture('$pageview', { $current_url: path }) } catch {}
  // GA4 pageview is handled by the gtag script in index.html
  void GA_ID  // suppress unused-var warning
}
