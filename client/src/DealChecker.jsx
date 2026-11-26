import { useState } from 'react'
import { PACKAGE_UNITS } from '../../shared/packageUnits.js'
import { money } from './api'

const units = {
  g: PACKAGE_UNITS.g,
  kg: { ...PACKAGE_UNITS.g, label: 'Kilograms (kg)', rateAmount: 0.1 },
  mL: PACKAGE_UNITS.mL,
  L: PACKAGE_UNITS.L,
  count: PACKAGE_UNITS.count,
}

export default function DealChecker() {
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('g')
  const priceValue = Number(price)
  const quantityValue = Number(quantity)
  const invalidPrice = price !== '' && (!Number.isFinite(priceValue) || priceValue < 0)
  const invalidQuantity = quantity !== '' && (!Number.isFinite(quantityValue) || quantityValue <= 0)
  const ready = price !== '' && quantity !== '' && !invalidPrice && !invalidQuantity
  const rate = ready ? priceValue / (quantityValue / units[unit].rateAmount) : null
  const outOfRange = ready && !Number.isFinite(rate)

  return (
    <section className="card" aria-label="Deal Checker">
      <h2>Deal Checker</h2>
      <div className="inline">
        <label>
          Price
          <input aria-label="Deal price" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          Unit
          <select aria-label="Deal unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {Object.entries(units).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Quantity
          <input aria-label="Deal quantity" className="package-size" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <output aria-live="polite">
          {ready && !outOfRange
            ? `${money(rate)} ${units[unit].rateLabel}`
            : 'Enter a price and a quantity greater than zero.'}
        </output>
      </div>
      {(invalidPrice || invalidQuantity || outOfRange) && (
        <p role="alert" className="error">
          {outOfRange ? 'Unit price is out of range.' : 'Price must be zero or more. Quantity must be greater than zero.'}
        </p>
      )}
    </section>
  )
}
