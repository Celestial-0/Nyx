"use client"

import { useEffect, useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import {
  AccountSetting01Icon,
  BellDotIcon,
  BubbleChatIcon,
  ContactIcon,
  Logout03Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ProfileOnboardingDialog } from "@/components/core/auth/ProfileOnboardingDialog"
import { PaymentsDialog } from "@/components/core/payments/PaymentsDialog"
import { useLogout } from "@/features/auth/auth.hooks"
import { useContactsStore } from "@/features/contacts/contacts.store"
import {
  deleteGroupConversationAction,
  deleteMessageAction,
  hideMessageAction,
  removeContactAliasAction,
  saveContactAliasAction,
  toggleConversationMuteAction,
  updateContactAliasAction,
  updateGroupMemberRoleAction,
  useChatProfileSync,
  useChatRealtime,
  useChatShell,
} from "@/features/chat/chat.hooks"
import { usePaymentsPanel } from "@/features/payments/payments.hooks"
import type {
  ChatConversation,
  ChatMember,
} from "@/features/chat/chat.types"
import { useUserStore } from "@/features/user/user.store"

import { ContactAliasDialog } from "./ContactAliasDialog"
import { DeleteGroupDialog } from "./DeleteGroupDialog"
import { ChatList } from "./chat-list/ChatList"
import { DmStartDialog } from "./chat-list/DmStartDialog"
import { GroupRoomDialog } from "./chat-list/GroupRoomDialog"
import { ChatView } from "./chat-view/ChatView"
import { InfoPanel } from "./info-panel/InfoPanel"
import { ContactsSheet } from "./sidebar/Contacts"
import { NotificationsSheet } from "./sidebar/Notifications"
import { SettingsSheet } from "./sidebar/Settings"
import { Sidebar } from "./sidebar/Sidebar"

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
}

