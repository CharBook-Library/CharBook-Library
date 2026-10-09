"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, ShoppingCart, MousePointerClick } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/api-admin";

interface Props {
  bookSlug: string;
}

const VENDORS = [
  { value: "amazon", label: "Amazon" },
  { value: "kobo", label: "Kobo" },
  { value: "audible", label: "Audible" },
  { value: "apple_books", label: "Apple Books" },
  { value: "google_play", label: "Google Play Books" },
  { value: "barnes_noble", label: "Barnes & Noble" },
  { value: "other", label: "Otro" },
] as const;

export function AffiliateLinksEditor({ bookSlug }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const queryKey = ["admin-affiliate-links", bookSlug];

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => adminApi.affiliateLinks.list(bookSlug),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => adminApi.affiliateLinks.delete(id),
    onSuccess: () => {
      toast.success("Enlace eliminado");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (link: { id: number; is_active: boolean }) =>
      adminApi.affiliateLinks.update(link.id, { is_active: !link.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Card className="space-y-4 border-border/60 bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-lg font-bold">Enlaces de afiliados</h2>
        </div>
        {!showForm && (
          <Button
            type="button"
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Añadir
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Añade enlaces a Amazon, Kobo, etc. con tu código de afiliado.
        El backend registra cada click y luego redirige al vendor.
      </p>

      {/* Formulario nuevo */}
      {showForm && (
        <AddLinkForm
          bookSlug={bookSlug}
          onCancel={() => setShowForm(false)}
          onAdded={() => setShowForm(false)}
        />
      )}

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : links.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Aún no hay enlaces de afiliados para este libro.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-3 rounded-md border border-border/60 bg-background/50 p-3"
            >
              <Badge className="border-0 bg-primary/20 text-primary">
                {link.vendor_label}
              </Badge>

              <div className="min-w-0 flex-1">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm hover:text-primary"
                  title={link.url}
                >
                  {link.url}
                </a>
                {link.label && (
                  <p className="truncate text-xs text-muted-foreground">
                    {link.label}
                  </p>
                )}
              </div>

              <div
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                title="Clicks totales"
              >
                <MousePointerClick className="h-3.5 w-3.5" />
                {link.click_count}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  toggleActiveMutation.mutate({
                    id: link.id,
                    is_active: link.is_active,
                  })
                }
                className={
                  link.is_active
                    ? "text-emerald-500"
                    : "text-muted-foreground"
                }
                title={link.is_active ? "Desactivar" : "Activar"}
              >
                {link.is_active ? "Activo" : "Inactivo"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                asChild
                className="h-8 w-8"
                title="Abrir"
              >
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm("¿Eliminar este enlace?")) {
                    removeMutation.mutate(link.id);
                  }
                }}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AddLinkForm({
  bookSlug,
  onAdded,
  onCancel,
}: {
  bookSlug: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [vendor, setVendor] = useState("amazon");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminApi.affiliateLinks.create(bookSlug, {
        vendor,
        url: url.trim(),
        label: label.trim() || null,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("Enlace añadido");
      queryClient.invalidateQueries({
        queryKey: ["admin-affiliate-links", bookSlug],
      });
      setUrl("");
      setLabel("");
      onAdded();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo crear el enlace"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("La URL es obligatoria");
      return;
    }
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-[140px_1fr]">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Vendor
          </label>
          <select
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="h-10 w-full rounded-md border border-border/60 bg-card px-3 text-sm"
          >
            {VENDORS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            URL completa *
          </label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://amazon.com/dp/XXX?tag=tuTag-20"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Etiqueta <span className="opacity-50">(opcional)</span>
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Ej: "Tapa dura $24.99" o "Audiolibro 12h"'
          maxLength={100}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Añadir enlace
        </Button>
      </div>
    </form>
  );
}
