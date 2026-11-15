import { AddItemForm } from './Dashboard'

export default function Onboarding({ refresh }) {
  return (
    <>
      <div className="card">
        <h2>Welcome! Let's set up your groceries</h2>
        <p className="muted">Add your first item to get started. You can add more from the inventory page.</p>
      </div>
      <AddItemForm refresh={refresh} />
    </>
  )
}
