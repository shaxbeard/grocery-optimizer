import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import Dashboard from './Dashboard'
import Onboarding from './Onboarding'
import { api } from './api'

vi.mock('./api', async (orig) => {
  const real = await orig()
  return { ...real, api: Object.fromEntries(Object.keys(real.api).map((k) => [k, vi.fn()])) }
})

const item = (o) => ({ id: 1, name: 'Milk', category: 'dairy', unit: '', quantity: 1, target: 3, prices: [], best: null, ...o })

beforeEach(() => vi.clearAllMocks())

describe('Onboarding', () => {
  it('adds an item with a name and category dropdown', async () => {
    api.addItem.mockResolvedValue({})
    const refresh = vi.fn()
    render(<Onboarding refresh={refresh} />)
    await userEvent.type(screen.getByLabelText('New item name'), 'Milk')
    await userEvent.selectOptions(screen.getByLabelText('New item category'), 'dairy')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(api.addItem).toHaveBeenCalledWith({ name: 'Milk', category: 'dairy' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
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

  it('edits an item name and category', async () => {
    api.updateItem.mockResolvedValue({})
    render(<Dashboard items={[item()]} refresh={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Edit name'))
    await userEvent.type(screen.getByLabelText('Edit name'), 'Oat milk')
    await userEvent.selectOptions(screen.getByLabelText('Edit category'), 'pantry')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(api.updateItem).toHaveBeenCalledWith(1, { name: 'Oat milk', category: 'pantry' })
  })

  it('deletes an item', async () => {
    api.deleteItem.mockResolvedValue(null)
    render(<Dashboard items={[item()]} refresh={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(api.deleteItem).toHaveBeenCalledWith(1)
  })

  it('toggles weekly and filters to weekly purchases', async () => {
    api.updateItem.mockResolvedValue({})
    const items = [item(), item({ id: 2, name: 'Apples', category: 'produce', weekly: 1, per_week: 4 })]
    render(<Dashboard items={items} refresh={vi.fn()} />)
    await userEvent.click(screen.getByLabelText('Milk weekly'))
    expect(api.updateItem).toHaveBeenCalledWith(1, { weekly: true })
    expect(screen.getByLabelText('Apples per week')).toHaveValue(4)
    await userEvent.click(screen.getByRole('button', { name: 'weekly purchases' }))
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(screen.getByText('Apples')).toBeInTheDocument()
  })
})
