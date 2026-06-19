import { type Dispatch, type SetStateAction } from "react";
import { formatCurrencyOptionLabel, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { BUDGET_OPTIONS } from "./group-page-config";
import { GroupPageModal } from "./GroupPagePrimitives";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type EditGroupModalProps = {
  editBudget: number;
  editCurrency: string;
  editCurrencySymbol: string;
  editCustom: boolean;
  editDate: string;
  editDesc: string;
  editMsg: string;
  editName: string;
  editSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  setEditBudget: StateSetter<number>;
  setEditCurrency: StateSetter<string>;
  setEditCustom: StateSetter<boolean>;
  setEditDate: StateSetter<string>;
  setEditDesc: StateSetter<string>;
  setEditName: StateSetter<string>;
};

function FieldLabel({ children }: { children: string }) {
  return (
    <label className="text-[12px] font-extrabold block mb-1" style={{ color: "#374151" }}>
      {children}
    </label>
  );
}

const inputStyle = {
  border: "2px solid #e5e7eb",
  fontFamily: "inherit",
  background: "#ffffff",
  color: "#0f172a",
  WebkitTextFillColor: "#0f172a",
};

export function EditGroupModal({
  editBudget,
  editCurrency,
  editCurrencySymbol,
  editCustom,
  editDate,
  editDesc,
  editMsg,
  editName,
  editSaving,
  onClose,
  onSave,
  setEditBudget,
  setEditCurrency,
  setEditCustom,
  setEditDate,
  setEditDesc,
  setEditName,
}: EditGroupModalProps) {
  return (
    <GroupPageModal onClose={onClose}>
      <h3
        className="text-[20px] font-bold mb-4 flex items-center gap-2"
        style={{ fontFamily: "'Fredoka', sans-serif", color: "#1a1a1a" }}
      >
        {"\u270F\uFE0F"} Edit Group
      </h3>

      <div className="space-y-3">
        <div>
          <FieldLabel>Group Name</FieldLabel>
          <input
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            maxLength={100}
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>Description</FieldLabel>
          <input
            value={editDesc}
            onChange={(event) => setEditDesc(event.target.value)}
            maxLength={300}
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>Gift date</FieldLabel>
          <input
            type="date"
            value={editDate}
            onChange={(event) => setEditDate(event.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel>Budget</FieldLabel>
          <div className="flex gap-1.5 flex-wrap">
            {BUDGET_OPTIONS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setEditBudget(amount);
                  setEditCustom(false);
                }}
                className="gift-button gift-button-compact text-[12px]"
                style={{
                  border: `2px solid ${
                    !editCustom && editBudget === amount ? "#c0392b" : "#e5e7eb"
                  }`,
                  background: !editCustom && editBudget === amount ? "#fef2f2" : "#fff",
                  color: !editCustom && editBudget === amount ? "#c0392b" : "#6b7280",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {editCurrencySymbol}
                {amount}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setEditCustom(true)}
              className="gift-button gift-button-compact text-[12px]"
              style={{
                border: `2px solid ${editCustom ? "#c0392b" : "#e5e7eb"}`,
                background: editCustom ? "#fef2f2" : "#fff",
                color: editCustom ? "#c0392b" : "#6b7280",
                cursor: "pointer",
                fontFamily: "inherit",
                borderStyle: "dashed",
              }}
            >
              Custom
            </button>
          </div>

          {editCustom && (
            <input
              type="number"
              value={editBudget}
              onChange={(event) => setEditBudget(parseInt(event.target.value, 10) || 0)}
              className="mt-2 w-28 px-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ ...inputStyle, border: "2px solid #c0392b" }}
            />
          )}
        </div>

        <div>
          <FieldLabel>Currency</FieldLabel>
          <select
            value={editCurrency}
            onChange={(event) => setEditCurrency(event.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-[14px] outline-none"
            style={inputStyle}
          >
            {SUPPORTED_CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {formatCurrencyOptionLabel(currency)}
              </option>
            ))}
          </select>
        </div>

        {editMsg && (
          <p
            className={`text-[12px] font-bold ${
              editMsg.includes("updated") ? "text-green-600" : "text-red-600"
            }`}
          >
            {editMsg}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="gift-button gift-button-secondary gift-button-compact text-[13px]"
            style={{
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={editSaving}
            className="gift-button gift-button-primary gift-button-compact text-[13px]"
            style={{
              fontFamily: "inherit",
            }}
          >
            {editSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </GroupPageModal>
  );
}
