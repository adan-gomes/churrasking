'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { setGuestSessionCookie } from '@/lib/guest-session'
import { GuestInput, guestSchema } from '@/lib/validations/guests'

type ActionResult = { error?: string }

export async function upsertGuest(
  eventId: string,
  eventSlug: string,
  data: GuestInput
): Promise<ActionResult> {
  const parsed = guestSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()

  const normalizedEmail = parsed.data.email.toLowerCase().trim()

  const { data: guest, error } = await supabase
    .from('guests')
    .upsert(
      {
        event_id: eventId,
        name: parsed.data.name,
        email: normalizedEmail,
        rsvp_status: 'pending',
      },
      {
        onConflict: 'event_id,email',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single()

  if (error || !guest) return { error: 'Could not register. Please try again.' }

  await setGuestSessionCookie({ guestId: guest.id, eventId })

  redirect(`/c/${eventSlug}`)
}

export async function updateRsvp(
  guestId: string,
  status: 'confirmed' | 'declined'
): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase.from('guests').update({ rsvp_status: status }).eq('id', guestId)

  if (error) return { error: 'Could not update RSVP. Please try again.' }

  return {}
}
