import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import Lists from './Lists'
import { api } from './api'

vi.mock('./api', async (orig) => {
  const real = await orig()
  return { ...real, api: Object.fromEntries(Object.keys(real.api).map((k) => [k, vi.fn()])) }
})

const li = { list_item_id: 5, list_quantity: 2, purchased: false, id: 1, name: 'Milk', unit: '', best: { store: 'Aldi', price: 3 } }

beforeEach(() => {
  vi.clearAllMocks()
  api.lists.mockResolvedValue([{ id: 1, name: 'Weekly' }])
  api.list.mockResolvedValue({ id: 1, name: 'Weekly', items: [li] })
})

it('shows the list with an estimated total', async () => {
  render(<Lists items={[]} refresh={vi.fn()} />)
  expect(await screen.findByText('Milk')).toBeInTheDocument()
  expect(screen.getByText('Estimated total: $6.00')).toBeInTheDocument()
})

it('marking purchased calls the api and refreshes inventory', async () => {
  api.setPurchased.mockResolvedValue({})
  const refresh = vi.fn()
  render(<Lists items={[]} refresh={refresh} />)
  await userEvent.click(await screen.findByRole('checkbox'))
  expect(api.setPurchased).toHaveBeenCalledWith(5, true)
  expect(refresh).toHaveBeenCalled()
})

it('generates a list from inventory', async () => {
  api.generateList.mockResolvedValue({ id: 1 })
  render(<Lists items={[]} refresh={vi.fn()} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Generate from inventory' }))
  expect(api.generateList).toHaveBeenCalled()
})
