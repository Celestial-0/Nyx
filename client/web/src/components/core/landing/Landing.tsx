import { useState, useEffect, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useAuthStore } from "@/features/auth/auth.store"
import { Background } from "@/components/core/landing/baground"
import { Terminal, TypingAnimation, AnimatedSpan } from "@/components/ui/terminal"
import { AnimatedBeam } from "@/components/ui/animated-beam"
import { LandingHeader } from "@/components/core/landing/header"
import { TerminalSimulator } from "./TerminalSimulator"
import { WalletAuth } from "@/components/core/auth/WalletAuth"
import { motion, AnimatePresence } from "framer-motion"

// --- FAQ Item Type & Data ---
interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: "How does Nyx authenticate users anonymously?",
    answer: "Nyx uses your Solana wallet's public address as your unique identifier. When logging in, you sign an ephemeral cryptographic message (nonce) in your browser. This proves wallet ownership and authorizes your session without requiring emails, passwords, phone numbers, or profiling database entries.",
  },
  {
    question: "Are my chat messages stored on a server database?",
    answer: "No. All messages are encrypted end-to-end (E2EE) in your browser using AES-256-GCM before they are sent. The payload is distributed via an event-driven mesh of Redis Pub/Sub cache streams. There are no relational databases storing chat history or logs on our servers.",
  },
  {
    question: "Why does Nyx use Solana micro-payments?",
    answer: "Traditional chats use Captchas or phone numbers to prevent bot spam, which compromises privacy. Nyx introduces a micro-SOL payment requirement for creating or entering public rooms. This creates a hard financial threshold that bankrupted botnets while remaining negligible (fractions of a penny) for human users.",
  },
  {
    question: "Is the cryptography audited and open-source?",
    answer: "Yes. Nyx's philosophy is rooted in trustless verification and open-source software. All cryptographic operations (ECDH key exchange and AES encryption) are performed client-side using industry-standard Web Crypto APIs, allowing complete transparency and auditability.",
  },
]

// --- Sub-components for dynamic visualizations ---

