'use client';

import {
  messagingReactionEmojisV1,
  type MessagingMessageV1,
  type MessagingReactionEmojiV1,
} from '@nora/contracts';
import { Reply } from 'lucide-react';
import { useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui';

export const reactionNames: Record<MessagingReactionEmojiV1, string> = {
  '👍': 'پسندیدن',
  '❤️': 'قلب',
  '😂': 'خنده',
  '😮': 'تعجب',
  '🙏': 'سپاس',
};
export function MessageReactionMenu({
  message,
  position,
  currentUserId,
  disabled,
  onClose,
  onReply,
  onReact,
}: {
  message: MessagingMessageV1;
  position: { x: number; y: number };
  currentUserId: string;
  disabled: boolean;
  onClose: () => void;
  onReply: (message: MessagingMessageV1) => void;
  onReact: (
    message: MessagingMessageV1,
    emoji: MessagingReactionEmojiV1 | null,
  ) => void;
}) {
  const replyChosen = useRef(false);
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      modal={false}
      dir="rtl"
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none fixed size-px opacity-0"
          style={{ left: position.x, top: position.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={2}
        collisionPadding={12}
        aria-label="واکنش و پاسخ به پیام"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!replyChosen.current)
            document
              .getElementById(`chat-message-${message.id}`)
              ?.focus({ preventScroll: true });
        }}
      >
        <div
          className="flex gap-1 p-1"
          role="group"
          aria-label="واکنش‌های پیام"
        >
          {messagingReactionEmojisV1.map((emoji) => {
            const selected = message.reactions?.some(
              (item) =>
                item.emoji === emoji && item.userIds.includes(currentUserId),
            );
            return (
              <DropdownMenuItem
                key={emoji}
                disabled={disabled}
                aria-label={
                  selected
                    ? `حذف واکنش ${reactionNames[emoji]}`
                    : reactionNames[emoji]
                }
                className={`size-11 justify-center px-0 text-2xl ${selected ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                onSelect={() => onReact(message, selected ? null : emoji)}
              >
                {emoji}
              </DropdownMenuItem>
            );
          })}
        </div>
        <DropdownMenuItem
          disabled={disabled}
          onSelect={() => {
            replyChosen.current = true;
            onReply(message);
          }}
        >
          <Reply className="size-4" aria-hidden="true" /> پاسخ به پیام
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
