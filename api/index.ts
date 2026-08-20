import { createApp } from "../server/_core/index";

// Vercel treats a default-exported Express app as a Node.js serverless
// function handler: `(req, res) => app(req, res)`.
export default createApp();
