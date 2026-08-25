import AppModal from '../common/AppModal'
import { TrashIcon } from '../common/Icons'

const DeleteAccountModal = ({
  open,
  submitting = false,
  error = '',
  onClose,
  onConfirm,
}) => {
  const handleClose = () => {
    if (!submitting) {
      onClose?.()
    }
  }

  return (
    <AppModal
      open={open}
      title="회원탈퇴"
      subtitle="계정을 삭제하면 되돌릴 수 없습니다."
      eyebrow="ACCOUNT DELETE"
      icon={<TrashIcon />}
      onClose={handleClose}
      size="small"
    >
      <div className="flex flex-col gap-5">
        {/* 삭제 경고 */}
        <div
          className="
            flex items-start gap-3
            rounded-2xl
            border border-red-200/70
            bg-red-50/60
            px-4 py-4
            dark:border-red-500/20
            dark:bg-red-500/10
          "
        >
          <div
            className="
              flex h-9 w-9 shrink-0
              items-center justify-center
              rounded-xl
              bg-red-500/10
              text-red-500
            "
          >
            <TrashIcon />
          </div>

          <div className="min-w-0 pt-0.5">
            <strong
              className="
                block
                text-[13px]
                font-semibold
                leading-5
                text-red-600
                dark:text-red-400
              "
            >
              계정과 데이터가 영구 삭제됩니다
            </strong>

            <p
              className="
                mt-1
                text-[11px]
                leading-[1.65]
                text-slate-500
                dark:text-slate-400
              "
            >
              프로필, 친구 관계 및 개인 계정 정보가 삭제되며 복구할 수 없습니다.
            </p>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="profile-password-status error" role="alert">
            {error}
          </div>
        )}

        {/* 버튼 */}
        <div className="modal-action-row">
          <button
            type="button"
            className="secondary-action"
            disabled={submitting}
            onClick={handleClose}
          >
            취소
          </button>

          <button
            type="button"
            className="danger-action"
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? '처리 중...' : '회원탈퇴'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}

export default DeleteAccountModal
