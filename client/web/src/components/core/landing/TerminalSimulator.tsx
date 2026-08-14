import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Slider } from "@/components/ui/slider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Message {
  id: string
  sender: "user" | "peer" | "system"
  text: string
  cipherText: string
  isEncrypting: boolean
  isDecrypting: boolean
  timestamp: string
}

function getInitialTimeString(offsetSeconds = 0): string {
  const d = new Date(Date.now() - offsetSeconds * 1000)
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function TerminalSimulator() {
  // --- Terminal Simulator State ---
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "1",
      sender: "system",
      text: "NYX PROTOCOL INITIALIZED. SOLANA ED25519 READY.",
      cipherText: "SYSTEM BOOT",
      isEncrypting: false,
      isDecrypting: false,
      timestamp: getInitialTimeString(6),
    },
    {
      id: "2",
      sender: "system",
      text: "X25519 / AES-256-GCM KEY EXCHANGE WITH PEER [node_x9a8f]...",
      cipherText: "KEY_EXCHANGE",
      isEncrypting: false,
      isDecrypting: false,
      timestamp: getInitialTimeString(4),
    },
    {
      id: "3",
      sender: "peer",
      text: "E2EE session established. Ephemeral channel active with node_x9a8f.",
      cipherText: "E2EE session established. Ephemeral channel active with node_x9a8f.",
      isEncrypting: false,
      isDecrypting: false,
      timestamp: getInitialTimeString(1),
    },
  ])
  const [inputText, setInputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // --- Solana Fee Calculator State ---
  const [dailySpam, setDailySpam] = useState(120) // messages per minute on network
  const [micropayment, setMicropayment] = useState(0.001) // SOL per room entry/action

  // --- Auto scroll terminal ---
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  // --- Cipher animation character set ---
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+<>?:"

  const generateRandomCipher = (length: number) => {
    return Array.from({ length }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join("")
  }

  // --- Trigger encryption/decryption sequence ---
  const simulateEncryption = async (text: string, sender: "user" | "peer") => {
    const id = Math.random().toString()
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })

    // 1. Add system status: Encrypting
    const sysId = Math.random().toString()
    setMessages((prev) => [
      ...prev,
      {
        id: sysId,
        sender: "system",
        text: `[ENCRYPTING PACKETS FOR TRANSMISSION...]`,
        cipherText: "",
        isEncrypting: true,
        isDecrypting: false,
        timestamp: time,
      },
    ])

    // 2. Add message as cipher text first
    const initCipher = generateRandomCipher(text.length)
    const newMessage: Message = {
      id,
      sender,
      text,
      cipherText: initCipher,
      isEncrypting: true,
      isDecrypting: false,
      timestamp: time,
    }

    setMessages((prev) => [...prev, newMessage])

    // 3. Animate cipher text scrambling (encryption)
    let ticks = 0
    const interval = setInterval(() => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === id) {
            return { ...msg, cipherText: generateRandomCipher(text.length) }
          }
          return msg
        })
      )
      ticks++
      if (ticks > 8) {
        clearInterval(interval)
        // Complete encryption
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === id) {
              return {
                ...msg,
                isEncrypting: false,
                isDecrypting: true, // Prepare to decrypt on mock peer receiver
              }
            }
            if (msg.id === sysId) {
              return {
                ...msg,
                text: `[✓ ENCRYPTION COMPLETE. SHA-256 HASH generated]`,
                isEncrypting: false,
              }
            }
            return msg
          })
        )

        // 4. Simulate network hop and decryption on the recipient
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === id) {
                return {
                  ...msg,
                  isDecrypting: false,
                  cipherText: text, // fully decrypted
                }
              }
              return msg
            })
          )
        }, 1000)
      }
    }, 100)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isProcessing) return

    const userMsg = inputText
    setInputText("")
    setIsProcessing(true)

    // Simulate sending from User
    await simulateEncryption(userMsg, "user")

    // Simulate response from Peer after a short delay
    setTimeout(async () => {
      const responses = [
        "Payload received. Ciphertext verified via Solana Ed25519 proof.",
        "Session acknowledged. Ephemeral packet routed through Bun relay mesh.",
        "Zero metadata logged on node. Shared secret handshake valid.",
        "Solana micropayment received. Room participant token authorized.",
      ]
      const randomResponse = responses[Math.floor(Math.random() * responses.length)]
      await simulateEncryption(randomResponse, "peer")
      setIsProcessing(false)
    }, 3000)
  }

  // --- Calculations for Micropayments Slider ---
  const solUsdPrice = 150 // Mock SOL price for visual representation
  const monthlyCostPerUser = 5 * micropayment
  const blockedBotsPercent = Math.min(
    100,
    Math.round((micropayment / 0.005) * 80 + dailySpam / 10)
  )

  return (
    <div className="flex flex-col md:flex-row w-full gap-8 items-stretch text-foreground">
      {/* LEFT: Cryptographic Terminal Simulator */}
      <div id="terminal" className="flex flex-col w-full md:w-[58%] h-full">
        <div className="flex items-center justify-between rounded-t-xl border-x border-t border-border bg-muted/85 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-destructive" />
            <span className="h-3 w-3 rounded-full bg-warning" />
            <span className="h-3 w-3 rounded-full bg-success" />
          </div>
          <span className="font-mono text-xxs tracking-wider text-muted-foreground uppercase">
            nyx-secure-terminal-v1.0.0
          </span>
          <div className="w-12" /> {/* spacer */}
        </div>

        <div className="flex flex-1 flex-col justify-between border border-border bg-background p-4 font-mono text-xs min-h-120">
          {/* Messages Log */}
          <div ref={messagesContainerRef} className="overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-border">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-start font-mono text-xs"
                >
                  {msg.sender === "system" ? (
                    <div className="text-warning/80 text-[10px] py-0.5 tracking-wider select-none font-semibold">
                      [* sys] {msg.text}
                    </div>
                  ) : (
                    <div className="space-y-0.5 w-full text-left">
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground select-none">
                        <span className="font-bold text-accent-brand">
                          {msg.sender === "user" ? "visitor@nyx" : "peer@node_x9a8f"}
                        </span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div className="pl-3 border-l border-border/50 py-0.5">
                        {msg.isEncrypting ? (
                          <span className="font-bold text-warning tracking-widest break-all">
                            {msg.cipherText}
                          </span>
                        ) : msg.isDecrypting ? (
                          <span className="font-bold text-success tracking-widest break-all">
                            {msg.cipherText}
                          </span>
                        ) : (
                          <span className="text-foreground">{msg.cipherText}</span>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Terminal Input Form */}
          <form
            onSubmit={handleSend}
            className="mt-4 flex items-center gap-2 border-t border-border/40 pt-4"
          >
            <span className="text-success font-bold select-none whitespace-nowrap">
              visitor@nyx:~$
            </span>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessing}
              placeholder="type message and press Enter..."
              className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus:border-none p-0 m-0 text-xs text-foreground placeholder:text-muted-foreground/30 font-mono"
            />
            {/* Hidden submit button to allow form submit on Enter key */}
            <button type="submit" className="hidden" disabled={isProcessing || !inputText.trim()} />
          </form>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Node: solana-rpc-mainnet.nyx
          </span>
          <span>E2EE: AES-256-GCM</span>
        </div>
      </div>

      {/* RIGHT: Solana Governance / Micropayments Slider */}
      <Card id="micropayments" className="flex flex-col justify-between border-0 bg-card w-full md:w-[42%]  h-full">
        <CardHeader className="space-y-1.5 p-6 pb-2">
          <div className="w-fit">
            <Badge variant="outline" className="border-accent-brand/30 bg-accent-brand/10 px-3 py-1 text-[9px] text-accent-brand dark:text-accent-brand-foreground uppercase font-bold tracking-wider h-fit flex items-center gap-2 rounded-full">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="size-3"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Sybil Defense System
            </Badge>
          </div>
          <CardTitle className="font-heading text-lg font-bold tracking-tight text-foreground">
            Anti-Spam Cost Governance
          </CardTitle>
          <CardDescription className="text-xxs leading-relaxed text-muted-foreground ">
            Nyx requires micro-payments on Solana to register channels or participate in room chats, imposing a mathematical ceiling on automated spam networks.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 p-6 pt-2">
          <div className="space-y-4">
            {/* Slider 1: Messages / Minute */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Simulated Bot Attack Rate:</span>
                <span className="text-foreground font-semibold">
                  {dailySpam} req/sec
                </span>
              </div>
              <Slider
                value={[dailySpam]}
                onValueChange={(val) => {
                  const v = Array.isArray(val) ? val[0] : val
                  if (typeof v === "number") setDailySpam(v)
                }}
                min={10}
                max={500}
                className="w-full"
              />
            </div>

            {/* Slider 2: Micro-payment cost */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Governance Fee Rate:</span>
                <span className="text-foreground font-semibold">
                  {micropayment.toFixed(4)} SOL
                </span>
              </div>
              <Slider
                value={[micropayment]}
                onValueChange={(val) => {
                  const v = Array.isArray(val) ? val[0] : val
                  if (typeof v === "number") setMicropayment(v)
                }}
                min={0.0001}
                max={0.01}
                step={0.0001}
                className="w-full"
              />
            </div>
          </div>

          {/* Calculations display */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-lg border border-border bg-muted/30 p-3 hover:border-accent-brand/45 hover:shadow-sm transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-border/80" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-border/80" />
                <span className="block text-[9px] text-muted-foreground uppercase tracking-wider">
                  Spam Prevention
                </span>
                <span
                  className={`font-heading text-xl font-bold ${
                    blockedBotsPercent > 80
                      ? "text-success"
                      : blockedBotsPercent > 50
                        ? "text-warning"
                        : "text-destructive"
                  }`}
                >
                  {blockedBotsPercent}%
                </span>
                <span className="block text-[8px] text-muted-foreground mt-0.5">
                  Bots Blocked
                </span>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 hover:border-accent-brand/45 hover:shadow-sm transition-all duration-300 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-border/80" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-border/80" />
                <span className="block text-[9px] text-muted-foreground uppercase tracking-wider">
                  Est. Attack Cost
                </span>
                <span className="font-heading text-xl font-bold text-destructive">
                  ${(dailySpam * 60 * 60 * 24 * micropayment * solUsdPrice).toLocaleString([], {
                    maximumFractionDigits: 0,
                  })}
                </span>
                <span className="block text-[8px] text-muted-foreground mt-0.5">
                  Per Day / Bot Net
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3 text-[10px] space-y-1 hover:border-accent-brand/35 hover:shadow-sm transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-border/80" />
              <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-border/80" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Normal User Monthly Cost:</span>
                <span className="text-success font-semibold font-mono">
                  {monthlyCostPerUser.toFixed(2)} SOL (~${(monthlyCostPerUser * solUsdPrice).toFixed(2)})
                </span>
              </div>
              <p className="text-[8px] text-muted-foreground leading-normal font-mono">
                *While a normal user spends pennies monthly, a spammer sending millions of requests is mathematically bankrupted.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
