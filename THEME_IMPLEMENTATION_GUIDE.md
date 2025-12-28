# Theme Implementation Guide

This guide explains how to use the dynamic theme system in both the mobile and web applications.

## Overview

Both applications now support dynamic theming with light and dark modes. The theme system:
- Automatically detects system preferences
- Allows manual theme selection (light/dark/auto)
- Persists theme preference across app restarts
- Provides consistent colors across all components

## Mobile App

### Using the Theme in Components

1. **Import the useTheme hook:**
```typescript
import { useTheme } from '../context/ThemeContext';
```

2. **Use theme colors in your component:**
```typescript
function MyComponent() {
  const { theme, isDark } = useTheme();

  return (
    <View style={{ backgroundColor: theme.background }}>
      <Text style={{ color: theme.text }}>Hello World</Text>
    </View>
  );
}
```

3. **In StyleSheet.create, use theme dynamically:**
```typescript
const styles = StyleSheet.create({
  container: {
    // Use inline styles for theme-dependent colors
  },
});

// In your component:
<View style={[styles.container, { backgroundColor: theme.background, borderColor: theme.border }]}>
```

### Available Theme Colors

- `theme.background` - Main background color
- `theme.surface` - Card/surface background
- `theme.card` - Card background
- `theme.text` - Primary text color
- `theme.textSecondary` - Secondary text color
- `theme.textMuted` - Muted text color
- `theme.primary` - Primary brand color (BESCOM blue)
- `theme.primaryDark` - Darker primary variant
- `theme.primaryLight` - Lighter primary variant
- `theme.accent` - Accent color
- `theme.border` - Border color
- `theme.borderLight` - Light border color
- `theme.inputBackground` - Input field background
- `theme.inputBorder` - Input border color
- `theme.placeholder` - Placeholder text color
- `theme.icon` - Icon color
- `theme.iconSecondary` - Secondary icon color
- `theme.success` - Success status color
- `theme.warning` - Warning status color
- `theme.error` - Error status color
- `theme.info` - Info status color
- `theme.overlay` - Modal overlay background
- `theme.backdrop` - Backdrop overlay color

### Theme Toggle Component

Use the `ThemeToggle` component to add a theme toggle button:

```typescript
import ThemeToggle from './components/ThemeToggle';

// In your component:
<ThemeToggle />
```

### Programmatic Theme Control

```typescript
const { themeMode, setThemeMode, toggleTheme } = useTheme();

// Set specific mode
setThemeMode('light');  // or 'dark' or 'auto'

// Toggle between light and dark
toggleTheme();

// Check current mode
const mode = themeMode; // 'light' | 'dark' | 'auto'
const isDarkMode = isDark; // boolean
```

## Web App

### Using the Theme in Components

1. **Import the useTheme hook:**
```typescript
import { useTheme } from '../context/ThemeContext';
```

2. **Use theme colors with inline styles:**
```typescript
function MyComponent() {
  const { theme, isDark } = useTheme();

  return (
    <div style={{ backgroundColor: theme.background, color: theme.text }}>
      <p>Hello World</p>
    </div>
  );
}
```

3. **Using Tailwind CSS classes with theme:**
```typescript
// Use CSS variables in your styles
<div className="bg-[var(--bg)] text-[var(--text)]">
  Content
</div>
```

### CSS Variables

The theme system also provides CSS variables that can be used in your CSS/Tailwind:

- `var(--bg)` - Background color
- `var(--surface)` - Surface color
- `var(--card)` - Card color
- `var(--text)` - Text color
- `var(--text-secondary)` - Secondary text color
- `var(--text-muted)` - Muted text color
- `var(--primary)` - Primary color
- `var(--primary-dark)` - Primary dark variant
- `var(--primary-light)` - Primary light variant
- `var(--border)` - Border color
- `var(--border-light)` - Light border color
- `var(--input-bg)` - Input background
- `var(--input-border)` - Input border
- `var(--placeholder)` - Placeholder color
- `var(--icon)` - Icon color
- `var(--icon-secondary)` - Secondary icon color

### Theme Toggle Component

```typescript
import ThemeToggle from './components/ThemeToggle';

// In your component:
<ThemeToggle />
```

## Migration Guide

To update existing components:

1. **Replace hardcoded colors:**
   - `#f1f5fb` → `theme.background`
   - `#ffffff` → `theme.surface` or `theme.card`
   - `#1a1a1a` → `theme.text`
   - `#005aa9` → `theme.primary`
   - `#003b73` → `theme.primaryDark`
   - `#e2e8f0` → `theme.border`
   - `#666` → `theme.textSecondary`
   - `#999` → `theme.textMuted`

2. **Update StyleSheet styles:**
   - Move theme-dependent colors to inline styles
   - Keep non-theme styles in StyleSheet.create

3. **Update LinearGradient colors:**
```typescript
// Before:
<LinearGradient colors={['#005aa9', '#003b73']}>

// After:
<LinearGradient colors={[theme.primary, theme.primaryDark]}>
```

## Best Practices

1. **Always use theme colors** instead of hardcoded hex values
2. **Test both themes** - Ensure components look good in both light and dark modes
3. **Use semantic color names** - Prefer `theme.success` over `#10b981`
4. **Consider contrast** - Ensure text is readable on backgrounds in both themes
5. **Update StatusBar/Sidebar colors** - Make sure system UI elements adapt to theme

## Status Bar (Mobile)

Update StatusBar to match theme:
```typescript
import { StatusBar } from 'expo-status-bar';
const { theme, isDark } = useTheme();

<StatusBar 
  style={isDark ? "light" : "dark"} 
  backgroundColor={theme.primary}
/>
```

## Example: Complete Component Update

**Before:**
```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f1f5fb',
    padding: 16,
  },
  text: {
    color: '#1a1a1a',
    fontSize: 16,
  },
});

function MyComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello</Text>
    </View>
  );
}
```

**After:**
```typescript
import { useTheme } from '../context/ThemeContext';

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  text: {
    fontSize: 16,
  },
});

function MyComponent() {
  const { theme } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.text }]}>Hello</Text>
    </View>
  );
}
```

## Notes

- The theme preference is automatically saved and restored
- System theme detection works in "auto" mode
- All theme changes apply immediately across the app
- The theme context is available at the root level, so all components can access it

