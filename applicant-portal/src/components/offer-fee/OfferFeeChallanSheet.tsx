import type { OfferFeeChallan } from '@/lib/api/types'
import '@/components/processing-fee/ProcessingFeeChallan.css'

type Props = {
  challan: OfferFeeChallan
}

type FeeLine = { label: string; amount: number }

const money = (value = 0) =>
  value > 0 ? `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}/-` : ''

function formatIssueDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return value.slice(0, 10)
}

function formatDueDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return value.slice(0, 10)
}

function itemAmount(challan: OfferFeeChallan, matchers: string[]) {
  const items = challan.items ?? []
  const hit = items.find((item) => {
    const code = `${item.feeTypeCode} ${item.description}`.toUpperCase()
    return matchers.some((m) => code.includes(m))
  })
  return hit ? Number(hit.amount) || 0 : 0
}

/** Fixed charge rows matching Full Fee Challan.pdf */
function feeLines(challan: OfferFeeChallan): FeeLine[] {
  return [
    {
      label: 'Application Processing Fee',
      amount: itemAmount(challan, ['APPLICATION', 'PROCESSING']),
    },
    { label: 'Tuition Fee', amount: itemAmount(challan, ['TUITION']) },
    {
      label: 'Semester Registration Fee',
      amount: itemAmount(challan, ['SEMESTER_REGISTRATION', 'SEMESTER REGISTRATION', 'REGISTRATION']),
    },
    {
      label: 'Student ID Card',
      amount: itemAmount(challan, ['ID_CARD', 'ID CARD', 'STUDENT ID']),
    },
    { label: 'Council Fee', amount: itemAmount(challan, ['COUNCIL']) },
    { label: 'Admission Fee', amount: itemAmount(challan, ['ADMISSION']) },
    { label: 'Scholarship', amount: itemAmount(challan, ['SCHOLARSHIP']) },
    {
      label: 'Course Transfer Fee',
      amount: itemAmount(challan, ['COURSE_TRANSFER', 'TRANSFER']),
    },
    { label: 'Balance', amount: itemAmount(challan, ['BALANCE']) },
    { label: 'Late Fee Fine', amount: itemAmount(challan, ['LATE']) },
    { label: 'Others', amount: itemAmount(challan, ['OTHER']) },
  ]
}

function totalFromLines(lines: FeeLine[], scholarship: number) {
  const sum = lines.reduce((acc, line) => {
    if (line.label === 'Scholarship') return acc
    return acc + (line.amount || 0)
  }, 0)
  return Math.max(0, sum - scholarship)
}

/** Depositor boxes span fee rows like the PDF (CNIC includes Total Fee row). */
const DEPOSITOR_SPANS = [
  { label: "Depositor's Name", start: 0, span: 3 },
  { label: "Depositor's Contact Number", start: 3, span: 4 },
  { label: "Depositor's CNIC", start: 7, span: 5 },
] as const

function isCoveredByDepositorSpan(rowIndex: number) {
  return DEPOSITOR_SPANS.some(
    (d) => rowIndex > d.start && rowIndex < d.start + d.span,
  )
}