function DecryptingTitle({ text }: { text: string }) {
  const [displayText, setDisplayText] = useState(text)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+"
  
  const triggerDecrypt = () => {
    let iterations = 0
    const interval = setInterval(() => {
      setDisplayText(() =>
        text
          .split("")
          .map((_, index) => {
            if (index < iterations) {
              return text[index]
            }
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join("")
      )
      iterations += 1 / 3
      if (iterations >= text.length) {
        clearInterval(interval)
        setDisplayText(text)
      }
    }, 30)
  }
  
  useEffect(() => {
    triggerDecrypt()
  }, [text])
  
  return (
    <span 
      onMouseEnter={triggerDecrypt}
      className="cursor-default font-extrabold uppercase font-heading"
    >
      {displayText}
    </span>
  )
}

function LiveHexMatrix() {
  const [hex, setHex] = useState("Initializing protocol...")
  useEffect(() => {
    const interval = setInterval(() => {
      const hexChars = "0123456789ABCDEF"
      const line = Array.from({ length: 16 }, () => hexChars[Math.floor(Math.random() * 16)]).join("")
      setHex(`0x${line.slice(0, 4)}...${line.slice(-4)} [ENCRYPTED]`)
    }, 850)
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="bg-background/90 border border-border/80 rounded-lg p-3 font-mono text-[10px] text-success flex items-center justify-between shadow-inner">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        <span className="tracking-wide">ECDH_AES: {hex}</span>
      </span>
      <span className="text-muted-foreground text-[9px] uppercase font-semibold">SECURE_TUNNEL</span>
    </div>
  )
}

function WalletIDVisual() {
  return (
    <div className="bg-background/90 border border-border/80 rounded-lg p-3 font-mono text-[10px] text-muted-foreground space-y-1 shadow-inner">
      <div className="flex justify-between border-b border-border/30 pb-1.5">
        <span className="text-foreground font-bold">SOLANA_AUTH_CHECK</span>
        <span className="text-success font-bold tracking-wider">RESOLVED</span>
      </div>
      <div className="flex items-center justify-between text-[9px] pt-1">
        <span>ADDR: 8xW9...3bZfQ</span>
        <span className="text-accent-brand font-semibold">[SIGNED_PROOF]</span>
      </div>
    </div>
  )
}

function LedgerTicker() {
  const [txs, setTxs] = useState([
    { id: "tx_x9a8", cost: "0.0010 SOL", status: "VALIDATED" },
    { id: "tx_f5d2", cost: "0.0010 SOL", status: "VALIDATED" },
  ])
  useEffect(() => {
    const interval = setInterval(() => {
      setTxs((prev) => {
        const newId = `tx_${Math.random().toString(16).slice(2, 6)}`;
        return [{ id: newId, cost: "0.0010 SOL", status: "VALIDATED" }, prev[0]];
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="bg-background/90 border border-border/80 rounded-lg p-3 font-mono text-[9px] text-muted-foreground space-y-1.5 shadow-inner">
      {txs.slice(0, 2).map((tx, idx) => (
        <div key={tx.id + idx} className="flex justify-between items-center">
          <span className="text-accent-brand font-bold">{tx.id}</span>
          <span>{tx.cost}</span>
          <span className="text-success font-semibold tracking-wide text-[8px]">{tx.status}</span>
        </div>
      ))}
    </div>
  )
}

function NodeMapVisual() {
  return (
    <div className="bg-background/90 border border-border/80 rounded-lg p-3 font-mono text-[10px] flex items-center justify-between shadow-inner">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center h-4 w-4">
          <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-accent-brand opacity-45"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-brand"></span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] text-muted-foreground uppercase font-bold">RTT_LATENCY</span>
          <span className="text-foreground font-bold tracking-tight">14ms average</span>
        </div>
      </div>
      <svg className="h-5 w-20 text-accent-brand/40" viewBox="0 0 100 30" fill="none">
        <path d="M0,15 L20,15 L25,5 L35,25 L40,15 L60,15 L65,10 L70,20 L75,15 L100,15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    </div>
  )
}

export function Landing() {
  const navigate = useNavigate()
  const status = useAuthStore((state) => state.status)
  const isAuthenticated = status === "authenticated"
  const [authOpen, setAuthOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState<number | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const step1Ref = useRef<HTMLDivElement>(null)
  const step2Ref = useRef<HTMLDivElement>(null)
  const step3Ref = useRef<HTMLDivElement>(null)

  const handleCtaClick = () => {
    if (isAuthenticated) {
      void navigate({ to: "/chat", replace: true })
    } else {
      setAuthOpen(true)
    }
  }

  return (
    <>
      <Background />
      <LandingHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-32 pb-24 font-mono text-foreground">
        {/* HERO SECTION */}
        <section className="flex flex-col items-center text-center py-12 md:py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-accent-brand/35 bg-accent-brand/5 px-4 py-1.5 text-xs text-accent-brand uppercase font-bold tracking-widest mb-6"
          >
            <span className="size-1.5 rounded-full bg-accent-brand text-secondary animate-ping" />
            Decentralized anonymous chat
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-heading text-5xl font-extrabold tracking-tighter sm:text-7xl uppercase text-foreground leading-[1.15]"
          >
            <DecryptingTitle text="NYX" />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-heading text-sm font-semibold tracking-wider text-muted-foreground uppercase mt-2 max-w-2xl"
          >
            Communication built on cryptographic proof, not trust.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xs text-muted-foreground mt-6 max-w-lg leading-[1.7]"
          >
            Eliminate traditional accounts. Connect with Solana wallet addresses, exchange messages secured with ephemeral browser-level keys, and bypass centralized databases.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-4 mt-8"
          >
            <button
              onClick={handleCtaClick}
              className="rounded-lg bg-primary hover:bg-accent-brand hover:text-accent-brand-foreground text-primary-foreground font-semibold text-xs px-6 py-3 uppercase tracking-widest border border-primary/25 shadow-lg shadow-primary/10 transition-all cursor-pointer hover:-translate-y-px"
            >
              {isAuthenticated ? "Launch Console" : "Access Network"}
            </button>
            <a
              href="#terminal"
              className="rounded-lg border border-border hover:border-accent-brand/45 hover:bg-muted/40 bg-card text-foreground font-semibold text-xs px-6 py-3 uppercase tracking-widest transition-all cursor-pointer hover:-translate-y-px"
            >
              Inspect Terminal
            </a>
          </motion.div>

          {/* Quick specs banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 border border-border bg-card/25 p-6 mt-16 w-full max-w-4xl text-left rounded-lg backdrop-blur-sm shadow-inner relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-accent-brand/50" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-accent-brand/50" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-accent-brand/50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-accent-brand/50" />

            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                AUTHENTICATION
              </span>
              <span className="text-xs font-semibold text-foreground tracking-wider uppercase block font-mono">
                Solana Ed25519
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                ENCRYPTION
              </span>
              <span className="text-xs font-semibold text-foreground tracking-wider uppercase block font-mono">
                AES-256-GCM / ECDH
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                </span>
                RELAY METHOD
              </span>
              <span className="text-xs font-semibold text-foreground tracking-wider uppercase block font-mono">
                Redis PubSub Mesh
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning"></span>
                </span>
                DB RETENTION
              </span>
              <span className="text-xs font-semibold text-destructive tracking-wider uppercase block font-mono">
                Zero Persistent Logs
              </span>
            </div>
          </motion.div>
        </section>

        {/* INTERACTIVE SIMULATOR SECTION */}
        <section className="py-16 border-t border-border">
          <div className="flex flex-col gap-2 mb-10 text-center md:text-left">
            <div className="flex items-center gap-2 text-xs font-mono text-accent-brand justify-center md:justify-start">
              <span>//</span>
              <span className="font-bold tracking-wide uppercase">0x01 // INTERACTIVE CRYPTO PLAYGROUND</span>
            </div>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-foreground">
              Real-Time Encryption Sandbox
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Type in the console below to see how Nyx scrambles your packets in-browser before routing them across validator layers. Adjust Solana fee rates to verify Sybil defense metrics.
            </p>
          </div>
          <TerminalSimulator />
        </section>

        {/* BENTO GRID SHOWCASE */}
        <section id="features" className="py-16 border-t border-border">
          <div className="flex flex-col gap-2 mb-12 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-brand">
              <span>//</span>
              <span className="font-bold tracking-wide uppercase">0x02 // SYSTEM CAPABILITIES MATRIX</span>
            </div>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-foreground">
              Core Protocol Infrastructure
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Decentralized components designed for absolute privacy, censorship-resistance, and real-time execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Box 1: E2EE */}
            <div className="md:col-span-8 flex flex-col justify-between rounded-xl border border-border bg-card/45 hover:bg-card/75 hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 p-6 space-y-4">
              <div className="space-y-3">
                <div className="text-accent-brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3 className="font-heading text-sm font-bold uppercase text-foreground">
                  Zero-Knowledge Transmission
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Message contents are encrypted with key pairs computed client-side. Our relays receive and route bytes without having access to the shared secret keys, ensuring that even if servers are seized or targeted, your logs remain indecipherable.
                </p>
              </div>
              <div className="space-y-4 pt-2">
                <LiveHexMatrix />
                <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>Protocol: AES-GCM + Diffie-Hellman</span>
                  <span className="text-success font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    STATUS: ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: Wallet Identity */}
            <div className="md:col-span-4 flex flex-col justify-between rounded-xl border border-border bg-card/45 hover:bg-card/75 hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 p-6 space-y-4">
              <div className="space-y-3">
                <div className="text-accent-brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h3 className="font-heading text-sm font-bold uppercase text-foreground">
                  Decoupled Profile
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No usernames, emails, or phone registration. Your public Solana key serves as your network node address. No user-profiles are indexed.
                </p>
              </div>
              <div className="space-y-4 pt-2">
                <WalletIDVisual />
                <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>Adapter: Web3 adapter</span>
                  <span className="text-success font-bold">ANONYMOUS</span>
                </div>
              </div>
            </div>

            {/* Box 3: Solana Micropayments */}
            <div className="md:col-span-5 flex flex-col justify-between rounded-xl border border-border bg-card/45 hover:bg-card/75 hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 p-6 space-y-4">
              <div className="space-y-3">
                <div className="text-accent-brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5">
                    <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                    <line x1="12" y1="17" x2="12" y2="17.01" />
                    <line x1="12" y1="12" x2="12" y2="12.01" />
                    <line x1="12" y1="7" x2="12" y2="7.01" />
                  </svg>
                </div>
                <h3 className="font-heading text-sm font-bold uppercase text-foreground">
                  Anti-Sybil Micro-gating
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Creating group channels requires minor SOL transactions. This economic shield protects against flood attacks while maintaining public censorship-resistant access.
                </p>
              </div>
              <div className="space-y-4 pt-2">
                <LedgerTicker />
                <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>Network: Solana Mainnet</span>
                  <span className="text-accent-brand font-bold">SOL_PAY</span>
                </div>
              </div>
            </div>

            {/* Box 4: PubSub speed */}
            <div className="md:col-span-7 flex flex-col justify-between rounded-xl border border-border bg-card/45 hover:bg-card/75 hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 p-6 space-y-4">
              <div className="space-y-3">
                <div className="text-accent-brand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h3 className="font-heading text-sm font-bold uppercase text-foreground">
                  High-Throughput Socket Mesh
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Powered by Bun, Hono, and Redis pub/sub memory buses. Message events are broadcasted to socket peers within milliseconds, optimizing latency for instant anonymous communications.
                </p>
              </div>
              <div className="space-y-4 pt-2">
                <NodeMapVisual />
                <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>Relay: Bun + Redis PubSub</span>
                  <span className="text-success font-bold">LATENCY &lt; 20MS</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DYNAMIC CRYPTO ROUTE MAP */}
        <section className="py-16 border-t border-border">
          <div className="flex flex-col gap-2 mb-12 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-brand">
              <span>//</span>
              <span className="font-bold tracking-wide uppercase">0x03 // CRYPTO PACKET TELEMETRY</span>
            </div>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-foreground">
              Packet Routing Journey
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Trace the secure life-cycle of a communication block from raw entry to remote peer reception.
            </p>
          </div>

          <div ref={containerRef} className="relative flex flex-col md:flex-row justify-between items-stretch gap-8 md:gap-6 w-full">
            {/* Connecting Beams (Only visible on MD screens) */}
            <AnimatedBeam
              containerRef={containerRef}
              fromRef={step1Ref}
              toRef={step2Ref}
              curvature={0}
              duration={3}
              pathColor="var(--border)"
              gradientStartColor="var(--primary)"
              gradientStopColor="var(--accent-brand)"
              className="hidden md:block"
            />
            <AnimatedBeam
              containerRef={containerRef}
              fromRef={step2Ref}
              toRef={step3Ref}
              curvature={0}
              duration={3}
              pathColor="var(--border)"
              gradientStartColor="var(--accent-brand)"
              gradientStopColor="var(--primary)"
              className="hidden md:block"
            />

            {/* Step 1 */}
            <div ref={step1Ref} className="flex-1 rounded-xl border border-border bg-card p-6 space-y-3 relative z-10 w-full hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[10px] font-mono text-accent-brand bg-accent-brand/10 rounded px-2 py-0.5">STEP_01</div>
                  <span className="text-[9px] text-muted-foreground font-mono">LOCAL_CLIENT</span>
                </div>
                <h4 className="font-bold text-xs uppercase text-foreground">Key Generation</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Ephemeral encryption keys are calculated in-browser using Web Crypto APIs. Text is locked with AES-GCM.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div ref={step2Ref} className="flex-1 rounded-xl border border-border bg-card p-6 space-y-3 relative z-10 w-full hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[10px] font-mono text-accent-brand bg-accent-brand/10 rounded px-2 py-0.5">STEP_02</div>
                  <span className="text-[9px] text-muted-foreground font-mono">ROUTER_RELAY</span>
                </div>
                <h4 className="font-bold text-xs uppercase text-foreground">Redis Memory Mesh</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Encrypted payload enters Bun socket relays and is published to Redis pub/sub memory queues. No DB logs.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div ref={step3Ref} className="flex-1 rounded-xl border border-border bg-card p-6 space-y-3 relative z-10 w-full hover:border-accent-brand/40 hover:shadow-lg hover:shadow-accent-brand/5 transition-all duration-300 flex flex-col justify-between group">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[10px] font-mono text-accent-brand bg-accent-brand/10 rounded px-2 py-0.5">STEP_03</div>
                  <span className="text-[9px] text-muted-foreground font-mono">REMOTE_PEER</span>
                </div>
                <h4 className="font-bold text-xs uppercase text-foreground">Peer Handshake</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Recipient client retrieves ciphertext, validates authenticity, and decrypts content locally in sandbox memory.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE NETWORK BOOT TERMINAL */}
        <section className="py-16 border-t border-border flex flex-col items-center">
          <div className="flex flex-col gap-2 mb-10 text-center w-full">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-brand">
              <span>//</span>
              <span className="font-bold tracking-wide uppercase">0x04 // AUTONOMOUS HANDSHAKE PROTOCOL</span>
            </div>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-foreground">
              Autonomous Handshake Sequence
            </h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Watch Nyx establish an encrypted peer-to-peer session using decentralized identity and ledger verification.
            </p>
          </div>

          <div className="w-full max-w-xl font-mono">
            <Terminal className="w-full max-w-full border-border bg-card/65 backdrop-blur-md shadow-2xl">
              <TypingAnimation delay={500} className="text-warning font-bold">
                &gt; nyx init --wallet=solana
              </TypingAnimation>
              <AnimatedSpan delay={200} className="text-muted-foreground font-semibold">
                [sys] wallet connected: H8xW9...3bZfQ
              </AnimatedSpan>
              <AnimatedSpan delay={150} className="text-success font-bold">
                [sys] proof verified. session issued.
              </AnimatedSpan>
            
              <TypingAnimation delay={400} className="text-warning font-bold">
                &gt; nyx join #zero-day
              </TypingAnimation>
              <AnimatedSpan delay={200} className="text-muted-foreground font-semibold">
                [sys] fee confirmed: 0.001 SOL
              </AnimatedSpan>
              <AnimatedSpan delay={150} className="text-success font-bold">
                [sys] encrypted channel established.
              </AnimatedSpan>
            
              <TypingAnimation delay={300} className="text-warning font-bold">
                &gt; nyx send "leak complete"
              </TypingAnimation>
              <AnimatedSpan delay={100} className="text-accent-brand font-bold">
                [E2EE] ciphertext generated
              </AnimatedSpan>
              <AnimatedSpan delay={100} className="text-success font-bold">
                [sys] delivered via pubsub • 24ms
              </AnimatedSpan>
            </Terminal>
          </div>
        </section>

        {/* FAQ ACCORDION SECTION */}
        <section id="faq" className="py-16 border-t border-border">
          <div className="flex flex-col gap-2 mb-10 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-brand">
              <span>//</span>
              <span className="font-bold tracking-wide uppercase">0x05 // QUESTIONS & PROTOCOL SPECIFICATIONS</span>
            </div>
            <h2 className="font-heading text-xl font-bold uppercase tracking-tight text-foreground">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto space-y-2">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border bg-card/40 overflow-hidden hover:border-accent-brand/30 transition-colors duration-200"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="flex w-full justify-between items-center p-4 text-left font-mono text-xs font-bold text-foreground hover:bg-muted/40 transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-accent-brand font-bold select-none">&gt;</span>
                    <span>nyx help {faq.question.toLowerCase().replace(/[?.,]/g, "").replace(/\s+/g, "-")}</span>
                  </span>
                  <span className="text-accent-brand font-mono text-xs">
                    {activeFaq === idx ? "[-]" : "[+]"}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {activeFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="p-4 pt-2 text-xs text-muted-foreground leading-relaxed border-t border-border/40 mt-1 bg-muted/10 font-mono">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-border pt-8 mt-12 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span>Nyx Network — Cryptographic Protocol</span>
          </div>
          <div className="flex gap-6">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
              Source Code
            </a>
            <span className="text-border">|</span>
            <span className="uppercase">Censorship-Resistant, Open-Source</span>
          </div>
        </footer>
      </main>

      {/* Wallet Authentication Trigger Modal */}
      <WalletAuth
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSignedIn={() => {
          setAuthOpen(false)
          void navigate({ to: "/chat", replace: true })
        }}
      />
    </>
  )
}
