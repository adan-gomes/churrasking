'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { upsertGuest } from '@/actions/guests'
import { Button } from '@/components/ui/button'
import { GuestInput, guestSchema } from '@/lib/validations/guests'
import { FormErrorAlert } from '@/components/common/form-error-alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ControlledFieldInput } from '@/components/common/controlled-field-input'

type GuestIdentificationFormProps = {
  eventId: string
  eventSlug: string
}

export function GuestIdentificationForm({ eventId, eventSlug }: GuestIdentificationFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: '', email: '' },
  })

  async function onSubmit(data: GuestInput) {
    setServerError(null)
    const result = await upsertGuest(eventId, eventSlug, data)
    if (result?.error) setServerError(result.error)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Você está aqui?</CardTitle>
        <p className="text-sm text-muted-foreground">Informe seus dados para confirmar presença.</p>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
          <ControlledFieldInput
            control={form.control}
            name="name"
            label="Seu nome"
            placeholder="João Silva"
            autoComplete="name"
            required
          />

          <ControlledFieldInput
            control={form.control}
            name="email"
            label="Seu e-mail"
            placeholder="joao@email.com"
            autoComplete="email"
            required
          />

          <FormErrorAlert message={serverError} />

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            aria-disabled={form.formState.isSubmitting}
            className="w-full"
          >
            {form.formState.isSubmitting ? 'Entrando...' : 'Entrar no churrasco'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
