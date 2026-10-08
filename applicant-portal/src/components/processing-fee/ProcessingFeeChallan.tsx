import type { ProcessingFeeChallan as ApiChallan } from '@/lib/api/types'
import './ProcessingFeeChallan.css'

export type ChallanData = {
  institutionName: string
  bankName: string
  bankAccountLine: string
  bankBranch: string
  bankLogoUrl?: string | null
  institutionCode: string

  issueDate: string
  dueDate: string
  challanNo: string

  studentName: string
  classSemester: string
  contactNo: string
  registrationNo: string

  programmes: string[]

  applicationProcessingFee: number
  tuitionFee?: number
  studentFund?: number
  libraryFee?: number
  admissionFee?: number
  scholarship?: number
  courseTransferFee?: number
  balance?: number
  lateFeeFine?: number
  otherCharges?: number

  amountInWords?: string
}

type FeeLine = { label: string; amount: number }

const money = (value = 0) => (value > 0 ? `Rs. ${value.toLocaleString()}/-` : '')

const totalFee = (data: ChallanData) =>
  data.applicationProcessingFee +
  (data.tuitionFee || 0) +
  (data.studentFund || 0) +
  (data.libraryFee || 0) +
  (data.admissionFee || 0) +
  (data.courseTransferFee || 0) +
  (data.balance || 0) +
  (data.lateFeeFine || 0) +
  (data.otherCharges || 0) -
  (data.scholarship || 0)

const wordsFor = (data: ChallanData, amount: number) => {
  if (data.amountInWords?.trim()) return data.amountInWords
  if (amount === 1500) return 'One Thousand Five Hundred Rupees Only/-'
  return `${amount.toLocaleString()} Rupees Only/-`
}

function formatIssueDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

function formatDueDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-GB', { month: 'short' })
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

function parseProgrammes(raw: string) {
  if (!raw?.trim()) return [] as string[]
  return raw
    .split(/;|\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^\d+\.\s*/, ''))
}

function itemAmount(challan: ApiChallan, matchers: string[]) {
  const hit = challan.items.find((item) => {
    const code = `${item.feeTypeCode} ${item.description}`.toUpperCase()
    return matchers.some((m) => code.includes(m))
  })
  return hit ? Number(hit.amount) || 0 : 0
}

export function mapApiChallanToData(challan: ApiChallan): ChallanData {
  const processing = itemAmount(challan, ['APPLICATION', 'PROCESSING'])
  const bankName = challan.collectionBankName || 'Habib Bank'
  return {
    // Header title line — bank from API (e.g. Habib Bank), not Allied
    institutionName: bankName,
    bankName,
    bankAccountLine: `A/c. No. ${challan.collectionBankAccount}`,
    bankBranch: `${challan.collectionBankBranch} (Code ${challan.branchCode})`,
    bankLogoUrl: challan.bankLogoUrl,
    institutionCode: challan.institutionCode?.trim() || '—',
    issueDate: formatIssueDate(challan.issueDate),
    dueDate: formatDueDate(challan.dueDate),
    challanNo: challan.challanNumber,
    studentName: challan.applicantName,
    classSemester: challan.intakeSession,
    contactNo: challan.applicantContactNumber || '—',
    registrationNo: challan.registrationNumber,
    programmes: parseProgrammes(challan.programmesAppliedFor),
    applicationProcessingFee: processing || Number(challan.totalAmountPayable) || 0,
    tuitionFee: itemAmount(challan, ['TUITION']),
    studentFund: itemAmount(challan, ['STUDENT_FUND', 'STUDENT FUND']),
    libraryFee: itemAmount(challan, ['LIBRARY']),
    admissionFee: itemAmount(challan, ['ADMISSION']),
    scholarship: itemAmount(challan, ['SCHOLARSHIP']),
    courseTransferFee: itemAmount(challan, ['COURSE_TRANSFER', 'TRANSFER']),
    balance: itemAmount(challan, ['BALANCE']),
    lateFeeFine: itemAmount(challan, ['LATE']),
    otherCharges: itemAmount(challan, ['OTHER']),
    amountInWords: challan.amountInWords,
  }
}

function feeLines(data: ChallanData): FeeLine[] {
  return [
    { label: 'Application Processing Fee', amount: data.applicationProcessingFee },
    { label: 'Tuition Fee', amount: data.tuitionFee || 0 },
    { label: 'Student Fund', amount: data.studentFund || 0 },
    { label: 'Library Fee', amount: data.libraryFee || 0 },
    { label: 'Admission Fee', amount: data.admissionFee || 0 },
    { label: 'Scholarship', amount: data.scholarship || 0 },
    { label: 'Course Transfer Fee', amount: data.courseTransferFee || 0 },
    { label: 'Balance', amount: data.balance || 0 },
    { label: 'Late Fee Fine', amount: data.lateFeeFine || 0 },
    { label: 'Others', amount: data.otherCharges || 0 },
  ]
}

