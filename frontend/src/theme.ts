/**
 * Greyscale Scientific Theme
 * Monochrome zinc/gray palette — no accent colors.
 * All centralized color management - NO hardcoded colors in components.
 */

export const theme = {
  colors: {
    // Backgrounds
    background: {
      DEFAULT: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      muted: '#f3f4f6',
    },

    dark: {
      background: '#ffffff',
      surface: '#f8fafc',
      elevated: '#f1f5f9',
    },

    // Text
    text: {
      primary: '#1f2937',
      secondary: '#4b5563',
      tertiary: '#6b7280',
      muted: '#9ca3af',
      inverse: '#ffffff',
    },

    darkText: {
      primary: '#1f2937',
      secondary: '#4b5563',
      tertiary: '#6b7280',
      muted: '#9ca3af',
    },

    // Borders
    border: {
      DEFAULT: '#e5e7eb',
      subtle: '#f3f4f6',
      strong: '#d1d5db',
    },

    darkBorder: {
      DEFAULT: '#e5e7eb',
      subtle: '#f3f4f6',
      strong: '#d1d5db',
    },

    // Primary action (used for CTA buttons, active states)
    primary: {
      DEFAULT: '#27272a', // zinc-800
      hover: '#3f3f46',   // zinc-700
      text: '#ffffff',
      subtle: '#52525b',  // zinc-600
      border: '#3f3f46',
    },

    // Status — kept colored for functional clarity (success/error/warning/info)
    status: {
      success: {
        DEFAULT: '#059669',
        subtle: '#d1fae5',
        text: '#065f46',
        bg: '#d1fae5',
        border: '#059669',
      },
      error: {
        DEFAULT: '#dc2626',
        subtle: '#fee2e2',
        text: '#991b1b',
        bg: '#fee2e2',
        border: '#dc2626',
      },
      warning: {
        DEFAULT: '#d97706',
        subtle: '#fef3c7',
        text: '#92400e',
        bg: '#fef3c7',
        border: '#d97706',
      },
      info: {
        DEFAULT: '#0284c7',
        subtle: '#e0f2fe',
        text: '#0c4a6e',
        bg: '#e0f2fe',
        border: '#0284c7',
      },
    },

    // Accent — all mapped to neutral zinc/gray (no hue)
    accent: {
      purple: {
        DEFAULT: '#3f3f46', // zinc-700
        subtle: '#f4f4f5',  // zinc-100
        text: '#52525b',    // zinc-600
        bg: '#f4f4f5',
        border: '#a1a1aa',  // zinc-400
      },
      blue: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      green: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      amber: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      red: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      orange: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      pink: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      cyan: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
      indigo: {
        DEFAULT: '#52525b',
        subtle: '#f4f4f5',
        text: '#52525b',
        bg: '#f4f4f5',
        border: '#a1a1aa',
      },
    },

    // Scientific neutral
    scientific: {
      DEFAULT: '#64748b',
      subtle: '#94a3b8',
      strong: '#475569',
    },
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  radius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },

  typography: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
}

export const getColor = (colorPath: string): string => {
  const parts = colorPath.split('.')
  let value: any = theme.colors
  for (const part of parts) {
    value = value[part]
    if (value === undefined) {
      console.warn(`Color path not found: ${colorPath}`)
      return '#000000'
    }
  }
  return value as string
}

export default theme
