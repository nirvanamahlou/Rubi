'use client';

import { ChevronDown, House, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  clearHeaderSession,
  readHeaderSession,
  rememberHeaderSession,
} from '@/lib/header-session';
import { faMessages } from '@/messages/fa';
import { logoutAuthenticatedSession } from '@/modules/profile/api/client';
import {
  profileInitials,
  PROFILE_USER_FALLBACK,
} from '@/modules/profile/model/profile';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/overlays';

type UserIdentityState =
  | { status: 'loading'; displayName: 'در حال دریافت کاربر' }
  | { status: 'ready'; displayName: string; loggedInAt: string }
  | { status: 'error'; displayName: typeof PROFILE_USER_FALLBACK };

export function UserMenu() {
  const router = useRouter();
  const [identity, setIdentity] = useState<UserIdentityState>({
    status: 'loading',
    displayName: 'در حال دریافت کاربر',
  });

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      const cached = readHeaderSession();
      const api = getPublicApiBaseUrl();
      const response = api ? await refreshAuthenticatedSession(api) : null;
      if (!active) return;
      if (!response) {
        setIdentity({ status: 'error', displayName: PROFILE_USER_FALLBACK });
        return;
      }
      const remembered = rememberHeaderSession(
        response.user,
        cached?.loggedInAt,
      );
      setIdentity({
        status: 'ready',
        displayName: remembered.displayName,
        loggedInAt: remembered.loggedInAt,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    await logoutAuthenticatedSession().catch(() => undefined);
    clearHeaderSession();
    router.replace('/login');
    router.refresh();
  }

  const initials = profileInitials(identity.displayName);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`${faMessages.shell.userMenu}: ${identity.displayName}`}
          className="max-w-52 min-w-10 overflow-hidden rounded-xl border border-border/70 bg-surface/80 px-1.5 shadow-sm sm:px-2.5"
          data-header-session-summary
          data-user-menu-trigger
          variant="secondary"
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground"
          >
            {initials}
          </span>
          <span className="hidden min-w-0 max-w-32 truncate text-start text-xs font-bold lg:block">
            {identity.displayName}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="hidden size-4 shrink-0 lg:block"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <Link href="/workbench">
            <House aria-hidden="true" className="size-4" />
            میزکار من
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onSelect={() => void signOut()}
        >
          <LogOut aria-hidden="true" className="size-4" />
          {faMessages.shell.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
