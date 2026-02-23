import { useQuery } from '@tanstack/react-query';
import { bookLibraryService } from '../services/bookLibraryService';

export function useBooks() {
  return useQuery({
    queryKey: ['books'],
    queryFn: () => bookLibraryService.getBooks(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    refetchOnWindowFocus: false,
  });
}

export function useBook(bookId: string | undefined) {
  return useQuery({
    queryKey: ['book', bookId],
    queryFn: () => (bookId ? bookLibraryService.getBookById(bookId) : Promise.resolve(null)),
    enabled: !!bookId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