/** Depositor boxes span fee rows like the PDF (rowspan groups). */
const DEPOSITOR_SPANS = [
  { label: "Depositor's Name", start: 1, span: 2 },
  { label: "Depositor's Signature", start: 3, span: 3 },
  { label: "Depositor's Contact Number", start: 6, span: 3 },
  { label: "Depositor's CNIC", start: 9, span: 2 }, // Others + Total Fee
] as const

function isCoveredByDepositorSpan(rowIndex: number) {
  return DEPOSITOR_SPANS.some(
    (d) => rowIndex > d.start && rowIndex < d.start + d.span,
  )
}

function ChallanCopy({
  data,
  copyType,
}: {
  data: ChallanData
  copyType: 'Student Copy' | 'University Copy' | 'Bank Copy'
}) {
  const lines = feeLines(data)
  const total = totalFee(data)
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
          <div className="bank-line-1">{data.institutionName}</div>
          <div className="bank-line-2">{data.bankAccountLine}</div>
          <div className="bank-line-3">{data.bankBranch}</div>
        </div>
        <div className="bank-logo-wrap">
          {data.bankLogoUrl ? (
            <img src={data.bankLogoUrl} alt={data.bankName} className="bank-logo-img" />
          ) : (
            <div className="bank-logo-fallback" aria-hidden>
              <div className="bank-a">HBL</div>
              <div className="bank-name">{data.bankName.toUpperCase()}</div>
            </div>
          )}
        </div>
      </header>

      <div className="inst-copy-row">
        <span>
          Institution Code: <strong>{data.institutionCode}</strong>
        </span>
        <h2 className="copy-title">{copyType}</h2>
        <span aria-hidden />
      </div>

      <div className="dates-row">
        <span>
          Issue Date: <strong>{data.issueDate}</strong>
        </span>
        <span className="dates-right">
          Slip/Challan No. <strong>{data.challanNo}</strong>
        </span>
      </div>
      <div className="dates-row dates-row-due">
        <span>
          Due Date: <strong>{data.dueDate}</strong>
        </span>
      </div>

      <div className="section-head">Student/General Information</div>
      <div className="info-grid">
        <div>
          Student Name: <strong>{data.studentName}</strong>
        </div>
        <div>
          Class/Semester: <strong>{data.classSemester}</strong>
        </div>
        <div>
          Contact No: <strong>{data.contactNo}</strong>
        </div>
        <div>
          Reg. Number: <strong>{data.registrationNo}</strong>
        </div>
      </div>

      <div className="section-head section-head-left">Programme Applied</div>
      <div className="programme-block">
        <span className="programme-label">Program</span>
        <div className="programme-items">
          {data.programmes.length === 0
            ? '—'
            : data.programmes.map((p, i) => (
                <div key={`${i}-${p}`}>
                  {i + 1}. {p}
                </div>
              ))}
        </div>
      </div>

      <p className="instr">
        <strong>Bank Instructions:</strong> Use Challan No. to input data
      </p>
      <p className="instr">
        Note: This challan form/Deposit slip is <strong>only for Cash Deposit.</strong>
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
              <strong>Total Fee (Rs.)</strong>
            </td>
            <td className="amt">
              <strong>{money(total)}</strong>
            </td>
            {/* covered by Depositor's CNIC rowspan */}
          </tr>
          <tr className="words-row">
            <td colSpan={3}>
              Amount in word(s): <strong className="words-value">{wordsFor(data, total)}</strong>
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
            Terms and Conditions: Cash should always be deposited at the respective counter and
            electronic computer generated receipt obtained from the bank. The depositor should check
            the receipt before leaving the counter. Please ensure account number and amount are
            correctly printed; the bank will not be responsible for errors detected later.
          </p>
          <p className="terms-ur" dir="rtl">
            شرائط و ضوابط: نقد رقم ہمیشہ متعلقہ کاؤنٹر پر جمع کروائیں اور کمپیوٹرائزڈ رسید ضرور حاصل
            کریں۔ رسید حاصل کرنے سے پہلے چالان نمبر، رجسٹریشن نمبر اور رقم کی تصدیق کر لیں۔
          </p>
        </div>
        <div className="erp-box">
          <span>ERP Validation</span>
        </div>
      </div>
    </article>
  )
}

export default function ProcessingFeeChallan({ data }: { data: ChallanData }) {
  return (
    <div className="challan-sheet">
      <ChallanCopy data={data} copyType="Student Copy" />
      <ChallanCopy data={data} copyType="University Copy" />
      <ChallanCopy data={data} copyType="Bank Copy" />
    </div>
  )
}
