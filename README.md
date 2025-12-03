# Distribution Automation System (DAS) — BESCOM

A modern, responsive full-stack web application for monitoring and managing Bangalore's electrical distribution network.

## Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS with custom electrical theme colors
- **Development**: ESLint, TypeScript compiler

## Features

- **Beautiful Landing Page**: Hero section with electrical theme and BESCOM branding
- **Modern Authentication**: Sign In and Sign Up pages with form validation
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-Time Monitoring**: Live surveillance of power distribution networks
- **Intelligent Automation**: AI-powered load balancing and fault detection
- **Advanced Analytics**: Comprehensive data insights and predictive maintenance
- **Secure Operations**: Enterprise-grade security with role-based access control

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm run preview
```

The production build will be in the `dist/` directory.

## Project Structure

```
cursorproject/
├── src/                    # Source files
│   ├── components/         # React components
│   │   ├── Layout.tsx     # Main layout with header/footer
│   │   ├── Header.tsx     # Navigation with BESCOM logo
│   │   ├── Footer.tsx     # Footer with stakeholders
│   │   ├── Hero.tsx       # Hero section
│   │   ├── About.tsx      # About section
│   │   ├── Services.tsx   # Services section
│   │   ├── Features.tsx   # Features showcase
│   │   ├── Stats.tsx      # Statistics section
│   │   ├── CTA.tsx        # Call-to-action
│   │   ├── LoginForm.tsx  # Sign in form
│   │   └── SignUpForm.tsx # Sign up form
│   ├── pages/             # Page components
│   │   ├── Home.tsx       # Landing page
│   │   ├── SignIn.tsx     # Sign in page
│   │   └── SignUp.tsx     # Sign up page
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   └── index.css          # Global styles
├── public/                # Static assets
│   └── bescom-logo.svg    # BESCOM logo
├── index.html             # HTML template
├── vite.config.ts         # Vite configuration
└── package.json           # Dependencies
```

## Color Scheme

The application uses a custom electrical theme palette:
- **Electrical Blue**: Primary color (#0B4F6C, #1789FC)
- **Yellow/Amber**: Accent colors representing electricity (#FFD700, #FFBF00)
- **Gradient Backgrounds**: Subtle transitions for modern visual appeal

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

© 2024 BESCOM - Bangalore Electricity Supply Company