export function Chat() {
  const navigate = useNavigate()
  const { connected, disconnect } = useWallet()
  const { logout } = useLogout()
  const pathname = useLocation({ select: (location) => location.pathname })

  const [isDmDialogOpen, setIsDmDialogOpen] = useState(false)
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [isContactsOpen, setIsContactsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [contactEditor, setContactEditor] = useState<{
    contactUserId: string
    label: string
    alias: string
  } | null>(null)
  const [contactAlias, setContactAlias] = useState("")
  const [deleteRoomTarget, setDeleteRoomTarget] =
    useState<ChatConversation | null>(null)

  const { displayName, avatarUrl } = useChatProfileSync()
  const { open: openPayments, snapshot: paymentsSnapshot } = usePaymentsPanel()
  const userConfig = useUserStore((state) => state.config)
  const setUserConfig = useUserStore((state) => state.setConfig)
  const contacts = useContactsStore((state) => state.contacts)

  const {
    conversations,
    conversationsState,
    conversationsError,
    activeConversation,
    activeContext,
    activeMessages,
    activeMembers,
    membersById,
    typingNames,
    searchQuery,
    draftMessage,
    currentUserId,
    isChatListOpen,
    isInfoPanelOpen,
    historyState,
    historyPageInfo,
    olderHistoryState,
    historyError,
    detailsState,
    detailsError,
    connectionState,
    realtimeError,
    peerOnline,
    onlineUserIds,
    composerLocked,
    composerNotice,
    handleSelectConversation,
    handleSendMessage,
    handleComposerBlur,
    handleLoadOlderMessages,
    handleCreateGroup,
    handleJoinGroup,
    handleLeaveGroup,
    setSearchQuery,
    setDraftMessage,
    setChatListOpen,
    setInfoPanelOpen,
    searchUsers,
    startDirectConversation,
  } = useChatShell()

  useChatRealtime()

  const closeSidebarSurfaces = () => {
    setIsContactsOpen(false)
    setIsSettingsOpen(false)
    setIsNotificationsOpen(false)
  }

  const handleOpenPayments = (source: "sidebar" | "profile" | "settings") => {
    closeSidebarSurfaces()
    openPayments({ source })
  }

  const handleSignOut = async () => {
    try {
      await logout()
      if (connected) {
        await disconnect()
      }
    } catch (error) {
      console.error("Failed to sign out cleanly", error)
    } finally {
      closeSidebarSurfaces()
      void navigate({ to: "/", replace: true })
    }
  }

  const applyTheme = (theme: "dark" | "light" | "system") => {
    if (typeof window === "undefined") {
      return
    }

    const root = window.document.documentElement
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches
    const resolvedTheme =
      theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme

    root.classList.toggle("dark", resolvedTheme === "dark")
    root.classList.toggle("light", resolvedTheme === "light")
  }

  useEffect(() => {
    applyTheme(userConfig.theme)
  }, [userConfig.theme])

  const handleOpenSavedContact = async (input: {
    username?: string | null
    walletAddress: string
  }) => {
    await startDirectConversation({
      ...(input.username ? { username: input.username } : {}),
      walletAddress: input.walletAddress,
    })
    setIsContactsOpen(false)
  }

  const openContactEditor = (input: {
    contactUserId: string
    label: string
  }) => {
    const existingAlias =
      contacts.find((contact) => contact.user.id === input.contactUserId)?.alias ??
      ""

    setContactEditor({
      contactUserId: input.contactUserId,
      label: input.label,
      alias: existingAlias,
    })
    setContactAlias(existingAlias)
  }

  const handleOpenContactEditorForConversation = (
    conversation: ChatConversation
  ) => {
    if (!conversation.directPeer) {
      return
    }

    openContactEditor({
      contactUserId: conversation.directPeer.userId,
      label: conversation.name,
    })
  }

  const handleOpenContactEditorForMember = (member: ChatMember) => {
    if (member.id === currentUserId) {
      return
    }

    openContactEditor({
      contactUserId: member.id,
      label: member.name,
    })
  }

  const handleSaveContact = async () => {
    if (!contactEditor) {
      return
    }

    const alias = contactAlias.trim()
    const existingAlias =
      contacts.find(
        (contact) => contact.user.id === contactEditor.contactUserId
      )?.alias ?? null

    if (existingAlias != null) {
      await updateContactAliasAction(contactEditor.contactUserId, alias || null)
    } else {
      await saveContactAliasAction({
        contactUserId: contactEditor.contactUserId,
        alias: alias || null,
      })
    }

    setContactEditor(null)
    setContactAlias("")
  }

  const handleThemeChange = (theme: "dark" | "light" | "system") => {
    setUserConfig({ theme })
    applyTheme(theme)
  }

  const chatListContent = (
    <ChatList
      conversations={conversations}
      currentUserId={currentUserId}
      activeConversationId={activeConversation?.id ?? null}
      searchQuery={searchQuery}
      isLoading={conversationsState === "loading"}
      error={conversationsError}
      onOpenDirectMessages={() => setIsDmDialogOpen(true)}
      onOpenGroups={() => setIsGroupDialogOpen(true)}
      onSearchChange={setSearchQuery}
      onSelectConversation={handleSelectConversation}
      onOpenContactAlias={handleOpenContactEditorForConversation}
      onRemoveContactAlias={(conversation) => {
        if (conversation.directPeer) {
          void removeContactAliasAction(conversation.directPeer.userId)
        }
      }}
      onToggleMute={(conversation) => {
        void toggleConversationMuteAction(conversation)
      }}
      onLeaveGroup={(conversation) => {
        void handleLeaveGroup(conversation.id)
      }}
      onDeleteGroup={(conversation) => {
        setDeleteRoomTarget(conversation)
      }}
      onlineUserIds={onlineUserIds}
    />
  )

  const infoPanelContent = (
    <InfoPanel
      conversation={activeConversation}
      context={activeContext}
      members={activeMembers}
      isLoading={detailsState === "loading"}
      error={detailsError}
      onJoinGroup={
        activeConversation?.type === "group" &&
        activeContext?.membership == null
          ? () => handleJoinGroup(activeConversation.id)
          : undefined
      }
      onLeaveGroup={
        activeConversation?.type === "group" &&
        activeContext?.membership != null
          ? () => handleLeaveGroup(activeConversation.id)
          : undefined
      }
      currentUserId={currentUserId}
      onOpenContactAlias={handleOpenContactEditorForMember}
      onPromoteMember={(member) => {
        if (!activeConversation || member.id === currentUserId) {
          return
        }

        void updateGroupMemberRoleAction({
          roomId: activeConversation.id,
          userId: member.id,
          role: "admin",
        })
      }}
      onDemoteMember={(member) => {
        if (!activeConversation || member.id === currentUserId) {
          return
        }

        void updateGroupMemberRoleAction({
          roomId: activeConversation.id,
          userId: member.id,
          role: "member",
        })
      }}
    />
  )

  return (
    <div className="min-h-svh bg-background text-foreground">
      <Sidebar
        pathname={pathname}
        items={[
          {
            id: "chat",
            label: "Chats",
            icon: BubbleChatIcon,
            href: "/chat",
            match: "exact",
          },
          {
            id: "contacts",
            label: "Contacts",
            icon: ContactIcon,
            title: "Contacts",
            active: isContactsOpen,
            onClick: () => {
              setIsNotificationsOpen(false)
              setIsSettingsOpen(false)
              setIsContactsOpen(true)
            },
          },
          {
            id: "notifications",
            label: "Notifications",
            icon: BellDotIcon,
            title: "Notifications",
            active: isNotificationsOpen,
            onClick: () => {
              setIsContactsOpen(false)
              setIsSettingsOpen(false)
              setIsNotificationsOpen(true)
            },
          },
          {
            id: "credits",
            label:
              paymentsSnapshot == null
                ? "Credits"
                : `Credits · ${paymentsSnapshot.balance}`,
            icon: Rocket01Icon,
            title: "Credits",
            onClick: () => {
              handleOpenPayments("sidebar")
            },
          },
        ]}
        profile={{
          name: displayName,
          imageSrc: avatarUrl,
          initials: getInitials(displayName),
          status: connectionState === "connected" ? "online" : connectionState === "connecting" ? "away" : "offline",
          title: displayName,
          menuItems: [
            {
              id: "contacts",
              label: "Contacts",
              icon: ContactIcon,
              onSelect: () => {
                setIsNotificationsOpen(false)
                setIsSettingsOpen(false)
                setIsContactsOpen(true)
              },
            },
            {
              id: "credits",
              label:
                paymentsSnapshot == null
                  ? "Credits"
                  : `Credits · ${paymentsSnapshot.balance}`,
              icon: Rocket01Icon,
              onSelect: () => {
                handleOpenPayments("profile")
              },
            },
            {
              id: "settings",
              label: "Settings",
              icon: AccountSetting01Icon,
              onSelect: () => {
                setIsNotificationsOpen(false)
                setIsContactsOpen(false)
                setIsSettingsOpen(true)
              },
            },
            {
              id: "sign-out",
              label: "Sign out",
              icon: Logout03Icon,
              onSelect: () => {
                void handleSignOut()
              },
            },
          ],
        }}
        settingsItem={{
          title: "Settings",
          active: isSettingsOpen,
          onClick: () => {
            setIsNotificationsOpen(false)
            setIsContactsOpen(false)
            setIsSettingsOpen(true)
          },
        }}
      />

      <div className="flex h-svh pl-16 transition-[padding] duration-300 ease-out lg:peer-hover/sidebar:pl-64 lg:peer-focus-within/sidebar:pl-64 sm:pl-20">
        <aside className="hidden w-80 shrink-0 md:flex">
          {chatListContent}
        </aside>

        <ChatView
          conversation={activeConversation}
          context={activeContext}
          members={activeMembers}
          membersById={membersById}
          currentUserId={currentUserId}
          messages={activeMessages}
          typingNames={typingNames}
          draftMessage={draftMessage}
          isLoading={historyState === "loading"}
          hasOlderMessages={historyPageInfo?.hasMore === true}
          isLoadingOlder={olderHistoryState === "loading"}
          error={historyError ?? (activeMessages.length === 0 ? realtimeError : null)}
          connectionState={connectionState}
          peerOnline={peerOnline}
          composerLocked={composerLocked}
          composerNotice={composerNotice}
          onDraftChange={setDraftMessage}
          onSendMessage={handleSendMessage}
          onComposerBlur={handleComposerBlur}
          onLoadOlderMessages={handleLoadOlderMessages}
          onOpenChatList={() => setChatListOpen(true)}
          onOpenInfoPanel={() => setInfoPanelOpen(true)}
          onHideMessage={(message) => {
            void hideMessageAction(message)
          }}
          onDeleteMessage={(message) => {
            void deleteMessageAction(message)
          }}
        />
      </div>

      <Sheet open={isChatListOpen} onOpenChange={setChatListOpen}>
        <SheetContent side="left" className="w-full max-w-sm p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Chats</SheetTitle>
            <SheetDescription>Conversation list</SheetDescription>
          </SheetHeader>
          {chatListContent}
        </SheetContent>
      </Sheet>

      <Sheet open={isInfoPanelOpen} onOpenChange={setInfoPanelOpen}>
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversation details</SheetTitle>
            <SheetDescription>Members and room details</SheetDescription>
          </SheetHeader>
          {infoPanelContent}
        </SheetContent>
      </Sheet>

      <ContactsSheet
        open={isContactsOpen}
        onOpenChange={setIsContactsOpen}
        contacts={contacts}
        onOpenConversation={handleOpenSavedContact}
      />

      <SettingsSheet
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        config={userConfig}
        creditBalance={paymentsSnapshot?.balance ?? null}
        onThemeChange={handleThemeChange}
        onConfigChange={setUserConfig}
        onOpenPayments={() => handleOpenPayments("settings")}
        onSignOut={handleSignOut}
      />

      <NotificationsSheet
        open={isNotificationsOpen}
        onOpenChange={setIsNotificationsOpen}
      />

      <DmStartDialog
        open={isDmDialogOpen}
        onOpenChange={setIsDmDialogOpen}
        searchUsers={searchUsers}
        onStartDirectConversation={startDirectConversation}
      />

      <GroupRoomDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        onCreateGroup={handleCreateGroup}
        onJoinGroup={handleJoinGroup}
      />

      <ProfileOnboardingDialog />

      <ContactAliasDialog
        open={contactEditor != null}
        label={contactEditor?.label ?? null}
        value={contactAlias}
        onValueChange={setContactAlias}
        onOpenChange={(open) => {
          if (!open) {
            setContactEditor(null)
            setContactAlias("")
          }
        }}
        onSave={handleSaveContact}
      />

      <DeleteGroupDialog
        open={deleteRoomTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteRoomTarget(null)
          }
        }}
        onDelete={async () => {
          if (!deleteRoomTarget) {
            return
          }

          await deleteGroupConversationAction(deleteRoomTarget.id)
          setDeleteRoomTarget(null)
        }}
      />

      <PaymentsDialog />
    </div>
  )
}
