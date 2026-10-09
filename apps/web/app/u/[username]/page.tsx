import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Lock,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FollowButton } from "@/components/social/follow-button";
import { CreatorBadge } from "@/components/creator/creator-badge";
import { PlusBadge } from "@/components/premium/plus-badge";
import { PROFILE_BANNER_IMAGE, type ProfileBanner } from "@/lib/profile-banners";
import { CreatorWidgets } from "@/components/creator/creator-widgets";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { api } from "@/lib/api";
import type { PublicProfile } from "@/lib/types";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  try {
    const { data } = await api.profiles.get(username);
    return {
      title: `${data.name} (@${data.username}) · CharBook`,
      description:
        data.bio?.slice(0, 160) ??
        `El Atelier de lectura de ${data.name} en CharBook Library.`,
    };
  } catch {
    return { title: "Lector no encontrado" };
  }
}

function memberSince(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es", {
    year: "numeric",
    month: "long",
  });
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;

  let profile: PublicProfile;
  let isPrivate = false;
  try {
    const res = await api.profiles.get(username);
    profile = res.data;
    isPrivate = res.meta?.is_private ?? false;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      {/* ========== HEADER (banner + identidad integrada) ========== */}
      <header className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        {/* Banner: fondo Premium Plus elegido o un degradado sobrio por defecto */}
        <div
          className="h-20 w-full bg-cover bg-center md:h-28"
          style={{
            backgroundImage:
              profile.is_premium_plus && profile.profile_banner
                ? PROFILE_BANNER_IMAGE[profile.profile_banner as ProfileBanner]
                : "radial-gradient(80% 140% at 15% -30%, rgba(217,170,90,0.14), transparent 55%), linear-gradient(180deg, rgba(30,28,24,0.55), transparent)",
          }}
          aria-hidden
        />

        {/* Identidad: foto integrada sobre el banner + nombre como parte del header */}
        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:justify-between md:px-6">
          <div className="flex items-end gap-4">
            <div
              className={`relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-full bg-card shadow-lg md:-mt-12 md:h-28 md:w-28 ${
                profile.is_creator
                  ? "border-[3px] border-amber-400/70 ring-2 ring-amber-400/15"
                  : "border-[3px] border-card ring-1 ring-primary/25"
              }`}
            >
              {profile.avatar ? (
                <Image src={profile.avatar} alt={profile.name} fill sizes="112px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/15 font-serif text-3xl text-primary">
                  {profile.name?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
                  {profile.name}
                </h1>
                <CreatorBadge level={profile.creator_level} size="md" />
                {profile.is_premium_plus && <PlusBadge plan="premium_plus" size="md" />}
                {!profile.is_public_profile && !profile.is_me && (
                  <Badge variant="outline" className="gap-1.5 border-border/60 text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span className="text-xs">Privado</span>
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                @{profile.username}
                {profile.member_since && (
                  <span className="ml-3 inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {profile.is_creator ? "En el Atelier desde" : "Lector desde"}{" "}
                    {memberSince(profile.member_since)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {profile.is_me ? (
              <Button variant="outline" asChild className="gap-2">
                <Link href="/ajustes/perfil">
                  <Pencil className="h-4 w-4" />
                  Editar perfil
                </Link>
              </Button>
            ) : (
              profile.username && (
                <FollowButton
                  username={profile.username}
                  initialState={profile.follow_state}
                  isPrivate={!profile.is_public_profile}
                  initialCount={profile.stats.followers}
                  size="lg"
                />
              )
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="px-4 pb-5 text-pretty text-sm leading-relaxed text-foreground/90 md:px-6">
            {profile.bio}
          </p>
        )}
      </header>

      {/* ========== SECCIONES DE CREADOR (anuncios, tips, eventos…) ========== */}
      {profile.is_creator && profile.creator_widgets && (
        <CreatorWidgets groups={profile.creator_widgets} />
      )}

      {/* ========== TABS (todo en un solo lugar) ========== */}
      <ProfileTabs profile={profile} isPrivate={isPrivate} />
    </div>
  );
}
