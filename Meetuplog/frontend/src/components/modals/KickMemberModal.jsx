import { useEffect, useState } from 'react'

import AppModal from '../common/AppModal'

const MAX_REASON_LENGTH = 200

const KickMemberModal = ({ open, member, onClose, onConfirm }) => {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open, member?.id])

  const handleSubmit = (event) => {
    event.preventDefault()
    onConfirm?.(member, reason.trim())
  }

  return (
    <AppModal
      open={open}
      title="참여자 내보내기"
      onClose={onClose}
      size="small"
    >
      <form className="confirm-modal-content kick-member-form" onSubmit={handleSubmit}>
        <div className="confirm-member-avatar">{member?.nickname?.slice(0, 1) ?? '?'}</div>
        <p><strong>{member?.nickname}</strong>님을<br />이 채팅방에서 내보낼까요?</p>

        <label className="kick-reason-field">
          <span className="kick-reason-label">
            <strong>강퇴 사유</strong>
            <em>선택사항</em>
          </span>
          <textarea
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            placeholder="강퇴 사유 입력"
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="kick-reason-meta">
            <small>{reason.length}/{MAX_REASON_LENGTH}</small>
          </span>
        </label>

        <div className="modal-action-row">
          <button type="button" className="secondary-action" onClick={onClose}>취소</button>
          <button type="submit" className="danger-action">강퇴</button>
        </div>
      </form>
    </AppModal>
  )
}

export default KickMemberModal
