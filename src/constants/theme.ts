/**
 * Centralized theme colors configuration
 * Change colors here to update the entire application theme
 * 
 * To change the primary color scheme, update the 'primary' and 'secondary' color values below.
 * For example, to use green instead of blue:
 * - Change 'blue-500' to 'emerald-500'
 * - Change 'cyan-600' to 'emerald-600'
 * etc.
 */

export const themeColors = {
  // Primary colors (main brand color - blue/cyan for trading theme)
  primary: {
    // Main primary color shades
    '500': 'blue-500',
    '600': 'blue-600',
    '700': 'blue-700',
    '400': 'blue-400',
    '300': 'blue-300',
    // Dark mode variants
    '950': 'blue-950',
    '800': 'blue-800',
  },
  
  // Secondary colors (cyan accent)
  secondary: {
    '500': 'cyan-500',
    '600': 'cyan-600',
    '700': 'cyan-700',
    '400': 'cyan-400',
    '300': 'cyan-300',
    '900': 'cyan-900',
  },

  // Button colors - complete class strings
  button: {
    primary: {
      dark: 'bg-blue-950/50 text-blue-300 hover:bg-blue-950/70 border border-blue-800/50',
      light: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200',
      gradient: 'from-blue-600 to-cyan-700 hover:from-blue-500 hover:to-cyan-600',
      gradientDisabled: 'from-blue-800 to-cyan-900',
      shadow: 'hover:shadow-blue-500/50',
    },
    success: {
      dark: 'bg-emerald-950/50 text-emerald-300 hover:bg-emerald-950/70 border border-emerald-800/50',
      light: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200',
    },
    danger: {
      dark: 'bg-red-950/50 text-red-300 hover:bg-red-950/70 border border-red-800/50',
      light: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
    },
    warning: {
      dark: 'bg-amber-950/50 text-amber-300 hover:bg-amber-950/70 border border-amber-800/50',
      light: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200',
    },
  },

  // Icon colors
  icon: {
    primary: {
      dark: 'text-blue-400',
      light: 'text-blue-600',
    },
    hover: {
      dark: 'hover:text-blue-300',
      light: 'hover:text-blue-700',
    },
  },

  // Badge/Tag colors
  badge: {
    primary: {
      dark: 'bg-blue-950/50 text-blue-300 border border-blue-800/50',
      light: 'bg-blue-100 text-blue-700 border border-blue-200',
    },
  },

  // Focus/ring colors
  focus: {
    border: 'focus:border-blue-500',
    ring: 'focus:ring-blue-500',
    shadow: 'focus:shadow-blue-500/20',
  },

  // Logo colors
  logo: {
    gradient: {
      icon: 'from-blue-500 via-cyan-600 to-blue-700',
      iconHover: 'from-blue-400 to-cyan-600',
      textDark: 'from-blue-400 to-cyan-500',
      textDarkHover: 'from-blue-300 to-cyan-400',
      textLight: 'from-blue-600 to-cyan-700',
      textLightHover: 'from-blue-500 to-cyan-600',
    },
    shadow: {
      default: 'shadow-blue-500/50',
      hover: 'shadow-blue-500/70',
      glow: 'from-blue-400 to-cyan-600',
    },
  },

  // Input focus colors
  input: {
    focus: {
      border: 'focus:border-blue-500',
      ring: 'focus:ring-blue-500',
      icon: 'group-focus-within:text-blue-400',
    },
  },

  // Loading spinner
  loading: {
    border: {
      dark: 'border-blue-400',
      light: 'border-blue-600',
    },
  },

  // Success message
  success: {
    dark: 'bg-blue-950/40 text-blue-200 border-blue-800/50 shadow-lg shadow-blue-900/20',
    light: 'bg-blue-50 text-blue-800 border-blue-300 shadow-md shadow-blue-100',
    icon: {
      dark: 'text-blue-400',
      light: 'text-blue-600',
    },
  },

  // Link colors
  link: {
    dark: 'text-blue-400 hover:text-blue-300',
    light: 'text-blue-600 hover:text-blue-700',
  },

  // Card colors for Dashboard
  card: {
    default: {
      dark: 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500',
      light: 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300',
    },
    primary: {
      dark: 'bg-blue-950/30 border-blue-800/50 hover:bg-blue-950/50 hover:border-blue-700/50',
      light: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
      iconBg: {
        dark: 'bg-blue-950/50',
        light: 'bg-blue-100',
      },
    },
    danger: {
      dark: 'bg-red-950/30 border-red-800/50 hover:bg-red-950/50 hover:border-red-700/50',
      light: 'bg-red-50 border-red-200 hover:bg-red-100 hover:border-red-300',
      iconBg: {
        dark: 'bg-red-950/50',
        light: 'bg-red-100',
      },
      icon: {
        dark: 'text-red-400',
        light: 'text-red-600',
      },
    },
    warning: {
      dark: 'bg-purple-950/30 border-purple-800/50 hover:bg-purple-950/50 hover:border-purple-700/50',
      light: 'bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-300',
      iconBg: {
        dark: 'bg-purple-950/50',
        light: 'bg-purple-100',
      },
      icon: {
        dark: 'text-purple-400',
        light: 'text-purple-600',
      },
    },
    info: {
      dark: 'bg-cyan-950/30 border-cyan-800/50 hover:bg-cyan-950/50 hover:border-cyan-700/50',
      light: 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100 hover:border-cyan-300',
      iconBg: {
        dark: 'bg-cyan-950/50',
        light: 'bg-cyan-100',
      },
      icon: {
        dark: 'text-cyan-400',
        light: 'text-cyan-600',
      },
    },
  },
}

