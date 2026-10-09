"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { Loader2, ExternalLink, Globe, Lock, UserCog, Camera, Check, Sparkles, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { socialApi } from "@/lib/api-social";
import { accountApi } from "@/lib/api-auth";
import { plusApi } from "@/lib/api-plus";
import { PROFILE_BANNERS, PROFILE_BANNER_IMAGE, type ProfileBanner } from "@/lib/profile-banners";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PlusBadge } from "@/components/premium/plus-badge";
import { cn } from "@/lib/utils";

const BIO_MAX = 500;

export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading, isAuthenticated } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [banner, setBanner] = useState<ProfileBanner | null>(null);
  const [bannerSheetOpen, setBannerSheetOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { isPremiumPlus } = useEntitlements();

  /* eslint-disable react-hooks/set-state-in-effect -- Hidrata una sola vez el formulario desde el usuario autenticado. */
  // Hidrata el formulario una vez que llega el usuario.
  useEffect(() => {
    if (user && !hydrated) {
      setName(user.name ?? "");
      setUsername(user.username ?? "");
      setBio(user.bio ?? "");
      setIsPublic(user.is_public_profile ?? true);
      setAvatarPreview(user.avatar ?? null);
      setBanner((user.preferences?.profile_banner as ProfileBanner | null | undefined) ?? null);
      setHydrated(true);
    }
  }, [user, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Fondo de perfil (Premium Plus): guarda al elegir (optimista).
  const bannerImage = banner ? PROFILE_BANNER_IMAGE[banner] : undefined;
  const pickBanner = async (value: ProfileBanner | null) => {
    if (!isPremiumPlus) return;
    const prev = banner;
    setBanner(value);
    try {
      await plusApi.setProfileBanner(value);
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    } catch {
      setBanner(prev);
      toast.error("No se pudo guardar el fondo de perfil.");
    }
  };

  // Subida de avatar — funciona también para usuarios Google
  const uploadAvatar = useMutation({
    mutationFn: (file: File) => accountApi.uploadAvatar(file),
    onSuccess: (res) => {
      setAvatarPreview(res.avatar);
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast.success("Foto actualizada.");
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      toast.error(err.response?.data?.message ?? "No se pudo subir la foto.");
    },
  });

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast.error("Solo imágenes (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máximo 5 MB.");
      return;
    }
    // Preview optimista
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
    uploadAvatar.mutate(file);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      // Si cambió nombre, hacer update vía accountApi
      if (name.trim() !== (user?.name ?? "")) {
        await accountApi.updateAccount({ name: name.trim() });
      }
      return socialApi.profiles.updateMine({
        username: username.trim(),
        bio: bio.trim() === "" ? null : bio.trim(),
        is_public_profile: isPublic,
      });
    },
    onSuccess: (data) => {
      toast.success("Perfil actualizado");
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      if (data.username) router.push(`/u/${data.username}`);
    },
    onError: (err: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
      const firstError =
        err.response?.data?.errors &&
        Object.values(err.response.data.errors)[0]?.[0];
      toast.error(firstError ?? err.response?.data?.message ?? "No se pudo guardar");
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <UserCog className="mx-auto mb-6 h-14 w-14 text-primary" />
        <h1 className="font-serif text-2xl font-bold">Tu perfil de lector</h1>
        <p className="mt-3 text-muted-foreground">
          Inicia sesión para editar tu Atelier público.
        </p>
        <Button asChild className="mt-8">
          <Link href="/login?from=/ajustes/perfil">Iniciar sesión</Link>
        </Button>
      </div>
    );
  }

  const usernameValid = /^[a-zA-Z0-9_]{3,30}$/.test(username);
  const selectedBanner = banner
    ? PROFILE_BANNERS.find((item) => item.key === banner) ?? null
    : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 md:py-12">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight md:text-3xl">
            Editar perfil
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Así te verán otros lectores en CharBook.
          </p>
        </div>
        {user?.username && (
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link href={`/u/${user.username}`}>
              Ver perfil <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!usernameValid) {
            toast.error("Username inválido (3-30 letras, números o guion bajo).");
            return;
          }
          mutation.mutate();
        }}
        className="space-y-6"
      >
        {/* ===== Portada (fondo de perfil) + Avatar ===== */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div
            className="relative h-20 w-full bg-cover bg-center md:h-24"
            style={bannerImage ? { backgroundImage: bannerImage } : undefined}
          >
            {!bannerImage && (
              <div className="absolute inset-0 bg-gradient-to-r from-muted/50 via-muted/20 to-transparent" />
            )}
            {banner && isPremiumPlus && (
              <span className="absolute right-3 top-3">
                <PlusBadge size="xs" />
              </span>
            )}
          </div>

          <div className="flex items-end gap-4 px-4 pb-4">
            <div className="relative -mt-12 h-24 w-24 shrink-0">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-card bg-muted ring-1 ring-primary/20">
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="Avatar" width={96} height={96}
                    className="h-full w-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground">
                    {(name?.[0] ?? user?.name?.[0] ?? "U").toUpperCase()}
                  </div>
                )}
              </div>
              {uploadAvatar.isPending && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
              <button type="button" onClick={() => fileInput.current?.click()}
                className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                aria-label="Cambiar foto">
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="pb-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Foto de perfil</p>
              <p>JPG, PNG o WebP. Máximo 5 MB.</p>
              {user?.google_id && (
                <p className="mt-1 text-amber-500">Puedes cambiar la foto de Google por una propia.</p>
              )}
            </div>
          </div>
        </div>

        {/* ===== Fondos Premium Plus (fondo de perfil) ===== */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-sm font-medium">Fondos Premium Plus</span>
            {isPremiumPlus ? (
              <PlusBadge size="xs" />
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
                <Sparkles className="h-2.5 w-2.5" /> Premium Plus
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {isPremiumPlus
              ? "Elige el fondo de tu perfil. Combinan con el tema de CharBook y se guardan al elegir."
              : "Dale un toque profesional al fondo de tu perfil. Disponible con Premium Plus."}
          </p>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border bg-cover bg-center",
                    selectedBanner ? "border-primary/40" : "border-dashed border-border/70",
                  )}
                  style={selectedBanner ? { backgroundImage: selectedBanner.image } : undefined}
                >
                  {!selectedBanner && (
                    <div className="flex h-full w-full items-center justify-center gap-1.5 bg-muted/20 text-xs font-medium text-muted-foreground">
                      <Ban className="h-3.5 w-3.5" /> Sin banner
                    </div>
                  )}
                  {selectedBanner && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[11px] font-medium text-white">
                      {selectedBanner.name}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {selectedBanner ? selectedBanner.name : "Sin banner"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isPremiumPlus
                      ? "Tu fondo actual. Abre la galeria para cambiarlo."
                      : "Puedes ver la galeria, pero guardar fondos requiere Premium Plus."}
                  </p>
                </div>
              </div>
              <Sheet open={bannerSheetOpen} onOpenChange={setBannerSheetOpen}>
                <SheetTrigger asChild>
                  <Button type="button" variant="outline" className="shrink-0">
                    {isPremiumPlus ? "Elegir fondo" : "Ver fondos"}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                  <SheetHeader className="text-left">
                    <SheetTitle className="font-serif text-2xl">Fondos Premium Plus</SheetTitle>
                    <SheetDescription>
                      Elige un banner oficial para tu perfil. El catalogo puede crecer sin saturar esta pantalla.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={!isPremiumPlus}
                      onClick={() => {
                        void pickBanner(null);
                        setBannerSheetOpen(false);
                      }}
                      aria-pressed={banner === null}
                      className={cn(
                        "relative flex h-28 items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed text-sm font-medium transition-colors",
                        banner === null
                          ? "border-primary text-primary ring-1 ring-primary"
                          : "border-border/70 text-muted-foreground hover:border-border",
                        !isPremiumPlus && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Ban className="h-4 w-4" /> Sin banner
                      {banner === null && (
                        <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>

                    {PROFILE_BANNERS.map((b) => {
                      const active = banner === b.key;
                      return (
                        <button
                          key={b.key}
                          type="button"
                          disabled={!isPremiumPlus}
                          onClick={() => {
                            void pickBanner(b.key);
                            setBannerSheetOpen(false);
                          }}
                          title={b.name}
                          aria-pressed={active}
                          style={{ backgroundImage: b.image }}
                          className={cn(
                            "group relative flex h-28 items-end overflow-hidden rounded-xl border bg-cover bg-center text-left transition-all duration-200",
                            active
                              ? "border-primary ring-2 ring-primary/60"
                              : "border-white/10 hover:border-white/30 hover:shadow-lg hover:shadow-black/30",
                            !isPremiumPlus && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <span
                            className={cn(
                              "w-full px-3 py-2 text-sm font-medium",
                              b.light
                                ? "bg-gradient-to-t from-white/70 to-transparent text-[#4a3a20]"
                                : "bg-gradient-to-t from-black/65 to-transparent text-white",
                            )}
                          >
                            {b.name}
                          </span>
                          {active && (
                            <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {!isPremiumPlus && (
                            <Lock className="absolute right-2 top-2 h-4 w-4 text-white/90 drop-shadow" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!isPremiumPlus && (
                    <Link href="/premium" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      <Sparkles className="h-4 w-4" /> Desbloquear con Premium Plus
                    </Link>
                  )}
                </SheetContent>
              </Sheet>
            </div>
          </div>
          {!isPremiumPlus && (
            <Link href="/premium" className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <Sparkles className="h-3 w-3" /> Desbloquear con Premium Plus
            </Link>
          )}
        </div>

        {/* Nombre */}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Nombre público
          </label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
            maxLength={80} placeholder="Cómo quieres que te vean" className="h-10" />
          <p className="mt-1 text-xs text-muted-foreground">
            Lo que verán otros lectores. Puedes usar tu nombre real o un alias.
          </p>
        </div>

        {/* Username */}
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
            Username
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">@</span>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={30}
              placeholder="tu_username"
              className="h-10"
              aria-invalid={username.length > 0 && !usernameValid}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Aparece en tu URL: /u/{username || "tu_username"}
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={4}
            placeholder="Cuéntale al mundo qué lees y por qué..."
            className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
            {bio.length}/{BIO_MAX}
          </p>
        </div>

        {/* Visibilidad */}
        <div>
          <span className="mb-1.5 block text-sm font-medium">Visibilidad</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                isPublic
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Globe className="h-4 w-4" /> Público
              </span>
              <span className="text-xs text-muted-foreground">
                Cualquiera ve tu estantería y reseñas.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                !isPublic
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border"
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="h-4 w-4" /> Privado
              </span>
              <span className="text-xs text-muted-foreground">
                Sólo tú ves tu biblioteca y reseñas.
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending || !usernameValid}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
