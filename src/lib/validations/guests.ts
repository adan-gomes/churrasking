import { z } from 'zod'

export const guestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.email('Invalid email address'),
})

export type GuestInput = z.infer<typeof guestSchema>
