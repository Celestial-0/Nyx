import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { joinWaitlist } from "@/components/core/landing/waitlist.functions"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldError } from "@/components/ui/field"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"

import { HugeiconsIcon } from "@hugeicons/react"
import {
    Mail01Icon,
    Rocket01Icon,
    CheckmarkCircle02Icon,
    Alert02Icon,
    ArrowRight01Icon,
} from "@hugeicons/core-free-icons"

// ─── Zod Schema ─────────────────────────────────────────────────────────────
const waitlistSchema = z.object({
    email: z.email("Please enter a valid email address"),
})

// ─── Animation Variants ─────────────────────────────────────────────────────
const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
}

// Logo — drops from above
const dropIn = {
    hidden: { opacity: 0, y: -40, scale: 0.8, filter: "blur(8px)" },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        transition: { type: "spring" as const, stiffness: 200, damping: 20 },
    },
}

// Badge — pops in from center
const scaleIn = {
    hidden: { opacity: 0, scale: 0.5, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        transition: { type: "spring" as const, stiffness: 300, damping: 22 },
    },
}

// Heading — slides from left
const slideFromLeft = {
    hidden: { opacity: 0, x: -30, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
        transition: { type: "spring" as const, stiffness: 200, damping: 24 },
    },
}

// Form — rises from below
const riseUp = {
    hidden: { opacity: 0, y: 30, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: { type: "spring" as const, stiffness: 200, damping: 24 },
    },
}

// Social proof — slides from right
const slideFromRight = {
    hidden: { opacity: 0, x: 20, filter: "blur(4px)" },
    visible: {
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
        transition: { type: "spring" as const, stiffness: 200, damping: 26 },
    },
}

// Footer — gentle fade up
const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" as const },
    },
}

const springHover = {
    scale: 1.04,
    transition: { type: "spring" as const, stiffness: 400, damping: 20 },
}

const springTap = { scale: 0.96 }

