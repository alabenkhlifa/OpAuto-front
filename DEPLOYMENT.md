# GitHub Pages Deployment Guide

## 🚀 Quick Deployment

Your OpAuto frontend is now configured for GitHub Pages deployment. Follow these steps:

### 1. Push to GitHub Repository
```bash
git add .
git commit -m "Configure GitHub Pages deployment"
git push origin main
```

### 2. Deploy to GitHub Pages
```bash
npm run deploy
```

This command will:
- Build the app with production configuration
- Set the correct base href (`/OpAuto-front/`)
- Deploy to the `gh-pages` branch using `angular-cli-ghpages`

### 3. Configure GitHub Repository Settings
1. Go to your GitHub repository
2. Navigate to **Settings** > **Pages**
3. Set **Source** to: `Deploy from a branch`
4. Select branch: `gh-pages`
5. Select folder: `/ (root)`
6. Click **Save**

### 4. Access Your Application
After deployment, your app will be available at:
```
https://[your-username].github.io/OpAuto-front/
```

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build:prod` | Build for production with GitHub Pages base href |
| `npm run predeploy` | Pre-deployment build (automatically called) |
| `npm run deploy:ghpages` | Deploy to gh-pages branch |
| `npm run deploy` | Full deployment (build + deploy) |

## 🔧 Configuration Details

### Single Page Application (SPA) Support
- ✅ `404.html` redirect for client-side routing
- ✅ Base href configured for GitHub Pages
- ✅ Router configured for clean URLs (no hash routing)

### Environment Configuration
- **Development**: Routes to `/dashboard` (localhost)
- **Production**: Routes to `/auth` (GitHub Pages)

### Build Configuration
- **Output**: `dist/OpAuto-front/browser/`
- **Base href**: `/OpAuto-front/`
- **Bundle optimization**: Production-ready with lazy loading

## ⚠️ Important Notes

### Authentication & Backend Integration
- The current setup serves a static frontend
- You'll need to configure API endpoints for production
- Authentication guards will need backend integration

### Translation/i18n Support
- ✅ Translation files are automatically included in build
- ✅ Service dynamically constructs correct asset paths using base href
- Supports English, French, and Arabic languages
- Translation files located in `/assets/i18n/` directory

### Custom Domain (Optional)
To use a custom domain:
1. Add a `CNAME` file to your `public/` folder with your domain
2. Configure DNS settings with your domain provider
3. Update base href if needed

### Troubleshooting
- **404 errors**: Ensure GitHub Pages is configured correctly
- **Routing issues**: Check base href and 404.html configuration
- **Build errors**: Check bundle size limits in `angular.json`

## 🔄 Update Workflow

For future updates:
```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main

# Redeploy
npm run deploy
```

## 📱 Mobile & PWA Considerations

The app is fully responsive and mobile-ready. For PWA features:
- Add service worker configuration
- Include web app manifest
- Configure offline capabilities

---

**Your OpAuto frontend is ready for GitHub Pages! 🎉**