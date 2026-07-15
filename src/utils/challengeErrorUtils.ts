export function challengeQueryState(error: unknown): { title: string; message: string } {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return {
      title: 'Access restricted',
      message: 'You may not have access to view these challenges yet.',
    };
  }
  return {
    title: 'Challenges are temporarily unavailable',
    message: 'Please try again shortly.',
  };
}
