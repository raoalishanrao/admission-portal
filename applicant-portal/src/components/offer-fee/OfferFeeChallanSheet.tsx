import type { OfferFeeChallan } from '@/lib/api/types'

type Props = {
  challan: OfferFeeChallan
}

function money(value: string | number | null | undefined) {
  const num = typeof value === 'number' ? value : Number(value ?? 0)
  if (Number.isNaN(num)) return String(value ?? '—')
  return `Rs. ${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString()
}

export function OfferFeeChallanSheet({ challan }: Props) {
  const items = challan.items ?? []

  return (
    <article className="offer-fee-sheet">
      <header className="offer-fee-sheet__header">
        <div>
          <h1>Taleem AI</h1>
          <p>Admission / offer fee challan</p>
        </div>
        <div className="offer-fee-sheet__challan-no">
          <span>Challan number</span>
          <strong>{challan.challanNumber}</strong>
        </div>
      </header>

      <p className="offer-fee-sheet__banner">Bank deposit slip</p>

      <div className="offer-fee-sheet__grid">
        <div className="offer-fee-sheet__field">
          <span>Applicant name</span>
          <strong>{challan.applicantName}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Registration / ref</span>
          <strong>{challan.registrationNumber}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Contact</span>
          <strong>{challan.applicantContactNumber || '—'}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Intake</span>
          <strong>{challan.intakeSession || '—'}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Programme</span>
          <strong>{challan.programmeName}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Payment status</span>
          <strong>{challan.paymentStatus}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Issue date</span>
          <strong>{formatDate(challan.issueDate)}</strong>
        </div>
        <div className="offer-fee-sheet__field">
          <span>Due date</span>
          <strong>{formatDate(challan.dueDate)}</strong>
        </div>
      </div>

      <div className="offer-fee-sheet__bank">
        <h3>Collection bank</h3>
        <div className="offer-fee-sheet__bank-grid">
          <div>
            <span>Bank </span>
            <strong>{challan.collectionBankName}</strong>
          </div>
          <div>
            <span>Branch </span>
            <strong>{challan.collectionBankBranch}</strong>
          </div>
          <div>
            <span>Account </span>
            <strong>{challan.collectionBankAccount}</strong>
          </div>
          <div>
            <span>Branch code </span>
            <strong>{challan.branchCode || '—'}</strong>
          </div>
          {challan.institutionCode ? (
            <div>
              <span>Institution code </span>
              <strong>{challan.institutionCode}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div className="offer-fee-sheet__items">
        <table>
          <thead>
            <tr>
              <th>Fee description</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td>Admission fee total</td>
                <td className="num">{money(challan.totalAmountPayable)}</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.description || item.feeTypeCode.replaceAll('_', ' ')}
                  </td>
                  <td className="num">{money(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="offer-fee-sheet__total">
        <span>Total amount payable</span>
        <strong>{money(challan.totalAmountPayable)}</strong>
      </div>

      {challan.amountInWords ? (
        <p className="offer-fee-sheet__words">
          Amount in words: <strong>{challan.amountInWords}</strong>
        </p>
      ) : null}

      <footer className="offer-fee-sheet__footer">
        <span>Deposit this challan before the due date to secure your seat.</span>
        <span>Status: {challan.paymentStatus}</span>
      </footer>
    </article>
  )
}
