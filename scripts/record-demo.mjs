/**
 * Grava o fluxo completo do ChurrasKing em vídeo, para virar GIF do README.
 *
 * Roda contra a instância local (Supabase CLI + `pnpm dev`). Todos os dados são
 * sintéticos: domínio example.com é reservado pela RFC 2606 e não roteia.
 */
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const OUT = process.env.OUT_DIR || '/tmp/churrasking-demo'

const HOST = { email: 'host@test.churrasking.com', password: 'Test1234!' }

const EVENT = {
  title: 'Churrasco de Aniversário do Rafa',
  description: 'Fim de tarde na chácara. Traz a família!',
  date: '2026-08-22',
  time: '12:00',
  location: 'Chácara Santa Rita — Jacareí, SP',
}

// `cents` porque o input de moeda faz value.replace(/\D/g,'') / 100
const ITEMS = [
  { name: 'Picanha 2kg', cents: '18000' },
  { name: 'Carvão 5kg', cents: '4000' },
  { name: 'Cerveja (fardo)', cents: '12000' },
  { name: 'Pão de alho', cents: '3500' },
]

// example.com é reservado pela RFC 2606: não roteia e não é de ninguém.
const GUEST = { name: 'Marina Alves', email: 'marina.alves@example.com' }
const GUEST_2 = { name: 'Bruno Costa', email: 'bruno.costa@example.com', item: 1 }

const VIEWPORT = { width: 1280, height: 800 }

/** Pausa deliberada: o GIF precisa de tempo de leitura, não de velocidade. */
const beat = (page, ms = 1000) => page.waitForTimeout(ms)

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-?mail/i).fill(HOST.email)
  await page.getByLabel(/senha/i).fill(HOST.password)
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 20000 })
}

/** Deixa o dashboard vazio para o GIF começar no empty state. */
async function limparEventos(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await login(page)

  for (let i = 0; i < 20; i++) {
    const cards = page.getByRole('link', { name: /ver detalhes/i })
    if ((await cards.count()) === 0) break

    await cards.first().click()
    await page.waitForURL(/\/events\//, { timeout: 15000 })
    await page.getByRole('button', { name: 'Excluir evento' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^excluir$/i }).click()
    await page.waitForURL(/dashboard/, { timeout: 15000 })
  }

  // Asserção POSITIVA, de propósito: contar zero de um seletor que eu inventei
  // errado dá zero do mesmo jeito, e passa. O empty state só aparece de verdade
  // quando o dashboard carregou e está mesmo vazio.
  await page.getByText(/cadê o churrasco, rei/i).waitFor({ state: 'visible', timeout: 15000 })
  console.log('[setup] dashboard vazio confirmado pelo empty state')
  await ctx.close()
}

/** Convidado extra, em contexto próprio e sem gravação. */
async function entrarComoConvidado(browser, slug, convidado) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR' })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/c/${slug}`)
  await page.getByLabel(/nome/i).fill(convidado.name)
  await page.getByLabel(/e-?mail/i).fill(convidado.email)
  await page.getByRole('button', { name: /entrar no churrasco/i }).click()
  await page.getByRole('button', { name: /vou sim/i }).click()

  const pegar = page.getByRole('button', { name: /pego eu/i })
  await pegar.nth(convidado.item).click()
  await page.getByText(convidado.name).first().waitFor({ state: 'visible', timeout: 10000 })

  console.log(`[demo] ${convidado.name} confirmou e pegou um item`)
  await ctx.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true, slowMo: 120 })

  await limparEventos(browser)

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUT, size: VIEWPORT },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = await ctx.newPage()

  // ---- 1. host entra ----
  await login(page)
  await beat(page, 1600) // empty state "Cadê o churrasco, rei?"

  // ---- 2. cria o evento ----
  await page.getByRole('link', { name: /criar primeiro churrasco|novo churrasco/i }).first().click()
  await page.waitForURL(/events\/new/, { timeout: 15000 })
  await beat(page, 700)

  // Por id, não por rótulo: os campos opcionais renderizam "Local(opcional)",
  // e o sufixo quebra qualquer regex ancorada em $.
  await page.locator('#title').fill(EVENT.title)
  await page.locator('#description').fill(EVENT.description)
  await page.locator('#date').fill(EVENT.date)
  await page.locator('#time').fill(EVENT.time)
  await page.locator('#location').fill(EVENT.location)
  await beat(page, 1200)

  await page.getByRole('button', { name: /criar churrasco/i }).click()
  // Sem excluir /events/new a espera passa de imediato na própria página do form.
  await page.waitForURL((url) => /^\/events\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'), {
    timeout: 20000,
  })
  const slug = new URL(page.url()).pathname.split('/').pop()
  console.log(`[demo] evento criado: ${slug}`)
  await beat(page, 1500)

  // ---- 3. adiciona os itens ----
  for (const item of ITEMS) {
    await page.getByPlaceholder(/Ex: Picanha/i).fill(item.name)
    await page.locator('#estimated_cost').fill(item.cents)
    await page.getByRole('button', { name: /adicionar item/i }).click()
    await page.waitForTimeout(700)
  }
  await beat(page, 1600) // resumo de custos preenchido

  // ---- 4. copia o link de compartilhamento ----
  await page.getByRole('button', { name: /copiar link/i }).click()
  await beat(page, 1600) // estado "Copiado"

  // ---- 5. mesma aba, agora como convidado (sessão de convidado é cookie HMAC
  //         próprio, independente do Supabase Auth) ----
  await page.goto(`${BASE}/c/${slug}`)
  await beat(page, 1400)

  await page.getByLabel(/nome/i).fill(GUEST.name)
  await page.getByLabel(/e-?mail/i).fill(GUEST.email)
  await beat(page, 900)
  await page.getByRole('button', { name: /entrar no churrasco/i }).click()
  await page.waitForTimeout(2500)

  // ---- 6. confirma presença e pega um item ----
  await page.getByRole('button', { name: /vou sim/i }).click()
  await beat(page, 1600)

  await page.getByRole('button', { name: /pego eu/i }).first().click()
  await beat(page, 2200)

  // ---- 7. um segundo convidado responde, fora da gravação ----
  // Precisa de contexto próprio: a identidade do convidado é um cookie HMAC,
  // e a aba gravada já é a Marina. Com dois confirmados o rateio "por pessoa"
  // finalmente divide, que é a proposta do produto.
  await entrarComoConvidado(browser, slug, GUEST_2)

  // ---- 8. volta para a visão do host: convidados e itens aparecem ----
  await page.goto(`${BASE}/events/${slug}`)
  await beat(page, 3500)

  await ctx.close()
  await browser.close()
  console.log('[demo] vídeo gravado em', OUT)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
