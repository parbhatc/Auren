import { Component, createRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { SelectProps } from '../../types/common'

/**
 * Custom Select dropdown component
 * Replaces native HTML select with a styled dropdown
 */
class Select extends Component<SelectProps> {
  selectRef = createRef<HTMLDivElement>()

  state: { isOpen: boolean } = {
    isOpen: false,
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside)
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside)
  }

  handleClickOutside = (event: MouseEvent) => {
    if (this.selectRef.current && !this.selectRef.current.contains(event.target as Node)) {
      this.setState({ isOpen: false })
    }
  }

  handleToggle = () => {
    this.setState((prevState: { isOpen: boolean }) => ({ isOpen: !prevState.isOpen }))
  }

  handleSelect = (value: string) => {
    this.props.onChange(value)
    this.setState({ isOpen: false })
  }

  render() {
    const { value, options, isDark, className = '' } = this.props
    const { isOpen } = this.state

    const selectedOption = options.find((opt) => opt.value === value) || options[0]

    const baseClasses = `relative ${className}`
    const buttonClasses = `w-full px-2 py-1.5 rounded-lg text-xs border transition-all flex items-center justify-between ${
      isDark
        ? 'bg-slate-900 border-slate-600 text-slate-100 hover:bg-slate-800'
        : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-white'
    }`

    const dropdownClasses = `absolute z-50 w-full mt-1 rounded-lg border shadow-lg overflow-hidden top-full ${
      isDark
        ? 'bg-slate-800 border-slate-700'
        : 'bg-white border-slate-200'
    } ${isOpen ? 'block' : 'hidden'}`

    return (
      <div ref={this.selectRef} className={baseClasses}>
        <button
          type="button"
          onClick={this.handleToggle}
          className={buttonClasses}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{selectedOption?.label || selectedOption?.value}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {isOpen && (
          <div className={dropdownClasses}>
            <ul role="listbox" className="max-h-48 overflow-y-auto">
              {options.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={value === option.value}
                  onClick={() => this.handleSelect(option.value)}
                  className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                    value === option.value
                      ? isDark
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-blue-50 text-blue-700'
                      : isDark
                      ? 'text-slate-300 hover:bg-slate-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {option.label || option.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }
}

export default Select

