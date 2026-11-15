import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import Dashboard from './Dashboard'
import Onboarding, { parseLines } from './Onboarding'
import { api } from './api'

vi.mock('./api', async (orig) => {
  const real = await orig()
  return { ...real, api: Object.fromEntries(Object.keys(real.api).map((k) => [k, vi.fn()])) }
})

const item = (o) => ({ id: 1, name: 'Milk', category: 'dairy', unit: '', quantity: 1, target: 3, prices: [], best: null, ...o })

beforeEach(() => vi.clearAllMocks())

describe('parseLines', () => {
  it('parses names and categories, defaulting to pantry', () => {
    expect(parseLines('Milk, Dairy\n\n Rice \nSoap, bogus')).toEqual([
      { name: 'Milk', category: 'dairy' },
      { name: 'Rice', category: 'pantry' },
      { name: 'Soap', category: 'pantry' },
    ])
  })
})

describe('Onboarding', () => {
  it('submits parsed items', async () => {
    api.bulkItems.mockResolvedValue([])
    const done = vi.fn()
    render(<Onboarding onDone={done} />)
    expect(screen.getByRole('button', { name: /Add 0 items/ })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Grocery items'), 'Milk, dairy{enter}Apples, produce')
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 items' }))
    expect(api.bulkItems).toHaveBeenCalledWith([
      { name: 'Milk', category: 'dairy' },
      { name: 'Apples', category: 'produce' },
    ])
    expect(done).toHaveBeenCalled()
  })
})

describe('App', () => {
  it('shows onboarding when there are no items', async () => {
    api.items.mockResolvedValue([])
    render(<App />)
    expect(await screen.findByText(/set up your groceries/)).toBeInTheDocument()
  })

  it('shows the dashboard when items exist', async () => {
    api.items.mockResolvedValue([item()])
    render(<App />)
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shopping Lists' })).toBeInTheDocument()
  })
})

describe('Dashboard', () => {
  const items = [
    item(),
    item({ id: 2, name: 'Apples', category: 'produce', best: { store: 'Aldi', price: 1.5 }, prices: [{ id: 9, store: 'Aldi', price: 1.5 }] }),
  ]

  it('filters by category and shows best price', async () => {
    render(<Dashboard items={items} refresh={vi.fn()} />)
    expect(screen.getByText('$1.50 at Aldi')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'produce' }))
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(screen.getByText('Apples')).toBeInTheDocument()
  })

  it('updates inventory quantity on blur', async () => {
    api.updateItem.mockResolvedValue({})
    const refresh = vi.fn()
    render(<Dashboard items={[item()]} refresh={refresh} />)
    const input = screen.getByLabelText('Milk quantity')
    await userEvent.clear(input)
    await userEvent.type(input, '5')
    await userEvent.tab()
    expect(api.updateItem).toHaveBeenCalledWith(1, { quantity: 5 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('saves a store price', async () => {
    api.setPrice.mockResolvedValue({})
    render(<Dashboard items={[item()]} refresh={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Prices' }))
    await userEvent.type(screen.getByLabelText('Store'), 'Costco')
    await userEvent.type(screen.getByLabelText('Price'), '2.99')
    await userEvent.click(screen.getByRole('button', { name: 'Save price' }))
    expect(api.setPrice).toHaveBeenCalledWith(1, 'Costco', 2.99)
  })
})
