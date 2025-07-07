# Dark/Light Theme Guide

## Theme Features

Your Buster Market app now supports dark and light themes with the following features:

### 🌓 Theme Toggle

- **Location**: Available in the navbar on both desktop and mobile
- **Icon**: Sun/Moon icon that toggles between themes
- **Default**: System preference (automatically matches your device's theme)
- **Persistence**: Theme preference is saved locally

### 🎨 Theme Coverage

**Light Theme:**

- Clean white backgrounds
- Purple gradient navbar
- Light gray cards and components
- High contrast text for readability

**Dark Theme:**

- Dark gray/black backgrounds
- Darker purple gradient navbar
- Dark gray cards with proper contrast
- Light text optimized for dark viewing

### 📱 Responsive Design

- Theme toggle works on both desktop and mobile
- Consistent styling across all screen sizes
- Smooth transitions between themes

### 🏗️ Component Support

All major components support dark mode:

- ✅ Navbar with profile and wallet
- ✅ Market cards and dashboard
- ✅ Comment system and replies
- ✅ Leaderboard and rankings
- ✅ Buttons and UI components
- ✅ Forms and inputs

### 🔧 Technical Implementation

**Libraries Used:**

- `next-themes` for theme management
- Tailwind CSS `dark:` variants for styling
- CSS custom properties for consistent colors

**Theme Provider:**

- Wraps the entire app in `layout.tsx`
- Supports system, light, and dark themes
- Prevents hydration mismatches

### 🎯 Usage Tips

1. **Automatic Detection**: The app will automatically use your system's theme preference on first visit
2. **Manual Toggle**: Click the sun/moon icon to manually switch themes
3. **Persistence**: Your choice is remembered for future visits
4. **System Changes**: If you change your system theme, the app will update accordingly (unless you've manually set a preference)

### 🚀 Future Enhancements

Potential theme-related features for the future:

- Custom color schemes for different markets
- High contrast mode for accessibility
- Auto-scheduling (dark at night, light during day)
- Custom accent colors
- Theme-specific animations

### 💡 For Developers

**Adding Dark Mode to New Components:**

```tsx
// Use Tailwind dark: variants
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  Content here
</div>;

// For conditional logic
import { useTheme } from "next-themes";

const { theme } = useTheme();
// theme can be 'light', 'dark', or 'system'
```

**CSS Custom Properties:**
The app uses CSS custom properties defined in `globals.css` for consistent theming across components.

Your theme system is now fully functional and ready for users to enjoy! 🎉
