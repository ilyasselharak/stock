import { z } from 'zod'

export function zodMessage(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Invalid input'
  return first.message || 'Invalid input'
}
