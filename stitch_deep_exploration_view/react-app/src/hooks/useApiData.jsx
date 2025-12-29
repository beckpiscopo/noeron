import { useEffect, useState } from 'react'

const BASE_URL = 'http://localhost:8000/api/'

export function useApiData(endpoint = '') {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true }))

    fetch(`${BASE_URL}${endpoint}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch ${endpoint || '/'} (${response.status})`)
        }
        return response.json()
      })
      .then((data) => {
        setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return
        }
        setState({ data: null, error, loading: false })
      })

    return () => controller.abort()
  }, [endpoint])

  return state
}