/**
 * Get theme color classes based on dark/light mode
 */
export const getThemeColors = (isDark: boolean) => {
  return {
    button: {
      primary: isDark ? themeColors.button.primary.dark : themeColors.button.primary.light,
      success: isDark ? themeColors.button.success.dark : themeColors.button.success.light,
      danger: isDark ? themeColors.button.danger.dark : themeColors.button.danger.light,
      warning: isDark ? themeColors.button.warning.dark : themeColors.button.warning.light,
    },
    icon: {
      primary: isDark ? themeColors.icon.primary.dark : themeColors.icon.primary.light,
      hover: isDark ? themeColors.icon.hover.dark : themeColors.icon.hover.light,
    },
    badge: {
      primary: isDark ? themeColors.badge.primary.dark : themeColors.badge.primary.light,
    },
    link: isDark ? themeColors.link.dark : themeColors.link.light,
    success: isDark ? themeColors.success.dark : themeColors.success.light,
    successIcon: isDark ? themeColors.success.icon.dark : themeColors.success.icon.light,
    loading: isDark ? themeColors.loading.border.dark : themeColors.loading.border.light,
    focus: themeColors.focus,
    card: {
      default: isDark ? themeColors.card.default.dark : themeColors.card.default.light,
      primary: isDark ? themeColors.card.primary.dark : themeColors.card.primary.light,
      primaryIconBg: isDark ? themeColors.card.primary.iconBg.dark : themeColors.card.primary.iconBg.light,
      danger: isDark ? themeColors.card.danger.dark : themeColors.card.danger.light,
      dangerIconBg: isDark ? themeColors.card.danger.iconBg.dark : themeColors.card.danger.iconBg.light,
      dangerIcon: isDark ? themeColors.card.danger.icon.dark : themeColors.card.danger.icon.light,
      warning: isDark ? themeColors.card.warning.dark : themeColors.card.warning.light,
      warningIconBg: isDark ? themeColors.card.warning.iconBg.dark : themeColors.card.warning.iconBg.light,
      warningIcon: isDark ? themeColors.card.warning.icon.dark : themeColors.card.warning.icon.light,
      info: isDark ? themeColors.card.info.dark : themeColors.card.info.light,
      infoIconBg: isDark ? themeColors.card.info.iconBg.dark : themeColors.card.info.iconBg.light,
      infoIcon: isDark ? themeColors.card.info.icon.dark : themeColors.card.info.icon.light,
    },
  }
}
