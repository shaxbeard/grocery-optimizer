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

const item = (o) => ({ id: 1, name: 'Milk', category: 'fridge', unit: '', quantity: 1, target: 3, prices: [], best: null, ...o })

beforeEach(() => vi.clearAllMocks())

describe('Onboarding', () => {
  it('adds an item with a name, category and package volume', async () => {
    api.addItem.mockResolvedValue({})
    const refresh = vi.fn()
    render(<Onboarding refresh={refresh} />)
    await userEvent.type(screen.getByLabelText('New item name'), 'Milk')
    await userEvent.selectOptions(screen.getByLabelText('New item category'), 'fridge')
    await userEvent.type(screen.getByLabelText('Package size, optional'), '500')
    await userEvent.selectOptions(screen.getByLabelText('Package unit', { exact: true }), 'mL')
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(api.addItem).toHaveBeenCalledWith({ name: 'Milk', category: 'fridge', package_amount: 500, package_unit: 'mL' })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})

describe('App', () => {
  it('shows sign-in and does not fetch inventory without a session', async () => {
    api.session.mockResolvedValue({ user: null })
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(api.items).not.toHaveBeenCalled()
  })

  it('shows onboarding when there are no items', async () => {
    api.session.mockResolvedValue({ user: { id: 1, username: 'user' } })
    api.items.mockResolvedValue([])
    render(<App />)
    expect(await screen.findByText(/set up your groceries/)).toBeInTheDocument()
  })

  it('shows the dashboard when items exist', async () => {
    api.session.mockResolvedValue({ user: { id: 1, username: 'user' } })
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
    expect(screen.queryByText(/\/ 100 g/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'produce' }))
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
    expect(screen.getByText('Apples')).toBeInTheDocument()
  })

  it('matches partial names regardless of case and combines search with the other filters', async () => {
    render(<Dashboard items={[
      item({ name: 'Oat milk', weekly: 1 }),
      item({ id: 2, name: 'Almond milk', category: 'pantry', weekly: 1 }),
      item({ id: 3, name: 'Milk chocolate' }),
      item({ id: 4, name: 'Eggs', weekly: 1 }),
    ]} refresh={vi.fn()} />)
    const search = screen.getByRole('searchbox', { name: 'Search items' })
    await userEvent.type(search, ' MIL ')
    expect(screen.getByText('Oat milk')).toBeInTheDocument()
    expect(screen.getByText('Almond milk')).toBeInTheDocument()
    expect(screen.getByText('Milk chocolate')).toBeInTheDocument()
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'fridge' }))
    await userEvent.click(screen.getByRole('button', { name: 'weekly purchases' }))
    expect(screen.getByText('Oat milk')).toBeInTheDocument()
    expect(screen.queryByText('Almond milk')).not.toBeInTheDocument()
    expect(screen.queryByText('Milk chocolate')).not.toBeInTheDocument()
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument()

    await userEvent.clear(search)
    expect(screen.getByText('Eggs')).toBeInTheDocument()
    expect(screen.queryByText('Almond milk')).not.toBeInTheDocument()
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

  it('still shows a price per 100 g for an item measured in grams', () => {
    render(<Dashboard items={[item({ name: 'Hummus', package_amount: 500, package_unit: 'g', best: { price: 4, store: 'Market' } })]} refresh={vi.fn()} />)
    expect(screen.getByText('$0.80 / 100 g')).toBeInTheDocument()
  })

  it('opens item details and prices from Edit and saves a price without closing the editor', async () => {
    api.setPrice.mockResolvedValue({})
    render(<Dashboard items={[item()]} refresh={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Prices' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }))
    expect(screen.getByLabelText('Edit name')).toHaveValue('Milk')
    await userEvent.type(screen.getByLabelText('Store'), 'Costco')
    await userEvent.type(screen.getByLabelText('Price'), '2.99')
    await userEvent.click(screen.getByRole('button', { name: 'Save price' }))
    expect(api.setPrice).toHaveBeenCalledWith(1, 'Costco', 2.99)
    expect(api.updateItem).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Edit name')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText('Store prices')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit name')).not.toBeInTheDocument()
  })

  it('edits an item name and category and can clear its package size', async () => {
    api.updateItem.mockResolvedValue({})
    render(<Dashboard items={[item({ package_amount: 0.5, package_unit: 'L' })]} refresh={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Edit name'))
    await userEvent.type(screen.getByLabelText('Edit name'), 'Oat milk')
    await userEvent.selectOptions(screen.getByLabelText('Edit category'), 'pantry')
    expect(screen.getByLabelText('Edit package size')).toHaveValue(0.5)
    expect(screen.getByLabelText('Edit package unit')).toHaveValue('L')
    await userEvent.clear(screen.getByLabelText('Edit package size'))
    await userEvent.click(screen.getByRole('button', { name: 'Save item' }))
    expect(api.updateItem).toHaveBeenCalledWith(1, { name: 'Oat milk', category: 'pantry', package_amount: null, package_unit: 'L' })
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

  it('shows a per week input for every item, weekly or not', () => {
    render(<Dashboard items={[item({ weekly: 0, per_week: 0 })]} refresh={vi.fn()} />)
    expect(screen.getByLabelText('Milk per week')).toHaveValue(0)
  })
})
