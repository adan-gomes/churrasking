/**
 * Captura os prints estáticos do README, contra a instância local.
 *
 * Existe ao lado do `record-demo.mjs` e não dentro dele porque as duas saídas
 * respondem a perguntas diferentes: o GIF mostra **o fluxo**, e passa rápido
 * demais para alguém ler uma tela; o print deixa parar numa. Um recrutador que
 * folheia faz as duas coisas.
 *
 * Todos os dados são sintéticos: `example.com` é reservado pela RFC 2606 e não
 * roteia, e os endereços de host são de domínio de teste do próprio projeto.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3100'
const OUT = process.env.OUT_DIR || 'docs'

const HOST = { email: 'host@test.churrasking.com', password: 'Test1234!' }

const EVENT = {
  title: 'Churrasco de Aniversário do Rafa',
  description: 'Fim de tarde na chácara. Traz a família!',
  date: '2026-08-22',
  time: '12:00',
  location: 'Chácara Santa Rita — Jacareí, SP',
}

const ITEMS = [
  { name: 'Picanha 2kg', cents: '18000' },
  { name: 'Carvão 5kg', cents: '4000' },
  { name: 'Cerveja (fardo)', cents: '12000' },
  { name: 'Pão de alho', cents: '3500' },
]

const CONVIDADOS = [
  { name: 'Marina Alves', email: 'marina.alves@example.com', item: 0 },
  { name: 'Bruno Costa', email: 'bruno.costa@example.com', item: 1 },
]

const VIEWPORT = { width: 1280, height: 900 }

async function login(page) {
  await page.goto(`${BASE}/login`)
  await page.getByLabel(/e-?mail/i).fill(HOST.email)
  await page.getByLabel(/senha/i).fill(HOST.password)
  await page.getByRole('button', { name: /^entrar$/i }).click()
  await page.waitForURL(/dashboard/, { timeout: 20000 })
}

async function limparEventos(page) {
  for (let i = 0; i < 20; i++) {
    const cards = page.getByRole('link', { name: /ver detalhes/i })
    if ((await cards.count()) === 0) break
    await cards.first().click()
    await page.waitForURL(/\/events\//, { timeout: 15000 })
    await page.getByRole('button', { name: 'Excluir evento' }).click()
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^excluir$/i })
      .click()
    await page.waitForURL(/dashboard/, { timeout: 15000 })
  }
  // Asserção POSITIVA: contar zero de um seletor inventado errado também dá
  // zero, e passa. O empty state só aparece quando o dashboard carregou vazio.
  await page.getByText(/cadê o churrasco, rei/i).waitFor({ state: 'visible', timeout: 15000 })
}

async function criarEvento(page) {
  await page
    .getByRole('link', { name: /criar primeiro churrasco|novo churrasco/i })
    .first()
    .click()
  await page.waitForURL(/events\/new/, { timeout: 15000 })

  // Por id, não por rótulo: campos opcionais renderizam "Local(opcional)" e o
  // sufixo quebra regex ancorada em $.
  await page.locator('#title').fill(EVENT.title)
  await page.locator('#description').fill(EVENT.description)
  await page.locator('#date').fill(EVENT.date)
  await page.locator('#time').fill(EVENT.time)
  await page.locator('#location').fill(EVENT.location)
  await page.getByRole('button', { name: /criar churrasco/i }).click()

  await page.waitForURL(
    (url) => /^\/events\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'),
    { timeout: 20000 }
  )

  for (const item of ITEMS) {
    await page.getByPlaceholder(/Ex: Picanha/i).fill(item.name)
    await page.locator('#estimated_cost').fill(item.cents)
    await page.getByRole('button', { name: /adicionar item/i }).click()
    await page.waitForTimeout(600)
  }

  return new URL(page.url()).pathname.split('/').pop()
}

async function convidadoConfirma(browser, slug, convidado) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/c/${slug}`)
  await page.getByLabel(/nome/i).fill(convidado.name)
  await page.getByLabel(/e-?mail/i).fill(convidado.email)
  await page.getByRole('button', { name: /entrar no churrasco/i }).click()
  await page.getByRole('button', { name: /vou sim/i }).click()
  // Espera o botão existir antes de clicar: ele só renderiza depois de o
  // convidado ter id, e `disabled={isLoading}` engole o clique enquanto isso.
  const pegar = page.getByRole('button', { name: /pego eu/i })
  await pegar.nth(convidado.item).waitFor({ state: 'visible', timeout: 10000 })
  await pegar.nth(convidado.item).click()

  // Asserção que SÓ é verdade se a reserva persistiu: o botão daquele item vira
  // "Vou levar". Esperar o nome do convidado aparecer — que é o que o e2e do
  // projeto faz — já era verdade pela confirmação, então não observava nada.
  await page
    .getByRole('button', { name: /vou levar/i })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
  await ctx.close()
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const page = await ctx.newPage()

  await login(page)
  await limparEventos(page)
  const slug = await criarEvento(page)
  console.log(`[setup] evento ${slug} criado com ${ITEMS.length} itens`)

  for (const c of CONVIDADOS) await convidadoConfirma(browser, slug, c)
  console.log(`[setup] ${CONVIDADOS.length} convidados confirmaram`)

  // --- print 1: a visão do organizador, com lista e rateio preenchidos ---
  await page.reload()
  await page
    .getByText(/marina alves/i)
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, 'host.png'), fullPage: false })
  console.log('[shot] docs/host.png — visão do organizador')

  // --- print 2: a visão do convidado, sem conta ---
  const convidadoCtx = await browser.newContext({ viewport: VIEWPORT, locale: 'pt-BR' })
  const convidadoPage = await convidadoCtx.newPage()
  await convidadoPage.goto(`${BASE}/c/${slug}`)
  await convidadoPage.getByLabel(/nome/i).fill('Rafael Souza')
  await convidadoPage.getByLabel(/e-?mail/i).fill('rafael.souza@example.com')
  await convidadoPage.getByRole('button', { name: /entrar no churrasco/i }).click()
  await convidadoPage.getByRole('button', { name: /vou sim/i }).click()
  await convidadoPage.waitForTimeout(1000)
  await convidadoPage.screenshot({ path: path.join(OUT, 'guest.png'), fullPage: false })
  console.log('[shot] docs/guest.png — visão do convidado')

  await convidadoCtx.close()
  await ctx.close()
  await browser.close()
}

await main()
