export const CATEGORIES = ['produce', 'dairy', 'meat', 'pantry', 'freezer', 'household']

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText)
  return res.status === 204 ? null : res.json()
}

export const api = {
  items: () => call('GET', '/api/items'),
  addItem: (item) => call('POST', '/api/items', item),
  updateItem: (id, patch) => call('PUT', `/api/items/${id}`, patch),
  deleteItem: (id) => call('DELETE', `/api/items/${id}`),
  setPrice: (id, store, price) => call('PUT', `/api/items/${id}/prices`, { store, price }),
  deletePrice: (id) => call('DELETE', `/api/prices/${id}`),
  lists: () => call('GET', '/api/lists'),
  list: (id) => call('GET', `/api/lists/${id}`),
  addList: (name) => call('POST', '/api/lists', { name }),
  generateList: () => call('POST', '/api/lists/from-inventory'),
  deleteList: (id) => call('DELETE', `/api/lists/${id}`),
  addListItem: (listId, item_id, quantity) => call('POST', `/api/lists/${listId}/items`, { item_id, quantity }),
  deleteListItem: (id) => call('DELETE', `/api/list-items/${id}`),
  setPurchased: (id, purchased) => call('PUT', `/api/list-items/${id}/purchased`, { purchased }),
}

export const money = (n) => `$${n.toFixed(2)}`
