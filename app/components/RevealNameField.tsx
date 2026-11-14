import { REVEAL_NAME_MAX_LENGTH } from "@/lib/groups/reveal-name";

type RevealNameFieldProps = {
  id: string;
  inputClassName: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function RevealNameField({
  id, inputClassName, value, onChange, disabled, required,
}: RevealNameFieldProps) {
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-[#2e3432]">
        Your name for the reveal <span aria-hidden="true">*</span>
      </label>
      <input
        id={id}
        name="revealName"
        type="text"
        autoComplete="name"
        maxLength={REVEAL_NAME_MAX_LENGTH}
        aria-required="true"
        aria-describedby={hintId}
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className={inputClassName}
      />
      <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-slate-600">
        Use your real name or the name this group knows you by. It stays private until the reveal.
      </p>
    </div>
  );
}