// ─── Main Waitlist Component ────────────────────────────────────────────────
export function Waitlist() {
    const [status, setStatus] = useState<"idle" | "success">("idle")
    const [showTerms, setShowTerms] = useState(false)

    const form = useForm({
        defaultValues: { email: "" },
        validators: {
            onChange: waitlistSchema,
        },
        onSubmit: async ({ value }) => {
            try {
                await joinWaitlist({ data: value })
                form.reset()
                setStatus("success")
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : String(err)

                // Treat "already on waitlist" as success
                if (message.includes("already on the waitlist")) {
                    form.reset()
                    setStatus("success")
                    return
                }

                form.setErrorMap({
                    onSubmit: message as never,
                })
            }
        },
    })

    return (
        <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-16">

            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    className="absolute top-1/4 left-1/2 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[100px]"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>

            <motion.section
                className="relative z-10 mx-auto flex w-full max-w-lg flex-col items-center gap-8 text-center"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
            >
                {/* Logo — drops from above */}
                <motion.div variants={dropIn}>
                    <motion.img
                        src="/nyx.png"
                        alt="Nyx"
                        className="h-20 w-20 rounded-2xl object-contain shadow-lg shadow-primary/10"
                        whileHover={{ scale: 1.06, rotate: 3 }}
                        whileTap={springTap}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    />
                </motion.div>

                {/* Badge — pops from center */}
                <motion.div variants={scaleIn}>
                    <motion.div whileHover={springHover} whileTap={springTap}>
                        <Badge variant="secondary" className="gap-2 px-4 py-1.5 text-sm">
                            <HugeiconsIcon
                                icon={Rocket01Icon}
                                className="size-4"
                                strokeWidth={2}
                            />
                            Decentralized Chat
                        </Badge>
                    </motion.div>
                </motion.div>

                {/* Heading — slides from left */}
                <motion.div className="space-y-3" variants={slideFromLeft}>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                        Join the Nyx Waitlist
                    </h1>
                    <p className="mx-auto w-2xl text-sm leading-relaxed text-muted-foreground">
                        Join Nyx, where anonymous conversations meet blockchain security.
                        <br />
                        Wallet-based access, Solana micro-payments, and end-to-end encryption.
                    </p>
                </motion.div>

                {/* Success / Form — animated swap */}
                <AnimatePresence mode="wait">
                    {status === "success" ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -12 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="w-full"
                        >
                            <Card className="w-full bg-card/60">
                                <CardContent className="flex flex-col items-center gap-4 py-4">
                                    <motion.div
                                        className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 15,
                                            delay: 0.15,
                                        }}
                                    >
                                        <HugeiconsIcon
                                            icon={CheckmarkCircle02Icon}
                                            className="size-6 text-emerald-500"
                                            strokeWidth={2}
                                        />
                                    </motion.div>
                                    <div className="space-y-1">
                                        <h2 className="text-sm font-semibold text-foreground">
                                            Welcome to Nyx
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            You're on the list. We'll notify you at launch.
                                        </p>
                                    </div>
                                    <motion.div whileHover={springHover} whileTap={springTap}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setStatus("idle")}
                                        >
                                            Done
                                        </Button>
                                    </motion.div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            variants={riseUp}
                            initial="hidden"
                            animate="visible"
                            exit={{ opacity: 0, y: -12 }}
                            className="w-full"
                        >
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    form.handleSubmit()
                                }}
                                className="w-full space-y-3"
                            >
                                <form.Field name="email">
                                    {(field) => (
                                        <Field>
                                            <div className="flex w-full gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        type="email"
                                                        placeholder="Enter your email"
                                                        value={field.state.value}
                                                        onBlur={field.handleBlur}
                                                        onChange={(e) =>
                                                            field.handleChange(
                                                                (e.target as HTMLInputElement).value
                                                            )
                                                        }
                                                        className={cn(
                                                            "h-9 pl-8 pr-3 text-sm transition-all duration-200",
                                                            field.state.meta.errors.length > 0 &&
                                                            field.state.meta.isTouched &&
                                                            "border-destructive"
                                                        )}
                                                    />
                                                    <HugeiconsIcon
                                                        icon={Mail01Icon}
                                                        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                                                        strokeWidth={2}
                                                    />
                                                </div>
                                                <form.Subscribe selector={(s) => s.isSubmitting}>
                                                    {(isSubmitting) => (
                                                        <motion.div
                                                            whileHover={springHover}
                                                            whileTap={springTap}
                                                        >
                                                            <Button
                                                                type="submit"
                                                                disabled={isSubmitting}
                                                                className="h-9 gap-1.5"
                                                            >
                                                                {isSubmitting ? (
                                                                    <Spinner className="size-3.5" />
                                                                ) : (
                                                                    <>
                                                                        Join Waitlist
                                                                        <HugeiconsIcon
                                                                            icon={ArrowRight01Icon}
                                                                            className="size-3.5"
                                                                            strokeWidth={2}
                                                                        />
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </motion.div>
                                                    )}
                                                </form.Subscribe>
                                            </div>

                                            {/* Field error with animated entrance */}
                                            <AnimatePresence>
                                                {field.state.meta.isTouched &&
                                                    field.state.meta.errors.length > 0 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0, y: -4 }}
                                                            animate={{ opacity: 1, height: "auto", y: 0 }}
                                                            exit={{ opacity: 0, height: 0, y: -4 }}
                                                            transition={{ duration: 0.2 }}
                                                        >
                                                            <FieldError>
                                                                {field.state.meta.errors
                                                                    .map(
                                                                        (
                                                                            e:
                                                                                | { message?: string }
                                                                                | string
                                                                                | undefined
                                                                        ) =>
                                                                            typeof e === "string" ? e : e?.message
                                                                    )
                                                                    .filter(Boolean)
                                                                    .join(", ")}
                                                            </FieldError>
                                                        </motion.div>
                                                    )}
                                            </AnimatePresence>
                                        </Field>
                                    )}
                                </form.Field>

                                {/* Form-level submit error */}
                                <form.Subscribe selector={(s) => s.errorMap}>
                                    {(errorMap) => (
                                        <AnimatePresence>
                                            {errorMap.onSubmit ? (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -8 }}
                                                    transition={{ duration: 0.25 }}
                                                >
                                                    <Alert variant="destructive">
                                                        <HugeiconsIcon
                                                            icon={Alert02Icon}
                                                            strokeWidth={2}
                                                        />
                                                        <AlertTitle>Error</AlertTitle>
                                                        <AlertDescription>
                                                            {String(errorMap.onSubmit)}
                                                        </AlertDescription>
                                                    </Alert>
                                                </motion.div>
                                            ) : null}
                                        </AnimatePresence>
                                    )}
                                </form.Subscribe>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Social proof — slides from right */}
                <motion.p className="text-xs text-muted-foreground" variants={slideFromRight}>
                    Join early users exploring private, decentralized communication.
                </motion.p>

                {/* Footer */}
                <motion.div
                    className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card/50 px-4 py-2.5 text-xs backdrop-blur-sm"
                    variants={fadeUp}
                >
                    <span className="text-muted-foreground">
                        Privacy. Security. Decentralized.
                    </span>
                    <motion.button
                        onClick={() => setShowTerms(true)}
                        className="shrink-0 text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                        whileHover={{ scale: 1.03 }}
                        whileTap={springTap}
                    >
                        Terms & Conditions
                    </motion.button>
                </motion.div>
            </motion.section>

            {/* Terms Dialog */}
            <Dialog open={showTerms} onOpenChange={setShowTerms}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Terms & Conditions</DialogTitle>
                        <DialogDescription>
                            By joining the Nyx waitlist, you agree to receive occasional
                            email updates about our launch. Your email is encrypted and never
                            shared with third parties. We respect your privacy as a core value
                            of Nyx's decentralized mission. You can unsubscribe anytime.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter showCloseButton>
                        <motion.div whileHover={springHover} whileTap={springTap}>
                            <Button onClick={() => setShowTerms(false)}>Got it</Button>
                        </motion.div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
