"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { FollowButton } from "@/components/social/follow-button";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { socialApi } from "@/lib/api-social";
import { useDebounce } from "@/hooks/use-debounce";

export function ReaderSearch() {
  const [term, setTerm] = useState("");
  const debounced = useDebounce(term, 300);

  const { data: readers, isFetching } = useQuery({
    queryKey: ["reader-search", debounced],
    queryFn: () => socialApi.readers.search(debounced),
    enabled: debounced.trim().length >= 2,
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar lectores…"
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {debounced.trim().length >= 2 && (
        <ul className="mt-3 space-y-2">
          {readers?.map((reader) => (
            <li key={reader.id} className="flex items-center gap-3">
              <Link
                href={reader.username ? `/u/${reader.username}` : "#"}
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border/60"
              >
                {reader.avatar ? (
                  <Image src={reader.avatar} alt={reader.name} fill sizes="36px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-primary/15 text-sm text-primary">
                    {reader.name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                )}
              </Link>
              <Link
                href={reader.username ? `/u/${reader.username}` : "#"}
                className="min-w-0 flex-1"
              >
                <div className="flex items-center gap-1.5">
                  <span className="line-clamp-1 text-sm font-medium hover:text-primary">
                    {reader.name}
                  </span>
                  <CreatorBadge level={reader.creator_level} size="xs" iconOnly />
                </div>
                {reader.username && (
                  <div className="text-xs text-muted-foreground">@{reader.username}</div>
                )}
              </Link>
              {!reader.is_me && reader.username && (
                <FollowButton
                  username={reader.username}
                  initialState={reader.is_following ? "following" : "none"}
                  size="sm"
                />
              )}
            </li>
          ))}
          {readers && readers.length === 0 && !isFetching && (
            <li className="py-2 text-center text-sm text-muted-foreground">
              Sin lectores para «{debounced}».
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
