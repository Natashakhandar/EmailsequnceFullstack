# Project Requirements: Email Sequencing Fullstack

This document outlines the hardware and software requirements for developing and running the **Email Sequencing Fullstack** project.

---

## 💻 Hardware Requirements
*   **Device:** Laptop or Desktop Computer
*   **Processor:** Intel Core i5 (12th Gen) or equivalent AMD Ryzen series
*   **Memory (RAM):** Minimum 8 GB (16 GB recommended for optimal performance)
*   **Storage:** SSD (Solid State Drive) with at least 10 GB of free space
*   **Network:** Stable internet connection for dependency installation and API services

---

## 🛠️ Software Requirements

### 🎨 Frontend (Client-side)
*   **Core Framework:** [React](https://reactjs.org/) (powered by [Vite](https://vitejs.dev/))
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling & UI:**
    *   [Tailwind CSS](https://tailwindcss.com/) for rapid styling
    *   [Shadcn UI](https://ui.shadcn.com/) / [Radix UI](https://www.radix-ui.com/) for accessible components
    *   [Lucide React](https://lucide.dev/) for iconography
*   **State & Data:** [TanStack Query](https://tanstack.com/query/latest) (React Query)
*   **Animations:** [Framer Motion](https://www.framer.com/motion/)
*   **Routing:** [React Router DOM](https://reactrouter.com/)
*   **Charts:** [Recharts](https://recharts.org/)

### ⚙️ Backend (Server-side)
*   **Runtime:** [Node.js](https://nodejs.org/) (v16.0.0 or higher)
*   **Web Framework:** [Express.js](https://expressjs.com/)
*   **Database:** [MySQL](https://www.mysql.com/) (or PostgreSQL support included)
*   **ORM:** [Prisma ORM](https://www.prisma.io/)
*   **Real-time Communication:** [Socket.io](https://socket.io/)
*   **Authentication:** [JWT](https://jwt.io/) (JSON Web Tokens) & [bcryptjs](https://www.npmjs.com/package/bcryptjs)
*   **Scheduling:** [node-cron](https://www.npmjs.com/package/node-cron)

### 📧 Email Services
*   **Sending:** [Nodemailer](https://nodemailer.com/)
*   **Receiving/Parsing:** [Imap](https://www.npmjs.com/package/imap) & [Mailparser](https://nodemailer.com/extras/mailparser/)

### 🚀 Development & DevOps
*   **Package Manager:** [npm](https://www.npmjs.com/)
*   **Code Editor:** [Visual Studio Code (VS Code)](https://code.visualstudio.com/)
*   **API Testing:** [Postman](https://www.postman.com/) or [Thunder Client](https://www.thunderclient.com/)
*   **Version Control:** [Git](https://git-scm.com/) & [GitHub](https://github.com/)
*   **Containerization:** [Docker](https://www.docker.com/) (Dockerfile/Compose support included)
