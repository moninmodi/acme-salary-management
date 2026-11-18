import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { readFilters, withParams } from './query'

/**
 * Population filters stored in the URL query string, so a filtered view survives reloads and
 * can be bookmarked or shared. Changing a filter resets pagination to page 1.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])

  const update = useCallback(
    (changes: Record<string, string | number | undefined>, options: { resetPage?: boolean } = {}) =>
      setParams(
        (current) => withParams(current, { ...changes, ...(options.resetPage === false ? {} : { page: undefined }) }),
        { replace: true },
      ),
    [setParams],
  )

  return { params, filters, update }
}
