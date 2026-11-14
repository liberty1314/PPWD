import { useId, useState, type ChangeEvent, type FocusEvent } from 'react'

interface OtpInputProps {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function OtpInput({ id, label, value, onChange, disabled = false }: OtpInputProps) {
  const generatedId = useId()
  const inputId = id ?? `otp-${generatedId}`
  const [focused, setFocused] = useState(false)
  const [caretPosition, setCaretPosition] = useState(value.length)

  function moveCaretToEnd(input: HTMLInputElement): void {
    const end = input.value.length
    input.setSelectionRange(end, end)
    setCaretPosition(end)
  }

  function updateCaretPosition(input: HTMLInputElement): void {
    setCaretPosition(input.selectionStart ?? input.value.length)
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const input = event.currentTarget
    const nextValue = input.value.replace(/\D/g, '').slice(0, 6)
    onChange(nextValue)
    setCaretPosition(Math.min(input.selectionStart ?? nextValue.length, nextValue.length))
  }

  function handleFocus(event: FocusEvent<HTMLInputElement>): void {
    setFocused(true)
    moveCaretToEnd(event.currentTarget)
  }

  const activeIndex = Math.min(caretPosition, 5)

  return <div className="bp-field bp-otp-field">
    <label className="bp-field__label" htmlFor={inputId}>{label}</label>
    <div className="bp-otp" aria-disabled={disabled}>
      <div className="bp-otp__slots" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span
          key={index}
          className="bp-otp__slot"
          data-active={focused && activeIndex === index}
        >{value[index] ?? ''}</span>)}
      </div>
      <input
        id={inputId}
        className="bp-otp__input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={() => setFocused(false)}
        onClick={(event) => moveCaretToEnd(event.currentTarget)}
        onKeyUp={(event) => updateCaretPosition(event.currentTarget)}
        onSelect={(event) => updateCaretPosition(event.currentTarget)}
      />
    </div>
  </div>
}