function ChallanCopy({
  challan,
  copyType,
}: {
  challan: OfferFeeChallan
  copyType: 'Student Copy' | 'University Copy' | 'Bank Copy'
}) {
  const lines = feeLines(challan)
  const scholarship = itemAmount(challan, ['SCHOLARSHIP'])
  const total =
    Number(challan.totalAmountPayable) || totalFromLines(lines, scholarship)
  const amountWords =
    challan.amountInWords?.trim() ||
    `${total.toLocaleString()} Rupees Only/-`
  const bankName = challan.collectionBankName || 'Allied Bank Ltd.'
  const depositorAt = new Map<number, (typeof DEPOSITOR_SPANS)[number]>(
    DEPOSITOR_SPANS.map((d) => [d.start, d]),
  )

  return (
    <article className="challan-copy">
      <header className="challan-top">
        <div className="uni-logo" aria-hidden>
          <div className="uni-logo-mark">IU</div>
          <div className="uni-logo-text">
            IQRA
            <br />
            UNIVERSITY
          </div>
        </div>
        <div className="bank-center">
          <div className="bank-line-1">
            Iqra University (Chak Shahzad) {bankName}
          </div>
          <div className="bank-line-2">
            A/c. No. {challan.collectionBankAccount || '—'}
          </div>
          <div className="bank-line-3">
            {challan.collectionBankBranch || '—'}
            {challan.branchCode ? ` (Code ${challan.branchCode})` : ''}
          </div>
        </div>
        <div className="bank-logo-wrap">
          <div className="bank-logo-fallback" aria-hidden>
            <div className="bank-a">
              {bankName.toUpperCase().includes('ALLIED') ||
              bankName.toUpperCase().includes('ABL')
                ? 'ABL'
                : bankName
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 3)
                    .toUpperCase() || 'BANK'}
            </div>
            <div className="bank-name">{bankName.toUpperCase()}</div>
          </div>
        </div>
      </header>

      <div className="inst-copy-row">
        <span>
          Institution Code:{' '}
          <strong>{challan.institutionCode?.trim() || '—'}</strong>
        </span>
        <h2 className="copy-title">{copyType}</h2>
        <span aria-hidden />
      </div>

      <div className="dates-row">
        <span>
          Issue Date: <strong>{formatIssueDate(challan.issueDate)}</strong>
        </span>
        <span className="dates-right">
          Slip/Challan No. <strong>{challan.challanNumber}</strong>
        </span>
      </div>
      <div className="dates-row dates-row-due">
        <span>
          Due Date: <strong>{formatDueDate(challan.dueDate)}</strong>
        </span>
      </div>

      <div className="section-head">Student/General Information</div>
      <div className="info-grid">
        <div>
          Student Name: <strong>{challan.applicantName}</strong>
        </div>
        <div>
          Class/Semester: <strong>{challan.intakeSession || '—'}</strong>
        </div>
        <div>
          Contact No: <strong>{challan.applicantContactNumber || '—'}</strong>
        </div>
        <div>
          Reg. Number: <strong>{challan.registrationNumber}</strong>
        </div>
      </div>

      <div className="section-head section-head-left">Programme Applied</div>
      <div className="info-grid" style={{ marginBottom: 3 }}>
        <div>
          Program: <strong>{challan.programmeName || '—'}</strong>
        </div>
        <div>
          Credit Hr: <strong>—</strong>
        </div>
      </div>

      <p className="instr">
        <strong>Bank Instructions:</strong> Use Challan No. to input data
      </p>
      <p className="instr">
        Note: This challan form/Deposit slip is{' '}
        <strong>only for Cash Deposit.</strong>
      </p>

      <table className="charges-table">
        <colgroup>
          <col className="col-nature" />
          <col className="col-amount" />
          <col className="col-depositor" />
        </colgroup>
        <thead>
          <tr>
            <th>Nature of Charges</th>
            <th>
              Amount
              <br />
              (Rs.)
            </th>
            <th className="th-empty" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const dep = depositorAt.get(index)
            const covered = isCoveredByDepositorSpan(index)
            return (
              <tr key={line.label}>
                <td>{line.label}</td>
                <td className="amt">{money(line.amount)}</td>
                {dep ? (
                  <td className="dep-cell" rowSpan={dep.span}>
                    {dep.label}
                  </td>
                ) : covered ? null : (
                  <td className="dep-cell dep-empty" />
                )}
              </tr>
            )
          })}
          <tr className="total-row">
            <td>
              <strong>Total Fee ()</strong>
            </td>
            <td className="amt">
              <strong>{money(total)}</strong>
            </td>
          </tr>
          <tr className="words-row">
            <td colSpan={3}>
              Amount in word(s):{' '}
              <strong className="words-value">{amountWords}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="auth-signs">
        <div className="auth-sign">
          <div className="auth-rule" />
          Authorised Signature
        </div>
        <div className="auth-sign">
          <div className="auth-rule" />
          Authorised Signature
        </div>
      </div>

      <div className="footer-row">
        <div className="terms">
          <p>
            Terms and Conditions: Cash should always be deposited at the
            respective counter and electronic computer generated receipt
            obtained from the bank. The depositor should check the receipt
            before leaving the counter. Please ensure account number and amount
            are correctly printed; the bank will not be responsible for errors
            detected later.
          </p>
          <p className="terms-ur" dir="rtl">
            شرائط و ضوابط: نقد رقم ہمیشہ متعلقہ کاؤنٹر پر جمع کروائیں اور
            کمپیوٹرائزڈ رسید ضرور حاصل کریں۔ رسید حاصل کرنے سے پہلے چالان نمبر،
            رجسٹریشن نمبر اور رقم کی تصدیق کر لیں۔
          </p>
        </div>
        <div className="erp-box">
          <span>CRP Validation</span>
        </div>
      </div>
    </article>
  )
}

export function OfferFeeChallanSheet({ challan }: Props) {
  return (
    <div className="challan-sheet">
      <ChallanCopy challan={challan} copyType="Student Copy" />
      <ChallanCopy challan={challan} copyType="University Copy" />
      <ChallanCopy challan={challan} copyType="Bank Copy" />
    </div>
  )
}
