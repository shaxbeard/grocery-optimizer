import { expect, test } from '@playwright/test'

test('full grocery workflow', async ({ page }) => {
  await page.goto('/')

  // Onboarding
  await expect(page.getByText(/set up your groceries/)).toBeVisible()
  await page.getByLabel('New item name').fill('Milk')
  await page.getByLabel('New item category').selectOption('dairy')
  await page.getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByRole('cell', { name: 'Milk', exact: true })).toBeVisible()
  for (const [name, cat] of [['Apples', 'produce'], ['Rice', 'pantry'], ['Soap', 'household'], ['Tmp', 'meat']]) {
    await page.getByLabel('New item name').fill(name)
    await page.getByLabel('New item category').selectOption(cat)
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()
  }

  // Edit and delete
  await page.getByRole('row', { name: /Tmp/ }).getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Edit name').fill('Beef')
  await page.getByLabel('Edit category').selectOption('meat')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Beef', exact: true })).toBeVisible()
  await page.getByRole('row', { name: /Beef/ }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('cell', { name: 'Beef', exact: true })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: 'Milk', exact: true })).toBeVisible()

  // Weekly purchases
  await page.getByLabel('Apples weekly').click()
  await expect(page.getByLabel('Apples weekly')).toBeChecked()
  await page.getByLabel('Apples per week').fill('4')
  await page.getByLabel('Apples per week').blur()
  await page.getByRole('button', { name: 'weekly purchases' }).click()
  await expect(page.getByRole('cell', { name: 'Apples', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Rice', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Apples per week')).toHaveValue('4')
  await page.getByRole('button', { name: 'all items' }).click()

  // Filter
  await page.getByRole('button', { name: 'produce', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Apples', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Milk', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'all', exact: true }).click()

  // Prices: best price shown
  await page.getByRole('row', { name: /Milk/ }).getByRole('button', { name: 'Prices' }).click()
  await page.getByLabel('Store').fill('Costco')
  await page.getByLabel('Price', { exact: true }).fill('3.50')
  await page.getByRole('button', { name: 'Save price' }).click()
  await expect(page.getByText('$3.50 at Costco')).toBeVisible()
  await page.getByLabel('Store').fill('Aldi')
  await page.getByLabel('Price', { exact: true }).fill('2.75')
  await page.getByRole('button', { name: 'Save price' }).click()
  await expect(page.getByText('$2.75 at Aldi')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  // Inventory: have 1, want 3
  await page.getByLabel('Milk target').fill('3')
  await page.getByLabel('Milk quantity').fill('1')
  await page.getByLabel('Milk quantity').blur()
  await expect(page.getByLabel('Milk quantity')).toHaveValue('1')

  // Generate list from inventory
  await page.getByRole('button', { name: 'Shopping Lists' }).click()
  await page.getByRole('button', { name: 'Generate from inventory' }).click()
  await expect(page.getByRole('checkbox', { name: /Milk/ })).toBeVisible()
  await expect(page.getByText('Estimated total: $5.50')).toBeVisible()

  // Purchase updates inventory
  await page.getByRole('checkbox').click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByRole('button', { name: 'Inventory', exact: true }).click()
  await expect(page.getByLabel('Milk quantity')).toHaveValue('3')

  // Manual list
  await page.getByRole('button', { name: 'Shopping Lists' }).click()
  await page.getByLabel('New list name').fill('Party')
  await page.getByRole('button', { name: 'Create list' }).click()
  await page.getByLabel('Item to add').selectOption({ label: 'Soap' })
  await page.getByRole('button', { name: 'Add to list' }).click()
  await expect(page.getByRole('checkbox', { name: /Soap/ })).toBeVisible()
})
