# SAT Practice Debt Tracker

The app is deployed automatically to GitHub Pages whenever `main` is updated.

After enabling Pages in the repository settings, choose **GitHub Actions** as the
source. The published site will be available at:

https://l-logix.github.io/satsuite/

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deployment

The workflow in `.github/workflows/deploy.yml` builds the Vite app and publishes
the `dist` directory using the official GitHub Pages deployment action.

## Project notes

This project uses React, Vite, Tailwind CSS, and Oxlint.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
