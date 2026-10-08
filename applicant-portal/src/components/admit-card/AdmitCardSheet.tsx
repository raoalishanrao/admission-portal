import type { AdmitCard } from '@/lib/api/types'

type Props = {
  card: AdmitCard
}

function formatTime(value: string) {
  if (!value) return '—'
  const parts = value.split(':')
  if (parts.length < 2) return value
  const hours = Number(parts[0])
  const minutes = parts[1]?.slice(0, 2) ?? '00'
  if (Number.isNaN(hours)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${suffix}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function qrImageSrc(qrUrl: string) {
  if (!qrUrl) return ''
  if (qrUrl.startsWith('data:') || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(qrUrl)) {
    return qrUrl
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(qrUrl)}`
}

function PhotoPlaceholder() {
  return (
    <div className="admit-card-sheet__photo-placeholder" aria-hidden>
      <svg viewBox="0 0 64 64" fill="currentColor">
        <circle cx="32" cy="22" r="12" />
        <path d="M8 58c0-13.255 10.745-24 24-24s24 10.745 24 24" />
      </svg>
    </div>
  )
}

export function AdmitCardSheet({ card }: Props) {
  const programmes = [...(card.programmeOptions || [])].sort(
    (a, b) => a.preferenceOrder - b.preferenceOrder,
  )
  const serial = card.serialNumber || card.applicationId

  return (
    <article className="admit-card-sheet">
      <header className="admit-card-sheet__top">
        <div className="admit-card-sheet__brand">
          <div className="admit-card-sheet__mark" aria-hidden>
            T
          </div>
          <div className="admit-card-sheet__org">
            <h1>Taleem AI</h1>
            <p>Admissions · Entry test</p>
          </div>
        </div>
        <div className="admit-card-sheet__serial">
          <span>Admit card no.</span>
          <strong>{serial}</strong>
        </div>
      </header>

      <p className="admit-card-sheet__banner">Entry Test Admit Card</p>

      <section className="admit-card-sheet__profile">
        <dl className="admit-card-sheet__fields">
          <div className="admit-card-sheet__row">
            <dt>Applicant name</dt>
            <dd>{card.applicantName}</dd>
          </div>
          <div className="admit-card-sheet__row">
            <dt>Father / Guardian</dt>
            <dd>{card.fatherGuardianName || '—'}</dd>
          </div>
          <div className="admit-card-sheet__row">
            <dt>Gender</dt>
            <dd>{card.gender || '—'}</dd>
          </div>
          <div className="admit-card-sheet__row">
            <dt>Intake / session</dt>
            <dd>{card.intakeSession || '—'}</dd>
          </div>
          <div className="admit-card-sheet__row">
            <dt>Application ID</dt>
            <dd>{card.applicationId}</dd>
          </div>
        </dl>

        <div className="admit-card-sheet__photo-wrap">
          {card.photographDownloadUrl ? (
            <img
              className="admit-card-sheet__photo"
              src={card.photographDownloadUrl}
              alt={card.applicantName}
            />
          ) : (
            <PhotoPlaceholder />
          )}
          <span className="admit-card-sheet__photo-caption">Applicant photo</span>
        </div>
      </section>

      <section className="admit-card-sheet__schedule">
        <span className="admit-card-sheet__venue-label">Test venue</span>
        <p className="admit-card-sheet__venue-value">{card.testVenue || '—'}</p>
        <div className="admit-card-sheet__meta-row">
          <div className="admit-card-sheet__meta-item">
            <span>Test date</span>
            <strong>{formatDate(card.testDate)}</strong>
          </div>
          <div className="admit-card-sheet__meta-item">
            <span>Reporting</span>
            <strong>{formatTime(card.reportingTime)}</strong>
          </div>
          <div className="admit-card-sheet__meta-item">
            <span>Test time</span>
            <strong>{formatTime(card.testTime)}</strong>
          </div>
          <div className="admit-card-sheet__meta-item">
            <span>Room</span>
            <strong>{card.room || '—'}</strong>
          </div>
        </div>
      </section>

      {programmes.length > 0 ? (
        <section className="admit-card-sheet__programmes">
          <h3>Programme preferences</h3>
          <table className="admit-card-sheet__programme-table">
            <thead>
              <tr>
                <th className="admit-card-sheet__pref">Pref.</th>
                <th>Programme</th>
                <th className="admit-card-sheet__code">Code</th>
              </tr>
            </thead>
            <tbody>
              {programmes.map((option) => (
                <tr key={`${option.programmeId}-${option.preferenceOrder}`}>
                  <td className="admit-card-sheet__pref">{option.preferenceOrder}</td>
                  <td>{option.programmeName}</td>
                  <td className="admit-card-sheet__code">
                    {option.programmeCode || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="admit-card-sheet__bottom">
        <div className="admit-card-sheet__instructions">
          <h3>Instructions</h3>
          <p>
            {card.instructions ||
              'Bring this admit card, your original identity document, and original paid-fee evidence. Arrive before the reporting time.'}
          </p>
        </div>
        <div className="admit-card-sheet__qr-block">
          <div className="admit-card-sheet__qr-frame">
            {card.qrUrl ? (
              <img
                className="admit-card-sheet__qr"
                src={qrImageSrc(card.qrUrl)}
                alt="Attendance QR code"
              />
            ) : (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>QR</span>
            )}
          </div>
          <span>Attendance QR</span>
        </div>
      </section>

      <footer className="admit-card-sheet__footer">
        <span>Issued {formatDate(card.issueDate)}</span>
        <span>
          {card.publishedAt
            ? `Published ${formatDate(String(card.publishedAt).slice(0, 10))}`
            : 'Official admit card'}
        </span>
      </footer>
    </article>
  )
}
