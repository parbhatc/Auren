import { Component } from 'react'
import { ConfigInputProps } from '../../types/common'
import { adminInputClass, fieldLabelClass } from '../../styles/aurenTheme'

/**
 * Simple input component for configuration forms
 * Handles number inputs properly to allow partial deletion
 */
class ConfigInput extends Component<ConfigInputProps> {
  state = {
    localValue: this.props.value.toString(),
    isFocused: false,
  }

  componentDidUpdate(prevProps: ConfigInputProps) {
    if (prevProps.value !== this.props.value && !this.state.isFocused) {
      this.setState({ localValue: this.props.value.toString() })
    }
  }

  handleChange = (newValue: string) => {
    this.setState({ localValue: newValue })
    
    const { type, onChange } = this.props
    // For number inputs, allow empty, partial, or negative values during typing
    if (type === 'number') {
      // Allow empty string, single minus, or valid numbers (including decimals)
      if (newValue === '' || newValue === '-' || /^-?\d*\.?\d*$/.test(newValue)) {
        onChange(newValue)
      }
    } else {
      onChange(newValue)
    }
  }

  handleBlur = () => {
    this.setState({ isFocused: false })
    const { type, value, onChange } = this.props
    const { localValue } = this.state

    // On blur, ensure number inputs have a valid value
    if (type === 'number') {
      if (localValue === '' || localValue === '-') {
        // Reset to current value if empty
        this.setState({ localValue: value.toString() })
        onChange(value.toString())
      } else {
        const numValue = parseFloat(localValue)
        if (isNaN(numValue)) {
          this.setState({ localValue: value.toString() })
          onChange(value.toString())
        } else {
          // Ensure we use the numeric value (integer if whole number)
          const finalValue = Number.isInteger(numValue) ? numValue.toString() : numValue.toString()
          this.setState({ localValue: finalValue })
          onChange(finalValue)
        }
      }
    }
  }

  handleFocus = () => {
    this.setState({ isFocused: true })
  }

  render() {
    const { label, type = 'text', placeholder, className = '', isDark, variant = 'default' } = this.props
    const { localValue } = this.state

    const inputClass =
      variant === 'admin'
        ? adminInputClass(Boolean(isDark))
        : `w-full px-4 py-2 rounded-lg border transition-all ${
            isDark
              ? 'bg-slate-900 border-slate-600 text-slate-100 focus:border-blue-500 focus:ring-blue-500'
              : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-500'
          } focus:outline-none focus:ring-2`

    const labelClass =
      variant === 'admin'
        ? fieldLabelClass(Boolean(isDark))
        : `block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`

    return (
      <div className={className}>
        <label className={labelClass}>{label}</label>
        <input
          type={type}
          value={localValue}
          onChange={(e) => this.handleChange(e.target.value)}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          placeholder={placeholder}
          className={`${inputClass} ${variant === 'admin' ? 'mt-1.5' : ''}`}
        />
      </div>
    )
  }
}

export default ConfigInput
