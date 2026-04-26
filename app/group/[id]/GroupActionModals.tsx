import { type Dispatch, type SetStateAction } from "react";
import { EditGroupModal } from "./EditGroupModal";
import { GroupPageModal } from "./GroupPagePrimitives";
import { type GroupData, type Member } from "./group-page-state";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type GroupActionModalsProps = {
  actionMsg: string;
  actionSaving: boolean;
  deleteConfirm: string;
  deleteMsg: string;
  deleteSaving: boolean;
  editBudget: number;
  editCurrency: string;
  editCurrencySymbol: string;
  editCustom: boolean;
  editDate: string;
  editDesc: string;
  editMsg: string;
  editName: string;
  editSaving: boolean;
  groupData: GroupData;
  removingMember: Member | null;
  showDeleteModal: boolean;
  showEditModal: boolean;
  showLeaveModal: boolean;
  onCloseDelete: () => void;
  onCloseEdit: () => void;
  onCloseLeave: () => void;
  onCloseRemoveMember: () => void;
  onDelete: () => void;
  onEditSave: () => void;
  onLeave: () => void;
  onRemoveMember: () => void;
  setDeleteConfirm: StateSetter<string>;
  setEditBudget: StateSetter<number>;
  setEditCurrency: StateSetter<string>;
  setEditCustom: StateSetter<boolean>;
  setEditDate: StateSetter<string>;
  setEditDesc: StateSetter<string>;
  setEditName: StateSetter<string>;
};

function ModalCancelButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-[13px] font-bold"
      style={{
        background: "#f3f4f6",
        color: "#6b7280",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

export function GroupActionModals({
  actionMsg,
  actionSaving,
  deleteConfirm,
  deleteMsg,
  deleteSaving,
  editBudget,
  editCurrency,
  editCurrencySymbol,
  editCustom,
  editDate,
  editDesc,
  editMsg,
  editName,
  editSaving,
  groupData,
  removingMember,
  showDeleteModal,
  showEditModal,
  showLeaveModal,
  onCloseDelete,
  onCloseEdit,
  onCloseLeave,
  onCloseRemoveMember,
  onDelete,
  onEditSave,
  onLeave,
  onRemoveMember,
  setDeleteConfirm,
  setEditBudget,
  setEditCurrency,
  setEditCustom,
  setEditDate,
  setEditDesc,
  setEditName,
}: GroupActionModalsProps) {
  return (
    <>
      {showEditModal && (
        <EditGroupModal
          editBudget={editBudget}
          editCurrency={editCurrency}
          editCurrencySymbol={editCurrencySymbol}
          editCustom={editCustom}
          editDate={editDate}
          editDesc={editDesc}
          editMsg={editMsg}
          editName={editName}
          editSaving={editSaving}
          onClose={onCloseEdit}
          onSave={onEditSave}
          setEditBudget={setEditBudget}
          setEditCurrency={setEditCurrency}
          setEditCustom={setEditCustom}
          setEditDate={setEditDate}
          setEditDesc={setEditDesc}
          setEditName={setEditName}
        />
      )}

      {showDeleteModal && (
        <GroupPageModal onClose={onCloseDelete}>
          <div className="text-center">
            <div className="text-[48px] mb-2">{"\u26A0\uFE0F"}</div>
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}
            >
              Delete this group?
            </h3>
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              This will permanently delete{" "}
              <strong style={{ color: "#1f2937" }}>&quot;{groupData.name}&quot;</strong>, all
              recipients, wishlists, and messages. This cannot be undone.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={`Type "${groupData.name}" to confirm`}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] text-center outline-none mb-3"
              style={{ border: "2px solid #e5e7eb", fontFamily: "inherit" }}
            />
            {deleteMsg && <p className="text-[12px] font-bold text-red-600 mb-2">{deleteMsg}</p>}
            <div className="flex gap-2 justify-center">
              <ModalCancelButton onClick={onCloseDelete}>Cancel</ModalCancelButton>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleteSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold"
                style={{
                  background: "rgba(220,38,38,.06)",
                  color: "#dc2626",
                  border: "1px solid rgba(220,38,38,.15)",
                  cursor: deleteSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {deleteSaving ? "Deleting..." : "\uD83D\uDDD1\uFE0F Delete Forever"}
              </button>
            </div>
          </div>
        </GroupPageModal>
      )}

      {showLeaveModal && (
        <GroupPageModal onClose={onCloseLeave}>
          <div className="text-center">
            <div className="text-[48px] mb-2">{"\uD83D\uDEAA"}</div>
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#f59e0b" }}
            >
              Leave this group?
            </h3>
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              You&apos;ll be removed from{" "}
              <strong style={{ color: "#1f2937" }}>&quot;{groupData.name}&quot;</strong>.
              You&apos;ll lose access to recipients, wishlists, and chat. You can be re-invited
              later.
            </p>
            {actionMsg && <p className="text-[12px] font-bold text-red-600 mb-2">{actionMsg}</p>}
            <div className="flex gap-2 justify-center">
              <ModalCancelButton onClick={onCloseLeave}>Stay</ModalCancelButton>
              <button
                type="button"
                onClick={onLeave}
                disabled={actionSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold text-white"
                style={{
                  background: actionSaving ? "#9ca3af" : "linear-gradient(135deg,#b45309,#f59e0b)",
                  border: "none",
                  cursor: actionSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {actionSaving ? "Leaving..." : "\uD83D\uDEAA Leave Group"}
              </button>
            </div>
          </div>
        </GroupPageModal>
      )}

      {removingMember && (
        <GroupPageModal onClose={onCloseRemoveMember}>
          <div className="text-center">
            <div className="text-[48px] mb-2">{"\uD83D\uDC4B"}</div>
            <h3
              className="text-[20px] font-bold mb-2"
              style={{ fontFamily: "'Fredoka', sans-serif", color: "#dc2626" }}
            >
              Remove {removingMember.nickname}?
            </h3>
            <p className="text-[13px] mb-4 leading-relaxed" style={{ color: "#6b7280" }}>
              <strong style={{ color: "#1f2937" }}>{removingMember.nickname}</strong> will be
              removed from the group. If names have already been drawn, the draw will need to be
              redone.
            </p>
            {actionMsg && (
              <p
                className="text-[12px] font-bold mb-2"
                style={{ color: actionMsg.includes("removed") ? "#16a34a" : "#dc2626" }}
              >
                {actionMsg}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <ModalCancelButton onClick={onCloseRemoveMember}>Cancel</ModalCancelButton>
              <button
                type="button"
                onClick={onRemoveMember}
                disabled={actionSaving}
                className="px-5 py-2 rounded-lg text-[13px] font-extrabold"
                style={{
                  background: "rgba(220,38,38,.06)",
                  color: "#dc2626",
                  border: "1px solid rgba(220,38,38,.15)",
                  cursor: actionSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {actionSaving ? "Removing..." : "\u2715 Remove Member"}
              </button>
            </div>
          </div>
        </GroupPageModal>
      )}
    </>
  );
}
