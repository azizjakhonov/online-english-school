import { useEffect } from 'react';

const APP = 'Allright.uz';

export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} | ${APP}` : APP;
  }, [page]);
}
