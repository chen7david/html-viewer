# HTML Viewer Engine

With the dawn of advanced AI tools that can produce text, many are far better at generating brilliantly formatted HTML structurally than they are at generating raw PDFs directly. As a perfect middle ground, we've created the **HTML Viewer Engine**: a powerful, local-storage-first web application designed to let you cleanly paste your AI-generated HTML documents, edit them in an embedded VS Code environment, and flawlessly print them out for a streamlined workflow without any page cutoffs!

Live Deployment: [https://html.entix.org](https://html.entix.org)

## Contributing & Feature Requests
This tool is open-source and intended to help anyone stream-line handling raw HTML documents. 
**If you are using this app and think it could use another feature, please create a Pull Request!** We openly welcome and invite community contributions, tweaks, and additions.

## Incredible Features

- **Perfect A4 Pagination & Printing:** Prints HTML strings through an isolated invisible sandbox that automatically overrides broken line spacing. It intelligently injects native CSS (`break-inside: avoid`) to prevent block elements, images, grids, and headings from being physically chopped in half over two pages when printed.
- **Displays Exact Document Names:** The generated printouts accurately output the name of the document to the PDF header instead of generic system names.
- **Monaco Code Editor:** A fully-fledged VS Code environment physically embedded in the browser featuring beautiful syntax highlighting.
- **Prettier Auto-Formatting:** Automatically formats messy, minified, or disorganized inline HTML via Prettier's standalone engine with the click of a button.
- **World-Class UI & Dark Mode:** Uses highly polished Ant Design React layout elements beautifully mixed with Tailwind CSS. Seamlessly toggles between a vibrant Emerald/Purple Light state and a hyper-readable Dark Mode.

## Technology Stack

- **Framework:** React 19 + Vite (Optimized for V8 Isolates & Cloudflare)
- **Routing:** React Router v7 (HashRouter for serverless edge deployments)
- **Styling:** Tailwind CSS v4 + Ant Design (ConfigProvider Themed)
- **Code Engine:** `@monaco-editor/react` + `prettier`
