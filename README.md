[![Nellagration App: AI-Powered Full-Stack Web Development in the Browser](./public/social_preview_index.jpg)](https://bolt.new)

# Nellagration App: AI-Powered Full-Stack Web Development in the Browser

Nellagration App is an AI-powered web development agent that allows you to prompt, run, edit, and deploy full-stack applications directly from your browser—no local setup required. If you're here to build your own AI-powered web dev agent using the Nellagration open source codebase, [click here to get started!](./CONTRIBUTING.md)

## What Makes Nellagration App Different

Claude, v0, etc are incredible- but you can't install packages, run backends or edit code. That’s where Nellagration App stands out:

- **Full-Stack in the Browser**: Nellagration App integrates cutting-edge AI models with an in-browser development environment powered by **StackBlitz’s WebContainers**. This allows you to:
  - Install and run npm tools and libraries (like Vite, Next.js, and more)
  - Run Node.js servers
  - Interact with third-party APIs
  - Deploy to production from chat
  - Share your work via a URL

- **AI with Environment Control**: Unlike traditional dev environments where the AI can only assist in code generation, Nellagration App gives AI models **complete control** over the entire  environment including the filesystem, node server, package manager, terminal, and browser console. This empowers AI agents to handle the entire app lifecycle—from creation to deployment.

Whether you’re an experienced developer, a PM or designer, Nellagration App allows you to build production-grade full-stack applications with ease.

For developers interested in building their own AI-powered development tools with WebContainers, check out the open-source Nellagration codebase in this repo!

## Running Locally

To try Nellagration locally you'll need [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed. After cloning the repository, install dependencies and start the dev server:

```bash
pnpm install
pnpm run dev
```

If you see an error about a missing `@remix-run/node` package, it usually means dependencies were not installed. Running `pnpm install` resolves this.

## Tips and Tricks

Here are some tips to get the most out of Nellagration App:

- **Be specific about your stack**: If you want to use specific frameworks or libraries (like Astro, Tailwind, ShadCN, or any other popular JavaScript framework), mention them in your initial prompt to ensure Nellagration scaffolds the project accordingly.

- **Use the enhance prompt icon**: Before sending your prompt, try clicking the 'enhance' icon to have the AI model help you refine your prompt, then edit the results before submitting.

- **Scaffold the basics first, then add features**: Make sure the basic structure of your application is in place before diving into more advanced functionality. This helps Nellagration understand the foundation of your project and ensure everything is wired up right before building out more advanced functionality.

- **Batch simple instructions**: Save time by combining simple instructions into one message. For example, you can ask Nellagration to change the color scheme, add mobile responsiveness, and restart the dev server, all in one go saving you time and reducing API credit consumption significantly.

## FAQs

**Where do I sign up for a paid plan?**  
Nellagration App is free to get started. If you need more AI tokens or want private projects, you can purchase a paid subscription in your [Nellagration App](https://bolt.new) settings, in the lower-left hand corner of the application. 

**What happens if I hit the free usage limit?**  
Once your free daily token limit is reached, AI interactions are paused until the next day or until you upgrade your plan.

**Is Nellagration in beta?**  
Yes, Nellagration App is in beta, and we are actively improving it based on feedback.

**How can I report Nellagration App issues?**  
Check out the [Issues section](https://github.com/stackblitz/bolt.new/issues) to report an issue or request a new feature. Please use the search feature to check if someone else has already submitted the same issue/request.

**What frameworks/libraries currently work on Nellagration?**  
Nellagration App supports most popular JavaScript frameworks and libraries. If it runs on StackBlitz, it will run on Nellagration App as well.

**How can I add make sure my framework/project works well in Nellagration?**  
We are excited to work with the JavaScript ecosystem to improve functionality in Nellagration. Reach out to us via [hello@stackblitz.com](mailto:hello@stackblitz.com) to discuss how we can partner!
